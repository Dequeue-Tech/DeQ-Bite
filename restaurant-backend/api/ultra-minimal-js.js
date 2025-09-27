// Ultra minimal JavaScript file with no dependencies
module.exports = (req, res) => {
  console.log('ultra-minimal-js.js: Request received');
  res.status(200).json({ 
    message: 'Ultra minimal JS working!',
    timestamp: new Date().toISOString()
  });
};

module.exports.config = {
  maxDuration: 5,
  memory: 512,
};