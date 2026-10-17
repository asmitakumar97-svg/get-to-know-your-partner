import type { ChoiceScenario, GameDefinition } from './catalog';

export const relationshipGameIds = ['if-i-were-you', 'when-things-get-hard', 'us-against-the-world'] as const;
export type RelationshipGameId = typeof relationshipGameIds[number];
export const isRelationshipGame = (id: string | undefined): id is RelationshipGameId => relationshipGameIds.some(game => game === id);
export const relationshipDefinitions: GameDefinition[] = [
  { id: 'if-i-were-you', title: 'If I Were You', category: 'Empathy & perspective', description: 'Your world, my imagination. What would care look like from your side?', quickPlay: 'Choose what you would want, then what you think your partner would want. Reveal together, react if you wish, and talk.', rules: 'Answer both questions independently. Your partner’s own selection is the reference for your guess, not a judgment about your care. Reactions and explanations are optional.', reflection: 'Explore support preferences, perspective-taking, and the difference between intended and received care.', color: 'pink' },
  { id: 'when-things-get-hard', title: 'When Things Get Hard', category: 'Conflict & repair', description: 'Not the perfect answer. The honest one. Find your way back to each other.', quickPlay: 'Choose your natural response to a difficult moment. Reveal together and explore what helps you reconnect. Either person may skip.', rules: 'Choose what you tend to do, not an ideal response. Never explain more than you want. Skipping hides both answers for that question and moves you on without a required pause.', reflection: 'Explore pauses, reassurance, impact, and practical repair without assigning labels or blame.', color: 'green' },
  { id: 'us-against-the-world', title: 'Us Against the World', category: 'Cooperative adventures', description: 'A tiny world. A shared problem. Two very useful imaginations.', quickPlay: 'Choose an adventure. Read your own clue, discuss your plan, and take turns committing an action. Your combined actions change the story.', rules: 'Each chapter has two turns. The first player commits, then the second. Individual clues stay private unless you choose to share them. Resources are shared; each person may spend at most half the chapter’s available supply. Both confirm before the next chapter.', reflection: 'Reflect on decisions made inside the adventure, never on assumed real-life personalities.', color: 'lavender' },
];

type Group = { category: string; tags: string[]; options: string[]; situations: [string, string][] };
const empathy: Group[] = [
  { category: 'Stress', tags: ['listening', 'solutions', 'distraction', 'space', 'affection'], options: ['Listen without trying to fix it', 'Help me work out a next step', 'Give me a gentle distraction', 'Let me have some quiet space', 'Offer affection and company'], situations: [
    ['A horrible workday', "You've had a horrible day at work. What would you most want from your partner?"],
    ['Too much at once', 'Several small responsibilities pile up in one afternoon. What support would feel most useful?'],
    ['An anxious wait', 'You are waiting for news about something important. What would help you through the evening?'],
    ['A difficult call', 'A tense conversation with a family member leaves you unsettled. What would you want next?'],
    ['A change of plans', 'A carefully planned day falls apart. What would help you reset?'],
  ] },
  { category: 'Celebrations', tags: ['recognition', 'company', 'privacy', 'practical', 'affection'], options: ['Notice the effort and say what you appreciate', 'Make time to celebrate together', 'Keep the moment small and private', 'Help me enjoy it without extra organising', 'Show affection and enthusiasm'], situations: [
    ['A quiet achievement', 'You achieve something that matters to you but may seem small to others. How would you want it acknowledged?'],
    ['Unexpected good news', 'You get exciting news in the middle of an ordinary day. What response would feel good?'],
    ['A milestone', 'A milestone arrives after a long period of work. What would make it feel celebrated?'],
    ['A personal first', 'You try something new and feel proud for simply attempting it. What would you enjoy from your partner?'],
    ['A birthday mood', 'Your birthday arrives during a busy week. What would feel most meaningful?'],
  ] },
  { category: 'Reassurance', tags: ['reassurance', 'listening', 'clarity', 'affection', 'space'], options: ['A clear reminder that we are okay', 'Room to describe the worry without judgment', 'Specific information rather than guessing', 'A small gesture of closeness', 'Time to settle before a check-in'], situations: [
    ['A brief message', 'A short reply feels colder than you expected. What would you want before drawing conclusions?'],
    ['Feeling left out', 'You feel left out of a social moment your partner enjoyed. What would help?'],
    ['A shaky day', 'You are doubting yourself, even though nothing specific has gone wrong. What would you want?'],
    ['An uncertain plan', 'You are unsure whether an upcoming plan still matters to your partner. What would feel reassuring?'],
    ['A vulnerable share', 'You have just shared something you find difficult to say. What response would help you feel at ease?'],
  ] },
  { category: 'Misunderstandings', tags: ['listening', 'clarity', 'impact', 'pause', 'reassurance'], options: ['Hear my perspective before responding', 'Clarify what each of us meant', 'Acknowledge how it landed for me', 'Pause and return when we can listen', 'Remind me we are on the same side'], situations: [
    ['A joke that missed', 'A joke lands differently from how your partner intended. What would you most want next?'],
    ['A missed invitation', 'You thought an invitation included you, but your partner understood it differently. What would help?'],
    ['Two meanings', 'You realise you used the same word to mean different things. What would help you reconnect?'],
    ['A distracted moment', 'Your partner seems distracted during something important to you. What would you want?'],
    ['A mistaken assumption', 'Your partner assumes a preference you no longer have. What response would feel considerate?'],
  ] },
  { category: 'Encouragement', tags: ['recognition', 'solutions', 'company', 'autonomy', 'reassurance'], options: ['Recognise how much effort this takes', 'Help me make a manageable plan', 'Keep me company while I begin', 'Trust me to approach it my own way', 'Remind me that the outcome is not my worth'], situations: [
    ['A brave next step', 'You are considering an opportunity that feels exciting and intimidating. What encouragement would help?'],
    ['Starting again', 'You are returning to something after a setback. What would you want from your partner?'],
    ['A creative risk', 'You want to share something you made but feel uncertain about it. What support would fit?'],
    ['A draining task', 'You need to finish a task you have been putting off. What would help without adding pressure?'],
    ['A disappointing result', 'Something you worked hard for does not turn out as hoped. What would feel supportive?'],
  ] },
  { category: 'Space & appreciation', tags: ['space', 'reconnect', 'recognition', 'practical', 'affection'], options: ['Uninterrupted time to recharge', 'An agreed time to reconnect', 'Specific appreciation for what I have done', 'One practical task taken off my hands', 'Quiet affection without needing to talk'], situations: [
    ['An empty social battery', 'After a busy social weekend, what would you want from a shared evening?'],
    ['An invisible effort', 'You have handled several unnoticed everyday tasks. What would help you feel appreciated?'],
    ['A little independence', 'You want an evening for your own interests. What response would feel supportive?'],
    ['Coming home tired', 'You arrive home with very little energy left. What would feel like care?'],
    ['A full week', 'You have spent much of the week looking after other people. What would you most want now?'],
  ] },
];
const repairOptions = ['Take a pause and agree when to reconnect', 'Talk through it while it is fresh', 'Ask for reassurance that we are okay', 'Understand the impact before explaining intentions', 'Agree on a practical change'];
const repairSituations: Pick<Group, 'category' | 'situations'>[] = [
  { category: 'Space & timing', situations: [
    ['A few hours alone', "After an argument, your partner asks for a few hours alone. What's your most natural response?"],
    ['The wrong moment', 'A disagreement begins just as you need to leave. What would you naturally tend to do?'],
    ['Late at night', 'An unresolved issue comes up when you are both tired. What is your natural next move?'],
    ['A busy day', 'Your partner raises a concern while you are concentrating on something demanding. What do you tend to do?'],
    ['Returning after a pause', 'You have taken a break from a tense conversation. What would help you begin again?'],
  ] },
  { category: 'Hurt & impact', situations: [
    ['A hurtful joke', 'Your partner says a joke hurt them, although that was not your intention. What would you naturally do first?'],
    ['Feeling unheard', 'You notice you are repeating yourself because you do not feel heard. What is your natural response?'],
    ['A forgotten detail', 'You forget something that mattered to your partner. What would you tend to do next?'],
    ['A difficult tone', 'The words seem reasonable, but the tone feels sharp. What would you naturally do?'],
    ['Unequal impact', 'You see an incident as small, but your partner feels hurt. What is your most natural first response?'],
  ] },
  { category: 'Apologies', situations: [
    ['An apology arrives', 'Your partner apologises, but you still feel unsettled. What do you tend to do?'],
    ['Finding the words', 'You know you contributed to a disagreement but are unsure how to apologise. What comes naturally?'],
    ['Intentions and impact', 'You want to explain your intentions while your partner wants acknowledgement. What would you tend to do?'],
    ['An awkward restart', 'You both want to reconnect after tension but neither knows how to start. What is your instinct?'],
    ['An apology by text', 'You receive an apology in a message when you hoped to talk in person. What would you naturally do?'],
  ] },
  { category: 'Recurring disagreements', situations: [
    ['The same task again', 'A disagreement about an everyday task comes up again. What is your natural response?'],
    ['Different planning styles', 'A repeated difference in how you make plans causes tension. What would you tend to do?'],
    ['A familiar loop', 'You recognise that a conversation is going in circles. What do you naturally try next?'],
    ['A broken small agreement', 'A small agreement has been missed more than once. What would you tend to do?'],
    ['Different expectations', 'You realise you expected different amounts of time together. What is your first instinct?'],
  ] },
  { category: 'Repair & reconnection', situations: [
    ['The next morning', 'It is the morning after a difficult conversation. What would you naturally want to do first?'],
    ['A gentle gesture', 'Your partner makes a kind gesture while an issue is unresolved. How would you tend to respond?'],
    ['Almost settled', 'You agree on the facts but do not yet feel close again. What would you naturally try?'],
    ['A plan for next time', 'You both want the next disagreement to go differently. What would you naturally suggest?'],
    ['Back to ordinary life', 'You need to return to normal responsibilities after an argument. What would help you do that?'],
  ] },
  { category: 'Reassurance & understanding', situations: [
    ['A quiet partner', 'Your partner becomes quieter during disagreement. What would you naturally do?'],
    ['Different memories', 'You remember the same conversation differently. What is your natural next step?'],
    ['An uncertain ending', 'A conversation ends without a clear resolution. What would you tend to do?'],
    ['A request for change', 'Your partner asks you to change a habit you had not realised affected them. What comes naturally first?'],
    ['A vulnerable concern', 'Your partner shares a concern you find hard to hear. What would you naturally tend to do?'],
  ] },
];
const repair: Group[] = repairSituations.map(group => ({ ...group, options: repairOptions, tags: ['pause', 'talk', 'reassurance', 'impact', 'practical-change'] }));

function makeBank(id: string, groups: Group[]): ChoiceScenario[] {
  return groups.flatMap(group => group.situations.map(([title, text], i) => ({
    id: `${id}-${groups.indexOf(group)}-${i}`, title, text, category: group.category,
    options: [...group.options], tags: [...group.tags], level: 0,
    prompt: id === 'if-i-were-you' ? 'What detail would help me understand what care would feel like to you here?' : 'What would make room for both of our needs in this moment?',
  })));
}
export const empathyQuestions = makeBank('if-i-were-you', empathy);
export const repairQuestions = makeBank('when-things-get-hard', repair);
export const reactionChoices = ['That feels right', "It's more complicated", 'Tell me more'] as const;
export const reflectionKinds = ['This is what usually happens', 'This is what I wish would happen', 'A little of both', 'Not sure yet'] as const;
export interface GameReflection { reaction?: typeof reactionChoices[number]; kind?: typeof reflectionKinds[number]; explanation: string; shared: boolean }
