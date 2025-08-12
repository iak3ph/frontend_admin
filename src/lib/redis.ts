export interface ApprovalRecord {
  walletAddress: string;
  approvalAmount: string;
  timestamp: number;
  transactionHash?: string;
  status: 'pending' | 'success' | 'failed';
}

export class RedisService {
  // Save approval record via API
  async saveApproval(approvalData: ApprovalRecord): Promise<void> {
    try {
      const response = await fetch('/api/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(approvalData),
      });

      if (!response.ok) {
        throw new Error('Failed to save approval data');
      }

      console.log('Approval data saved via API:', approvalData);
    } catch (error) {
      console.error('Error saving approval data via API:', error);
      throw error;
    }
  }

  // Get approval record for a wallet address via API
  async getApproval(walletAddress: string): Promise<ApprovalRecord | null> {
    try {
      const response = await fetch(`/api/approval?walletAddress=${walletAddress}`);
      
      if (!response.ok) {
        throw new Error('Failed to get approval data');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error getting approval data via API:', error);
      return null;
    }
  }

  // Update approval status via API
  async updateApprovalStatus(walletAddress: string, status: 'pending' | 'success' | 'failed', transactionHash?: string): Promise<void> {
    try {
      const response = await fetch('/api/approval', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          status,
          transactionHash
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update approval status');
      }

      console.log('Approval status updated via API');
    } catch (error) {
      console.error('Error updating approval status via API:', error);
      throw error;
    }
  }

  // Get all approval records via API
  async getAllApprovals(): Promise<ApprovalRecord[]> {
    try {
      const response = await fetch('/api/approval/all');
      
      if (!response.ok) {
        throw new Error('Failed to get all approval data');
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error getting all approval data via API:', error);
      return [];
    }
  }

  // Delete approval record via API
  async deleteApproval(walletAddress: string): Promise<void> {
    try {
      const response = await fetch(`/api/approval?walletAddress=${walletAddress}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete approval data');
      }

      console.log('Approval data deleted via API');
    } catch (error) {
      console.error('Error deleting approval data via API:', error);
      throw error;
    }
  }
}

export const redisService = new RedisService();
