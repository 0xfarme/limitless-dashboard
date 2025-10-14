# 🚀 Dashboard Setup Guide

## Overview

This guide will walk you through deploying the Limitless Bot Dashboard to AWS.

## Prerequisites

- AWS Account
- AWS CLI installed and configured
- Node.js 18+ installed
- Bot already running with S3 upload enabled

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Create S3 Bucket for Logs

```bash
# Create bucket
aws s3 mb s3://limitless-bot-logs --region us-east-1

# Enable versioning (recommended)
aws s3api put-bucket-versioning \
  --bucket limitless-bot-logs \
  --versioning-configuration Status=Enabled
```

## Step 3: Configure CORS for S3

Create `cors-config.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Apply CORS:

```bash
aws s3api put-bucket-cors \
  --bucket limitless-bot-logs \
  --cors-configuration file://cors-config.json
```

## Step 4: Make Logs Publicly Readable

Create `bucket-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::limitless-bot-logs/*"
    }
  ]
}
```

Apply policy:

```bash
aws s3api put-bucket-policy \
  --bucket limitless-bot-logs \
  --policy file://bucket-policy.json
```

## Step 5: Configure Bot for S3 Upload

In your bot's `.env`:

```env
# Enable S3 uploads
S3_UPLOAD_ENABLED=true
S3_BUCKET_NAME=limitless-bot-logs
S3_REGION=us-east-1

# Optional: AWS credentials (if not using IAM role)
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret

# Upload every minute
S3_UPLOAD_INTERVAL_MS=60000
```

Restart your bot to enable S3 uploads.

## Step 6: Configure Dashboard

Create `.env.local`:

```env
VITE_S3_BUCKET=limitless-bot-logs
VITE_S3_REGION=us-east-1
```

## Step 7: Test Locally

```bash
npm run dev
```

Open http://localhost:5173 - you should see your dashboard with live data!

## Step 8: Build for Production

```bash
npm run build
```

This creates optimized files in `dist/` directory.

## Step 9: Create S3 Bucket for Website

```bash
# Create bucket (use your own name)
aws s3 mb s3://limitless-dashboard-site --region us-east-1

# Configure for static website hosting
aws s3 website s3://limitless-dashboard-site \
  --index-document index.html \
  --error-document index.html
```

## Step 10: Make Website Bucket Public

Create `website-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::limitless-dashboard-site/*"
    }
  ]
}
```

Apply:

```bash
aws s3api put-bucket-policy \
  --bucket limitless-dashboard-site \
  --policy file://website-policy.json
```

## Step 11: Deploy to S3

```bash
aws s3 sync dist/ s3://limitless-dashboard-site --delete
```

## Step 12: Get Website URL

```bash
echo "http://limitless-dashboard-site.s3-website-us-east-1.amazonaws.com"
```

Visit your dashboard!

## Optional: Setup CloudFront for HTTPS

For production, use CloudFront for:
- HTTPS
- Custom domain
- Better performance
- CDN caching

### Create CloudFront Distribution

```bash
# This is complex - use AWS Console or CDK
```

1. Go to CloudFront in AWS Console
2. Create distribution
3. Origin: Your S3 website endpoint
4. Viewer Protocol Policy: Redirect HTTP to HTTPS
5. Cache behavior: Cache based on query strings
6. Default root object: index.html

## Updating the Dashboard

Whenever you make changes:

```bash
npm run build
aws s3 sync dist/ s3://limitless-dashboard-site --delete

# If using CloudFront, invalidate cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

## Troubleshooting

### Dashboard shows "No trades yet"

- Check bot is running with `S3_UPLOAD_ENABLED=true`
- Verify files exist: `aws s3 ls s3://limitless-bot-logs/`
- Check CORS is configured correctly
- Open browser console for errors

### "Access Denied" errors

- Verify bucket policy is applied
- Check bucket name matches in bot and dashboard config
- Ensure files have public read permissions

### Dashboard not updating

- Wait 60 seconds for next S3 upload from bot
- Click "Refresh" button
- Check browser console for fetch errors
- Verify S3 files have recent timestamps

## Cost Estimate

- S3 Storage: ~$0.50/month (20GB)
- S3 Requests: ~$0.10/month
- Data Transfer: ~$1-5/month
- CloudFront (optional): ~$5/month

**Total: $2-10/month**

## Security Notes

- Logs are publicly readable (no sensitive data should be in logs)
- Consider redacting wallet addresses if desired
- Use CloudFront signed URLs for private dashboards
- Enable S3 encryption at rest for compliance

## Next Steps

- Add authentication (Cognito)
- Set up custom domain
- Add real-time WebSocket updates
- Create mobile-responsive views
- Add more charts and analytics

---

## Need Help?

- Check bot logs for S3 upload errors
- Verify AWS credentials have correct permissions
- Test S3 URLs directly in browser
- Open browser developer console for errors

Happy trading! 🚀
