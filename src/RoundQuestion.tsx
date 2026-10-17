import { FloralSticker } from './BotanicalArt';
import type { Scenario } from './scenarios';

export function RoundQuestion({ scenario, note, color }: {
  scenario: Scenario; note?: string; color?: string;
}) {
  return <div className="scenario-card">
    <FloralSticker className="scenario-sticker" color={color} />
    <h2>{scenario.text}</h2>
    {note && <span className="muted">{note}</span>}
  </div>;
}
