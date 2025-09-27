// Add debugging
console.log('Starting connection-test.ts');

import '../vercel-env';
console.log('Environment variables loaded');

import { getPrismaClient } from '../src/config/database';
console.log('Database module imported');

import serverless from 'serverless-http';
import express from 'express';

console.log('Creating express app for connection test');
const app = express();

app.get('/connection-test', async (_req, res) => {
  try {
    console.log('Starting connection test');
    const prisma = getPrismaClient();
    console.log('Prisma client acquired');
    
    // Test a simple query
    console.log('Executing simple query');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Query executed successfully:', result);
    
    res.status(200).json({ 
      success: true, 
      message: 'Database connection test successful',
      result
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

console.log('Creating serverless function for connection test');
const handler = serverless(app);

console.log('Exporting connection test handler');
export default handler;

export const config = {
  maxDuration: 10,
  memory: 512,
};