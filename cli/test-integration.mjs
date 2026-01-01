#!/usr/bin/env node

/**
 * Integration Test Script for Recoder CLI Backend
 * Tests authentication and AI service endpoints
 */

import { RecoderAuthService } from './src/services/RecoderAuthService.js';
import { RecoderAIService } from './src/services/RecoderAIService.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60) + '\n');
}

async function testAuth() {
  section('🔐 Testing Authentication Service');

  const authService = new RecoderAuthService();

  // Test 1: Check authentication status
  log('Test 1: Check authentication status...', 'yellow');
  const isAuth = await authService.isAuthenticated();
  if (isAuth) {
    log('✅ Authenticated', 'green');
  } else {
    log('❌ Not authenticated (expected if not logged in)', 'gray');
  }

  // Test 2: Get user info (if authenticated)
  if (isAuth) {
    log('\nTest 2: Get user info...', 'yellow');
    try {
      const user = await authService.getUser();
      if (user) {
        log('✅ User info retrieved:', 'green');
        console.log(JSON.stringify(user, null, 2));
      }
    } catch (error) {
      log(`❌ Failed: ${error.message}`, 'red');
    }

    // Test 3: Get quota
    log('\nTest 3: Get quota info...', 'yellow');
    try {
      const quota = await authService.getQuota();
      if (quota) {
        log('✅ Quota retrieved:', 'green');
        console.log(JSON.stringify(quota, null, 2));
      }
    } catch (error) {
      log(`❌ Failed: ${error.message}`, 'red');
    }
  }

  return isAuth;
}

async function testAI() {
  section('🤖 Testing AI Service');

  const aiService = new RecoderAIService();
  const authService = new RecoderAuthService();

  // Check if authenticated
  const isAuth = await authService.isAuthenticated();
  if (!isAuth) {
    log('⚠️  Skipping AI tests - not authenticated', 'yellow');
    log('Run: recoder-code auth login', 'gray');
    return;
  }

  // Test 1: Simple code generation
  log('Test 1: Generate simple code...', 'yellow');
  try {
    const response = await aiService.generateCode({
      prompt: 'Write a function that adds two numbers',
      language: 'javascript',
      maxTokens: 500,
      temperature: 0.7,
    });

    if (response.success) {
      log('✅ Code generation successful', 'green');
      console.log('\nGenerated code:');
      console.log(colors.gray + '─'.repeat(60));
      console.log(response.data?.code || response.data?.content || 'No code returned');
      console.log('─'.repeat(60) + colors.reset);

      if (response.data?.metadata) {
        const m = response.data.metadata;
        log(`\n📊 Metadata:`, 'blue');
        console.log(`   Cost: $${m.costUSD?.toFixed(4) || '0.0000'}`);
        console.log(`   Budget: ${m.budgetPercent?.toFixed(1) || '0'}% used`);
        console.log(`   Remaining: $${m.remainingBudget?.toFixed(4) || '0.0000'}`);
      }
    } else {
      log('❌ Code generation failed', 'red');
      console.log(response);
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  }

  // Test 2: Get usage statistics
  log('\nTest 2: Get usage statistics...', 'yellow');
  try {
    const stats = await aiService.getUsageStats();
    log('✅ Usage stats retrieved:', 'green');
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    log(`❌ Failed: ${error.message}`, 'red');
  }

  // Test 3: Get model recommendations
  log('\nTest 3: Get model recommendations...', 'yellow');
  try {
    const recommendations = await aiService.getModelRecommendations('code-generation');
    log('✅ Recommendations retrieved:', 'green');
    console.log(JSON.stringify(recommendations, null, 2));
  } catch (error) {
    log(`❌ Failed: ${error.message}`, 'red');
  }

  // Test 4: Check budget
  log('\nTest 4: Check budget availability...', 'yellow');
  try {
    const hasBudget = await aiService.hasBudget();
    if (hasBudget) {
      log('✅ Budget available', 'green');
    } else {
      log('⚠️  No budget remaining', 'yellow');
    }
  } catch (error) {
    log(`❌ Failed: ${error.message}`, 'red');
  }
}

async function testEndpoints() {
  section('🌐 Testing Backend Endpoints');

  const baseUrl = process.env.RECODER_API_URL || 'https://recoder.xyz';
  log(`Base URL: ${baseUrl}`, 'gray');

  // Test health endpoint (if exists)
  log('\nTest 1: Health check...', 'yellow');
  try {
    const response = await fetch(`${baseUrl}/api/health`).catch(() => null);
    if (response && response.ok) {
      log('✅ Backend is reachable', 'green');
    } else {
      log('⚠️  Health endpoint not found (may not exist)', 'gray');
    }
  } catch (error) {
    log(`⚠️  Could not reach backend: ${error.message}`, 'gray');
  }

  // Test auth endpoint (without credentials)
  log('\nTest 2: Auth endpoint accessibility...', 'yellow');
  try {
    const response = await fetch(`${baseUrl}/api/auth/cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flow: 'test' }),
    });

    if (response.status === 400 || response.status === 401) {
      log('✅ Auth endpoint exists (expected 400/401 without valid data)', 'green');
    } else {
      log(`⚠️  Unexpected status: ${response.status}`, 'yellow');
    }
  } catch (error) {
    log(`❌ Auth endpoint error: ${error.message}`, 'red');
  }

  // Test AI endpoint (without auth)
  log('\nTest 3: AI endpoint accessibility...', 'yellow');
  try {
    const response = await fetch(`${baseUrl}/api/cli/ai/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' }),
    });

    if (response.status === 401) {
      log('✅ AI endpoint exists (expected 401 without auth)', 'green');
    } else {
      log(`⚠️  Unexpected status: ${response.status}`, 'yellow');
    }
  } catch (error) {
    log(`❌ AI endpoint error: ${error.message}`, 'red');
  }
}

async function main() {
  console.clear();
  log('🧪 Recoder CLI Backend Integration Tests', 'blue');
  log('==========================================\n', 'blue');

  try {
    // Test endpoints
    await testEndpoints();

    // Test authentication
    const isAuth = await testAuth();

    // Test AI service (only if authenticated)
    await testAI();

    // Summary
    section('✅ Test Summary');
    if (isAuth) {
      log('All authenticated tests completed!', 'green');
      log('Check output above for any failures.', 'gray');
    } else {
      log('Endpoint tests completed!', 'green');
      log('Login to test authenticated features:', 'yellow');
      log('  recoder-code auth login', 'gray');
    }
  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

main();
