import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

type RequestBody = {
  reservationId?: string | null;
  phase?: string | null;
  attestationText?: string | null;
  userAgent?: string | null;
  deviceFingerprintHash?: string | null;
  deviceType?: string | null;
  clientReportedCoordinates?: string | null;
  metadata?: JsonRecord | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePhase(value: unknown): "start" | "end" | null {
  const phase = String(value || "").trim().toLowerCase();
  if (phase === "start" || phase === "end") return phase;
  return null;
}

function getClientIp(req: Request): string | null {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const first = candidate.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY manquant");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const body = (await req.json()) as RequestBody;
    const reservationId = asOptionalString(body?.reservationId);
    const phase = normalizePhase(body?.phase);
    const attestationText = asOptionalString(body?.attestationText);
    const deviceType = asOptionalString(body?.deviceType);
    const deviceFingerprintHash = asOptionalString(body?.deviceFingerprintHash);
    const userAgent = asOptionalString(body?.userAgent) || asOptionalString(req.headers.get("user-agent"));
    const clientReportedCoordinates = asOptionalString(body?.clientReportedCoordinates);
    const metadata = (body?.metadata && typeof body.metadata === "object" ? body.metadata : {}) as JsonRecord;

    if (!reservationId) {
      return json({ error: "reservationId manquant" }, 400);
    }
    if (!phase) {
      return json({ error: "phase invalide" }, 400);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const ipAddress = getClientIp(req);

    const { data, error } = await supabase.rpc("confirm_reservation_inspection_presence", {
      p_reservation_id: reservationId,
      p_phase: phase,
      p_attestation_text: attestationText,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_device_fingerprint_hash: deviceFingerprintHash,
      p_device_type: deviceType,
      p_client_reported_coordinates: clientReportedCoordinates,
      p_metadata: metadata,
    });

    if (error) {
      console.error("confirm-inspection-presence rpc error:", error);
      return json({ error: error.message || "RPC error" }, 400);
    }

    return json({
      ok: true,
      session: data,
      technicalTrace: {
        ipCaptured: Boolean(ipAddress),
        userAgentCaptured: Boolean(userAgent),
        deviceTypeCaptured: Boolean(deviceType),
        fingerprintCaptured: Boolean(deviceFingerprintHash),
      },
    });
  } catch (error) {
    console.error("confirm-inspection-presence error:", error);
    return json(
      { error: (error as Error)?.message || "Unknown error" },
      500
    );
  }
});
