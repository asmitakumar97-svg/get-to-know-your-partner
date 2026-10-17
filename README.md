# Get to Know Your Partner · The Playroom

A mobile-first conversation game for two people. Built with React, TypeScript, Vite, and Supabase.

## Eight little games, different ways to connect

- **Same Page?** — Choose a length, then play mixed situations from a **100-question curated library**. No category picker, category strip, or grouped section screens. Nine internal topics support report analysis only. Every new game uses the same six takes, in order: **Nothing wrong, Boundary-crossing, Disrespectful, Micro-cheating, Cheating, Okay since we discussed**. These are labels, not a numerical severity scale. The reasoning question offers six plain-language choices with short explanations: what happened, intentions, openness, agreed expectations, respect for feelings, and relationship impact. Feelings stay consistent. Independent verdict, emotion, and values reflections; no game score.
- **Same Brain?** — Four-option shared questions. Reveal your choices and explore the reasons behind them. In the final round, both independently share whether they expect the choices to match; this remains a conversation question, not a bonus or reward.
- **Pick My Poison** — Both choose between two dilemmas and predict the other's choice. Each person's guess appears beside the partner's actual answer, using neutral anticipated/unexpected wording. The report journal uses the same comparison. Short decks span the increasing ridiculousness of the full deck rather than showing only the easy questions.
- **Read the Room** — Alternating responder and predictor. One actual response, one prediction; explore what fits the person in that situation. Preferences and emotions are never marked wrong, and partners are never ranked.
- **Who's More Likely To…?** — Both choose a named player or **Both of us**, using the same player order on both devices. Compare perceptions and discuss your examples, without turning agreement into a reward. These are perceptions, not personality facts.

All games are **score-free**: no awarded points, bonus rewards, scoreboards, match percentages, winners, or numeric alignment totals. This applies to rules, setup, reveals, individual and combined reports, expandable journals, and downloads, including restored sessions. Comparisons record answers and whether a prediction anticipated the response, not game scores. Internal evidence counts support cautious analysis only. Adventure resources are consumable supplies, not a relationship score.

### Three more fully playable games

- **If I Were You**: 30 original situations across stress, celebrations, reassurance, misunderstandings, encouragement, and space/appreciation. Each person privately selects for themselves and for their partner. Reveals explicitly say **what each person selected for themselves**, **what they selected for their partner**, and **whether the guess matched the partner’s own selection**. Optional reactions are “That feels right,” “It's more complicated,” and “Tell me more.”
- **When Things Get Hard**: 30 original conflict/repair situations in six categories. Choose the natural response, not an ideal answer. Either partner may skip before the reveal; both answers are withheld and excluded from reports, with no required discussion wait. Selected rounds offer an optional usual-response/wish reflection. No disclosure or explanation is required.
- **Us Against the World**: four original, illustrated, five-chapter adventures: **Stranded Together**, **The World's Worst Restaurant**, **The Alien Diplomacy Disaster**, and **Fix the Spaceship**. Each chapter gives both players a committed turn. Role-specific private briefings invite information sharing. A shared budget, preparation flags, changing conditions, action requirements, and combined actions determine the story. Stranded starts with two ranked three-item wishlists; alternating first-unique priorities produce exactly three shared items. Each adventure has a full-checklist and safe alternative ending, determined by actual decisions. One player never wins against the other.

The two conversation games offer 3/5/10/20/30 mixed questions or 3/5 in a selected category. Selection is randomised and repeat-aware. Adventures always use their five ordered chapters, with a selectable world and alternative decisions on replay. All three support the existing local/demo/online rooms and two-to-eight-game playlists. The browser computes reproducible adventure feedback from the same stored actions; the database independently enforces turn order, item limits, prerequisites and remaining-resource budgets.

Optional reflections default to **private**. Online, private notes and role clues live in separate, non-readable tables; authenticated RPCs return only the author’s notes and that player’s briefings. Shared reflections require explicit consent and may be changed back to private. Only consented, structured reflections enter the couple’s analysis; free text is never mined for motives or traits. Private notes are not included in couple downloads. Shared-device privacy remains trust-based. Reports use deterministic, evidence-led local analysis, not an external AI call; adventure interpretations explicitly distinguish recorded in-game decisions from real-life behaviour.

All eight games reuse the shared setup, private handoff, reveal, and discussion conventions; adventures add their own illustrated chapter/action layout. Instructions remain on the game-selection screen; redundant rules cards beneath the in-game question are removed. The logo pairs original intertwined hearts with a refined serif wordmark. The navigation and favicon share [one SVG source](./src/assets/connection-mark.svg), with offline caching and compact tablet/phone sizing. The existing accessible home link and safe home-navigation behaviour are unchanged. Floral stickers and bouquets live in their own layout space, never over copy; text backgrounds are solid, not floral patterns. Body copy and buttons use readable sizes, with 44–48px interactive targets.

The whole app uses the supplied palette: **rose #CD6184, sage #97A273, warm yellow #FFBD59, pale blush #FFECF2, and forest green #254117**. [src/theme.css](./src/theme.css) owns semantic colour tokens for navigation, cards, setup/forms, game states, reports, and illustrations. Pale derived surfaces and darker rose text keep normal-text contrast at least 4.5:1; exact rose/sage swatches are accents rather than low-contrast text/button combinations. The reference image is colour inspiration only; its logo, illustrations, and typography are not copied.

Game-library cards retain their small game icons and floral borders, without top flower stickers or large illustrations. Adventure-selection and report illustrations are retained.

When Things Get Hard shows its question directly beneath round progress, without the large bridge illustration above it. Its report artwork is retained.

Inside games, question, answer, handoff, and reveal cards have floral border ribbons confined to 36px top/bottom padding. Question and answer cards remain separate. Smaller stickers, shorter helper text, and tighter spacing reduce visual weight without shrinking answer text or tap targets. Each game uses its own pastel question-card colour. After reveals, a small optional "Ask each other" line replaces the large discussion card. Short questions vary by game and round without repeats within a game of up to 50 rounds; both devices and refreshes show the same question. Reports retain the original scenario-specific follow-up prompts. Timers and mutual online readiness are unchanged. The border SVG is bundled with the stylesheet for offline use.

On desktop, the home hero uses a compact "Before you play" guide instead of a large decorative bouquet panel. On phones (700px and below), persistent bottom navigation separates **Home**, **About**, **Games**, and the saved **Resume/Report** view. About contains the guide and app purpose. Games uses a compact **One game / Game night** selector, previous/next browsing of one card at a time, and a separate playlist review screen. Setup is full-screen on phones. Browser Back works between home screens and playlist review. Desktop keeps the full collection/grid. Opening Home or About never leaves a room.

All 110 seeded questions use gender-neutral wording ("your partner", "they", or the players' names). Both players can apply the same scenario without assuming anyone's gender, pronouns, or relationship roles. Existing saved games retain the exact scenario snapshots that were originally answered.

Same Page? uses the curated 100 situations rather than generated context-swapped variations. The original 30 seeds and section-based decks remain supported for legacy saves/replays. The four original party games retain their editable banks and optional validated fresh online questions. The original five-game mixed offline bank contains **508 questions**; the new conversation games add **60 original situations**, and the four adventures have **20 ordered chapters**. Original games support 3/5/10/20/30/50 rounds; the new games use the lengths described above. All eight support online rooms, pass-and-play, simulated-partner demos, hidden responses, refresh recovery, and a private downloadable report. Choose a single game or build a playlist before creating its room. Online replay creates a fresh invite, preserving the earlier room’s reports. Existing snapshots keep their original wording.

### Switching a question

All seven question-based games offer **Switch question** before either player submits. It immediately replaces the current question for both players and clears unsent selections; there is no three-switch or per-game cap. Adventure chapters stay in story order.

Replacements come from the same game's local curated/offline bank, never an AI request. Questions already anywhere in the deck or previously set aside in that game are excluded by ID and normalized question text. Single-category selections, legacy Same Page? sections, current verdict/reason wording, and Pick My Poison difficulty are preserved. If no alternatives remain (for example, a full category bank is already selected), the disabled control explains why. No hidden repeat or shorter-game fallback is used.

Switch history and the replacement snapshot survive refreshes and are retained in playlist archives; discarded questions do not become report evidence. Online switching requires [migration 008](./supabase/migrations/008_switch_questions.sql), applied after 007. Room locks serialize switching with answers, both devices receive the same updated deck, and question-version checks reject submissions written for a replaced question. Answers remain private until both submit. Missing migration or stale-request errors are shown rather than switching independently on each phone.

### Written answers

If I Were You uses a text-only report cover, without the envelope illustration. Its question artwork and the other games' report artwork are unchanged.

All seven question-based games offer **Other — write your answer**, including partner-choice predictions and Read the Room's alternating prediction role. Same Page? has a separate written field for the take, feeling, and main reason. A selected Other field requires non-whitespace text, up to 600 UTF-16 units (the browser's character limit); optional explanation fields remain separate. Returning to a preset choice clears its written draft. Question switching clears every unsent field. Adventure actions and Same Brain's boolean final-round match forecast remain structured.

Written responses follow the same private-submission, simultaneous-reveal, refresh, replay, and playlist persistence rules as preset choices. Reveals, journals, and detailed downloads retain the original text. A comparison involving a written response is **unassessed**, never an automatic match or difference, even when both people write identical words. This also applies to partner predictions and final-round match forecasts. Preset-only comparisons remain unchanged.

Reports do not infer emotions, motives, traits, or support styles from free text. Automated patterns use only fully preset paired rounds; written responses provide literal evidence for a smaller observation and a conversation prompt, not a forced interpretation. Same Page?'s separate-axis reveal still compares any preset axes independently. An all-written game has real paired evidence, not a false "no answers" or "everything matched" result.

Online written responses require [migration 009](./supabase/migrations/009_written_answers.sql), after 008. It validates each field server-side and preserves membership checks, room locks, duplicate protection, sensitive skips, and switched-question guards. No answer is stored in the public deck. Local and demo play need no database change.

### Fresh questions and repeat tracking

- New single games, whole playlists, and replays prepare and snapshot their questions before starting. Joining or refreshing uses that snapshot; it never generates different questions mid-room. Demos use the offline bank without spending AI quota.
- Repeat history stores question-text fingerprints, not answers, on this browser. Offline selection prioritizes unseen questions, with no forced opening question. Same Page? mixes topics; Pick My Poison preserves ascending difficulty. Legacy section-based replays keep five questions per selected section. Once a selection is exhausted, least-recently-used questions return with a visible notice. Clearing browser data clears history; different browsers do not share it.
- Online generation checks exact counts, field lengths, gender-neutral language, distinct texts/options, stable player positions, difficulty, and section coverage. Server-side moderation runs before generated questions are returned. Invalid, repeated, unavailable, rate-limited, or offline generation explicitly falls back with a notice. AI cannot guarantee that every idea is semantically unique forever; exact prior question text is rejected on this browser.
- Only game ID, question count, and selected sections are sent to the generation endpoint. Player names, answers, explanations, reports, and history are not sent to OpenAI. Reports remain deterministic and local. The provider receives game instructions and a random variation seed.

## Your two-person game night

The logo and **Home · All games** buttons open the home collection without ending the current session. Home offers **One game at a time** (one report per game) and **A bunch of games together** (one combined report after the playlist). Use **Resume session** or **Return to report** to reopen saved progress. Starting a different session requires explicitly ending the existing one first; save any reports you want to keep before doing so. Going home does not leave an online room or pause the discussion timer. The `#home` and `#play` URL fragments preserve the current view across refreshes; opening `/#home` always shows the collection.

Add two to eight different games to the playlist, rearrange them with the earlier/later controls, then choose **Set up game night**. Choose names, one-device or online play, questions per conversation game, an adventure world if included, and a discussion pause. Adventures keep five chapters; the setup includes those chapters in the correct total. Replaying preserves game lengths; legacy section-based saves remain supported.

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

Every reveal includes discussion prompts and a suggested timer (30 seconds to 3 minutes), with unlimited time afterward. **Timers are skippable in all eight games and every play mode**, including restored sessions and playlists. One-device and demo players can press **Skip timer · continue** immediately; on one device, the shared button represents both players' agreement. Online players can press **Skip timer · I’m ready** immediately, but the round advances only after both mark ready. Skipping never reveals pending answers or automatically advances a round when the countdown ends.

Apply [supabase/migrations/005_optional_online_discussion.sql](./supabase/migrations/005_optional_online_discussion.sql) after migration 003 to enable skipping on the server, including existing rooms. Migration 004 is only needed for fresh-question generation. Migration 005 is rerunnable and preserves answers, readiness, and reports. Without it, older servers still reject early readiness with an explicit discussion-time error.

Apply [supabase/migrations/006_both_players_choice.sql](./supabase/migrations/006_both_players_choice.sql) after migration 003 (and after 005 if installed) for **Both of us**, 30/50-round games including mixed Same Page? decks, and six Same Page? verdict and reasoning choices. It is transactional/rerunnable, preserves existing rooms and answers, and also accepts legacy two-option More Likely decks. Answer index 2 means Both of us; player indices 0/1 keep their original meaning. New Same Page? snapshots carry six verdicts and six reasons; older decks retain their original five verdicts and four reasons, or their saved per-scenario labels. Validation uses each question's snapshot bounds. Reveals, reports, personalized analysis, and downloads use each snapshot's wording. The migration increases bounded deck/playlist size limits for longer games without changing privacy or readiness.

Verdict, emotional, and values alignment are separate **exact-match counts**, not a relationship score, diagnosis, or ranking. Different responses are never marked wrong.

## Your relationship reading

Every completed game ends with an insight-led reading. The full answer record is kept in a separate expandable journal:

- An interpretation-first analysis of each player and your shared dynamic, with supporting examples and concrete next steps. This is not just an answer list.
- Same Page? distinguishes shared verdicts with different feelings, shared factors with different conclusions, and different priorities. Individual observations acknowledge tied frequencies instead of inventing a dominant trait.
- Each party game interprets its own mechanic: shared preferences, perceptions of roles (including Both of us), understanding different preferences, or learning from actual support responses. Read the Room counts only responder answers as personal evidence and keeps unequal prediction opportunities explicit.
- Finished playlists synthesize discoveries across games without averaging unrelated measures. Player identity is preserved even when both names match.
- Three independent Same Page? alignment threads remain separate in the answer journal, never an overall grade or percentage.
- Relevant examples support the reading behind optional evidence disclosures; they do not replace the analysis.
- The journal preserves all recorded themes, exact choices, selected feelings and priorities, and original explanations, including explicit limits for unplayed themes.
- One final reflection responds to the couple's recorded pattern, with practical implications inside the insights.
- **Save our report** creates a narrative keepsake. **Save answer journal** explicitly downloads the complete private record. Both players should agree before saving or sharing either.

The report is computed locally from completed, paired answers in the current game's snapshot. It makes no AI calls, sends no explanations to an external model, does not interpret free text as a diagnosis, and ignores incomplete rounds. It is regenerated after refresh in local, demo, and online play; online answers remain in Supabase under the existing room privacy rules. A completed online report remains visible to the remaining player if their partner leaves. A demo report is explicitly labeled as simulated.

[src/insights.ts](./src/insights.ts) produces the shared structured analysis used by [src/AnalysisPanel.tsx](./src/AnalysisPanel.tsx) and all plain-text downloads. Interpretations use structured selections only, not free-text explanations. Small samples are explicitly described as snapshots, not recurring patterns; selected answers never establish a personality, diagnosis, real-life conduct, or an overall compatibility percentage.

Every individual and combined report is an **insight-led relationship reading**, not a scorecard or answer recap. The main view contains up to four specific insights with a memorable heading, a qualitative observation, a cautious interpretation, and a practical implication. Repeated signals take priority; at most one smaller observation is included, and sparse evidence produces fewer insights rather than filler. Different questions are required before evidence is labelled repeated. Reasoning patterns can describe recurring recorded concerns, but never infer personality, motives, emotional needs, or relationship history. Game-night readings connect evidence across the completed games without averaging their measures into compatibility.

The main reading does not display answer lists, question recaps, match percentages, numeric summaries, or frequency profiles. Supporting examples and counts are available only in expandable evidence and the separate answer journal. The final reflection responds to the observed pattern rather than quoting a question or answer back to the players. With no paired answers, reports withhold interpretations and a personalised prompt. Legacy Read the Room reports distinguish responder/predictor accuracy from agreement between two personal interpretations.

**Save our report** downloads the narrative only. **Save answer journal**, inside the expandable answer archive, preserves the original answers, explanations, exact scores, and eligible-response denominators. Export helpers accept an explicit `'archive'` format for that full record; their default is `'insights'`. Structured selections alone support the analysis; explanations remain verbatim in the journal and are never interpreted. Reports are deterministic and private, with no answers or reports sent to AI services.

The original floral SVG illustrations and bright pink, olive, orange, and periwinkle palette are inspired by the supplied mood boards; the reference images themselves are not copied into the app.

## Enable online rooms

1. Create a Supabase project.
2. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**. Consider CAPTCHA and rate limits before a public launch.
3. For a new project, run [supabase/schema.sql](./supabase/schema.sql), then migrations **002 through 009 in order**. For an existing installation, run **only the migrations not yet installed**; do not rerun the base schema. In particular, [006](./supabase/migrations/006_both_players_choice.sql) is required for the current answer bounds; [007](./supabase/migrations/007_relationship_adventures.sql) enables the three new online games, private reflections/clues, sensitive skips, cooperative turns, and eight-game playlists; [008](./supabase/migrations/008_switch_questions.sql) enables synchronized question replacement and stale-answer guards; and [009](./supabase/migrations/009_written_answers.sql) enables private written answers and partner predictions. Migrations preserve existing rooms and can be reapplied in order. Online features never simulate a connection when their migration is missing; local and demo play need no database update.
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

Edit [src/samePageLibrary.ts](./src/samePageLibrary.ts) for the 100 curated Same Page? situations. [supabase/functions/_shared/questions.ts](./supabase/functions/_shared/questions.ts) defines the six current verdicts and reasons, retains legacy topic-specific verdicts for validation, and shares request/response validation with the generation function. [src/scenarios.ts](./src/scenarios.ts) retains the original 30 seeds and six-section helpers for legacy replays. [src/offlineQuestions.ts](./src/offlineQuestions.ts) assembles the active banks; [src/offlineExtras.ts](./src/offlineExtras.ts) holds additional party questions and legacy variations. [src/freshQuestions.ts](./src/freshQuestions.ts) selects decks, tracks browser history, and handles explicit fallback notices. Fresh replays use the current verdict/reason labels; already saved games keep their exact five- or six-choice snapshot wording and bounds, including reports and downloads.

[src/game.ts](./src/game.ts) contains the pure local state transitions, validation, and three-axis alignment logic. [src/backend.ts](./src/backend.ts) contains the Supabase adapter. The SQL RPCs enforce online equivalents independently of the browser.

[src/night.ts](./src/night.ts) contains ordered playlist construction, local game-to-game transitions, separate evidence summaries, and combined text exports. [src/NightReport.tsx](./src/NightReport.tsx) renders playlist progress, intermissions, completed archives, and the combined report. [src/playground.css](./src/playground.css) contains the unified playground and reserved-space illustration layouts.

[src/scenarios.ts](./src/scenarios.ts) preserves section-based legacy replay support. The category picker and section overview are not mounted in the app.

[src/report.ts](./src/report.ts) contains deterministic report generation and text export. [src/CompatibilityReport.tsx](./src/CompatibilityReport.tsx) renders the interactive report. [src/BotanicalArt.tsx](./src/BotanicalArt.tsx) contains original vector illustrations; [src/card-deck.css](./src/card-deck.css) defines the floral card-deck theme.

[src/catalog.ts](./src/catalog.ts) registers all eight games. [src/party.ts](./src/party.ts) handles mode-specific validation, role assignment, score-free comparisons, skips, consented reflections, and exports. [src/PartyGame.tsx](./src/PartyGame.tsx) reuses the forms, shared reveals, discussion pause, and report system.

[src/questionSwitching.ts](./src/questionSwitching.ts) selects unused alternatives and updates local snapshots without changing game length or answered rounds. [src/SwitchQuestion.tsx](./src/SwitchQuestion.tsx) is the shared control. The database independently validates online replacements and rejects stale drafts.

[src/relationshipGames.ts](./src/relationshipGames.ts) contains the two 30-question banks and reflection types. [src/adventures.ts](./src/adventures.ts) owns the original adventure snapshots and deterministic resource/ending rules. [src/AdventureGame.tsx](./src/AdventureGame.tsx) renders turns, private clues, inventory, feedback and endings. [src/relationshipInsights.ts](./src/relationshipInsights.ts) interprets recorded evidence without grading or diagnosing. [src/RelationshipArt.tsx](./src/RelationshipArt.tsx) supplies original illustrations using the current rose/sage/yellow/blush/forest tokens.

## Verification

```sh
npm test
npm run build
```

For online acceptance testing, configure Supabase and use two independent browsers: create/join; submit once and verify the other answer is absent from the RPC response; submit the second answer; verify shared reveal; refresh each browser; disconnect/reconnect; retry duplicate requests; mark one player ready before the timer expires and verify the round does not advance; mark the other ready and verify it advances immediately; complete recap; leave and confirm the other player sees the departure.
