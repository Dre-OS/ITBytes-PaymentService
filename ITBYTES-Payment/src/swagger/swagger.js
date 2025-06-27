const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Payment Service API',
    version: '1.0.0',
    description: 'API documentation for Payment Service',
  },
  servers: [
    {
      url: 'http://192.168.9.2:3000',
      description: 'Payment',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js'], // Path to the API routes
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;