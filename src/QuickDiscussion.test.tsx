import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { partyGameIds } from './catalog';
import { createGame } from './game';
import { createChoiceGame } from './party';
import { PartyGame } from './PartyGame';
import { QuickDiscussion, quickDiscussionQuestion } from './QuickDiscussion';
import { RoundQuestion } from './RoundQuestion';

describe('Compact discussion questions', () => {
  it('uses short questions without repeats across the longest supported game', () => {
    for (const gameType of ['same-page', ...partyGameIds] as const) {
      const questions = Array.from({ length: 50 }, (_, round) => quickDiscussionQuestion({ id: 'shared-room', gameType, round }));
      expect(new Set(questions).size).toBe(questions.length);
      questions.forEach(question => {
        expect(question.length).toBeLessThan(90);
        expect(question).toMatch(/\?$/);
      });
    }
  });
  it('stays stable across devices and refreshes, with different starting points for new sessions', () => {
    const game = { id: 'room-a', gameType: 'more-likely' as const, round: 4 };
    expect(quickDiscussionQuestion(game)).toBe(quickDiscussionQuestion(JSON.parse(JSON.stringify(game))));
    expect(quickDiscussionQuestion(game)).not.toBe(quickDiscussionQuestion({ ...game, id: 'room-b' }));
  });
  it('renders an optional line without the old oversized card', () => {
    const game = createGame('demo', ['A', 'B'], 3, 30);
    const markup = renderToStaticMarkup(<QuickDiscussion game={game} myId="player-0" remaining={20} busy={false} onContinue={async () => {}} />);
    expect(markup).toContain('Ask each other · optional');
    expect(markup).not.toContain('discussion-prompt');
    expect(markup).not.toContain('<h3');
    expect(markup).not.toContain('shared memory');
    expect(markup).not.toContain('disabled=""');
    expect(markup).toContain('Skip timer · continue');
  });
});

describe('Separate, concise question and answer cards', () => {
  it('keeps the question outside the answer form for all party games', () => {
    for (const kind of partyGameIds) {
      const game = createChoiceGame(kind, 'demo', ['A', 'B'], 3, 30);
      const markup = renderToStaticMarkup(<PartyGame game={game} myId="player-0" busy={false} now={0} onSubmit={async () => {}} onContinue={async () => {}} onReplay={async () => {}} onExit={async () => {}} />);
      const form = markup.match(/<form\b[\s\S]*?<\/form>/)?.[0] ?? '';
      expect(form).not.toContain('combined-answer-card');
      expect(form).not.toContain('<h2>');
      expect(form).toContain('actual-choice');
      expect(form).toContain('<textarea');
      expect(markup).toContain('class="scenario-card"');
      expect(markup).not.toContain('Pick the closest fit');
      expect(markup).not.toContain('party-rules');
      expect(markup).not.toContain('How this game works');
      expect((markup.match(/<h2>/g) ?? []).length).toBe(1);
    }
  });

  describe('Clear partner prediction reveals', () => {
    it.each([
      [0, 0, 0, 0], [0, 0, 1, 1], [0, 1, 1, 0], [0, 1, 0, 0],
    ])('separates own choices %i/%i from predictions %i/%i', (firstChoice, secondChoice, firstPrediction, secondPrediction) => {
      const game = createChoiceGame('pick-my-poison', 'demo', ['Alex', 'Sam'], 3, 30);
      game.phase = 'discussion';
      game.answers[0] = {
        'player-0': { choice: firstChoice, prediction: firstPrediction, explanation: '' },
        'player-1': { choice: secondChoice, prediction: secondPrediction, explanation: '' },
      };
      const markup = renderToStaticMarkup(<PartyGame game={game} myId="player-0" busy={false} now={0} onSubmit={async () => {}} onContinue={async () => {}} onReplay={async () => {}} onExit={async () => {}} />);
      expect(markup).toContain(firstChoice === secondChoice ? 'Your own choices matched.' : 'Your own choices were different.');
      const cards = markup.match(/<article class="prediction-comparison">[\s\S]*?<\/article>/g) ?? [];
      expect(cards).toHaveLength(2);
      for (const [i, card] of cards.entries()) {
        const correct = i === 0 ? firstPrediction === secondChoice : secondPrediction === firstChoice;
        const player = i === 0 ? 'Alex' : 'Sam';
        const partner = i === 0 ? 'Sam' : 'Alex';
        expect(card).toContain(correct ? `${player} guessed ${partner}’s choice` : `${partner} chose differently than ${player} expected`);
        expect(card).not.toMatch(/\bpoints?\b|\bbonus\b/i);
        expect(card).toContain(`What ${player} selected for ${partner}`);
        expect(card).toContain(`What ${partner} selected for themselves`);
      }
    });
    it('never shows predictions or results before both players submit', () => {
      const game = createChoiceGame('pick-my-poison', 'demo', ['Alex', 'Sam'], 3, 30);
      game.submitted = ['player-0'];
      game.answers[0] = { 'player-0': { choice: 0, prediction: 1, explanation: 'Hidden answer' } };
      const markup = renderToStaticMarkup(<PartyGame game={game} myId="player-0" busy={false} now={0} onSubmit={async () => {}} onContinue={async () => {}} onReplay={async () => {}} onExit={async () => {}} />);
      expect(markup).not.toContain('prediction-comparison');
      expect(markup).not.toContain('Your own choices matched.');
      expect(markup).not.toContain('Hidden answer');
    });
  });
  it('retains the private handoff before showing choices', () => {
    const game = createChoiceGame('same-brain', 'local', ['A', 'B'], 3, 30);
    const markup = renderToStaticMarkup(<PartyGame game={game} myId="player-0" busy={false} now={0} onSubmit={async () => {}} onContinue={async () => {}} onReplay={async () => {}} onExit={async () => {}} />);
    expect(markup).toContain('scenario-card');
    expect(markup).toContain('handoff-card');
    expect(markup).not.toContain('<textarea');
  });
  it('supports a concise standalone Same Page question card', () => {
    const game = createGame('demo', ['A', 'B'], 3, 30);
    const markup = renderToStaticMarkup(<RoundQuestion scenario={game.deck[0]} note="Your perspective." />);
    expect(markup).toContain('class="scenario-card"');
    expect(markup).toContain('Your perspective.');
  });
});
