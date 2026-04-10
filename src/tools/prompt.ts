export interface ToolDefinition {
  // OpenAI format
  type?: 'function';
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  // Anthropic format
  name?: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}

interface NormalizedTool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

function normalizeTool(t: ToolDefinition): NormalizedTool {
  if (t.function) return { name: t.function.name, description: t.function.description, parameters: t.function.parameters };
  return { name: t.name!, description: t.description, parameters: t.input_schema };
}

export function buildToolSystemPrompt(tools: ToolDefinition[]): string {
  const toolDescs = tools.map(t => {
    const fn = normalizeTool(t);
    const required = (fn.parameters?.required as string[] ?? []);
    const props = fn.parameters?.properties as Record<string, { type?: string; description?: string }> | undefined;
    const paramLine = props
      ? Object.entries(props).map(([k, v]) => `${k}${required.includes(k) ? '*' : ''}:${v.type ?? 'any'}`).join(', ')
      : '';
    const desc = (fn.description ?? '').split('\n')[0].slice(0, 80);
    return `${fn.name}(${paramLine})`;
  }).join(', ');

  return `[工具调用格式 - 必须严格遵守]
<tool_call>
{"name": "工具名", "arguments": {"参数": "值"}}
</tool_call>

要求：
• 必须用 <tool_call> 标签包裹 JSON
• JSON 必须有 "name" 和 "arguments" 字段
• 禁止输出 bash 命令或 markdown 代码块
• 禁止输出 <toolcall_status>、<toolcall_result> 等系统标签
• 禁止使用中文标签（如 <函数调用>、<函数名> 等）

可用工具：${toolDescs}`;
}