// Cloudflare Pages Function for handling contact form submissions
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
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
          subject: `Contact Form Submission from ${name}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, "<br>")}</p>
          `,
          text: `
New Contact Form Submission

Name: ${name}
Email: ${email}

Message:
${message}
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
