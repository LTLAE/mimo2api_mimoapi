import { Hono } from 'hono';
import { config } from '../config.js';
import {
  listAccounts, createAccount, getAccountById,
  updateAccount, deleteAccount, parseCurl,
  getAccountByApiKey
} from '../accounts.js';
import {
  listApiKeys, createApiKey, getApiKeyById,
  updateApiKey, deleteApiKey
} from '../api-keys.js';
import { listSessions, deleteSession } from '../mimo/session.js';
import { db } from '../db.js';
import { callMimo } from '../mimo/client.js';
import { v4 as uuidv4 } from 'uuid';

async function adminAuth(c: Parameters<Parameters<Hono['use']>[1]>[0], next: () => Promise<void>): Promise<void | Response> {
  const key = c.req.header('X-Admin-Key') ?? c.req.query('admin_key');
  if (key !== config.adminKey) {
    return c.json({ error: 'Forbidden' }, 403) as unknown as Response;
  }
  await next();
}

export function registerAdmin(app: Hono) {
  const admin = new Hono();
  admin.use('/*', adminAuth);

  // --- Accounts ---
  admin.get('/accounts', (c) => {
    const accounts = db.prepare(`
      SELECT a.id, a.alias, a.user_id, a.service_token, a.ph_token, a.api_key,
             a.is_active, a.active_requests, a.created_at,
             COALESCE(COUNT(l.id), 0) as total_requests,
             COALESCE(SUM(l.prompt_tokens), 0) as total_prompt_tokens,
             COALESCE(SUM(l.completion_tokens), 0) as total_completion_tokens
      FROM accounts a
      LEFT JOIN request_logs l ON a.id = l.account_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `).all();
    return c.json(accounts);
  });

  admin.post('/accounts', async (c) => {
    const body = await c.req.json();
    let data: { service_token: string; user_id: string; ph_token: string; alias?: string } | null = null;

    if (body.curl) {
      const parsed = parseCurl(body.curl);
      if (!parsed) return c.json({ error: 'Failed to parse cURL command' }, 400);
      data = { ...parsed, alias: body.alias };
    } else if (body.service_token) {
      data = {
        service_token: body.service_token,
        user_id: body.user_id ?? '',
        ph_token: body.ph_token ?? '',
        alias: body.alias,
      };
    } else {
      return c.json({ error: 'Provide curl or service_token' }, 400);
    }

    const result = createAccount(data);
    return c.json({ ...result, message: 'Account created' }, 201);
  });

  admin.patch('/accounts/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const account = getAccountById(id);
    if (!account) return c.json({ error: 'Not found' }, 404);
    updateAccount(id, { alias: body.alias, is_active: body.is_active });
    return c.json({ message: 'Updated' });
  });

  admin.delete('/accounts/:id', (c) => {
    const id = c.req.param('id');
    const account = getAccountById(id);
    if (!account) return c.json({ error: 'Not found' }, 404);
    deleteAccount(id);
    return c.json({ message: 'Deleted' });
  });

  admin.post('/accounts/test', async (c) => {
    const body = await c.req.json();
    const account = body.api_key
      ? getAccountByApiKey(body.api_key)
      : getAccountById(body.id);
    if (!account) return c.json({ error: 'Account not found' }, 404);

    try {
      const convId = uuidv4().replace(/-/g, '');
      let reply = '';
      for await (const chunk of callMimo(account, convId, 'hi', false)) {
        if (chunk.type === 'text') reply += chunk.content ?? '';
      }
      return c.json({ success: true, response: reply.slice(0, 200) });
    } catch (e) {
      return c.json({ success: false, error: String(e) });
    }
  });

  // --- Sessions ---
  admin.get('/sessions', (c) => {
    return c.json(listSessions());
  });

  admin.delete('/sessions/:id', (c) => {
    deleteSession(c.req.param('id'));
    return c.json({ message: 'Deleted' });
  });

  admin.delete('/sessions', (c) => {
    db.prepare('DELETE FROM sessions').run();
    return c.json({ message: 'All sessions deleted' });
  });

  // --- Logs ---
  admin.get('/logs', (c) => {
    const accountId = c.req.query('account_id');
    const status = c.req.query('status');
    const page = Number(c.req.query('page') ?? 1);
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM request_logs WHERE 1=1';
    const params: unknown[] = [];
    if (accountId) { sql += ' AND account_id = ?'; params.push(accountId); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = db.prepare(sql).all(...params);
    const total = (db.prepare('SELECT COUNT(*) as cnt FROM request_logs').get() as { cnt: number }).cnt;
    return c.json({ logs, total, page, limit });
  });

  // --- Stats ---
  admin.get('/stats', (c) => {
    const accounts = db.prepare(`
      SELECT a.id, a.alias, a.api_key, a.is_active, a.active_requests,
             COALESCE(SUM(l.prompt_tokens), 0) as total_prompt_tokens,
             COALESCE(SUM(l.completion_tokens), 0) as total_completion_tokens,
             COUNT(l.id) as total_requests
      FROM accounts a
      LEFT JOIN request_logs l ON a.id = l.account_id
      GROUP BY a.id
    `).all();
    return c.json({ accounts, maxConcurrent: config.maxConcurrentPerAccount });
  });

  admin.get('/stats/api-keys', (c) => {
    const apiKeys = db.prepare(`
      SELECT k.id, k.key, k.name, k.is_active, k.request_count, k.last_used_at,
             COALESCE(COUNT(l.id), 0) as total_requests,
             COALESCE(SUM(l.prompt_tokens), 0) as total_prompt_tokens,
             COALESCE(SUM(l.completion_tokens), 0) as total_completion_tokens
      FROM api_keys k
      LEFT JOIN request_logs l ON k.id = l.api_key_id
      GROUP BY k.id
      ORDER BY k.created_at DESC
    `).all();
    return c.json({ apiKeys });
  });

  // --- API Keys ---
  admin.get('/api-keys', (c) => {
    return c.json({ keys: listApiKeys() });
  });

  admin.post('/api-keys', async (c) => {
    const body = await c.req.json();
    const apiKey = createApiKey(body.name);
    return c.json(apiKey, 201);
  });

  admin.patch('/api-keys/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const apiKey = getApiKeyById(id);
    if (!apiKey) return c.json({ error: 'Not found' }, 404);
    updateApiKey(id, { name: body.name, is_active: body.is_active });
    return c.json({ message: 'Updated' });
  });

  admin.delete('/api-keys/:id', (c) => {
    const id = c.req.param('id');
    const apiKey = getApiKeyById(id);
    if (!apiKey) return c.json({ error: 'Not found' }, 404);
    deleteApiKey(id);
    return c.json({ message: 'Deleted' });
  });

  admin.get('/api-keys/:id/stats', (c) => {
    const id = c.req.param('id');
    const apiKey = getApiKeyById(id);
    if (!apiKey) return c.json({ error: 'Not found' }, 404);

    const stats = db.prepare(`
      SELECT COUNT(*) as total_requests,
             COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
             COALESCE(SUM(completion_tokens), 0) as total_completion_tokens
      FROM request_logs
      WHERE api_key_id = ?
    `).get(id);

    return c.json({ ...apiKey, stats });
  });

  app.route('/admin', admin);
}
