const fs = require('fs');
const path = require('path');

const root = process.cwd();

const TEMPLATE_SQL = path.join(root, 'supabase', 'migrations', '20260217180000_email_system_complete.sql');
const SERVICE_DIR = path.join(root, 'src', 'services');

const ALLOWED_EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'build') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (ALLOWED_EXT.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function extractTemplates(sql) {
  const templates = new Map();
  const re = /\$k(\d+)\$([^$]+)\$k\1\$,[\s\S]*?\$s\1\$([\s\S]*?)\$s\1\$,[\s\S]*?\$b\1\$([\s\S]*?)\$b\1\$/g;
  let m;
  while ((m = re.exec(sql))) {
    const key = m[2];
    const subject = m[3];
    const body = m[4];
    const placeholders = new Set();
    for (const source of [subject, body]) {
      const phRe = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
      let p;
      while ((p = phRe.exec(source))) placeholders.add(p[1]);
    }
    templates.set(key, {
      key,
      placeholders: [...placeholders].sort()
    });
  }
  return templates;
}

function lineNumberForIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function readBalanced(text, startIndex, openChar, closeChar) {
  if (text[startIndex] !== openChar) {
    throw new Error(`Expected '${openChar}' at index ${startIndex}`);
  }

  let depth = 0;
  let quote = null;
  let escape = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === openChar) depth += 1;
    if (ch === closeChar) depth -= 1;

    if (depth === 0) {
      return {
        start: startIndex,
        end: i,
        text: text.slice(startIndex, i + 1)
      };
    }
  }

  throw new Error(`Unclosed ${openChar}${closeChar} block`);
}

function splitTopLevelObjectEntries(objectText) {
  const inner = objectText.slice(1, -1);
  const parts = [];
  let start = 0;
  let depthBrace = 0;
  let depthParen = 0;
  let depthBracket = 0;
  let quote = null;
  let escape = false;

  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') depthBrace += 1;
    else if (ch === '}') depthBrace -= 1;
    else if (ch === '(') depthParen += 1;
    else if (ch === ')') depthParen -= 1;
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']') depthBracket -= 1;
    else if (ch === ',' && depthBrace === 0 && depthParen === 0 && depthBracket === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(inner.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function extractObjectPropertyKeys(objectText) {
  const keys = [];
  for (const entry of splitTopLevelObjectEntries(objectText)) {
    const match = entry.match(/^([A-Za-z_$][\w$]*)\s*:/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

function parseSendEmailCalls(filePath, source) {
  const calls = [];
  let cursor = 0;

  while (true) {
    const callIndex = source.indexOf('sendEmail(', cursor);
    if (callIndex === -1) break;

    const objectStart = source.indexOf('{', callIndex);
    if (objectStart === -1) break;

    let callObject;
    try {
      callObject = readBalanced(source, objectStart, '{', '}');
    } catch {
      cursor = callIndex + 8;
      continue;
    }

    const objectText = callObject.text;
    const templateKeyMatch = objectText.match(/\btemplateKey\s*:\s*'([^']+)'/);
    const legacyTemplateMatch = objectText.match(/\btemplate\s*:\s*'([^']+)'/);

    const varsIndex =
      objectText.search(/\bvariables\s*:\s*{/) !== -1
        ? objectText.search(/\bvariables\s*:\s*{/)
        : objectText.search(/\bdata\s*:\s*{/);

    let varsKind = null;
    let varsKeys = [];
    if (varsIndex !== -1) {
      const varsHeader = objectText.slice(varsIndex);
      const headerMatch = varsHeader.match(/\b(variables|data)\s*:\s*/);
      if (headerMatch) {
        varsKind = headerMatch[1];
        const braceIndex = varsIndex + headerMatch[0].length;
        if (objectText[braceIndex] === '{') {
          try {
            const varsObject = readBalanced(objectText, braceIndex, '{', '}');
            varsKeys = extractObjectPropertyKeys(varsObject.text);
          } catch {
            varsKeys = [];
          }
        }
      }
    }

    calls.push({
      filePath,
      line: lineNumberForIndex(source, callIndex),
      templateKey: templateKeyMatch ? templateKeyMatch[1] : null,
      legacyTemplate: legacyTemplateMatch ? legacyTemplateMatch[1] : null,
      varsKind,
      varsKeys
    });

    cursor = callObject.end + 1;
  }

  return calls;
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function main() {
  if (!fs.existsSync(TEMPLATE_SQL)) {
    console.error(`Template SQL file not found: ${TEMPLATE_SQL}`);
    process.exit(1);
  }

  const templates = extractTemplates(readFile(TEMPLATE_SQL));
  const files = walk(SERVICE_DIR);
  const calls = files.flatMap((filePath) => parseSendEmailCalls(filePath, readFile(filePath)));

  const issues = [];
  const warnings = [];
  const checked = [];

  for (const call of calls) {
    if (call.legacyTemplate) {
      warnings.push(`${rel(call.filePath)}:${call.line} uses legacy 'template' parameter ('${call.legacyTemplate}')`);
    }

    if (!call.templateKey) continue;

    const template = templates.get(call.templateKey);
    if (!template) {
      issues.push(`${rel(call.filePath)}:${call.line} unknown templateKey '${call.templateKey}'`);
      continue;
    }

    const missing = template.placeholders.filter((name) => !call.varsKeys.includes(name));
    if (missing.length > 0) {
      issues.push(
        `${rel(call.filePath)}:${call.line} template '${call.templateKey}' missing variables: ${missing.join(', ')}`
      );
    }

    checked.push({ call, template });
  }

  console.log(`Templates in SQL: ${templates.size}`);
  console.log(`sendEmail() calls scanned: ${calls.length}`);
  console.log(`Calls with static templateKey checked: ${checked.length}`);

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  if (issues.length > 0) {
    console.log('\nIssues:');
    for (const issue of issues) console.log(`- ${issue}`);
    process.exit(1);
  }

  console.log('\nOK: all checked email calls reference existing templates and include required placeholders.');
}

main();
