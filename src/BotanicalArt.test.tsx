import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConnectionMark } from './BotanicalArt';

describe('Intertwined-heart brand', () => {
  it('uses the shared vector as a decorative image without repeating the home link name', () => {
    const markup = renderToStaticMarkup(<ConnectionMark />);
    expect(markup).toMatch(/src="(?:data:image\/svg\+xml,|[^"]*connection-mark[^"]*\.svg)/);
    expect(markup).toContain('alt=""');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('draggable="false"');
    expect(markup).toContain('width="64" height="64"');
  });

  it('uses the same original vector for the browser icon and supports offline SVG assets', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('rel="icon" type="image/svg+xml" href="/src/assets/connection-mark.svg"');
    const worker = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');
    const favicon = '<link rel="icon" href="./assets/connection-mark-hash.svg">';
    const match = worker.match(/html\.matchAll\((\/.*\/g)\)/);
    expect(match).not.toBeNull();
    const pattern = match![1];
    const assetPattern = new RegExp(pattern.slice(1, -2), 'g');
    expect([...favicon.matchAll(assetPattern)].map(asset => asset[1])).toEqual(['./assets/connection-mark-hash.svg']);
  });
});
