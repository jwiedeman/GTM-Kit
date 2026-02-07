#!/usr/bin/env node
/**
 * Prepares packages for npm publishing by converting workspace:* dependencies
 * to actual version numbers.
 *
 * This script is run as part of the semantic-release prepare phase.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Packages that have workspace dependencies
const packagesWithDeps = ['react-modern', 'react-legacy', 'next', 'remix', 'vue', 'nuxt', 'svelte', 'solid', 'astro'];

// Map of workspace package names to their directories
const packageMap = {
  '@jwiedeman/gtm-kit': 'core',
  '@jwiedeman/gtm-kit-vue': 'vue'
};

// Get version from root package.json (already updated by semantic-release)
// All packages in this monorepo share the same version
function getReleaseVersion() {
  const pkgPath = join(rootDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

const releaseVersion = getReleaseVersion();
console.log(`Release version: ${releaseVersion}\n`);

function updatePackageDeps(packageDir) {
  const pkgPath = join(rootDir, 'packages', packageDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  let modified = false;

  if (pkg.dependencies) {
    for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
      if (depVersion === 'workspace:*') {
        const depDir = packageMap[depName];
        if (depDir) {
          // Use the release version from root package.json
          pkg.dependencies[depName] = `^${releaseVersion}`;
          console.log(`  ${depName}: workspace:* -> ^${releaseVersion}`);
          modified = true;
        }
      }
    }
  }

  if (modified) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  return modified;
}

console.log('Preparing packages for npm publish...\n');

for (const packageDir of packagesWithDeps) {
  console.log(`Processing packages/${packageDir}:`);
  const modified = updatePackageDeps(packageDir);
  if (!modified) {
    console.log('  No workspace:* dependencies found');
  }
  console.log('');
}

console.log('Done!');
