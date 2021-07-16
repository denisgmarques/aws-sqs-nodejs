# Testes com o AWS SQS
Amazon Simple Queue Service testes

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

- http://localhost:8080/create?queueName=tests
- http://localhost:8080/create?queueName=tests&fifo=true
- http://localhost:8080/list
- http://localhost:8080/list?prefix=tests
- http://localhost:8080/url?queueName=tests.fifo
- http://localhost:8080/url?queueName=tests-dlq.fifo
- http://localhost:8080/send?queueName=MinhaFila.fifo
- http://localhost:8080/send?queueName=MinhaFila-dlq.fifo
