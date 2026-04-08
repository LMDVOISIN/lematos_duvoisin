import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import Stripe from "npm:stripe@20.3.0";

type JsonRecord = Record<string, unknown>;

type RequestBody = {
  returnBaseUrl?: string;
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
  };
};

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

async function resolveReservationAmountEuros(reservationId: string): Promise<number | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select("id,total_price")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erreur lecture reservation ${reservationId}: ${error.message}`);
  }

  if (!data) {
    throw new Error("Reservation introuvable pour le paiement");
  }

  return asPositiveNumber((data as JsonRecord)?.["total_price"]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const body = (await req.json()) as RequestBody;
    const reservationId = body?.reservationId != null ? String(body.reservationId) : null;

    const explicitReturnBase = normalizeBaseUrl(body?.returnBaseUrl);
    const returnBaseUrl = explicitReturnBase || normalizeBaseUrl();
    if (!returnBaseUrl) {
      throw new Error("returnBaseUrl manquant ou invalide");
    }

    let amountEuros: number | null = null;
    if (reservationId) {
      amountEuros = await resolveReservationAmountEuros(reservationId);
    }
    if (!amountEuros) {
      amountEuros = asPositiveNumber(body?.bookingDetails?.totalAmount);
    }
    if (!amountEuros) {
      throw new Error("Montant de paiement invalide");
    }

    const amountCents = Math.round(amountEuros * 100);
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

    const metadata: Record<string, string> = {
      source: "lematos_duvoisin_payment_processing",
      reservation_id: reservationId || "",
      equipment_id: body?.equipment?.id != null ? String(body.equipment.id) : "",
      equipment_title: equipmentTitle.slice(0, 500),
      start_date: startLabel || "",
      end_date: endLabel || "",
      rental_days: rentalDays > 0 ? String(rentalDays) : "",
      total_amount_eur: amountEuros.toFixed(2),
      caution_amount_eur: Number(body?.bookingDetails?.cautionAmount || 0).toFixed(2)
    };

    const stripe = new Stripe(stripeSecretKey);

    const successUrl = buildReturnUrl(returnBaseUrl, {
      ...(reservationId ? { reservationId } : {}),
      stripeStatus: "success",
      session_id: "{CHECKOUT_SESSION_ID}"
    });
    const cancelUrl = buildReturnUrl(returnBaseUrl, {
      ...(reservationId ? { reservationId } : {}),
      stripeStatus: "cancel"
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      payment_method_types: ["card"],
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
              description: descriptionParts.length > 0 ? descriptionParts.join(" | ") : undefined
            }
          }
        }
      ],
      metadata,
      payment_intent_data: {
        metadata
      }
    });

    if (!session?.url) {
      throw new Error("Stripe Checkout n'a pas retourne d'URL");
    }

    return json({
      ok: true,
      sessionId: session.id,
      url: session.url,
      amountCents
    });
  } catch (error) {
    console.error("create-stripe-checkout-session error:", error);
    return json({
      error: (error as Error)?.message || "Unknown error"
    }, 500);
  }
});
