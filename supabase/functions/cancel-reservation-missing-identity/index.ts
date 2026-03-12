import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import Stripe from "npm:stripe@20.3.0";

type JsonRecord = Record<string, unknown>;

type RequestBody = {
  reservationId?: string | null;
};

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

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

function asPositiveNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function extractBearerToken(req: Request): string | null {
  const raw = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function extractUserJwtHeader(req: Request): string | null {
  const raw = req.headers.get("x-ldv-user-jwt") || req.headers.get("x-user-jwt");
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function decodeJwtPayload(token: string): JsonRecord | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload && typeof payload === "object" ? payload as JsonRecord : null;
  } catch {
    return null;
  }
}

function getRequesterContext(req: Request): { userId: string | null; role: string } {
  const token = extractBearerToken(req);
  if (!token) return { userId: null, role: "anon" };

  const payload = decodeJwtPayload(token);
  const role = typeof payload?.role === "string" ? payload.role : "anon";
  const userId = typeof payload?.sub === "string" ? payload.sub.trim() : null;

  return {
    userId: userId || null,
    role: role || "anon",
  };
}

async function resolveRequesterContext(
  admin: SupabaseClient,
  req: Request,
): Promise<{ userId: string | null; role: string }> {
  const customUserJwt = extractUserJwtHeader(req);
  if (customUserJwt) {
    const { data, error } = await admin.auth.getUser(customUserJwt);
    if (error || !data?.user?.id) {
      throw new HttpError("Session utilisateur invalide (JWT). Reconnectez-vous.", 401);
    }

    return {
      userId: data.user.id,
      role: "authenticated",
    };
  }

  const context = getRequesterContext(req);
  if (context.role === "service_role") return context;
  if (!context.userId || context.role === "anon") return context;

  const bearer = extractBearerToken(req);
  if (!bearer) return { userId: null, role: "anon" };

  const { data, error } = await admin.auth.getUser(bearer);
  if (error || !data?.user?.id) {
    throw new HttpError("Session utilisateur invalide (JWT). Reconnectez-vous.", 401);
  }

  return {
    userId: data.user.id,
    role: context.role || "authenticated",
  };
}

async function assertAdminIfNeeded(
  admin: SupabaseClient,
  req: Request,
  requesterContext?: { userId: string | null; role: string },
): Promise<void> {
  const requester = requesterContext || (await resolveRequesterContext(admin, req));
  if (requester.role === "service_role") return;

  if (!requester.userId || requester.role === "anon") {
    throw new HttpError("Acces reserve a l'administration", 403);
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id,is_admin")
    .eq("id", requester.userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(`Verification admin impossible: ${error.message}`, 500);
  }

  if (!data || data.is_admin !== true) {
    throw new HttpError("Acces reserve a l'administration", 403);
  }
}

function extractMissingColumn(errorMessage: string): string | null {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" does not exist/i,
    /column ([a-zA-Z0-9_.]+) does not exist/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match?.[1]) {
      const normalized = String(match[1]).trim().replace(/^"+|"+$/g, "");
      const parts = normalized.split(".");
      return parts[parts.length - 1] || normalized;
    }
  }

  return null;
}

async function tolerantUpdateById(
  admin: SupabaseClient,
  table: string,
  idField: string,
  idValue: string,
  payload: Record<string, unknown>,
): Promise<void> {
  let remaining = { ...payload };

  while (Object.keys(remaining).length > 0) {
    const { error } = await admin
      .from(table)
      .update(remaining)
      .eq(idField, idValue);

    if (!error) return;

    const message = String(error.message || "");
    const missingColumn = extractMissingColumn(message);
    if (!missingColumn || !(missingColumn in remaining)) {
      throw new HttpError(`${table} update failed: ${message || "unknown error"}`, 500);
    }

    delete remaining[missingColumn];
  }
}

function computeReservationRentalDays(startValue: unknown, endValue: unknown): number {
  const startDate = new Date(String(startValue || ""));
  const endDate = new Date(String(endValue || startValue || ""));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 1;
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function eurosToCents(value: number): number {
  return Math.max(0, Math.round(roundMoney(value) * 100));
}

async function readReservation(admin: SupabaseClient, reservationId: string): Promise<JsonRecord> {
  const reservationSelectColumns = [
    "id",
    "status",
    "total_price",
    "start_date",
    "end_date",
    "payment_intent_id",
    "stripe_payment_intent_id",
    "annonce_id",
  ];

  let effectiveColumns = [...reservationSelectColumns];
  let attempts = 0;

  while (attempts < 6) {
    const { data, error } = await admin
      .from("reservations")
      .select(effectiveColumns.join(","))
      .eq("id", reservationId)
      .maybeSingle();

    if (!error) {
      if (!data) throw new HttpError("Reservation introuvable", 404);
      return data as JsonRecord;
    }

    const missingColumn = extractMissingColumn(String(error.message || ""));
    if (missingColumn && effectiveColumns.includes(missingColumn)) {
      effectiveColumns = effectiveColumns.filter((column) => column !== missingColumn);
      attempts += 1;
      continue;
    }

    throw new HttpError(`Reservation read error: ${error.message}`, 500);
  }

  throw new HttpError("Reservation read error: schema reservations incompatible", 500);
}

async function readAnnonceDailyPrice(admin: SupabaseClient, annonceId: string | null): Promise<number | null> {
  if (!annonceId) return null;

  const { data, error } = await admin
    .from("annonces")
    .select("id,prix_jour")
    .eq("id", annonceId)
    .maybeSingle();

  if (error) {
    const missingColumn = extractMissingColumn(String(error.message || ""));
    if (missingColumn === "prix_jour") {
      return null;
    }

    throw new HttpError(`Annonce read error: ${error.message}`, 500);
  }

  return asPositiveNumber((data as JsonRecord | null)?.prix_jour);
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant", 500);
    }

    if (!stripeSecretKey) {
      throw new HttpError("STRIPE_SECRET_KEY manquant", 500);
    }

    const body = (await req.json()) as RequestBody;
    const reservationId = asOptionalString(body?.reservationId);
    if (!reservationId) {
      return json({ error: "reservationId manquant" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const requesterContext = await resolveRequesterContext(admin, req);
    await assertAdminIfNeeded(admin, req, requesterContext);

    const reservation = await readReservation(admin, reservationId);
    const reservationStatus = String(reservation.status || "").trim().toLowerCase();

    if (reservationStatus !== "paid") {
      return json({
        ok: true,
        skipped: true,
        reservationId,
        reason: "Reservation non payee ou deja traitee",
      });
    }

    const totalPriceEuros = Math.max(0, Number(reservation.total_price || 0) || 0);
    const rentalDays = computeReservationRentalDays(reservation.start_date, reservation.end_date);
    const annonceId = asOptionalString(reservation.annonce_id);
    const annonceDailyPrice = await readAnnonceDailyPrice(admin, annonceId);

    const estimatedDailyPrice = annonceDailyPrice
      ?? (rentalDays > 0 ? totalPriceEuros / rentalDays : totalPriceEuros);
    const chargedAmountEuros = roundMoney(Math.min(totalPriceEuros, Math.max(0, estimatedDailyPrice || 0)));
    const refundAmountEuros = roundMoney(Math.max(0, totalPriceEuros - chargedAmountEuros));
    const refundAmountCents = eurosToCents(refundAmountEuros);
    const paymentIntentId = asOptionalString(reservation.payment_intent_id)
      || asOptionalString(reservation.stripe_payment_intent_id);

    let refund: Stripe.Response<Stripe.Refund> | null = null;
    if (refundAmountCents > 0) {
      if (!paymentIntentId) {
        throw new HttpError("Aucun paiement Stripe rattache a la reservation", 409);
      }

      const stripe = new Stripe(stripeSecretKey);
      refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: refundAmountCents,
          metadata: {
            source: "reservation_identity_deadline_cancel",
            reservation_id: reservationId,
          },
        },
        {
          idempotencyKey: `reservation_identity_deadline_${reservationId}_${refundAmountCents}`,
        },
      );
    }

    await tolerantUpdateById(admin, "reservations", "id", reservationId, {
      refund_status: refund ? String(refund.status || "pending") : "not_required",
      refund_amount: refundAmountEuros,
      refunded_at: refund ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });

    return json({
      ok: true,
      skipped: false,
      reservationId,
      chargedAmountEuros,
      refundAmountEuros,
      refundAmountCents,
      refundId: refund?.id || null,
      refundStatus: refund ? String(refund.status || "pending") : "not_required",
    });
  } catch (error) {
    console.error("cancel-reservation-missing-identity error:", error);

    const status = error instanceof HttpError ? error.status : 500;
    return json(
      { error: (error as Error)?.message || "Unknown error" },
      status,
    );
  }
});
