// Cloudflare Pages Function for handling contact form submissions
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // Handle both JSON and FormData requests
    let name, email, message;
    const contentType = request.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      // Parse JSON request
      const json = await request.json();
      name = json.name;
      email = json.email;
      message = json.message;
    } else {
      // Parse FormData request
      const formData = await request.formData();
      name = formData.get("name");
      email = formData.get("email");
      message = formData.get("message");
    }

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
    const fromEmail = "noreply@howgodspeakstous.com"; // Verified domain in Resend

    // Get Resend API key from environment variables
    const resendApiKey = env.RESEND_API_KEY;

    // If Resend API key is not configured, log and return success (for development)
    if (!resendApiKey) {
      console.log("Contact form submission (email not sent - RESEND_API_KEY not configured):", {
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
    }

    // Send email using Resend API
    try {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [targetEmail],
          reply_to: email,
          subject: `Contact Form Submission from ${String(name)}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${String(name)}</p>
            <p><strong>Email:</strong> ${String(email)}</p>
            <p><strong>Message:</strong></p>
            <p>${String(message).replace(/\n/g, "<br>")}</p>
          `,
          text: `
New Contact Form Submission

Name: ${String(name)}
Email: ${String(email)}

Message:
${String(message)}
          `,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.text();
        console.error("Resend API error:", errorData);
        throw new Error("Failed to send email");
      }

      const emailResult = await emailResponse.json();
      console.log("Email sent successfully:", emailResult.id);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Still return success to user, but log the error
      // You might want to set up error monitoring here
    }

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
