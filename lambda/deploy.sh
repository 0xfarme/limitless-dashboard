#!/bin/bash
set -e

# Configuration
FUNCTION_NAME="limitless-trade-generator"
ROLE_NAME="limitless-lambda-role"
BUCKET_NAME="limitless-bot-logs"
REGION="us-east-1"
WALLET_PRIVATE_KEY="${WALLET_PRIVATE_KEY}"

echo "🚀 Deploying Limitless Trade Generator Lambda..."

# Check if wallet private key is provided
if [ -z "$WALLET_PRIVATE_KEY" ]; then
  echo "⚠️  Warning: WALLET_PRIVATE_KEY environment variable not set"
  echo "You'll need to set it manually in Lambda console after deployment"
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd "$(dirname "$0")"
npm install --production

# Create deployment package
echo "📦 Creating deployment package..."
zip -r function.zip index-wallet-auth.js package.json node_modules/

# Check if IAM role exists
echo "🔐 Setting up IAM role..."
if aws iam get-role --role-name $ROLE_NAME 2>/dev/null; then
  echo "✅ Role $ROLE_NAME already exists"
else
  echo "Creating IAM role..."
  aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document file://trust-policy.json

  echo "Attaching policy..."
  aws iam put-role-policy \
    --role-name $ROLE_NAME \
    --policy-name limitless-s3-access \
    --policy-document file://iam-policy.json

  echo "⏳ Waiting for role to propagate..."
  sleep 10
fi

# Get role ARN
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
echo "Role ARN: $ROLE_ARN"

# Check if Lambda function exists
echo "⚡ Deploying Lambda function..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
  echo "Updating existing function..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region $REGION

  echo "Updating function configuration..."
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --handler index-wallet-auth.handler \
    --timeout 60 \
    --memory-size 256 \
    --environment Variables="{S3_BUCKET_NAME=$BUCKET_NAME,WALLET_PRIVATE_KEY=$WALLET_PRIVATE_KEY}" \
    --region $REGION
else
  echo "Creating new function..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler index-wallet-auth.handler \
    --zip-file fileb://function.zip \
    --timeout 60 \
    --memory-size 256 \
    --environment Variables="{S3_BUCKET_NAME=$BUCKET_NAME,WALLET_PRIVATE_KEY=$WALLET_PRIVATE_KEY}" \
    --region $REGION
fi

# Create EventBridge rule to trigger Lambda every 5 minutes
echo "⏰ Setting up EventBridge schedule..."
RULE_NAME="limitless-trade-generator-schedule"

# Check if rule exists
if aws events describe-rule --name $RULE_NAME --region $REGION 2>/dev/null; then
  echo "✅ EventBridge rule already exists"
else
  echo "Creating EventBridge rule..."
  aws events put-rule \
    --name $RULE_NAME \
    --schedule-expression "rate(5 minutes)" \
    --state ENABLED \
    --region $REGION

  # Add permission for EventBridge to invoke Lambda
  aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id eventbridge-invoke \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:$(aws sts get-caller-identity --query Account --output text):rule/$RULE_NAME" \
    --region $REGION 2>/dev/null || echo "Permission already exists"

  # Add Lambda as target
  FUNCTION_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)
  aws events put-targets \
    --rule $RULE_NAME \
    --targets "Id=1,Arn=$FUNCTION_ARN" \
    --region $REGION
fi

# Clean up
echo "🧹 Cleaning up..."
rm function.zip

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Summary:"
echo "  Function: $FUNCTION_NAME"
echo "  Region: $REGION"
echo "  Schedule: Every 5 minutes"
echo "  S3 Bucket: $BUCKET_NAME"
echo ""
echo "🧪 Test the function:"
echo "  aws lambda invoke --function-name $FUNCTION_NAME --region $REGION output.json"
echo ""
echo "📊 View logs:"
echo "  aws logs tail /aws/lambda/$FUNCTION_NAME --follow --region $REGION"
echo ""

if [ -z "$WALLET_PRIVATE_KEY" ]; then
  echo "⚠️  Don't forget to set WALLET_PRIVATE_KEY in Lambda environment variables!"
  echo "  Go to AWS Console > Lambda > $FUNCTION_NAME > Configuration > Environment variables"
fi
