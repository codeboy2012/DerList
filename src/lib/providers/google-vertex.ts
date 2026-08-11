/**
 * Google Vertex AI Provider
 *
 * Supports Gemini models through Google Cloud Vertex AI.
 *
 * Authentication methods:
 * 1. API Key — Supported for Vertex AI REST endpoints in certain regions.
 *    Simplest setup: just provide an API key and project/region.
 * 2. Service Account — JSON key file contents stored encrypted.
 *    Required for production/private endpoints without API key support.
 *
 * Endpoint format:
 *   https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/publishers/google/models/{MODEL}:generateContent
 *
 * For API Key auth, the key is appended as ?key={API_KEY}
 * For Service Account auth, an OAuth2 access token is obtained from the SA credentials.
 */

import type { AIOptions, AIProvider, AIResponse, Message } from './types';

const DEFAULT_REGION = 'us-central1';
const DEFAULT_MODEL = 'gemini-2.5-flash';

interface VertexConfig {
  projectId: string;
  region?: string;
  apiKey?: string;
  serviceAccountJson?: string;
  model?: string;
}

/**
 * Convert DerList message format to Vertex AI/Gemini format.
 */
function toGeminiMessages(messages: Message[]): {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: string; parts: { text: string }[] }[];
} {
  const system = messages.filter((m) => m.role === 'system');
  const conversation = messages.filter((m) => m.role !== 'system');

  const systemInstruction =
    system.length > 0
      ? { parts: [{ text: system.map((m) => m.content).join('\n\n') }] }
      : undefined;

  const contents = conversation.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  return { systemInstruction, contents };
}

/**
 * Obtain an access token from service account credentials.
 * Uses the JWT grant flow (no external library needed).
 */
async function getAccessTokenFromServiceAccount(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  // Build JWT header and payload
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
  };

  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const unsignedToken = `${enc(header)}.${enc(payload)}`;

  // Sign with the private key using Node.js crypto
  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(sa.private_key, 'base64url');

  const jwt = `${unsignedToken}.${signature}`;

  // Exchange JWT for access token
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    throw new Error(`Google OAuth token exchange failed (${tokenResp.status}): ${err}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

export class GoogleVertexProvider implements AIProvider {
  readonly id = 'google-vertex';
  readonly name = 'Google Vertex AI';

  private readonly projectId: string;
  private readonly region: string;
  private readonly apiKey?: string;
  private readonly serviceAccountJson?: string;
  private readonly model: string;

  constructor(config: VertexConfig) {
    this.projectId = config.projectId;
    this.region = config.region || DEFAULT_REGION;
    this.apiKey = config.apiKey;
    this.serviceAccountJson = config.serviceAccountJson;
    this.model = config.model || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return Boolean(this.projectId && (this.apiKey || this.serviceAccountJson));
  }

  async chat(messages: Message[], options?: AIOptions): Promise<AIResponse> {
    const model = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? 1024;
    const temperature = options?.temperature ?? 0.7;

    const { systemInstruction, contents } = toGeminiMessages(messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    if (options?.json) {
      (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
    }

    // Build the endpoint URL
    const baseUrl = `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${model}:generateContent`;

    // Determine auth
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let url = baseUrl;

    if (this.apiKey) {
      // API key auth — append as query param
      url = `${baseUrl}?key=${this.apiKey}`;
    } else if (this.serviceAccountJson) {
      // Service account auth — get OAuth2 token
      const token = await getAccessTokenFromServiceAccount(this.serviceAccountJson);
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      throw new Error('Google Vertex AI: No authentication configured (API key or service account required).');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Sanitize error — never leak credentials
      const sanitized = errorText.replace(/key=[^&\s"]+/gi, 'key=***');
      throw new Error(`Google Vertex AI error (${response.status}): ${sanitized}`);
    }

    const data = await response.json();

    // Extract content from Gemini response format
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      const blockReason = candidate?.finishReason ?? data.promptFeedback?.blockReason;
      throw new Error(
        blockReason
          ? `Google Vertex AI: Response blocked (${blockReason})`
          : 'Google Vertex AI returned empty response'
      );
    }

    const content = candidate.content.parts.map((p: { text: string }) => p.text).join('');
    const usage = data.usageMetadata;

    return {
      content,
      model,
      tokensUsed: usage
        ? (usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0)
        : undefined,
      finishReason: candidate.finishReason,
    };
  }
}

export function createGoogleVertexProvider(
  config: Record<string, unknown>
): GoogleVertexProvider | null {
  const projectId = config.projectId as string | undefined;
  if (!projectId) return null;

  const apiKey = config.apiKey as string | undefined;
  const serviceAccountJson = config.serviceAccountJson as string | undefined;

  if (!apiKey && !serviceAccountJson) return null;

  return new GoogleVertexProvider({
    projectId,
    region: (config.region as string) || undefined,
    apiKey,
    serviceAccountJson,
    model: (config.model as string) || undefined,
  });
}
