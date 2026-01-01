#!/usr/bin/env node

/**
 * Verification script for Phase 2: Enhanced Model Management
 * 
 * This script tests all new commands to ensure they work correctly
 */

import { modelRecommendCommand } from './dist/src/ui/commands/modelRecommendCommand.js';
import { recentModelsCommand, recordModelUsage } from './dist/src/ui/commands/recentModelsCommand.js';
import { compareModelsCommand } from './dist/src/ui/commands/compareModelsCommand.js';

console.log('🔍 Verifying Enhanced Model Management Features\n');

// Test 1: Model Recommendations
console.log('1️⃣  Testing /recommend command...');
const recommendContext = {
  invocation: { args: 'coding' },
};
const recommendResult = await modelRecommendCommand.action?.(recommendContext);

if (recommendResult?.content?.includes('Claude') && recommendResult?.content?.includes('/add-model')) {
  console.log('   ✅ /recommend working correctly\n');
} else {
  console.log('   ❌ /recommend failed\n');
  process.exit(1);
}

// Test 2: Model Comparison
console.log('2️⃣  Testing /compare command...');
const compareContext = {
  invocation: { args: 'claude gpt-4o' },
};
const compareResult = await compareModelsCommand.action?.(compareContext);

if (compareResult?.content?.includes('Context Length') && compareResult?.content?.includes('Pricing')) {
  console.log('   ✅ /compare working correctly\n');
} else {
  console.log('   ❌ /compare failed\n');
  process.exit(1);
}

// Test 3: Recent Models
console.log('3️⃣  Testing /recent command...');

// Record some usage
recordModelUsage('test-model-1', 'Test Model 1', 1000, 0.05);
recordModelUsage('test-model-2', 'Test Model 2', 2000, 0.10);

const recentContext = {
  invocation: { args: '' },
};
const recentResult = await recentModelsCommand.action?.(recentContext);

if (recentResult?.content) {
  console.log('   ✅ /recent working correctly\n');
} else {
  console.log('   ❌ /recent failed\n');
  process.exit(1);
}

// Test 4: Edge Cases
console.log('4️⃣  Testing edge cases...');

// Test invalid task type
const invalidContext = {
  invocation: { args: 'invalid-task' },
};
const invalidTask = await modelRecommendCommand.action?.(invalidContext);

if (invalidTask?.messageType === 'error') {
  console.log('   ✅ Error handling working correctly\n');
} else {
  console.log('   ❌ Error handling failed\n');
  process.exit(1);
}

// Test 5: All Task Types
console.log('5️⃣  Testing all task types...');
const taskTypes = ['coding', 'reasoning', 'chat', 'vision', 'speed', 'cost'];
let allTasksWork = true;

for (const task of taskTypes) {
  const taskContext = {
    invocation: { args: task },
  };
  const result = await modelRecommendCommand.action?.(taskContext);
  
  if (!result?.content?.includes('/add-model')) {
    console.log(`   ❌ Task type '${task}' failed`);
    allTasksWork = false;
    break;
  }
}

if (allTasksWork) {
  console.log('   ✅ All task types working correctly\n');
} else {
  process.exit(1);
}

// Test 6: Model Database Coverage
console.log('6️⃣  Testing model database...');
const models = ['claude', 'gpt-4o', 'deepseek', 'qwen', 'gemini', 'opus', 'sonnet', 'haiku'];
let allModelsFound = true;

for (const model of models) {
  const modelContext = {
    invocation: { args: `${model} gemini` },
  };
  const result = await compareModelsCommand.action?.(modelContext);
  
  if (result?.messageType === 'error') {
    console.log(`   ❌ Model '${model}' not found in database`);
    allModelsFound = false;
    break;
  }
}

if (allModelsFound) {
  console.log('   ✅ All popular models in database\n');
} else {
  process.exit(1);
}

// Summary
console.log('═══════════════════════════════════════════════');
console.log('🎉 All Enhanced Model Management Features Working!');
console.log('═══════════════════════════════════════════════\n');

console.log('Available Commands:');
console.log('  /recommend <task>        - Get smart recommendations');
console.log('  /compare <models>        - Compare models side-by-side');
console.log('  /recent [number]         - Access recent models');
console.log('  /browse-models <query>   - Browse and search models');
console.log('  /openrouter <command>    - Cost optimization tools\n');

console.log('Task Types for /recommend:');
console.log('  coding, reasoning, chat, vision, speed, cost\n');

console.log('Example Workflows:');
console.log('  1. /recommend coding');
console.log('  2. /compare claude qwen-coder');
console.log('  3. /add-model <chosen-model>');
console.log('  4. /recent 1\n');

console.log('✨ Phase 2: Enhanced Model Management - Complete!\n');
