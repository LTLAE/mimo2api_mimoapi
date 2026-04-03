import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 8080),
  adminKey: process.env.ADMIN_KEY ?? 'admin',
  maxReplayMessages: Number(process.env.MAX_REPLAY_MESSAGES ?? 20),
  maxQueryChars: Number(process.env.MAX_QUERY_CHARS ?? 12000),
  contextResetThreshold: Number(process.env.CONTEXT_RESET_THRESHOLD ?? 150000),
  maxConcurrentPerAccount: Number(process.env.MAX_CONCURRENT_PER_ACCOUNT ?? 5),
  thinkMode: (process.env.THINK_MODE ?? 'passthrough') as 'passthrough' | 'strip' | 'separate',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
  // 会话隔离模式：
  // 'manual' - 只有客户端提供 x-session-id 时才隔离（默认所有请求共享会话）
  // 'auto' - 自动基于 IP + User-Agent 隔离会话
  // 'per-request' - 每个请求都是新会话（禁用记忆）
  sessionIsolation: (process.env.SESSION_ISOLATION ?? 'auto') as 'manual' | 'auto' | 'per-request',
};
