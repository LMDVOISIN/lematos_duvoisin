import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }

  try {
    const { to, subject, htmlBody, textBody, templateKey, variables } = await req.json();

    if (!to || (!subject && !templateKey)) {
      return new Response(JSON.stringify({
        error: "Missing required fields: to and (subject or templateKey)"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    // Process HTML body with variable substitution
    let processedHtml = htmlBody || "";
    let processedText = textBody || "";
    let finalSubject = subject || "";

    if (variables && typeof variables === "object") {
      // Replace variables in HTML body
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, "g");
        processedHtml = processedHtml.replace(regex, variables[key] || "");
        processedText = processedText.replace(regex, variables[key] || "");
        finalSubject = finalSubject.replace(regex, variables[key] || "");
      });
    }

    // Send email via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: Array.isArray(to) ? to : [to],
        subject: finalSubject,
        html: processedHtml,
        text: processedText || undefined
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId: resendData.id,
      templateKey: templateKey || null
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});
