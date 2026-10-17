import { ArrowDown, ArrowRight, ArrowUp, Brain, Check, Eye, Flower2, Heart, Shuffle, Sparkles } from 'lucide-react';
import { games, gameDefinition, type GameId } from './catalog';
import { FloralBorder, FloralSticker } from './BotanicalArt';
import { useEffect, useState } from 'react';

export function GameHub({ onPlay, onDemo, playlist, onToggle, onMove, onSelectAll, onStart, disabled = false }: {
  onPlay: (id: GameId) => void; onDemo: (id: GameId) => void; playlist: GameId[];
  onToggle: (id: GameId) => void; onMove: (index: number, direction: -1 | 1) => void;
  onSelectAll: () => void; onStart: () => void;
  disabled?: boolean;
}) {
  const [playMode, setPlayMode] = useState<'single' | 'playlist'>(playlist.length || location.hash === '#playlist' ? 'playlist' : 'single');
  const [reviewing, setReviewing] = useState(location.hash === '#playlist');
  const [gameIndex, setGameIndex] = useState(0);
  function reviewPlaylist(review: boolean) {
    setReviewing(review);
    if (matchMedia('(max-width: 700px)').matches) {
      history.pushState(null, '', `${location.pathname}${location.search}${review ? '#playlist' : '#games'}`);
      window.scrollTo({ top: 0 });
    }
  }
  useEffect(() => {
    const onHistory = () => { setReviewing(location.hash === '#playlist'); };
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);
  function chooseMode(mode: 'single' | 'playlist') { setPlayMode(mode); setReviewing(false); }
  return <section className={`game-hub ${reviewing ? 'phone-reviewing' : 'phone-browsing'}`} id="game-collection" aria-labelledby="hub-title">
    <header className="hub-heading"><div><div className="eyebrow">FIVE GAMES. JUST THE TWO OF YOU.</div><h2 id="hub-title">Your little playground.</h2><p>Play one for its own report, or build a playlist for one reflection on your whole night.</p></div><Flower2 className="hub-heading-flower" size={48} aria-hidden="true" /></header>
    <div className="play-mode-picker" role="group" aria-label="Choose how to play">
      <button aria-pressed={playMode === 'single'} onClick={() => chooseMode('single')}><strong><span className="desktop-mode-label">One game at a time</span><span className="phone-mode-label">One game</span></strong><span>Its own report</span></button>
      <button aria-pressed={playMode === 'playlist'} onClick={() => chooseMode('playlist')}><strong><span className="desktop-mode-label">A bunch of games together</span><span className="phone-mode-label">Game night</span></strong><span>One combined report</span></button>
    </div>
    {disabled && <p className="saved-session-hint">Resume or end your saved session above before starting another. You can still browse all five games.</p>}
    <div className="phone-game-switcher" aria-label="Browse games"><button disabled={gameIndex === 0} onClick={() => setGameIndex(i => i - 1)}>Previous</button><span aria-live="polite">Game {gameIndex + 1} of {games.length}</span><button disabled={gameIndex === games.length - 1} onClick={() => setGameIndex(i => i + 1)}>Next</button></div>
    <div className="hub-grid">{games.map((game, i) => {
      const selected = playlist.includes(game.id);
      return <article className={`hub-card hub-${game.color} ${i === gameIndex ? 'phone-current-game' : ''}`} key={game.id}>
        <FloralBorder />
        <div className="hub-card-top"><span className="hub-icon">{game.id === 'same-page' ? <Flower2 /> : game.id === 'same-brain' ? <Brain /> : game.id === 'pick-my-poison' ? <Shuffle /> : game.id === 'read-the-room' ? <Eye /> : <Heart />}</span><span>0{i + 1} / {game.category}</span><FloralSticker className="hub-sticker" color={game.color === 'lavender' ? '#b1afe8' : game.color === 'peach' ? '#efa763' : game.color === 'green' ? '#e7ba87' : '#eaa1be'} /></div>
        <h3>{game.title}</h3><p>{game.description}</p><p className="hub-report-note">{game.id === 'same-page' ? 'Report: perspectives, feelings & boundaries' : game.id === 'same-brain' ? 'Report: shared choices & prediction bonuses' : game.id === 'more-likely' ? 'Report: shared perceptions & surprises' : 'Report: actual choices & partner predictions'}</p>
        <div className="hub-quick-play"><h4>How to play</h4><p>{game.quickPlay}</p></div>
        <details><summary>Points & reflection</summary><p>{game.scoring}</p></details>
        {playMode === 'single' ? <div className="hub-card-actions"><button className="button primary" disabled={disabled} onClick={() => onPlay(game.id)}>Play this game <ArrowRight size={16} /></button><button className="text-button" disabled={disabled} onClick={() => onDemo(game.id)}><Sparkles size={14} /> Try a demo</button></div>
          : <button className="playlist-toggle" aria-pressed={selected} onClick={() => onToggle(game.id)}>{selected && <Check size={15} />}{selected ? `Game ${playlist.indexOf(game.id) + 1} in your playlist` : 'Add to game night'}</button>}
        <FloralBorder />
      </article>;
    })}</div>
    {playMode === 'playlist' && <section className="playlist-builder" aria-labelledby="playlist-title">
      <button className="text-button phone-review-back" onClick={() => reviewPlaylist(false)}>Back to game selection</button>
      <div className="eyebrow">MAKE A NIGHT OF IT</div><h3 id="playlist-title">Your game-night playlist.</h3><p>Choose two to five games above. Arrange the order, then play together for a combined relationship reflection at the end.</p>
      {playlist.length > 0 ? <ol className="playlist-order">{playlist.map((id, i) => <li key={id}><span className="playlist-number">{i + 1}</span><strong>{gameDefinition(id).title}</strong><button aria-label={`Move ${gameDefinition(id).title} earlier`} disabled={i === 0} onClick={() => onMove(i, -1)}><ArrowUp size={17} /></button><button aria-label={`Move ${gameDefinition(id).title} later`} disabled={i === playlist.length - 1} onClick={() => onMove(i, 1)}><ArrowDown size={17} /></button><button aria-label={`Remove ${gameDefinition(id).title} from playlist`} onClick={() => onToggle(id)}>Remove</button></li>)}</ol> : <div className="playlist-empty">Your next date night starts with a couple of little choices.</div>}
      <div className="playlist-actions"><button className="button primary" disabled={disabled || playlist.length < 2} onClick={onStart}>Set up game night{playlist.length > 0 ? ` · ${playlist.length} games` : ''}<ArrowRight size={16} /></button><button className="button cream" onClick={onSelectAll}>Pick all five</button></div>
    </section>}
    {playMode === 'playlist' && !reviewing && <div className="phone-playlist-review"><button className="button primary full-width" disabled={playlist.length < 2} onClick={() => reviewPlaylist(true)}>Review playlist · {playlist.length} games <ArrowRight size={16} /></button><p>{playlist.length < 2 ? 'Pick at least two games to continue.' : 'Arrange your games, then set up your night.'}</p></div>}
    <div className="hub-footnote">Private answers. Time to talk. Reports that invite curiosity, never judge your relationship.</div>
  </section>;
}
