import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = path.resolve(__dirname, '../../../packages');
const DOCS_OUTPUT_DIR = path.resolve(__dirname, '../ai-billing');
const MINT_JSON_PATH = path.resolve(__dirname, '../mint.json');

// 1. Find all valid packages
const packages = fs.readdirSync(PACKAGES_DIR).filter(folder => {
  const isDir = fs.statSync(path.join(PACKAGES_DIR, folder)).isDirectory();
  const hasIndex = fs.existsSync(path.join(PACKAGES_DIR, folder, 'src/index.ts'));
  return isDir && hasIndex;
});

console.log(`Found packages to document: ${packages.join(', ')}`);

// 2. Generate MDX for each package
packages.forEach(pkg => {
  const pkgPath = path.join(PACKAGES_DIR, pkg);
  const tempConfigPath = path.join(pkgPath, 'mint-tsdocs.config.json');

  // Dynamically create the config for this specific package
  const config = {
    entryPoint: "./dist/index.d.ts",
    outputFolder: path.relative(pkgPath, path.join(DOCS_OUTPUT_DIR, pkg)),
    docsJson: path.relative(pkgPath, MINT_JSON_PATH),
    tabName: "API Reference",
    groupName: `@ai-billing/${pkg}`
  };

  try {
    // Write the temp config into the package
    fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));
    
    console.log(`Generating Mintlify components for: ${pkg}`);
    // Run the engine from within the package directory
    execSync(`npx mint-tsdocs generate --yes`, { cwd: pkgPath, stdio: 'inherit' });

  } catch (err) {
    console.error(`Failed to generate docs for ${pkg}`);
    console.error(err);
  } finally {
    // Clean up: Leave no trace in the package
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  }
});

console.log('SDK Reference Generation Complete.');