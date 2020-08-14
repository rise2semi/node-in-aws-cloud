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
        }
    
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

    catalogParse: function(event, context, callback) {
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
                    });
                })
                .on('end', () => {
                    s3.copyObject({
                        Bucket: BUCKET,
                        CopySource: record.s3.object.key,
                        Key: record.s3.object.key.replace('uploaded', 'parsed')
                    }).promise().then(() => {
                        s3.deleteObject({
                            Bucket: BUCKET,
                            Key: record.s3.object.key
                        }).promise().then(() => {
                            callback(null, { statusCode: 200 })
                        })
                    });
                });
        });
    },

    catalogItemProcess: async function(event) {
        event.Records.forEach((item) => {
            const item = JSON.parse(item.Body);
            const product = await db('products').insert({ name: item.name });
            if (!product) {
                console.error('Cannot create a product');
            }
        });
        
        const response = {
            statusCode: 201
        };
        
        return response;
    }
};
