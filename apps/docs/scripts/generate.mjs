import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_APP_DIR = path.resolve(__dirname, '..');
const REFERENCE_DIR = path.resolve(DOCS_APP_DIR, 'reference');
const DOCS_JSON_PATH = path.resolve(DOCS_APP_DIR, 'docs.json');

if (!fs.existsSync(DOCS_JSON_PATH)) {
  throw new Error(`Mintlify docs.json not found at ${DOCS_JSON_PATH}`);
}

function discoverPackages() {
  if (!fs.existsSync(REFERENCE_DIR)) return [];
  return fs
    .readdirSync(REFERENCE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function walkFiles(dir, extension, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, extension, results);
    } else if (entry.isFile() && fullPath.endsWith(extension)) {
      results.push(fullPath);
    }
  }
  return results;
}

function toMintPagePath(absPath) {
  const relativePath = path.relative(DOCS_APP_DIR, absPath);
  return relativePath.replace(/\\/g, '/').replace(/\.mdx?$/i, '');
}

function sortAlpha(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function normalizeTypedocOutput(typedocDir) {
  if (!fs.existsSync(typedocDir)) return;

  const markdownFiles = walkFiles(typedocDir, '.md');
  for (const filePath of markdownFiles) {
    const original = fs.readFileSync(filePath, 'utf8');
    let updated = original.replace(
      /\(([^)]+)\.md(#[^)]+)?\)/g,
      (_match, basePath, hash = '') => `(${basePath}${hash})`,
    );
    updated = updated.replace(
      /\(([^)#]*\/)?README(#[^)]+)?\)/g,
      (_match, prefix = '', hash = '') => `(${prefix}index${hash})`,
    );
    if (updated !== original) {
      fs.writeFileSync(filePath, updated);
    }
  }

  for (const filePath of markdownFiles) {
    fs.renameSync(filePath, filePath.replace(/\.md$/i, '.mdx'));
  }

  const readmeMdxPath = path.join(typedocDir, 'README.mdx');
  const indexMdxPath = path.join(typedocDir, 'index.mdx');
  if (fs.existsSync(readmeMdxPath)) {
    if (fs.existsSync(indexMdxPath)) fs.unlinkSync(indexMdxPath);
    fs.renameSync(readmeMdxPath, indexMdxPath);
  }
}

function buildTypedocPages(typedocDir, pkg) {
  if (!fs.existsSync(typedocDir)) return [];

  const files = [
    ...walkFiles(typedocDir, '.md'),
    ...walkFiles(typedocDir, '.mdx'),
  ];

  const bucketed = {
    readme: [],
    functions: [],
    interfaces: [],
    types: [],
    classes: [],
    other: [],
  };

  for (const filePath of files) {
    const rel = path.relative(typedocDir, filePath).replace(/\\/g, '/');
    const mintPath = toMintPagePath(filePath);
    const [firstSegment] = rel.split('/');

    if (/^(README|index)\.(md|mdx)$/.test(rel)) {
      bucketed.readme.push(`reference/${pkg}/typedoc/index`);
      continue;
    }

    const bucket =
      firstSegment === 'functions'
        ? 'functions'
        : firstSegment === 'interfaces'
          ? 'interfaces'
          : firstSegment === 'type-aliases'
            ? 'types'
            : firstSegment === 'classes'
              ? 'classes'
              : 'other';
    bucketed[bucket].push(mintPath);
  }

  const pages = [];
  pages.push(...[...new Set(bucketed.readme)].sort(sortAlpha));

  const groups = [
    { key: 'functions', label: 'Functions' },
    { key: 'interfaces', label: 'Interfaces' },
    { key: 'types', label: 'Types' },
    { key: 'classes', label: 'Classes' },
    { key: 'other', label: 'Other' },
  ];

  for (const { key, label } of groups) {
    const sorted = [...new Set(bucketed[key])].sort(sortAlpha);
    if (sorted.length > 0) {
      pages.push({ group: label, pages: sorted });
    }
  }

  return pages;
}

/*
 * Collects handwritten `.mdx` pages directly inside `reference/<pkg>/`
 * (excludes the `typedoc/` subdirectory). Returns them ordered with
 * `index` first, then alphabetically.
 */
function buildHandwrittenPages(pkgDir, pkg) {
  if (!fs.existsSync(pkgDir)) return [];

  const pages = [];
  for (const entry of fs.readdirSync(pkgDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue;
    pages.push(toMintPagePath(path.join(pkgDir, entry.name)));
  }

  const indexPage = `reference/${pkg}/index`;
  const idx = pages.indexOf(indexPage);
  if (idx >= 0) pages.splice(idx, 1);

  pages.sort(sortAlpha);

  if (idx >= 0) pages.unshift(indexPage);
  return pages;
}

const SDK_PARENT_GROUP = '@ai-billing SDK';

function syncNavigation() {
  const packages = discoverPackages();
  if (packages.length === 0) {
    console.log('No packages found in reference/. Nothing to do.');
    return;
  }

  const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON_PATH, 'utf8'));
  const tabs = docsJson?.navigation?.tabs;
  if (!Array.isArray(tabs)) {
    throw new Error('docs.json is missing navigation.tabs array');
  }

  const sdkTab = tabs.find((tab) => tab?.tab === 'SDKs');
  if (!sdkTab) {
    throw new Error('SDKs tab not found in docs.json navigation.tabs');
  }

  if (!Array.isArray(sdkTab.groups)) sdkTab.groups = [];

  const nestedSdkGroups = [];

  for (const pkg of packages.sort(sortAlpha)) {
    const pkgDir = path.join(REFERENCE_DIR, pkg);
    const typedocDir = path.join(pkgDir, 'typedoc');
    const groupName = `@ai-billing/${pkg}`;

    console.log(`Processing ${groupName}...`);

    normalizeTypedocOutput(typedocDir);

    const handwritten = buildHandwrittenPages(pkgDir, pkg);
    const typedocPages = buildTypedocPages(typedocDir, pkg);

    const groupPages = [...handwritten];

    if (typedocPages.length > 0) {
      groupPages.push({
        group: 'Reference',
        icon: 'book-open',
        pages: typedocPages,
      });
    }

    if (groupPages.length === 0) continue;

    nestedSdkGroups.push({
      group: groupName,
      pages: groupPages,
    });
  }

  const withoutLegacySdkGroups = sdkTab.groups.filter(
    (g) =>
      g?.group !== SDK_PARENT_GROUP && !g?.group?.startsWith('@ai-billing/'),
  );

  if (nestedSdkGroups.length > 0) {
    sdkTab.groups = [
      ...withoutLegacySdkGroups,
      {
        group: SDK_PARENT_GROUP,
        icon: 'npm',
        pages: nestedSdkGroups,
      },
    ];
  } else {
    sdkTab.groups = withoutLegacySdkGroups;
  }

  fs.writeFileSync(DOCS_JSON_PATH, `${JSON.stringify(docsJson, null, 2)}\n`);
}

try {
  syncNavigation();
  console.log('Docs navigation sync complete.');
} catch (err) {
  console.error('Failed to sync docs navigation');
  console.error(err);
  process.exitCode = 1;
}
