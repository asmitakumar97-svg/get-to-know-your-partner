import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const theme = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
function colour(name: string): string {
  const value = theme.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
  if (!value) throw new Error(`Missing theme colour ${name}`);
  return value.startsWith('var(') ? colour(value.slice(4, -1)) : value;
}
function luminance(hex: string) {
  const values = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values.reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
}
function contrast(first: string, second: string) {
  const [dark, light] = [luminance(colour(first)), luminance(colour(second))].sort((a, b) => a - b);
  return (light + .05) / (dark + .05);
}

describe('Reference colour palette', () => {
  it('retains all five supplied brand swatches', () => {
    expect(['--brand-pink', '--brand-sage', '--brand-yellow', '--brand-blush', '--brand-forest'].map(colour))
      .toEqual(['#cd6184', '#97a273', '#ffbd59', '#ffecf2', '#254117']);
  });
  it.each(['--brand-blush', '--surface', '--surface-rose', '--surface-sage', '--surface-yellow'])('keeps normal text readable on %s', background => {
    for (const text of ['--text-primary', '--text-muted', '--rose-ink']) expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps primary buttons, dark navigation, highlights and control outlines accessible', () => {
    expect(contrast('--brand-blush', '--brand-forest')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('--brand-forest', '--brand-yellow')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('--control-line', '--surface')).toBeGreaterThanOrEqual(3);
  });
  it('defines every colour token referenced by the existing stylesheets', () => {
    const files = ['styles.css', 'card-deck.css', 'hub.css', 'playground.css', 'theme.css', 'relationshipGames.css'];
    const css = files.map(file => readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')).join('\n');
    const definitions = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
    for (const match of css.matchAll(/var\((--[\w-]+)/g)) expect(definitions.has(match[1]), `Undefined ${match[1]}`).toBe(true);
  });
});
