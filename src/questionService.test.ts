import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { offlineBank } from './offlineQuestions';

let handler: (request: Request) => Promise<Response>;
const env: Record<string, string> = {
  APP_ORIGINS: 'http://localhost:5197', OPENAI_API_KEY: 'server-test-key',
  SUPABASE_URL: 'https://test.invalid', SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service',
};
const fetcher = vi.fn<typeof fetch>();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const makeRequest = (body: unknown = { game: 'same-brain', count: 3 }, origin = env.APP_ORIGINS) => new Request('https://test.invalid/functions/v1/fresh-questions', {
  method: 'POST', headers: { Origin: origin, Authorization: 'Bearer player-test-token' }, body: JSON.stringify(body),
});
beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: (name: string) => env[name] }, serve: (callback: typeof handler) => { handler = callback; } });
  await import('../supabase/functions/fresh-questions/index');
});
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
});
afterAll(() => vi.unstubAllGlobals());
describe('Fresh question Edge Function', () => {
  it('authenticates, claims quota, validates provider output, and moderates before returning a complete deck', async () => {
    const questions = offlineBank('same-brain').slice(0, 3);
    fetcher.mockResolvedValueOnce(json({ id: '11111111-1111-4111-8111-111111111111' }))
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ choices: [{ message: { content: JSON.stringify({ questions }) } }] }))
      .mockResolvedValueOnce(json({ results: questions.map(() => ({ flagged: false })) }));
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).questions).toHaveLength(3);
    expect(fetcher.mock.calls[2][0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(String(fetcher.mock.calls[2][1]?.body)).not.toContain('player-test-token');
    expect(String(fetcher.mock.calls[2][1]?.body)).not.toContain('11111111-1111');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects unknown origins and unauthenticated requests without calling the provider', async () => {
    expect((await handler(makeRequest(undefined, 'https://untrusted.invalid'))).status).toBe(403);
    expect((await handler(new Request('https://test.invalid', { method: 'POST', headers: { Origin: env.APP_ORIGINS } }))).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects private input and invalid settings before spending generation quota', async () => {
    fetcher.mockResolvedValue(json({ id: '11111111-1111-4111-8111-111111111111' }));
    expect((await handler(makeRequest({ game: 'same-brain', count: 3, answers: 'private text' }))).status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('fails closed when quota is exceeded or its database migration is unavailable', async () => {
    fetcher.mockResolvedValueOnce(json({ id: 'player' })).mockResolvedValueOnce(json(false));
    expect((await handler(makeRequest())).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockReset();
    fetcher.mockResolvedValueOnce(json({ id: 'player' })).mockResolvedValueOnce(json({}, 404));
    expect((await handler(makeRequest())).status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not return malformed, duplicate, refused, or flagged provider output', async () => {
    fetcher.mockResolvedValueOnce(json({ id: 'player' })).mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ choices: [{ message: { content: '{"questions":[]}' } }] }));
    expect((await handler(makeRequest())).status).toBe(502);
    const questions = offlineBank('same-brain').slice(0, 3);
    fetcher.mockReset();
    fetcher.mockResolvedValueOnce(json({ id: 'player' })).mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ choices: [{ message: { content: JSON.stringify({ questions }) } }] }))
      .mockResolvedValueOnce(json({ results: [{ flagged: true }, { flagged: false }, { flagged: false }] }));
    expect((await handler(makeRequest())).status).toBe(502);
  });
});

describe('Database-enforced generation budgets', () => {
  const db = new PGlite();
  const migration = readFileSync(new URL('../supabase/migrations/004_fresh_questions.sql', import.meta.url), 'utf8');
  beforeAll(async () => {
    await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);');
    await db.exec(migration);
  });
  afterAll(async () => { await db.close(); });
  it('reserves requests atomically, enforces user and global budgets, and preserves usage on rerun', async () => {
    const ids = Array.from({ length: 11 }, () => crypto.randomUUID());
    for (const id of ids) await db.query('insert into auth.users values ($1)', [id]);
    const claims = await Promise.all(Array.from({ length: 25 }, () => db.query<{ allowed: boolean }>('select public.claim_question_generation($1) as allowed', [ids[0]])));
    expect(claims.filter(result => result.rows[0].allowed)).toHaveLength(20);
    await db.exec(migration);
    expect((await db.query<{ allowed: boolean }>('select public.claim_question_generation($1) as allowed', [ids[0]])).rows[0].allowed).toBe(false);
    for (const id of ids.slice(1, 10)) for (let n = 0; n < 20; n++) expect((await db.query<{ allowed: boolean }>('select public.claim_question_generation($1) as allowed', [id])).rows[0].allowed).toBe(true);
    expect((await db.query<{ allowed: boolean }>('select public.claim_question_generation($1) as allowed', [ids[10]])).rows[0].allowed).toBe(false);
    const permissions = await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.claim_question_generation(uuid)','execute') as allowed");
    expect(permissions.rows[0].allowed).toBe(false);
    await expect(db.query('select public.claim_question_generation($1)', [crypto.randomUUID()])).rejects.toThrow('valid player');
  });
});
