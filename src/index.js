const { v4: uuidv4 } = require('uuid')
const Winston = require('winston')
const express = require('express')
const app = express()
const awsUtils = require('./awsUtils')

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
    const queueResult = await awsUtils.create({
      queueName: req.query.queueName,
      isFifo: (req.query.fifo && JSON.parse(req.query.fifo)),
      tag: 'minha-tag',
      retentionDays: 4
    })

    logger.info(`createFifoQueue: ${JSON.stringify(queueResult)}`)

    res.send(queueResult)
  } catch (e) {
    console.log(e)
    res.status(500).send({'error': e.message})
  }
}),

/**
 *  Endpoint para criar um tópico no SNS
 *
 *  Query Params:
 *
 *    topicName: String
 *    fifo: Boolean
 *
 *  Exemplo:
 *
 *    /createTopic?topicName=MeuTopico&fifo=true
 *
 */
app.get('/createTopic', async function (req, res) {
  try {
    if (!req.query.topicName) throw new Error('Você deve informar o query param topicName')
    const topicResult = await awsUtils.createTopic({
      topicName: req.query.topicName,
      isFifo: (req.query.fifo && JSON.parse(req.query.fifo)),
      tag: 'minha-tag'
    })

    logger.info(`createTopic: ${JSON.stringify(topicResult)}`)

    res.send(topicResult)
  } catch (e) {
    console.log(e)
    res.status(500).send({'error': e.message})
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
    const result = await awsUtils.list(req.query.prefix || '')
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send({'error': e.message})
  }
})

/**
 *  Endpoint para listar os tópicos
 *
 *    /listTopics
 *
 */
 app.get('/listTopics', async function (req, res) {
  try {
    const result = await awsUtils.listTopics()
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send({'error': e.message})
  }
})

/**
 *  Endpoint para listar o Arn de uma fila
 *
 *  Query Params:
 *
 *    queueName: String
 *
 *  Exemplo:
 *
 *    /queueArn?queueName=MinhaFila.fifo
 *
 */
 app.get('/queueArn', async function (req, res) {
  try {
    const result = await awsUtils.queueArn(req.query.queueName || '')
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send({'error': e.message})
  }
})

/**
 *  Endpoint para listar o Arn de um tópico
 *
 *  Query Params:
 *
 *    topicName: String
 *
 *  Exemplo:
 *
 *    /topicArn?topicName=exchange2
 *
 */
 app.get('/topicArn', async function (req, res) {
  try {
    const result = await awsUtils.topicArn(req.query.topicName || '')
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send({'error': e.message})
  }
})

/**
 *  Subscribe uma fila SQS num tópico do SNS
 *
 *  Query Params:
 *
 *    topicName: String
 *    queueName: String
 *
 *  Exemplo:
 *
 *    /subscribe?topicName=exchange2&queueName=tests
 *
 */
 app.get('/subscribe', async function (req, res) {
  try {
    const result = await awsUtils.subscribe(req.query.topicName, req.query.queueName)
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send({'error': e.message})
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

    const result = await awsUtils.url(req.query.queueName)
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send({'error': e.message})
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

    const queueUrl = await awsUtils.url(req.query.queueName || '', false)

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

    const result = await awsUtils.send(params)
    res.send(result)
  } catch (e) {
    console.log(e)
    res.status(500).send({'error': e.message})
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
  await awsUtils.delete(params)
}

/**
 * Cria uma fila para o consumer
 */
 awsUtils.create({
  queueName: 'MinhaFila',
  isFifo: true,
  tag: 'minha-tag',
  retentionDays: 4
}).then(data => {
  const queueName = 'MinhaFila.fifo'
  awsUtils.url(queueName).then(urlData => {
    consumerQueueUrl = urlData
    /**
     * Inicia o consumer após ter criado a fila
     */
    awsUtils.createConsumer('MinhaFila.fifo', handleMessage).then(consumer => {
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
