export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

function parseXmlParam(xml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const paramRe = /<parameter name="([^"]+)">([\s\S]*?)<\/parameter>/g;
  let m: RegExpExecArray | null;
  while ((m = paramRe.exec(xml)) !== null) {
    const key = m[1]; const val = m[2].trim();
    try { result[key] = JSON.parse(val); } catch { result[key] = val; }
  }
  return result;
}

function extractName(inner: string): string | null {
  let m = inner.match(/<name>([^<\n]+?)<\/name>/);
  if (m) return m[1].trim();
  m = inner.match(/<name=([^<>\n\/]+)/);
  if (m) return m[1].trim();
  return null;
}

function parseMimoNativeToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  const blockRe = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(text)) !== null) {
    // strip optional <tool_result> prefix MiMo uses inside tool_call
    let inner = block[1].trim();
    if (inner.startsWith("<tool_result>")) inner = inner.slice("<tool_result>".length).trim();
    // strip trailing </tool_result> if present
    if (inner.endsWith("</tool_result>")) inner = inner.slice(0, -"</tool_result>".length).trim();
    if (inner.startsWith("{")) {
      try {
        const parsed = JSON.parse(inner);
        if (parsed.name) calls.push({ id: `call_${Math.random().toString(36).slice(2,10)}`, name: parsed.name, arguments: parsed.arguments ?? parsed.parameters ?? parsed.input ?? {} });
      } catch { /* skip */ }
    } else if (inner.includes("<name")) {
      const name = extractName(inner);
      if (!name) continue;
      const args: Record<string, unknown> = {};
      const paramRe2 = /<param(?:\s+name="([^"]+)")?(?:\s+key="([^"]+)")?[^>]*>([\s\S]*?)<\/param>/g;
      let pm: RegExpExecArray | null;
      while ((pm = paramRe2.exec(inner)) !== null) {
        const key = (pm[1] ?? pm[2] ?? "").trim();
        const val = pm[3].trim();
        if (key) { try { args[key] = JSON.parse(val); } catch { args[key] = val; } }
      }
      calls.push({ id: `call_${Math.random().toString(36).slice(2,10)}`, name, arguments: args });
    } else if (inner.includes('<tool_name>')) {
      // <tool_name>NAME</tool_name><arguments><arg_key>K</arg_key><arg_value>V</arg_value>...</arguments>
      const nameM = inner.match(/<tool_name>([^<]+)<\/tool_name>/);
      if (!nameM) continue;
      const name = nameM[1].trim();
      const args: Record<string, unknown> = {};
      const argRe = /<arg_key>([^<]+)<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/g;
      let pm: RegExpExecArray | null;
      while ((pm = argRe.exec(inner)) !== null) {
        const key = pm[1].trim(); const val = pm[2].trim();
        try { args[key] = JSON.parse(val); } catch { args[key] = val; }
      }
      calls.push({ id: `call_${Math.random().toString(36).slice(2,10)}`, name, arguments: args });
    } else {
      // try <function=NAME> format first
      let name: string | null = null;
      const fnMatch = inner.match(/<function=([^>\n]+)>/);
      if (fnMatch) {
        name = fnMatch[1].trim();
        const args: Record<string, unknown> = {};
        // parameter=KEY>VALUE</parameter (closing tag may be </parameter> or missing)
        const paramRe3 = /<parameter=([^>\n]+)>([\s\S]*?)(?:<\/parameter>|\n<\/function>|$)/g;
        let pm: RegExpExecArray | null;
        while ((pm = paramRe3.exec(inner)) !== null) {
          const key = pm[1].trim(); const val = pm[2].trim();
          if (key) { try { args[key] = JSON.parse(val); } catch { args[key] = val; } }
        }
        calls.push({ id: `call_${Math.random().toString(36).slice(2,10)}`, name, arguments: args });
      } else {
        // try <TOOLNAME>\n<PARAM>VALUE</PARAM> format e.g. <read><file_path>...
        const tagMatch = inner.match(/^<([a-zA-Z_][a-zA-Z0-9_]*)>/);
        if (!tagMatch) continue;
        name = tagMatch[1].trim();
        const args: Record<string, unknown> = {};
        const paramRe4 = /<([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/\1>/g;
        let pm: RegExpExecArray | null;
        while ((pm = paramRe4.exec(inner)) !== null) {
          if (pm[1] === name) continue; // skip outer tag
          const key = pm[1].trim(); const val = pm[2].trim();
          try { args[key] = JSON.parse(val); } catch { args[key] = val; }
        }
        calls.push({ id: `call_${Math.random().toString(36).slice(2,10)}`, name, arguments: args });
      }
    }
  }
  return calls;
}

export function parseToolCalls(text: string): ParsedToolCall[] {
  if (text.includes("<tool_call>")) {
    const calls = parseMimoNativeToolCalls(text);
    console.log("[PARSE] native calls:", JSON.stringify(calls));
    return calls;
  }
  const calls: ParsedToolCall[] = [];
  const blockRe = /<function_calls>([\s\S]*?)<\/function_calls>/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(text)) !== null) {
    const invokeRe = /<invoke name="([^"]+)">([\s\S]*?)<\/invoke>/g;
    let inv: RegExpExecArray | null;
    while ((inv = invokeRe.exec(block[1])) !== null) {
      calls.push({ id: `call_${Math.random().toString(36).slice(2,10)}`, name: inv[1], arguments: parseXmlParam(inv[2]) });
    }
  }
  return calls;
}

export function hasToolCallMarker(text: string): boolean {
  return text.includes('<function_calls>') || text.includes('<tool_call>');
}
