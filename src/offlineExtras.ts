import type { ChoiceScenario, LegacyPartyGameId as PartyGameId } from './catalog';
import { sections, type Scenario } from './scenarios';

const settings = [
  'During a busy week when you both have little spare time',
  'While visiting people who matter to you both',
  'After you have spent a month apart',
  'On a trip you planned together',
];
const actions: Record<typeof sections[number], string[]> = {
  Boundaries: [
    'your partner lends someone an item you treasure without asking you first.',
    'your partner agrees to host a friend overnight before checking with you.',
    'your partner asks you not to share private pet names in public.',
    'your partner tells a friend about an argument you thought was private.',
    'your partner gives a friend a thoughtful handmade gift and mentions it beforehand.',
    'your partner asks to read a conversation after noticing a flirty notification.',
    'your partner wants to keep an evening unavailable for calls and explains why.',
    'your partner shares a photo of you after you have asked them to check first.',
  ],
  Trust: [
    'your partner admits forgetting an important task instead of making an excuse.',
    'your partner hides a small expense because they expect an argument.',
    'your partner changes a plan and lets you know only when you ask.',
    'your partner asks you to confirm a story with a screenshot.',
    'your partner keeps a surprise secret but reassures you it does not involve your shared money.',
    'your partner corrects a flattering story about themselves even though nobody noticed the mistake.',
    'your partner tells you they feel attracted to someone but have not acted on it.',
    'your partner agrees to a check-in and forgets, then apologizes without being prompted.',
  ],
  Respect: [
    'your partner interrupts your story several times to correct small details.',
    'your partner asks your permission before offering advice about your appearance.',
    'your partner laughs at a choice you care about and calls it harmless teasing.',
    'your partner credits you for a thoughtful plan when others praise them.',
    'your partner speaks on your behalf even though you are there to answer.',
    'your partner supports your decision in public but raises a concern privately.',
    'your partner dismisses an activity you enjoy because they find it boring.',
    'your partner notices you are uncomfortable and quietly offers you a way to leave.',
  ],
  Communication: [
    'your partner asks whether you want listening or solutions before responding to a problem.',
    'your partner sends several short messages instead of having the call you expected.',
    'your partner says everything is fine but later explains they needed time to find words.',
    'your partner brings up an old disagreement while you are trying to solve a new one.',
    'your partner asks to schedule a difficult conversation rather than start it immediately.',
    'your partner changes the subject when you ask for reassurance.',
    'your partner writes down what they want to say so they will not forget during a disagreement.',
    'your partner asks you to repeat what you heard before you both look for a solution.',
  ],
  Independence: [
    'your partner wants an afternoon alone without needing a particular reason.',
    'your partner signs up for a class with a friend and tells you afterward.',
    'your partner asks to make their own plans rather than attend every event as a couple.',
    'your partner turns down a shared plan because they need rest.',
    'your partner asks you to join a hobby you have said you do not enjoy.',
    'your partner encourages you to take an opportunity that means less time together.',
    'your partner wants to keep some savings in an account only they manage.',
    'your partner says they miss seeing their friends without coordinating both calendars.',
  ],
  'Future expectations': [
    'your partner suggests a shared savings goal but wants to agree on contributions first.',
    'your partner assumes you will spend every major holiday with their family.',
    'your partner wants to discuss what supporting a relative financially could mean for you both.',
    'your partner says their ideal place to live has changed since your last conversation.',
    'your partner wants to keep separate budgets even if you share a home.',
    'your partner asks to revisit a timeline you once agreed on because their priorities have changed.',
    'your partner starts planning a major celebration before agreeing on a budget with you.',
    'your partner says they are not ready to decide a big future question yet.',
  ],
};
export const extraPage: Scenario[] = sections.flatMap((category, topic) => actions[category].flatMap((action, i) => settings.map((setting, j) => ({
  id: `offline-page-${topic}-${i}-${j}`, category, title: `${category}: a moment to consider`,
  text: `${setting}, ${action}`,
  prompt: 'Does this setting change how the action feels? What would you want to ask, agree on, or understand first?',
}))));
const sharedActivities = ['a quiet weekend', 'an evening with no screens', 'a tiny celebration', 'a reunion after time apart', 'a day in a new city', 'a low-budget date', 'a surprise afternoon', 'a day when plans fall through', 'an anniversary at home', 'a free morning', 'a break from a stressful week', 'a rainy holiday'];
const constraints = [
  ['you have only one hour', ['A short walk', 'A shared snack', 'A cozy conversation', 'A quick game']],
  ['you want to try something neither of you has done', ['A creative workshop', 'A new recipe', 'A mystery day trip', 'A dance lesson']],
  ['one of you has very little energy', ['A comfort movie', 'Takeout and a chat', 'Reading side by side', 'A gentle walk']],
  ['you want a memory rather than a purchase', ['Make a photo story', 'Record a shared playlist', 'Write future letters', 'Invent a tradition']],
] as const;
const brain: ChoiceScenario[] = sharedActivities.flatMap((activity, i) => constraints.map(([constraint, options], j) => ({
  id: `offline-brain-${i}-${j}`, category: 'Think alike', title: 'Make it our kind of day',
  text: `For ${activity}, ${constraint}. What would we choose together?`,
  options: [...options], level: 0, prompt: 'What part of that choice matters to you, and would you choose differently without this constraint?',
})));
const sacrifices = [
  'give up takeaway meals for a month', 'let your partner choose every film for a month', 'wake up an hour earlier for a month',
  'use only public transport for a month', 'give up online shopping for a month', 'cook every dinner for a month',
  'swap music playlists for a month', 'give up desserts for a month', 'have no social media for a month',
  'give up streaming shows for a month', 'wear the same colour every day for a month', 'wash every dish for a month',
  'speak only in rhymes on every date for a month', 'announce every snack like a sports commentator for a month',
  'wear a tiny crown on every video call for a month', 'sing every restaurant order for a month',
  'have a theme song play whenever you enter a room for a month', 'narrate every chore like a nature documentary for a month',
  'greet everyone with a dramatic bow for a month', 'have a friendly duck follow you on every date for a month',
];
const poison: ChoiceScenario[] = sacrifices.flatMap((first, i) => sacrifices.slice(i + 1).map((second, j) => ({
  id: `offline-poison-${i}-${i + j + 1}`, category: 'Predict each other', title: 'Pick your trade-off',
  text: `Would you rather ${first}, or ${second}?`, options: [first, second],
  level: Math.min(3, Math.floor((i + i + j + 1) / 10)),
  prompt: 'Which cost feels easier to live with? What made you predict your partner would pick that one?',
})));
const feelings = [
  'I have made a mistake at work', 'I feel left out of a group conversation', 'I am nervous about meeting new people',
  'I have had to cancel something I looked forward to', 'I am proud of a small achievement', 'I am overwhelmed by too many decisions',
  'I have received unexpected good news', 'I feel homesick', 'I am frustrated by a delayed journey',
  'I am anxious before an important appointment', 'I feel unsure after a difficult conversation', 'I have had a tiring day helping others',
  'I feel disappointed after trying something new', 'I need to tell you about a change of plans', 'I miss you after time apart',
];
const supportSettings = [
  ['we are together but only have ten minutes', ['A reassuring hug', 'A short practical plan', 'Listening without advice', 'A little quiet together']],
  ['we are in different places and cannot call yet', ['A thoughtful voice note', 'A short reassuring text', 'A distraction to share', 'Space until we can talk']],
  ['we have a whole evening free', ['Talk it through', 'Go somewhere calming', 'Do something playful', 'Rest side by side']],
  ['we are with friends and I do not want to explain everything', ['A discreet check-in', 'Help taking a break', 'Keep things normal', 'Ask me later in private']],
] as const;
const room: ChoiceScenario[] = feelings.flatMap((feeling, i) => supportSettings.map(([setting, options], j) => ({
  id: `offline-room-${i}-${j}`, category: 'Know me', title: 'What would help right now?',
  text: `${feeling}, and ${setting}. What response would I most appreciate?`, options: [...options], level: 0,
  prompt: 'Would that response help every time, or only in this setting? How could your partner check rather than assume?',
})));
const traits = [
  'befriend a stranger while waiting in line', 'remember a tiny detail from a story', 'pack an emergency snack',
  'take a wrong turn and discover something lovely', 'make a spreadsheet for a tiny decision', 'suggest a spontaneous detour',
  'keep a ticket as a souvenir', 'ask the question everyone else is wondering about', 'choose comfort over a perfect photo',
  'turn a small mishap into an inside joke', 'find the quiet corner at a party', 'offer to help before being asked',
  'spend ages choosing the perfect postcard', 'forget the time in a bookshop', 'bring an extra layer for someone else',
  'invent a game while waiting', 'make friends with the neighbourhood pet', 'remember the way back without a map',
  'want to stay for one more song', 'suggest a plan B before anyone worries', 'research the menu in advance',
  'save the last bite to share', 'start a new tradition by accident', 'spot a beautiful detail nobody else noticed',
  'make a thoughtful handmade gift', 'ask for a group photo', 'give something unfamiliar a try', 'remember to charge every device',
  'make a list and then ignore it', 'turn an ordinary errand into a little adventure',
];
const likely: ChoiceScenario[] = traits.map((trait, i) => ({
  id: `offline-likely-${i}`, category: 'Our story', title: 'Which one of us?',
  text: `Who is more likely to ${trait}?`, options: ['Player one', 'Player two', 'Both of us'], level: 0,
  prompt: 'What shared memory inspired that choice? Could the answer change with the situation?',
}));
export const extraPartyDecks: Record<PartyGameId, ChoiceScenario[]> = { 'same-brain': brain, 'pick-my-poison': poison, 'read-the-room': room, 'more-likely': likely };
