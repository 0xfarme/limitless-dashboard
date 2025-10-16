# Limitless Trade Generator Lambda

This Lambda function fetches trade data from the Limitless Exchange API and uploads formatted files to S3 for the dashboard to consume.

## What It Does

1. **Fetches data from Limitless API:**
   - `/portfolio/positions` - Current positions/holdings
   - `/portfolio/history` - Trade history

2. **Processes and formats data:**
   - Calculates statistics (win rate, P&L, etc.)
   - Formats trades as JSONL
   - Structures state with holdings

3. **Uploads to S3:**
   - `trades.jsonl` - All trades (one JSON per line)
   - `stats.json` - Calculated statistics
   - `state.json` - Current holdings/positions

4. **Runs automatically:**
   - Triggered by EventBridge every 5 minutes
   - Keeps dashboard data fresh

## Prerequisites

- AWS CLI configured with credentials
- Node.js 18+ installed
- S3 bucket created (`limitless-bot-logs`)
- Limitless Exchange API auth token

## Quick Deploy

```bash
# Set your auth token
export LIMITLESS_AUTH_TOKEN="Bearer eyJhbGc..."

# Run deployment script
cd lambda
./deploy.sh
```

This will:
- Install dependencies
- Create IAM role and permissions
- Deploy Lambda function
- Set up EventBridge schedule (every 5 minutes)

## Manual Deployment

### 1. Install Dependencies

```bash
cd lambda
npm install
```

### 2. Create IAM Role

```bash
aws iam create-role \
  --role-name limitless-lambda-role \
  --assume-role-policy-document file://trust-policy.json

aws iam put-role-policy \
  --role-name limitless-lambda-role \
  --policy-name limitless-s3-access \
  --policy-document file://iam-policy.json
```

### 3. Package Lambda

```bash
zip -r function.zip index.js package.json node_modules/
```

### 4. Create Lambda Function

```bash
ROLE_ARN=$(aws iam get-role --role-name limitless-lambda-role --query 'Role.Arn' --output text)

aws lambda create-function \
  --function-name limitless-trade-generator \
  --runtime nodejs18.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 60 \
  --memory-size 256 \
  --environment Variables="{S3_BUCKET_NAME=limitless-bot-logs,LIMITLESS_AUTH_TOKEN=Bearer eyJhbGc...}" \
  --region us-east-1
```

### 5. Set Up EventBridge Schedule

```bash
# Create rule to run every 5 minutes
aws events put-rule \
  --name limitless-trade-generator-schedule \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED \
  --region us-east-1

# Add permission for EventBridge to invoke Lambda
aws lambda add-permission \
  --function-name limitless-trade-generator \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:us-east-1:YOUR_ACCOUNT_ID:rule/limitless-trade-generator-schedule"

# Add Lambda as target
FUNCTION_ARN=$(aws lambda get-function --function-name limitless-trade-generator --query 'Configuration.FunctionArn' --output text)

aws events put-targets \
  --rule limitless-trade-generator-schedule \
  --targets "Id=1,Arn=$FUNCTION_ARN" \
  --region us-east-1
```

## Testing

### Test Lambda Locally

```bash
# Install dependencies
npm install

# Set environment variables
export S3_BUCKET_NAME=limitless-bot-logs
export LIMITLESS_AUTH_TOKEN="Bearer eyJhbGc..."

# Run test (if you create a test.js file)
node test.js
```

### Test Deployed Lambda

```bash
aws lambda invoke \
  --function-name limitless-trade-generator \
  --region us-east-1 \
  output.json

cat output.json
```

### View Lambda Logs

```bash
aws logs tail /aws/lambda/limitless-trade-generator --follow --region us-east-1
```

## Configuration

### Environment Variables

Set these in the Lambda console or via CLI:

- `LIMITLESS_AUTH_TOKEN` - Your Limitless Exchange API bearer token (required)
- `S3_BUCKET_NAME` - S3 bucket name (default: `limitless-bot-logs`)

### Schedule Frequency

To change the schedule frequency, update the EventBridge rule:

```bash
# Every 1 minute
aws events put-rule --name limitless-trade-generator-schedule --schedule-expression "rate(1 minute)"

# Every 10 minutes
aws events put-rule --name limitless-trade-generator-schedule --schedule-expression "rate(10 minutes)"

# Every hour
aws events put-rule --name limitless-trade-generator-schedule --schedule-expression "rate(1 hour)"
```

## Updating

### Update Lambda Code

```bash
# Make changes to index.js
# Then redeploy:

cd lambda
npm install
zip -r function.zip index.js package.json node_modules/

aws lambda update-function-code \
  --function-name limitless-trade-generator \
  --zip-file fileb://function.zip \
  --region us-east-1
```

### Update Environment Variables

```bash
aws lambda update-function-configuration \
  --function-name limitless-trade-generator \
  --environment Variables="{S3_BUCKET_NAME=limitless-bot-logs,LIMITLESS_AUTH_TOKEN=Bearer NEW_TOKEN}" \
  --region us-east-1
```

## Monitoring

### CloudWatch Metrics

View in AWS Console:
- Lambda > limitless-trade-generator > Monitor
- See invocations, errors, duration, etc.

### CloudWatch Logs

```bash
# View recent logs
aws logs tail /aws/lambda/limitless-trade-generator --region us-east-1

# Follow logs in real-time
aws logs tail /aws/lambda/limitless-trade-generator --follow --region us-east-1

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/limitless-trade-generator \
  --filter-pattern "ERROR"
```

## Troubleshooting

### Lambda times out
- Increase timeout: `--timeout 120` (max 900 seconds)
- Check API response times

### Permission denied on S3
- Verify IAM role has `s3:PutObject` permission
- Check bucket name matches

### API returns 401
- Verify `LIMITLESS_AUTH_TOKEN` is correct
- Check token hasn't expired
- Ensure "Bearer " prefix is included

### No data in S3
- Check Lambda logs for errors
- Verify EventBridge rule is enabled
- Manually invoke Lambda to test

## Cost Estimate

- Lambda: ~$0.20/month (720 invocations/day at 5min intervals)
- S3 Storage: ~$0.10/month
- S3 Requests: ~$0.05/month
- CloudWatch Logs: ~$0.50/month

**Total: < $1/month**

## Security Notes

- Store `LIMITLESS_AUTH_TOKEN` in Lambda environment variables (encrypted at rest)
- Consider using AWS Secrets Manager for token rotation
- Lambda has minimal IAM permissions (only S3 write)
- S3 bucket should have public read for dashboard access

## Next Steps

- [ ] Add error alerting (SNS/email when Lambda fails)
- [ ] Implement pagination for >100 trades
- [ ] Add metrics/monitoring dashboard
- [ ] Set up token rotation with Secrets Manager
- [ ] Add unit tests
