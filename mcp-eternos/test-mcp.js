#!/usr/bin/env node
// Quick MCP Protocol Test
import { spawn } from 'child_process';

console.log('🧪 Testing MCP Server...\n');

const server = spawn('node', ['dist/index.js']);
let output = '';

// Give server time to start
setTimeout(() => {
  console.log('📤 Sending ListTools request...\n');
  
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  
  server.stdin.write(JSON.stringify(request) + '\n');
}, 1000);

server.stdout.on('data', (data) => {
  output += data.toString();
  try {
    const response = JSON.parse(data.toString());
    if (response.result && response.result.tools) {
      console.log('✅ SUCCESS! Server responded correctly\n');
      console.log(`📦 Tool count: ${response.result.tools.length}`);
      console.log('🔧 Sample tools:');
      response.result.tools.slice(0, 5).forEach(tool => {
        console.log(`   - ${tool.name}`);
      });
      console.log(`   ... and ${response.result.tools.length - 5} more\n`);
      console.log('✨ MCP Server is working correctly!\n');
      server.kill();
      process.exit(0);
    }
  } catch (e) {
    // Not JSON, probably startup message
  }
});

server.stderr.on('data', (data) => {
  console.error(data.toString());
});

server.on('close', (code) => {
  process.exit(code);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('❌ Test timeout');
  server.kill();
  process.exit(1);
}, 10000);
