#!/usr/bin/env node

/**
 * Code Quality Check Script
 * Runs all code quality tools sequentially and saves output to a timestamped file
 *
 * Usage:
 *   npm run quality              # Run all checks except CodeQL
 *   npm run quality -- --codeql  # Include CodeQL security scan
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const outputDir = join(process.cwd(), 'tmp');
const outputFile = join(outputDir, `code-quality-${timestamp}.txt`);

// Check command line arguments
const args = process.argv.slice(2);
const includeCodeQL = args.includes('--codeql');

// Ensure tmp directory exists
try {
  mkdirSync(outputDir, { recursive: true });
} catch {
  // Directory might already exist
}

const checks = [
  {
    name: 'TypeScript Type Check',
    command: 'npx tsc --noEmit',
    description: 'Checking TypeScript types...',
  },
  {
    name: 'ESLint',
    command: 'npm run lint',
    description: 'Running ESLint...',
  },
  {
    name: 'Markdown Lint',
    command: 'npm run lint:md',
    description: 'Linting markdown files...',
  },
  {
    name: 'Prettier Format Check',
    command: 'npm run format:check',
    description: 'Checking code formatting...',
  },
  {
    name: 'Knip (Unused Code Detection)',
    command: 'npm run knip',
    description: 'Finding unused files, dependencies, and exports...',
  },
  {
    name: 'Build Check',
    command: 'npm run build',
    description: 'Testing production build...',
  },
];

// Optional CodeQL security scan (slower, requires CodeQL installation)
const codeQLCheck = {
  name: 'CodeQL Security Scan',
  command: 'npm run codeql:scan',
  description: 'Running CodeQL security analysis...',
  optional: true,
};

if (includeCodeQL) {
  checks.push(codeQLCheck);
}

let output = '';
let hasErrors = false;

function appendOutput(text) {
  output += text + '\n';
  console.log(text);
}

function runCheck(check) {
  const separator = '='.repeat(80);
  appendOutput(`\n${separator}`);
  appendOutput(`${check.name}`);
  appendOutput(separator);
  appendOutput(`Command: ${check.command}`);
  appendOutput(`Started: ${new Date().toLocaleString()}`);
  appendOutput(separator);

  try {
    const result = execSync(check.command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    appendOutput(result || '✓ No output (success)');
    appendOutput(`\n✓ ${check.name} passed\n`);
    return true;
  } catch (error) {
    appendOutput(error.stdout || '');
    appendOutput(error.stderr || '');
    appendOutput(`\n✗ ${check.name} failed with exit code ${error.status}\n`);
    return false;
  }
}

// Header
appendOutput('Papa\'s Books - Code Quality Report');
appendOutput(`Generated: ${new Date().toLocaleString()}`);
appendOutput(`Working Directory: ${process.cwd()}`);
appendOutput('');

// Run all checks
console.log('\n🔍 Running code quality checks...\n');
for (const check of checks) {
  console.log(`\n${check.description}`);
  const passed = runCheck(check);
  if (!passed) {
    hasErrors = true;
  }
}

// Summary
const separator = '='.repeat(80);
appendOutput(`\n${separator}`);
appendOutput('SUMMARY');
appendOutput(separator);

appendOutput(`Checks run: ${checks.length}`);
appendOutput(`Status: ${hasErrors ? '✗ FAILED' : '✓ PASSED'}`);
appendOutput(`\nResults saved to: ${outputFile}`);
appendOutput(separator);

// Write output to file
writeFileSync(outputFile, output, 'utf8');

console.log(`\n📄 Full report saved to: ${outputFile}\n`);

// Exit with appropriate code
process.exit(hasErrors ? 1 : 0);
