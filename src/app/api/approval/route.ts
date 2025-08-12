import { NextRequest, NextResponse } from 'next/server';
import Redis from "ioredis";

// Initialize Redis client on server side with proper error handling
let client: Redis | null = null;

function getRedisClient(): Redis {
  if (!client) {
    const redisUrl = process.env.REDIS_URL || "rediss://default:Aa2sAAIjcDE2NDkxZjljMjQ2ZmY0MGNiYTkyY2IzZDg4OGM4ZDI5ZnAxMA@easy-cat-44460.upstash.io:6379";
    
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
    });

    client.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    client.on('connect', () => {
      console.log('Redis connected successfully');
    });

    client.on('ready', () => {
      console.log('Redis is ready');
    });
  }
  return client;
}

export interface ApprovalRecord {
  walletAddress: string;
  approvalAmount: string;
  timestamp: number;
  transactionHash?: string;
  status: 'pending' | 'success' | 'failed';
}

// POST /api/approval - Save approval record
export async function POST(request: NextRequest) {
  try {
    const redisClient = getRedisClient();
    const body = await request.json();
    const { walletAddress, approvalAmount, status, transactionHash } = body;

    const approvalRecord: ApprovalRecord = {
      walletAddress,
      approvalAmount,
      timestamp: Date.now(),
      status,
      transactionHash
    };

    const key = `approval:${walletAddress}`;
    const value = JSON.stringify(approvalRecord);
    await redisClient.set(key, value);

    console.log('Approval data saved to Redis:', approvalRecord);

    return NextResponse.json({ success: true, data: approvalRecord });
  } catch (error) {
    console.error('Error saving approval data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save approval data' },
      { status: 500 }
    );
  }
}

// GET /api/approval?walletAddress=... - Get approval record
export async function GET(request: NextRequest) {
  try {
    const redisClient = getRedisClient();
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const key = `approval:${walletAddress}`;
    const value = await redisClient.get(key);

    if (value) {
      const approvalRecord = JSON.parse(value) as ApprovalRecord;
      return NextResponse.json({ success: true, data: approvalRecord });
    } else {
      return NextResponse.json({ success: true, data: null });
    }
  } catch (error) {
    console.error('Error getting approval data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get approval data' },
      { status: 500 }
    );
  }
}

// PUT /api/approval - Update approval status
export async function PUT(request: NextRequest) {
  try {
    const redisClient = getRedisClient();
    const body = await request.json();
    const { walletAddress, status, transactionHash } = body;

    const key = `approval:${walletAddress}`;
    const existingValue = await redisClient.get(key);

    if (existingValue) {
      const approvalRecord = JSON.parse(existingValue) as ApprovalRecord;
      approvalRecord.status = status;
      if (transactionHash) {
        approvalRecord.transactionHash = transactionHash;
      }

      await redisClient.set(key, JSON.stringify(approvalRecord));
      console.log('Approval status updated:', approvalRecord);

      return NextResponse.json({ success: true, data: approvalRecord });
    } else {
      return NextResponse.json(
        { success: false, error: 'Approval record not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error updating approval status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update approval status' },
      { status: 500 }
    );
  }
}

// DELETE /api/approval?walletAddress=... - Delete approval record
export async function DELETE(request: NextRequest) {
  try {
    const redisClient = getRedisClient();
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const key = `approval:${walletAddress}`;
    const deleted = await redisClient.del(key);

    if (deleted > 0) {
      console.log('Approval data deleted from Redis:', walletAddress);
      return NextResponse.json({ success: true, message: 'Approval record deleted' });
    } else {
      return NextResponse.json(
        { success: false, error: 'Approval record not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error deleting approval data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete approval data' },
      { status: 500 }
    );
  }
}
