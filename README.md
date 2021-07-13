# aws-sqs-tests
Amazon SQS Test

### Configuring the environment credentials
```
export AWS_ACCESS_KEY_ID="YOUR KEY ID"
export AWS_SECRET_ACCESS_KEY="YOUR SECRET KEY"
export AWS_REGION="us-east-2"

```

### Running the project
```
npm run dev
```

Open your browser and access this URL's:

- localhost:8080/create?queueName=tests
- localhost:8080/create?queueName=tests&fifo=true
- localhost:8080/list
- localhost:8080/list?prefix=tests
- localhost:8080/url?prefix=tests
- localhost:8080/url?prefix=tests&dlq=true
- localhost:8080/send?queueName=tests

