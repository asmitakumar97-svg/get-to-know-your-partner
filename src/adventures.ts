import type { ChoiceScenario } from './catalog';
import type { ChoiceAnswer, ChoiceGameState } from './game';

export const adventureIds = ['stranded', 'restaurant', 'aliens', 'spaceship'] as const;
export type AdventureId = typeof adventureIds[number];
export interface AdventureAction { label: string; cost: number; grants: string[]; requires?: string }
export interface AdventureChapter {
  world: AdventureId;
  resource: string;
  initial: number;
  actions: AdventureAction[];
  clues?: [string, string];
  myClue?: string;
  kit?: boolean;
  surprise?: { unless: string; cost: number; prepared: string; unprepared: string };
}
export interface AdventureDefinition { id: AdventureId; title: string; description: string; goal: string[]; ending: [string, string] }
export const adventures: AdventureDefinition[] = [
  { id: 'stranded', title: 'Stranded Together', description: 'Choose three survival items, find shelter, and signal before sunset.', goal: ['water', 'shelter', 'signal'], ending: ['A light on the horizon', 'A sheltered night, a new morning'] },
  { id: 'restaurant', title: "The World's Worst Restaurant", description: 'Open on a tiny budget. Then the inspector, the rain, and the unexpected guests arrive.', goal: ['menu', 'safe', 'service'], ending: ['The little restaurant everyone remembers', 'A very promising pop-up'] },
  { id: 'aliens', title: 'The Alien Diplomacy Disaster', description: 'Combine two different briefings. Make contact without accidentally declaring war on lunch.', goal: ['calm', 'language', 'gift'], ending: ['The first interstellar supper club', 'A curious truce'] },
  { id: 'spaceship', title: 'Fix the Spaceship', description: 'Share engineering clues and coordinate limited repairs before the ship drifts too far.', goal: ['hull', 'oxygen', 'navigation'], ending: ['Two seats, one journey home', 'The patient rescue beacon'] },
];
const action = (label: string, cost: number, grants: string[], requires?: string): AdventureAction => ({ label, cost, grants, ...(requires ? { requires } : {}) });
const commonPrompt = 'What did each of our clues change about the plan, and what should we coordinate next?';
function chapter(world: AdventureId, n: number, title: string, text: string, actions: AdventureAction[], clues: [string, string], extra: Partial<AdventureChapter> = {}): ChoiceScenario {
  const adventure: AdventureChapter = { world, resource: world === 'restaurant' ? 'budget' : world === 'spaceship' ? 'power cells' : world === 'aliens' ? 'translator charge' : 'daylight supplies', initial: 12, actions, clues, ...extra };
  return { id: `adventure-${world}-${n}`, title, text, options: actions.map(a => a.label), category: adventures.find(a => a.id === world)!.title, prompt: commonPrompt, level: n, adventure };
}
const chapters: Record<AdventureId, ChoiceScenario[]> = {
  stranded: [
    chapter('stranded', 0, 'Three things before sunset', 'Pick exactly three items in priority order. Your shared kit takes the first three different items, alternating between your lists. Discuss which jobs each item could do.', [
      action('Water filter', 0, ['water']), action('Waterproof tarp', 0, ['shelter']), action('Signal mirror', 0, ['signal']), action('Coil of rope', 0, ['rope']), action('First-aid pouch', 0, ['care']), action('Wind-up lantern', 0, ['light']),
    ], ['A freshwater stream is nearby, but it needs filtering. The ridge catches the last sunlight.', 'Rain is moving in from the sea. A waterproof roof will save supplies later.'], { kit: true }),
    chapter('stranded', 1, 'The fork in the island', 'Split the work or combine your efforts. What will each of you do before the light fades?', [
      action('Filter stream water', 1, ['water'], 'water'), action('Build a covered shelter', 2, ['shelter']), action('Climb to signal from the ridge', 2, ['signal']), action('Survey the coastline without spending supplies', 0, ['route']),
    ], ['The stream path is short if you brought the filter.', 'Ships pass the western ridge; a signal there can be seen from the water.']),
    chapter('stranded', 2, 'The sudden squall', 'The weather changes. Choose how to protect your shared plan.', [
      action('Reinforce the shelter', 1, ['shelter']), action('Collect rainwater safely', 1, ['water']), action('Protect and relay the signal', 2, ['signal']), action('Wait under the rock overhang', 0, ['rest']),
    ], ['The rock overhang is safe, but waiting does not improve a signal.', 'A protected container can collect enough rainwater for tonight.'], { surprise: { unless: 'shelter', cost: 2, prepared: 'Your shelter keeps the storm from using extra supplies.', unprepared: 'Without shelter, the squall uses two supplies before your next actions.' } }),
    chapter('stranded', 3, 'One last stretch of daylight', 'A faint engine sounds offshore. What will each of you focus on?', [
      action('Make a clear shore signal', 2, ['signal']), action('Secure a dry sleeping place', 1, ['shelter']), action('Prepare clean water', 1, ['water']), action('Mark a safe route for tomorrow', 0, ['route']),
    ], ['A signal is useful only if you can also stay safely on the shore.', 'If rescue does not arrive tonight, water and shelter make tomorrow possible.']),
    chapter('stranded', 4, 'Your shared landing', 'Agree on the last small action. Your ending depends on the water, shelter, and signal you actually secured.', [
      action('Top up the water supply', 1, ['water']), action('Repair the roof', 1, ['shelter']), action('Send the final signal', 2, ['signal']), action('Conserve supplies and stay together', 0, ['rest']),
    ], ['You do not need to repeat a job that is already secured.', 'Check your shared checklist before spending the last supplies.']),
  ],
  restaurant: [
    chapter('restaurant', 0, 'A very small grand opening', 'You have twelve budget tokens between you. Decide which foundations deserve your first investment.', [
      action('Create a small reliable menu', 2, ['menu']), action('Check kitchen safety', 2, ['safe']), action('Set up a clear service station', 2, ['service']), action('Borrow tables and start simply', 0, ['tables']),
    ], ['A short menu is cheaper to run than a large one.', 'Guests will forgive mismatched chairs, not unsafe food.']),
    chapter('restaurant', 1, 'The first reservation', 'A large party books a table. What will you prepare?', [
      action('Simplify and test the menu', 2, ['menu']), action('Set a calm serving system', 1, ['service']), action('Double-check food storage', 1, ['safe']), action('Ask guests to arrive in two groups', 0, ['pace']),
    ], ['The guests are happy with fewer dishes if service feels welcoming.', 'The fridge must stay clear of the overloaded extension cable.']),
    chapter('restaurant', 2, 'Rain, an inspector, and one umbrella', 'A surprise inspection arrives during a downpour. Adapt without forgetting your budget.', [
      action('Fix the storage setup', 1, ['safe']), action('Move service under cover', 1, ['service']), action('Switch to a shorter menu', 1, ['menu']), action('Explain the delay and pause new orders', 0, ['pace']),
    ], ['The inspector is checking storage, not decorations.', 'Covered service lets the guests stay while the rain passes.'], { surprise: { unless: 'safe', cost: 2, prepared: 'Your earlier safety check avoids an emergency expense.', unprepared: 'An urgent safety fix uses two budget tokens before you continue.' } }),
    chapter('restaurant', 3, 'Everyone orders at once', 'The kitchen bell will not stop. Choose a job each, with the budget you have left.', [
      action('Cook the dependable special', 1, ['menu']), action('Coordinate the table orders', 1, ['service']), action('Review safe preparation', 1, ['safe']), action('Offer water and an honest wait time', 0, ['pace']),
    ], ['Making one dish dependable can be better than promising six.', 'A clear wait time prevents a crowd at the kitchen door.']),
    chapter('restaurant', 4, 'The last table', 'Your ending depends on the menu, safety, and service you actually built. What needs your final attention?', [
      action('Finish the menu plan', 1, ['menu']), action('Complete the safety checklist', 1, ['safe']), action('Set tomorrow’s service routine', 1, ['service']), action('Close gently and invite feedback', 0, ['pace']),
    ], ['Review the checklist rather than spending just because a token remains.', 'A small pop-up can be a worthwhile ending too.']),
  ],
  aliens: [
    chapter('aliens', 0, 'Two very different briefings', 'Read your own briefing, share what you choose to share, and plan a first greeting.', [
      action('Keep a respectful distance', 1, ['calm']), action('Listen for repeated tones', 1, ['language']), action('Offer an unwrapped local seed', 2, ['gift']), action('Observe quietly without spending charge', 0, ['observe']),
    ], ['A raised hand means “please stop” here, not hello. Distance is respectful.', 'Repeated low tones are names. Local seeds are a welcome gift; shiny wrappers are not.']),
    chapter('aliens', 1, 'The ambassador hums', 'The ambassador repeats three low notes and waits. Decide what each of you contributes.', [
      action('Repeat the low notes gently', 1, ['language']), action('Leave room for a reply', 0, ['calm']), action('Present a local seed', 2, ['gift']), action('Record the sounds for later', 0, ['observe']),
    ], ['Repeating the tones acknowledges a name, not a command.', 'The pause after the notes is an invitation to respond slowly.']),
    chapter('aliens', 2, 'The translator announces “soup war”', 'A mistranslation interrupts the meeting. How do you adapt?', [
      action('Restart with the known name tones', 1, ['language']), action('Step back and lower the volume', 0, ['calm']), action('Offer the seed without packaging', 2, ['gift']), action('Turn off the unreliable screen', 0, ['observe']),
    ], ['The screen confuses loud sounds with threats.', 'An unwrapped seed communicates peaceful exchange without the translator.'], { surprise: { unless: 'language', cost: 2, prepared: 'The name tones you learned let you recover without extra charge.', unprepared: 'Without a shared language cue, resetting the translator costs two charge.' } }),
    chapter('aliens', 3, 'An invitation, possibly', 'The ambassador opens a circle on the ground. You have a little charge left.', [
      action('Answer using the name tones', 1, ['language']), action('Wait for permission to enter', 0, ['calm']), action('Place a seed at the circle’s edge', 1, ['gift']), action('Sketch the invitation for later', 0, ['observe']),
    ], ['The open circle is a meeting place, not a target.', 'Waiting at the edge gives the host a chance to welcome you.']),
    chapter('aliens', 4, 'A shared table, or a second visit', 'Your ending depends on calm contact, a language cue, and a peaceful gift. Choose the final gesture together.', [
      action('Use the name tones once more', 1, ['language']), action('Leave a seed as a thank-you', 1, ['gift']), action('Give the ambassador room to respond', 0, ['calm']), action('Arrange a quiet second meeting', 0, ['observe']),
    ], ['You can leave room for uncertainty without calling the meeting a failure.', 'The shared checklist records gestures, not what either person secretly intended.']),
  ],
  spaceship: [
    chapter('spaceship', 0, 'The ship blinks politely', 'Three systems need attention. Share your engineering clues and choose different jobs if useful.', [
      action('Patch the hull seal', 2, ['hull']), action('Restart the air recycler', 2, ['oxygen']), action('Align the navigation array', 2, ['navigation']), action('Run a low-power diagnostic', 0, ['diagnostic']),
    ], ['The hull seal prevents a later power drain. The diagnostic is safe but repairs nothing.', 'The air recycler and navigation use separate circuits; two people can work on different systems.']),
    chapter('spaceship', 1, 'A map made of blinking dots', 'You can coordinate a repair or investigate before spending power.', [
      action('Seal the small hull leak', 1, ['hull']), action('Clean the air recycler', 1, ['oxygen']), action('Recalibrate navigation', 2, ['navigation']), action('Check the system diagram', 0, ['diagnostic']),
    ], ['The leak is small now, but an unsealed hull will drain power in the debris field.', 'The navigation display is wrong because of alignment, not because the whole array needs replacing.']),
    chapter('spaceship', 2, 'A very inconvenient debris field', 'The ship shudders. Adapt to the power you actually have.', [
      action('Reinforce the hull', 1, ['hull']), action('Restore air circulation', 1, ['oxygen']), action('Plot a safe course', 1, ['navigation']), action('Drift safely while conserving power', 0, ['drift']),
    ], ['A sealed hull protects the remaining cells from the debris field.', 'Drifting is safe for now, but it does not restore a system.'], { surprise: { unless: 'hull', cost: 2, prepared: 'The sealed hull prevents extra power loss.', unprepared: 'The open hull seal drains two power cells before you continue.' } }),
    chapter('spaceship', 3, 'The long way home', 'The emergency route is open. Check which systems still need an action.', [
      action('Complete the hull patch', 1, ['hull']), action('Stabilise the air supply', 1, ['oxygen']), action('Align the return route', 1, ['navigation']), action('Prepare a passive rescue beacon', 0, ['beacon']),
    ], ['A beacon offers a safe alternative if the full repair is not ready.', 'Navigation alone is not enough for a comfortable flight; check air and hull too.']),
    chapter('spaceship', 4, 'Homeward, together', 'Your ending depends on the hull, air, and navigation you actually restored. What is your final contribution?', [
      action('Inspect and seal the hull', 1, ['hull']), action('Finish the air reset', 1, ['oxygen']), action('Lock the home coordinates', 1, ['navigation']), action('Send the rescue beacon and wait safely', 0, ['beacon']),
    ], ['There is no extra reward for spending every cell.', 'Waiting together for rescue is a cooperative ending, not one player losing.']),
  ],
};
export function buildAdventureDeck(id: AdventureId = adventureIds[Math.floor(Math.random() * adventureIds.length)]): ChoiceScenario[] {
  if (!adventureIds.includes(id)) throw new Error('Choose an available adventure.');
  return chapters[id].map(scene => ({ ...scene, options: [...scene.options], adventure: scene.adventure ? { ...scene.adventure, actions: scene.adventure.actions.map(a => ({ ...a, grants: [...a.grants] })), clues: scene.adventure.clues ? [...scene.adventure.clues] : undefined } : undefined }));
}
export function adventureState(game: ChoiceGameState, through = game.round, includeCurrent = true) {
  const first = game.deck[0]?.adventure;
  if (!first) throw new Error('This adventure snapshot is missing its rules.');
  let resources = first.initial;
  const flags = new Set<string>();
  const kit: number[] = [];
  const log: { round: number; event: string; decisions: string[] }[] = [];
  for (let round = 0; round <= Math.min(through, game.deck.length - 1); round++) {
    const scene = game.deck[round].adventure;
    if (!scene) throw new Error('An adventure chapter is missing.');
    let event = '';
    if (scene.surprise) {
      const prepared = flags.has(scene.surprise.unless);
      event = prepared ? scene.surprise.prepared : scene.surprise.unprepared;
      if (!prepared) resources = Math.max(0, resources - scene.surprise.cost);
    }
    if (round === through && !includeCurrent) break;
    const pair = game.players.map(p => game.answers[round]?.[p.id]);
    if (!pair[0] || !pair[1]) break;
    if (scene.kit) {
      if (!pair[0].items || !pair[1].items) throw new Error('A saved survival wishlist is missing.');
      for (let i = 0; i < 3; i++) for (const answer of pair) {
        const item = answer.items![i];
        if (kit.length < 3 && !kit.includes(item)) kit.push(item);
      }
      kit.forEach(index => scene.actions[index].grants.forEach(flag => flags.add(flag)));
    } else {
      for (const answer of pair) {
        const selected = scene.actions[answer.choice];
        if (!selected) throw new Error('A saved adventure action is invalid.');
        resources -= selected.cost;
        selected.grants.forEach(flag => flags.add(flag));
      }
    }
    log.push({ round, event, decisions: pair.map(answer => scene.kit ? answer.items!.map(i => scene.actions[i].label).join(', ') : scene.actions[answer.choice].label) });
  }
  const definition = adventures.find(a => a.id === first.world);
  if (!definition) throw new Error('The saved adventure is unknown.');
  const achieved = definition.goal.every(flag => flags.has(flag));
  return { resources, flags: [...flags], kit, log, definition, achieved, ending: definition.ending[achieved ? 0 : 1] };
}
export function validAdventureAnswer(game: ChoiceGameState, answer: ChoiceAnswer) {
  const scene = game.deck[game.round]?.adventure;
  if (!scene || typeof answer.explanation !== 'string' || answer.explanation.length > 600) return false;
  if (scene.kit) return Array.isArray(answer.items) && answer.items.length === 3 && new Set(answer.items).size === 3
    && answer.items.every(i => Number.isInteger(i) && i >= 0 && i < scene.actions.length) && answer.choice === answer.items[0];
  const state = adventureState(game, game.round, false);
  const selected = scene.actions[answer.choice];
  return Number.isInteger(answer.choice) && !!selected && selected.cost <= Math.floor(state.resources / 2) && (!selected.requires || state.flags.includes(selected.requires));
}
