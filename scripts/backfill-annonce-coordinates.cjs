#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const COMMIT_MODE = process.argv.includes('--commit');
const LIMIT_ARG = Number.parseInt(
  (process.argv.find((value) => value?.startsWith('--limit=')) || '')?.split('=')?.[1] || '',
  10
);
const MAX_ROWS = Number.isFinite(LIMIT_ARG) && LIMIT_ARG > 0 ? LIMIT_ARG : 500;
const REQUEST_DELAY_MS = 1100;
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[coords-backfill] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseCoordinate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const hasValidCoordinates = (latitude, longitude) => {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  if (lat === null || lng === null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const normalizeText = (value) => String(value || '').trim();

const buildQueryCandidates = (annonce = {}) => {
  const address = normalizeText(annonce?.address || annonce?.adresse);
  const postalCode = normalizeText(annonce?.postal_code || annonce?.code_postal);
  const city = normalizeText(annonce?.city || annonce?.ville);
  const cityLine = [postalCode, city].filter(Boolean).join(' ');

  const candidates = [
    [address, cityLine, 'France'].filter(Boolean).join(', '),
    [cityLine, 'France'].filter(Boolean).join(', '),
    [city, 'France'].filter(Boolean).join(', '),
    [postalCode, 'France'].filter(Boolean).join(', ')
  ].filter(Boolean);

  return [...new Set(candidates)];
};

async function geocodeWithRetry(query, attempt = 1) {
  if (!query) return null;

  const searchParams = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'fr',
    q: query
  });

  let response = null;
  try {
    response = await fetch(`${NOMINATIM_ENDPOINT}?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fr',
        'User-Agent': 'lematos-duvoisin-coords-backfill/1.0 (contact@lematosduvoisin.fr)'
      }
    });
  } catch (error) {
    if (attempt >= 3) return null;
    await sleep(1200 * attempt);
    return geocodeWithRetry(query, attempt + 1);
  }

  if (response?.status === 429) {
    if (attempt >= 3) return null;
    await sleep(1500 * attempt);
    return geocodeWithRetry(query, attempt + 1);
  }

  if (!response?.ok) return null;

  const payload = await response.json();
  const firstMatch = Array.isArray(payload) ? payload[0] : null;
  const latitude = parseCoordinate(firstMatch?.lat);
  const longitude = parseCoordinate(firstMatch?.lon);
  if (!hasValidCoordinates(latitude, longitude)) return null;

  return { latitude, longitude };
}

async function run() {
  console.log(`[coords-backfill] Mode: ${COMMIT_MODE ? 'COMMIT' : 'DRY-RUN'}`);
  console.log(`[coords-backfill] Limit: ${MAX_ROWS}`);

  const { data, error } = await supabase
    .from('annonces')
    .select('id,titre,address,city,postal_code,latitude,longitude,created_at')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error('[coords-backfill] Query error:', error?.message || error);
    process.exit(1);
  }

  const rows = data || [];
  const missingRows = rows.filter((row) => !hasValidCoordinates(row?.latitude, row?.longitude));
  if (missingRows.length === 0) {
    console.log('[coords-backfill] No annonces without coordinates in selected range.');
    return;
  }

  let scanned = 0;
  let skippedNoAddress = 0;
  let unresolved = 0;
  let resolved = 0;
  let updated = 0;

  for (const row of missingRows) {
    scanned += 1;
    const queries = buildQueryCandidates(row);
    if (!queries.length) {
      skippedNoAddress += 1;
      console.log(`[coords-backfill] Skip #${row?.id} (no address payload)`);
      continue;
    }

    let geocoded = null;
    for (const query of queries) {
      geocoded = await geocodeWithRetry(query);
      await sleep(REQUEST_DELAY_MS);
      if (geocoded) break;
    }

    if (!geocoded) {
      unresolved += 1;
      console.log(`[coords-backfill] Unresolved #${row?.id} ${row?.titre || '(sans titre)'}`);
      continue;
    }

    resolved += 1;
    console.log(
      `[coords-backfill] Resolved #${row?.id} ${row?.titre || '(sans titre)'} -> ${geocoded?.latitude}, ${geocoded?.longitude}`
    );

    if (!COMMIT_MODE) continue;

    const { error: updateError } = await supabase
      .from('annonces')
      .update({
        latitude: geocoded?.latitude,
        longitude: geocoded?.longitude,
        updated_at: new Date().toISOString()
      })
      .eq('id', row?.id);

    if (updateError) {
      unresolved += 1;
      console.error(`[coords-backfill] Update failed #${row?.id}:`, updateError?.message || updateError);
      continue;
    }

    updated += 1;
  }

  console.log('---');
  console.log(`[coords-backfill] scanned_missing=${scanned}`);
  console.log(`[coords-backfill] skipped_no_address=${skippedNoAddress}`);
  console.log(`[coords-backfill] resolved=${resolved}`);
  console.log(`[coords-backfill] unresolved=${unresolved}`);
  console.log(`[coords-backfill] updated=${updated}`);
}

run().catch((error) => {
  console.error('[coords-backfill] Fatal error:', error);
  process.exit(1);
});
