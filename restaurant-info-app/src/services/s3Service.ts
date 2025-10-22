import AWS from 'aws-sdk';

const s3 = new AWS.S3();

class S3Service {
    async uploadFile(bucketName: string, fileName: string, fileContent: Buffer | string): Promise<AWS.S3.PutObjectOutput> {
        const params = {
            Bucket: bucketName,
            Key: fileName,
            Body: fileContent,
        };
        return s3.upload(params).promise();
    }

    async deleteFile(bucketName: string, fileName: string): Promise<AWS.S3.DeleteObjectOutput> {
        const params = {
            Bucket: bucketName,
            Key: fileName,
        };
        return s3.deleteObject(params).promise();
    }

    getFileUrl(bucketName: string, fileName: string): string {
        return s3.getSignedUrl('getObject', {
            Bucket: bucketName,
            Key: fileName,
            Expires: 60 * 60, // URLの有効期限を1時間に設定
        });
    }
}

export default new S3Service();