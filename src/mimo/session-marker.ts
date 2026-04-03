import { createHash } from 'crypto';
import { Context } from 'hono';

/**
 * 消息历史连续性方案
 * 通过检测新消息是否包含上一次的消息来判断会话连续性
 */

/**
 * 计算消息列表的指纹（用于快速匹配）
 */
export function calculateMessageFingerprint(messages: any[]): string {
  // 只取最后几条消息计算指纹（避免过长）
  const recentMessages = messages.slice(-5);
  const content = JSON.stringify(recentMessages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content.slice(0, 200) : String(m.content).slice(0, 200)
  })));
  
  const fingerprint = createHash('sha256').update(content).digest('hex');
  
  console.log('[FINGERPRINT] Calculated:', {
    messageCount: messages.length,
    contentPreview: content.slice(0, 100) + '...',
    fingerprint: fingerprint.slice(0, 16) + '...'
  });
  
  return fingerprint;
}

/**
 * 生成客户端会话标识（备用方案）
 */
export function generateClientSessionId(c: Context, accountId: string): string {
  // 优先使用客户端提供的会话ID
  const explicitSessionId = c.req.header('x-session-id');
  if (explicitSessionId) {
    console.log('[SESSION] Using explicit session ID from header');
    return `explicit_${accountId}_${explicitSessionId}`;
  }

  // 默认：基于账号的会话
  console.log('[SESSION] Using account-based session (fallback)');
  return `account_${accountId}`;
}
