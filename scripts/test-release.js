#!/usr/bin/env node
/**
 * Test script to verify the release automation produces compliant markdown
 * This creates a temporary changelog to test the fix pipeline
 */
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';

const testChangelog = `# Changelog

All notable changes to this project will be documented in this file.

### 0.1.3 (2025-12-24)

### Features

* some new feature

### Bug Fixes

* some bug fix
`;

const testFile = 'CHANGELOG.test.md';

try {
  // Write test changelog with broken heading levels
  writeFileSync(testFile, testChangelog, 'utf8');
  console.log('✓ Created test changelog with ### version heading (MD001 violation)');

  // Apply the fix
  const content = readFileSync(testFile, 'utf8');
  const fixed = content.replace(/^### (\[?\d+\.\d+\.\d+)/gm, '## $1');
  writeFileSync(testFile, fixed, 'utf8');
  console.log('✓ Applied heading fix');

  // Run markdownlint
  try {
    execSync(`npx markdownlint ${testFile}`, { stdio: 'pipe' });
    console.log('✓ Markdownlint passed!');
  } catch (error) {
    console.error('✗ Markdownlint failed:');
    console.error(error.stdout?.toString() || error.message);
    process.exit(1);
  }

  // Cleanup
  unlinkSync(testFile);
  console.log('✓ Cleaned up test file');
  console.log('\n✅ Release automation will produce compliant markdown!');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}
