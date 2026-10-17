import { Check, Flower2 } from 'lucide-react';
import { sections, sectionDescriptions, type Section } from './scenarios';
import type { GameState } from './game';

export function SectionPicker({ selected, onChange }: { selected: Section[]; onChange: (sections: Section[]) => void }) {
  return <fieldset className="section-picker"><legend>Pick your Same Page? sections</legend><p>Choose one or more. Each section has five questions, with time to talk after every reveal.</p>
    <div className="section-picker-grid">{sections.map(section => <label className={`section-option ${selected.includes(section) ? 'selected' : ''}`} key={section}>
      <input type="checkbox" checked={selected.includes(section)} onChange={() => onChange(selected.includes(section) ? selected.filter(item => item !== section) : sections.filter(item => item === section || selected.includes(item)))} />
      <span className="section-option-title">{section}<span>5 questions</span></span><span>{sectionDescriptions[section]}</span>
    </label>)}</div>
    <div className="section-picker-foot"><button type="button" className="text-button" onClick={() => onChange([...sections])}><Flower2 size={16} /> Choose all six</button><span role="status">{selected.length ? `${selected.length} ${selected.length === 1 ? 'section' : 'sections'} · ${selected.length * 5} questions` : 'Choose at least one section to begin.'}</span></div>
  </fieldset>;
}

export function SectionProgress({ game }: { game: GameState }) {
  const active = game.deck[game.round]?.category;
  return <section className="section-progress" aria-label="Same Page sections"><div className="eyebrow">YOUR SAME PAGE? SECTIONS</div><ol>{sections.map(section => {
    const deck = game.deck.filter(scenario => scenario.category === section);
    const answered = game.deck.filter((scenario, index) => scenario.category === section && index < game.round).length;
    return <li key={section} aria-current={active === section ? 'step' : undefined} className={!deck.length ? 'section-not-selected' : ''}>
      <span>{deck.length > 0 && answered === deck.length && <Check size={13} />}{section}</span><small>{deck.length ? `${deck.length} questions` : 'Not selected'}</small>
    </li>;
  })}</ol></section>;
}
