# Get to Know Your Partner · The Playroom

A mobile-first conversation game for two people. Built with React, TypeScript, Vite, and Supabase.

## Five little games, five different mechanics

- **Same Page?** — Choose one or more sections: Boundaries, Trust, Respect, Communication, Independence, and Future expectations. Play **five questions per selected section**, grouped by section (5–30 questions). All six sections are shown during setup and in the in-game section overview. Independent verdict, emotion, and values reflections; no game score.
- **Same Brain?** — Four-option shared questions. One shared point for each matching answer. In the final bonus round, both independently predict match/no-match; each correct prediction earns one individual bonus point, separately from the shared total.
- **Pick My Poison** — Both choose between two dilemmas and predict the other's choice. Each accurate prediction earns one individual point. Short decks span the increasing ridiculousness of the full deck rather than showing only the easy questions.
- **Read the Room** — Alternating responder and predictor. One actual response, one prediction; only the predictor can earn a point. Reports show each player's opportunities, since an odd number of rounds gives one player an extra turn predicting. Preferences and emotions are never marked wrong.
- **Who's More Likely To…?** — Both choose a named person using the same player order on both devices. One shared point for choosing the same person. These are perceptions, not personality facts.

All five games have equal floral-bordered cards, a visible brief "How to play", and the same setup, private-answer, reveal, and discussion layout. The app mark is an original two-flower illustration. Floral stickers and bouquets live in their own layout space, never over copy; text backgrounds are solid, not floral patterns. Body copy and buttons use readable sizes, with 44–48px interactive targets.

Inside games, question, answer, handoff, reveal, and discussion cards have floral border ribbons confined to 46px top/bottom padding. Each game uses its own pastel question-card colour, with a flower illustration in a separate block above the question. The border SVG is bundled with the stylesheet for offline use.

On desktop, the home hero uses a compact "Before you play" guide instead of a large decorative bouquet panel. On phones (700px and below), persistent bottom navigation separates **Home**, **About**, **Games**, and the saved **Resume/Report** view. About contains the guide and app purpose. Games uses a compact **One game / Game night** selector, previous/next browsing of one card at a time, and a separate playlist review screen. Setup is full-screen on phones. Browser Back works between home screens and playlist review. Desktop keeps the full collection/grid. Opening Home or About never leaves a room.

All 110 seeded questions use gender-neutral wording ("your partner", "they", or the players' names). Both players can apply the same scenario without assuming anyone's gender, pronouns, or relationship roles. Existing saved games retain the exact scenario snapshots that were originally answered.

The original 30 Same Page? seeds and 20 seeds per other mode remain editable. New sessions and replays use validated fresh online questions when configured, otherwise a **630-question offline bank**, including context-based variations. Other modes support 3, 5, 10, or 20 rounds. All five support online rooms, pass-and-play, simulated-partner demos, minimum discussion pauses, hidden answers, refresh recovery, and a private downloadable end report. Choose a single game or build a playlist before creating its room. Replaying online creates a fresh room and invite, preserving the earlier room's reports. Existing saved decks and three-question demos remain supported.

### Fresh questions and repeat tracking

- New single games, whole playlists, and replays prepare and snapshot their questions before starting. Joining or refreshing uses that snapshot; it never generates different questions mid-room. Demos use the offline bank without spending AI quota.
- Repeat history stores question-text fingerprints, not answers, on this browser. Offline selection prioritizes unseen questions, preserving five questions per selected Same Page? section and ascending Pick My Poison difficulty. Once a selection is exhausted, least-recently-used questions return with a visible notice. Clearing browser data clears history; different browsers do not share it.
- Online generation checks exact counts, field lengths, gender-neutral language, distinct texts/options, stable player positions, difficulty, and section coverage. Server-side moderation runs before generated questions are returned. Invalid, repeated, unavailable, rate-limited, or offline generation explicitly falls back with a notice. AI cannot guarantee that every idea is semantically unique forever; exact prior question text is rejected on this browser.
- Only game ID, question count, and selected sections are sent to the generation endpoint. Player names, answers, explanations, reports, and history are not sent to OpenAI. Reports remain deterministic and local. The provider receives game instructions and a random variation seed.

## Your two-person game night

The logo and **Home · All games** buttons open the home collection without ending the current session. Home offers **One game at a time** (one report per game) and **A bunch of games together** (one combined report after the playlist). Use **Resume session** or **Return to report** to reopen saved progress. Starting a different session requires explicitly ending the existing one first; save any reports you want to keep before doing so. Going home does not leave an online room or pause the discussion timer. The `#home` and `#play` URL fragments preserve the current view across refreshes; opening `/#home` always shows the collection.

Add two to five different games to the playlist, rearrange them with the earlier/later controls, then choose **Set up game night**. Choose names, one-device or online play, Same Page? sections if included, rounds for the other games, and a minimum discussion pause. The setup shows the ordered games and correct total question count before you begin. Replaying a playlist preserves both the selected Same Page? sections and the other games' round counts.

- Play in your chosen order. Intermissions offer a breather and a next-game button, not separate reports. The playlist produces one combined report at the very end, with individual game evidence included inside it. Single-game play still produces its own report.
- Online players keep **one room and invite for the entire playlist**. Both must be ready before advancing to the next game or opening the final report.
- Completed snapshots and private explanations are archived before the next game starts. Repeated transitions and delayed answers/readiness from an earlier playlist game cannot advance or answer the new game.
- At the end, the **combined relationship reflection** includes separate summaries for each game, shared ground, surprises, follow-up conversations, all original reports, and a private text download. There is no averaged game score or overall compatibility percentage.
- Refreshes restore the playlist, current game, and completed reports. On one device this uses local storage; online it uses the room's server state. Local play works offline after the production app has cached successfully.
- A departure stops the playlist, but the remaining online player can still open and save previously completed game reports. A combined report is generated only for a fully completed playlist.
- Leaving clears this device's local session. Online rooms and archived reports remain subject to the same seven-day room expiry/retention policy.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. `npm run build` creates the static production site in `dist`. `npm test` runs game-rule tests and an in-process PostgreSQL integration suite using PGlite.

### GitHub Pages deployment

[.github/workflows/deploy.yml](./.github/workflows/deploy.yml) tests, builds, and deploys every push to `main`. In repository **Settings → Pages**, select **GitHub Actions** as the source. Vite uses relative asset URLs so the site and its scoped offline worker work under the repository URL, not just the domain root.

Set the repository Actions variable `VITE_SUPABASE_URL` and Actions secret `VITE_SUPABASE_ANON_KEY` before deploying online rooms. Both values are public client configuration in the compiled app; never substitute a service-role key. Without them the hosted app supports same-device play and demos, but displays the online configuration notice. After changing configuration, rerun the workflow to rebuild. Database migrations and Edge Functions are deployed separately to the intended Supabase project, never automatically against an inferred project.

## Play modes

- **One device:** Both players answer privately, passing the device between turns. Answers reveal only after both submit. Works without a backend. Production builds cache the app with a service worker after the first successful load, enabling offline play and refresh restoration. Offline installation needs HTTPS or localhost. Vite development mode does not install the offline cache.
- **Online:** Two separate browsers/devices join by an eight-character code or invite link. Persistent anonymous authentication restores each player's identity on refresh. Use separate browser profiles or devices for two players, not two tabs in the same profile.
- **Demo:** Three scenarios with a clearly labeled simulated partner.

Every reveal includes discussion prompts and a timer (30 seconds to 3 minutes), with unlimited time afterward. **Online discussion is optional:** either player can press **Skip timer · I’m ready** immediately, but the round advances only after both players mark ready. Single games and playlists behave identically. One-device and demo play retain the minimum pause; on one device, the shared button represents both players' agreement.

Apply [supabase/migrations/005_optional_online_discussion.sql](./supabase/migrations/005_optional_online_discussion.sql) after migration 003 to enable skipping on the server, including existing rooms. Migration 004 is only needed for fresh-question generation. Migration 005 is rerunnable and preserves answers, readiness, and reports. Without it, older servers still reject early readiness with an explicit discussion-time error.

Verdict, emotional, and values alignment are separate **exact-match counts**, not a relationship score, diagnosis, or ranking. Different responses are never marked wrong.

## Your compatibility reflection

Every completed Same Page? game ends with an extended, answer-based reflection. The four playful modes have their own mode-specific points, prediction/choice evidence, conversation journal, and downloadable game-night report:

- Three independent alignment threads, shown as shared-choice counts, never an overall grade or percentage.
- Shared ground and different perspectives, with expandable scenario evidence.
- A specific spotlight when the verdict matches but the selected feelings differ.
- All six themes, including explicit "not explored" states and a one-scenario caveat.
- Each person's selected emotions and priorities with counts, plus optional questions about supportive care. These are questions, not inferred needs or personality traits.
- The full conversation journal, exact optional explanations, personalized discussion prompts, and small next-step suggestions.
- A **Save our report** button for a private plain-text keepsake. Both players should agree before saving or sharing answers.

The report is computed locally from completed, paired answers in the current game's snapshot. It makes no AI calls, sends no explanations to an external model, does not interpret free text as a diagnosis, and ignores incomplete rounds. It is regenerated after refresh in local, demo, and online play; online answers remain in Supabase under the existing room privacy rules. A completed online report remains visible to the remaining player if their partner leaves. A demo report is explicitly labeled as simulated.

The original floral SVG illustrations and bright pink, olive, orange, and periwinkle palette are inspired by the supplied mood boards; the reference images themselves are not copied into the app.

## Enable online rooms

1. Create a Supabase project.
2. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**. Consider CAPTCHA and rate limits before a public launch.
3. For a new project, run [supabase/schema.sql](./supabase/schema.sql), then [supabase/migrations/002_game_hub.sql](./supabase/migrations/002_game_hub.sql), then [supabase/migrations/003_game_nights.sql](./supabase/migrations/003_game_nights.sql), in order. For an existing installation, run **only the migrations not yet installed**, in order; do not rerun the base schema. The new migrations preserve existing rooms and reports and are safe to reapply. Migration 003 is required for online playlists and Same Page? decks of 15, 25, or 30 questions; existing single-game RPCs and saved rooms still work.
4. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the project URL and public anon key. Never put the service-role key in the frontend.
5. Restart Vite. For hosting, configure those same variables at build time and deploy `dist` to a static host with HTTPS.
6. The invite link uses the current site's URL. For long-distance play, deploy to a publicly reachable HTTPS host; localhost links are not accessible remotely.

Online rooms deliberately display an honest setup notice when no backend is configured. They never fall back to pretending another player is connected.

### Enable fresh AI questions (optional)

The code is included but generation does not work live until you configure and deploy it. Ordinary offline play needs none of these steps.

1. Configure Supabase and anonymous authentication as above. Apply [supabase/migrations/004_fresh_questions.sql](./supabase/migrations/004_fresh_questions.sql). It adds a private quota table and a service-role-only reservation RPC, without changing rooms or answers.
2. Using Supabase CLI with your project linked, set **server-only** function secrets: `OPENAI_API_KEY`, `APP_ORIGINS` (comma-separated exact app origins, including scheme and port), and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`, must support strict JSON-schema output). Use the Supabase secrets dashboard or `supabase secrets set`. Never put these secrets into a `VITE_` variable or a committed environment file. Standard Supabase URL, anon key, and service-role secrets are supplied by the platform.
3. Deploy with `supabase functions deploy fresh-questions`. [supabase/config.toml](./supabase/config.toml) disables the legacy gateway JWT check because the handler verifies every bearer token against Supabase Auth itself. This supports both legacy JWT and newer signing-key projects; unauthenticated requests are rejected before generation.
4. Add the built site's origin to `APP_ORIGINS` (for this preview, `http://127.0.0.1:5197`). CORS is an allowlist, not an authentication control. Requests require a verified identity and a database quota reservation. The service fails closed if authentication, limits, or moderation cannot be checked.
5. The defaults are **20 deck requests per player/day** and **200 per project/day**, reserved atomically in PostgreSQL. A five-game playlist uses five requests. Failed provider/safety checks still consume a reservation. Set provider spending limits and Supabase anonymous-signup CAPTCHA/rate limits before exposing a public endpoint; anonymous identities alone do not stop determined abuse. Adjust SQL budgets intentionally to suit your costs.
6. Optionally schedule `delete from public.question_generation_usage where day < current_date - 7;` for quota retention. The table contains scopes/dates/counts only, never prompts or answers.

Unit tests use mocked provider responses, and database tests exercise real PostgreSQL quota enforcement. No live provider key, project migration, or deployed function is assumed by the tests.

### State and privacy

- SQL RPCs serialize each room's transitions with row locks, enforce membership and two-player capacity, and make duplicate submissions/readiness idempotent. Online discussion time is advisory; mutual readiness is still required.
- Active-game answers live in a separate table, with no direct client table permissions. The `game_state` RPC excludes all answers for a round until both exist. After both players finish a playlist game and agree to continue, its fully revealed snapshot is archived in the member-only room record; it never contains a pending single answer. Realtime publishes that protected room record (including completed archives, never hidden active answers). Client polling also recovers missed updates after reconnect.
- Persistent anonymous auth is the reconnect credential. Clearing browser data loses that identity; do not clear storage during an online game.
- Closing a tab is temporary absence, not a departure. Presence indicates connectivity; explicitly leaving pauses the session permanently. Replaying online creates a fresh invite-only room.
- Online rooms expire after seven days. Expiration blocks RPC access but does not delete rows. To remove expired data, schedule `delete from public.game_rooms where expires_at < now();` in Supabase Cron; dependent players/answers cascade.
- One-device answers are saved unencrypted in browser local storage for refresh recovery. The pass-and-play curtain is a social privacy feature, not a defense against someone inspecting storage. Leave the session to clear its local answers. Online answers are not stored in local storage by this app.
- For a public production release, configure abuse protections, a data retention policy, and database backups appropriate to your audience.

## Editing scenarios and logic

Edit [src/scenarios.ts](./src/scenarios.ts) to update the original 30 Same Page? seeds and section descriptions. Keep exactly five seeds per section. [src/offlineQuestions.ts](./src/offlineQuestions.ts) adds editable context-based offline variations and additional party questions. [src/freshQuestions.ts](./src/freshQuestions.ts) selects fresh decks, tracks browser history, and handles explicit fallback notices. [supabase/functions/_shared/questions.ts](./supabase/functions/_shared/questions.ts) shares request/response validation with the generation function. Section games preserve the selected section order while varying questions within each section; legacy three-question decks remain supported. Each new game snapshots its deck, so edits do not change rooms already underway.

[src/game.ts](./src/game.ts) contains the pure local state transitions, validation, and three-axis alignment logic. [src/backend.ts](./src/backend.ts) contains the Supabase adapter. The SQL RPCs enforce online equivalents independently of the browser.

[src/night.ts](./src/night.ts) contains ordered playlist construction, local game-to-game transitions, separate evidence summaries, and combined text exports. [src/NightReport.tsx](./src/NightReport.tsx) renders playlist progress, intermissions, completed archives, and the combined report. [src/playground.css](./src/playground.css) contains the unified playground and reserved-space illustration layouts.

[src/SectionPicker.tsx](./src/SectionPicker.tsx) renders the six-section selector and in-game section overview. [src/scenarios.ts](./src/scenarios.ts) validates exactly five questions per selected section and restores section selections when replaying.

[src/report.ts](./src/report.ts) contains deterministic report generation and text export. [src/CompatibilityReport.tsx](./src/CompatibilityReport.tsx) renders the interactive report. [src/BotanicalArt.tsx](./src/BotanicalArt.tsx) contains original vector illustrations; [src/card-deck.css](./src/card-deck.css) defines the floral card-deck theme.

[src/catalog.ts](./src/catalog.ts) contains game definitions and the four new editable 20-question decks. [src/party.ts](./src/party.ts) handles mode-specific validation, role assignment, exact scoring, and report export. [src/PartyGame.tsx](./src/PartyGame.tsx) provides the forms, shared reveal, discussion pause, and reports. [src/GameHub.tsx](./src/GameHub.tsx) renders the game selector.

## Verification

```sh
npm test
npm run build
```

For online acceptance testing, configure Supabase and use two independent browsers: create/join; submit once and verify the other answer is absent from the RPC response; submit the second answer; verify shared reveal; refresh each browser; disconnect/reconnect; retry duplicate requests; mark one player ready before the timer expires and verify the round does not advance; mark the other ready and verify it advances immediately; complete recap; leave and confirm the other player sees the departure.
