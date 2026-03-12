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

  const templates = [
    {
      template_key: "annonce_created_owner",
      category: "annonces",
      subject: "Annonce créée - En attente de validation",
      body_html:
        "<p>Bonjour {{owner_name}},</p><p>Votre annonce <strong>{{annonce_title}}</strong> a bien été soumise et est en attente de validation.</p><p>Vous pouvez la consulter ici : <a href=\"{{annonce_url}}\">{{annonce_url}}</a></p><p>L'équipe Le Matos du Voisin</p>",
      body_text:
        "Bonjour {{owner_name}}, votre annonce {{annonce_title}} a bien été soumise et est en attente de validation. Consultez-la ici: {{annonce_url}}",
      enabled: true,
    },
    {
      template_key: "annonce_moderation_alert",
      category: "annonces",
      subject: "[MODERATION] Nouvelle annonce à vérifier",
      body_html:
        "<p>Nouvelle annonce soumise à modération.</p><ul><li>Titre: {{annonce_title}}</li><li>Propriétaire: {{owner_name}}</li><li>Email: {{owner_email}}</li><li>Catégorie: {{category}}</li><li>Prix/jour: {{price}}</li></ul><p><a href=\"{{admin_url}}\">Ouvrir la modération</a></p>",
      body_text:
        "Nouvelle annonce à modérer: {{annonce_title}} / {{owner_name}} / {{owner_email}} / {{category}} / {{price}}. Modération: {{admin_url}}",
      enabled: true,
    },
  ];

  for (const tpl of templates) {
    const { data: existing, error: checkErr } = await supabase
      .from("email_templates")
      .select("id, template_key")
      .eq("template_key", tpl.template_key)
      .maybeSingle();
    if (checkErr) {
      throw new Error(`Check template ${tpl.template_key} failed: ${checkErr.message}`);
    }
    if (existing) {
      console.log(`SKIP exists: ${tpl.template_key}`);
      continue;
    }

    const { error: insertErr } = await supabase.from("email_templates").insert(tpl);
    if (insertErr) {
      throw new Error(`Insert template ${tpl.template_key} failed: ${insertErr.message}`);
    }
    console.log(`INSERTED: ${tpl.template_key}`);
  }
}

main().catch((err) => {
  console.error("SEED FAILED:", err.message);
  process.exit(1);
});
