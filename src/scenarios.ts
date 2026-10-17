export interface Scenario {
  id: string;
  category: string;
  title: string;
  text: string;
  prompt: string;
  verdictOptions?: readonly string[];
  reasonOptions?: readonly string[];
}

export const sections = ['Boundaries', 'Trust', 'Respect', 'Communication', 'Independence', 'Future expectations'] as const;
export type Section = typeof sections[number];
export const sectionDescriptions: Record<Section, string> = {
  Boundaries: 'Where comfort, connection, and personal limits meet.',
  Trust: 'Privacy, honesty, and feeling secure with each other.',
  Respect: 'Feeling valued, supported, and taken seriously.',
  Communication: 'Check-ins, disagreements, and listening well.',
  Independence: 'Your own friends, space, and individual growth.',
  'Future expectations': 'Shared plans, life decisions, and the next chapter.',
};

// Edit this collection to change the next game's deck.
export const scenarios: Scenario[] = [
  { id: 'flowers', category: 'Boundaries', title: 'Just being nice?', text: 'Your partner buys flowers for someone else and says they were just being nice.', prompt: 'Where is the line between a kind gesture and a romantic one for each of you?' },
  { id: 'ex', category: 'Trust', title: 'A familiar notification', text: 'Your partner regularly messages an ex. They tell you about it, but you have never talked about what feels comfortable.', prompt: 'What would help you feel secure without controlling each other?' },
  { id: 'phone', category: 'Trust', title: 'An open phone', text: 'Your partner reads your messages while you are asleep because they have been feeling insecure.', prompt: 'How can reassurance and privacy exist together?' },
  { id: 'likes', category: 'Boundaries', title: 'A little heart', text: 'Your partner often leaves heart emojis on the same person’s flirty photos.', prompt: 'What meaning do you each attach to online interactions?' },
  { id: 'friends', category: 'Independence', title: 'A weekend of their own', text: 'Your partner plans a weekend away with friends without inviting you, then tells you before booking.', prompt: 'What balance of togetherness and independence feels good?' },
  { id: 'jokes', category: 'Respect', title: 'Only a joke', text: 'Your partner makes a joke about your insecurities in front of friends and says you are taking it too seriously.', prompt: 'How would you want hurt feelings to be acknowledged?' },
  { id: 'plans', category: 'Communication', title: 'The last-minute change', text: 'Your partner cancels your date at the last minute to spend time with friends for the second time this month.', prompt: 'How can you make each other feel like a priority?' },
  { id: 'money', category: 'Future expectations', title: 'The big purchase', text: 'Your partner makes an expensive purchase from their own money while you are both saving for a shared home.', prompt: 'Which financial decisions should be shared decisions?' },
  { id: 'space', category: 'Communication', title: 'A little space', text: 'After an argument, your partner asks for a day alone and tells you when they will check back in.', prompt: 'What does a healthy pause during conflict look like?' },
  { id: 'secret', category: 'Trust', title: 'A private friendship', text: 'Your partner deletes conversations with a friend because they think you would misunderstand them.', prompt: 'What is the difference between privacy and secrecy to you?' },
  { id: 'career', category: 'Future expectations', title: 'The dream offer', text: 'Your partner accepts a job in another city before discussing what it means for your relationship.', prompt: 'How do you want to navigate individual dreams and a shared future?' },
  { id: 'flirt', category: 'Boundaries', title: 'A free drink', text: 'Your partner flirts with someone at a bar to get free drinks and tells you about it afterward.', prompt: 'Does intent change how the interaction feels to you?' },
  { id: 'location', category: 'Independence', title: 'Always on the map', text: 'Your partner asks you to share your live location all the time as proof that you have nothing to hide.', prompt: 'When does feeling connected start to feel monitored?' },
  { id: 'family', category: 'Respect', title: 'At the dinner table', text: 'A family member criticizes you in front of your partner. Your partner stays quiet to avoid a scene.', prompt: 'What would support look like in a difficult family moment?' },
  { id: 'post', category: 'Boundaries', title: 'Before you post', text: 'Your partner shares a vulnerable story about your relationship online without asking you first.', prompt: 'What parts of your relationship do you want to keep between you?' },
  { id: 'reply', category: 'Communication', title: 'Left on read', text: 'Your partner does not reply for most of a busy workday but posts on social media during a break.', prompt: 'What communication expectations are realistic for both of you?' },
  { id: 'dinner', category: 'Boundaries', title: 'Dinner for two', text: 'Your partner has a one-on-one dinner with someone who previously expressed romantic interest in them, and tells you afterward.', prompt: 'How do timing and transparency shape your feelings?' },
  { id: 'children', category: 'Future expectations', title: 'Not quite the same plan', text: 'Your partner says they are unsure about having children, although you had assumed you both wanted them.', prompt: 'How can you make space for uncertainty in important future conversations?' },
  { id: 'hobby', category: 'Independence', title: 'Something just for them', text: 'Your partner starts a new hobby and wants to keep it as time for themselves rather than something you do together.', prompt: 'What helps individual growth feel supportive rather than distant?' },
  { id: 'apology', category: 'Respect', title: 'Moving past it', text: 'After hurting your feelings, your partner buys you a gift but does not want to talk about what happened.', prompt: 'What makes an apology feel meaningful to each of you?' },
  { id: 'honest-mistake', category: 'Trust', title: 'An awkward admission', text: 'Your partner tells you they accidentally damaged something you lent them, even though they could have hidden it.', prompt: 'How do honesty and the way a mistake is repaired affect your sense of trust?' },
  { id: 'confidence', category: 'Trust', title: 'A story told twice', text: 'Your partner shares something personal you told them with their closest friend, believing that friend would keep it private.', prompt: 'Which stories need explicit permission before they are shared with someone else?' },
  { id: 'achievement', category: 'Respect', title: 'A small celebration', text: 'You share an achievement you feel proud of. Your partner immediately points out what you could have done better.', prompt: 'How would you each like encouragement and constructive feedback to be balanced?' },
  { id: 'public-disagreement', category: 'Respect', title: 'Different opinions, an audience', text: 'Your partner disagrees with you in front of friends and explains their view calmly, without making fun of yours.', prompt: 'What makes disagreement feel respectful, in public and in private?' },
  { id: 'unspoken-need', category: 'Communication', title: 'You should have known', text: 'Your partner is upset that you did not notice they wanted help, although they had not asked for it.', prompt: 'How can you make asking for support feel welcome rather than expecting mind-reading?' },
  { id: 'serious-text', category: 'Communication', title: 'A message, not a call', text: 'Your partner brings up a difficult relationship conversation by text because they find it easier to express themselves in writing.', prompt: 'Which conversations work better in writing, on a call, or face to face for each of you?' },
  { id: 'solo-trip', category: 'Independence', title: 'An adventure of their own', text: 'Your partner wants to take a short solo trip and talks with you about the plan before booking.', prompt: 'What would help solo experiences feel compatible with your connection?' },
  { id: 'own-friends', category: 'Independence', title: 'Not every invitation', text: 'Your partner sometimes meets their friends without inviting you, even when you are free that evening.', prompt: 'How do you each balance separate friendships, inclusion, and time together?' },
  { id: 'shared-home', category: 'Future expectations', title: 'A key, and a question', text: 'Your partner assumes you will move in together when your lease ends, but you have not discussed whether you both feel ready.', prompt: 'What conversations would help a shared home feel like a mutual choice rather than an assumption?' },
  { id: 'caregiving', category: 'Future expectations', title: 'Making room for family', text: 'Your partner hopes a parent could live with you both in the future and shares that hope before you make housing plans.', prompt: 'How would you want to discuss family care, space, and responsibilities in a shared future?' },
];

export function buildSectionDeck(selected: readonly Section[]): Scenario[] {
  if (!selected.length || new Set(selected).size !== selected.length || selected.some(section => !sections.includes(section))) {
    throw new Error('Choose at least one different Same Page? section.');
  }

  return selected.flatMap(section => {
    const deck = scenarios.filter(scenario => scenario.category === section);
    if (deck.length !== 5) throw new Error(`The ${section} section needs exactly five scenarios.`);
    return deck;
  });
}

export function selectedSectionsFromDeck(deck: readonly Scenario[]): Section[] | undefined {
  const selected = sections.filter(section => deck.some(scenario => scenario.category === section));
  return selected.length > 0 && selected.length * 5 === deck.length && selected.every(section => deck.filter(scenario => scenario.category === section).length === 5)
    ? [...selected] : undefined;
}
