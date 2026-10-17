import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiscussionContinue } from './DiscussionContinue';

describe('Discussion countdown controls', () => {
  const render = (online: boolean, remaining: number, busy = false, waiting = false) =>
    renderToStaticMarkup(<DiscussionContinue online={online} remaining={remaining} busy={busy} waiting={waiting} onContinue={async () => {}} />);
  it('offers an enabled skip during online discussion and explains mutual readiness', () => {
    const markup = render(true, 180);
    expect(markup).toContain('Skip timer · I’m ready');
    expect(markup).toContain('suggested discussion time');
    expect(markup).toContain('only when both are ready');
    expect(markup).not.toContain('disabled=""');
    expect(render(true, 0)).toContain('I’m ready to continue');
  });
  it('disables repeated readiness and in-flight requests', () => {
    expect(render(true, 180, true)).toContain('disabled=""');
    expect(render(true, 180, false, true)).toContain('disabled=""');
    expect(render(true, 180, false, true)).toContain('Waiting for your partner');
  });
  it('preserves mandatory local/demo pauses and enables continuation after expiry', () => {
    expect(render(false, 30)).toContain('disabled=""');
    expect(render(false, 30)).toContain('minimum pause');
    expect(render(false, 0)).not.toContain('disabled=""');
    expect(render(false, 0)).toContain('We’re ready to continue');
  });
});
