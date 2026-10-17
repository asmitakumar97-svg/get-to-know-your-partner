import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameHub } from './GameHub';
import { games, type GameId } from './catalog';

const noOp = () => {};

describe('Game library card decoration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['single', 'playlist'])('keeps %s cards free of large illustrations and top flower stickers', mode => {
    vi.stubGlobal('location', { hash: '' });
    const playlist: GameId[] = mode === 'playlist' ? ['same-page', 'if-i-were-you'] : [];
    const markup = renderToStaticMarkup(<GameHub playlist={playlist} onPlay={noOp} onDemo={noOp} onToggle={noOp} onMove={noOp} onSelectAll={noOp} onStart={noOp} />);

    expect(markup).not.toContain('relationship-art');
    expect(markup).not.toContain('hub-sticker');
    expect(markup.match(/class="hub-icon"/g)).toHaveLength(games.length);
    expect(markup.match(/class="card-floral-border"/g)).toHaveLength(games.length * 2);
    for (const game of games) expect(markup).toContain(game.title.replace(/&/g, '&amp;').replace(/'/g, '&#x27;'));
    expect(markup.match(mode === 'single' ? /Try a demo/g : /class="playlist-toggle"/g)).toHaveLength(games.length);
  });
});
