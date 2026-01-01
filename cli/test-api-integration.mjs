#!/usr/bin/env node

/**
 * API Integration Test Script
 * Tests connectivity and response format from https://api.recoder.xyz
 */

const RECODER_API_BASE = process.env.RECODER_API_URL || 'https://api.recoder.xyz';

console.log('🧪 Recoder API Integration Test\n');
console.log(`📡 Testing API: ${RECODER_API_BASE}\n`);

async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`Testing: ${name}`);
    console.log(`  URL: ${url}`);
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`  Status: ${response.status} ${response.ok ? '✅' : '❌'}`);
    console.log(`  Response: ${JSON.stringify(data).substring(0, 100)}...`);
    console.log('');
    
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.log(`  Error: ❌ ${error.message}`);
    console.log('');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  const results = [];
  
  // Test 1: Pricing endpoint (no auth required)
  results.push(await testEndpoint(
    'Get Pricing Info',
    `${RECODER_API_BASE}/api/cli/ai/pricing`
  ));
  
  // Test 2: Device authorization (start flow)
  results.push(await testEndpoint(
    'Start Device Authorization',
    `${RECODER_API_BASE}/api/auth/cli/authorize`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceInfo: {
          platform: process.platform,
          arch: process.arch,
          hostname: 'test-device'
        }
      })
    }
  ));
  
  // Test 3: Models endpoint (should fail without auth - expected)
  results.push(await testEndpoint(
    'List Models (no auth - should fail)',
    `${RECODER_API_BASE}/api/cli/ai/models`
  ));
  
  // Summary
  console.log('=' .repeat(60));
  console.log('📊 Test Summary\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${results.length}`);
  
  // Expected results
  console.log('\n📋 Expected Results:');
  console.log('  1. Pricing Info: ✅ Should succeed (no auth required)');
  console.log('  2. Device Authorization: ✅ Should succeed (returns device_code)');
  console.log('  3. List Models: ❌ Should fail (401 - no auth token)');
  
  console.log('\n🎯 Integration Status:');
  if (results[0]?.success && results[1]?.success) {
    console.log('  ✅ API is reachable and responding correctly');
    console.log('  ✅ Authentication endpoints working');
    console.log('  ✅ Ready for CLI integration');
  } else {
    console.log('  ⚠️  Some endpoints may not be available');
    console.log('  💡 Check if backend is deployed and accessible');
  }
  
  console.log('\n📚 Next Steps:');
  console.log('  1. Run: npm run build');
  console.log('  2. Run: node dist/index.js auth login');
  console.log('  3. Follow device authorization flow');
  console.log('  4. Run: node dist/index.js ai generate "test"');
}

// Run tests
runTests().catch(console.error);
