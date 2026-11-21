import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export interface ServerEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
  openAiApiKey: string;
  openAiModel: string;
  openAiTranscriptionModel: string;
  openAiEmbeddingModel: string;
}

export function getServerEnv(): ServerEnvConfig {
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();

  const supabaseAnonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const supabaseServiceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
  const openAiApiKey = (process.env.OPENAI_API_KEY || '').trim();
  const openAiModel = (process.env.OPENAI_MODEL || '').trim();
  const openAiTranscriptionModel = (
    process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe'
  ).trim();
  const openAiEmbeddingModel = (
    process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  ).trim();

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    geminiApiKey,
    openAiApiKey,
    openAiModel,
    openAiTranscriptionModel,
    openAiEmbeddingModel,
  };
}
