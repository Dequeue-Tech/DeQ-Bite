import serverless from 'serverless-http';
import express from 'express';
import { getPrismaClient } from '../src/config/database';

const app = express();

app.get('/db-test', async (_req, res) => {
  try {
    console.log('Getting Prisma client in test');
    const prisma = getPrismaClient();
    console.log('Prisma client acquired');
    
    // Simple query to test 
    const count = await prisma.user.count();
    console.log('Database query completed');
    
    res.status(200).json({ 
      message: 'Database test working!',
      userCount: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({ 
      error: 'Database test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default serverless(app);

export const config = {
  maxDuration: 10,
  memory: 512,
};