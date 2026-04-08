const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function readDotEnv(filePath) {
  const map = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

async function main() {
  const env = readDotEnv(path.resolve(".env"));
  const supabaseUrl =
    env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY manquants");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("==> Check email_templates schema compatibility");
  const { data: sampleRow, error: sampleErr } = await supabase
    .from("email_templates")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (sampleErr) {
    console.log(`   sample select * -> ERROR (${sampleErr.message})`);
  } else {
    console.log(
      `   sample select * -> OK (columns=${Object.keys(sampleRow || {}).join(", ")})`
    );
  }
  const { data: annonceTemplateRows, error: annonceTemplateErr } = await supabase
    .from("email_templates")
    .select("template_key, subject")
    .ilike("template_key", "annonce%")
    .limit(20);
  if (annonceTemplateErr) {
    console.log(`   template_key ilike annonce% -> ERROR (${annonceTemplateErr.message})`);
  } else {
    console.log(
      `   template_key ilike annonce% -> ${annonceTemplateRows?.length || 0} rows`
    );
    for (const row of annonceTemplateRows || []) {
      console.log(`      - ${row.template_key}`);
    }
  }

  const schemaChecks = [
    "key, subject, body_html",
    "key, subject, body_html, body_text",
    "key, subject, body_html, enabled",
    "key, subject, body_html, enabled, body_text",
  ];
  for (const selectSpec of schemaChecks) {
    const { error } = await supabase
      .from("email_templates")
      .select(selectSpec)
      .limit(1);
    console.log(
      `   ${selectSpec} -> ${error ? `ERROR (${error.message})` : "OK"}`
    );
  }

  console.log("==> Check required templates");
  const loadTemplateCompat = async (templateId) => {
    let { data, error } = await supabase
      .from("email_templates")
      .select("subject, body_html, enabled")
      .eq("key", templateId)
      .maybeSingle();
    if (error && /column\s+email_templates\.key\s+does not exist/i.test(String(error.message || ""))) {
      ({ data, error } = await supabase
        .from("email_templates")
        .select("subject, body_html, enabled")
        .eq("template_key", templateId)
        .maybeSingle());
    }
    if (error && /column\s+email_templates\.enabled\s+does not exist/i.test(String(error.message || ""))) {
      ({ data, error } = await supabase
        .from("email_templates")
        .select("subject, body_html")
        .eq("template_key", templateId)
        .maybeSingle());
    }
    return { data, error };
  };

  for (const key of ["annonce_created_owner", "annonce_moderation_alert"]) {
    const { data, error } = await loadTemplateCompat(key);
    if (error) {
      console.log(`   ${key} -> ERROR (${error.message})`);
      continue;
    }
    console.log(
      `   ${key} -> ${data ? "OK" : "MISSING"} (subject=${Boolean(
        data?.subject
      )}, body_html=${Boolean(data?.body_html)})`
    );
  }

  console.log("==> Invoke send-email function (smoke)");
  const smokeTo = "contact@lematosduvoisin.fr";
  const smokeSubject = `[SMOKE] send-email ${new Date().toISOString()}`;
  const { data: fnData, error: fnError } = await supabase.functions.invoke(
    "send-email",
    {
      body: {
        to: smokeTo,
        subject: smokeSubject,
        htmlBody:
          "<p>Smoke test Codex: send-email function + Resend config operational.</p>",
        textBody:
          "Smoke test Codex: send-email function + Resend config operational.",
      },
    }
  );
  if (fnError) {
    console.log(`   send-email -> ERROR (${fnError.message})`);
  } else {
    console.log(`   send-email -> OK (messageId=${fnData?.messageId || "n/a"})`);
  }

  console.log("==> Latest email_queue rows");
  const { data: queueRows, error: queueErr } = await supabase
    .from("email_queue")
    .select("created_at, recipient_email, template_key, status, last_error")
    .order("created_at", { ascending: false })
    .limit(10);
  if (queueErr) {
    console.log(`   email_queue -> ERROR (${queueErr.message})`);
  } else {
    for (const row of queueRows || []) {
      console.log(
        `   ${row.created_at} | ${row.recipient_email} | ${row.template_key || "-"} | ${row.status} | ${row.last_error || "-"}`
      );
    }
  }
}

main().catch((error) => {
  console.error("SMOKE FAILED:", error.message);
  process.exit(1);
});
