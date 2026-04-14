import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_APP_DIR = path.resolve(__dirname, '..');
const CORE_TYPEDOC_DIR = path.resolve(DOCS_APP_DIR, 'reference/core/typedoc');
const CORE_OVERVIEW_DOC_PATH = path.resolve(DOCS_APP_DIR, 'reference/core/index.mdx');
const CORE_OVERVIEW_PAGE = 'reference/core/index';
const DOCS_JSON_PATH = path.resolve(DOCS_APP_DIR, 'docs.json');

if (!fs.existsSync(DOCS_JSON_PATH)) {
  throw new Error(`Mintlify docs.json not found at ${DOCS_JSON_PATH}`);
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

function sortAlphaCaseInsensitive(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function normalizeTypedocMarkdownOutput() {
  if (!fs.existsSync(CORE_TYPEDOC_DIR)) {
    return;
  }

  const markdownFiles = walkFiles(CORE_TYPEDOC_DIR, '.md');
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
    const mdxPath = filePath.replace(/\.md$/i, '.mdx');
    fs.renameSync(filePath, mdxPath);
  }

  const readmeMdxPath = path.join(CORE_TYPEDOC_DIR, 'README.mdx');
  const indexMdxPath = path.join(CORE_TYPEDOC_DIR, 'index.mdx');
  if (fs.existsSync(readmeMdxPath)) {
    if (fs.existsSync(indexMdxPath)) {
      fs.unlinkSync(indexMdxPath);
    }
    fs.renameSync(readmeMdxPath, indexMdxPath);
  }
}

function buildTypedocReferencePages() {
  if (!fs.existsSync(CORE_TYPEDOC_DIR)) {
    console.warn(`TypeDoc output directory not found at ${CORE_TYPEDOC_DIR}; skipping nav sync.`);
    return [];
  }

  const typedocFiles = [
    ...walkFiles(CORE_TYPEDOC_DIR, '.md'),
    ...walkFiles(CORE_TYPEDOC_DIR, '.mdx'),
  ];
  const bucketed = {
    readme: [],
    functions: [],
    interfaces: [],
    types: [],
    classes: [],
    other: [],
  };

  for (const filePath of typedocFiles) {
    const relativeToTypedoc = path.relative(CORE_TYPEDOC_DIR, filePath).replace(/\\/g, '/');
    const mintPath = toMintPagePath(filePath);
    const [firstSegment] = relativeToTypedoc.split('/');

    if (
      relativeToTypedoc === 'README.md' ||
      relativeToTypedoc === 'README.mdx' ||
      relativeToTypedoc === 'index.md' ||
      relativeToTypedoc === 'index.mdx'
    ) {
      bucketed.readme.push('reference/core/typedoc/index');
      continue;
    }

    if (firstSegment === 'functions') {
      bucketed.functions.push(mintPath);
      continue;
    }

    if (firstSegment === 'interfaces') {
      bucketed.interfaces.push(mintPath);
      continue;
    }

    if (firstSegment === 'type-aliases') {
      bucketed.types.push(mintPath);
      continue;
    }

    if (firstSegment === 'classes') {
      bucketed.classes.push(mintPath);
      continue;
    }

    bucketed.other.push(mintPath);
  }

  const readmePages = [...new Set(bucketed.readme)].sort(sortAlphaCaseInsensitive);
  const functionPages = [...new Set(bucketed.functions)].sort(sortAlphaCaseInsensitive);
  const interfacePages = [...new Set(bucketed.interfaces)].sort(sortAlphaCaseInsensitive);
  const typePages = [...new Set(bucketed.types)].sort(sortAlphaCaseInsensitive);
  const classPages = [...new Set(bucketed.classes)].sort(sortAlphaCaseInsensitive);
  const otherPages = [...new Set(bucketed.other)].sort(sortAlphaCaseInsensitive);

  const pages = [];
  pages.push(...readmePages);

  if (functionPages.length > 0) {
    pages.push({ group: 'Functions', pages: functionPages });
  }

  if (interfacePages.length > 0) {
    pages.push({ group: 'Interfaces', pages: interfacePages });
  }

  if (typePages.length > 0) {
    pages.push({ group: 'Types', pages: typePages });
  }

  if (classPages.length > 0) {
    pages.push({ group: 'Classes', pages: classPages });
  }

  if (otherPages.length > 0) {
    pages.push({ group: 'Other', pages: otherPages });
  }

  return pages;
}

function upsertCoreReferenceGroup() {
  const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON_PATH, 'utf8'));
  const tabs = docsJson?.navigation?.tabs;
  if (!Array.isArray(tabs)) {
    throw new Error('docs.json is missing navigation.tabs array');
  }

  const sdkTab = tabs.find((tab) => tab?.tab === 'SDKs');
  if (!sdkTab) {
    throw new Error('SDKs tab not found in docs.json navigation.tabs');
  }

  if (!Array.isArray(sdkTab.groups)) {
    sdkTab.groups = [];
  }

  let coreGroup = sdkTab.groups.find((group) => group?.group === '@ai-billing/core');
  if (!coreGroup) {
    coreGroup = { group: '@ai-billing/core', pages: [] };
    sdkTab.groups.push(coreGroup);
  }

  if (!Array.isArray(coreGroup.pages)) {
    coreGroup.pages = [];
  }

  if (fs.existsSync(CORE_OVERVIEW_DOC_PATH)) {
    const existingOverviewIndex = coreGroup.pages.findIndex(
      (page) => page === CORE_OVERVIEW_PAGE,
    );

    if (existingOverviewIndex >= 0) {
      coreGroup.pages.splice(existingOverviewIndex, 1);
    }

    coreGroup.pages.unshift(CORE_OVERVIEW_PAGE);
  }

  const referencePages = buildTypedocReferencePages();
  if (referencePages.length === 0) {
    return;
  }

  const referenceGroup = {
    group: 'Reference',
    icon: 'book-open',
    pages: referencePages,
  };

  const existingReferenceIndex = coreGroup.pages.findIndex(
    (page) => page && typeof page === 'object' && page.group === 'Reference',
  );

  if (existingReferenceIndex >= 0) {
    coreGroup.pages[existingReferenceIndex] = referenceGroup;
  } else {
    coreGroup.pages.push(referenceGroup);
  }

  fs.writeFileSync(DOCS_JSON_PATH, `${JSON.stringify(docsJson, null, 2)}\n`);
}

try {
  console.log('Normalizing generated core docs...');
  normalizeTypedocMarkdownOutput();
  console.log('Syncing @ai-billing/core docs navigation...');
  upsertCoreReferenceGroup();

  console.log('Core docs navigation sync complete.');
} catch (err) {
  console.error('Failed to sync docs for @ai-billing/core');
  console.error(err);
  process.exitCode = 1;
}