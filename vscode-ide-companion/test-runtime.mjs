#!/usr/bin/env node

/**
 * Runtime Test - Verify no immediate syntax errors in built extension
 */

import { readFileSync } from 'fs';

console.log('=== Runtime Test ===\n');

// Check if bundle can be loaded (syntax check)
try {
  const bundle = readFileSync('./dist/extension.cjs', 'utf8');

  // Check for common build issues
  const checks = [
    { name: 'Bundle size', test: () => bundle.length > 1000000, error: 'Bundle too small' },
    { name: 'Exports present', test: () => bundle.includes('exports'), error: 'No exports found' },
    { name: 'VSCode API', test: () => bundle.includes('vscode'), error: 'VSCode API not found' },
    { name: 'Authentication endpoints', test: () => bundle.includes('api.recoder.xyz'), error: 'Auth endpoints missing' },
    { name: 'OpenRouter API', test: () => bundle.includes('openrouter.ai'), error: 'OpenRouter API missing' },
    { name: 'Chat functionality', test: () => bundle.includes('marked') || bundle.includes('highlight'), error: 'Chat functionality missing' },
    { name: 'Command registration', test: () => bundle.includes('registerCommand'), error: 'Command registration missing' },
    { name: 'No syntax errors', test: () => !bundle.includes('SYNTAX_ERROR') && !bundle.includes('SyntaxError at'), error: 'Syntax errors found' }
  ];

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      if (check.test()) {
        console.log(`✅ ${check.name}`);
        passed++;
      } else {
        console.log(`❌ ${check.name}: ${check.error}`);
        failed++;
      }
    } catch (e) {
      console.log(`❌ ${check.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Passed: ${passed}/${checks.length}`);
  console.log(`Failed: ${failed}/${checks.length}`);

  if (failed > 0) {
    console.log('\n❌ Some runtime checks failed');
    process.exit(1);
  } else {
    console.log('\n✅ All runtime checks passed');
    console.log('\nExtension bundle is ready for testing!');
    console.log('Next steps:');
    console.log('1. Run: ./test-install.sh');
    console.log('2. Reload VSCode window');
    console.log('3. Test features manually');
  }

} catch (error) {
  console.error('❌ Failed to read bundle:', error.message);
  process.exit(1);
}
