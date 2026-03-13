import B2 from 'backblaze-b2';
import { logger } from '@/utils/logger';

// B2 client instance
let b2Client: B2 | null = null;
let authPromise: Promise<unknown> | null = null;

/**
 * Initialize Backblaze B2 client
 */
function getB2Client(): B2 {
  if (!b2Client) {
    const applicationKeyId = process.env['B2_APPLICATION_KEY_ID'];
    const applicationKey = process.env['B2_APPLICATION_KEY'];

    if (!applicationKeyId || !applicationKey) {
      throw new Error('Backblaze B2 credentials not configured');
    }

    b2Client = new B2({
      applicationKeyId,
      applicationKey,
    });
  }
  return b2Client;
}

/**
 * Authenticate with B2 (with caching)
 */
async function authenticateB2(): Promise<unknown> {
  if (authPromise) {
    return authPromise;
  }

  authPromise = getB2Client().authorize();
  return authPromise;
}

/**
 * Get bucket ID from environment or by name
 */
async function getBucketId(): Promise<string> {
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
  
  // Filter buckets by name manually since the SDK type doesn't include bucketName param

  const bucket = response.data.buckets.find((b: { bucketName: string }) => b.bucketName === bucketName);
  if (!bucket) {
    throw new Error(`Bucket "${bucketName}" not found in B2`);
  }

  return bucket.bucketId;
}

/**
 * Upload a file to Backblaze B2
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file in B2
 * @param contentType - MIME type of the file
 * @returns Object containing the public URL and file info
 */
export async function uploadToB2(
  fileBuffer: Buffer,
  fileName: string,
  _contentType: string = 'application/pdf'
): Promise<{ fileId: string; fileName: string; publicUrl: string | null }> {
  try {
    await authenticateB2();
    const b2 = getB2Client();
    const bucketId = await getBucketId();

    // Get upload URL for the bucket
    const uploadUrlResponse = await b2.getUploadUrl({ bucketId });
    const { uploadUrl, authorizationToken } = uploadUrlResponse.data;

    // Upload the file
    const uploadResponse = await b2.uploadFile({
      uploadUrl,
      uploadAuthToken: authorizationToken,
      fileName,
      data: fileBuffer,
      // Note: contentType is passed via the data buffer, B2 infers from file extension
    } as unknown as { uploadUrl: string; uploadAuthToken: string; fileName: string; data: Buffer; });

    const { fileId, fileName: uploadedFileName } = uploadResponse.data;

    // Generate URL — for private buckets, return null (access via API proxy only)
    // For public buckets, return the direct B2 URL
    const publicUrl = isPrivateBucket() ? null : generatePublicUrl(fileName);

    logger.info('File uploaded to B2 successfully', {
      fileId,
      fileName: uploadedFileName,
      size: fileBuffer.length,
      private: isPrivateBucket(),
    });

    return {
      fileId,
      fileName: uploadedFileName,
      publicUrl,
    };
  } catch (error) {
    logger.error('Failed to upload file to B2', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName,
    });
    throw new Error('Failed to upload file to B2 storage');
  }
}

/**
 * Generate a public URL for a B2 file
 * Uses custom domain if configured, otherwise uses B2's native URL
 */
function generatePublicUrl(fileName: string): string {
  const customDomain = process.env['B2_CUSTOM_DOMAIN'];
  
  if (customDomain) {
    // Remove trailing slash if present
    const domain = customDomain.replace(/\/$/, '');
    return `${domain}/${fileName}`;
  }

  // Use B2's native public URL format
  const bucketName = process.env['B2_BUCKET_NAME'];
  if (!bucketName) {
    throw new Error('B2_BUCKET_NAME must be configured for public URLs');
  }

  return `https://f000.backblazeb2.com/file/${bucketName}/${fileName}`;
}

/**
 * Download a file from Backblaze B2
 * @param fileName - The name of the file in B2
 * @returns Buffer containing the file data
 */
export async function downloadFromB2(fileName: string): Promise<Buffer> {
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

    logger.info('File downloaded from B2 successfully', {
      fileName,
      size: (response.data as ArrayBuffer).byteLength,
    });

    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    logger.error('Failed to download file from B2', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName,
    });
    throw new Error('Failed to download file from B2 storage');
  }
}

/**
 * Delete a file from Backblaze B2
 * @param fileId - The B2 file ID
 * @param fileName - The name of the file (for logging)
 */
export async function deleteFromB2(fileId: string, fileName: string): Promise<void> {
  try {
    await authenticateB2();
    const b2 = getB2Client();

    await b2.deleteFileVersion({
      fileId,
      fileName,
    });

    logger.info('File deleted from B2 successfully', {
      fileId,
      fileName,
    });
  } catch (error) {
    logger.error('Failed to delete file from B2', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileId,
      fileName,
    });
    throw new Error('Failed to delete file from B2 storage');
  }
}

/**
 * List files in the B2 bucket with optional prefix
 * @param prefix - Optional prefix to filter files
 * @returns Array of file objects
 */
export async function listFilesInB2(prefix?: string): Promise<Array<{
  fileId: string;
  fileName: string;
  contentLength: number;
  uploadTimestamp: number;
}>> {
  try {
    await authenticateB2();
    const b2 = getB2Client();
    const bucketId = await getBucketId();

    // Use type assertion to bypass strict type checking for B2 SDK
    const listParams = {
      bucketId,
      startFileName: prefix || '',
      maxFileCount: 1000,
      delimiter: '',
    } as unknown as Parameters<typeof b2.listFileNames>[0];
    
    const response = await b2.listFileNames(listParams);

    return response.data.files.map((file: any) => ({
      fileId: file.fileId,
      fileName: file.fileName,
      contentLength: parseInt(file.contentLength, 10),
      uploadTimestamp: file.uploadTimestamp,
    }));
  } catch (error) {
    logger.error('Failed to list files in B2', {
      error: error instanceof Error ? error.message : 'Unknown error',
      prefix,
    });
    throw new Error('Failed to list files from B2 storage');
  }
}

/**
 * Check if B2 bucket is private (requires signed URLs)
 */
export function isPrivateBucket(): boolean {
  return process.env['B2_BUCKET_PRIVATE'] === 'true';
}

/**
 * Get a signed/authorized download URL for a private bucket file
 * @param fileName - The name of the file in B2
 * @param validDurationInSeconds - How long the URL should be valid (default: 1 hour)
 * @returns Signed URL for downloading the file
 */
export async function getSignedDownloadUrl(
  fileName: string,
  validDurationInSeconds: number = 3600
): Promise<string> {
  try {
    await authenticateB2();
    const b2 = getB2Client();
    const bucketId = await getBucketId();

    // Get download authorization for the file
    const authResponse = await b2.getDownloadAuthorization({
      bucketId,
      fileNamePrefix: fileName,
      validDurationInSeconds,
    });

    const { authorizationToken } = authResponse.data;

    // Construct the download URL with authorization
    const downloadUrl = generatePublicUrl(fileName);
    const signedUrl = `${downloadUrl}?Authorization=${authorizationToken}`;

    logger.info('Generated signed download URL', {
      fileName,
      validDurationInSeconds,
    });

    return signedUrl;
  } catch (error) {
    logger.error('Failed to generate signed download URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName,
    });
    throw new Error('Failed to generate signed download URL');
  }
}

/**
 * Check if B2 storage is properly configured
 */
export function isB2Configured(): boolean {
  return !!(
    process.env['B2_APPLICATION_KEY_ID'] &&
    process.env['B2_APPLICATION_KEY'] &&
    (process.env['B2_BUCKET_ID'] || process.env['B2_BUCKET_NAME'])
  );
}

/**
 * Get file info from B2 by file name
 * Returns null if file not found
 */
export async function getFileInfo(fileName: string): Promise<{
  fileId: string;
  fileName: string;
  contentLength: number;
  uploadTimestamp: number;
} | null> {
  try {
    const files = await listFilesInB2(fileName);
    const file = files.find(f => f.fileName === fileName);
    return file || null;
  } catch (error) {
    logger.error('Failed to get file info from B2', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName,
    });
    return null;
  }
}
