# Testes com o AWS SQS e SNS
Amazon SQS / SNS testes

### Configure o ambiente com suas credenciais
```
export AWS_ACCESS_KEY_ID="YOUR KEY ID"
export AWS_SECRET_ACCESS_KEY="YOUR SECRET KEY"
export AWS_REGION="us-east-2"

```

### Executando o projeto
```
npm run dev
```

Abra o browser e teste com esses exemplos:

#### SQS

- http://localhost:8080/create?queueName=tests
- http://localhost:8080/create?queueName=tests&fifo=true
- http://localhost:8080/list
- http://localhost:8080/list?prefix=tests
- http://localhost:8080/url?queueName=tests.fifo
- http://localhost:8080/url?queueName=tests-dlq.fifo
- http://localhost:8080/send?queueName=MinhaFila.fifo
- http://localhost:8080/send?queueName=MinhaFila-dlq.fifo

#### SNS

- http://localhost:8080/createTopic?topicName=MeuTopico

### API VERSION
```
SQS: 2012-11-05

SNS: 2010-03-31
```
### Documentação

https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html

https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SNS.html
