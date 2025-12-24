#!/usr/bin/env node
/**
 * Post-processing script for CHANGELOG.md to fix markdownlint violations
 *
 * Problem: standard-version generates version headings as ### (h3) which violates
 * MD001 (heading-increment) since they should be ## (h2) to follow the # (h1) title.
 *
 * Solution: This script runs as a postchangelog hook (see .versionrc.json) to
 * automatically convert ### version headings to ## after standard-version generates
 * the changelog but before the release commit is created.
 *
 * Usage: Automatically invoked by standard-version via .versionrc.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const changelogPath = join(__dirname, '..', 'CHANGELOG.md');

// Read the changelog
let content = readFileSync(changelogPath, 'utf8');

// Fix version headings: Convert ### X.X.X to ## X.X.X
// This regex matches lines like "### 0.1.2 (2025-12-24)" or "### [0.1.2](...)"
content = content.replace(/^### (\[?\d+\.\d+\.\d+)/gm, '## $1');

// Write back
writeFileSync(changelogPath, content, 'utf8');

// Stage the fixed changelog so standard-version includes it in the release commit
execSync('git add CHANGELOG.md', { stdio: 'inherit' });

console.log('✓ Fixed changelog heading levels and staged changes');
