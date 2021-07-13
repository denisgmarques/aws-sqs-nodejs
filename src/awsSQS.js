const aws = require("aws-sdk");
const path = require('path')

module.exports = {
  _client: undefined,
  
  getClient: function () {
    if (!process.env.AWS_ACCESS_KEY_ID) throw new Error("Variável de ambiente AWS_KEY_ID não informada");
    if (!process.env.AWS_SECRET_ACCESS_KEY) throw new Error("Variável de ambiente AWS_SECRET_KEY não informada");
    if (!process.env.AWS_REGION) throw new Error("Variável de ambiente AWS_REGION não informada");

    if (this._client) return this._client;

    const awsConfig = { 
      "accessKeyId": process.env.AWS_KEY_ID,
      "secretAccessKey": process.env.AWS_SECRET_KEY,
      "region": process.env.AWS_REGION
    }

    // Lê as credenciais da AWS e cria o client do SQS
    aws.config.update(awsConfig);
    this._client = new aws.SQS();
    return this._client;
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
  create: async function ( params = { isFifo: false, tag: "", retentionDays: 1 } ) {
    if (!params.queueName) throw new Error("Informe o parâmetro queueName");

    const queueName = params.queueName;
    const isFifo = params.isFifo;
    const tag = params.tag;
    const RETENTION_SECONDS = (params.retentionDays * 60 * 60 * 24).toString();

    try {

      // Cria a fila dql
      let params = {
        QueueName: queueName + "-dlq" + ((isFifo) ? ".fifo" : ""),
        Attributes: {
          DelaySeconds: "60",
          MessageRetentionPeriod: RETENTION_SECONDS
        },
        tags: {
          [tag]: tag
        }
      };

      let fifoAttr = {};

      if (isFifo) {
        fifoAttr =  { Attributes: { FifoQueue: isFifo.toString() } }
        params = { ...params, ...fifoAttr }
      }
  
      const dlqResult = await this.getClient().createQueue(params).promise();
      console.log(`createFifoDlqQueue: ${JSON.stringify(dlqResult)}`);

      // Busca o ARN da fila dlq
      params = {
        QueueUrl: dlqResult.QueueUrl,
        AttributeNames: ["QueueArn"]
      };

      const arnResult = await this.getClient().getQueueAttributes(params).promise();
      console.log(`getDlqQueueAttributes: ${JSON.stringify(arnResult)}`);

      // Cria a fila associando a dlq
      params = {
        QueueName: queueName + ((isFifo) ? ".fifo" : ""),
        Attributes: {
          DelaySeconds: "60",
          MessageRetentionPeriod: RETENTION_SECONDS,
          RedrivePolicy: JSON.stringify({ deadLetterTargetArn: arnResult.Attributes.QueueArn, maxReceiveCount: 10 })
        },
        tags: {
          [tag]: tag
        }
      };

      if (isFifo) {
        params = { ...params, ...fifoAttr }
      }

      const queueResult = await this.getClient().createQueue(params).promise();

      console.log(`createFifoQueue: ${JSON.stringify(queueResult)}`);

      return queueResult;

    } catch (e) {
      console.log(e);
      throw new Error("Não foi possível criar a fila no SQS" + JSON.stringify(e));
    }
  },

  /**
   * Lista as filas existentes no SQS
   */
  list: async function (prefix) {
    try {
      return await this.getClient().listQueues( { QueueNamePrefix: prefix } ).promise();
    } catch (e) {
      console.log(e);
      throw new Error("Não foi possível listar as filas do SQS" + JSON.stringify(e));
    }
  },

  /**
   * Retorna a URL da fila - necessário no send
   */
  url: async function (prefix, dlq=false) {
    try {
      const result = await this.getClient().listQueues( { QueueNamePrefix: prefix } ).promise();
      
      if (!result.QueueUrls) return "";

      if (dlq) {
        return result.QueueUrls.filter(u => u.includes("dlq"))[0];
      } else {
        return result.QueueUrls.filter(u => !u.includes("dlq"))[0];
      }
    } catch (e) {
      console.log(e);
      throw new Error("Não foi possível resgatar a url da fila do SQS" + JSON.stringify(e));
    }
  },

  /**
   * Envia uma mensagem a fila
   */
  send: async function ( params = { DelaySeconds: 0 } ) {
    if (!params.MessageBody) throw new Error("O parâmetro MessageBody é obrigatório");
    if (!params.QueueUrl) throw new Error("O parâmetro QueueUrl é obrigatório");

    console.log(params);
      
    try {
      return await this.getClient().sendMessage(params).promise();
    } catch (e) {
      console.log(e);
      throw new Error("Não foi possível enviar para a fila do SQS" + JSON.stringify(e));
    }
  }
};
