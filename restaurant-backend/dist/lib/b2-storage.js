"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToB2 = uploadToB2;
exports.downloadFromB2 = downloadFromB2;
exports.deleteFromB2 = deleteFromB2;
exports.listFilesInB2 = listFilesInB2;
exports.isPrivateBucket = isPrivateBucket;
exports.getSignedDownloadUrl = getSignedDownloadUrl;
exports.isB2Configured = isB2Configured;
exports.getFileInfo = getFileInfo;
const backblaze_b2_1 = __importDefault(require("backblaze-b2"));
const logger_1 = require("../utils/logger");
let b2Client = null;
let authPromise = null;
function getB2Client() {
    if (!b2Client) {
        const applicationKeyId = process.env['B2_APPLICATION_KEY_ID'];
        const applicationKey = process.env['B2_APPLICATION_KEY'];
        if (!applicationKeyId || !applicationKey) {
            throw new Error('Backblaze B2 credentials not configured');
        }
        b2Client = new backblaze_b2_1.default({
            applicationKeyId,
            applicationKey,
        });
    }
    return b2Client;
}
async function authenticateB2() {
    if (authPromise) {
        return authPromise;
    }
    authPromise = getB2Client().authorize();
    return authPromise;
}
async function getBucketId() {
    const bucketId = process.env['B2_BUCKET_ID'];
    if (bucketId) {
        return bucketId;
    }
    const bucketName = process.env['B2_BUCKET_NAME'];
    if (!bucketName) {
        throw new Error('B2_BUCKET_ID or B2_BUCKET_NAME must be configured');
    }
    await authenticateB2();
    const b2 = getB2Client();
    const response = await b2.listBuckets({});
    const bucket = response.data.buckets.find((b) => b.bucketName === bucketName);
    if (!bucket) {
        throw new Error(`Bucket "${bucketName}" not found in B2`);
    }
    return bucket.bucketId;
}
async function uploadToB2(fileBuffer, fileName, _contentType = 'application/pdf') {
    try {
        await authenticateB2();
        const b2 = getB2Client();
        const bucketId = await getBucketId();
        const uploadUrlResponse = await b2.getUploadUrl({ bucketId });
        const { uploadUrl, authorizationToken } = uploadUrlResponse.data;
        const uploadResponse = await b2.uploadFile({
            uploadUrl,
            uploadAuthToken: authorizationToken,
            fileName,
            data: fileBuffer,
        });
        const { fileId, fileName: uploadedFileName } = uploadResponse.data;
        const publicUrl = generatePublicUrl(fileName);
        logger_1.logger.info('File uploaded to B2 successfully', {
            fileId,
            fileName: uploadedFileName,
            size: fileBuffer.length,
        });
        return {
            fileId,
            fileName: uploadedFileName,
            publicUrl,
        };
    }
    catch (error) {
        logger_1.logger.error('Failed to upload file to B2', {
            error: error instanceof Error ? error.message : 'Unknown error',
            fileName,
        });
        throw new Error('Failed to upload file to B2 storage');
    }
}
function generatePublicUrl(fileName) {
    const customDomain = process.env['B2_CUSTOM_DOMAIN'];
    if (customDomain) {
        const domain = customDomain.replace(/\/$/, '');
        return `${domain}/${fileName}`;
    }
    const bucketName = process.env['B2_BUCKET_NAME'];
    if (!bucketName) {
        throw new Error('B2_BUCKET_NAME must be configured for public URLs');
    }
    return `https://f000.backblazeb2.com/file/${bucketName}/${fileName}`;
}
async function downloadFromB2(fileName) {
    try {
        await authenticateB2();
        const b2 = getB2Client();
        const bucketName = process.env['B2_BUCKET_NAME'];
        if (!bucketName) {
            throw new Error('B2_BUCKET_NAME must be configured');
        }
        const response = await b2.downloadFileByName({
            bucketName,
            fileName,
            responseType: 'arraybuffer',
        });
        logger_1.logger.info('File downloaded from B2 successfully', {
            fileName,
            size: response.data.byteLength,
        });
        return Buffer.from(response.data);
    }
    catch (error) {
        logger_1.logger.error('Failed to download file from B2', {
            error: error instanceof Error ? error.message : 'Unknown error',
            fileName,
        });
        throw new Error('Failed to download file from B2 storage');
    }
}
async function deleteFromB2(fileId, fileName) {
    try {
        await authenticateB2();
        const b2 = getB2Client();
        await b2.deleteFileVersion({
            fileId,
            fileName,
        });
        logger_1.logger.info('File deleted from B2 successfully', {
            fileId,
            fileName,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete file from B2', {
            error: error instanceof Error ? error.message : 'Unknown error',
            fileId,
            fileName,
        });
        throw new Error('Failed to delete file from B2 storage');
    }
}
async function listFilesInB2(prefix) {
    try {
        await authenticateB2();
        const b2 = getB2Client();
        const bucketId = await getBucketId();
        const listParams = {
            bucketId,
            startFileName: prefix || '',
            maxFileCount: 1000,
            delimiter: '',
        };
        const response = await b2.listFileNames(listParams);
        return response.data.files.map((file) => ({
            fileId: file.fileId,
            fileName: file.fileName,
            contentLength: parseInt(file.contentLength, 10),
            uploadTimestamp: file.uploadTimestamp,
        }));
    }
    catch (error) {
        logger_1.logger.error('Failed to list files in B2', {
            error: error instanceof Error ? error.message : 'Unknown error',
            prefix,
        });
        throw new Error('Failed to list files from B2 storage');
    }
}
function isPrivateBucket() {
    return process.env['B2_BUCKET_PRIVATE'] === 'true';
}
async function getSignedDownloadUrl(fileName, validDurationInSeconds = 3600) {
    try {
        await authenticateB2();
        const b2 = getB2Client();
        const bucketId = await getBucketId();
        const authResponse = await b2.getDownloadAuthorization({
            bucketId,
            fileNamePrefix: fileName,
            validDurationInSeconds,
        });
        const { authorizationToken } = authResponse.data;
        const downloadUrl = generatePublicUrl(fileName);
        const signedUrl = `${downloadUrl}?Authorization=${authorizationToken}`;
        logger_1.logger.info('Generated signed download URL', {
            fileName,
            validDurationInSeconds,
        });
        return signedUrl;
    }
    catch (error) {
        logger_1.logger.error('Failed to generate signed download URL', {
            error: error instanceof Error ? error.message : 'Unknown error',
            fileName,
        });
        throw new Error('Failed to generate signed download URL');
    }
}
function isB2Configured() {
    return !!(process.env['B2_APPLICATION_KEY_ID'] &&
        process.env['B2_APPLICATION_KEY'] &&
        (process.env['B2_BUCKET_ID'] || process.env['B2_BUCKET_NAME']));
}
async function getFileInfo(fileName) {
    try {
        const files = await listFilesInB2(fileName);
        const file = files.find(f => f.fileName === fileName);
        return file || null;
    }
    catch (error) {
        logger_1.logger.error('Failed to get file info from B2', {
            error: error instanceof Error ? error.message : 'Unknown error',
            fileName,
        });
        return null;
    }
}
//# sourceMappingURL=b2-storage.js.map