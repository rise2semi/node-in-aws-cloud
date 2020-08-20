require('dotenv').config();

const config = require('./libs/config');
const db = require('knex')(config.db);

const AWS = require('aws-sdk');
const csv = require('csv-parser');

const BUCKET = 'node-in-aws-cloud-catalogs';

module.exports = {
    catalogsList: async function() {
        const s3 = new AWS.S3({ region: 'us-east-1' });
        const params = {
            Bucket: BUCKET,
            Prefix: 'uploaded/',
            Delimiter: '/'
        };

        const catalogs = await s3.listObjects(params).promise()
        const response = {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(catalogs.Contents.map(catalog => catalog.Key.replace(catalogs.Prefix, '')))
        };
        
        return response;
    },

    catalogUpload: async function(event) {
        const catalogName = event.queryStringParameters.name;
        const catalogPath = `uploaded/${catalogName}`;
    
        const s3 = new AWS.S3({ region: 'us-east-1' });
        const params = {
            Bucket: BUCKET,
            Key: catalogPath,
            Expires: 60,
            ContentType: 'text/csv'
        };

        return new Promise((resolve, reject) => {
            s3.getSignedUrl('putObject', params, (error, url) => {
                if (error) {
                    return reject(err);
                }
                
                resolve({
                    statusCode: 200,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: url
                });
            })
        });
    },

    catalogParse: function(event) {
        const s3 = new AWS.S3({ region: 'us-east-1' });
        const sqs = new AWS.SQS();

        event.Records.forEach(record => {        
            const s3Stream = s3.getObject({
                Bucket: BUCKET,
                Key: record.s3.object.key
            }).createReadStream();
    
            s3Stream.pipe(csv())
                .on('data', (data) => {
                    sqs.sendMessage({
                        QueueUrl: process.env.SQS_URL,
                        MessageBody: JSON.stringify(data)
                    }, (error, data) => {
                        console.log(error, data);
                    });
                })
                .on('end', () => {
                    s3.copyObject({
                        Bucket: BUCKET,
                        CopySource: BUCKET + '/' + record.s3.object.key,
                        Key: record.s3.object.key.replace('uploaded', 'parsed')
                    }).promise().then(() => {
                        s3.deleteObject({
                            Bucket: BUCKET,
                            Key: record.s3.object.key
                        }, () => {
                            console.log(record.s3.object.key.split('/')[1] + ' is parsed');
                        });
                    })
                });
        });
    },

    catalogItemProcess: async function(event) {
        const sns = new AWS.SNS({ region: 'us-east-1' });

        event.Records.forEach((record) => {
            const item = JSON.parse(record.body);
            const product = await db('products').insert({ name: item.name });
            if (!product) {
                console.error('Cannot create a product');
            }
        });

        sns.publish({
            Message: 'Items were processed',
            TopicArn: process.env.SNS_ARN
        }).promise().then((error, data) => {
            console.log(error, data)
        });
    }
};
