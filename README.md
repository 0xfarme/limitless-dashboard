# 📊 Limitless Bot Dashboard

Real-time web dashboard for monitoring the Limitless Trading Bot performance.

## Features

- 📈 Real-time trade monitoring
- 💰 P&L tracking and analytics
- 🎯 Win/loss statistics
- 📊 Performance charts
- 🔄 Position tracking

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: Tailwind CSS
- **Charts**: Recharts
- **Data**: S3 (AWS SDK)
- **Hosting**: S3 + CloudFront

## Quick Start

### Prerequisites

- Node.js 18+
- AWS S3 bucket configured (see [Setup Guide](#aws-setup))

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

## AWS Setup

### 1. Create S3 Bucket for Logs

```bash
aws s3 mb s3://limitless-bot-logs --region us-east-1
```

### 2. Configure CORS

Create `cors.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

Apply CORS:

```bash
aws s3api put-bucket-cors --bucket limitless-bot-logs --cors-configuration file://cors.json
```

### 3. Make Bucket Public (for reading)

```bash
aws s3api put-bucket-policy --bucket limitless-bot-logs --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::limitless-bot-logs/*"
  }]
}'
```

### 4. Create S3 Bucket for Website

```bash
aws s3 mb s3://limitless-dashboard --region us-east-1
aws s3 website s3://limitless-dashboard --index-document index.html
```

### 5. Deploy Dashboard

```bash
npm run build
aws s3 sync dist/ s3://limitless-dashboard --delete
```

### 6. Setup CloudFront (Optional but Recommended)

For HTTPS and better performance, create a CloudFront distribution pointing to your S3 bucket.

## Configuration

Create `.env.local`:

```env
VITE_S3_BUCKET=limitless-bot-logs
VITE_S3_REGION=us-east-1
```

## Bot Configuration

In your bot's `.env`, enable S3 uploads:

```env
S3_UPLOAD_ENABLED=true
S3_BUCKET_NAME=limitless-bot-logs
S3_REGION=us-east-1
S3_UPLOAD_INTERVAL_MS=60000
```

## Project Structure

```
limitless-dashboard/
├── src/
│   ├── components/        # React components
│   │   ├── StatsOverview.tsx
│   │   ├── TradesTable.tsx
│   │   ├── ProfitChart.tsx
│   │   └── PositionsTable.tsx
│   ├── lib/
│   │   ├── s3Client.ts    # S3 data fetching
│   │   └── types.ts       # TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── package.json
└── vite.config.ts
```

## License

MIT
