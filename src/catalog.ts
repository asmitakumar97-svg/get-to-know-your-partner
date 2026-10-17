import { scenarios, type Scenario } from './scenarios';

export const partyGameIds = ['same-brain', 'pick-my-poison', 'read-the-room', 'more-likely'] as const;
export type PartyGameId = typeof partyGameIds[number];
export type GameId = 'same-page' | PartyGameId;
export interface GameDefinition {
  id: GameId;
  title: string;
  category: string;
  description: string;
  rules: string;
  scoring: string;
  quickPlay: string;
  color: string;
}
export const games: GameDefinition[] = [
  { id: 'same-page', title: 'Same Page?', category: 'Go deeper', description: 'Same situation. Two perspectives. Find the conversation in between.', quickPlay: 'Pick your sections. Answer five situations in each with a verdict, a feeling, and what matters most. Reveal together, then talk.', rules: 'Choose one or more of six sections, with five questions per section. Choose a verdict, a feeling, and what matters most. Reveal only after both submit, then pause to discuss.', scoring: 'Three independent reflection threads. No relationship grade.', color: 'pink' },
  { id: 'same-brain', title: 'Same Brain?', category: 'Think alike', description: 'Two minds. One question. Are you thinking what I’m thinking?', quickPlay: 'Choose separately, then reveal. Matching answers earn a shared point. In the final round, predict whether you’ll match, too.', rules: 'Both choose independently. In the final bonus round, also predict whether your choices will match.', scoring: '1 shared point per matching round. Final round: each earns 1 bonus point for correctly predicting match or no match.', color: 'lavender' },
  { id: 'pick-my-poison', title: 'Pick My Poison', category: 'Predict each other', description: 'Two impossible choices. How well can you predict your person?', quickPlay: 'Pick between two dilemmas and guess your partner’s choice. Reveal both answers; every accurate prediction earns a point.', rules: 'Choose your own answer and predict your partner’s. Dilemmas get more ridiculous as you go.', scoring: 'Each player earns 1 point for correctly predicting the other’s actual choice.', color: 'peach' },
  { id: 'read-the-room', title: 'Read the Room', category: 'Know me', description: 'Advice, a hug, a snack, or space? Find out what actually fits.', quickPlay: 'One answers honestly; the other predicts that response. Reveal and talk, then swap roles. Only predictions earn points.', rules: 'Take turns being the responder. The responder chooses their real answer; the other predicts it. Roles alternate every round.', scoring: 'The predictor earns 1 point for a matching prediction. The responder’s feeling or preference is never marked right or wrong.', color: 'green' },
  { id: 'more-likely', title: 'Who’s More Likely To…?', category: 'Our story', description: 'Your person, or you? Compare how you see each other.', quickPlay: 'Both secretly pick the person who fits the statement. Reveal together: choosing the same person earns one shared point.', rules: 'Both secretly choose the person who best fits the statement. Choices refer to the same named players on both devices.', scoring: '1 shared point when both select the same person. Agreement is a perception, not a personality diagnosis.', color: 'pink' },
];
export function gameDefinition(id: GameId) {
  const result = games.find(game => game.id === id);
  if (!result) throw new Error('This game is not available. Please return to the playroom.');
  return result;
}
export function isGameId(value: unknown): value is GameId {
  return typeof value === 'string' && games.some(game => game.id === value);
}

export interface ChoiceScenario extends Scenario { options: string[]; level: number }
type Seed = [title: string, text: string, options: string[], prompt: string];
function seed(id: PartyGameId, items: Seed[]): ChoiceScenario[] {
  return items.map(([title, text, options, prompt], i) => ({
    id: `${id}-${i + 1}`, title, text, options, prompt,
    category: gameDefinition(id).category, level: Math.floor(i / 5),
  }));
}
const brain: Seed[] = [
  ['Our ideal date', 'What’s our ideal date night?', ['Fancy dinner', 'Movie and snacks at home', 'Spontaneous adventure', 'Doing our own things together'], 'Which part of that date would make it feel special to you?'],
  ['A free Sunday', 'A completely free Sunday arrives. What should we do?', ['Find a new café', 'Stay in and recharge', 'Take a day trip', 'See our friends'], 'What does a genuinely restful day look like for each of us?'],
  ['A tiny tradition', 'Which little tradition would you most like us to start?', ['Friday takeout', 'A monthly adventure', 'A daily walk', 'Notes for each other'], 'Could we make room for more than one kind of connection?'],
  ['Our soundtrack', 'Which soundtrack best fits our relationship?', ['Feel-good pop', 'Soft acoustic', 'Dramatic film score', 'Chaotic dance playlist'], 'Which memory made you pick that soundtrack?'],
  ['A shared splurge', 'We have a little extra spending money. What sounds best?', ['A beautiful meal', 'A weekend away', 'Something for our home', 'Save it for a bigger dream'], 'What would make that choice feel worth it?'],
  ['A new skill', 'What should we try learning together?', ['Cooking', 'Dancing', 'A language', 'Something outdoorsy'], 'Would you prefer learning together or teaching each other?'],
  ['A dream home', 'Which home sounds most like us?', ['City apartment', 'Countryside cottage', 'House by the sea', 'A home on wheels'], 'What feeling are you hoping that home would give you?'],
  ['Our superpower', 'What would our duo’s superpower be?', ['Making each other laugh', 'Finding good food', 'Solving problems', 'Turning plans into adventures'], 'When have you noticed that strength in us?'],
  ['One photo', 'Which photo would we put on our imaginary album cover?', ['A candid laugh', 'A travel snapshot', 'A cozy everyday moment', 'Our most ridiculous selfie'], 'What kind of memory do you want to collect more of?'],
  ['The road trip', 'What’s the most important part of a road trip?', ['The playlist', 'The snacks', 'The scenery', 'The unplanned stops'], 'Which job would each of us happily claim?'],
  ['A surprise gift', 'Which surprise would mean the most?', ['A thoughtful letter', 'An experience together', 'Something I mentioned once', 'An act of help'], 'What makes a gesture feel personal rather than just expensive?'],
  ['A rainy afternoon', 'Rain cancels our plans. What’s the backup?', ['Bake something', 'Start a series', 'Play a game', 'Go for a rainy walk'], 'Do changed plans feel freeing or frustrating to you?'],
  ['Our restaurant', 'If we opened a tiny restaurant, what would it serve?', ['Comfort food', 'Breakfast all day', 'Fancy small plates', 'Desserts only'], 'What would we each bring to this imaginary venture?'],
  ['A mini escape', 'We can disappear for an hour. Where do we go?', ['A bookshop', 'A garden', 'A coffee shop', 'Back under a blanket'], 'What helps you feel present with someone?'],
  ['Our mascot', 'Which animal is our relationship’s mascot?', ['Two sleepy cats', 'A pair of penguins', 'Playful otters', 'Two chaotic pigeons'], 'What everyday moment does that remind you of?'],
  ['The time capsule', 'What belongs in our time capsule?', ['A handwritten note', 'A favorite photo', 'An inside joke', 'A little souvenir'], 'What would you want our future selves to remember?'],
  ['The dream invitation', 'What would we most like an invitation to?', ['A concert', 'A secret supper club', 'A stargazing night', 'A costume party'], 'What kind of excitement do you want more of together?'],
  ['An imaginary holiday', 'What should our own made-up holiday celebrate?', ['Our first meeting', 'Doing absolutely nothing', 'Trying something new', 'Our inside jokes'], 'What ordinary things deserve a little celebration?'],
  ['Our movie genre', 'What genre would a movie about us be?', ['Romantic comedy', 'Cozy slice of life', 'Adventure', 'A very odd documentary'], 'Which scene would absolutely need to be in it?'],
  ['Our next chapter', 'What do we want a little more of next?', ['Playfulness', 'Quiet time together', 'New experiences', 'Thoughtful conversations'], 'What is one small way we could make space for that?'],
];
const poison: Seed[] = [
  ['The great trade-off', 'Would I rather give up music for a year or social media for a year?', ['Give up music for a year', 'Give up social media for a year'], 'What would you miss most, and what would be unexpectedly nice?'],
  ['A delicious dilemma', 'Would I rather give up sweet snacks or salty snacks?', ['Give up sweet snacks', 'Give up salty snacks'], 'Did your partner remember your secret snack loyalties?'],
  ['Always early, always late', 'Would I rather arrive 30 minutes early everywhere or 10 minutes late everywhere?', ['Always 30 minutes early', 'Always 10 minutes late'], 'How do our different relationships with time show up together?'],
  ['The holiday bargain', 'Would I rather get free flights forever or free restaurant meals forever?', ['Free flights', 'Free restaurant meals'], 'Which future plans made that choice tempting?'],
  ['A cozy sacrifice', 'Would I rather lose my favorite blanket or my favorite mug?', ['Lose my favorite blanket', 'Lose my favorite mug'], 'Which tiny comfort does your partner associate with you?'],
  ['One unusual talent', 'Would I rather speak every language or play every instrument?', ['Speak every language', 'Play every instrument'], 'Where would you use that ability first?'],
  ['A very public voice', 'Would I rather sing every text aloud or dance every time the phone rings?', ['Sing every text aloud', 'Dance whenever the phone rings'], 'Which of us would secretly enjoy the attention?'],
  ['Travel with a twist', 'Would I rather have a five-star stay with terrible Wi-Fi or perfect Wi-Fi in a tiny tent?', ['Luxury stay, terrible Wi-Fi', 'Tiny tent, perfect Wi-Fi'], 'Is the answer different for a holiday versus everyday life?'],
  ['A personal sidekick', 'Would I rather have a tiny dragon that steals snacks or a talking cat that critiques outfits?', ['Snack-stealing dragon', 'Fashion-critic cat'], 'Which sidekick would fit most naturally into our life?'],
  ['The dramatic entrance', 'Would I rather have theme music play whenever I enter a room or confetti whenever I leave?', ['Entrance theme music', 'Exit confetti'], 'What would your very own theme song be?'],
  ['A peculiar wardrobe', 'Would I rather wear a cape every day or shoes that squeak compliments?', ['A daily cape', 'Compliment-squeaking shoes'], 'Did you predict practicality or commitment to the bit?'],
  ['The food forecast', 'Would I rather sneeze glitter or hiccup tiny bubbles?', ['Sneeze glitter', 'Hiccup tiny bubbles'], 'Which consequence did you consider that your partner missed?'],
  ['The unusual commute', 'Would I rather commute on a friendly giant snail or in a very dramatic hot-air balloon?', ['Friendly giant snail', 'Dramatic hot-air balloon'], 'Would you choose the scenic route or the grand entrance?'],
  ['A personal narrator', 'Would I rather have a documentary narrator describe my day or an invisible choir sing my thoughts?', ['A documentary narrator', 'An invisible choir'], 'What ordinary moment would become the most ridiculous?'],
  ['The household uprising', 'Would I rather negotiate with my toaster every morning or debate my mirror every night?', ['Negotiate with the toaster', 'Debate the mirror'], 'Which appliance would your partner befriend first?'],
  ['A tiny fan club', 'Would I rather be followed by five polite ducks or one enthusiastic marching band?', ['Five polite ducks', 'One marching band'], 'How much attention is the right amount of attention for you?'],
  ['Space or sea', 'Would I rather host a tea party on the moon or a karaoke night for mermaids?', ['Moon tea party', 'Mermaid karaoke night'], 'What would your first invitation say?'],
  ['Royal responsibilities', 'Would I rather become mayor of a mushroom village or ambassador to a planet of puppies?', ['Mushroom village mayor', 'Puppy planet ambassador'], 'What absurd responsibility would you take most seriously?'],
  ['The gravity problem', 'Would I rather float one foot off the floor when flustered or turn into a disco ball when excited?', ['Float when flustered', 'Become a disco ball when excited'], 'Which reaction would your partner notice first?'],
  ['The final ridiculous choice', 'Would I rather ride a cloud that only accepts compliments or a dragon powered entirely by gossip?', ['Compliment-powered cloud', 'Gossip-powered dragon'], 'Which choice surprised you most across this whole game?'],
];
const room: Seed[] = [
  ['An awful day', 'I’ve had an awful day. What’s most likely to make me feel better?', ['Advice', 'A hug', 'Food', 'Space'], 'How could you ask what is needed instead of having to guess?'],
  ['A quiet evening', 'I’m quieter than usual tonight. What would I most appreciate?', ['A gentle check-in', 'Comfortable silence', 'A distraction', 'Time on my own'], 'How can a check-in leave room for an honest answer?'],
  ['Good news', 'I have exciting news. How would I most like to celebrate?', ['Tell everyone', 'Dinner with you', 'A little gift', 'Enjoy it quietly'], 'What makes a celebration feel like it is really for you?'],
  ['A difficult task', 'I’m overwhelmed by a task. What would help most?', ['Help breaking it down', 'Someone doing part of it', 'Encouragement', 'A short break'], 'What kind of help feels supportive rather than taking over?'],
  ['A changed plan', 'Our plans change unexpectedly. What would I probably want first?', ['A new plan', 'Reassurance', 'A moment to be disappointed', 'To improvise'], 'How could we leave room for different reactions to change?'],
  ['Meeting new people', 'We’re going to a gathering where I know nobody. What would help me feel comfortable?', ['Introductions', 'Staying close at first', 'A role or activity', 'Knowing we can leave early'], 'What support would make social events easier for you?'],
  ['A small mistake', 'I’ve made a small but embarrassing mistake. What reaction would help?', ['Laugh gently with me', 'Reassure me', 'Help fix it', 'Don’t draw attention to it'], 'How can your partner tell when humor is welcome?'],
  ['After an argument', 'After a disagreement, what would I most likely want first?', ['Time to cool down', 'A calm conversation', 'Affection, if welcome', 'A clear apology'], 'How can a pause come with reassurance that you will reconnect?'],
  ['A little distance', 'We haven’t had much time together lately. What would I appreciate most?', ['A planned date', 'A thoughtful message', 'A shared everyday task', 'An honest check-in'], 'What helps you feel connected when life is busy?'],
  ['A big decision', 'I’m facing a big decision. How would I like you to respond?', ['Ask useful questions', 'Share your honest opinion', 'Listen while I think aloud', 'Remind me it is my choice'], 'How can you offer perspective without taking ownership of the decision?'],
  ['Feeling under the weather', 'I’m a little under the weather. What would feel caring?', ['A meal or drink', 'Practical help', 'Company', 'Rest without interruption'], 'Is there a practical way to make care easier to ask for?'],
  ['A busy message', 'I’m busy and receive a long message. What would I most prefer?', ['A short summary first', 'A voice note', 'Time to reply later', 'A quick call when free'], 'What expectations around replies are realistic for each of you?'],
  ['A surprise', 'You want to surprise me. What kind would I most enjoy?', ['A planned outing', 'A small meaningful thing', 'Help with something tiring', 'No surprise; plan with me'], 'What separates a welcome surprise from added pressure?'],
  ['Feeling proud', 'I’m proud of something I did. What response would mean most?', ['Specific praise', 'Curious questions', 'A celebration', 'Quiet acknowledgement'], 'How can you notice the effort behind an achievement?'],
  ['A restless night', 'I can’t settle after a stressful day. What might I choose?', ['A walk', 'Something comforting to watch', 'Talking it through', 'Quiet alone time'], 'What signals could help your partner understand what would fit tonight?'],
  ['An unexpected expense', 'A surprise expense has me worried. What would help first?', ['Look at the numbers', 'Reassurance', 'A practical plan', 'Time to process'], 'How can emotional and practical support work together?'],
  ['A social battery', 'My social battery is empty at a party. What would I hope you notice?', ['I want to head home', 'I need a short break', 'I want you nearby', 'I will say when I need help'], 'Could you agree on a gentle signal without expecting mind-reading?'],
  ['A new challenge', 'I’m about to try something intimidating. What would encourage me?', ['A pep talk', 'You trying it with me', 'A practical tip', 'No pressure either way'], 'What kind of encouragement feels motivating rather than demanding?'],
  ['A thoughtful check-in', 'You ask how I’m really doing. What makes it easier to answer?', ['Uninterrupted time', 'A walk side by side', 'A gentle specific question', 'Knowing I can answer later'], 'What conditions help you feel safe enough to be honest?'],
  ['Coming back together', 'We finally have an evening together after a busy week. What would I likely want?', ['A proper conversation', 'Affection and quiet', 'A fun distraction', 'A little individual downtime first'], 'How could you make room for both people’s needs tonight?'],
];
const likelyStatements = [
  ['Zombie survival', 'Who would survive longer in a zombie apocalypse?'],
  ['A spontaneous purchase', 'Who is more likely to spend money impulsively?'],
  ['The first apology', 'Who would apologise first after an argument?'],
  ['Accidental fame', 'Who would accidentally become famous?'],
  ['The snack stash', 'Who is more likely to bring emergency snacks?'],
  ['The lost tourist', 'Who would befriend a stranger while asking for directions?'],
  ['One more episode', 'Who is more likely to say “one more episode” and mean three?'],
  ['The group itinerary', 'Who would plan the entire trip in a spreadsheet?'],
  ['A very tiny rescue', 'Who is more likely to rescue a bug instead of shooing it away?'],
  ['The surprise party', 'Who would accidentally spoil a surprise?'],
  ['The kitchen experiment', 'Who is more likely to invent a recipe that somehow works?'],
  ['A sentimental souvenir', 'Who would keep a tiny receipt for sentimental reasons?'],
  ['The dance floor', 'Who is more likely to dance before anyone else does?'],
  ['The dramatic weather', 'Who would forget an umbrella despite checking the forecast?'],
  ['One new hobby', 'Who is more likely to start a wonderfully random new hobby?'],
  ['The long voice note', 'Who would send a voice note that becomes a podcast?'],
  ['The plant parent', 'Who is more likely to name every houseplant?'],
  ['An unplanned detour', 'Who would turn a five-minute errand into a little adventure?'],
  ['The thoughtful detail', 'Who is more likely to remember someone’s very specific coffee order?'],
  ['The invented tradition', 'Who would invent a holiday just for the two of you?'],
];

export const partyDecks: Record<PartyGameId, ChoiceScenario[]> = {
  'same-brain': seed('same-brain', brain),
  'pick-my-poison': seed('pick-my-poison', poison),
  'read-the-room': seed('read-the-room', room),
  'more-likely': seed('more-likely', likelyStatements.map(([title, text]) => [title, text, ['Player one', 'Player two'], 'What memory or small observation made you choose that person? Does your partner see it the same way?'])),
};

export function buildDeck(id: PartyGameId, count: number): ChoiceScenario[];
export function buildDeck(id: 'same-page', count: number): Scenario[];
export function buildDeck(id: GameId, count: number): Scenario[];
export function buildDeck(id: GameId, count: number): Scenario[] {
  if (![3, 5, 10, 20].includes(count)) throw new Error('Choose 3, 5, 10, or 20 rounds.');
  if (id === 'same-page') return scenarios.slice(0, count);
  const deck = [...partyDecks[id]];
  if (id === 'pick-my-poison') {
    // Spread short games across the full escalation without shuffling the difficulty.
    return Array.from({ length: count }, (_, i) => deck[Math.round(i * (deck.length - 1) / (count - 1))]);
  }
  for (let i = deck.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(Math.random() * i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, count);
}
