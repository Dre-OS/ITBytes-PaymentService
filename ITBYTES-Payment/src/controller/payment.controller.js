const Payment = require('../model/payment.model');
const { getConnectionStatus, QUEUES } = require('../configs/rabbitmq.config');

// Create a new payment
exports.createPayment = async (req, res) => {
    try {
        const payment = new Payment({
            userId: req.body.userId,
            amount: req.body.amount,
            orderId: req.body.orderId
        });

        const newPayment = await payment.save();
        res.status(201).json({
            success: true,
            data: newPayment
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
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