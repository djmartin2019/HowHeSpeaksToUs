// Astro API endpoint for contact form submissions
// Works in both development and production (Cloudflare Pages)
export async function POST({ request }: { request: Request }) {
  try {
    // Handle both FormData and JSON requests
    let name: string | null;
    let email: string | null;
    let message: string | null;
    
    const contentType = request.headers.get("content-type") || "";
    
    // Try to parse as FormData first (most common case)
    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      try {
        const formData = await request.formData();
        name = formData.get("name") as string | null;
        email = formData.get("email") as string | null;
        message = formData.get("message") as string | null;
      } catch (formError) {
        // If FormData parsing fails, try JSON
        try {
          const json = await request.json();
          name = json.name || null;
          email = json.email || null;
          message = json.message || null;
        } catch {
          throw new Error("Unable to parse request body");
        }
      }
    } else if (contentType.includes("application/json")) {
      // If JSON, parse directly
      const json = await request.json();
      name = json.name || null;
      email = json.email || null;
      message = json.message || null;
    } else {
      // Default: try FormData first, then JSON
      try {
        const formData = await request.formData();
        name = formData.get("name") as string | null;
        email = formData.get("email") as string | null;
        message = formData.get("message") as string | null;
      } catch {
        // If FormData fails, try JSON
        try {
          const json = await request.json();
          name = json.name || null;
          email = json.email || null;
          message = json.message || null;
        } catch {
          throw new Error("Unable to parse request body");
        }
      }
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
    const fromEmail = "noreply@howgodspeakstous.com";

    // Get Resend API key from environment variables
    const resendApiKey = import.meta.env.RESEND_API_KEY;

    // If Resend API key is configured, send email
    if (resendApiKey) {
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
            reply_to: email as string,
            subject: `Contact Form Submission from ${name}`,
            html: `
              <h2>New Contact Form Submission</h2>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Message:</strong></p>
              <p>${String(message).replace(/\n/g, "<br>")}</p>
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
        } else {
          const emailResult = await emailResponse.json();
          console.log("Email sent successfully:", emailResult.id);
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }
    } else {
      // Log for development when API key is not set
      console.log("Contact form submission (email not sent - RESEND_API_KEY not configured):", {
        name,
        email,
        message,
        targetEmail,
      });
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
