import '../vercel-env';
declare const debugHandler: (event: any, context: any) => Promise<Object | {
    statusCode: number;
    headers: {
        'Content-Type': string;
    };
    body: string;
}>;
export default debugHandler;
export declare const config: {
    maxDuration: number;
    memory: number;
};
//# sourceMappingURL=index.d.ts.map