import { ethers } from 'ethers';

// Type declaration for ethereum window object
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (eventName: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (eventName: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// Contract ABI - matching the actual deployed contract
const CONTRACT_ABI = [
  "function getAdmin() view returns (address)",
  "function chargeUSDT(address user, uint256 amount)",
  "function chargeBNB(address user, uint256 amount)",
  "function withdrawBNB(uint256 amount)",
  "function getUserBNBBalance(address user) view returns (uint256)",
  "function getTotalDepositedBNB() view returns (uint256)",
  "function getContractBalance() view returns (uint256)",
  "function getUSDTToken() view returns (address)",
  "event UserCharged(address indexed user, uint256 amount, string tokenType)",
  "event BNBDeposited(address indexed user, uint256 amount)",
  "event AdminChanged(address indexed oldAdmin, address indexed newAdmin)"
];

// USDT ABI for token operations
const USDT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

export interface Web3Result {
  success: boolean;
  account?: string;
  chainId?: number;
  error?: string;
}

export class Web3Service {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;
  private usdtContract: ethers.Contract | null = null;
  
  public account: string = '';
  public chainId: number = 0;

  // Contract addresses - using the actual deployed contract addresses
  private CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x11E4e896C6Bc7C39082E79B97722A4C973441556';
  private USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955';

  async connect(): Promise<Web3Result> {
    try {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        return { success: false, error: 'MetaMask is not installed' };
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const account = accounts[0];

      if (!account) {
        return { success: false, error: 'No account found' };
      }

      // Create provider and signer
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      this.signer = this.provider.getSigner();
      
      // Get network info
      const network = await this.provider.getNetwork();
      this.chainId = network.chainId;

      // Check if we're on BSC
      if (this.chainId !== 56 && this.chainId !== 97) {
        return { success: false, error: 'Please connect to BSC Mainnet or Testnet' };
      }

      // Initialize contract
      this.contract = new ethers.Contract(this.CONTRACT_ADDRESS, CONTRACT_ABI, this.signer);
      this.usdtContract = new ethers.Contract(this.USDT_ADDRESS, USDT_ABI, this.signer);

      this.account = account;

      return { success: true, account, chainId: this.chainId };
    } catch (error) {
      console.error('Web3 connection error:', error);
      return { success: false, error: 'Failed to connect to wallet' };
    }
  }

  async isAdmin(address: string): Promise<boolean> {
    try {
      if (!this.contract) {
        console.error('Contract not initialized');
        return false;
      }

      console.log('Checking admin status for address:', address);
      console.log('Contract address:', this.CONTRACT_ADDRESS);
      
      // Call the contract's getAdmin() function
      const adminAddress = await this.contract.getAdmin();
      console.log('Admin address from contract:', adminAddress);
      
      const isAdmin = adminAddress.toLowerCase() === address.toLowerCase();
      console.log('Is admin:', isAdmin);
      
      return isAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  async getAdminBalances(): Promise<{ usdtBalance: string; bnbBalance: string }> {
    try {
      if (!this.contract || !this.usdtContract || !this.account) {
        return { usdtBalance: '0', bnbBalance: '0' };
      }

      const usdtBalance = await this.usdtContract.balanceOf(this.account);
      const bnbBalance = await this.provider!.getBalance(this.account);

      return {
        usdtBalance: ethers.utils.formatUnits(usdtBalance, 18),
        bnbBalance: ethers.utils.formatEther(bnbBalance)
      };
    } catch (error) {
      console.error('Error getting admin balances:', error);
      return { usdtBalance: '0', bnbBalance: '0' };
    }
  }

  async chargeUSDT(userAddress: string, amount: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.contract) {
        return { success: false, error: 'Contract not initialized' };
      }

      const amountWei = ethers.utils.parseUnits(amount, 18);
      const tx = await this.contract.chargeUSDT(userAddress, amountWei);
      await tx.wait();

      return { success: true };
    } catch (error) {
      console.error('Error charging USDT:', error);
      return { success: false, error: 'Failed to charge USDT' };
    }
  }

  async chargeBNB(userAddress: string, amount: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.contract) {
        return { success: false, error: 'Contract not initialized' };
      }

      const amountWei = ethers.utils.parseEther(amount);
      const tx = await this.contract.chargeBNB(userAddress, amountWei);
      await tx.wait();

      return { success: true };
    } catch (error) {
      console.error('Error charging BNB:', error);
      return { success: false, error: 'Failed to charge BNB' };
    }
  }

  async withdrawBNB(amount: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.contract) {
        return { success: false, error: 'Contract not initialized' };
      }

      const amountWei = ethers.utils.parseEther(amount);
      const tx = await this.contract.withdrawBNB(amountWei);
      await tx.wait();

      return { success: true };
    } catch (error) {
      console.error('Error withdrawing BNB:', error);
      return { success: false, error: 'Failed to withdraw BNB' };
    }
  }

  async getUserBNBBalance(userAddress: string): Promise<string> {
    try {
      if (!this.contract) return '0';
      const balance = await this.contract.getUserBNBBalance(userAddress);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('Error getting user BNB balance:', error);
      return '0';
    }
  }

  async getUserBalances(userAddress: string): Promise<{ usdtBalance: string; bnbBalance: string }> {
    try {
      if (!this.usdtContract || !this.provider) {
        return { usdtBalance: '0', bnbBalance: '0' };
      }

      // Get USDT balance
      const usdtBalance = await this.usdtContract.balanceOf(userAddress);
      
      // Get BNB balance (native token)
      const bnbBalance = await this.provider.getBalance(userAddress);

      return {
        usdtBalance: ethers.utils.formatUnits(usdtBalance, 18),
        bnbBalance: ethers.utils.formatEther(bnbBalance)
      };
    } catch (error) {
      console.error('Error getting user balances:', error);
      return { usdtBalance: '0', bnbBalance: '0' };
    }
  }

  async getTotalDepositedBNB(): Promise<string> {
    try {
      if (!this.contract) return '0';
      const balance = await this.contract.getTotalDepositedBNB();
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('Error getting total deposited BNB:', error);
      return '0';
    }
  }

  async getContractBalance(): Promise<string> {
    try {
      if (!this.contract) return '0';
      const balance = await this.contract.getContractBalance();
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('Error getting contract balance:', error);
      return '0';
    }
  }

  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.usdtContract = null;
    this.account = '';
    this.chainId = 0;
  }
}

export const web3Service = new Web3Service();
