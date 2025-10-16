# Authentication Setup for Lambda

## Problem

The current Bearer tokens expire after 1 hour. The Lambda needs to automatically refresh tokens to keep running.

## Solution: Use Privy Authentication

According to the Limitless API docs (https://api.limitless.exchange/api-v1#tag/authentication), we need to use **Privy** for authentication.

## What You Need

### 1. Privy App Credentials

From your Limitless Exchange / Privy dashboard:

- **`PRIVY_APP_ID`** - Your Privy application ID
- **`PRIVY_APP_SECRET`** - Your Privy application secret

### 2. Refresh Token

You need a **refresh token** that doesn't expire (or expires much longer than access tokens).

**How to get it:**

Option A: From Limitless Exchange dashboard
- Go to API settings
- Generate a long-lived refresh token

Option B: Via authentication flow
- Use the Privy authentication endpoint
- Get refresh token from the response

## Implementation Options

### Option 1: Auto-Refreshing Tokens (Recommended)

Use the new `index-with-auth.js` file that:
- Stores access token in memory (persists during Lambda warm starts)
- Automatically refreshes when token expires
- Retries failed requests with new token

**Environment Variables Needed:**
```bash
PRIVY_APP_ID=your_app_id
PRIVY_APP_SECRET=your_app_secret
PRIVY_REFRESH_TOKEN=your_refresh_token
S3_BUCKET_NAME=limitless-bot-logs
```

**Deploy Command:**
```bash
cd lambda

# Replace index.js with the auth version
mv index.js index-backup.js
mv index-with-auth.js index.js

# Package and deploy
zip function.zip index.js package.json

aws lambda update-function-code \
  --function-name limitless-trade-generator \
  --zip-file fileb://function.zip \
  --region us-east-1

# Update environment variables
aws lambda update-function-configuration \
  --function-name limitless-trade-generator \
  --environment Variables="{S3_BUCKET_NAME=limitless-bot-logs,PRIVY_APP_ID=YOUR_APP_ID,PRIVY_APP_SECRET=YOUR_SECRET,PRIVY_REFRESH_TOKEN=YOUR_REFRESH_TOKEN}" \
  --region us-east-1
```

### Option 2: Manual Token Refresh (Current Approach)

Keep using Bearer tokens but manually update them when they expire:

**Pros:**
- Simpler setup
- No need for Privy credentials

**Cons:**
- Requires manual intervention every hour
- Dashboard breaks when token expires

**Update Command:**
```bash
aws lambda update-function-configuration \
  --function-name limitless-trade-generator \
  --environment Variables="{S3_BUCKET_NAME=limitless-bot-logs,LIMITLESS_AUTH_TOKEN=Bearer NEW_TOKEN_HERE}" \
  --region us-east-1
```

### Option 3: Store Credentials in AWS Secrets Manager (Production)

For production, store sensitive credentials in AWS Secrets Manager:

**Setup:**
```bash
# Create secret
aws secretsmanager create-secret \
  --name limitless/privy-credentials \
  --secret-string '{
    "app_id":"YOUR_APP_ID",
    "app_secret":"YOUR_SECRET",
    "refresh_token":"YOUR_REFRESH_TOKEN"
  }'

# Give Lambda permission to read secret
# (update IAM role policy)
```

**Update Lambda to read from Secrets Manager:**
```javascript
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function getCredentials() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'limitless/privy-credentials' })
  );
  return JSON.parse(response.SecretString);
}
```

## Current Status

✅ Lambda is deployed and running
✅ S3 buckets configured
✅ EventBridge schedule active
⚠️ **Using expired Bearer token** (needs update)

## Next Steps

**Choose your approach:**

### Quick Fix (Option 2):
Get a fresh Bearer token every hour and update manually.

### Proper Solution (Option 1):
1. Get Privy credentials from Limitless dashboard
2. Get a refresh token
3. Deploy the auth-enabled Lambda
4. Never worry about tokens again!

### Production (Option 3):
Combine Option 1 with AWS Secrets Manager for maximum security.

## How to Get Privy Credentials

1. **Log into Limitless Exchange**
2. **Go to Settings → Developer / API**
3. **Find or create your Privy App:**
   - App ID
   - App Secret
   - Generate Refresh Token

4. **Save the credentials** (you won't see them again!)

## Testing

After deploying with auth:

```bash
# Test Lambda
aws lambda invoke --function-name limitless-trade-generator output.json
cat output.json

# Check logs
aws logs tail /aws/lambda/limitless-trade-generator --follow

# Should see:
# "Refreshing access token..."
# "Access token refreshed successfully"
# "Fetching positions from Limitless API..."
# "Fetched X positions"
```

## Troubleshooting

### "Token refresh failed: 401"
- Check PRIVY_APP_ID is correct
- Check PRIVY_APP_SECRET is correct
- Verify refresh token hasn't expired

### "Token refresh failed: 403"
- App secret might be wrong
- Refresh token might be revoked
- Check Privy app is active

### Still getting 401 on API calls
- Token refresh might be working but tokens still invalid
- Check Privy app has correct scopes/permissions
- Verify API endpoints match your account

## Cost Impact

**None!** Token refresh is a simple API call that:
- Happens once per hour (or when Lambda cold starts)
- Adds < 100ms to Lambda execution
- No additional AWS charges

## Security Notes

- ✅ Refresh tokens are long-lived but can be revoked
- ✅ Access tokens expire after 1 hour (security best practice)
- ✅ Credentials stored in Lambda environment (encrypted at rest)
- ✅ Consider Secrets Manager for production
- ❌ Don't commit credentials to git
- ❌ Don't share refresh tokens

## Support

Need help getting Privy credentials? Contact Limitless Exchange support or check their documentation.
