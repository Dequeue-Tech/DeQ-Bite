// Ultra minimal TypeScript file with no dependencies
export default (req: any, res: any) => {
  console.log('ultra-minimal-v2.ts: Request received');
  res.status(200).json({ 
    message: 'Ultra minimal v2 working!',
    timestamp: new Date().toISOString()
  });
};

export const config = {
  maxDuration: 5,
  memory: 512,
};