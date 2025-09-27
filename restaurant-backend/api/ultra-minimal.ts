// Ultra minimal test with timing and debugging
console.log('Ultra minimal test starting at:', new Date().toISOString());

import serverless from 'serverless-http';
import express from 'express';

const app = express();

app.get('/ultra-minimal', (_req, res) => {
  console.log('Ultra minimal endpoint hit at:', new Date().toISOString());
  res.status(200).json({ 
    message: 'Ultra minimal test working!',
    timestamp: new Date().toISOString()
  });
});

// Add a debug endpoint to check for active handles
app.get('/ultra-debug', (_req, res) => {
  console.log('Ultra debug endpoint hit at:', new Date().toISOString());
  
  // Try to check for active handles (this might not work in all environments)
  try {
    if ((process as any)._getActiveHandles) {
      const handles = (process as any)._getActiveHandles();
      console.log('Ultra debug: Active handles count:', handles.length);
      // Log first few handles for debugging
      handles.slice(0, 5).forEach((handle: any, index: number) => {
        console.log(`Ultra debug: Handle ${index}:`, handle.constructor?.name || typeof handle);
      });
    }
    
    if ((process as any)._getActiveRequests) {
      const requests = (process as any)._getActiveRequests();
      console.log('Ultra debug: Active requests count:', requests.length);
    }
  } catch (error) {
    console.log('Ultra debug: Error checking handles:', error);
  }
  
  res.status(200).json({ 
    message: 'Ultra debug test working!',
    timestamp: new Date().toISOString()
  });
});

const handler = serverless(app);

export default handler;

export const config = {
  maxDuration: 5,
  memory: 512,
};

console.log('Ultra minimal test initialization complete at:', new Date().toISOString());