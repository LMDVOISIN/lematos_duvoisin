#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(process.cwd(), '.env'), override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;
const authMode = supabaseServiceRoleKey ? 'service role key' : 'anon key';

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase env vars (VITE_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY).'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE_CANDIDATES = [
  'profiles',
  'categories',
  'faqs',
  'legal_pages',
  'email_templates',
  'test_scenarios',
  'annonces',
  'email_queue',
  'feedback',
  'demandes',
  'reservations',
  'bookings',
  'notifications',
  'user_sanctions',
  'reservation_photos',
  'messages',
  'conversations',
  'subcategories',
  'tenant_documents',
  'reservation_docs',
  'job_runs',
  'payments',
  'proposals',
  'user_testers',
  'test_sessions',
  'page_responses',
  'test_reports',
  'debrief_notes',
];

// Fallback typing for SQL arrays when source values are empty.
const ARRAY_TYPE_OVERRIDES = {
  annonces: {
    photos: 'text[]',
    unavailable_dates: 'date[]',
  },
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function quoteString(value) {
  const text = String(value ?? '');
  return `'${text.replace(/'/g, "''")}'`;
}

function isScalar(value) {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function inferArrayType(values, tableName, columnName) {
  const override = ARRAY_TYPE_OVERRIDES?.[tableName]?.[columnName];
  if (override) return override;

  const nonNullValues = values.filter((entry) => entry !== null && entry !== undefined);
  if (nonNullValues.length === 0) return 'text[]';

  if (nonNullValues.every((entry) => typeof entry === 'boolean')) return 'boolean[]';

  if (nonNullValues.every((entry) => typeof entry === 'number' && Number.isInteger(entry))) {
    return 'integer[]';
  }

  if (nonNullValues.every((entry) => typeof entry === 'number')) return 'numeric[]';

  if (
    nonNullValues.every(
      (entry) => typeof entry === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.trim())
    )
  ) {
    return 'date[]';
  }

  return 'text[]';
}

function toSqlValue(value, tableName, columnName) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';

  if (Array.isArray(value)) {
    // Preserve JSON arrays (e.g. json/jsonb columns with array of objects).
    if (value.some((entry) => !isScalar(entry))) {
      return `${quoteString(JSON.stringify(value))}::jsonb`;
    }

    const arrayType = inferArrayType(value, tableName, columnName);
    if (value.length === 0) return `ARRAY[]::${arrayType}`;

    const parts = value.map((entry) => {
      if (entry === null || entry === undefined) return 'NULL';
      if (typeof entry === 'number' && Number.isFinite(entry)) return String(entry);
      if (typeof entry === 'boolean') return entry ? 'true' : 'false';
      return quoteString(entry);
    });
    return `ARRAY[${parts.join(', ')}]::${arrayType}`;
  }

  if (isObject(value)) {
    return `${quoteString(JSON.stringify(value))}::jsonb`;
  }

  return quoteString(value);
}

async function fetchTableRows(tableName) {
  const pageSize = 1000;
  let start = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(start, start + pageSize - 1);

    if (error) {
      return { rows: null, error };
    }

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);

    if (page.length < pageSize) break;
    start += pageSize;
  }

  return { rows, error: null };
}

function makeInsertBlock(tableName, rows) {
  if (!rows || rows.length === 0) return '';

  const columns = Object.keys(rows[0]);
  const valuesSql = rows
    .map((row) => {
      const values = columns.map((column) => toSqlValue(row[column], tableName, column));
      return `(${values.join(', ')})`;
    })
    .join(',\n');

  const colSql = columns.map((column) => `"${column}"`).join(', ');
  const insertSql = `INSERT INTO public.${tableName} (${colSql}) VALUES\n${valuesSql}\nON CONFLICT DO NOTHING;\n`;

  const hasNumericId = rows.every((row) => typeof row?.id === 'number' && Number.isFinite(row?.id));
  const sequenceSql = hasNumericId
    ? `SELECT setval(pg_get_serial_sequence('public.${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM public.${tableName}), 1), true);\n`
    : '';

  const countSql = `SELECT COUNT(*) AS ${tableName}_count FROM public.${tableName};\n`;
  return `${insertSql}${sequenceSql}${countSql}\n`;
}

async function main() {
  const included = [];
  const skipped = [];

  for (const tableName of TABLE_CANDIDATES) {
    const { rows, error } = await fetchTableRows(tableName);

    if (error) {
      skipped.push({
        table: tableName,
        reason: `${error?.code || 'ERR'} ${error?.message || 'unknown error'}`.trim()
      });
      continue;
    }

    if (!rows || rows.length === 0) {
      skipped.push({ table: tableName, reason: 'empty' });
      continue;
    }

    included.push({ table: tableName, rows });
  }

  const header = [
    '-- Full data seed (non-empty and accessible tables)',
    `-- Generated from current Supabase project via ${authMode}`,
    `-- Generated at: ${new Date().toISOString()}`,
    '',
    'BEGIN;',
    ''
  ].join('\n');

  const body = included
    .map(({ table, rows }) => {
      return `-- =============================================\n-- ${table} (${rows.length} rows)\n-- =============================================\n${makeInsertBlock(table, rows)}`;
    })
    .join('\n');

  const footer = ['COMMIT;', ''].join('\n');
  const summary = [
    '-- =============================================',
    '-- Export summary',
    '-- =============================================',
    ...included.map((item) => `-- INCLUDED: ${item.table} (${item.rows.length})`),
    ...skipped.map((item) => `-- SKIPPED: ${item.table} (${item.reason})`),
    ''
  ].join('\n');

  const output = `${header}${body}${footer}\n${summary}`;
  const targetPath = path.join(process.cwd(), 'supabase', 'full_data_seed.sql');
  fs.writeFileSync(targetPath, output, 'utf8');

  console.log(`Wrote: ${targetPath}`);
  console.log(`Included tables: ${included.length}`);
  for (const item of included) console.log(` - ${item.table}: ${item.rows.length}`);
  console.log(`Skipped tables: ${skipped.length}`);
  for (const item of skipped) console.log(` - ${item.table}: ${item.reason}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
