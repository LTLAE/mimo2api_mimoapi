import { Account } from '../accounts.js';
import { v4 as uuidv4 } from 'uuid';

export interface MimoUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
}

export interface MimoChunk {
  type: 'text' | 'usage' | 'dialogId' | 'finish';
  content?: string;
  usage?: MimoUsage;
}

const API_URL = 'https://aistudio.xiaomimimo.com/open-apis/bot/chat';

export async function* callMimo(
  account: Account,
  conversationId: string,
  query: string,
  enableThinking: boolean,
  model = 'mimo-v2-pro'
): AsyncGenerator<MimoChunk> {
  const body = {
    msgId: uuidv4().replace(/-/g, '').slice(0, 32),
    conversationId,
    query,
    modelConfig: { enableThinking, webSearchStatus: 'disabled', model },
    multiMedias: [],
  };

  const url = `${API_URL}?xiaomichatbot_ph=${encodeURIComponent(account.ph_token)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `serviceToken=${account.service_token}; userId=${account.user_id}; xiaomichatbot_ph=${account.ph_token}`,
      'Origin': 'https://aistudio.xiaomimimo.com',
      'Referer': 'https://aistudio.xiaomimimo.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'x-timezone': 'Asia/Shanghai',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) throw new Error(`MiMo error: ${resp.status}`);
  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let event = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('event:')) {
        event = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        try {
          const data = JSON.parse(trimmed.slice(5).trim());
          if (event === 'message') {
            yield { type: 'text', content: data.content ?? '' };
          } else if (event === 'usage') {
            yield {
              type: 'usage',
              usage: {
                promptTokens: data.promptTokens ?? 0,
                completionTokens: data.completionTokens ?? 0,
                totalTokens: data.totalTokens ?? 0,
                reasoningTokens: data.nativeUsage?.completion_tokens_details?.reasoning_tokens ?? 0,
              },
            };
          } else if (event === 'finish') {
            yield { type: 'finish' };
          } else if (event === 'dialogId') {
            yield { type: 'dialogId', content: data.content };
          }
        } catch {
          // skip malformed SSE data
        }
      }
    }
  }
}
