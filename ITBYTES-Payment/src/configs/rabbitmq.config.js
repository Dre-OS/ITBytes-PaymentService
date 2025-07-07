const Payment = require("../model/payment.model");
const amqp = require('amqplib');
const {connect, composePublisher } = require('rabbitmq-publisher');

const amqpuri = process.env.AMQP_URI || 'amqps://cjodwydd:5ycFMEa-7OilmVBsHMvPMrKSPI1ipii_@armadillo.rmq.cloudamqp.com/cjodwydd';

// Create a server object to store the connection
const server = { 
  connection: null, 
  channel: null 
};

// Initialize connection
async function initRabbitMQ() {
  try {
    const {connection, channel} = await connect(amqpuri);
    // const channel = await connection.createChannel();
    server.connection = connection;
    server.channel = channel;
    console.log('Connected to RabbitMQ Publisher successfully');
  } catch (err) {
    console.error('Failed to connect to RabbitMQ:', err);
  }
}

// Initialize immediately
initRabbitMQ();

function createTopicPublisher(routingKey, exchange, queueName, options) {
  return composePublisher({
    exchange: exchange,
    exchangeType: 'topic',
    connectionUri: amqpuri,
    routingKey: routingKey,
    queue: queueName,
    options: options || {
      durable: true,
      exclusive: false,
      autoDelete: false
    }
  });
}

const publisher = {
  // paymentProcessing: createTopicPublisher('payment.processing', 'payment', 'payment-events', null),
  paymentSuccess: createTopicPublisher('payment.success', 'payment', 'payment-events', null),
  paymentFailed: createTopicPublisher('payment.failed', 'payment', 'payment-events', null),
  
  // orderPaid: createTopicPublisher('order.paid', 'order', 'order-events', null),
}

const MessagingController = {
    paymentSuccess: async (req, res) => {
      console.log('Payment success request received:');
      // try {
      //   // Create payment first
      //   const paymentData = {
      //     userId: req.body.userId,
      //     amount: req.body.amount,
      //     orderId: req.body.orderId
      //   };

      //   const payment = await Payment.create(paymentData);

      //   // Test shit
      //   // console.log('Payment created:' + JSON.stringify(req.body));


      //   // Publish payment success event
      //   await publisher.paymentSuccess({
      //     paymentId: payment._id.toString(), // MongoDB ObjectId
      //     orderId: payment.orderId,
      //     amount: payment.amount,
      //     userId: payment.userId,
      //     status: 'success',
      //     timestamp: new Date().toISOString()
        // });

        // Notify order service
        // await publisher.orderPaid({
        //   orderId: payment.orderId,
        //   paymentId: payment._id.toString(), // MongoDB ObjectId
        //   amount: payment.amount,
        //   status: 'paid',
        //   timestamp: new Date().toISOString()
        // });
      //   await publisher.orderPaid(server.channel, req.body);

      //   res.acknowledge = true;
      //   res.status(201).end();

      // } catch (err) {
      //   console.error('Payment creation error:', err);
      //   res.acknowledgee = false;
      //   res.status(400).end();
      // }
    },

    // paymentFailed: async (req, res) => {
    //   try {
    //     const payment = await Payment.findById(req.params.id);
        
    //     if (!payment) {
    //       return res.status(404).json({ error: 'Payment not found' });
    //     }

    //     // Publish payment failed event
    //     // await publisher.paymentFailed({
    //     //   paymentId: payment._id.toString(), // MongoDB ObjectId
    //     //   orderId: payment.orderId,
    //     //   amount: payment.amount,
    //     //   userId: payment.userId,
    //     //   status: 'failed',
    //     //   reason: req.body.reason || 'Payment processing failed',
    //     //   timestamp: new Date().toISOString()
    //     // });

    //     await publisher.paymentFailed(req.body);

    //     res.status(200).json({
    //       success: true,
    //       message: 'Payment failure recorded',
    //       data: payment
    //     });

    //   } catch (err) {
    //     console.error('Payment failed error:', err);
    //     res.status(400).json({ error: err.message });
    //   }
    // }
};

module.exports = {
  server,
  publisher,
  MessagingController,
};