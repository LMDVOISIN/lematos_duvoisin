import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

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

function normalizeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isTerminalReservationStatus(rawStatus: unknown): boolean {
  const status = normalizeStatus(rawStatus);
  return [
    "completed",
    "cancelled",
    "cancelled_payment",
    "rejected",
    "refused",
    "expired"
  ].includes(status);
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY not configured");
    }
    if (!authHeader) {
      return json({ error: "Missing Authorization header", code: "UNAUTHORIZED" }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const { data: userAuth, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userAuth?.user?.id) {
      return json({
        error: userError?.message || "Utilisateur non authentifie",
        code: "UNAUTHORIZED"
      }, 401);
    }

    const userId = userAuth.user.id;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Block deletion when the user is still involved in non-terminal reservations.
    const { data: reservations, error: reservationsError } = await supabaseAdmin
      .from("reservations")
      .select("id,status,start_date,end_date,owner_id,renter_id")
      .or(`owner_id.eq.${userId},renter_id.eq.${userId}`);

    if (reservationsError) {
      throw new Error(`Erreur v?rification reservations: ${reservationsError.message}`);
    }

    const blockingReservations = (reservations || []).filter((reservation) => {
      const row = reservation as JsonRecord;
      return !isTerminalReservationStatus(row["status"]);
    });

    if (blockingReservations.length > 0) {
      const statusSummary = Array.from(
        new Set(
          blockingReservations
            .map((reservation) => normalizeStatus((reservation as JsonRecord)["status"]))
            .filter(Boolean)
        )
      );

      return json({
        ok: false,
        code: "ACTIVE_RESERVATIONS_EXIST",
        error: "Impossible de supprimer le compte tant que des réservations ne sont pas terminées.",
        activeReservationCount: blockingReservations.length,
        statuses: statusSummary
      }, 409);
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw new Error(`Suppression compte impossible: ${deleteError.message}`);
    }

    return json({
      ok: true,
      deletedUserId: userId
    });
  } catch (error) {
    console.error("delete-account error:", error);
    return json({
      ok: false,
      code: "DELETE_ACCOUNT_FAILED",
      error: (error as Error)?.message || "Unknown error"
    }, 500);
  }
});

