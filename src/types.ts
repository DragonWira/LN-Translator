export type TranslationStatus = 'idle' | 'parsing' | 'translating' | 'done' | 'error';

export interface Chapter {
  id: string;
  path: string;
  title: string;
  originalContent: string;
  translatedContent: string | null;
  status: 'pending' | 'translating' | 'done' | 'error';
  tokensUsed?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export interface ApiConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
}

export interface EpubData {
  fileName: string;
  zipData: Uint8Array;
  chapters: Chapter[];
  allFiles: Record<string, Uint8Array | string>;
  spine: string[];
}

export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (Default · 128k ctx)' },
  { id: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile (128k ctx)' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (32k ctx)' },
];

export const DEFAULT_SYSTEM_PROMPT = `You are a professional light novel localizer translating Japanese fiction to natural, engaging Indonesian.
- Do not translate word-for-word. Make the prose flow beautifully like a professional Indonesian novel.
- Preserve Japanese honorifics (-san, -kun, -sama, -chan) if they fit the character dynamics.
- Translate pronouns (Ore, Boku, Watashi, Anata) contextually based on character relationships (e.g., 'Aku', 'Saya', 'Gue').
- CRITICAL: The input will contain HTML/XHTML tags (like <p>, <h1>, <span>). You MUST preserve all HTML tags exactly in their original positions. Only translate the text INSIDE the tags. Do not add explanations, notes, or markdown blocks like \`\`\`html in your response. Return ONLY the translated HTML content.`;
