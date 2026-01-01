/**
 * Recoder.xyz Authentication CLI Commands
 * Command-line interface for authentication
 */

import { RecoderAuthService } from '../services/RecoderAuthService.js';

export async function handleRecoderAuthCommand(args: string[]): Promise<void> {
  const authService = new RecoderAuthService();
  const command = args[0];

  switch (command) {
    case 'login':
      await handleLogin(authService, args.slice(1));
      break;

    case 'logout':
      await authService.logout();
      break;

    case 'status':
      await handleStatus(authService);
      break;

    case 'set-api-key':
      await handleSetApiKey(authService, args.slice(1));
      break;

    case 'quota':
      await handleQuota(authService);
      break;

    default:
      showHelp();
      break;
  }
}

async function handleLogin(authService: RecoderAuthService, args: string[]): Promise<void> {
  const method = args[0];

  if (method === '--web' || !method) {
    // Web OAuth (default)
    await authService.loginWithWeb();
  } else if (method === '--device' || method === '--device-flow') {
    // Device flow
    await authService.loginWithDeviceFlow();
  } else if (method === '--api-key' && args[1]) {
    // API key authentication
    await authService.loginWithApiKey(args[1]);
  } else {
    console.error('❌ Invalid login method');
    console.log('\nUsage:');
    console.log('  recoder auth login              # Web OAuth (default)');
    console.log('  recoder auth login --web        # Web OAuth');
    console.log('  recoder auth login --device     # Device flow (for SSH)');
    console.log('  recoder auth login --api-key <key>  # API key auth');
    process.exit(1);
  }
}

async function handleStatus(authService: RecoderAuthService): Promise<void> {
  const isAuth = await authService.isAuthenticated();

  if (!isAuth) {
    console.log('❌ Not authenticated');
    console.log('💡 Run: recoder auth login');
    process.exit(1);
  }

  const user = await authService.getUser();
  const quota = await authService.getQuota();

  console.log('✅ Authenticated');
  console.log(`📧 Email: ${user?.email}`);
  console.log(`👤 Name: ${user?.name}`);
  console.log(`📋 Plan: ${user?.subscription_plan.toUpperCase()}`);

  if (quota) {
    console.log(`\n📊 Quota:`);
    console.log(`  • Requests: ${quota.requests_remaining}/${quota.requests_limit}`);
    console.log(`  • Resets: ${new Date(quota.reset_date).toLocaleDateString()}`);
    
    const percentUsed = ((quota.requests_limit - quota.requests_remaining) / quota.requests_limit * 100).toFixed(1);
    console.log(`  • Usage: ${percentUsed}%`);
  }

  if (user?.subscription_plan === 'free') {
    if (user.has_own_api_key) {
      console.log('\n🔑 OpenRouter API key: Configured ✅');
    } else {
      console.log('\n⚠️  OpenRouter API key: Not configured');
      console.log('💡 Free tier requires your own API key');
      console.log('💡 Get one at: https://openrouter.ai');
      console.log('💡 Then run: recoder auth set-api-key <your-key>');
    }
  }
}

async function handleSetApiKey(authService: RecoderAuthService, args: string[]): Promise<void> {
  const isAuth = await authService.isAuthenticated();

  if (!isAuth) {
    console.error('❌ Not authenticated');
    console.log('💡 Run: recoder auth login');
    process.exit(1);
  }

  const user = await authService.getUser();
  if (user?.subscription_plan !== 'free') {
    console.log('ℹ️  Premium users don\'t need to provide an API key');
    console.log('🎉 You can use all features directly!');
    return;
  }

  const apiKey = args[0];

  if (!apiKey) {
    console.error('❌ Please provide your OpenRouter API key');
    console.log('\nUsage:');
    console.log('  recoder auth set-api-key <your-api-key>');
    console.log('\nGet your API key at: https://openrouter.ai');
    process.exit(1);
  }

  try {
    await authService.setOpenRouterApiKey(apiKey);
  } catch (error: any) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

async function handleQuota(authService: RecoderAuthService): Promise<void> {
  const isAuth = await authService.isAuthenticated();

  if (!isAuth) {
    console.error('❌ Not authenticated');
    console.log('💡 Run: recoder auth login');
    process.exit(1);
  }

  const user = await authService.getUser();
  const quota = await authService.getQuota();

  if (!quota) {
    console.error('❌ Unable to fetch quota information');
    process.exit(1);
  }

  console.log('📊 Quota Information');
  console.log('─'.repeat(50));
  console.log(`Plan: ${user?.subscription_plan.toUpperCase()}`);
  console.log(`\nRequests:`);
  console.log(`  • Used: ${quota.requests_limit - quota.requests_remaining}`);
  console.log(`  • Remaining: ${quota.requests_remaining}`);
  console.log(`  • Limit: ${quota.requests_limit}`);
  
  const percentUsed = ((quota.requests_limit - quota.requests_remaining) / quota.requests_limit * 100);
  console.log(`  • Usage: ${percentUsed.toFixed(1)}%`);
  
  console.log(`\nReset Date: ${new Date(quota.reset_date).toLocaleString()}`);

  // Show progress bar
  const barLength = 30;
  const filled = Math.floor((quota.requests_limit - quota.requests_remaining) / quota.requests_limit * barLength);
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  console.log(`\n[${bar}] ${percentUsed.toFixed(1)}%`);

  if (percentUsed > 90) {
    console.log('\n⚠️  Warning: You\'re approaching your quota limit');
    console.log('💡 Consider upgrading your plan at: https://recoder.xyz/pricing');
  }
}

function showHelp(): void {
  console.log('Recoder.xyz Authentication');
  console.log('\nUsage:');
  console.log('  recoder auth <command> [options]');
  console.log('\nCommands:');
  console.log('  login              Authenticate with recoder.xyz');
  console.log('    --web            Use web browser (default)');
  console.log('    --device         Use device flow (for SSH)');
  console.log('    --api-key <key>  Use API key');
  console.log('');
  console.log('  logout             Sign out from recoder.xyz');
  console.log('  status             Check authentication status');
  console.log('  set-api-key <key>  Set OpenRouter API key (free tier)');
  console.log('  quota              View usage quota');
  console.log('\nExamples:');
  console.log('  recoder auth login');
  console.log('  recoder auth login --device');
  console.log('  recoder auth login --api-key rcli_xxx');
  console.log('  recoder auth status');
  console.log('  recoder auth set-api-key sk-or-v1-xxx');
  console.log('  recoder auth quota');
  console.log('\nFor more information, visit: https://recoder.xyz/docs');
}
