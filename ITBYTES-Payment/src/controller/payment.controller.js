const Payment = require('../model/payment.model');
const {server, publisher} = require('../configs/rabbitmq.config');

//test RabbitMQ connection
exports.testRabbitMQSend = async (req, res) => {
    try {
        // Check RabbitMQ connection status
        publisher.paymentSuccess(server.channel, Buffer.from('Test message'));
    } catch (error) {   
        return res.status(500).json({
            success: false,
            message: 'Failed to test RabbitMQ connection'
        });
    }
}; 

// Create a new payment
exports.createPayment = async (req, res) => {
    try {
        // Validate required fields
        const { userId, amount, orderId } = req.body;
        
        if (!userId || !amount || !orderId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, amount, and orderId are required'
            });
        }

        // Validate amount is a number and greater than 0
        if (isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be a number greater than 0'
            });
        }

        // Create and save the payment
        const payment = new Payment({
            userId,
            amount: Number(amount),
            orderId
        });

        const newPayment = await payment.save();

        // Send response first
        res.status(201).json({
            success: true,
            data: newPayment
        });

        // Then publish to RabbitMQ
        const messagePayload = {
            transactionId: newPayment._id.toString(),
            orderId: newPayment.orderId,
            userId: newPayment.userId,
            amount: newPayment.amount,
            timestamp: new Date().toISOString()
        };

        // Using the wrapped publisher with built-in error handling
        await publisher.paymentSuccess(server.channel, Buffer.from(JSON.stringify(req.body)));

    } catch (error) {
        console.error('Payment creation error:', error);
        if (!res.headersSent) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
};

// Get all payments
exports.getPayments = async (req, res) => {
    try {
        const payments = await Payment.find();
        res.status(200).json({
            success: true,
            count: payments.length,
            data: payments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get single payment
exports.getPayment = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }
        res.status(200).json({
            success: true,
            data: payment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Update payment
exports.updatePayment = async (req, res) => {
    try {
        const payment = await Payment.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            }); 
        }

        res.status(200).json({
            success: true,
            data: payment
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Test RabbitMQ connection
exports.testRabbitMQConnection = async (req, res) => {
    try {
        const status = getConnectionStatus();
        return res.status(200).json({
            success: true,
            status: {
                isConnected: status.isConnected,
                isConnecting: status.isConnecting,
                reconnectAttempts: status.reconnectAttempts,
                queues: Object.values(QUEUES)
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to test RabbitMQ connection'
        });
    }
};