/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const DEFAULT_SITE_URL = 'https://www.lematosduvoisin.fr';
const BUILD_DIR = path.join(process.cwd(), 'build');
const BUILD_INDEX_HTML = path.join(BUILD_DIR, 'index.html');
const OUTPUT_LOCATION_DIR = path.join(BUILD_DIR, 'location');
const PAGE_SIZE = 1000;
const DEFAULT_IMAGE = '/assets/images/android-chrome-192x192-1771179342850.png';
const DEFAULT_SOCIAL_IMAGE_WIDTH = 1200;
const DEFAULT_SOCIAL_IMAGE_HEIGHT = 630;

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }

  return env;
}

function getEnvValue(key, fileEnv = {}) {
  return process.env[key] || fileEnv[key] || '';
}

function normalizeSegment(value) {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildAnnonceSlug(annonce = {}) {
  const title = normalizeSegment(annonce.titre || annonce.title || 'objet');
  const city = normalizeSegment(annonce.ville || annonce.city || 'ville');
  return `location-${title}-${city}`;
}

function buildAnnonceOutputSlugs(annonce = {}) {
  const canonicalSlug = buildAnnonceSlug(annonce);
  const legacySlug = String(annonce.slug || '').trim();

  if (!legacySlug || legacySlug === canonicalSlug) {
    return [canonicalSlug];
  }

  return [canonicalSlug, legacySlug];
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function formatPrice(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toFixed(2);
}

function stripLightMarkup(value) {
  if (!value) return '';

  return String(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_`>#~]+/g, ' ')
    .replace(/\s*[-•]\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCoordinate(value) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const numeric = Number(raw.replace(',', '.'));
  if (!Number.isFinite(numeric)) return null;

  return numeric;
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isTruthyPublished(row = {}) {
  const statut = String(row.statut || row.status || '').toLowerCase();
  return row.published === true
    || row.is_public === true
    || statut === 'publiee'
    || statut === 'published'
    || statut === 'active';
}

function isApprovedModeration(row = {}) {
  if (row.moderation_status == null) return true;
  const status = String(row.moderation_status || '').toLowerCase();
  return status === 'approved' || status === 'approuvee' || status === 'approuve';
}

function isIndexableAnnonce(row = {}) {
  if (!row || !row.id) return false;
  if (row.is_draft === true) return false;
  if (row.temporarily_disabled === true) return false;
  if (!isApprovedModeration(row)) return false;
  return isTruthyPublished(row);
}

function encodePathSegments(filePath) {
  return String(filePath || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildAnnoncePhotoUrl(supabaseUrl, photoPath) {
  if (!photoPath) return null;
  const raw = String(photoPath).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return raw;
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/annonce-photos/${encodePathSegments(raw)}`;
}

function parsePositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric);
}

function getAnnoncePrimaryImageDimensions(annonce) {
  const primaryImage = Array.isArray(annonce.images) ? annonce.images.find(Boolean) : null;
  const width = parsePositiveInteger(primaryImage?.width);
  const height = parsePositiveInteger(primaryImage?.height);

  return {
    width: width
      || (height
        ? Math.round((height * DEFAULT_SOCIAL_IMAGE_WIDTH) / DEFAULT_SOCIAL_IMAGE_HEIGHT)
        : DEFAULT_SOCIAL_IMAGE_WIDTH),
    height: height
      || (width
        ? Math.round((width * DEFAULT_SOCIAL_IMAGE_HEIGHT) / DEFAULT_SOCIAL_IMAGE_WIDTH)
        : DEFAULT_SOCIAL_IMAGE_HEIGHT)
  };
}

function getAnnoncePhotoUrls(supabaseUrl, annonce) {
  const candidates = [];
  if (Array.isArray(annonce.photos)) candidates.push(...annonce.photos);
  if (Array.isArray(annonce.images)) {
    annonce.images.forEach((img) => candidates.push(img?.url || img?.path || img));
  }
  if (annonce.image) candidates.push(annonce.image);
  if (annonce.image_url) candidates.push(annonce.image_url);
  if (annonce.photo_principale) candidates.push(annonce.photo_principale);

  return [...new Set(candidates.filter(Boolean).map((p) => buildAnnoncePhotoUrl(supabaseUrl, p)).filter(Boolean))];
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${url}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

async function fetchAllAnnonces({ supabaseUrl, supabaseKey }) {
  const baseUrl = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/annonces`;
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: 'application/json',
  };

  let offset = 0;
  const allRows = [];

  while (true) {
    const queryUrl = `${baseUrl}?select=*&order=updated_at.desc.nullslast,created_at.desc.nullslast&limit=${PAGE_SIZE}&offset=${offset}`;
    const rows = await fetchJson(queryUrl, headers);
    if (!Array.isArray(rows) || rows.length === 0) break;
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}

function upsertTagByRegex(html, regex, replacement, insertBefore = '</head>') {
  if (regex.test(html)) {
    return html.replace(regex, replacement);
  }
  const markerIndex = html.indexOf(insertBefore);
  if (markerIndex === -1) return html;
  return `${html.slice(0, markerIndex)}${replacement}\n${html.slice(markerIndex)}`;
}

function upsertMetaName(html, name, content) {
  const escaped = htmlEscape(content);
  const tag = `  <meta name="${name}" content="${escaped}" />`;
  const regex = new RegExp(`<meta\\s+name=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
  return upsertTagByRegex(html, regex, tag);
}

function upsertMetaProperty(html, property, content) {
  const escaped = htmlEscape(content);
  const tag = `  <meta property="${property}" content="${escaped}" />`;
  const regex = new RegExp(`<meta\\s+property=["']${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
  return upsertTagByRegex(html, regex, tag);
}

function upsertCanonical(html, url) {
  const tag = `  <link rel="canonical" href="${htmlEscape(url)}" />`;
  const regex = /<link\s+rel=["']canonical["'][^>]*>/i;
  return upsertTagByRegex(html, regex, tag);
}

function replaceTitle(html, title) {
  const escaped = htmlEscape(title);
  const regex = /<title>[\s\S]*?<\/title>/i;
  const replacement = `  <title>${escaped}</title>`;
  return upsertTagByRegex(html, regex, replacement);
}

function injectJsonLdScripts(html, scripts) {
  const marker = '</head>';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return html;

  const block = scripts
    .map((payload) => `  <script type="application/ld+json">${JSON.stringify(payload)}</script>`)
    .join('\n');

  return `${html.slice(0, markerIndex)}${block}\n${html.slice(markerIndex)}`;
}

function buildMetaDescription(annonce) {
  const title = String(annonce.titre || annonce.title || 'materiel').trim();
  const city = String(annonce.city || annonce.ville || '').trim();
  const price = formatPrice(annonce.prix_jour || annonce.daily_price || annonce.price_day);
  const desc = stripLightMarkup(annonce.description);

  const parts = [
    `Louez ${title}${city ? ` a ${city}` : ''}`,
    `des ${price} EUR/jour`,
    desc || null
  ].filter(Boolean);

  return truncateText(parts.join('. '), 160);
}

function buildSeoTitle(annonce) {
  const title = String(annonce.titre || annonce.title || 'Annonce').trim();
  const city = String(annonce.city || annonce.ville || '').trim();
  const core = city ? `Location ${title} - ${city}` : `Location ${title}`;
  return truncateText(`${core} | Le Matos Du Voisin`, 60);
}

function buildCanonicalUrl(siteUrl, annonce) {
  const slug = buildAnnonceSlug(annonce);
  return `${siteUrl.replace(/\/+$/, '')}/location/${slug}/${annonce.id}/`;
}

function buildPrerenderRootMarkup({ annonce, canonicalUrl, imageUrls, seoTitle }) {
  const title = String(annonce.titre || annonce.title || 'Annonce');
  const city = String(annonce.city || annonce.ville || '');
  const postalCode = String(annonce.postal_code || annonce.code_postal || '');
  const locationText = [postalCode, city].filter(Boolean).join(' ') || city || 'France';
  const category = String(annonce.categorie || annonce.category || '').trim();
  const price = formatPrice(annonce.prix_jour || annonce.daily_price || annonce.price_day);
  const description = String(annonce.description || '').trim();
  const descHtml = description
    ? description
        .split(/\r?\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((paragraph) => `<p style="margin:0 0 12px 0;line-height:1.6;color:#334155;">${htmlEscape(paragraph)}</p>`)
        .join('')
    : '<p style="margin:0;line-height:1.6;color:#334155;">Description disponible sur la page complete.</p>';

  const heroImage = imageUrls[0] || DEFAULT_IMAGE;
  const moreImages = imageUrls.slice(1, 4);

  return `
<div style="background:#eef6ff;min-height:100vh;">
  <main style="max-width:1120px;margin:0 auto;padding:24px 16px 48px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <nav aria-label="Fil d Ariane" style="font-size:14px;color:#475569;margin-bottom:16px;">
      <a href="/accueil-recherche" style="color:#0f766e;text-decoration:none;">Accueil</a>
      <span> / </span>
      <a href="/accueil-recherche" style="color:#0f766e;text-decoration:none;">Recherche</a>
      <span> / </span>
      <span>${htmlEscape(title)}</span>
    </nav>

    <article itemscope itemtype="https://schema.org/Product" style="background:#ffffff;border-radius:16px;box-shadow:0 10px 25px rgba(2,6,23,0.08);overflow:hidden;">
      <div style="display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr);gap:0;">
        <div style="padding:0;">
          <img src="${htmlEscape(heroImage)}" alt="${htmlEscape(title)}" style="display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;background:#e2e8f0;" />
          ${
            moreImages.length > 0
              ? `<div style="display:grid;grid-template-columns:repeat(${moreImages.length},1fr);gap:8px;padding:8px;background:#f8fafc;">
              ${moreImages
                .map(
                  (url) => `<img src="${htmlEscape(url)}" alt="${htmlEscape(title)}" style="display:block;width:100%;height:120px;object-fit:cover;border-radius:10px;background:#e2e8f0;" loading="lazy" />`
                )
                .join('')}
            </div>`
              : ''
          }
        </div>
        <div style="padding:24px;">
          ${category ? `<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0f766e;">${htmlEscape(category)}</p>` : ''}
          <h1 itemprop="name" style="margin:0 0 12px 0;font-size:28px;line-height:1.2;color:#0f172a;">${htmlEscape(title)}${city ? ` a ${htmlEscape(city)}` : ''}</h1>
          <p style="margin:0 0 12px 0;color:#475569;font-size:14px;">${htmlEscape(locationText)}</p>
          <p style="margin:0 0 16px 0;font-size:28px;font-weight:700;color:#0891b2;">
            <span itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <meta itemprop="url" content="${htmlEscape(canonicalUrl)}" />
              <meta itemprop="priceCurrency" content="EUR" />
              <meta itemprop="availability" content="https://schema.org/InStock" />
              <span itemprop="price" content="${htmlEscape(price)}">${htmlEscape(price)}</span> EUR / jour
            </span>
          </p>
          <div itemprop="description">${descHtml}</div>
          <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;">
            <a href="${htmlEscape(canonicalUrl)}" style="background:#06b6d4;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600;">Voir l annonce</a>
            <a href="/demande-reservation/${htmlEscape(String(annonce.id))}" style="background:#ffffff;color:#0f172a;text-decoration:none;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-weight:600;">Reserver</a>
          </div>
          <p style="margin:12px 0 0 0;font-size:12px;color:#64748b;">Version prerendue SEO. La page interactive complete se charge automatiquement.</p>
        </div>
      </div>
    </article>
    <section style="margin-top:20px;">
      <h2 style="margin:0 0 8px 0;font-size:20px;color:#0f172a;">Apercu de l annonce</h2>
      <p style="margin:0;color:#475569;">${htmlEscape(seoTitle)}</p>
    </section>
  </main>
</div>`.trim();
}

function buildJsonLd({ annonce, canonicalUrl, imageUrls, siteUrl }) {
  const title = String(annonce.titre || annonce.title || 'Annonce');
  const city = String(annonce.city || annonce.ville || '');
  const category = annonce.categorie || annonce.category || undefined;
  const description = truncateText(stripLightMarkup(annonce.description), 500) || undefined;
  const price = formatPrice(annonce.prix_jour || annonce.daily_price || annonce.price_day);
  const latitude = parseCoordinate(annonce.latitude);
  const longitude = parseCoordinate(annonce.longitude);
  const hasGeo = latitude != null
    && longitude != null
    && Math.abs(latitude) <= 90
    && Math.abs(longitude) <= 180;

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description,
    sku: String(annonce.id),
    category,
    image: imageUrls.length ? imageUrls : [`${siteUrl}${DEFAULT_IMAGE}`],
    itemCondition: 'https://schema.org/UsedCondition',
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'EUR',
      price,
      availability: 'https://schema.org/InStock',
      businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
      itemCondition: 'https://schema.org/UsedCondition'
    }
  };

  if (city) {
    product.areaServed = { '@type': 'Place', name: city };
  }

  if (hasGeo) {
    product.availableAtOrFrom = {
      '@type': 'Place',
      name: city || 'France',
      geo: {
        '@type': 'GeoCoordinates',
        latitude,
        longitude
      }
    };
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${siteUrl}/accueil-recherche` },
      { '@type': 'ListItem', position: 2, name: 'Recherche', item: `${siteUrl}/accueil-recherche` },
      { '@type': 'ListItem', position: 3, name: title, item: canonicalUrl }
    ]
  };

  return [product, breadcrumb];
}

function buildAnnoncePageHtml(baseHtml, { annonce, siteUrl, supabaseUrl }) {
  const canonicalUrl = buildCanonicalUrl(siteUrl, annonce);
  const imageUrls = getAnnoncePhotoUrls(supabaseUrl, annonce);
  const heroImageAbsolute = /^https?:\/\//i.test(imageUrls[0] || '')
    ? imageUrls[0]
    : `${siteUrl}${imageUrls[0] || DEFAULT_IMAGE}`;
  const socialImageDimensions = getAnnoncePrimaryImageDimensions(annonce);
  const seoTitle = buildSeoTitle(annonce);
  const seoDescription = buildMetaDescription(annonce);
  const socialImageAlt = `${String(annonce.titre || annonce.title || 'Annonce')} - ${String(annonce.city || annonce.ville || 'France')}`;
  const rootMarkup = buildPrerenderRootMarkup({
    annonce,
    canonicalUrl,
    imageUrls: imageUrls.map((url) => (/^https?:\/\//i.test(url) ? url : `${siteUrl}${url}`)),
    seoTitle
  });
  const jsonLdScripts = buildJsonLd({
    annonce,
    canonicalUrl,
    imageUrls: imageUrls.map((url) => (/^https?:\/\//i.test(url) ? url : `${siteUrl}${url}`)),
    siteUrl
  });

  let html = baseHtml;
  html = replaceTitle(html, seoTitle);
  html = upsertMetaName(html, 'description', seoDescription);
  html = upsertMetaName(html, 'robots', 'index, follow, max-image-preview:large');
  html = upsertCanonical(html, canonicalUrl);

  html = upsertMetaProperty(html, 'og:type', 'product');
  html = upsertMetaProperty(html, 'og:title', seoTitle);
  html = upsertMetaProperty(html, 'og:description', seoDescription);
  html = upsertMetaProperty(html, 'og:url', canonicalUrl);
  html = upsertMetaProperty(html, 'og:image', heroImageAbsolute);
  html = upsertMetaProperty(html, 'og:image:secure_url', heroImageAbsolute);
  html = upsertMetaProperty(html, 'og:image:width', String(socialImageDimensions.width));
  html = upsertMetaProperty(html, 'og:image:height', String(socialImageDimensions.height));
  html = upsertMetaProperty(html, 'og:image:alt', socialImageAlt);

  html = upsertMetaName(html, 'twitter:card', 'summary_large_image');
  html = upsertMetaName(html, 'twitter:title', seoTitle);
  html = upsertMetaName(html, 'twitter:description', seoDescription);
  html = upsertMetaName(html, 'twitter:image', heroImageAbsolute);
  html = upsertMetaName(html, 'twitter:image:alt', socialImageAlt);

  html = injectJsonLdScripts(html, jsonLdScripts);

  if (!html.includes('<div id="root"></div>')) {
    throw new Error('Template build/index.html inattendu: root vide introuvable.');
  }
  html = html.replace('<div id="root"></div>', `<div id="root">${rootMarkup}</div>`);

  return html;
}

function safeWriteFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function removeDirectoryWithRetries(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  fs.rmSync(dirPath, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 500,
  });
}

async function main() {
  if (!fs.existsSync(BUILD_INDEX_HTML)) {
    throw new Error("Le fichier build/index.html est introuvable. Lancez d'abord 'npm run build'.");
  }

  const envFile = readEnvFile(path.join(process.cwd(), '.env'));
  const siteUrl = (getEnvValue('SITE_URL', envFile) || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const supabaseUrl = getEnvValue('VITE_SUPABASE_URL', envFile);
  const supabaseKey =
    getEnvValue('SUPABASE_SERVICE_ROLE_KEY', envFile) ||
    getEnvValue('VITE_SUPABASE_ANON_KEY', envFile);

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variables Supabase manquantes (VITE_SUPABASE_URL + key).');
  }

  const baseHtml = fs.readFileSync(BUILD_INDEX_HTML, 'utf8');
  const allRows = await fetchAllAnnonces({ supabaseUrl, supabaseKey });
  const annonces = allRows.filter(isIndexableAnnonce);

  removeDirectoryWithRetries(OUTPUT_LOCATION_DIR);

  let generatedCount = 0;
  for (const annonce of annonces) {
    const html = buildAnnoncePageHtml(baseHtml, { annonce, siteUrl, supabaseUrl });
    const outputSlugs = buildAnnonceOutputSlugs(annonce);

    outputSlugs.forEach((slug) => {
      const outputPath = path.join(OUTPUT_LOCATION_DIR, slug, String(annonce.id), 'index.html');
      safeWriteFile(outputPath, html);
      generatedCount += 1;
    });
  }

  console.log(`[prerender] annonces recuperees: ${allRows.length}`);
  console.log(`[prerender] annonces prerendees: ${generatedCount}`);
  console.log(`[prerender] dossier: ${OUTPUT_LOCATION_DIR}`);
}

main().catch((error) => {
  console.error('[prerender] Echec:', error);
  process.exit(1);
});
