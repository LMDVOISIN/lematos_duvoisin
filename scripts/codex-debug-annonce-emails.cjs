const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function readDotEnv(filePath) {
  const out = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function substitute(template = "", variables = {}) {
  let out = String(template || "");
  for (const [k, v] of Object.entries(variables || {})) {
    const re = new RegExp(`{{${k}}}`, "g");
    out = out.replace(re, v == null ? "" : String(v));
  }
  return out;
}

async function fetchTemplateCompat(supabase, templateKey) {
  let { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("template_key", templateKey)
    .maybeSingle();

  if (error && /column\s+email_templates\.template_key\s+does not exist/i.test(String(error.message || ""))) {
    ({ data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("key", templateKey)
      .maybeSingle());
  }

  return { data, error };
}

async function invokeFunctionRaw({ supabaseUrl, authKey, body }) {
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/send-email`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, ok: res.ok, json, text };
}

async function main() {
  const env = readDotEnv(path.resolve(".env"));
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase URL/service role key");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const scenarios = [
    {
      templateKey: "annonce_created_owner",
      to: "rabii@loeni.com",
      variables: {
        owner_name: "Papa",
        annonce_title: "VIBREUR A BETON ELECTRIQUE AVEC AIGUILLE FLEXIBLE",
        annonce_url: "https://lematosduvoisin.fr/location/test/346",
      },
    },
    {
      templateKey: "annonce_moderation_alert",
      to: "contact@lematosduvoisin.fr",
      variables: {
        annonce_title: "VIBREUR A BETON ELECTRIQUE AVEC AIGUILLE FLEXIBLE",
        owner_name: "Papa",
        owner_email: "rabii@loeni.com",
        category: "Bricolage & BTP",
        price: "3.00",
        admin_url: "https://lematosduvoisin.fr/administration-moderation",
      },
    },
  ];

  for (const scenario of scenarios) {
    console.log(`\n==> ${scenario.templateKey} -> ${scenario.to}`);
    const { data: tpl, error: tplErr } = await fetchTemplateCompat(supabase, scenario.templateKey);
    if (tplErr) {
      console.log("Template fetch error:", tplErr.message);
      continue;
    }
    if (!tpl) {
      console.log("Template missing");
      continue;
    }

    const subject = substitute(tpl.subject || "", scenario.variables);
    const htmlBody = substitute(tpl.body_html || "", scenario.variables);
    const textBody = substitute(tpl.body_text || "", scenario.variables);

    console.log("Subject:", subject);
    const result = await invokeFunctionRaw({
      supabaseUrl,
      authKey: serviceKey,
      body: {
        to: scenario.to,
        subject,
        htmlBody,
        textBody,
        templateKey: scenario.templateKey,
        variables: scenario.variables,
      },
    });

    console.log("Function status:", result.status, result.ok ? "OK" : "ERROR");
    console.log("Function body:", result.json || result.text);
  }
}

main().catch((err) => {
  console.error("DEBUG FAILED:", err.message);
  process.exit(1);
});
