import B2 from 'backblaze-b2';
import dotenv from 'dotenv';

dotenv.config();

async function testB2() {
  try {
    console.log('Testing B2 connection...');
    console.log('Key ID:', process.env.B2_APPLICATION_KEY_ID?.substring(0, 8) + '...');
    console.log('Bucket:', process.env.B2_BUCKET_NAME);
    console.log('Private:', process.env.B2_BUCKET_PRIVATE);

    const b2 = new B2({
      applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
      applicationKey: process.env.B2_APPLICATION_KEY,
    });

    await b2.authorize();
    console.log('✅ B2 Authorization successful!');

    // List buckets
    const buckets = await b2.listBuckets({});
    console.log('Buckets:', buckets.data.buckets.map(b => b.bucketName));

    // Test upload
    const testBuffer = Buffer.from('Test invoice PDF content');
    const bucketId = buckets.data.buckets.find(b => b.bucketName === process.env.B2_BUCKET_NAME)?.bucketId;
    
    if (!bucketId) {
      console.error('❌ Bucket not found!');
      return;
    }

    const uploadUrl = await b2.getUploadUrl({ bucketId });
    const upload = await b2.uploadFile({
      uploadUrl: uploadUrl.data.uploadUrl,
      uploadAuthToken: uploadUrl.data.authorizationToken,
      fileName: 'invoices/test-invoice.pdf',
      data: testBuffer,
    });

    console.log('✅ Test upload successful!');
    console.log('File ID:', upload.data.fileId);

    // Clean up test file
    await b2.deleteFileVersion({
      fileId: upload.data.fileId,
      fileName: 'invoices/test-invoice.pdf',
    });
    console.log('✅ Test cleanup successful!');
    console.log('\n🎉 B2 is configured correctly!');

  } catch (error) {
    console.error('❌ B2 Test failed:', error.message);
    process.exit(1);
  }
}

testB2();
