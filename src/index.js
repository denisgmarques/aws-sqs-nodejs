// Require objects.
const { v4: uuidv4 } = require('uuid')
const Winston = require('winston')
const express = require('express')
const app = express()
const awsSQS = require('./awsSQS')

// Logger configuration
const consoleTransport = new Winston.transports.Console()
const myWinstonOptions = {
  transports: [consoleTransport]
}
const logger = Winston.createLogger(myWinstonOptions)

// Logging all requests
function logRequest (req, res, next) {
  logger.info(`URI: [${req.url}] at [${Date.now()}]`)
  next()
}

app.use(logRequest)

// Creating a queue.
app.get('/create', async function (req, res) {

  try {
    if (!req.query.queueName) throw "Você deve informar o query param queueName"
    const queueResult = await awsSQS.create({
      queueName: req.query.queueName,
      isFifo: (req.query.fifo && JSON.parse(req.query.fifo)),
      tag: 'c6-dev',
      retentionDays: 4
    })

    logger.info(`createFifoQueue: ${JSON.stringify(queueResult)}`)

    res.send(queueResult)
  } catch (e) {
    res.status(500).send(e)
  }
})

// Listing queues
app.get('/list', async function (req, res) {
  try {
    const result = await awsSQS.list(req.query.prefix || "");
    res.send(result)
  } catch (e) {
    res.status(500).send(e)
  }
})

// Listing queues
app.get('/url', async function (req, res) {
  try {
    const result = await awsSQS.url(req.query.prefix || "", (req.query.dlq && JSON.parse(req.query.dlq)));
    res.send(result)
  } catch (e) {
    res.status(500).send(e)
  }
})

// Sending a message
app.get('/send', async function (req, res) {

  try {
    console.log(req.query.queueName)
    if (!req.query.queueName) {
      throw "Você deve informar o query param queueName";
    }

    const queueUrl = await awsSQS.url(req.query.queueName || "", false);

    if (!queueUrl) throw `Não foi possível encontrar a URL da fila ${req.query.queueName}`;

    const params = {
      MessageBody: 'Hello world!',
      QueueUrl: queueUrl,
      DelaySeconds: 0,
      MessageGroupId: 'group',
      MessageDeduplicationId: uuidv4()
    }
  
    logger.info(params)
  
    let result = await awsSQS.send(params);
    res.send(result)
  } catch (e) {
    console.log('catch')
    console.log(e)
    res.status(500).send(e)
  }
})

// Start server.
const server = app.listen(8080, function () {
  const host = server.address().address
  const port = server.address().port

  console.log('AWS SQS example app listening at http://%s:%s', host, port)
})
