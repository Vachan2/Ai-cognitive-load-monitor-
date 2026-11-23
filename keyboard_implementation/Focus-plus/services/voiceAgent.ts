import { DefaultAzureCredential } from '@azure/identity';
import { VoiceLiveClient } from '@azure/ai-voicelive';

const SAMPLE_RATE = 24_000;
const MAX_ALERT_MS = 15_000;

export interface VoiceAgentAlertInput {
  message: string;
  level: 50 | 70;
  cognitiveLoad: number;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function wavFromPcm16(pcm: Buffer) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function getConfig() {
  return {
    endpoint: required('AZURE_VOICELIVE_ENDPOINT'),
    agentName: required('AZURE_FOUNDRY_AGENT_NAME'),
    projectName: required('AZURE_FOUNDRY_PROJECT_NAME'),
    agentVersion: process.env.AZURE_FOUNDRY_AGENT_VERSION?.trim() || undefined,
    foundryResourceOverride: process.env.AZURE_FOUNDRY_RESOURCE_OVERRIDE?.trim() || undefined,
    authenticationIdentityClientId: process.env.AZURE_FOUNDRY_AUTHENTICATION_IDENTITY_CLIENT_ID?.trim() || undefined,
  };
}

export function voiceAlertsEnabled() {
  return process.env.VOICE_ALERTS_ENABLED?.toLowerCase() === 'true';
}

export async function synthesizeVoiceAlert(input: VoiceAgentAlertInput) {
  if (!voiceAlertsEnabled()) throw new Error('Voice alerts are disabled');

  const { endpoint, ...agentConfig } = getConfig();
  const credential = new DefaultAzureCredential();
  const client = new VoiceLiveClient(endpoint, credential);
  const session = client.createSession({ agent: agentConfig });
  const audioChunks: Buffer[] = [];

  let resolveAudio!: (audio: Buffer) => void;
  let rejectAudio!: (error: Error) => void;
  let settled = false;
  const audio = new Promise<Buffer>((resolve, reject) => {
    resolveAudio = resolve;
    rejectAudio = reject;
  });

  const finish = () => {
    if (settled) return;
    settled = true;
    if (audioChunks.length === 0) {
      rejectAudio(new Error('Voice Live returned no audio'));
      return;
    }
    resolveAudio(wavFromPcm16(Buffer.concat(audioChunks)));
  };

  const fail = (error: unknown) => {
    if (settled) return;
    settled = true;
    rejectAudio(error instanceof Error ? error : new Error(String(error)));
  };

  const subscription = session.subscribe({
    onResponseAudioDelta: async (event) => {
      if (event.delta) audioChunks.push(Buffer.from(event.delta));
    },
    onResponseAudioDone: async () => finish(),
    onResponseDone: async () => finish(),
    onServerError: async (event: { error?: { message?: string } }) =>
      fail(new Error(event.error?.message ?? 'Voice Live server error')),
  });

  const timeout = setTimeout(
    () => fail(new Error('Voice Live alert timed out')),
    MAX_ALERT_MS,
  );

  try {
    await session.connect();
    await session.updateSession({ modalities: ['text', 'audio'], outputAudioFormat: 'pcm16' });
    await session.sendEvent({
      type: 'response.create',
      response: {
        preGeneratedAssistantMessage: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'input_text', text: input.message }],
        },
      },
    });

    return await audio;
  } finally {
    clearTimeout(timeout);
    await subscription.close().catch(() => undefined);
    await session.disconnect().catch(() => undefined);
    await session.dispose().catch(() => undefined);
  }
}
