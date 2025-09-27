// Test script for minimal fix
const https = require('https');

function testMinimalFix() {
  console.log('Testing minimal fix...');
  
  const options = {
    hostname: 'de-q-restaurants.vercel.app',
    port: 443,
    path: '/minimal-fix',
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
      console.log('Minimal fix test completed!');
      process.exit(0);
    });
  });
  
  req.on('error', (error) => {
    console.error('Request error:', error);
    process.exit(1);
  });
  
  req.end();
}

// Add a timeout to prevent hanging
setTimeout(() => {
  console.log('Test timed out after 10 seconds');
  process.exit(1);
}, 10000);

testMinimalFix();