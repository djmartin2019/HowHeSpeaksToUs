# Quick Webhook Setup

## Step 1: Add Environment Variable in Cloudflare Pages

1. Go to your Cloudflare Pages project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Click **Add variable**
4. Add:
   - **Variable name**: `CLOUDFLARE_DEPLOY_HOOK_URL`
   - **Value**: `https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/dc6ce4db-5ba6-41d5-a173-cd99c0dd8178`
   - **Environment**: Select all (Production, Preview, etc.)
5. Click **Save**

## Step 2: Deploy Your Code

Make sure the webhook function is deployed:

```bash
git add functions/api/contentful-webhook.js
git commit -m "Add Contentful webhook handler"
git push origin main
```

Wait for Cloudflare Pages to finish deploying.

## Step 3: Configure Webhook in Contentful

1. Go to [Contentful](https://app.contentful.com) → Your Space → **Settings** → **Webhooks**
2. Click **Add webhook**
3. Configure:
   - **Name**: "Cloudflare Pages Deploy"
   - **URL**: `https://howgodspeakstous.com/api/contentful-webhook`
     - (Replace with your actual domain if different)
   - **Content type**: Select the content types you want to trigger rebuilds:
     - `blogPost`
     - `dailyVerse`
     - `page`
     - Or select "All content types"
   - **Triggers**: 
     - ✅ **Entry publish** (most important)
     - ✅ **Entry unpublish** (optional)
   - **Authentication**: Leave empty for now (or set a secret if you want extra security)
4. Click **Save**

## Step 4: Test It!

1. Go to Contentful and publish or update any content
2. Check your Cloudflare Pages dashboard - you should see a new deployment start automatically
3. Your site will rebuild with the latest content!

## Troubleshooting

### Test the function directly:
```bash
curl -X POST https://howgodspeakstous.com/api/contentful-webhook
```

You should get: `{"success":true,"message":"Build triggered successfully"}`

### Check function logs:
- Cloudflare Pages → Your Project → Functions → Logs
- Look for "Contentful webhook received" messages

### Verify environment variable:
- Make sure `CLOUDFLARE_DEPLOY_HOOK_URL` is set in Cloudflare Pages environment variables
- It should be available in all environments (Production, Preview, etc.)

