const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

const PROVIDERS = new Set(['gemini', 'openai']);

const normalizeProvider = (provider) => {
  const normalized = String(provider || 'gemini').toLowerCase();
  if (!PROVIDERS.has(normalized)) {
    throw new Error(`Unsupported AI_PROVIDER "${provider}". Use "gemini" or "openai".`);
  }
  return normalized;
};

const getAiProvider = () => normalizeProvider(process.env.AI_PROVIDER || 'gemini');

const getModelName = (provider = getAiProvider()) => {
  if (provider === 'openai') {
    return process.env.OPENAI_MODEL_PRIMARY || process.env.AI_MODEL_PRIMARY || 'gpt-4o-mini';
  }

  return process.env.GEMINI_MODEL_PRIMARY || process.env.AI_MODEL_PRIMARY || 'gemini-2.5-flash';
};

const getApiKey = (provider) => {
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY;
  }

  return process.env.GEMINI_API_KEY;
};

const buildMissingKeyError = (provider) => {
  if (provider === 'openai') {
    return 'OPENAI_API_KEY is not configured';
  }

  return 'GEMINI_API_KEY is not configured';
};

const generateWithGemini = async ({
  apiKey,
  modelName,
  prompt,
  temperature,
  topK,
  topP,
  maxOutputTokens,
  responseMimeType,
}) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const generationConfig = {
    temperature,
    maxOutputTokens,
  };

  if (topK !== undefined) generationConfig.topK = topK;
  if (topP !== undefined) generationConfig.topP = topP;
  if (responseMimeType) generationConfig.responseMimeType = responseMimeType;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  });
  const response = await result.response;
  return response.text();
};

const generateWithOpenAI = async ({
  apiKey,
  modelName,
  prompt,
  temperature,
  maxOutputTokens,
  responseMimeType,
}) => {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: modelName,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxOutputTokens,
    ...(responseMimeType === 'application/json' ? { response_format: { type: 'json_object' } } : {}),
  });

  return completion.choices?.[0]?.message?.content || '';
};

const generateAiText = async ({
  prompt,
  temperature = 0.2,
  topK,
  topP,
  maxOutputTokens = 2048,
  responseMimeType,
}) => {
  const provider = getAiProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new Error(buildMissingKeyError(provider));
  }

  const model = getModelName(provider);
  const text = provider === 'openai'
    ? await generateWithOpenAI({ apiKey, modelName: model, prompt, temperature, maxOutputTokens, responseMimeType })
    : await generateWithGemini({ apiKey, modelName: model, prompt, temperature, topK, topP, maxOutputTokens, responseMimeType });

  return {
    provider,
    model,
    text,
  };
};

const hasConfiguredAiProvider = () => {
  const provider = getAiProvider();
  return Boolean(getApiKey(provider));
};

module.exports = {
  generateAiText,
  getAiProvider,
  getModelName,
  hasConfiguredAiProvider,
};
