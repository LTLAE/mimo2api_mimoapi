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
    const desc = (fn.description ?? '').split('\n')[0].slice(0, 120);
    return `- ${fn.name}(${paramLine}): ${desc}`;
  }).join('\n');

  return `[工具调用规则]
你可以调用以下工具。需要调用工具时，每个工具调用单独输出，格式如下：

<tool_call>
{"name": "工具名", "arguments": {"参数名": "参数值"}}
</tool_call>

可同时输出多个 tool_call。不需要调用工具时，直接回答，不输出 tool_call。

示例：
用户问：北京天气怎么样？
<tool_call>
{"name": "get_weather", "arguments": {"location": "北京", "unit": "celsius"}}
</tool_call>

[可用工具]
${toolDescs}`;
}
