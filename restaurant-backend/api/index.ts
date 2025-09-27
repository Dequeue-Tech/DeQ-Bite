import serverless from 'serverless-http';
import app from '../src/server'; // Import the Express app from src directory

export default serverless(app);