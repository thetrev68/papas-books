import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Generates a large CSV file for import testing
 */
function generateLargeCSV() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log("║   Papa's Books - Large CSV Generator                        ║");
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const rowCount = parseInt(process.env.ROW_COUNT || process.argv[2] || '5000', 10);
  const outputPath = process.env.OUTPUT_PATH || process.argv[3] || 'test-data-large.csv';

  console.log(`📊 Configuration:`);
  console.log(`   Row Count: ${rowCount.toLocaleString()}`);
  console.log(`   Output: ${outputPath}\n`);

  const merchants = [
    'STARBUCKS',
    'AMAZON.COM',
    'WALMART',
    'TARGET',
    'COSTCO',
    'WHOLE FOODS',
    'TRADER JOES',
    'SHELL GAS',
    'CHEVRON',
    'AT&T',
    'VERIZON',
    'NETFLIX',
    'SPOTIFY',
    'APPLE.COM',
    'MICROSOFT',
    'GOOGLE',
    'UBER',
    'LYFT',
    'DOORDASH',
    'GRUBHUB',
    'HOME DEPOT',
    'LOWES',
    'BEST BUY',
    'MCDONALDS',
    'CHIPOTLE',
    'PANERA BREAD',
    'SUBWAY',
    'DOMINOS',
    'PIZZA HUT',
    'CVS PHARMACY',
  ];

  console.log('🚀 Generating CSV data...\n');

  // CSV header
  const lines = ['Date,Description,Amount'];

  // Generate rows
  for (let i = 0; i < rowCount; i++) {
    // Random date in 2024
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 11, 31);
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    const dateStr = date.toISOString().split('T')[0];

    // Random merchant and amount
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
    const storeNumber = Math.floor(Math.random() * 99999);
    const description = `${merchant} #${storeNumber}`;
    const amount = (Math.random() * 200 - 100).toFixed(2); // -$100 to $100

    lines.push(`${dateStr},"${description}",${amount}`);

    if ((i + 1) % 1000 === 0) {
      const progress = (((i + 1) / rowCount) * 100).toFixed(1);
      console.log(
        `   Progress: ${(i + 1).toLocaleString()}/${rowCount.toLocaleString()} (${progress}%)`
      );
    }
  }

  // Write to file
  const csvContent = lines.join('\n');
  const fullPath = join(process.cwd(), outputPath);
  writeFileSync(fullPath, csvContent, 'utf-8');

  const fileSizeKB = Math.round(csvContent.length / 1024);
  const fileSizeMB = (fileSizeKB / 1024).toFixed(2);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   CSV Generation Complete                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Generated: ${rowCount.toLocaleString()} rows`);
  console.log(`📁 File: ${fullPath}`);
  console.log(`📊 Size: ${fileSizeKB.toLocaleString()} KB (${fileSizeMB} MB)\n`);
  console.log('Next Steps:');
  console.log('  1. Open the app and navigate to Import page');
  console.log('  2. Upload the generated CSV file');
  console.log('  3. Time the import process');
  console.log('  4. Document the results in docs/performance-test-results.md\n');
}

// Run the script
try {
  generateLargeCSV();
} catch (error) {
  console.error('Fatal error:', error);
  process.exit(1);
}
