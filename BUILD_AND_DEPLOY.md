# 🚀 Build and Deploy Dashboard

## Issue

The S3 website bucket is empty. You need to build the React app and upload the files.

## Solution

Run these commands in your terminal:

### Step 1: Build the Dashboard

```bash
cd /Users/byteblocks/limitless-dashboard

# Install dependencies (only needed once)
npm install

# Build production version
npm run build
```

This creates a `dist/` folder with all the compiled files.

### Step 2: Deploy to S3

```bash
# Upload everything to S3
aws s3 sync dist/ s3://limitless-dashboard-site --delete --region us-east-1
```

### Step 3: Verify

```bash
# Check files were uploaded
aws s3 ls s3://limitless-dashboard-site/ --recursive

# Visit your dashboard
open http://limitless-dashboard-site.s3-website-us-east-1.amazonaws.com
```

## Expected Output

After `npm run build`, you should see:

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── [other assets]
```

After `aws s3 sync`, you should see:

```
upload: dist/index.html to s3://limitless-dashboard-site/index.html
upload: dist/assets/index-xxx.js to s3://limitless-dashboard-site/assets/index-xxx.js
...
```

## Troubleshooting

### "npm: command not found"

Make sure Node.js and npm are installed:
```bash
node --version
npm --version
```

If not installed, install Node.js from https://nodejs.org/

### "Module not found" errors during build

```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### TypeScript errors during build

The build might fail if there are TypeScript errors. Check the output and fix any issues, or temporarily bypass with:
```bash
# Skip type checking (not recommended for production)
npm run build -- --force
```

### Files not showing in S3

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check bucket exists
aws s3 ls s3://limitless-dashboard-site/

# Try sync again with verbose output
aws s3 sync dist/ s3://limitless-dashboard-site --delete --debug
```

## Quick Commands

```bash
# Full deployment in one go
cd /Users/byteblocks/limitless-dashboard && \
npm install && \
npm run build && \
aws s3 sync dist/ s3://limitless-dashboard-site --delete
```

## What the Dashboard Will Show

Once deployed, you'll see:
- 8 metric cards (trades, win rate, P&L, etc.)
- Active positions table
- Recent trades table
- Analytics with charts
- Points & volume tracking

## Next Steps After Deployment

1. Update the Limitless API token in Lambda (currently expired)
2. Wait 5 minutes for Lambda to fetch fresh data
3. Refresh the dashboard to see your data

## Dashboard URL

```
http://limitless-dashboard-site.s3-website-us-east-1.amazonaws.com
```
