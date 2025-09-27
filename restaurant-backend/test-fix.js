// Test script to verify our content-length fix
const https = require('https');

function testContentLengthFix() {
  console.log('Testing content-length fix...');
  
  const options = {
    hostname: 'de-q-restaurants.vercel.app',
    port: 443,
    path: '/test-content-length', // This should route to api/test-content-length.ts
    method: 'GET',
    headers: {
      'Content-Length': '297', // This is what was causing the issue
      'Content-Type': 'application/json'
    }
  };
  
  const req = https.request(options, (res) => {
    console.log('Response status code:', res.statusCode);
    console.log('Response headers:', res.headers);
    
    let data = '';
    res.on('data', chunk => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response body:', data);
      console.log('Test completed successfully!');
      process.exit(0);
    });
  });
  
  req.on('error', (error) => {
    console.error('Request error:', error);
    process.exit(1);
  });
  
  // Don't send any body data, just end the request
  req.end();
}

// Add a timeout to prevent hanging
setTimeout(() => {
  console.log('Test timed out after 15 seconds');
  process.exit(1);
}, 15000);

testContentLengthFix();