import { NextResponse } from 'next/server';
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

// GET /api/approval/all - Get all approval records
export async function GET() {
  try {
    const redisClient = getRedisClient();
    const keys = await redisClient.keys('approval:*');
    const approvals: ApprovalRecord[] = [];
    
    for (const key of keys) {
      const value = await redisClient.get(key);
      if (value) {
        approvals.push(JSON.parse(value) as ApprovalRecord);
      }
    }
    
    console.log(`Retrieved ${approvals.length} approval records`);
    return NextResponse.json({ success: true, data: approvals });
  } catch (error) {
    console.error('Error getting all approval data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get all approval data' },
      { status: 500 }
    );
  }
}
