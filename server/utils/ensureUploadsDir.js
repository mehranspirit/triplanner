const { s3Client } = require('./s3Config');
const { ListBucketsCommand } = require('@aws-sdk/client-s3');

async function checkS3Connectivity() {
  try {
    console.log('Checking S3 connectivity...');
    const data = await s3Client.send(new ListBucketsCommand({}));
    const bucketExists = data.Buckets.some(bucket => bucket.Name === process.env.AWS_BUCKET_NAME);
    
    if (bucketExists) {
      console.log(`✅ Successfully connected to S3 bucket: ${process.env.AWS_BUCKET_NAME}`);
    } else {
      console.warn(`⚠️ Connected to S3, but bucket '${process.env.AWS_BUCKET_NAME}' not found. Available buckets:`, 
        data.Buckets.map(b => b.Name).join(', '));
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to AWS S3:', error.message);
    return false;
  }
}

module.exports = checkS3Connectivity; 