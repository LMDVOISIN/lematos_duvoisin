import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import Stripe from "npm:stripe@20.3.0";

type JsonRecord = Record<string, unknown>;
type CautionMode = "cb";

type RequestBody = {
  action?: "sync_checkout" | "rotate_due" | "settle";
  reservationId?: string | null;
  sessionId?: string | null;
  decision?: "capture" | "release" | null;
  amountCents?: number | null;
  limit?: number | null;
  safetyHours?: number | null;
};

type StrategyRow = {
  id: number;
  reservation_id: string;
  renter_user_id: string;
  status: string;
  deposit_amount_cents: number;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
  current_payment_intent_id: string | null;
  current_capture_before: string | null;
  hold_required_from: string;
  hold_required_until: string;
  next_reauthorization_due_at: string;
  cycle_index: number;
  metadata: JsonRecord | null;
};

type ExistingStrategyLookup = {
  row: StrategyRow | null;
  tableMissing: boolean;
};

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const DEFAULT_SAFETY_HOURS = 12;
const DEFAULT_HOLD_WINDOW_BEFORE_START_HOURS = 12;
const DEFAULT_DISPUTE_WINDOW_HOURS = 24;

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

function normalizeCautionMode(value: unknown): CautionMode {
  void value;
  return "cb";
}

function asOptionalInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function asPositiveInteger(value: unknown): number | null {
  const n = asOptionalInteger(value);
  if (n === null || n <= 0) return null;
  return n;
}

function parseIsoDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isoNow(): string {
  return new Date().toISOString();
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + (hours * 60 * 60 * 1000));
}

function subtractHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - (hours * 60 * 60 * 1000));
}

function maxDate(left: Date, right: Date): Date {
  return left.getTime() >= right.getTime() ? left : right;
}

function sanitizeSafetyHours(rawValue: unknown): number {
  const parsed = asOptionalInteger(rawValue);
  if (parsed === null) return DEFAULT_SAFETY_HOURS;
  return Math.min(Math.max(parsed, 1), 48);
}

function sanitizeLimit(rawValue: unknown): number {
  const parsed = asOptionalInteger(rawValue);
  if (parsed === null) return 50;
  return Math.min(Math.max(parsed, 1), 200);
}

function parseCaptureBefore(paymentIntent: Stripe.PaymentIntent): string | null {
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge || typeof latestCharge === "string") return null;

  const cardDetails = (latestCharge.payment_method_details as JsonRecord | null)?.card as JsonRecord | undefined;
  const captureBefore = Number(cardDetails?.capture_before || 0);
  if (!Number.isFinite(captureBefore) || captureBefore <= 0) return null;

  return new Date(captureBefore * 1000).toISOString();
}

function computeNextReauthDue(captureBeforeIso: string, safetyHours: number): string {
  const captureBefore = parseIsoDate(captureBeforeIso);
  const now = new Date();
  if (!captureBefore) {
    return addHours(now, 6).toISOString();
  }

  const candidate = subtractHours(captureBefore, safetyHours);
  const floor = addHours(now, 0.1); // ~6 min anti-loop floor
  return maxDate(candidate, floor).toISOString();
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

function extractMissingTable(errorMessage: string): string | null {
  const patterns = [
    /Could not find the table '([^']+)'/i,
    /relation "([^"]+)" does not exist/i,
    /relation ([a-zA-Z0-9_.]+) does not exist/i,
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

function isMissingTableError(errorMessage: string, expectedTableName: string): boolean {
  const missingTable = extractMissingTable(String(errorMessage || ""));
  return missingTable === expectedTableName;
}

async function readExistingStrategyRow(
  admin: SupabaseClient,
  reservationId: string,
): Promise<ExistingStrategyLookup> {
  const { data, error } = await admin
    .from("reservation_deposit_strategy_b")
    .select("*")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  const tableMissing = Boolean(
    error?.message
    && isMissingTableError(String(error.message), "reservation_deposit_strategy_b")
  );

  if (error && !tableMissing) {
    throw new Error(`Strategy read error: ${error.message}`);
  }

  return {
    row: (!tableMissing && data) ? data as StrategyRow : null,
    tableMissing,
  };
}

function mapStrategyStatusForSync(status: unknown): "authorized" | "captured" | "released" | "failed" {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (normalizedStatus === "active" || normalizedStatus === "scheduled") {
    return "authorized";
  }
  if (normalizedStatus === "captured") {
    return "captured";
  }
  if (normalizedStatus === "released") {
    return "released";
  }
  return "failed";
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
      throw new Error(`${table} update failed: ${message || "unknown error"}`);
    }

    delete remaining[missingColumn];
  }
}

async function assertAdminIfNeeded(
  admin: SupabaseClient,
  req: Request,
  requesterContext?: { userId: string | null; role: string },
): Promise<void> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const customUserJwt = extractUserJwtHeader(req);
  if (!authHeader && !customUserJwt) {
    throw new Error("Authentification requise");
  }

  const requester = requesterContext || (await resolveRequesterContext(admin, req));
  if (requester.role === "service_role") return;

  if (!requester.userId || requester.role === "anon") {
    throw new Error("Acces reserve ? l?administration");
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id,is_admin")
    .eq("id", requester.userId)
    .maybeSingle();

  if (error) throw new Error(`V?rification admin impossible: ${error.message}`);
  if (!data || data.is_admin !== true) {
    throw new Error("Acces reserve ? l?administration");
  }
}

async function assertCanSettleReservation(
  admin: SupabaseClient,
  req: Request,
  reservationId: string,
  requesterContext?: { userId: string | null; role: string },
): Promise<void> {
  const requester = requesterContext || (await resolveRequesterContext(admin, req));
  if (requester.role === "service_role") return;
  if (!requester.userId || requester.role === "anon") {
    throw new Error("Acces reserve ? la moderation caution");
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,is_admin")
    .eq("id", requester.userId)
    .maybeSingle();
  if (profileError) throw new Error(`V?rification profil impossible: ${profileError.message}`);

  if (profile?.is_admin === true) return;

  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select("id,owner_id,renter_id")
    .eq("id", reservationId)
    .maybeSingle();
  if (reservationError) throw new Error(`V?rification reservation impossible: ${reservationError.message}`);

  const ownerId = asOptionalString((reservation as JsonRecord | null)?.owner_id);
  const renterId = asOptionalString((reservation as JsonRecord | null)?.renter_id);
  if (ownerId && ownerId === requester.userId) {
    return;
  }

  if (renterId && renterId === requester.userId) {
    const { data: settlement, error: settlementError } = await admin
      .from("reservation_inspection_settlements")
      .select("status")
      .eq("reservation_id", reservationId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settlementError) {
      throw new Error(`V?rification settlement impossible: ${settlementError.message}`);
    }

    const settlementStatus = String((settlement as JsonRecord | null)?.status || "").toLowerCase();
    if (["released_no_dispute", "released_after_moderation"]?.includes(settlementStatus)) {
      return;
    }
  }

  throw new Error("Acces reserve au propri?taire ou ? l?administration");
}

async function readReservation(admin: SupabaseClient, reservationId: string) {
  const reservationSelectColumns = [
    "id",
    "renter_id",
    "owner_id",
    "annonce_id",
    "start_date",
    "end_date",
    "caution_amount",
    "caution_mode",
    "mode_caution",
    "status",
    "payment_intent_id",
    "stripe_payment_intent_id",
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
      if (!data) throw new Error("Reservation introuvable");
      return data as JsonRecord;
    }

    const missingColumn = extractMissingColumn(String(error.message || ""));
    if (missingColumn && effectiveColumns.includes(missingColumn)) {
      effectiveColumns = effectiveColumns.filter((column) => column !== missingColumn);
      attempts += 1;
      continue;
    }

    throw new Error(`Reservation read error: ${error.message}`);
  }

  throw new Error("Reservation read error: schema reservations incompatible");
}

async function readAnnonceDepositConfig(
  admin: SupabaseClient,
  annonceId: unknown,
): Promise<{ cautionAmount: number; cautionMode: CautionMode }> {
  if (!annonceId) {
    return { cautionAmount: 0, cautionMode: "cb" };
  }

  const query = await admin
    .from("annonces")
    .select("id,caution")
    .eq("id", String(annonceId))
    .maybeSingle();

  if (query?.error) throw new Error(`Annonce read error: ${query.error.message}`);
  const annonce = query.data as JsonRecord | null;
  return {
    cautionAmount: Number(annonce?.caution || 0) || 0,
    cautionMode: "cb",
  };
}

function getHoldWindowFromReservation(reservation: JsonRecord): {
  holdRequiredFromIso: string;
  holdRequiredUntilIso: string;
} {
  const now = new Date();
  const startDate = parseIsoDate(reservation.start_date) || now;
  const endDate = parseIsoDate(reservation.end_date) || startDate;

  const holdRequiredFrom = maxDate(now, subtractHours(startDate, DEFAULT_HOLD_WINDOW_BEFORE_START_HOURS));
  const holdRequiredUntil = addHours(endDate, DEFAULT_DISPUTE_WINDOW_HOURS);

  return {
    holdRequiredFromIso: holdRequiredFrom.toISOString(),
    holdRequiredUntilIso: holdRequiredUntil.toISOString(),
  };
}

type AuthorizationResult =
  | {
    status: "active";
    paymentIntentId: string;
    captureBeforeIso: string;
    rawStatus: string;
  }
  | {
    status: "requires_action";
    paymentIntentId: string | null;
    errorCode: string;
    errorMessage: string;
  }
  | {
    status: "failed";
    paymentIntentId: string | null;
    errorCode: string;
    errorMessage: string;
  };

async function createManualDepositAuthorization(
  stripe: Stripe,
  params: {
    reservationId: string;
    renterUserId: string;
    amountCents: number;
    stripeCustomerId: string;
    stripePaymentMethodId: string;
    cycleIndex: number;
    reason: "initial" | "rotation";
  },
): Promise<AuthorizationResult> {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: params.amountCents,
      currency: "eur",
      customer: params.stripeCustomerId,
      payment_method: params.stripePaymentMethodId,
      payment_method_types: ["card"],
      capture_method: "manual",
      confirm: true,
      off_session: true,
      description: `Empreinte caution reservation ${params.reservationId}`,
      metadata: {
        source: "reservation_deposit_strategy_b",
        reservation_id: params.reservationId,
        renter_user_id: params.renterUserId,
        cycle_index: String(params.cycleIndex),
        reason: params.reason,
      },
      expand: ["latest_charge"],
    }, {
      idempotencyKey: `deposit_${params.reservationId}_${params.cycleIndex}_${params.reason}`,
    });

    if (paymentIntent.status === "requires_capture") {
      const captureBeforeIso = parseCaptureBefore(paymentIntent) || addHours(new Date(), 5 * 24).toISOString();
      return {
        status: "active",
        paymentIntentId: paymentIntent.id,
        captureBeforeIso,
        rawStatus: paymentIntent.status,
      };
    }

    if (paymentIntent.status === "requires_action") {
      return {
        status: "requires_action",
        paymentIntentId: paymentIntent.id,
        errorCode: "requires_action",
        errorMessage: "Authentification client requise pour la nouvelle empreinte.",
      };
    }

    return {
      status: "failed",
      paymentIntentId: paymentIntent.id,
      errorCode: `status_${paymentIntent.status}`,
      errorMessage: `Etat Stripe inattendu: ${paymentIntent.status}`,
    };
  } catch (error) {
    const stripeError = error as Stripe.StripeError & {
      raw?: JsonRecord;
      payment_intent?: Stripe.PaymentIntent;
    };
    const errorCode = String(stripeError?.code || stripeError?.raw?.code || "stripe_error");
    const errorMessage = String(stripeError?.message || "Erreur Stripe lors de la creation d?empreinte");

    const embeddedIntent = stripeError?.payment_intent || (stripeError?.raw?.payment_intent as Stripe.PaymentIntent | undefined);
    const paymentIntentId = embeddedIntent?.id || null;

    if (errorCode === "authentication_required") {
      return {
        status: "requires_action",
        paymentIntentId,
        errorCode,
        errorMessage,
      };
    }

    return {
      status: "failed",
      paymentIntentId,
      errorCode,
      errorMessage,
    };
  }
}

async function cancelPaymentIntentIfOpen(stripe: Stripe, paymentIntentId: string | null): Promise<void> {
  if (!paymentIntentId) return;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const cancellableStatuses = new Set([
      "requires_payment_method",
      "requires_confirmation",
      "requires_action",
      "requires_capture",
      "processing",
    ]);

    if (!cancellableStatuses.has(paymentIntent.status)) return;
    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch (error) {
    const stripeError = error as Stripe.StripeError;
    if (stripeError?.code === "resource_missing") return;
    throw error;
  }
}

async function insertStrategyEvent(
  admin: SupabaseClient,
  payload: {
    strategyId: number | null;
    reservationId: string;
    cycleIndex: number;
    eventType: string;
    stripePaymentIntentId?: string | null;
    captureBefore?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: JsonRecord;
  },
) {
  const { error } = await admin
    .from("reservation_deposit_strategy_b_events")
    .insert({
      strategy_id: payload.strategyId,
      reservation_id: payload.reservationId,
      cycle_index: payload.cycleIndex,
      event_type: payload.eventType,
      stripe_payment_intent_id: payload.stripePaymentIntentId || null,
      capture_before: payload.captureBefore || null,
      error_code: payload.errorCode || null,
      error_message: payload.errorMessage || null,
      metadata: payload.metadata || {},
      created_at: isoNow(),
    });

  if (error) {
    console.warn("strategy event insert warning:", error.message);
  }
}

async function buildStripePaymentContext(
  stripe: Stripe,
  sessionId: string,
): Promise<{
  session: Stripe.Checkout.Session;
  paymentIntent: Stripe.PaymentIntent;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
}> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "customer"],
  });

  if (!session || session.mode !== "payment") {
    throw new Error("Session Stripe invalide pour ce parcours.");
  }

  if (session.payment_status !== "paid") {
    throw new Error(`Session Stripe non payee (${session.payment_status}).`);
  }

  const paymentIntentRef = session.payment_intent;
  const paymentIntentId = typeof paymentIntentRef === "string"
    ? paymentIntentRef
    : paymentIntentRef?.id;

  if (!paymentIntentId) {
    throw new Error("PaymentIntent Stripe introuvable sur la session.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const stripeCustomerId = (
    (typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer?.id)
    || (typeof session.customer === "string" ? session.customer : session.customer?.id)
    || ""
  ).trim();
  if (!stripeCustomerId) {
    throw new Error("Client Stripe manquant sur le paiement.");
  }

  const stripePaymentMethodId = (
    (typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : paymentIntent.payment_method?.id)
    || ""
  ).trim();
  if (!stripePaymentMethodId) {
    throw new Error("Moyen de paiement Stripe manquant pour la caution.");
  }

  return {
    session,
    paymentIntent,
    stripeCustomerId,
    stripePaymentMethodId,
  };
}

async function actionSyncCheckout(
  admin: SupabaseClient,
  stripe: Stripe,
  requesterUserId: string,
  body: RequestBody,
) {
  const reservationId = asOptionalString(body.reservationId);
  const sessionId = asOptionalString(body.sessionId);
  if (!reservationId) throw new Error("reservationId manquant");
  if (!sessionId) throw new Error("sessionId manquant");

  const reservation = await readReservation(admin, reservationId);
  const renterId = asOptionalString(reservation.renter_id);
  if (!renterId || renterId !== requesterUserId) {
    throw new Error("Reservation non autoris?e pour cet utilisateur.");
  }

  const stripeContext = await buildStripePaymentContext(stripe, sessionId);
  const sessionReservationId = asOptionalString(stripeContext.session.metadata?.reservation_id);
  if (sessionReservationId && sessionReservationId !== reservationId) {
    throw new Error("Session Stripe non coherente avec la reservation.");
  }

  await tolerantUpdateById(admin, "reservations", "id", reservationId, {
    status: "paid",
    paid_at: isoNow(),
    stripe_payment_intent_id: stripeContext.paymentIntent.id,
    payment_intent_id: stripeContext.paymentIntent.id,
    stripe_payment_status: "succeeded",
    tenant_payment_paid_at: isoNow(),
    updated_at: isoNow(),
  });

  await tolerantUpdateById(admin, "profiles", "id", requesterUserId, {
    stripe_customer_id: stripeContext.stripeCustomerId,
    updated_at: isoNow(),
  });

  const annonceDepositConfig = await readAnnonceDepositConfig(admin, reservation.annonce_id);
  const reservationCautionModeRaw = asOptionalString(reservation.caution_mode)
    || asOptionalString(reservation.mode_caution);
  const cautionMode = reservationCautionModeRaw
    ? normalizeCautionMode(reservationCautionModeRaw)
    : annonceDepositConfig.cautionMode;
  const cautionFromReservation = Number(reservation.caution_amount || 0) || 0;
  const cautionFromAnnonce = annonceDepositConfig.cautionAmount;
  const cautionAmountEuros = cautionFromReservation > 0 ? cautionFromReservation : cautionFromAnnonce;
  const depositAmountCents = Math.round(cautionAmountEuros * 100);
  const existingStrategyLookup = await readExistingStrategyRow(admin, reservationId);
  const existingStrategy = existingStrategyLookup.row;
  const existingCheckoutSessionId = asOptionalString((existingStrategy?.metadata || {})?.checkout_session_id);
  const existingRentalPaymentIntentId = asOptionalString((existingStrategy?.metadata || {})?.rental_payment_intent_id);

  if (
    existingStrategy
    && existingStrategy.current_payment_intent_id
    && (
      existingCheckoutSessionId === stripeContext.session.id
      || existingRentalPaymentIntentId === stripeContext.paymentIntent.id
    )
  ) {
    return {
      ok: true,
      reservationId,
      paymentIntentId: stripeContext.paymentIntent.id,
      authorizationPaymentIntentId: existingStrategy.current_payment_intent_id,
      strategyStatus: mapStrategyStatusForSync(existingStrategy.status),
      strategyTableMissing: existingStrategyLookup.tableMissing,
      cautionMode,
      depositAmountCents: Number(existingStrategy.deposit_amount_cents || depositAmountCents || 0) || 0,
      holdRequiredFrom: existingStrategy.hold_required_from,
      holdRequiredUntil: existingStrategy.hold_required_until,
      captureBefore: existingStrategy.current_capture_before,
    };
  }

  if (!Number.isFinite(depositAmountCents) || depositAmountCents <= 0) {
    await tolerantUpdateById(admin, "reservations", "id", reservationId, {
      caution_mode: cautionMode,
      deposit_status: "none",
      deposit_refund_status: "not_required",
      updated_at: isoNow(),
    });

    return {
      ok: true,
      reservationId,
      paymentIntentId: stripeContext.paymentIntent.id,
      strategyStatus: "not_required",
      depositAmountCents: 0,
      cautionMode,
    };
  }

  const { holdRequiredFromIso, holdRequiredUntilIso } = getHoldWindowFromReservation(reservation);

  const authorization = await createManualDepositAuthorization(stripe, {
    reservationId,
    renterUserId: renterId,
    amountCents: depositAmountCents,
    stripeCustomerId: stripeContext.stripeCustomerId,
    stripePaymentMethodId: stripeContext.stripePaymentMethodId,
    cycleIndex: 1,
    reason: "initial",
  });

  const authorizationActive = authorization.status === "active";
  const strategyStatus = authorizationActive
    ? "active"
    : authorization.status === "requires_action"
      ? "reauth_required"
      : "failed";
  const nextReauthorizationDueAt = authorizationActive
    ? computeNextReauthDue(authorization.captureBeforeIso, DEFAULT_SAFETY_HOURS)
    : holdRequiredFromIso;
  const authorizationIntentId = authorization.paymentIntentId || null;
  const authorizationErrorCode = authorizationActive ? null : authorization.errorCode;
  const authorizationErrorMessage = authorizationActive ? null : authorization.errorMessage;

  const basePayload = {
    reservation_id: reservationId,
    renter_user_id: renterId,
    strategy: "strategy_b",
    status: strategyStatus,
    currency: "eur",
    deposit_amount_cents: depositAmountCents,
    stripe_customer_id: stripeContext.stripeCustomerId,
    stripe_payment_method_id: stripeContext.stripePaymentMethodId,
    current_payment_intent_id: authorizationIntentId,
    current_capture_before: authorizationActive ? authorization.captureBeforeIso : null,
    hold_required_from: holdRequiredFromIso,
    hold_required_until: holdRequiredUntilIso,
    next_reauthorization_due_at: nextReauthorizationDueAt,
    last_rotation_at: authorizationActive ? isoNow() : null,
    cycle_index: 1,
    reauth_required_at: authorization.status === "requires_action" ? isoNow() : null,
    released_at: null,
    captured_at: null,
    last_error_code: authorizationErrorCode,
    last_error_message: authorizationErrorMessage,
    metadata: {
      source: "checkout_sync",
      checkout_session_id: stripeContext.session.id,
      rental_payment_intent_id: stripeContext.paymentIntent.id,
      deposit_model: "authorization_hold_not_charged",
      caution_mode: cautionMode,
      authorization_status: authorization.status,
    },
    updated_at: isoNow(),
  };

  const { data: upserted, error: upsertError } = await admin
    .from("reservation_deposit_strategy_b")
    .upsert(basePayload, { onConflict: "reservation_id" })
    .select("*")
    .single();

  const strategyTableMissing = Boolean(
    upsertError?.message
    && isMissingTableError(String(upsertError.message), "reservation_deposit_strategy_b")
  );

  if (upsertError && !strategyTableMissing) {
    throw new Error(`Strategy B upsert error: ${upsertError.message}`);
  }

  if (strategyTableMissing) {
    console.warn("Strategy table missing: fallback mode enabled for sync_checkout");
  }

  if (!strategyTableMissing && upserted) {
    const strategy = upserted as StrategyRow;
    await insertStrategyEvent(admin, {
      strategyId: strategy.id,
      reservationId,
      cycleIndex: 1,
      eventType: authorizationActive ? "authorization_created" : "authorization_failed",
      stripePaymentIntentId: authorizationIntentId,
      captureBefore: authorizationActive ? authorization.captureBeforeIso : null,
      errorCode: authorizationErrorCode,
      errorMessage: authorizationErrorMessage,
      metadata: authorizationActive
        ? {
          hold_required_from: holdRequiredFromIso,
          hold_required_until: holdRequiredUntilIso,
          source: "sync_checkout_initial_authorization",
        }
        : {
          source: "sync_checkout_initial_authorization",
          authorization_status: authorization.status,
        },
    });
  }

  if (!authorizationActive) {
    await tolerantUpdateById(admin, "reservations", "id", reservationId, {
      caution_mode: cautionMode,
      deposit_status: "pending",
      deposit_refund_status: "pending",
      deposit_refunded_at: null,
      deposit_refund_id: null,
      deposit_refunded_amount_cents: null,
      deposit_last_refund_error: `${authorizationErrorCode || "authorization_failed"}: ${authorizationErrorMessage || "Empreinte caution non active"}`,
      updated_at: isoNow(),
    });

    return {
      ok: true,
      reservationId,
      paymentIntentId: stripeContext.paymentIntent.id,
      strategyStatus: "failed",
      strategyTableMissing,
      cautionMode,
      depositAmountCents,
      holdRequiredFrom: holdRequiredFromIso,
      holdRequiredUntil: holdRequiredUntilIso,
      authorizationStatus: authorization.status,
      authorizationErrorCode,
      authorizationErrorMessage,
    };
  }

  await tolerantUpdateById(admin, "reservations", "id", reservationId, {
    caution_mode: cautionMode,
    deposit_status: "authorized",
    deposit_refund_status: "pending",
    deposit_refunded_at: null,
    deposit_refund_id: null,
    deposit_refunded_amount_cents: null,
    deposit_last_refund_error: null,
    updated_at: isoNow(),
  });

  return {
    ok: true,
    reservationId,
    paymentIntentId: stripeContext.paymentIntent.id,
    authorizationPaymentIntentId: authorizationIntentId,
    strategyStatus: "authorized",
    strategyTableMissing,
    cautionMode,
    depositAmountCents,
    holdRequiredFrom: holdRequiredFromIso,
    holdRequiredUntil: holdRequiredUntilIso,
    captureBefore: authorization.captureBeforeIso,
  };
}

async function actionRotateDue(
  admin: SupabaseClient,
  stripe: Stripe,
  body: RequestBody,
) {
  const reservationId = asOptionalString(body.reservationId);
  const limit = sanitizeLimit(body.limit);
  const safetyHours = sanitizeSafetyHours(body.safetyHours);
  const nowIso = isoNow();

  let query = admin
    .from("reservation_deposit_strategy_b")
    .select("*")
    .in("status", ["scheduled", "active", "reauth_required", "failed"])
    .lte("next_reauthorization_due_at", nowIso)
    .order("next_reauthorization_due_at", { ascending: true })
    .limit(limit);

  if (reservationId) {
    query = query.eq("reservation_id", reservationId);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(String(error.message || ""), "reservation_deposit_strategy_b")) {
      return {
        ok: true,
        processed: 0,
        rotated: 0,
        reauthRequired: 0,
        failed: 0,
        expired: 0,
        skipped: 0,
        strategyTableMissing: true,
        reservations: [],
      };
    }
    throw new Error(`Rotation query error: ${error.message}`);
  }

  const rows = (data || []) as StrategyRow[];
  const results = {
    processed: 0,
    rotated: 0,
    reauthRequired: 0,
    failed: 0,
    expired: 0,
    skipped: 0,
    reservations: [] as Array<Record<string, unknown>>,
  };

  for (const row of rows) {
    results.processed += 1;
    const now = new Date();
    const holdRequiredFrom = parseIsoDate(row.hold_required_from) || now;
    const holdRequiredUntil = parseIsoDate(row.hold_required_until) || now;

    if (now > holdRequiredUntil) {
      await cancelPaymentIntentIfOpen(stripe, row.current_payment_intent_id);

      await admin
        .from("reservation_deposit_strategy_b")
        .update({
          status: "expired",
          current_payment_intent_id: null,
          current_capture_before: null,
          next_reauthorization_due_at: holdRequiredUntil.toISOString(),
          last_error_code: null,
          last_error_message: null,
          updated_at: isoNow(),
        })
        .eq("id", row.id);

      await insertStrategyEvent(admin, {
        strategyId: row.id,
        reservationId: row.reservation_id,
        cycleIndex: row.cycle_index,
        eventType: "authorization_expired",
        metadata: { source: "rotate_due" },
      });

      results.expired += 1;
      results.reservations.push({
        reservationId: row.reservation_id,
        status: "expired",
      });
      continue;
    }

    if (now < holdRequiredFrom) {
      await admin
        .from("reservation_deposit_strategy_b")
        .update({
          status: "scheduled",
          next_reauthorization_due_at: holdRequiredFrom.toISOString(),
          updated_at: isoNow(),
        })
        .eq("id", row.id);

      results.skipped += 1;
      results.reservations.push({
        reservationId: row.reservation_id,
        status: "scheduled",
        reason: "hold_window_not_started",
      });
      continue;
    }

    await cancelPaymentIntentIfOpen(stripe, row.current_payment_intent_id);

    const nextCycleIndex = Number(row.cycle_index || 0) + 1;
    const authResult = await createManualDepositAuthorization(stripe, {
      reservationId: row.reservation_id,
      renterUserId: row.renter_user_id,
      amountCents: Number(row.deposit_amount_cents || 0),
      stripeCustomerId: row.stripe_customer_id,
      stripePaymentMethodId: row.stripe_payment_method_id,
      cycleIndex: nextCycleIndex,
      reason: "rotation",
    });

    if (authResult.status === "active") {
      const nextDue = computeNextReauthDue(authResult.captureBeforeIso, safetyHours);
      await admin
        .from("reservation_deposit_strategy_b")
        .update({
          status: "active",
          current_payment_intent_id: authResult.paymentIntentId,
          current_capture_before: authResult.captureBeforeIso,
          next_reauthorization_due_at: nextDue,
          cycle_index: nextCycleIndex,
          last_rotation_at: isoNow(),
          reauth_required_at: null,
          last_error_code: null,
          last_error_message: null,
          updated_at: isoNow(),
        })
        .eq("id", row.id);

      await tolerantUpdateById(admin, "reservations", "id", row.reservation_id, {
        deposit_status: "authorized",
        updated_at: isoNow(),
      });

      await insertStrategyEvent(admin, {
        strategyId: row.id,
        reservationId: row.reservation_id,
        cycleIndex: nextCycleIndex,
        eventType: "authorization_rotated",
        stripePaymentIntentId: authResult.paymentIntentId,
        captureBefore: authResult.captureBeforeIso,
        metadata: { source: "rotate_due" },
      });

      results.rotated += 1;
      results.reservations.push({
        reservationId: row.reservation_id,
        status: "active",
        captureBefore: authResult.captureBeforeIso,
        nextReauthorizationDueAt: nextDue,
      });
      continue;
    }

    if (authResult.status === "requires_action") {
      await admin
        .from("reservation_deposit_strategy_b")
        .update({
          status: "reauth_required",
          current_payment_intent_id: authResult.paymentIntentId,
          current_capture_before: null,
          next_reauthorization_due_at: addHours(new Date(), 6).toISOString(),
          cycle_index: nextCycleIndex,
          reauth_required_at: isoNow(),
          last_error_code: authResult.errorCode,
          last_error_message: authResult.errorMessage,
          updated_at: isoNow(),
        })
        .eq("id", row.id);

      await tolerantUpdateById(admin, "reservations", "id", row.reservation_id, {
        deposit_status: "pending",
        updated_at: isoNow(),
      });

      await insertStrategyEvent(admin, {
        strategyId: row.id,
        reservationId: row.reservation_id,
        cycleIndex: nextCycleIndex,
        eventType: "requires_action",
        stripePaymentIntentId: authResult.paymentIntentId,
        errorCode: authResult.errorCode,
        errorMessage: authResult.errorMessage,
        metadata: { source: "rotate_due" },
      });

      results.reauthRequired += 1;
      results.reservations.push({
        reservationId: row.reservation_id,
        status: "reauth_required",
        errorCode: authResult.errorCode,
      });
      continue;
    }

    await admin
      .from("reservation_deposit_strategy_b")
      .update({
        status: "failed",
        current_payment_intent_id: authResult.paymentIntentId,
        current_capture_before: null,
        next_reauthorization_due_at: addHours(new Date(), 6).toISOString(),
        cycle_index: nextCycleIndex,
        last_error_code: authResult.errorCode,
        last_error_message: authResult.errorMessage,
        updated_at: isoNow(),
      })
      .eq("id", row.id);

    await tolerantUpdateById(admin, "reservations", "id", row.reservation_id, {
      deposit_status: "pending",
      updated_at: isoNow(),
    });

    await insertStrategyEvent(admin, {
      strategyId: row.id,
      reservationId: row.reservation_id,
      cycleIndex: nextCycleIndex,
      eventType: "failed",
      stripePaymentIntentId: authResult.paymentIntentId,
      errorCode: authResult.errorCode,
      errorMessage: authResult.errorMessage,
      metadata: { source: "rotate_due" },
    });

    results.failed += 1;
    results.reservations.push({
      reservationId: row.reservation_id,
      status: "failed",
      errorCode: authResult.errorCode,
    });
  }

  return {
    ok: true,
    ...results,
  };
}

async function actionSettle(
  admin: SupabaseClient,
  stripe: Stripe,
  body: RequestBody,
) {
  const reservationId = asOptionalString(body.reservationId);
  const decision = asOptionalString(body.decision)?.toLowerCase();
  const amountCents = asPositiveInteger(body.amountCents);

  if (!reservationId) throw new Error("reservationId manquant");
  if (!decision || !["capture", "release"].includes(decision)) {
    throw new Error("decision invalide (capture|release)");
  }

  const reservation = await readReservation(admin, reservationId);
  const rentalPaymentIntentId = asOptionalString(reservation.stripe_payment_intent_id)
    || asOptionalString(reservation.payment_intent_id);
  const annonceDepositConfig = await readAnnonceDepositConfig(admin, reservation.annonce_id);
  const reservationCautionModeRaw = asOptionalString(reservation.caution_mode)
    || asOptionalString(reservation.mode_caution);
  const cautionMode = reservationCautionModeRaw
    ? normalizeCautionMode(reservationCautionModeRaw)
    : annonceDepositConfig.cautionMode;
  const cautionFromReservation = Number(reservation.caution_amount || 0) || 0;
  const cautionFromAnnonce = annonceDepositConfig.cautionAmount;
  const depositAmountCents = Math.round((cautionFromReservation > 0 ? cautionFromReservation : cautionFromAnnonce) * 100);

  const { data, error } = await admin
    .from("reservation_deposit_strategy_b")
    .select("*")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  const strategyTableMissing = Boolean(
    error?.message
    && isMissingTableError(String(error.message), "reservation_deposit_strategy_b")
  );
  if (error && !strategyTableMissing) throw new Error(`Strategy read error: ${error.message}`);
  const strategy = (!strategyTableMissing && data) ? data as StrategyRow : null;
  const holdPaymentIntentId = asOptionalString(strategy?.current_payment_intent_id);

  if (decision === "capture") {
    if (!Number.isFinite(depositAmountCents) || depositAmountCents <= 0) {
      await tolerantUpdateById(admin, "reservations", "id", reservationId, {
        deposit_status: "none",
        deposit_refund_status: "not_required",
        deposit_last_refund_error: null,
        updated_at: isoNow(),
      });

      return {
        ok: true,
        reservationId,
        strategyStatus: "not_required",
        strategyTableMissing,
        cautionMode,
        paymentIntentId: holdPaymentIntentId || rentalPaymentIntentId || null,
        capturedAmountCents: 0,
      };
    }

    if (!holdPaymentIntentId) {
      throw new Error("Aucune empreinte CB active a capturer sur cette reservation.");
    }

    const captureAmountCents = amountCents && amountCents > 0 && amountCents <= depositAmountCents
      ? amountCents
      : depositAmountCents;
    let capturedAmountCents = captureAmountCents;

    const holdIntent = await stripe.paymentIntents.retrieve(holdPaymentIntentId);
    const holdStatus = String(holdIntent.status || "").toLowerCase();

    if (holdStatus === "requires_capture") {
      const capturableAmount = Number(holdIntent.amount_capturable || 0) || depositAmountCents;
      const safeAmountToCapture = Math.min(captureAmountCents, capturableAmount);
      const capturePayload = safeAmountToCapture > 0 && safeAmountToCapture < capturableAmount
        ? { amount_to_capture: safeAmountToCapture }
        : undefined;
      const capturedIntent = await stripe.paymentIntents.capture(holdPaymentIntentId, capturePayload);
      capturedAmountCents = Number(capturedIntent.amount_received || safeAmountToCapture || captureAmountCents) || captureAmountCents;
    } else if (holdStatus === "succeeded") {
      capturedAmountCents = Number(holdIntent.amount_received || captureAmountCents) || captureAmountCents;
    } else if (holdStatus === "canceled") {
      throw new Error("Empreinte CB deja lib?r?e ou annul?e: capture impossible.");
    } else {
      throw new Error(`Statut Stripe incompatible avec la capture: ${holdIntent.status}`);
    }

    if (strategy?.id) {
      await admin
        .from("reservation_deposit_strategy_b")
        .update({
          status: "captured",
          captured_at: isoNow(),
          current_capture_before: null,
          last_error_code: null,
          last_error_message: null,
          updated_at: isoNow(),
        })
        .eq("id", strategy.id);
    }

    await tolerantUpdateById(admin, "reservations", "id", reservationId, {
      deposit_status: "captured",
      deposit_refund_status: "captured",
      deposit_last_refund_error: null,
      updated_at: isoNow(),
    });

    await insertStrategyEvent(admin, {
      strategyId: strategy?.id || null,
      reservationId,
      cycleIndex: strategy?.cycle_index || 0,
      eventType: "authorization_captured",
      stripePaymentIntentId: holdPaymentIntentId,
      metadata: {
        captured_amount_cents: capturedAmountCents,
        source: "settle_capture_authorization",
      },
    });

    return {
      ok: true,
      reservationId,
      strategyStatus: "captured",
      strategyTableMissing,
      cautionMode,
      paymentIntentId: holdPaymentIntentId,
      capturedAmountCents,
    };
  }

  if (!Number.isFinite(depositAmountCents) || depositAmountCents <= 0 || !holdPaymentIntentId) {
    if (strategy?.id) {
      await admin
        .from("reservation_deposit_strategy_b")
        .update({
          status: "released",
          released_at: isoNow(),
          last_error_code: null,
          last_error_message: null,
          updated_at: isoNow(),
        })
        .eq("id", strategy.id);
    }

    await tolerantUpdateById(admin, "reservations", "id", reservationId, {
      deposit_status: "none",
      deposit_released_at: isoNow(),
      deposit_refund_status: "not_required",
      deposit_refund_id: null,
      deposit_refunded_amount_cents: 0,
      deposit_refunded_at: isoNow(),
      deposit_last_refund_error: null,
      updated_at: isoNow(),
    });

    return {
      ok: true,
      reservationId,
      strategyStatus: "not_required",
      strategyTableMissing,
      cautionMode,
      paymentIntentId: holdPaymentIntentId || rentalPaymentIntentId || null,
      refundAmountCents: 0,
      refundStatus: "not_required",
    };
  }

  const holdIntent = await stripe.paymentIntents.retrieve(holdPaymentIntentId);
  const holdStatus = String(holdIntent.status || "").toLowerCase();

  let refund: Stripe.Refund | null = null;
  if (["requires_capture", "requires_action", "requires_confirmation", "requires_payment_method", "processing"]?.includes(holdStatus)) {
    await cancelPaymentIntentIfOpen(stripe, holdPaymentIntentId);
  } else if (holdStatus === "succeeded") {
    const refundAmountCents = amountCents && amountCents > 0 && amountCents <= depositAmountCents
      ? amountCents
      : depositAmountCents;

    const existingRefundList = await stripe.refunds.list({
      payment_intent: holdPaymentIntentId,
      limit: 20,
    });
    const existingRefund = (existingRefundList.data || [])?.find((item) => {
      const reservationMeta = asOptionalString((item.metadata as Record<string, string> | undefined)?.reservation_id);
      const sameReservation = reservationMeta === reservationId;
      const sameAmount = Number(item.amount || 0) === refundAmountCents;
      const validStatus = !["failed", "canceled"]?.includes(String(item.status || "")?.toLowerCase());
      return sameReservation && sameAmount && validStatus;
    });

    if (existingRefund) {
      refund = existingRefund;
    } else {
      try {
        refund = await stripe.refunds.create({
          payment_intent: holdPaymentIntentId,
          amount: refundAmountCents,
          metadata: {
            source: "reservation_deposit_release",
            reservation_id: reservationId,
            decision: "release",
          },
        }, {
          idempotencyKey: `reservation_deposit_release_${reservationId}_${refundAmountCents}`,
        });
      } catch (refundError) {
        const stripeError = refundError as Stripe.StripeError;
        const refundErrorMessage = stripeError?.message || "Erreur Stripe de remboursement caution";
        const refundErrorCode = stripeError?.code || "refund_failed";

        if (strategy?.id) {
          await admin
            .from("reservation_deposit_strategy_b")
            .update({
              last_error_code: refundErrorCode,
              last_error_message: refundErrorMessage,
              updated_at: isoNow(),
            })
            .eq("id", strategy.id);
        }

        await tolerantUpdateById(admin, "reservations", "id", reservationId, {
          deposit_refund_status: "failed",
          deposit_last_refund_error: `${refundErrorCode}: ${refundErrorMessage}`,
          updated_at: isoNow(),
        });

        throw new Error(refundErrorMessage);
      }
    }
  }

  if (strategy?.id) {
    await admin
      .from("reservation_deposit_strategy_b")
      .update({
        status: "released",
        released_at: isoNow(),
        last_error_code: null,
        last_error_message: null,
        metadata: {
          ...(strategy.metadata || {}),
          ...(refund
            ? {
              last_refund_id: refund.id,
              last_refund_amount_cents: refund.amount,
            }
            : {
              last_refund_id: null,
              last_refund_amount_cents: 0,
            }),
        },
        updated_at: isoNow(),
      })
      .eq("id", strategy.id);
  }

  await tolerantUpdateById(admin, "reservations", "id", reservationId, {
    deposit_status: "released",
    deposit_released_at: isoNow(),
    deposit_refund_status: refund ? "succeeded" : "not_required",
    deposit_refund_id: refund?.id || null,
    deposit_refunded_amount_cents: refund?.amount || 0,
    deposit_refunded_at: isoNow(),
    deposit_last_refund_error: null,
    updated_at: isoNow(),
  });

  await insertStrategyEvent(admin, {
    strategyId: strategy?.id || null,
    reservationId,
    cycleIndex: strategy?.cycle_index || 0,
    eventType: "authorization_released",
    stripePaymentIntentId: holdPaymentIntentId,
    metadata: {
      ...(refund
        ? {
          refund_id: refund.id,
          refund_amount_cents: refund.amount,
          source: "settle_release_with_refund",
        }
        : {
          source: "settle_release_authorization_cancel",
        }),
    },
  });

  return {
    ok: true,
    reservationId,
    strategyStatus: "released",
    strategyTableMissing,
    cautionMode,
    paymentIntentId: holdPaymentIntentId,
    refundId: refund?.id || null,
    refundAmountCents: refund?.amount || 0,
    refundStatus: refund?.status || "not_required",
  };
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
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
    }
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY manquant");
    }

    const body = (await req.json()) as RequestBody;
    const action = asOptionalString(body.action)?.toLowerCase();
    if (!action || !["sync_checkout", "rotate_due", "settle"].includes(action)) {
      return json({ error: "action invalide (sync_checkout|rotate_due|settle)" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stripe = new Stripe(stripeSecretKey);

    if (action === "sync_checkout") {
      const requester = await resolveRequesterContext(admin, req);
      if (!requester.userId || requester.role === "anon") {
        return json({ error: "Authentification requise" }, 401);
      }

      const result = await actionSyncCheckout(admin, stripe, requester.userId, body);
      return json(result, 200);
    }

    if (action === "rotate_due") {
      const requester = await resolveRequesterContext(admin, req);
      await assertAdminIfNeeded(admin, req, requester);
      const result = await actionRotateDue(admin, stripe, body);
      return json(result, 200);
    }

    const settleReservationId = asOptionalString(body.reservationId);
    if (!settleReservationId) {
      return json({ error: "reservationId manquant" }, 400);
    }
    const requester = await resolveRequesterContext(admin, req);
    await assertCanSettleReservation(admin, req, settleReservationId, requester);

    const result = await actionSettle(admin, stripe, body);
    return json(result, 200);
  } catch (error) {
    console.error("manage-reservation-deposit-strategy-b error:", error);
    if (error instanceof HttpError) {
      return json({
        error: error.message,
      }, error.status);
    }

    return json({
      error: (error as Error)?.message || "Unknown error",
    }, 500);
  }
});
