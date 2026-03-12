/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(process.cwd(), 'build');
const REQUIRED_FILES = [
  'index.html',
  '.htaccess',
  'robots.txt',
  'sitemap.xml',
];

function fail(message) {
  throw new Error(message);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    fail(`${label} manquant: ${needle}`);
  }
}

function listPrerenderedAnnoncePages(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === 'index.html') {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

function verifyPrerenderedPage(filePath) {
  const html = readUtf8(filePath);

  assertIncludes(html, '<div id="root"><div', `${filePath} root prerendu`);
  assertIncludes(html, '<link rel="canonical"', `${filePath} canonical`);
  assertIncludes(html, '<meta name="robots" content="index, follow', `${filePath} robots`);
  assertIncludes(html, 'application/ld+json', `${filePath} JSON-LD`);

  if (html.includes('"latitude":0,"longitude":0')) {
    fail(`${filePath} contient des coordonnees 0,0 suspectes dans le JSON-LD.`);
  }
}

function main() {
  if (!fs.existsSync(BUILD_DIR)) {
    fail("Dossier build/ introuvable. Lancez d'abord le build.");
  }

  for (const relPath of REQUIRED_FILES) {
    const absPath = path.join(BUILD_DIR, relPath);
    if (!fs.existsSync(absPath)) {
      fail(`Artefact SEO manquant: build/${relPath}`);
    }
  }

  const robots = readUtf8(path.join(BUILD_DIR, 'robots.txt'));
  const sitemap = readUtf8(path.join(BUILD_DIR, 'sitemap.xml'));
  const shellHtml = readUtf8(path.join(BUILD_DIR, 'index.html'));
  const locationUrlCount = (sitemap.match(/<loc>https:\/\/www\.lematosduvoisin\.fr\/location\//g) || []).length;

  assertIncludes(robots, 'Sitemap:', 'robots.txt');
  assertIncludes(sitemap, '<urlset', 'sitemap.xml');
  assertIncludes(shellHtml, '<script type="application/ld+json">', 'index.html fallback JSON-LD');

  const prerenderedPages = listPrerenderedAnnoncePages(path.join(BUILD_DIR, 'location'));
  if (prerenderedPages.length === 0) {
    if (locationUrlCount > 0) {
      fail('Le sitemap contient des URLs /location/ mais aucun prerender annonce n\'a ete trouve dans build/location.');
    }
    console.warn('[seo:verify] Aucun prerender annonce trouve dans build/location (possible si aucune annonce indexable).');
  } else {
    prerenderedPages.slice(0, 5).forEach(verifyPrerenderedPage);
  }

  console.log(`[seo:verify] OK - fichiers verifies, annonces prerendees detectees: ${prerenderedPages.length}`);
}

main();
