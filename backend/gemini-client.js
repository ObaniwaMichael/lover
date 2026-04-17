import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Collect distinct Gemini API keys from env (supports multiple naming conventions).
 */
export function collectGeminiKeys() {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_SECONDARY_API_KEY,
    process.env['gemini_api_key_1'],
  ].filter((k) => typeof k === 'string' && k.trim().length > 0);
  return [...new Set(raw.map((k) => k.trim()))];
}

const MODEL_NAME =
  (process.env.GEMINI_MODEL || 'gemini-1.5-flash').split(',')[0].trim() || 'gemini-1.5-flash';

let models = [];
let nextKeyIndex = 0;

function buildModels(keys) {
  const built = [];
  for (const key of keys) {
    const genAI = new GoogleGenerativeAI(key);
    built.push(genAI.getGenerativeModel({ model: MODEL_NAME }));
  }
  return built;
}

export function initGeminiModels() {
  const keys = collectGeminiKeys();
  models = buildModels(keys);
  if (models.length > 0) {
    console.log(`✅ Gemini: ${models.length} API key(s) loaded (model: ${MODEL_NAME})`);
  } else {
    console.warn('⚠️  No Gemini API keys configured');
  }
  return models.length;
}

export function isGeminiAvailable() {
  return models.length > 0;
}

/**
 * Round-robin start, then fall through remaining keys on failure (quota / rate limit).
 */
export async function geminiGenerateText(prompt) {
  if (!models.length) {
    throw new Error('Gemini is not configured');
  }
  const n = models.length;
  const start = nextKeyIndex % n;
  nextKeyIndex++;

  let lastErr;
  for (let i = 0; i < n; i++) {
    const idx = (start + i) % n;
    try {
      const result = await models[idx].generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return text;
    } catch (e) {
      lastErr = e;
      const msg = e?.message || String(e);
      console.warn(`⚠️ Gemini request failed on key ${idx + 1}/${n}:`, msg);
    }
  }
  throw lastErr || new Error('All Gemini API keys failed');
}
