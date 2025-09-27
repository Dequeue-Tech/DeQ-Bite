// Test script to verify our Vercel deployment fixes
const https = require('https');

function testEndpoint() {
  console.log('Testing Vercel deployment...');
  
  const options = {
    hostname: 'de-q-restaurants.vercel.app',
    port: 443,
    path: '/test-content-length',
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
      process.exit(0); // Exit the process
    });
  });
  
  req.on('error', (error) => {
    console.error('Request error:', error);
    process.exit(1); // Exit with error
  });
  
  // Don't send any body data, just end the request
  req.end();
}

// Add a timeout to prevent hanging
setTimeout(() => {
  console.log('Test timed out after 10 seconds');
  process.exit(1);
}, 10000);

testEndpoint();