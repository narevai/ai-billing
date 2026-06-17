import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_APP_DIR = path.resolve(__dirname, '..');
const REFERENCE_DIR = path.resolve(DOCS_APP_DIR, 'sdk/ai-billing/reference');
const DOCS_JSON_PATH = path.resolve(DOCS_APP_DIR, 'docs.json');
const SDK_INDEX_MDX_PATH = path.join(DOCS_APP_DIR, 'sdk/ai-billing/index.mdx');

/** Tab containing SDK docs. Use `Open source` when embedded in Narev docs. */
const TARGET_TAB = process.env.DOCS_NAV_TARGET_TAB ?? 'SDKs';
/** Parent nav group for all @ai-billing/* package groups. */
const SDK_GROUP = process.env.DOCS_NAV_SDK_GROUP ?? '@ai-billing SDK';
/**
 * `standalone`: owns the target tab and rebuilds all @ai-billing/* groups (ai-billing repo).
 * `embedded`: replaces only SDK_GROUP within the target tab; preserves other groups (Narev docs).
 */
const NAV_MODE = process.env.DOCS_NAV_MODE ?? 'standalone';

const TYPEDOC_CATEGORIES = new Set([
  'functions',
  'interfaces',
  'type-aliases',
  'classes',
]);

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

  // Rename every README.mdx → index.mdx (root and submodule entry points).
  for (const readmePath of walkFiles(typedocDir, '.mdx')) {
    if (path.basename(readmePath) !== 'README.mdx') continue;
    const indexPath = path.join(path.dirname(readmePath), 'index.mdx');
    if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);
    fs.renameSync(readmePath, indexPath);
  }
}

function typedocCategory(rel) {
  const segments = rel.split('/');
  let category = null;
  if (TYPEDOC_CATEGORIES.has(segments[0])) {
    category = segments[0];
  } else if (segments.length >= 2 && TYPEDOC_CATEGORIES.has(segments[1])) {
    category = segments[1];
  }
  if (!category) return 'other';
  if (category === 'type-aliases') return 'types';
  return category;
}

function buildTypedocPages(typedocDir, pkg) {
  if (!fs.existsSync(typedocDir)) return [];

  const files = [
    ...walkFiles(typedocDir, '.md'),
    ...walkFiles(typedocDir, '.mdx'),
  ];

  const bucketed = {
    readme: [],
    modules: [],
    functions: [],
    interfaces: [],
    types: [],
    classes: [],
    other: [],
  };

  for (const filePath of files) {
    const rel = path.relative(typedocDir, filePath).replace(/\\/g, '/');

    if (/^(README|index)\.(md|mdx)$/.test(rel)) {
      bucketed.readme.push(`sdk/ai-billing/reference/${pkg}/typedoc/index`);
      continue;
    }

    const moduleIndexMatch = rel.match(/^([^/]+)\/(README|index)\.(md|mdx)$/);
    if (moduleIndexMatch) {
      const moduleName = moduleIndexMatch[1];
      bucketed.modules.push(
        `sdk/ai-billing/reference/${pkg}/typedoc/${moduleName}/index`,
      );
      continue;
    }

    const mintPath = toMintPagePath(filePath);
    const bucket = typedocCategory(rel);
    bucketed[bucket].push(mintPath);
  }

  const pages = [];
  pages.push(...[...new Set(bucketed.readme)].sort(sortAlpha));
  pages.push(...[...new Set(bucketed.modules)].sort(sortAlpha));

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

  const indexPage = `sdk/ai-billing/reference/${pkg}/index`;
  const idx = pages.indexOf(indexPage);
  if (idx >= 0) pages.splice(idx, 1);

  pages.sort(sortAlpha);

  if (idx >= 0) pages.unshift(indexPage);
  return pages;
}

const SDK_PARENT_GROUP = SDK_GROUP;

function buildSdkNavGroup() {
  const packages = discoverPackages();
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

  return nestedSdkGroups;
}

function fixSdkIndexLinks() {
  if (!fs.existsSync(SDK_INDEX_MDX_PATH)) return;

  const original = fs.readFileSync(SDK_INDEX_MDX_PATH, 'utf8');
  let updated = original.replace(
    /href="\/reference\//g,
    'href="/sdk/ai-billing/reference/',
  );
  // @ai-billing/core has typedoc only — no handwritten reference/core/index.mdx.
  updated = updated.replace(
    'href="/sdk/ai-billing/reference/core/index"',
    'href="/sdk/ai-billing/reference/core/typedoc/index"',
  );
  if (updated !== original) {
    fs.writeFileSync(SDK_INDEX_MDX_PATH, updated);
    console.log('Updated sdk/ai-billing/index.mdx reference links.');
  }
}

function applyStandaloneNav(tab, nestedSdkGroups) {
  const existingSdkParent = tab.groups.find(
    (g) => g?.group === SDK_PARENT_GROUP,
  );
  const preservedTopLevelPages = existingSdkParent?.pages
    ? existingSdkParent.pages.filter((p) => typeof p === 'string')
    : [];

  const withoutLegacySdkGroups = tab.groups.filter(
    (g) =>
      g?.group !== SDK_PARENT_GROUP && !g?.group?.startsWith('@ai-billing/'),
  );

  if (nestedSdkGroups.length > 0) {
    tab.groups = [
      ...withoutLegacySdkGroups,
      {
        group: SDK_PARENT_GROUP,
        icon: 'npm',
        pages: [...preservedTopLevelPages, ...nestedSdkGroups],
      },
    ];
  } else {
    tab.groups = withoutLegacySdkGroups;
  }
}

function applyEmbeddedNav(tab, nestedSdkGroups) {
  const groupIndex = tab.groups.findIndex((g) => g?.group === SDK_PARENT_GROUP);
  if (groupIndex < 0) {
    throw new Error(
      `${SDK_PARENT_GROUP} group not found in ${TARGET_TAB} tab`,
    );
  }

  const existingSdkParent = tab.groups[groupIndex];
  const preservedTopLevelPages = existingSdkParent?.pages
    ? existingSdkParent.pages.filter((p) => typeof p === 'string')
    : [];

  if (nestedSdkGroups.length === 0) {
    tab.groups.splice(groupIndex, 1);
    return;
  }

  tab.groups[groupIndex] = {
    group: SDK_PARENT_GROUP,
    icon: existingSdkParent.icon ?? 'npm',
    pages: [...preservedTopLevelPages, ...nestedSdkGroups],
  };
}

function syncNavigation() {
  const nestedSdkGroups = buildSdkNavGroup();
  if (nestedSdkGroups.length === 0 && discoverPackages().length === 0) {
    console.log('No packages found in reference/. Nothing to do.');
    return;
  }

  fixSdkIndexLinks();

  const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON_PATH, 'utf8'));
  const tabs = docsJson?.navigation?.tabs;
  if (!Array.isArray(tabs)) {
    throw new Error('docs.json is missing navigation.tabs array');
  }

  const targetTab = tabs.find((tab) => tab?.tab === TARGET_TAB);
  if (!targetTab) {
    throw new Error(`${TARGET_TAB} tab not found in docs.json navigation.tabs`);
  }

  if (!Array.isArray(targetTab.groups)) targetTab.groups = [];

  if (NAV_MODE === 'embedded') {
    applyEmbeddedNav(targetTab, nestedSdkGroups);
  } else if (NAV_MODE === 'standalone') {
    applyStandaloneNav(targetTab, nestedSdkGroups);
  } else {
    throw new Error(
      `Invalid DOCS_NAV_MODE "${NAV_MODE}" (expected standalone or embedded)`,
    );
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
