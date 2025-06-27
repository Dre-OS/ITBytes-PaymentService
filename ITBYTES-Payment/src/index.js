const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const mongoose = require('mongoose');

const connectDB = require('./configs/mongodb.config');
const paymentRoutes = require('./routes/payment.route');

// Load environment variables
require('dotenv').config();

// Swagger Configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ITBytes Payment Service API',
            version: '1.0.0',
            description: 'API documentation for ITBytes Payment Service',
            contact: {
                name: 'ITBytes Team'
            }
        },
        servers: [
            {
                url: 'http://192.168.9.2:3001',
                description: 'Payment'
            }
        ],
        components: {
            schemas: {
                Payment: {
                    type: 'object',
                    required: ['userId', 'amount', 'orderId'],
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Payment identifier (transformed from _id)'
                        },
                        userId: {
                            type: 'string',
                            description: 'User identifier',
                            unique: true
                        },
                        amount: {
                            type: 'number',
                            description: 'Payment amount'
                        },
                        orderId: {
                            type: 'string',
                            description: 'Order identifier'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Payment creation timestamp (added by timestamps)'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Last update timestamp (added by timestamps)'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Error message'
                        },
                        code: {
                            type: 'string',
                            description: 'Error code'
                        }
                    }
                }
            }
        }
    },
    apis: ['./src/routes/*.js']
};

const swaggerDocs = swaggerJSDoc(swaggerOptions);
const app = express();

// Middleware with increased payload size limits
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));

// Basic route
app.get('/', (req, res) => {
    res.send('ITBytes Payment Service is running');
});

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerDocs, {
    explorer: true,
    customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-themes@3.0.0/themes/3.x/theme-material.css',
    customSiteTitle: "ITBytes Payment API Documentation",
    swaggerOptions: {
        defaultModelsExpandDepth: -1,
        docExpansion: 'none'
    }
}));

// Routes
app.use('/api/payments', paymentRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).json({
        message: err.message || 'Something went wrong!',
        code: err.code || 'INTERNAL_SERVER_ERROR'
    });
});

const PORT = process.env.PORT || 3001;

// Connect to MongoDB first, then start the server
const startServer = async () => {
    try {
        await connectDB();
        console.log('Connected to MongoDB successfully');
        
        app.listen(PORT, () => {
            console.log(`Payment Service is running on port ${PORT}`);
            console.log(`Payment API documentation is available at http://192.168.9.2:${PORT}/api-docs`);
        });
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
};

startServer();