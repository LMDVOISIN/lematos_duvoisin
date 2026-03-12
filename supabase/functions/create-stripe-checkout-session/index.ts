import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import Stripe from "npm:stripe@20.3.0";

type JsonRecord = Record<string, unknown>;
type CautionMode = "cb";

type RequestBody = {
  returnBaseUrl?: string;
  cancelReturnBaseUrl?: string;
  reservationId?: string | number | null;
  equipment?: {
    id?: string | number | null;
    title?: string | null;
    dailyPrice?: number | null;
  };
  bookingDetails?: {
    startDate?: string | null;
    endDate?: string | null;
    rentalDays?: number | null;
    totalAmount?: number | null;
    cautionAmount?: number | null;
    cautionMode?: string | null;
  };
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
  "Content-Type": "application/json"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

function asPositiveNumber(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asOptionalIdentifier(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return null;
}

function normalizeCautionMode(value: unknown): CautionMode {
  void value;
  return "cb";
}

function parseDateLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildReturnUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

function appendRawSessionPlaceholder(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}session_id={CHECKOUT_SESSION_ID}`;
}

function normalizeBaseUrl(candidate?: string | null): string | null {
  const fallback =
    candidate ||
    Deno.env.get("SITE_URL") ||
    Deno.env.get("NEXT_PUBLIC_SITE_URL");

  if (!fallback) return null;

  try {
    const url = new URL(fallback);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const raw = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function extractUserJwtHeader(req: Request): string | null {
  const raw = req.headers.get("x-ldv-user-jwt")
    || req.headers.get("x-user-jwt");
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

function getRequesterUserId(req: Request): string | null {
  const token = extractBearerToken(req);
  if (!token) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  const role = typeof payload?.["role"] === "string" ? String(payload["role"]) : "";
  const userId = typeof payload?.["sub"] === "string" ? String(payload["sub"]).trim() : "";
  if (!userId || role === "anon") {
    return null;
  }

  return userId;
}

async function resolveRequesterUserId(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<string | null> {
  const userJwtHeader = extractUserJwtHeader(req);
  if (userJwtHeader) {
    const { data, error } = await supabaseAdmin.auth.getUser(userJwtHeader);
    if (error || !data?.user?.id) {
      throw new HttpError("Session utilisateur invalide (JWT). Reconnectez-vous.", 401);
    }
    return data.user.id;
  }

  const fallbackUserId = getRequesterUserId(req);
  if (!fallbackUserId) return null;

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
  if (error || !data?.user?.id) {
    throw new HttpError("Session utilisateur invalide (JWT). Reconnectez-vous.", 401);
  }

  return data.user.id;
}

function extractMissingColumn(errorMessage: string): string | null {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" does not exist/i,
    /column ([a-zA-Z0-9_.]+) does not exist/i
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

async function tolerantProfileUpdate(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  let remaining = { ...payload };
  while (Object.keys(remaining).length > 0) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(remaining)
      .eq("id", userId);

    if (!error) return;
    const missingColumn = extractMissingColumn(String(error.message || ""));
    if (!missingColumn || !(missingColumn in remaining)) {
      throw error;
    }
    delete remaining[missingColumn];
  }
}

async function readAnnonceDepositConfig(
  supabaseAdmin: ReturnType<typeof createClient>,
  annonceId: string | null
): Promise<{ cautionAmountEuros: number; cautionMode: CautionMode }> {
  if (!annonceId) {
    return {
      cautionAmountEuros: 0,
      cautionMode: "cb"
    };
  }

  const query = await supabaseAdmin
    .from("annonces")
    .select("id,caution")
    .eq("id", annonceId)
    .maybeSingle();

  if (query?.error) {
    throw new Error(`Erreur lecture annonce ${annonceId}: ${query.error.message}`);
  }

  const annonce = query?.data as JsonRecord | null;
  return {
    cautionAmountEuros: Math.max(0, Number(annonce?.["caution"] || 0) || 0),
    cautionMode: "cb"
  };
}

async function resolveReservationPricing(
  supabaseAdmin: ReturnType<typeof createClient>,
  reservationId: string,
  requesterUserId: string
): Promise<{
  rentalAmountEuros: number;
  cautionAmountEuros: number;
  cautionMode: CautionMode;
  annonceId: string | null;
}> {
  let reservationColumns = [
    "id",
    "total_price",
    "renter_id",
    "caution_amount",
    "caution_mode",
    "annonce_id",
  ];
  let reservationQuery: { data: JsonRecord | null; error: { message?: string } | null } = {
    data: null,
    error: null,
  };
  let attempts = 0;

  while (attempts < 6) {
    const query = await supabaseAdmin
      .from("reservations")
      .select(reservationColumns.join(","))
      .eq("id", reservationId)
      .maybeSingle();

    reservationQuery = {
      data: (query?.data as JsonRecord | null) || null,
      error: query?.error ? { message: query.error.message } : null,
    };

    if (!reservationQuery.error) break;

    const missingColumn = extractMissingColumn(String(reservationQuery?.error?.message || ""));
    if (missingColumn && reservationColumns.includes(missingColumn)) {
      reservationColumns = reservationColumns.filter((column) => column !== missingColumn);
      attempts += 1;
      continue;
    }

    break;
  }

  const { data, error } = reservationQuery;

  if (error) {
    throw new Error(`Erreur lecture reservation ${reservationId}: ${error.message}`);
  }

  if (!data) {
    throw new Error("Reservation introuvable pour le paiement");
  }

  const reservationRenterId = asOptionalString((data as JsonRecord)?.["renter_id"]);
  if (!reservationRenterId || reservationRenterId !== requesterUserId) {
    throw new Error("Reservation non autoris?e pour cet utilisateur");
  }

  const rentalAmountEuros = asPositiveNumber((data as JsonRecord)?.["total_price"]);
  if (!rentalAmountEuros) {
    throw new Error("Montant location invalide pour cette reservation");
  }

  const annonceId = asOptionalIdentifier((data as JsonRecord)?.["annonce_id"]);
  const annonceDepositConfig = await readAnnonceDepositConfig(supabaseAdmin, annonceId);
  const cautionMode = normalizeCautionMode((data as JsonRecord)?.["caution_mode"]);
  let cautionAmountEuros = Math.max(0, Number((data as JsonRecord)?.["caution_amount"] || 0) || 0);

  if (cautionAmountEuros <= 0) {
    cautionAmountEuros = annonceDepositConfig.cautionAmountEuros;
  }

  return {
    rentalAmountEuros,
    cautionAmountEuros,
    cautionMode,
    annonceId
  };
}

async function resolveStripeCustomerId(
  supabaseAdmin: ReturnType<typeof createClient>,
  stripe: Stripe,
  requesterUserId: string | null
): Promise<string | null> {
  if (!requesterUserId) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,pseudo,stripe_customer_id")
    .eq("id", requesterUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const existingCustomerId = asOptionalString((data as JsonRecord)?.["stripe_customer_id"]);
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    email: asOptionalString((data as JsonRecord)?.["email"]) || undefined,
    name: asOptionalString((data as JsonRecord)?.["pseudo"]) || undefined,
    metadata: {
      supabase_user_id: requesterUserId
    }
  });

  try {
    await tolerantProfileUpdate(supabaseAdmin, requesterUserId, {
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.warn("stripe customer id profile update warning:", error);
  }

  return customer.id;
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
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non configure");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
    const requesterUserId = await resolveRequesterUserId(req, supabaseAdmin);

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const body = (await req.json()) as RequestBody;
    const reservationId = body?.reservationId != null ? String(body.reservationId) : null;

    const explicitSuccessReturnBase = normalizeBaseUrl(body?.returnBaseUrl);
    const successReturnBaseUrl = explicitSuccessReturnBase || normalizeBaseUrl();
    if (!successReturnBaseUrl) {
      throw new Error("returnBaseUrl manquant ou invalide");
    }
    const cancelReturnBaseUrl = normalizeBaseUrl(body?.cancelReturnBaseUrl) || successReturnBaseUrl;

    let rentalAmountEuros: number | null = null;
    let cautionMode: CautionMode = "cb";
    let cautionAmountEuros = Math.max(0, Number(body?.bookingDetails?.cautionAmount || 0) || 0);
    let annonceId = asOptionalIdentifier(body?.equipment?.id);
    if (reservationId) {
      if (!requesterUserId) {
        throw new Error("Authentification requise pour cette reservation");
      }
      const pricing = await resolveReservationPricing(
        supabaseAdmin,
        reservationId,
        requesterUserId
      );
      rentalAmountEuros = pricing.rentalAmountEuros;
      cautionAmountEuros = pricing.cautionAmountEuros;
      cautionMode = pricing.cautionMode;
      annonceId = pricing.annonceId;
    } else if (annonceId) {
      const annonceConfig = await readAnnonceDepositConfig(supabaseAdmin, annonceId);
      cautionMode = annonceConfig.cautionMode;
      cautionAmountEuros = annonceConfig.cautionAmountEuros > 0
        ? annonceConfig.cautionAmountEuros
        : cautionAmountEuros;
    }
    if (!rentalAmountEuros) {
      rentalAmountEuros = asPositiveNumber(body?.bookingDetails?.totalAmount);
    }
    if (!rentalAmountEuros) {
      throw new Error("Montant de paiement invalide");
    }

    // Checkout debits only the rental amount. Deposit is handled as a separate card authorization hold.
    const chargeAmountEuros = rentalAmountEuros;
    const amountCents = Math.round(chargeAmountEuros * 100);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error("Montant de paiement invalide (centimes)");
    }

    const equipmentTitle = asOptionalString(body?.equipment?.title) || "Reservation Le Matos du Voisin";
    const startLabel = parseDateLabel(body?.bookingDetails?.startDate);
    const endLabel = parseDateLabel(body?.bookingDetails?.endDate);
    const periodLabel = startLabel && endLabel ? `${startLabel} au ${endLabel}` : null;
    const rentalDays = Math.max(0, Number(body?.bookingDetails?.rentalDays || 0) || 0);

    const descriptionParts = [
      periodLabel ? `Periode: ${periodLabel}` : null,
      rentalDays > 0 ? `${rentalDays} jour${rentalDays > 1 ? "s" : ""}` : null
    ].filter(Boolean);

    const rentalChargeLabel = `Location debitee aujourd'hui: ${rentalAmountEuros.toFixed(2)} EUR`;
    const cautionHoldLabel = cautionAmountEuros > 0
      ? `Empreinte CB de caution: ${cautionAmountEuros.toFixed(2)} EUR autorisee uniquement, sans prelevement`
      : null;
    const checkoutDescription = [
      ...descriptionParts,
      rentalChargeLabel,
      cautionHoldLabel
    ].filter(Boolean).join(" | ");

    const metadata: Record<string, string> = {
      source: "lematos_duvoisin_payment_processing",
      reservation_id: reservationId || "",
      equipment_id: body?.equipment?.id != null ? String(body.equipment.id) : "",
      equipment_title: equipmentTitle.slice(0, 500),
      start_date: startLabel || "",
      end_date: endLabel || "",
      rental_days: rentalDays > 0 ? String(rentalDays) : "",
      total_amount_eur: chargeAmountEuros.toFixed(2),
      rental_amount_eur: rentalAmountEuros.toFixed(2),
      caution_amount_eur: cautionAmountEuros.toFixed(2),
      caution_mode: cautionMode,
      deposit_model: "authorization_hold_not_charged",
      requester_user_id: requesterUserId || ""
    };

    const stripe = new Stripe(stripeSecretKey);
    const stripeCustomerId = await resolveStripeCustomerId(supabaseAdmin, stripe, requesterUserId);

    const successBaseUrl = buildReturnUrl(successReturnBaseUrl, {
      ...(reservationId ? { reservationId } : {}),
      stripeStatus: "success"
    });
    const successUrl = appendRawSessionPlaceholder(successBaseUrl);
    const cancelUrl = buildReturnUrl(cancelReturnBaseUrl, {
      ...(reservationId ? { reservationId } : {}),
      stripeStatus: "cancel"
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      payment_method_types: ["card"],
      customer: stripeCustomerId || undefined,
      customer_creation: (!stripeCustomerId && requesterUserId) ? "always" : undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            product_data: {
              name: equipmentTitle,
              description: checkoutDescription
            }
          }
        }
      ],
      metadata,
      payment_intent_data: {
        metadata,
        setup_future_usage: requesterUserId ? "off_session" : undefined
      }
    });

    if (!session?.url) {
      throw new Error("Stripe Checkout n'a pas retourne d'URL");
    }

    return json({
      ok: true,
      sessionId: session.id,
      url: session.url,
      amountCents,
      cautionMode
    });
  } catch (error) {
    console.error("create-stripe-checkout-session error:", error);
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status);
    }

    const errorMessage = (error as Error)?.message || "Unknown error";
    const loweredMessage = String(errorMessage || "").toLowerCase();
    const isClientError = loweredMessage.includes("montant de paiement invalide")
      || loweredMessage.includes("returnbaseurl")
      || loweredMessage.includes("introuvable")
      || loweredMessage.includes("non autoris?e")
      || loweredMessage.includes("authentification requise");

    return json({
      error: errorMessage
    }, isClientError ? 400 : 500);
  }
});
