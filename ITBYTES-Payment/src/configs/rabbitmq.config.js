const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqps://ohcjywzb:ObmX3HW1v4G15PE35c_LUdHKgx14ZEwJ@cougar.rmq.cloudamqp.com/ohcjywzb';

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

        connection = await amqp.connect(RABBITMQ_URL);
        console.log('RabbitMQ connection established successfully');

        connection.on('error', (err) => {
            console.error('RabbitMQ connection error:', err);
            attemptReconnect();
        });

        connection.on('close', () => {
            console.log('RabbitMQ connection closed');
            attemptReconnect();
        });

        channel = await connection.createChannel();
        console.log('RabbitMQ channel created');

        // Assert all queues
        for (const queue of Object.values(QUEUES)) {
            await channel.assertQueue(queue, {
                durable: true
            });
            console.log(`Queue ${queue} asserted successfully`);
        }

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

process.on('exit', () => {
    if (channel) channel.close();
    if (connection) connection.close();
});

// Initialize connection when module is loaded
connectQueue().catch(err => {
    console.error('Initial RabbitMQ connection failed:', err);
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
    getConnectionStatus: () => ({
        isConnected: !!(connection && !connection.closed),
        isConnecting,
        reconnectAttempts
    })
};