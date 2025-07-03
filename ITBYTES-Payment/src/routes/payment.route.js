const express = require('express');
const router = express.Router();
const paymentController = require('../controller/payment.controller');

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a new payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - amount
 *               - orderId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User identifier (must be unique)
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               orderId:
 *                 type: string
 *                 description: Order identifier
 *     responses:
 *       201:
 *         description: Payment created successfully
 *       400:
 *         description: Invalid request
 */
router.post('/', paymentController.createPayment);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of all payments
 *       500:
 *         description: Server error
 */
router.get('/', paymentController.getPayments);

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get a payment by ID
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details
 *       404:
 *         description: Payment not found
 */
router.get('/:id', paymentController.getPayment);

/**
 * @swagger
 * /api/payments/{id}:
 *   put:
 *     summary: Update a payment
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User identifier (must be unique)
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               orderId:
 *                 type: string
 *                 description: Order identifier
 *     responses:
 *       200:
 *         description: Payment updated successfully
 *       404:
 *         description: Payment not found
 */
router.put('/:id', paymentController.updatePayment);

/**
 * @swagger
 * /api/payments/test/rabbitmq:
 *   get:
 *     summary: Test RabbitMQ connection status
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Connection test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Whether the connection test was successful
 *                 status:
 *                   type: object
 *                   properties:
 *                     isConnected:
 *                       type: boolean
 *                       description: Current connection status to RabbitMQ
 *                     isConnecting:
 *                       type: boolean
 *                       description: Whether currently attempting to connect
 *                     reconnectAttempts:
 *                       type: integer
 *                       description: Number of reconnection attempts made
 *                     queues:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of available queues
 *       500:
 *         description: Connection test failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to test RabbitMQ connection
 */
router.get('/test/rabbitmq', paymentController.testRabbitMQSend);

module.exports = router;