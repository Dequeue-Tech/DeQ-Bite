export declare function uploadToB2(fileBuffer: Buffer, fileName: string, _contentType?: string): Promise<{
    fileId: string;
    fileName: string;
    publicUrl: string;
}>;
export declare function downloadFromB2(fileName: string): Promise<Buffer>;
export declare function deleteFromB2(fileId: string, fileName: string): Promise<void>;
export declare function listFilesInB2(prefix?: string): Promise<Array<{
    fileId: string;
    fileName: string;
    contentLength: number;
    uploadTimestamp: number;
}>>;
export declare function isPrivateBucket(): boolean;
export declare function getSignedDownloadUrl(fileName: string, validDurationInSeconds?: number): Promise<string>;
export declare function isB2Configured(): boolean;
export declare function getFileInfo(fileName: string): Promise<{
    fileId: string;
    fileName: string;
    contentLength: number;
    uploadTimestamp: number;
} | null>;
//# sourceMappingURL=b2-storage.d.ts.map