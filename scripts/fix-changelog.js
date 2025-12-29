#!/usr/bin/env node
/**
 * Post-processing script for CHANGELOG.md to fix markdownlint violations
 *
 * Problems this script fixes:
 * 1. Version headings as ### (h3) instead of ## (h2) - violates MD001
 * 2. Missing blank lines before lists (from commit bodies) - violates MD032
 * 3. Missing blank lines after h3 headings (from commit bodies) - violates MD022
 * 4. Duplicate h2/h3 headings across versions - violates MD024
 *
 * Solution: This script runs as a postchangelog hook (see .versionrc.json) to
 * automatically fix formatting issues after standard-version generates the changelog.
 *
 * Usage: Automatically invoked by standard-version via .versionrc.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const changelogPath = join(__dirname, '..', 'CHANGELOG.md');

// Read the changelog
let content = readFileSync(changelogPath, 'utf8');

// Fix 1: Convert ### version headings to ## (h2)
content = content.replace(/^### (\[?\d+\.\d+\.\d+)/gm, '## $1');

// Work with lines array for more precise control
const lines = content.split('\n');
const fixed = [];
const h2Headings = new Map(); // Track h2 headings for duplicate detection
const versionPattern = /^## \[?(\d+\.\d+\.\d+)/;
let currentVersion = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const prevLine = i > 0 ? lines[i - 1] : null;
  const nextLine = i < lines.length - 1 ? lines[i + 1] : null;

  // Track current version
  const versionMatch = line.match(versionPattern);
  if (versionMatch) {
    currentVersion = versionMatch[1];
  }

  // Fix 2: Ensure blank line after h3 headings when followed by non-blank
  if (line.startsWith('### ') && nextLine && nextLine.trim() !== '') {
    fixed.push(line);
    fixed.push(''); // Add blank line
    continue;
  }

  // Fix 3: Ensure blank line before lists when missing
  if (line.startsWith('* ') && prevLine && prevLine.trim() !== '' && !prevLine.startsWith('* ') && !prevLine.startsWith('#')) {
    fixed.push(''); // Add blank line before list
  }

  // Fix 4: Rename duplicate h2 headings (but not version headings)
  if (line.startsWith('## ') && !versionPattern.test(line)) {
    const headingText = line.substring(3).trim();

    if (h2Headings.has(headingText)) {
      // Duplicate found - append version context
      if (currentVersion) {
        fixed.push(`## ${headingText} (${currentVersion})`);
        continue;
      }
    } else {
      h2Headings.set(headingText, i);
    }
  }

  fixed.push(line);
}

content = fixed.join('\n');

// Write back
writeFileSync(changelogPath, content, 'utf8');

console.log('✓ Fixed changelog formatting issues');
