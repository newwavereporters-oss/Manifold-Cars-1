import OpenAI, { toFile } from 'openai';
import { getServerEnv } from '../config/env.js';

export class AiConfigurationError extends Error {
  public readonly status = 503;
  public readonly code = 'AI_NOT_CONFIGURED';

  constructor(message: string) {
    super(message);
    this.name = 'AiConfigurationError';
  }
}

export class AiProviderError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status = 502, code = 'AI_PROVIDER_ERROR') {
    super(message);
    this.name = 'AiProviderError';
    this.status = status;
    this.code = code;
  }
}

let cachedClient: OpenAI | null = null;
let cachedKeyFingerprint = '';

export function getOpenAiConfigStatus() {
  const env = getServerEnv();
  return {
    apiKeyConfigured: Boolean(env.openAiApiKey),
    modelConfigured: Boolean(env.openAiModel),
    configuredModel: env.openAiModel || null,
    transcriptionModel: env.openAiTranscriptionModel || null,
    embeddingModel: env.openAiEmbeddingModel || null,
  };
}

export function resolveTextModel(overrideModel?: string | null): string {
  const env = getServerEnv();
  const chosen = (overrideModel || env.openAiModel || '').trim();
  if (!chosen) {
    throw new AiConfigurationError(
      'OPENAI_MODEL is not configured on the server. Set OPENAI_MODEL in environment variables (or configure an explicit model override in Admin AI Control Centre).'
    );
  }
  return chosen;
}

export function resolveTranscriptionModel(overrideModel?: string | null): string {
  const env = getServerEnv();
  const chosen = (overrideModel || env.openAiTranscriptionModel || '').trim();
  if (!chosen) {
    throw new AiConfigurationError(
      'OPENAI_TRANSCRIPTION_MODEL is not configured on the server.'
    );
  }
  return chosen;
}

export function getOpenAiClient(timeoutMs = 25_000): OpenAI {
  const { openAiApiKey } = getServerEnv();
  if (!openAiApiKey) {
    throw new AiConfigurationError(
      'OPENAI_API_KEY is not configured on the server.'
    );
  }

  const fingerprint = `${openAiApiKey.slice(0, 6)}:${openAiApiKey.length}:${timeoutMs}`;
  if (!cachedClient || cachedKeyFingerprint !== fingerprint) {
    cachedClient = new OpenAI({
      apiKey: openAiApiKey,
      timeout: timeoutMs,
      maxRetries: 1,
    });
    cachedKeyFingerprint = fingerprint;
  }

  return cachedClient;
}

export function sanitizeOpenAiError(err: unknown): {
  status: number;
  code: string;
  message: string;
} {
  if (err instanceof AiConfigurationError) {
    return { status: err.status, code: err.code, message: err.message };
  }
  if (err instanceof AiProviderError) {
    return { status: err.status, code: err.code, message: err.message };
  }

  const anyErr = err as any;
  const rawStatus = typeof anyErr?.status === 'number' ? anyErr.status : 502;
  const errCode = typeof anyErr?.code === 'string' ? anyErr.code : 'AI_REQUEST_FAILED';

  // Redact any accidental sk-... key strings from provider error messages
  const rawMessage = typeof anyErr?.message === 'string' ? anyErr.message : 'OpenAI request failed.';
  const redacted = rawMessage.replace(/sk-[A-Za-z0-9_-]{12,}/g, '[REDACTED_KEY]');

  if (rawStatus === 401 || rawStatus === 403) {
    return {
      status: 502,
      code: 'OPENAI_AUTH_ERROR',
      message: 'OpenAI authentication failed on the server. Verify OPENAI_API_KEY configuration.',
    };
  }
  if (rawStatus === 429) {
    return {
      status: 429,
      code: 'OPENAI_RATE_LIMIT',
      message: 'AI capacity is temporarily busy. Please try again in a moment.',
    };
  }
  if (rawStatus === 400) {
    return {
      status: 400,
      code: errCode,
      message: redacted.slice(0, 220),
    };
  }
  if (anyErr?.name === 'AbortError' || rawMessage.toLowerCase().includes('timed out')) {
    return {
      status: 504,
      code: 'AI_TIMEOUT',
      message: 'AI request timed out before completion. Please try again.',
    };
  }

  return {
    status: rawStatus >= 400 && rawStatus < 600 ? rawStatus : 502,
    code: errCode,
    message: redacted.slice(0, 220) || 'Unable to complete AI request.',
  };
}

export interface StructuredResponseResult<T> {
  data: T;
  rawText: string;
  model: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export async function runStructuredJsonResponse<T>(params: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  modelOverride?: string | null;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<StructuredResponseResult<T>> {
  const model = resolveTextModel(params.modelOverride);
  const client = getOpenAiClient(params.timeoutMs ?? 25_000);
  const startedAt = Date.now();

  try {
    const response = await client.responses.create({
      model,
      instructions: params.instructions,
      input: params.input,
      max_output_tokens: Math.min(Math.max(params.maxOutputTokens ?? 900, 128), 2000),
      temperature: params.temperature ?? 0.35,
      text: {
        format: {
          type: 'json_schema',
          name: params.schemaName,
          strict: true,
          schema: params.schema,
        },
      },
    });

    const latencyMs = Date.now() - startedAt;
    const rawText = (response.output_text || '').trim();
    if (!rawText) {
      throw new AiProviderError('OpenAI returned an empty structured response.', 502, 'AI_EMPTY_OUTPUT');
    }

    let parsed: T;
    try {
      parsed = JSON.parse(rawText) as T;
    } catch {
      throw new AiProviderError('OpenAI returned invalid JSON for structured output.', 502, 'AI_INVALID_JSON');
    }

    const inputTokens = Number(response.usage?.input_tokens ?? 0);
    const outputTokens = Number(response.usage?.output_tokens ?? 0);
    const totalTokens = Number(response.usage?.total_tokens ?? inputTokens + outputTokens);

    return {
      data: parsed,
      rawText,
      model: response.model || model,
      responseId: response.id || `resp_${Date.now()}`,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
    };
  } catch (err) {
    const safe = sanitizeOpenAiError(err);
    throw new AiProviderError(safe.message, safe.status, safe.code);
  }
}

export async function runTextResponse(params: {
  instructions: string;
  input: string;
  modelOverride?: string | null;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<{
  text: string;
  model: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
}> {
  const model = resolveTextModel(params.modelOverride);
  const client = getOpenAiClient(params.timeoutMs ?? 25_000);
  const startedAt = Date.now();

  try {
    const response = await client.responses.create({
      model,
      instructions: params.instructions,
      input: params.input,
      max_output_tokens: Math.min(Math.max(params.maxOutputTokens ?? 700, 32), 2000),
      temperature: params.temperature ?? 0.4,
    });

    const latencyMs = Date.now() - startedAt;
    const text = (response.output_text || '').trim();
    const inputTokens = Number(response.usage?.input_tokens ?? 0);
    const outputTokens = Number(response.usage?.output_tokens ?? 0);
    const totalTokens = Number(response.usage?.total_tokens ?? inputTokens + outputTokens);

    return {
      text,
      model: response.model || model,
      responseId: response.id || `resp_${Date.now()}`,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
    };
  } catch (err) {
    const safe = sanitizeOpenAiError(err);
    throw new AiProviderError(safe.message, safe.status, safe.code);
  }
}

export async function transcribeAudioBuffer(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  modelOverride?: string | null;
  promptHint?: string;
  timeoutMs?: number;
}): Promise<{
  text: string;
  model: string;
  latencyMs: number;
}> {
  const model = resolveTranscriptionModel(params.modelOverride);
  const client = getOpenAiClient(params.timeoutMs ?? 25_000);
  const startedAt = Date.now();

  try {
    const file = await toFile(params.buffer, params.filename, {
      type: params.mimeType || 'audio/webm',
    });

    const result = await client.audio.transcriptions.create({
      file,
      model,
      language: 'en',
      prompt:
        params.promptHint ||
        'Nigerian automotive marketplace voice search. Common terms: Tokunbo, Foreign Used, Nigerian Used, Toyota Camry, Highlander, Prado, Lexus RX350, GX460, Mercedes-Benz GLE, GLK, Honda Accord, Range Rover, Lekki, Abuja, Victoria Island, Ikoyi, Ikeja, million naira.',
    });

    const latencyMs = Date.now() - startedAt;
    const text = typeof result?.text === 'string' ? result.text.trim() : '';

    return {
      text,
      model,
      latencyMs,
    };
  } catch (err) {
    const safe = sanitizeOpenAiError(err);
    throw new AiProviderError(safe.message, safe.status, safe.code);
  }
}
