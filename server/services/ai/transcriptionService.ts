import { transcribeAudioBuffer, AiProviderError } from '../../lib/openai.js';

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/ogg;codecs=opus',
]);

// Stay safely under Vercel's 4.5MB serverless request body limit
export const MAX_VOICE_AUDIO_BYTES = 4 * 1024 * 1024;

export async function processVoiceSearchAudio(params: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  modelOverride?: string | null;
}) {
  if (!params.buffer || params.buffer.length === 0) {
    throw new AiProviderError('Audio recording is empty. Please speak clearly and try again.', 400, 'EMPTY_AUDIO');
  }

  if (params.buffer.length > MAX_VOICE_AUDIO_BYTES) {
    throw new AiProviderError(
      'Audio clip exceeds the 4 MB limit. Keep voice queries under 60 seconds.',
      413,
      'AUDIO_TOO_LARGE'
    );
  }

  const normalizedMime = (params.mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (
    !ALLOWED_AUDIO_MIME_TYPES.has(normalizedMime) &&
    !ALLOWED_AUDIO_MIME_TYPES.has((params.mimeType || '').toLowerCase()) &&
    !normalizedMime.startsWith('audio/')
  ) {
    throw new AiProviderError(
      'Unsupported audio format. Please record using your microphone or upload WebM, MP3, WAV, or M4A.',
      400,
      'UNSUPPORTED_AUDIO_TYPE'
    );
  }

  const ext = normalizedMime.includes('mp4') || normalizedMime.includes('m4a')
    ? 'm4a'
    : normalizedMime.includes('mpeg') || normalizedMime.includes('mp3')
    ? 'mp3'
    : normalizedMime.includes('wav')
    ? 'wav'
    : normalizedMime.includes('ogg')
    ? 'ogg'
    : 'webm';

  const result = await transcribeAudioBuffer({
    buffer: params.buffer,
    filename: params.originalName || `voice-query.${ext}`,
    mimeType: normalizedMime || 'audio/webm',
    modelOverride: params.modelOverride,
  });

  if (!result.text) {
    throw new AiProviderError(
      'No speech detected in the recording. Please try speaking again or type your search.',
      422,
      'NO_SPEECH_DETECTED'
    );
  }

  return {
    transcript: result.text,
    model: result.model,
    latencyMs: result.latencyMs,
    // Estimate equivalent token telemetry cleanly (~100 tokens per request for dashboard visibility)
    estimatedAudioBytes: params.buffer.length,
  };
}
