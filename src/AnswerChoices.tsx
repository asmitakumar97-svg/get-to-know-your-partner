import { Check } from 'lucide-react';
import { OtherAnswer } from './OtherAnswer';

export function AnswerChoices({ title, options, descriptions, selected, onChange, name, customValue = '', onCustomChange }: {
  title: string; options: readonly string[]; descriptions?: readonly string[]; selected: number; onChange: (n: number) => void; name: string;
  customValue?: string; onCustomChange?: (text: string) => void;
}) {
  return <fieldset className="choices"><legend>{title}</legend><div>{options.map((option, i) =>
    <label className={`choice ${selected === i ? 'chosen' : ''}`} key={option}>
      <input type="radio" name={name} checked={selected === i} onChange={() => onChange(i)} required />
      <span className="radio-mark">{selected === i && <Check size={11} />}</span>
      <span className="choice-copy"><span>{option}</span>{descriptions?.[i] && <small>{descriptions[i]}</small>}</span>
    </label>,
  )}{onCustomChange && <OtherAnswer name={name} selected={selected} value={customValue} onSelect={onChange} onChange={onCustomChange} />}</div></fieldset>;
}
