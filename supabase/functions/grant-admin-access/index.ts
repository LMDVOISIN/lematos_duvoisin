import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type RequestBody = {
  password?: string | null;
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

function getConfiguredAdminPassword(): string {
  return String(
    Deno.env.get("ADMIN_ACCESS_PASSWORD")
    || Deno.env.get("VITE_ADMIN_ACCESS_PASSWORD")
    || Deno.env.get("NEXT_PUBLIC_ADMIN_PASSWORD")
    || ""
  ).trim();
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

async function resolveAuthenticatedUser(admin: SupabaseClient, req: Request): Promise<User> {
  const userJwt = extractUserJwtHeader(req) || extractBearerToken(req);
  if (!userJwt) {
    throw new Error("Authentification requise");
  }

  const { data, error } = await admin.auth.getUser(userJwt);
  if (error || !data?.user?.id) {
    throw new Error("Session utilisateur invalide. Reconnectez-vous.");
  }

  return data.user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const configuredPassword = getConfiguredAdminPassword();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
    }

    if (!configuredPassword) {
      return json({ ok: false, error: "Admin password not configured" }, 500);
    }

    const body = await req.json() as RequestBody;
    const providedPassword = String(body?.password || "").trim();

    if (!providedPassword) {
      return json({ ok: false, error: "Missing admin password" }, 400);
    }

    if (providedPassword !== configuredPassword) {
      return json({ ok: false, error: "Mot de passe incorrect." }, 403);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
    const authenticatedUser = await resolveAuthenticatedUser(supabaseAdmin, req);
    const userId = authenticatedUser.id;
    const currentUserMetadata = authenticatedUser.user_metadata || {};

    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_admin: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)
      .select("id,email,pseudo,is_admin,updated_at")
      .maybeSingle();

    if (profileError) {
      throw new Error(`Profile update failed: ${profileError.message}`);
    }

    const { data: updatedUser, error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentUserMetadata,
        is_admin: true
      }
    });

    if (authUpdateError) {
      throw new Error(`Auth metadata update failed: ${authUpdateError.message}`);
    }

    return json({
      ok: true,
      profile: updatedProfile,
      user: {
        id: updatedUser.user?.id || authenticatedUser.id,
        email: updatedUser.user?.email || authenticatedUser.email || null,
        user_metadata: updatedUser.user?.user_metadata || currentUserMetadata
      }
    });
  } catch (error) {
    console.error("grant-admin-access error:", error);
    return json({
      ok: false,
      error: (error as Error)?.message || "Unknown error"
    }, 500);
  }
});
