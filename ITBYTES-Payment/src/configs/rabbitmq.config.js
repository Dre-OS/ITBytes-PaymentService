const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqps://ohcjywzb:ObmX3HW1v4G15PE35c_LUdHKgx14ZEwJ@cougar.rmq.cloudamqp.com/ohcjywzb';

// RabbitMQ connection helper
async function connect(uri) {
    try {
        if (!uri) {
            uri = 'amqp://guest:guest@localhost:5672';
            console.warn("No RabbitMQ URI provided, using default 'amqp://guest:guest@localhost:5672'");
        }

        console.log("Attempting to connect to RabbitMQ at:", uri.split('@')[1]); // Only log the host part, not credentials
        const connection = await amqp.connect(uri, {
            heartbeat: 60,
            timeout: 10000,
            connectionTimeout: 10000
        });
        
        connection.on('error', (err) => {
            console.error('RabbitMQ connection error:', err.message);
            throw err;
        });

        const channel = await connection.createChannel();
        channel.on('error', (err) => {
            console.error('RabbitMQ channel error:', err.message);
            throw err;
        });

        console.log("Connected to RabbitMQ successfully");
        return { connection, channel };
    } catch (error) {
        console.error("Failed to connect to RabbitMQ:", error.message);
        throw new Error(`RabbitMQ Connection Failed: ${error.message}`);
    }
}

// Publisher composer
function composePublisher({connectionUri, exchange, exchangeType, routingKey, queue, options}) {
    const defaultOptions = {
        durable: true,
        exclusive: false,
        autoDelete: false
    };

    return async (message) => {
        let connection, channel;
        try {
            const result = await connect(connectionUri);
            connection = result.connection;
            channel = result.channel;

            if (exchange) {
                await channel.assertExchange(exchange, exchangeType, options || defaultOptions);
            } else {
                await channel.assertQueue(queue, options || defaultOptions);
            }

            const messageBuffer = Buffer.from(JSON.stringify(message));
            const published = await channel.publish(exchange, routingKey, messageBuffer, {
                persistent: true,
                contentType: 'application/json'
            });

            if (!published) {
                throw new Error('Message could not be published to RabbitMQ');
            }

            console.log(`Message published to ${exchange} with routing key ${routingKey}`);
        } catch (error) {
            console.error(`Error publishing message to ${exchange}:`, error.message);
            throw new Error(`Publishing Failed: ${error.message}`);
        } finally {
            try {
                if (channel) await channel.close();
                if (connection) await connection.close();
            } catch (closeError) {
                console.error('Error closing connection:', closeError.message);
            }
        }
    };
}

// Exchange definitions
const EXCHANGES = {
    ORDER: 'orderexchange',
    PAYMENT: 'paymentexchange'
};

// Publishers configuration with error handling
const publishers = {
    orderSuccess: composePublisher({
        connectionUri: RABBITMQ_URL,
        exchange: EXCHANGES.ORDER,
        exchangeType: "topic",
        routingKey: "order.success"
    }),
    paymentConfirmed: composePublisher({
        connectionUri: RABBITMQ_URL,
        exchange: EXCHANGES.PAYMENT,
        exchangeType: "topic",
        routingKey: "payment.confirmed"
    }),
    paymentFailed: composePublisher({
        connectionUri: RABBITMQ_URL,
        exchange: EXCHANGES.PAYMENT,
        exchangeType: "topic",
        routingKey: "payment.failed"
    }),
    paymentProcessing: composePublisher({
        connectionUri: RABBITMQ_URL,
        exchange: EXCHANGES.PAYMENT,
        exchangeType: "topic",
        routingKey: "payment.processing"
    }),
    paymentRefund: composePublisher({
        connectionUri: RABBITMQ_URL,
        exchange: EXCHANGES.PAYMENT,
        exchangeType: "topic",
        routingKey: "payment.refund"
    }),
    paymentRefundProcessed: composePublisher({
        connectionUri: RABBITMQ_URL,
        exchange: EXCHANGES.PAYMENT,
        exchangeType: "topic",
        routingKey: "payment.refund.processed"
    })
};

// Queue names for payment service
const QUEUES = {
    PAYMENT_REQUEST: 'payment.request',
    PAYMENT_PROCESSING: 'payment.processing',
    PAYMENT_CONFIRMED: 'payment.confirmed',
    PAYMENT_FAILED: 'payment.failed',
    PAYMENT_REFUND: 'payment.refund',
    PAYMENT_REFUND_PROCESSED: 'payment.refund.processed'
};

let channel, connection;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

async function connectQueue() {
    if (isConnecting) {
        console.log('Connection attempt already in progress...');
        return;
    }

    try {
        isConnecting = true;
        console.log('Attempting to connect to RabbitMQ...');
        
        // Close existing connections if any
        if (channel) await channel.close();
        if (connection) await connection.close();

        const result = await connect(RABBITMQ_URL);
        connection = result.connection;
        channel = result.channel;

        connection.on('error', (err) => {
            console.error('RabbitMQ connection error:', err);
            attemptReconnect();
        });

        connection.on('close', () => {
            console.log('RabbitMQ connection closed');
            attemptReconnect();
        });

        // Assert exchanges
        for (const exchange of Object.values(EXCHANGES)) {
            await channel.assertExchange(exchange, 'topic', {
                durable: true
            });
            console.log(`Exchange ${exchange} asserted successfully`);
        }

        // Assert and bind queues to exchanges with appropriate routing keys
        await channel.assertQueue(QUEUES.PAYMENT_REQUEST, { durable: true });
        await channel.bindQueue(QUEUES.PAYMENT_REQUEST, EXCHANGES.PAYMENT, 'payment.request');

        await channel.assertQueue(QUEUES.PAYMENT_PROCESSING, { durable: true });
        await channel.bindQueue(QUEUES.PAYMENT_PROCESSING, EXCHANGES.PAYMENT, 'payment.processing');

        await channel.assertQueue(QUEUES.PAYMENT_CONFIRMED, { durable: true });
        await channel.bindQueue(QUEUES.PAYMENT_CONFIRMED, EXCHANGES.PAYMENT, 'payment.confirmed');

        await channel.assertQueue(QUEUES.PAYMENT_FAILED, { durable: true });
        await channel.bindQueue(QUEUES.PAYMENT_FAILED, EXCHANGES.PAYMENT, 'payment.failed');

        await channel.assertQueue(QUEUES.PAYMENT_REFUND, { durable: true });
        await channel.bindQueue(QUEUES.PAYMENT_REFUND, EXCHANGES.PAYMENT, 'payment.refund');

        await channel.assertQueue(QUEUES.PAYMENT_REFUND_PROCESSED, { durable: true });
        await channel.bindQueue(QUEUES.PAYMENT_REFUND_PROCESSED, EXCHANGES.PAYMENT, 'payment.refund.processed');

        console.log('All queues and bindings set up successfully');

        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;
        isConnecting = false;
        
        return channel;
    } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error);
        isConnecting = false;
        await attemptReconnect();
        throw error;
    }
}

async function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnection attempts reached. Please check your RabbitMQ connection.');
        return;
    }

    reconnectAttempts++;
    console.log(`Attempting to reconnect... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    
    setTimeout(async () => {
        try {
            await connectQueue();
        } catch (error) {
            console.error('Reconnection attempt failed:', error);
        }
    }, 5000 * reconnectAttempts); // Increasing delay between attempts
}

async function publishMessage(queue, message) {
    try {
        if (!channel || !connection || connection.closed) {
            console.log('No active connection, attempting to connect...');
            await connectQueue();
        }
        console.log(`Publishing message to queue: ${queue}`);
        await channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
        console.log('Message published successfully');
    } catch (error) {
        console.error(`Error publishing message to queue ${queue}:`, error);
        throw error;
    }
}

async function consumeMessage(queue, callback) {
    try {
        if (!channel || !connection || connection.closed) {
            console.log('No active connection, attempting to connect...');
            await connectQueue();
        }
        console.log(`Starting to consume messages from queue: ${queue}`);
        await channel.consume(queue, (data) => {
            if (data) {
                console.log(`Received message from queue: ${queue}`);
                try {
                    const message = JSON.parse(data.content);
                    callback(message);
                    channel.ack(data);
                    console.log('Message processed and acknowledged');
                } catch (error) {
                    console.error('Error processing message:', error);
                    channel.nack(data, false, true); // Requeue the message
                }
            }
        });
        console.log(`Consumer setup complete for queue: ${queue}`);
    } catch (error) {
        console.error(`Error setting up consumer for queue ${queue}:`, error);
        throw error;
    }
}

// Event handler functions
async function handlePaymentRequest(message) {
    try {
        console.log('Processing payment request:', message);
        
        // Publish payment processing status
        await publishers.paymentProcessing({
            orderId: message.orderId,
            amount: message.amount,
            status: 'processing',
            timestamp: new Date().toISOString()
        });

        // Simulate payment processing (replace with actual payment gateway integration)
        const paymentSuccess = Math.random() > 0.1; // 90% success rate for simulation

        if (paymentSuccess) {
            // Publish payment confirmation
            await publishers.paymentConfirmed({
                orderId: message.orderId,
                amount: message.amount,
                status: 'confirmed',
                transactionId: `txn_${Date.now()}`,
                timestamp: new Date().toISOString()
            });

            // Notify order service
            await publishers.orderSuccess({
                orderId: message.orderId,
                status: 'paid',
                timestamp: new Date().toISOString()
            });
        } else {
            // Publish payment failure
            await publishers.paymentFailed({
                orderId: message.orderId,
                amount: message.amount,
                status: 'failed',
                reason: 'Payment processing failed',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Error handling payment request:', error);
        await publishers.paymentFailed({
            orderId: message.orderId,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

async function handleRefundRequest(message) {
    try {
        console.log('Processing refund request:', message);

        // Publish refund processing status
        await publishers.paymentProcessing({
            orderId: message.orderId,
            amount: message.amount,
            status: 'refund_processing',
            timestamp: new Date().toISOString()
        });

        // Simulate refund processing (replace with actual refund logic)
        const refundSuccess = Math.random() > 0.1; // 90% success rate for simulation

        if (refundSuccess) {
            await publishers.paymentRefundProcessed({
                orderId: message.orderId,
                amount: message.amount,
                status: 'refunded',
                refundId: `ref_${Date.now()}`,
                timestamp: new Date().toISOString()
            });
        } else {
            await publishers.paymentFailed({
                orderId: message.orderId,
                amount: message.amount,
                status: 'refund_failed',
                reason: 'Refund processing failed',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Error handling refund request:', error);
        await publishers.paymentFailed({
            orderId: message.orderId,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Initialize event listeners
async function initializeEventListeners() {
    try {
        // Set up payment request listener
        await consumeMessage(QUEUES.PAYMENT_REQUEST, handlePaymentRequest);
        
        // Set up refund request listener
        await consumeMessage(QUEUES.PAYMENT_REFUND, handleRefundRequest);
        
        console.log('Payment service event listeners initialized successfully');
    } catch (error) {
        console.error('Failed to initialize event listeners:', error);
        throw error;
    }
}

// Initialize connection and event listeners when module is loaded
connectQueue()
    .then(() => initializeEventListeners())
    .catch(err => {
        console.error('Failed to initialize payment service:', err);
    });

process.on('exit', () => {
    if (channel) channel.close();
    if (connection) connection.close();
});

// Keep the connection alive
setInterval(() => {
    if (!connection || connection.closed) {
        console.log('Connection check: Reconnecting to RabbitMQ...');
        connectQueue().catch(err => {
            console.error('Periodic reconnection failed:', err);
        });
    }
}, 10000); // Check every 10 seconds

module.exports = {
    connectQueue,
    publishMessage,
    consumeMessage,
    QUEUES,
    publishers,
    getConnectionStatus: () => ({
        isConnected: !!(connection && !connection.closed),
        isConnecting,
        reconnectAttempts
    })
};