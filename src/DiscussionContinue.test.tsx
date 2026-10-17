import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiscussionContinue } from './DiscussionContinue';
import { games } from './catalog';
import { createGame, isChoiceGame, readyForNext, submitAnswer, type SessionState } from './game';
import { createChoiceGame, demoChoiceAnswer, submitChoiceAnswer } from './party';

describe('Discussion countdown controls', () => {
  const render = (online: boolean, remaining: number, busy = false, waiting = false) =>
    renderToStaticMarkup(<DiscussionContinue online={online} remaining={remaining} busy={busy} waiting={waiting} onContinue={async () => {}} />);
  it('offers an enabled skip during online discussion and explains mutual readiness', () => {
    const markup = render(true, 180);
    expect(markup).toContain('Skip timer · I’m ready');
    expect(markup).toContain('suggested discussion time');
    expect(markup).toContain('only when both are ready');
    expect(markup).not.toContain('disabled=""');
    expect(render(true, 0)).toContain('I’m ready to continue');
  });
  it.each([false, true])('disables repeated readiness and in-flight requests (online: %s)', online => {
    expect(render(online, 180, true)).toContain('disabled=""');
    expect(render(online, 180, false, true)).toContain('disabled=""');
    expect(render(online, 180, false, true)).toContain('Waiting for your partner');
  });
  it('offers an immediate local/demo skip while keeping the suggested timer visible', () => {
    expect(render(false, 30)).not.toContain('disabled=""');
    expect(render(false, 30)).toContain('Skip timer · continue');
    expect(render(false, 30)).toContain('0:30 suggested discussion time');
    expect(render(false, 30)).not.toContain('minimum pause');
    expect(render(false, 0)).not.toContain('disabled=""');
    expect(render(false, 0)).toContain('We’re ready to continue');
  });
  it.each(games)('skips an unexpired timer in $title for local and demo sessions, including restored saves', definition => {
    for (const mode of ['local', 'demo'] as const) {
      let game: SessionState = definition.id === 'same-page'
        ? createGame(mode, ['Mia', 'Sam'], 3, 180)
        : createChoiceGame(definition.id, mode, ['Mia', 'Sam'], 3, 180);
      expect(() => readyForNext(game, game.players[0].id, 1000)).toThrow('Discussion is not active');
      for (const player of game.players) {
        game = isChoiceGame(game)
          ? submitChoiceAnswer(game, player.id, demoChoiceAnswer(game), 1000)
          : submitAnswer(game, player.id, { verdict: 0, emotion: 0, factor: 0, explanation: '' }, 1000);
      }
      expect(game.discussionUntil).toBe(181000);
      const restored: SessionState = JSON.parse(JSON.stringify(game));
      const first = readyForNext(restored, restored.players[0].id, 1001);
      expect(first.phase).toBe('discussion');
      expect(readyForNext(first, first.players[0].id, 1001).ready).toHaveLength(1);
      const next = readyForNext(first, first.players[1].id, 1001);
      expect(next.phase).toBe('answering');
      expect(next.round).toBe(1);
      expect(next.answers[0]).toEqual(restored.answers[0]);
    }
  });
});
