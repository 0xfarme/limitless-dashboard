# 🚀 Quick Start Guide

Get your Limitless Dashboard up and running in 10 minutes!

## ⚡ Updated Features

The dashboard now includes:
- 8 comprehensive metric cards
- Daily trade breakdowns with charts
- Win/loss ratio analysis
- Points & volume tracking
- Epoch-based analytics
- Tabbed navigation (Overview, Analytics, Points)

## What You're Building

A real-time dashboard that displays your trading activity from Limitless Exchange:

```
Limitless API → Lambda → S3 → Dashboard
```

## Prerequisites

- AWS account with CLI configured
- Limitless Exchange account with API access
- Node.js 18+ installed

## Step 1: Deploy Lambda (5 minutes)

The Lambda function fetches your trading data from Limitless API and uploads it to S3 every 5 minutes.

```bash
# Set your Limitless API token
export LIMITLESS_AUTH_TOKEN="Bearer eyJhbGc..."

# Deploy the Lambda
cd lambda
./deploy.sh
```

This creates:
- ✅ Lambda function that runs every 5 minutes
- ✅ S3 bucket with your trade data
- ✅ IAM roles and permissions

**Test it:**
```bash
aws lambda invoke --function-name limitless-trade-generator --region us-east-1 output.json
cat output.json
```

## Step 2: Deploy Dashboard (2 minutes)

**Simple one-command deployment:**

```bash
./deploy-frontend.sh
```

This script will:
- Create S3 bucket if needed
- Install dependencies
- Build production bundle
- Upload to S3
- Configure website hosting
- Make bucket public

**Or manually:**

```bash
# Install dependencies
npm install

# Create environment file (optional)
cp .env.example .env.local

# Build for production
npm run build

# Deploy to S3
aws s3 mb s3://limitless-dashboard-site --region us-east-1
aws s3 sync dist/ s3://limitless-dashboard-site --delete

# Enable website hosting
aws s3 website s3://limitless-dashboard-site \
  --index-document index.html \
  --error-document index.html

# Make bucket public
aws s3api put-bucket-policy --bucket limitless-dashboard-site --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::limitless-dashboard-site/*"
  }]
}'
```

## Step 3: Access Your Dashboard

```bash
# Your dashboard URL:
echo "http://limitless-dashboard-site.s3-website-us-east-1.amazonaws.com"
```

Open that URL in your browser!

## What You'll See

### Overview Tab
- 📊 **8 Metric Cards**: Total trades, win rate, P&L, win/loss ratio, points, volume, avg trade size, uptime
- 💼 **Active Positions**: Your current holdings
- 📈 **Trade History**: Recent trades with details

### Analytics Tab
- 📊 **Trades by Day Chart**: Bar chart showing wins vs losses
- 💰 **Daily P&L Chart**: Line chart tracking profit/loss trends
- 💹 **Daily Volume Chart**: Bar chart of trading volume
- 📋 **Daily Summary Table**: Complete breakdown by date

### Points & Volume Tab
- ⭐ **Limitless Points**: Total points and current epoch
- 📈 **Points by Epoch**: Historical points breakdown
- 💹 **Volume Analysis**: Total and daily volume tracking
- 📊 **Points/Volume Ratio**: Performance metrics

**Features:**
- 🔄 **Auto-refresh**: Updates every 30 seconds
- 🔐 **Secure**: No API tokens exposed (all server-side)
- 👛 **Wallet Tracking**: Shows `0x967e...d867`

## Development Mode

Want to work on the dashboard locally?

```bash
npm run dev
# Opens at http://localhost:5173
```

## Common Commands

```bash
# View Lambda logs
aws logs tail /aws/lambda/limitless-trade-generator --follow

# Check S3 files
aws s3 ls s3://limitless-bot-logs/

# Update Lambda code
cd lambda
npm install
zip -r function.zip index.js package.json node_modules/
aws lambda update-function-code \
  --function-name limitless-trade-generator \
  --zip-file fileb://function.zip

# Update dashboard
npm run build
aws s3 sync dist/ s3://limitless-dashboard-site --delete
```

## Troubleshooting

**Dashboard shows "Loading..." forever:**
- Check Lambda logs: `aws logs tail /aws/lambda/limitless-trade-generator`
- Verify S3 files exist: `aws s3 ls s3://limitless-bot-logs/`
- Check browser console for CORS errors

**Lambda returning errors:**
- Verify auth token is valid and not expired
- Check IAM permissions for S3 write access
- View logs for detailed error messages

**Need to update auth token:**
```bash
aws lambda update-function-configuration \
  --function-name limitless-trade-generator \
  --environment Variables="{S3_BUCKET_NAME=limitless-bot-logs,LIMITLESS_AUTH_TOKEN=Bearer NEW_TOKEN}"
```

## Next Steps

- [ ] Set up CloudFront for HTTPS
- [ ] Add custom domain
- [ ] Configure alerts for Lambda failures
- [ ] Customize dashboard colors/branding
- [ ] Add more analytics and charts

## Cost

- **Lambda**: ~$0.20/month
- **S3**: ~$0.20/month
- **Total**: < $1/month

## Documentation

- Full setup: See [SETUP.md](SETUP.md)
- Lambda details: See [lambda/README.md](lambda/README.md)
- Lambda deployment: See [LAMBDA_DEPLOYMENT.md](LAMBDA_DEPLOYMENT.md)

## Support

Having issues? Check the logs:
1. Lambda logs: CloudWatch Logs
2. S3 files: `aws s3 ls s3://limitless-bot-logs/`
3. Browser console: F12 → Console tab

Happy trading! 🎯
