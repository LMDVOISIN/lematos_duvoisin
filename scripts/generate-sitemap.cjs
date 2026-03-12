/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const DEFAULT_SITE_URL = 'https://www.lematosduvoisin.fr';
const PUBLIC_OUTPUT_PATH = path.join(process.cwd(), 'public', 'sitemap.xml');
const BUILD_OUTPUT_PATH = path.join(process.cwd(), 'build', 'sitemap.xml');
const PAGE_SIZE = 1000;

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

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function buildStaticUrls(siteUrl, nowIso) {
  const routes = [
    '/',
    '/demandes-publiques',
    '/foire-questions',
    '/couverture-assurance',
    '/legal/mentions-legales',
    '/legal/cgu',
    '/legal/cgv',
    '/legal/politique-confidentialite',
    '/legal/politique-temoins-connexion'
  ];

  return routes.map((route) => ({
    loc: `${siteUrl}${route}`,
    lastmod: nowIso,
    changefreq: route === '/' ? 'daily' : 'monthly',
    priority: route === '/' ? '1.0' : '0.5',
  }));
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${url}: ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error.message}`);
  }
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

function buildAnnonceUrls(siteUrl, annonces) {
  return annonces
    .filter(isIndexableAnnonce)
    .map((row) => {
      const slug = buildAnnonceSlug(row);
      const loc = `${siteUrl}/location/${slug}/${row.id}/`;
      const lastmod = toIsoDate(row.updated_at) || toIsoDate(row.created_at) || null;

      return {
        loc,
        lastmod,
        changefreq: 'weekly',
        priority: '0.8',
      };
    });
}

function buildSitemapXml(entries) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  for (const entry of entries) {
    if (!entry?.loc) continue;
    lines.push('  <url>');
    lines.push(`    <loc>${xmlEscape(entry.loc)}</loc>`);
    if (entry.lastmod) lines.push(`    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
    if (entry.changefreq) lines.push(`    <changefreq>${xmlEscape(entry.changefreq)}</changefreq>`);
    if (entry.priority) lines.push(`    <priority>${xmlEscape(entry.priority)}</priority>`);
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const envFile = readEnvFile(path.join(process.cwd(), '.env'));
  const siteUrl = (getEnvValue('SITE_URL', envFile) || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const supabaseUrl = getEnvValue('VITE_SUPABASE_URL', envFile);
  const supabaseKey =
    getEnvValue('SUPABASE_SERVICE_ROLE_KEY', envFile) ||
    getEnvValue('VITE_SUPABASE_ANON_KEY', envFile);

  const nowIso = new Date().toISOString();
  const staticEntries = buildStaticUrls(siteUrl, nowIso);

  let annonceEntries = [];
  let warning = null;

  if (supabaseUrl && supabaseKey) {
    try {
      const allRows = await fetchAllAnnonces({ supabaseUrl, supabaseKey });
      annonceEntries = buildAnnonceUrls(siteUrl, allRows);
      console.log(`[sitemap] annonces recuperees: ${allRows.length}, indexables: ${annonceEntries.length}`);
    } catch (error) {
      warning = `[sitemap] Echec recuperation annonces Supabase, sitemap genere avec pages statiques uniquement: ${error.message}`;
      console.warn(warning);
    }
  } else {
    warning = '[sitemap] Variables Supabase absentes, sitemap genere avec pages statiques uniquement.';
    console.warn(warning);
  }

  const deduped = new Map();
  [...staticEntries, ...annonceEntries].forEach((entry) => {
    if (!entry?.loc) return;
    deduped.set(entry.loc, entry);
  });

  const entries = Array.from(deduped.values());
  const xml = buildSitemapXml(entries);

  const outputPaths = [PUBLIC_OUTPUT_PATH];
  if (fs.existsSync(path.join(process.cwd(), 'build'))) {
    outputPaths.push(BUILD_OUTPUT_PATH);
  }

  outputPaths.forEach((outputPath) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, xml, 'utf8');
    console.log(`[sitemap] Fichier genere: ${outputPath}`);
  });

  console.log(`[sitemap] Total URLs: ${entries.length}`);

  if (warning) {
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error('[sitemap] Echec de generation:', error);
  process.exit(1);
});
