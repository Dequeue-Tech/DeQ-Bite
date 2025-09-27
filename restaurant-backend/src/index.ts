import serverless from 'serverless-http';
import app from './server.js'; // wherever your Express app lives

export default serverless(app);
