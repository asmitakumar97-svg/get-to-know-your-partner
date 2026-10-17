import { Check } from 'lucide-react';
import { OTHER_ANSWER, WRITTEN_ANSWER_LIMIT } from './writtenAnswers';

export function OtherAnswer({ name, selected, value, onSelect, onChange }: {
  name: string; selected: number; value: string; onSelect: (value: number) => void; onChange: (text: string) => void;
}) {
  const active = selected === OTHER_ANSWER;
  return <>
    <label className={`choice ${active ? 'chosen' : ''}`}>
      <input type="radio" name={name} checked={active} onChange={() => onSelect(OTHER_ANSWER)} required />
      <span className="radio-mark">{active && <Check size={11} />}</span>
      <span>Other — write your answer</span>
    </label>
    {active && <label className="written-answer">Your own words
      <textarea name={`${name}-written`} value={value} onChange={event => onChange(event.target.value)} maxLength={WRITTEN_ANSWER_LIMIT} required aria-describedby={`${name}-written-help`} />
      <small id={`${name}-written-help`}>Required for Other · {value.length}/{WRITTEN_ANSWER_LIMIT}. Written responses are revealed together, not automatically marked as matching or different.</small>
    </label>}
  </>;
}
