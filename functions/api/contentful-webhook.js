// Cloudflare Pages Function for handling Contentful webhooks
// This function receives webhook events from Contentful and triggers a Cloudflare Pages rebuild
//
// IMPORTANT: You must create a Cloudflare Firewall Rule to bypass bot protection for this endpoint.
// See CLOUDFLARE_FIREWALL_SETUP.md for instructions.

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // Verify this is a Contentful webhook by checking for Contentful-specific headers
    const contentfulTopic = request.headers.get("X-Contentful-Topic");
    const contentfulWebhookName = request.headers.get(
      "X-Contentful-Webhook-Name"
    );

    // Log the request for debugging
    console.log("Webhook request received:", {
      hasContentfulTopic: !!contentfulTopic,
      hasContentfulWebhookName: !!contentfulWebhookName,
      userAgent: request.headers.get("User-Agent"),
      contentType: request.headers.get("Content-Type"),
    });

    // Optional: Only allow requests with Contentful headers (for extra security)
    // Uncomment the following lines if you want to reject non-Contentful requests:
    /*
    if (!contentfulTopic && !contentfulWebhookName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Not a valid Contentful webhook",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    */

    // Get the Cloudflare Pages Deploy Hook URL from environment variables
    const deployHookUrl = env.CLOUDFLARE_DEPLOY_HOOK_URL;

    if (!deployHookUrl) {
      console.error(
        "CLOUDFLARE_DEPLOY_HOOK_URL environment variable is not set"
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "Deploy hook URL not configured",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Optional: Verify webhook signature from Contentful
    // Contentful sends a X-Contentful-Webhook-Signature header
    // You can verify this if you set up a secret in Contentful
    const webhookSecret = env.CONTENTFUL_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get("X-Contentful-Webhook-Signature");
      if (!signature) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing webhook signature",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      // Note: Contentful uses HMAC-SHA256 for webhook signatures
      // You would need to implement signature verification here if needed
      // For now, we'll just check if the header exists
    }

    // Parse the webhook payload to log what triggered the rebuild
    let webhookData = null;
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        webhookData = await request.json();
      }
    } catch (e) {
      // If parsing fails, continue anyway - we still want to trigger the build
      console.warn("Could not parse webhook payload:", e);
    }

    // Log the webhook event for debugging
    if (webhookData) {
      const eventType = webhookData.sys?.type || "unknown";
      const contentType = webhookData.sys?.contentType?.sys?.id || "unknown";
      console.log(
        `Contentful webhook received: ${eventType} for ${contentType}`
      );
    }

    // Trigger Cloudflare Pages rebuild by calling the Deploy Hook
    // Deploy Hooks are simple - just POST to the URL, no body needed
    // The branch is already configured when you create the Deploy Hook
    const deployResponse = await fetch(deployHookUrl, {
      method: "POST",
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error("Failed to trigger Cloudflare Pages rebuild:", errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to trigger rebuild",
          details: errorText,
        }),
        {
          status: deployResponse.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Deploy Hooks return a simple success response
    await deployResponse.json().catch(() => ({ success: true }));
    console.log("Cloudflare Pages rebuild triggered successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Build triggered successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook handler error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
