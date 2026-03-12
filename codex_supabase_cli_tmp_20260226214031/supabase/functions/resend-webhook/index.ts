import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { Webhook } from "npm:svix";

type JsonRecord = Record<string, unknown>;

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: JsonRecord;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function getHeader(req: Request, name: string): string | null {
  return req.headers.get(name) ?? req.headers.get(name.toLowerCase());
}

function parseEventTime(event: ResendWebhookEvent): string {
  const raw = event?.created_at;
  if (typeof raw === "string" && raw) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function getEmailId(event: ResendWebhookEvent): string | null {
  const value = event?.data?.["email_id"];
  return typeof value === "string" && value ? value : null;
}

function getRecipient(event: ResendWebhookEvent): string | null {
  const to = event?.data?.["to"];
  if (typeof to === "string" && to) return to;
  if (Array.isArray(to) && to.length > 0 && typeof to[0] === "string") return to[0];
  return null;
}

function getSubject(event: ResendWebhookEvent): string | null {
  const value = event?.data?.["subject"];
  return typeof value === "string" && value ? value : null;
}

function getNestedString(obj: unknown, path: string[]): string | null {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as JsonRecord)[key];
  }
  return typeof current === "string" && current ? current : null;
}

function mapStatus(type?: string): string | null {
  switch (type) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.failed":
      return "failed";
    case "email.suppressed":
      return "failed";
    default:
      return null;
  }
}

function buildUpdatePayload(event: ResendWebhookEvent): JsonRecord {
  const type = event?.type || null;
  const status = mapStatus(event?.type);
  const eventAt = parseEventTime(event);
  const recipient = getRecipient(event);
  const subject = getSubject(event);

  const payload: JsonRecord = {
    provider: "resend",
    webhook_last_event_type: type,
    webhook_last_event_at: eventAt,
    webhook_payload: event,
    updated_at: new Date().toISOString()
  };

  if (recipient) payload.recipient_email = recipient;
  if (subject) payload.subject = subject;
  if (status) payload.status = status;

  if (type === "email.sent" && !("sent_at" in payload)) {
    payload.sent_at = eventAt;
  }
  if (type === "email.delivered") {
    payload.delivered_at = eventAt;
  }
  if (type === "email.opened") {
    payload.opened_at = eventAt;
  }
  if (type === "email.clicked") {
    payload.clicked_at = eventAt;
  }
  if (type === "email.bounced") {
    payload.bounced_at = eventAt;
    const bounceMessage =
      getNestedString(event?.data, ["bounce", "message"]) ||
      getNestedString(event?.data, ["bounce", "reason"]) ||
      getNestedString(event?.data, ["message"]);
    if (bounceMessage) payload.last_error = bounceMessage;
  }
  if (type === "email.complained") {
    payload.complained_at = eventAt;
    const complaintMessage =
      getNestedString(event?.data, ["complaint", "message"]) ||
      getNestedString(event?.data, ["message"]);
    if (complaintMessage) payload.last_error = complaintMessage;
  }
  if (type === "email.failed" || type === "email.suppressed") {
    const failureMessage =
      getNestedString(event?.data, ["error", "message"]) ||
      getNestedString(event?.data, ["message"]) ||
      event?.type ||
      "Email delivery failed";
    payload.last_error = failureMessage;
  }

  return payload;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
    }
    if (!webhookSecret) {
      throw new Error("RESEND_WEBHOOK_SECRET not configured");
    }

    const rawBody = await req.text();
    const svixId = getHeader(req, "svix-id");
    const svixTimestamp = getHeader(req, "svix-timestamp");
    const svixSignature = getHeader(req, "svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return json({ error: "Missing Svix signature headers" }, 400);
    }

    const wh = new Webhook(webhookSecret);
    const verified = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature
    }) as JsonRecord;

    const event = verified as ResendWebhookEvent;
    const emailId = getEmailId(event);

    if (!emailId) {
      return json({
        ok: true,
        ignored: true,
        reason: "No email_id in webhook payload",
        eventType: event?.type || null
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const updatePayload = buildUpdatePayload(event);

    const { data, error } = await supabaseAdmin
      .from("email_queue")
      .update(updatePayload)
      .eq("provider", "resend")
      .eq("provider_message_id", emailId)
      .select("id");

    if (error) {
      throw error;
    }

    return json({
      ok: true,
      eventType: event?.type || null,
      emailId,
      matchedRows: Array.isArray(data) ? data.length : 0
    });
  } catch (error) {
    console.error("Resend webhook error:", error);
    return json({ error: (error as Error)?.message || "Unknown error" }, 500);
  }
});
