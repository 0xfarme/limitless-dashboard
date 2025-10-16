#!/bin/bash
set -e

# Configuration
BUCKET_NAME="limitless-dashboard-site"
REGION="us-east-1"

echo "🚀 Deploying Limitless Dashboard Frontend..."
echo ""

# Check if bucket exists
echo "📦 Checking if S3 bucket exists..."
if aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'
then
    echo "Creating S3 bucket..."
    aws s3 mb s3://${BUCKET_NAME} --region ${REGION}

    echo "Configuring bucket for website hosting..."
    aws s3 website s3://${BUCKET_NAME} \
      --index-document index.html \
      --error-document index.html

    echo "Making bucket public..."
    aws s3api put-bucket-policy --bucket ${BUCKET_NAME} --policy "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Sid\": \"PublicReadGetObject\",
        \"Effect\": \"Allow\",
        \"Principal\": \"*\",
        \"Action\": \"s3:GetObject\",
        \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}/*\"
      }]
    }"
else
    echo "✅ Bucket already exists"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo ""
echo "🔨 Building production bundle..."
npm run build

# Sync to S3
echo ""
echo "☁️  Uploading to S3..."
aws s3 sync dist/ s3://${BUCKET_NAME} --delete --region ${REGION}

# Get website URL
WEBSITE_URL="http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your dashboard is live at:"
echo "   ${WEBSITE_URL}"
echo ""
echo "📊 Next steps:"
echo "   1. Make sure Lambda is deployed (see lambda/deploy.sh)"
echo "   2. Wait ~5 minutes for Lambda to populate S3 with data"
echo "   3. Visit your dashboard!"
echo ""
echo "🔧 Optional: Setup CloudFront for HTTPS"
echo "   See SETUP.md for instructions"
echo ""
