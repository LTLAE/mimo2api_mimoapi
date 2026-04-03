import { config } from '../config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function serializeMessages(messages: ChatMessage[]): string {
  const system = messages.filter(m => m.role === 'system');
  const rest = messages.filter(m => m.role !== 'system');
  const truncated = rest.slice(-config.maxReplayMessages);
  const msgs = [...system, ...truncated];

  const parts: string[] = [];

  const sysContent = system.map(m => m.content).join('\n');
  if (sysContent) parts.push(`[系统指令]\n${sysContent}`);

  const nonSystem = msgs.filter(m => m.role !== 'system');
  const dialogHistory = nonSystem.slice(0, -1);
  const lastMsg = nonSystem[nonSystem.length - 1];

  if (dialogHistory.length > 0) {
    const histStr = dialogHistory.map(m => `${m.role}: ${m.content}`).join('\n');
    parts.push(`[对话历史]\n${histStr}`);
  }

  if (lastMsg) parts.push(`[当前问题]\n${lastMsg.content}`);

  // Always preserve system message; only truncate dialog history if needed
  const sysStr = sysContent ? `[系统指令]\n${sysContent}` : '';
  const restStr = parts.slice(sysContent ? 1 : 0).join('\n\n');
  const maxRest = config.maxQueryChars - sysStr.length - 2;
  const truncatedRest = maxRest > 0 && restStr.length > maxRest ? restStr.slice(-maxRest) : restStr;
  return sysStr ? `${sysStr}\n\n${truncatedRest}` : truncatedRest;
}

export function extractLastUserMessage(messages: ChatMessage[]): string {
  const system = messages.filter(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role === 'user');
  const lastUser = userMsgs[userMsgs.length - 1]?.content ?? '';
  if (system.length === 0) return lastUser;
  const sysContent = system.map(m => m.content).join('\n');
  return `[系统指令]\n${sysContent}\n\n[当前问题]\n${lastUser}`;
}