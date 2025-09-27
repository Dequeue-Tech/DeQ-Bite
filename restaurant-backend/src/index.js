import serverless from 'serverless-http';
import app from './server.ts'; // wherever your Express app lives

export default serverless(app);
