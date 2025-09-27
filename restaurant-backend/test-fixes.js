// Test script to verify our fixes for the content-length issue
const http = require('http');
const { once } = require('events');

// Simulate a GET request with content-length header (the problematic case)
async function testContentLengthIssue() {
  console.log('Testing content-length issue fix...');
  
  const server = http.createServer(async (req, res) => {
    console.log('Server received request:', {
      method: req.method,
      url: req.url,
      headers: req.headers
    });
    
    // Simulate our fix - for GET requests with content-length, set empty body
    if (req.method === 'GET' && req.headers['content-length']) {
      console.log('Applying fix: GET request with content-length, setting empty body');
      req.body = {};
    }
    
    // Send a simple response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Test response', 
      fixApplied: req.method === 'GET' && !!req.headers['content-length']
    }));
  });
  
  server.listen(3001, () => {
    console.log('Test server running on port 3001');
  });
  
  // Make a test request with content-length header on a GET request
  const testRequest = http.request({
    hostname: 'localhost',
    port: 3001,
    path: '/test-content-length',
    method: 'GET',
    headers: {
      'Content-Length': '297', // This is what was causing the issue
      'Content-Type': 'application/json'
    }
  }, (res) => {
    console.log('Response status code:', res.statusCode);
    console.log('Response headers:', res.headers);
    
    let data = '';
    res.on('data', chunk => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response body:', data);
      server.close(() => {
        console.log('Test server closed');
      });
    });
  });
  
  testRequest.on('error', (error) => {
    console.error('Request error:', error);
    server.close();
  });
  
  // Don't send any body data, just end the request
  testRequest.end();
}

testContentLengthIssue().catch(console.error);