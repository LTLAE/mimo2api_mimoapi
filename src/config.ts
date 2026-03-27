import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 8080),
  adminKey: process.env.ADMIN_KEY ?? 'admin',
  maxReplayMessages: Number(process.env.MAX_REPLAY_MESSAGES ?? 20),
  maxQueryChars: Number(process.env.MAX_QUERY_CHARS ?? 12000),
  contextResetThreshold: Number(process.env.CONTEXT_RESET_THRESHOLD ?? 80000),
  maxConcurrentPerAccount: Number(process.env.MAX_CONCURRENT_PER_ACCOUNT ?? 5),
  thinkMode: (process.env.THINK_MODE ?? 'passthrough') as 'passthrough' | 'strip' | 'separate',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
};
