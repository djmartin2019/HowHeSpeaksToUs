// Astro API endpoint for contact form submissions
// Works in both development and production (Cloudflare Pages)
export async function POST({ request }: { request: Request }) {
  try {
    const formData = await request.formData();

    const name = formData.get("name");
    const email = formData.get("email");
    const message = formData.get("message");

    // Basic validation
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "All fields are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Target email address for contact form submissions
    const targetEmail = "howhespeakstous@gmail.com";

    // In a real implementation, you would:
    // 1. Send an email using a service like SendGrid, Resend, or EmailJS to: howhespeakstous@gmail.com
    // 2. Store the message in a database
    // 3. Send a notification to the site owner

    // For now, we'll just log the message and return success
    console.log("Contact form submission:", {
      name,
      email,
      message,
      targetEmail,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Thank you for your message! We'll get back to you soon.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Contact form error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Something went wrong. Please try again later.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
