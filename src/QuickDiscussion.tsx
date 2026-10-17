import type { GameId } from './catalog';
import type { SessionState } from './game';
import { DiscussionContinue } from './DiscussionContinue';

const sharedQuestions = [
  'What made that your first choice?',
  'Was this an easy choice?',
  'What almost changed your mind?',
  'What would change your answer?',
  'Which detail mattered most?',
  'Did anything surprise you?',
  'Has your answer changed over time?',
  'What would you ask before deciding?',
  'What would make this feel different?',
  'What would you like me to understand?',
  'Would timing change your choice?',
  'Would you choose differently on a busy day?',
  'What feels most important here?',
  'Was another answer a close second?',
  'What detail would you add?',
  'What would make this easier?',
  'What would you want to know first?',
  'Would being apart change your answer?',
  'What feels familiar about this?',
  'What would you try instead?',
  'What would make you feel heard?',
  'What did you learn about each other?',
  'Would your answer depend on your mood?',
  'What is one thing we could take from this?',
  'What would you choose on holiday?',
  'What would make you reconsider?',
  'Would your past self pick the same?',
  'What part of this feels most like you?',
  'Which answer felt least like you?',
  'Would this feel different in public?',
  'What would help us decide together?',
  'Would having more time change this?',
  'What could we ask instead of assuming?',
  'How would you explain your second choice?',
  'What makes this feel personal?',
  'What would make this more fun?',
  'Would a smaller version feel different?',
  'Which part would you want to keep?',
  'What would make this feel fair?',
  'What would you be curious to try?',
  'Would you want a surprise or a plan?',
  'What would you do first?',
  'What is a detail I might have missed?',
  'What feels worth talking about here?',
];
const gameQuestions: Record<GameId, string[]> = {
  'if-i-were-you': ['What would care feel like here?', 'What detail did my guess miss?', 'Would you want me to ask first?', 'What could change your preference?', 'What would feel like listening?', 'Would this differ on another day?'],
  'when-things-get-hard': ['Would a pause help or feel uncertain?', 'What would a useful check-in sound like?', 'What would make it easier to reconnect?', 'Is this a wish or a familiar response?', 'What change feels manageable?', 'What would help both of us feel heard?'],
  'us-against-the-world': ['What did your clue change?', 'Which job still needs attention?', 'Should we combine efforts or split tasks?', 'What should we conserve?', 'What would we try on a replay?', 'Did we check both sets of information?'],
  'same-page': ['What boundary would help here?', 'What would reassurance look like?', 'Would being told beforehand matter?', 'What agreement would feel fair?', 'Did your feeling match your verdict?', 'What context would you want to hear?'],
  'same-brain': ['Could we combine our choices?', 'Which option should we try together?', 'What would make this our kind of plan?', 'Did we pick alike for different reasons?', 'What would your ideal version look like?', 'Which option sounds fun for another day?'],
  'pick-my-poison': ['What was the deal-breaker?', 'Which trade-off felt easier?', 'Was your prediction a guess?', 'What made the other option worse?', 'How would you improve your chosen option?', 'Would you swap choices for one day?'],
  'read-the-room': ['How could I check what you need?', 'What response would help least?', 'Would you want me to ask first?', 'What small gesture would help?', 'How would you tell me you need space?', 'Would you want listening or ideas?'],
  'more-likely': ['Would you swap roles in another setting?', 'What makes that person your pick?', 'Who would enjoy that role more?', 'Is this an everyday side of us?', 'Could you imagine both of us doing it?', 'When might the other person surprise you?'],
};

export function quickDiscussionQuestion(game: Pick<SessionState, 'id' | 'gameType' | 'round'>): string {
  const questions = [...gameQuestions[game.gameType ?? 'same-page'], ...sharedQuestions];
  let offset = 0;
  for (const character of game.id) offset = (offset * 31 + character.charCodeAt(0)) % questions.length;
  return questions[(offset + game.round) % questions.length];
}

export function QuickDiscussion({ game, myId, remaining, busy, onContinue }: {
  game: SessionState; myId: string; remaining: number; busy: boolean; onContinue: () => Promise<void>;
}) {
  return <div className="quick-discussion">
    <p className="quick-discussion-question"><span>Ask each other · optional</span>{quickDiscussionQuestion(game)}</p>
    <DiscussionContinue online={game.mode === 'online'} remaining={remaining} busy={busy} waiting={game.ready.includes(myId)} onContinue={onContinue} />
  </div>;
}
