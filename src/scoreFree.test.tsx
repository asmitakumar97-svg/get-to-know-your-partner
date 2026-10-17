import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { games } from './catalog';
import { isChoiceGame, readyForNext, submitAnswer, type SessionState } from './game';
import { createNight, advanceNight, nightReportText } from './night';
import { comparePartyRound, demoChoiceAnswer, partyReportText, submitChoiceAnswer } from './party';
import { buildReflection, reflectionText } from './report';
import { CompatibilityReport } from './CompatibilityReport';
import { PartyGame, PartyReport } from './PartyGame';
import { NightRecap } from './NightReport';
import { GameHub } from './GameHub';

const scoringLanguage = /\b(?:shared|prediction|bonus)\s+points?|\b\d+\s+points?|\bscoreboard\b|\bbonus\b|\b\d+(?:\.\d+)?%/i;
const noOp = async () => {};
function text(markup: string) { return markup.replace(/<[^>]+>/g, ' '); }
function complete(game: SessionState) {
  let next = game;
  while (next.phase === 'answering') {
    for (const [i, player] of next.players.entries()) {
      next = isChoiceGame(next)
        ? submitChoiceAnswer(next, player.id, { ...(next.gameType === 'us-against-the-world' ? demoChoiceAnswer(next) : { choice: i, prediction: 1 - i, matchPrediction: i === 0 }), explanation: 'My own perspective.' })
        : submitAnswer(next, player.id, { verdict: i, emotion: i, factor: i, explanation: 'My own perspective.' });
    }
    next = readyForNext(next, next.players[0].id, next.discussionUntil ?? 0);
    next = readyForNext(next, next.players[1].id, next.discussionUntil ?? 0);
  }
  return next;
}
function completedNight() {
  let game = createNight('local', ['Mia', 'Sam'], games.map(game => game.id), 3, 30);
  while (!game.night?.finished) {
    game = complete(game);
    const index = game.night?.index ?? 0;
    game = advanceNight(game, game.players[0].id, index);
    game = advanceNight(game, game.players[1].id, index);
  }
  return game;
}

describe('Score-free experience across all five games', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('shows discovery rather than points on the game-selection cards', () => {
    vi.stubGlobal('location', { hash: '' });
    const markup = renderToStaticMarkup(<GameHub playlist={[]} onPlay={noOp} onDemo={noOp} onToggle={noOp} onMove={noOp} onSelectAll={noOp} onStart={noOp} />);
    expect(text(markup)).not.toMatch(scoringLanguage);
    expect(markup).not.toContain('Points &amp; reflection');
    expect(markup).toContain('What you might discover');
  });
  it('describes discovery instead of rewards in every game definition', () => {
    for (const game of games) {
      expect([game.quickPlay, game.rules, game.reflection].join(' ')).not.toMatch(scoringLanguage);
      expect(game).not.toHaveProperty('scoring');
    }
  });
  it('keeps all individual reports, expanded journals and downloads free of points and scoreboards after restore', () => {
    const night = completedNight();
    for (const saved of night.night!.completed) {
      const game: SessionState = JSON.parse(JSON.stringify(saved));
      const markup = renderToStaticMarkup(isChoiceGame(game) ? <PartyReport game={game} /> : <CompatibilityReport game={game} />);
      expect(text(markup)).not.toMatch(scoringLanguage);
      expect(markup).not.toContain('party-score-grid');
      for (const format of ['insights', 'archive'] as const) {
        const download = isChoiceGame(game) ? partyReportText(game, format) : reflectionText(buildReflection(game), format);
        expect(download).not.toMatch(scoringLanguage);
        if (format === 'archive') expect(download).toContain('My own perspective.');
      }
      if (isChoiceGame(game)) {
        for (let round = 0; round < game.deck.length; round++) {
          const comparison = comparePartyRound(game, round);
          expect(comparison).not.toHaveProperty('sharedPoint');
          expect(comparison).not.toHaveProperty('playerPoints');
          expect(comparison?.notes.join(' ')).not.toMatch(scoringLanguage);
          const reveal = renderToStaticMarkup(<PartyGame game={{ ...game, round, phase: 'discussion' }} myId="player-0" now={0} busy={false} onSubmit={noOp} onContinue={noOp} onReplay={noOp} onExit={noOp} />);
          expect(text(reveal)).not.toMatch(scoringLanguage);
          expect(reveal).toContain('discussion');
        }
      }
    }
  });
  it('keeps the final Same Brain question an unscored expectation, including in online mode', () => {
    const saved = completedNight().night!.completed.find(game => game.gameType === 'same-brain')!;
    if (!isChoiceGame(saved)) throw new Error('Expected a choice game');
    const game = { ...saved, mode: 'online' as const, phase: 'answering' as const, round: saved.deck.length - 1, submitted: [], answers: {} };
    const markup = renderToStaticMarkup(<PartyGame game={game} myId="player-0" now={0} busy={false} onSubmit={noOp} onContinue={noOp} onReplay={noOp} onExit={noOp} />);
    expect(markup).toContain('Before the reveal: do you expect your choices to match?');
    expect(text(markup)).not.toMatch(scoringLanguage);
  });
  it('keeps combined reports and both combined downloads score-free', () => {
    const night = completedNight();
    const markup = renderToStaticMarkup(<NightRecap game={night} myId="player-0" busy={false} onNext={noOp} onReplay={noOp} onExit={noOp} />);
    expect(text(markup)).not.toMatch(scoringLanguage);
    expect(markup).not.toContain('party-score-grid');
    for (const format of ['insights', 'archive'] as const) expect(nightReportText(night, format)).not.toMatch(scoringLanguage);
  });
});
