// Simple test to see if the endpoint is working at all
const https = require('https');

function simpleTest() {
  console.log('Testing simple request...');
  
  const options = {
    hostname: 'de-q-restaurants.vercel.app',
    port: 443,
    path: '/test-content-length',
    method: 'GET'
    // No content-length header
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
      console.log('Simple test completed!');
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

simpleTest();