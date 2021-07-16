const { v4: uuidv4 } = require('uuid')
const Winston = require('winston')
const express = require('express')
const app = express()
const awsSQS = require('./awsSQS')

// Configuração do Logger
const consoleTransport = new Winston.transports.Console()
const myWinstonOptions = {
  transports: [consoleTransport]
}
const logger = Winston.createLogger(myWinstonOptions)

// Logando todas as requests recebidas
function logRequest (req, res, next) {
  logger.info(`URI: [${req.url}] at [${Date.now()}]`)
  next()
}

app.use(logRequest)

/**
 *  Endpoint para criar filas
 *
 *  Query Params:
 *
 *    queueName: String
 *    fifo: Boolean
 *
 *  Exemplo:
 *
 *    /create?queueName=MinhaFila&fifo=true
 *
 */
app.get('/create', async function (req, res) {
  try {
    if (!req.query.queueName) throw new Error('Você deve informar o query param queueName')
    const queueResult = await awsSQS.create({
      queueName: req.query.queueName,
      isFifo: (req.query.fifo && JSON.parse(req.query.fifo)),
      tag: 'minha-tag',
      retentionDays: 4
    })

    logger.info(`createFifoQueue: ${JSON.stringify(queueResult)}`)

    res.send(queueResult)
  } catch (e) {
    console.log(e)
    res.status(500).send(e)
  }
})

/**
 *  Endpoint para listar as filas
 *
 *  Query Params:
 *
 *    prefix: String
 *
 *  Exemplo:
 *
 *    /list?prefix=Minha
 *
 */
app.get('/list', async function (req, res) {
  try {
    const result = await awsSQS.list(req.query.prefix || '')
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send(e)
  }
})

/**
 *  Endpoint para pegar a url de uma fila pelo nome
 *
 *  Query Params:
 *
 *    queueName: String
 *
 *  Exemplo:
 *
 *    /url?queueName=MinhaFila
 *
 */
app.get('/url', async function (req, res) {
  try {
    if (!req.query.queueName) {
      throw new Error('Você deve informar o query param queueName')
    }

    const result = await awsSQS.url(req.query.queueName)
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send(e)
  }
})

/**
 *  Endpoint para enviar uma mensagem de 'Hello world!' para uma fila
 *
 *  Query Params:
 *
 *    queueName: String
 *
 *  Exemplo:
 *
 *    /send?queueName=MinhaFila
 *
 */
app.get('/send', async function (req, res) {
  try {
    if (!req.query.queueName) {
      throw new Error('Você deve informar o query param queueName')
    }

    const queueUrl = await awsSQS.url(req.query.queueName || '', false)

    if (!queueUrl) throw new Error(`Não foi possível encontrar a URL da fila ${req.query.queueName}`)

    let params = {
      MessageBody: 'Hello world!',
      QueueUrl: queueUrl,
      DelaySeconds: 0
    }

    // Parâmetros necessários para a desduplicação da mensagem quando for uma fila fifo
    if (req.query.queueName.endsWith('.fifo')) {
      const fifoParams = {
        MessageGroupId: 'group',
        MessageDeduplicationId: uuidv4()
      }

      params = { ...params, ...fifoParams }
    }

    logger.info(params)

    const result = await awsSQS.send(params)
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send(e)
  }
})

/**
 * Função que tratará a mensagem
 */
let consumerQueueUrl;
const handleMessage = async (message) => {
  console.log(message)

  // Parâmetros do delete
  const params = {
    QueueUrl: consumerQueueUrl,
    ReceiptHandle: message.ReceiptHandle
  }

  /**
   *
   * Você pode deletar a mensagem após processá-la com sucesso
   * Percebi que decorrido o tempo limite de visibilidade (default 30 segundos), se eu não lançar nenhum erro ela é automaticamente excluída pelo SQS
   *
   * Se um erro for lançado dentro dessa função, a mensagem ficará 1 minuto "em trânsito" para então retornar a fila.
   *
   * Quando há uma DLQ (Fila de mensagens mortas) associada a fila, se a mesma mensagem retornar mais que o número de vezes configurado em "Número máximo de recebimentos"
   * a mensagem será automaticamente enviada para a fila DLQ associada.
   *
   */
  await awsSQS.delete(params)
}

/**
 * Cria uma fila para o consumer
 */
 awsSQS.create({
  queueName: 'MinhaFila',
  isFifo: true,
  tag: 'minha-tag',
  retentionDays: 4
}).then(data => {
  const queueName = 'MinhaFila.fifo'
  awsSQS.url(queueName).then(urlData => {
    consumerQueueUrl = urlData
    /**
     * Inicia o consumer após ter criado a fila
     */
    awsSQS.createConsumer('MinhaFila.fifo', handleMessage).then(consumer => {
      console.log('Starting consumer...')
      consumer.start()
    })
    .catch((e) => {
      console.log(e)
    })
  })
})

/**
 * Inicia o servidor
 */
const server = app.listen(8080, function () {
  const host = server.address().address
  const port = server.address().port

  console.log('AWS SQS testes. Aplicação ouvindo em http://%s:%s', host, port)
})
