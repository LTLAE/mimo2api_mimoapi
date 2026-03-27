import { ParsedToolCall } from './parser.js';

export function toOpenAIToolCalls(calls: ParsedToolCall[]) {
  return calls.map(c => ({
    id: c.id,
    type: 'function' as const,
    function: {
      name: c.name,
      arguments: JSON.stringify(c.arguments),
    },
  }));
}

export function toAnthropicToolUse(calls: ParsedToolCall[]) {
  return calls.map(c => ({
    type: 'tool_use' as const,
    id: c.id,
    name: c.name,
    input: c.arguments,
  }));
}

export function formatToolResultMessages(messages: Array<{ role: string; content: unknown }>): string {
  const toolMsgs = messages.filter(m => m.role === 'tool');
  if (!toolMsgs.length) return '';
  return toolMsgs.map(m => {
    const c = m as { tool_call_id?: string; name?: string; content: unknown };
    return `[工具结果] ${c.name ?? ''} (${c.tool_call_id ?? ''}):\n${typeof c.content === 'string' ? c.content : JSON.stringify(c.content)}`;
  }).join('\n\n');
}
