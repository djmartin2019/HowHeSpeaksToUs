# Contentful Webhook Setup Guide

This guide explains how to set up automatic Cloudflare Pages rebuilds when content is published in Contentful.

## Overview

When you publish or update content in Contentful, a webhook will automatically trigger a new build and deployment on Cloudflare Pages, ensuring your site always has the latest content.

## Setup Steps

### 1. Create a Deploy Hook in Cloudflare Pages

1. Go to your [Cloudflare Pages Dashboard](https://dash.cloudflare.com/pages)
2. Select your project (e.g., "HowHeSpeaksToUs")
3. Navigate to **Settings** > **Build & Deployments**
4. Scroll down to the **Deploy Hooks** section
5. Click **Add deploy hook**
6. Give it a name (e.g., "Contentful Webhook")
7. Select the branch you want to build (usually `main` or `master`)
8. Click **Save**
9. **Copy the Deploy Hook URL** - it will look like:
   ```
   https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/abc123def456...
   ```

### 2. Add Environment Variable to Cloudflare Pages

1. In your Cloudflare Pages project, go to **Settings** > **Environment Variables**
2. Click **Add variable**
3. Add the following:
   - **Variable name**: `CLOUDFLARE_DEPLOY_HOOK_URL`
   - **Value**: Paste the Deploy Hook URL you copied in step 1
   - **Environment**: Select all environments (Production, Preview, etc.)
4. Click **Save**

### 3. Configure Webhook in Contentful

1. Log in to your [Contentful account](https://app.contentful.com)
2. Select your space
3. Go to **Settings** > **Webhooks**
4. Click **Add webhook**
5. Configure the webhook:
   - **Name**: "Cloudflare Pages Deploy Hook"
   - **URL**: `https://your-domain.com/api/contentful-webhook`
     - Replace `your-domain.com` with your actual Cloudflare Pages domain
     - Example: `https://howgodspeakstous.com/api/contentful-webhook`
   - **Content type**: Select the content types you want to trigger rebuilds for:
     - `blogPost` (for blog posts)
     - `dailyVerse` (for daily verses)
     - `page` (for pages)
     - Or select "All content types" to trigger on any content change
6. **Triggers**: Select when the webhook should fire:
   - ✅ **Entry publish** (most common - when you publish content)
   - ✅ **Entry unpublish** (optional - when you unpublish content)
   - ✅ **Entry archive** (optional - when you archive content)
   - ✅ **Entry unarchive** (optional - when you unarchive content)
7. **Optional - Security**:
   - Scroll down to **Authentication**
   - You can set a **Secret** for webhook signature verification
   - If you set a secret, also add it as `CONTENTFUL_WEBHOOK_SECRET` in Cloudflare Pages environment variables
8. Click **Save**

### 4. Test the Webhook

1. Go to Contentful and publish or update any content
2. Check your Cloudflare Pages dashboard - you should see a new deployment start automatically
3. The deployment will fetch the latest content from Contentful and rebuild your site

## How It Works

1. **Content Published**: You publish content in Contentful
2. **Webhook Sent**: Contentful sends a POST request to `/api/contentful-webhook`
3. **Function Executes**: The Cloudflare Function receives the webhook
4. **Build Triggered**: The function calls the Cloudflare Pages Deploy Hook API
5. **Site Rebuilds**: Cloudflare Pages rebuilds your site with the latest content
6. **Site Updates**: Your live site now shows the new content

## Troubleshooting

### Webhook Not Triggering Builds

1. **Check the URL**: Make sure the webhook URL in Contentful matches your Cloudflare Pages domain
2. **Verify Environment Variable**: Ensure `CLOUDFLARE_DEPLOY_HOOK_URL` is set in Cloudflare Pages
3. **Check Webhook Logs**: In Contentful, go to Settings > Webhooks > Your webhook > Recent deliveries to see if requests are being sent
4. **Check Function Logs**: In Cloudflare Pages, go to Functions > Logs to see if the function is receiving requests

### Build Fails After Webhook

- This is usually a build-time issue, not a webhook issue
- Check the Cloudflare Pages deployment logs for build errors
- Verify your Contentful environment variables are set correctly

### Security Considerations

- The webhook endpoint is public, but it only triggers builds (doesn't expose sensitive data)
- For additional security, you can:
  - Set a `CONTENTFUL_WEBHOOK_SECRET` in both Contentful and Cloudflare Pages
  - Implement IP allowlisting (if Contentful provides static IPs)
  - Use Cloudflare Access to protect the endpoint

## Alternative: Direct Deploy Hook (Simpler)

If you don't need the custom function, you can use Cloudflare's Deploy Hook directly:

1. Create the Deploy Hook in Cloudflare Pages (same as step 1 above)
2. In Contentful, set the webhook URL directly to the Deploy Hook URL (skip the function)
3. This is simpler but offers less control and logging

The custom function approach (documented above) provides:

- Better logging and debugging
- Ability to filter which content types trigger builds
- Future extensibility (e.g., notifications, conditional builds)
