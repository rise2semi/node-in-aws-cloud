require('dotenv').config();

const config = require('./libs/config');
const db = require('knex')(config.db);

module.exports = {
    productsList: async function() {
        const products = await db('products').select('*');
        if (!products) {
            console.error('Cannot find any product');
        }
    
        const response = {
            statusCode: 200,
            body: JSON.stringify(products)
        };
        
        return response;
    },

    productsCreate: async function({ body }) {
        const params = JSON.parse(body)
        const product = await db('products').insert(params);
        if (!product) {
            console.error('Cannot create a product');
        }
    
        const response = {
            statusCode: 201
        };
        
        return response;
    },

    productsDelete: async function(event) {
        const productId = event.pathParameters.productId;
        const product = await db('products').delete().where('id', productId);
        if (!product) {
            console.error('Cannot delete a product');
        }
    
        const response = {
            statusCode: 200
        };
        
        return response;
    }
};
