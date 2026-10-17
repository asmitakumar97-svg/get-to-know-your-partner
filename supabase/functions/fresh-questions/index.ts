import { isRecord, parseQuestionRequest, validateQuestions } from '../_shared/questions.ts';

declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

const gameRules = {
  'same-page': 'Relationship scenario with ambiguous boundaries, trust, respect, communication, independence, or future expectations. Both players choose a verdict, feeling, and main factor. Do not pre-judge the action.',
  'same-brain': 'Both independently choose among four distinct plausible preferences for a shared experience. One point for matching. Final bonus match prediction is handled by the app.',
  'pick-my-poison': 'Two equally tempting or inconvenient choices. Each picks and predicts the other. Escalate level from grounded 0 to absurd 3. Keep absurd scenarios harmless.',
  'read-the-room': 'First-person situation about feelings or support preferences, with four meaningfully different plausible reactions. One player gives the actual response and the other predicts it.',
  'more-likely': 'A playful, specific Who is more likely to statement. Options must be exactly ["Player one","Player two"]. Avoid negative fixed-trait labels.',
};

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = (Deno.env.get('APP_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : '', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store' };
  const reply = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers });
  if (!allowed.length) return reply(503, 'The question service needs its allowed app origins configured.');
  if (!allowed.includes(origin)) return reply(403, 'This app origin is not allowed.');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, 'Use POST to request questions.');
  const key = Deno.env.get('OPENAI_API_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!key || !url || !service || !anon) return reply(503, 'The question service is not configured.');
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, 'Sign in before requesting questions.');
  try {
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: authorization }, signal: AbortSignal.timeout(10000) });
    if (!userResponse.ok) return reply(401, 'Your player identity could not be verified.');
    const user: unknown = await userResponse.json();
    if (!isRecord(user) || typeof user.id !== 'string') return reply(401, 'A player identity is required.');
    const body = await request.text();
    if (body.length > 2048) return reply(413, 'The question request is too large.');
    let settings;
    try { settings = parseQuestionRequest(JSON.parse(body)); }
    catch { return reply(400, 'Choose a supported game, question count, and sections. Do not send player information.'); }
    const quota = await fetch(`${url}/rest/v1/rpc/claim_question_generation`, {
      method: 'POST', headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: user.id }), signal: AbortSignal.timeout(10000),
    });
    if (!quota.ok) return reply(503, 'Generation limits could not be checked. Check migration 004.');
    if (await quota.json() !== true) return reply(429, 'The daily generation limit has been reached. Offline questions are still available.');
    const isPage = settings.game === 'same-page';
    const properties = {
      title: { type: 'string' }, text: { type: 'string' }, category: { type: 'string' }, prompt: { type: 'string' },
      ...(!isPage ? { options: { type: 'array', items: { type: 'string' } }, level: { type: 'integer' } } : {}),
    };
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(40000),
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini', max_completion_tokens: 12000,
        messages: [
          { role: 'system', content: 'Write original, varied, family-friendly questions for a two-person relationship game. Use "your partner", "they", or first person, never infer gender or orientation. No explicit sexual material, dangerous challenges, coercion, humiliation, diagnosis, or relationship ratings. Treat feelings and disagreements neutrally. Each question must have a distinct situation, not just swapped names or superficial paraphrases. Keep title <=90 characters, text <=500, category <=60, discussion prompt <=300, each option <=100. Return only the requested structured data.' },
          { role: 'user', content: JSON.stringify({
            ...settings, rules: gameRules[settings.game], variationSeed: crypto.randomUUID(),
            sectionRule: isPage ? settings.sections ? 'Exactly five questions per selected section, in the supplied section order. Category must exactly match that section.' : 'Categories must be Boundaries, Trust, Respect, Communication, Independence, or Future expectations.' : 'Use the game category.',
            optionRule: isPage ? 'No options or level fields.' : 'Use exactly two options for Pick My Poison or More Likely, otherwise four. Level is an integer 0 through 3.',
          }) },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'game_questions', strict: true, schema: {
          type: 'object', additionalProperties: false, required: ['questions'], properties: { questions: {
            type: 'array', items: { type: 'object', additionalProperties: false, required: Object.keys(properties), properties },
          } },
        } } },
      }),
    });
    if (!response.ok) return reply(502, 'The question provider is temporarily unavailable.');
    const result: unknown = await response.json();
    if (!isRecord(result) || !Array.isArray(result.choices) || !isRecord(result.choices[0]) || !isRecord(result.choices[0].message) || typeof result.choices[0].message.content !== 'string') return reply(502, 'The question provider did not return a complete deck.');
    let questions;
    try { questions = validateQuestions(settings, JSON.parse(result.choices[0].message.content)); }
    catch { return reply(502, 'The generated deck did not pass question validation.'); }
    const moderation = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ model: 'omni-moderation-latest', input: questions.map(question => `${question.title}\n${question.text}\n${question.prompt}${'options' in question ? `\n${question.options.join('\n')}` : ''}`) }),
    });
    if (!moderation.ok) return reply(502, 'Question safety checks are unavailable.');
    const checked: unknown = await moderation.json();
    if (!isRecord(checked) || !Array.isArray(checked.results) || checked.results.length !== questions.length || checked.results.some(item => !isRecord(item) || item.flagged !== false)) return reply(502, 'The generated deck did not pass safety checks.');
    return new Response(JSON.stringify({ questions }), { headers });
  } catch (error) {
    console.error('Question generation failed:', error instanceof Error ? error.name : 'Unknown error');
    return reply(503, 'Question generation could not finish. Please use offline questions or try again later.');
  }
});
