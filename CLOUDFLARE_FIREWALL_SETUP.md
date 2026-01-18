# Cloudflare Firewall Setup for Contentful Webhooks

## Problem

Cloudflare's bot protection is blocking Contentful webhook requests with a 403 challenge page. We need to create a firewall rule to allow these requests.

## Solution: Create a Firewall Rule

### Step 1: Go to Cloudflare Dashboard

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain (`howgodspeakstous.com`)
3. Go to **Security** → **WAF** (Web Application Firewall)

### Step 2: Create a Custom Rule

1. Click **Create rule** (or go to **Custom Rules** tab)
2. Give it a name: `Allow Contentful Webhooks`
3. Configure the rule:

**When incoming requests match:**

- **Field**: `URI Path`
- **Operator**: `equals`
- **Value**: `/api/contentful-webhook`

**OR (Alternative - More Flexible):**

**When incoming requests match:**

- **Field**: `HTTP Request Header`
- **Header name**: `X-Contentful-Topic`
- **Operator**: `is present`

**Then:**

- **Action**: `Skip`
- **Skip**: Check ALL of these:
  - ✅ **Bot Fight Mode** (if available)
  - ✅ **Super Bot Fight Mode**
  - ✅ **All rate limiting rules** (if available)
  - ✅ Click **"More components to skip"** and look for any bot/challenge related options

**Important:** Make sure you check BOTH Bot Fight Mode AND Super Bot Fight Mode if both are available!

### Step 3: Save the Rule

1. Click **Deploy** to save the rule
2. The rule will be active immediately

## Alternative: Disable Bot Fight Mode Globally (RECOMMENDED)

Since Page Rules don't have Bot Fight Mode options in newer Cloudflare interfaces, the **simplest solution** is to disable it globally:

1. Go to **Security** → **Bots**
2. Find **Bot Fight Mode**
3. Turn it **Off**
4. ⚠️ **Note:** This affects your entire site, but for a small site this is usually acceptable

**Why this works:** Bot Fight Mode is what's blocking Contentful's webhook requests. Disabling it globally ensures webhooks work, and you still have other Cloudflare security features (like Super Bot Fight Mode, WAF, etc.) protecting your site.

**Alternative: Check Custom Rule Options**

If you want to keep Bot Fight Mode enabled for the rest of your site:

1. In your custom rule, click **"More components to skip"**
2. Look for **"Bot Fight Mode"** (if it exists - it might not be available in all plans)
3. If it exists, check it along with "Super Bot Fight Mode" and "Security Level"

## Verify It Works

After creating the rule:

1. Go to Contentful and publish/update content
2. Check Cloudflare's **Security Events** to see if the webhook request is now allowed
3. Check your Cloudflare Pages dashboard to see if a new deployment was triggered

## Troubleshooting

### Still Getting 403? (Most Common: Bot Fight Mode Issue)

**If Security Events shows "Bot fight mode" (not "Super Bot Fight Mode"):**

The issue is that **"Bot Fight Mode"** and **"Super Bot Fight Mode"** are **different systems**. Your custom rule might only be skipping Super Bot Fight Mode, but regular Bot Fight Mode is still active.

**Solution: Disable Bot Fight Mode Globally (RECOMMENDED)**

Since Page Rules don't have Bot Fight Mode options, the simplest solution is to disable it globally:

1. Go to **Security** → **Bots**
2. Find **Bot Fight Mode**
3. Turn it **Off**
4. ⚠️ **Note:** This affects your entire site, but for a small site this is usually acceptable

**Why this works:** Bot Fight Mode is what's blocking Contentful's webhook requests (as shown in Security Events). Disabling it globally ensures webhooks work, and you still have other Cloudflare security features protecting your site.

**Alternative: Check Custom Rule Options**

If you want to keep Bot Fight Mode enabled for the rest of your site:

1. In your custom rule, click **"More components to skip"**
2. Look for **"Bot Fight Mode"** (separate from "Super Bot Fight Mode")
3. If it exists, check it along with "Super Bot Fight Mode" and "Security Level"
4. If it doesn't exist, you'll need to disable Bot Fight Mode globally

**Other things to check:**

1. **Verify the rule is active:**

   - Make sure the rule is **enabled** (toggle should be ON)
   - Check the rule order - this rule should be at the **top** (First)

2. **Check Security Events:**

   - Go to **Security** → **Events**
   - Look at the "Service" column
   - If it says "Bot fight mode", you need to disable Bot Fight Mode (use Page Rules)
   - If it says "Super Bot Fight Mode", make sure you've checked that in your custom rule

3. **Verify the path:**
   - Make sure the URL path matches exactly: `/api/contentful-webhook` (no trailing slash)

### Check Security Events

- Go to **Security** → **Events**
- Look for requests to `/api/contentful-webhook`
- See if they're being blocked or allowed

### Test the Endpoint

After setting up the rule, test with curl:

```bash
curl -X POST https://howgodspeakstous.com/api/contentful-webhook \
  -H "X-Contentful-Topic: ContentManagement.Entry.publish" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

You should get: `{"success":true,"message":"Build triggered successfully"}`
