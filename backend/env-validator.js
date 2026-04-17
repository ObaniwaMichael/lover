// Environment variable validator
const validateEnvironment = () => {
  const required = ['JWT_SECRET'];

  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY_2 ||
      process.env.GEMINI_SECONDARY_API_KEY ||
      process.env['gemini_api_key_1']
  );

  const optional = [
    'GEMINI_API_KEY',
    'GEMINI_API_KEY_2',
    'GEMINI_MODEL',
    'DATABASE_URL',
    'PG_POOL_MAX',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'PORT',
    'NODE_ENV',
    'CORS_ORIGIN',
    'MAINTENANCE_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env file');
    process.exit(1);
  }

  if (!hasGeminiKey) {
    console.error(
      '❌ No Gemini API key: set at least one of GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_SECONDARY_API_KEY, or gemini_api_key_1'
    );
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
  console.log(
    `  Gemini keys: ${[process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_SECONDARY_API_KEY, process.env['gemini_api_key_1']].filter(Boolean).length} configured`
  );

  optional.forEach((key) => {
    if (process.env[key]) {
      const hiddenKeys = ['MONGODB_URI', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'MAINTENANCE_SECRET', 'GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_SECONDARY_API_KEY', 'gemini_api_key_1'];
      console.log(`  ${key}: ${hiddenKeys.includes(key) ? '***hidden***' : process.env[key]}`);
    }
  });

  if (process.env.NODE_ENV === 'production' && !process.env.MAINTENANCE_SECRET) {
    console.warn(
      '⚠️  MAINTENANCE_SECRET is not set — POST/GET /api/maintenance/* returns 503 until configured.',
    );
  }

  if (
    process.env.NODE_ENV === 'production' &&
    !(process.env.CORS_ORIGIN || '').trim()
  ) {
    console.warn(
      '⚠️  CORS_ORIGIN is not set — browsers calling this API from another origin will fail CORS. Set CORS_ORIGIN to your SPA origin (e.g. https://your-vm.example.com).',
    );
  }
};

export default validateEnvironment;
