const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqResponse {
  translatedContent: string;
  tokensUsed: number;
}

export class GroqRateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter}s`);
    this.retryAfter = retryAfter;
  }
}

export class GroqAuthError extends Error {
  constructor() {
    super('Invalid API key. Please check your Groq Cloud API key.');
  }
}

export async function translateChapter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  htmlContent: string
): Promise<GroqResponse> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: htmlContent },
      ],
      temperature: 0.3,
      max_tokens: 32768,
    }),
  });

  if (response.status === 401) throw new GroqAuthError();

  if (response.status === 429) {
    const data = await response.json().catch(() => ({}));
    const retryAfter = parseInt(response.headers.get('retry-after') || '10', 10);
    throw new GroqRateLimitError(retryAfter || 10);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || `API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const translatedContent = data.choices?.[0]?.message?.content ?? '';
  const tokensUsed = data.usage?.total_tokens ?? 0;

  return { translatedContent, tokensUsed };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function estimateTokens(text: string): number {
  // ~4 chars per token is a rough estimate
  return Math.ceil(text.length / 4);
}
