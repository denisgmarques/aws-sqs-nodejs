const aws = require('aws-sdk')
const { Consumer } = require('sqs-consumer')

module.exports = {
  _isConfigured: false,
  _sqsClient: undefined,
  _snsClient: undefined,

  configure: function () {
    if (this._isConfigured) return

    if (!process.env.AWS_ACCESS_KEY_ID) throw new Error('Variável de ambiente AWS_KEY_ID não informada')
    if (!process.env.AWS_SECRET_ACCESS_KEY) throw new Error('Variável de ambiente AWS_SECRET_KEY não informada')
    if (!process.env.AWS_REGION) throw new Error('Variável de ambiente AWS_REGION não informada')

    const awsConfig = {
      accessKeyId: process.env.AWS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_KEY,
      region: process.env.AWS_REGION
    }

    // Lê as credenciais da AWS e cria o client do SQS
    aws.config.update(awsConfig)
    this._isConfigured = true
  },

  getSNSClient: function () {
    if (this._snsClient) return this._snsClient
    this.configure()
    this._snsClient = new aws.SNS()
    return this._snsClient
  },

  getSQSClient: function () {
    if (this._sqsClient) return this._sqsClient
    this.configure()
    this._sqsClient = new aws.SQS()
    return this._sqsClient
  },

   /**
   * Cria um novo tópico no SNS
   *
   * @param { topicName :String
    *          tag :String
    *        } param0
    * @returns { SNS createTopic response }
    */
  createTopic: async function (params = { tag: '' }) {
    if (!params.topicName) throw new Error('Informe o parâmetro topicName')

    try {
      var params = {
        Name: params.topicName,
        // Attributes: {
        //   '<attributeName>': 'STRING_VALUE',
        //   /* '<attributeName>': ... */
        // },
        Tags: [
          {
            Key: params.tag,
            Value: params.tag
          }
        ]
      }

      return await this.getSNSClient().createTopic(params).promise()
    } catch (e) {
      console.log(e)
      throw new Error('Não foi possível criar o tópico no SNS' + JSON.stringify(e))
    }
  },

  subscribe: async function (params) {
    var params = {
      Protocol: 'sqs',
      TopicArn: 'STRING_VALUE', /* Pegar o arn do topic */
      // Attributes: {
      //   '<attributeName>': 'STRING_VALUE',
      // },
      Endpoint: 'STRING_VALUE', /* Pegar o arn da queue */
      ReturnSubscriptionArn: true || false
    };
    sns.subscribe(params, function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else     console.log(data);           // successful response
    });
  },

  queueArn: async function (queueName) {
    try {
      // Busca a URL da fila
      const queueUrl = await this.url(queueName)

      // Busca o ARN da fila
      params = {
        QueueUrl: queueUrl,
        AttributeNames: ['QueueArn']
      }

      const arnResult = await this.getSQSClient().getQueueAttributes(params).promise()
      console.log(`queueArn: ${JSON.stringify(arnResult)}`)
      return arnResult
    } catch (e) {
      console.log(e)
      throw new Error('Não foi possível buscar o Arn da fila no SQS' + JSON.stringify(e))
    }
  },

  topicArn: async function (params) {
    try {
      
    } catch (e) {
      console.log(e)
      throw new Error('Não foi possível buscar o Arn do tópico no SNS' + JSON.stringify(e))
    }
  },

  /**
   * Cria uma nova fila com uma DLQ associada
   *
   * @param { queueName :String
   *          isFifo :String
   *          tag :String
   *        } param0
   * @returns { SQS queue data response }
   */
  create: async function (params = { isFifo: false, tag: '', retentionDays: 4 }) {
    if (!params.queueName) throw new Error('Informe o parâmetro queueName')

    const queueName = params.queueName
    const isFifo = params.isFifo
    const tag = params.tag
    const RETENTION_SECONDS = (params.retentionDays * 60 * 60 * 24).toString()

    try {
      // Cria a fila dql
      let params = {
        QueueName: queueName + '-dlq' + ((isFifo) ? '.fifo' : ''),
        Attributes: {
          DelaySeconds: '60',
          MessageRetentionPeriod: RETENTION_SECONDS
        },
        tags: {
          [tag]: tag
        }
      }

      let fifoAttr = {}

      if (isFifo) {
        fifoAttr = { Attributes: { FifoQueue: isFifo.toString() } }
        params = { ...params, ...fifoAttr }
      }

      const dlqResult = await this.getSQSClient().createQueue(params).promise()
      console.log(`createFifoDlqQueue: ${JSON.stringify(dlqResult)}`)

      // Busca o ARN da fila dlq
      params = {
        QueueUrl: dlqResult.QueueUrl,
        AttributeNames: ['QueueArn']
      }

      const arnResult = await this.getSQSClient().getQueueAttributes(params).promise()
      console.log(`getDlqQueueAttributes: ${JSON.stringify(arnResult)}`)

      // Cria a fila associando a dlq
      params = {
        QueueName: queueName + ((isFifo) ? '.fifo' : ''),
        Attributes: {
          DelaySeconds: '60',
          MessageRetentionPeriod: RETENTION_SECONDS,
          RedrivePolicy: JSON.stringify({ deadLetterTargetArn: arnResult.Attributes.QueueArn, maxReceiveCount: 10 })
        },
        tags: {
          [tag]: tag
        }
      }

      if (isFifo) {
        params = { ...params, ...fifoAttr }
      }

      const queueResult = await this.getSQSClient().createQueue(params).promise()

      console.log(`createFifoQueue: ${JSON.stringify(queueResult)}`)

      return queueResult
    } catch (e) {
      console.log(e)
      throw new Error('Não foi possível criar a fila no SQS' + JSON.stringify(e))
    }
  },

  /**
   * Lista as filas existentes no SQS
   */
  list: async function (prefix) {
    try {
      return await this.getSQSClient().listQueues({ QueueNamePrefix: prefix }).promise()
    } catch (e) {
      console.log(e)
      throw new Error('Não foi possível listar as filas do SQS' + JSON.stringify(e))
    }
  },

  /**
   * Retorna a URL da fila - necessário no send
   */
  url: async function (fullQueueName) {
    try {
      const result = await this.getSQSClient().listQueues({ QueueNamePrefix: fullQueueName }).promise()
      if (!result.QueueUrls) return ''

      return result.QueueUrls.filter(u => /([^/]*)$/.exec(u)[0] === fullQueueName)[0]
    } catch (e) {
      console.log(e)
      throw new Error('Não foi possível resgatar a url da fila do SQS' + JSON.stringify(e))
    }
  },

  /**
   * Envia uma mensagem a fila
   */
  send: async function (params = { DelaySeconds: 0 }) {
    if (!params.MessageBody) throw new Error('O parâmetro MessageBody é obrigatório')
    if (!params.QueueUrl) throw new Error('O parâmetro QueueUrl é obrigatório')

    try {
      return await this.getSQSClient().sendMessage(params).promise()
    } catch (e) {
      console.log(e)
      throw new Error('Não foi possível enviar para a fila do SQS' + JSON.stringify(e))
    }
  },

  /**
   * Apaga a mensagem ("ACK")
   */
  delete: async function (params) {
    if (!params.QueueUrl) throw new Error('O parâmetro QueueUrl é obrigatório')
    if (!params.ReceiptHandle) throw new Error('O parâmetro ReceiptHandle é obrigatório')

    try {
      return await this.getSQSClient().deleteMessage(params).promise()
    } catch (e) {
      console.log(e)
      throw new Error('Não foi possível enviar para a fila do SQS' + JSON.stringify(e))
    }
  },

  /**
   * Cria um consumer para a fila
   */
  createConsumer: async function (fullQueueName, handleMessage) {
    console.log('Criando um consumer...')
    if (!handleMessage || {}.toString.call(handleMessage) !== '[object AsyncFunction]') throw new Error('Você deve passar a função async handleMessage como parâmetro')
    if (!fullQueueName) throw new Error('Você deve passar o nome da fila como parâmetro')

    try {
      const queueUrl = await this.url(fullQueueName)
      console.log(queueUrl)
      const consumer = Consumer.create({
        queueUrl: queueUrl,
        handleMessage: handleMessage,
        sqs: this.getSQSClient()
      })

      consumer.on('error', (err) => {
        console.error(err.message)
      })

      consumer.on('processing_error', (err) => {
        console.error(err.message)
      })

      consumer.on('timeout_error', (err) => {
        console.error(err.message)
      })

      return consumer
    } catch (e) {
      console.log(e)
      throw new Error('Não foi possível criar o consumer da fila do SQS' + JSON.stringify(e))
    }
  }
}
