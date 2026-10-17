import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Heart, Home, Sparkles, Users, Link as LinkIcon, Check, LockKeyhole, MessageCircle, Globe2, X, Copy, ChevronRight, Flower2, RotateCcw, ShieldCheck, LogOut } from 'lucide-react';
import { alignment, createGame, emotions, isChoiceGame, readyForNext, scenarioFactors, scenarioVerdicts, submitAnswer, validAnswer, type Answer, type ChoiceAnswer, type SessionState } from './game';
import { advanceNightRoom, createNightRoom, createRoom, generateQuestions, getRoom, identity, joinRoom, leaveRoom, onlineConfigured, sendAnswer, sendReady, sendReflection, sendSkip, sendQuestionSwitch, startRoom, supabase } from './backend';
import { CompatibilityReport } from './CompatibilityReport';
import { QuickDiscussion } from './QuickDiscussion';
import { RoundQuestion } from './RoundQuestion';
import { AnswerChoices as Choices } from './AnswerChoices';
import { ConnectionMark, FloralSticker } from './BotanicalArt';
import { GameHub } from './GameHub';
import { PartyGame } from './PartyGame';
import { createChoiceGame, demoChoiceAnswer, submitChoiceAnswer, saveReflection, skipSensitiveQuestion } from './party';
import { games, gameDefinition, isGameId, partyDecks, type GameId } from './catalog';
import { advanceNight, createNight } from './night';
import { NightArchive, NightProgress, NightRecap } from './NightReport';
import { selectedSectionsFromDeck, type Section } from './scenarios';
import { prepareQuestions, rememberQuestions, type PlayRequest } from './freshQuestions';
import { samePageReasons } from '../supabase/functions/_shared/questions';
import { isRelationshipGame, type GameReflection } from './relationshipGames';
import { adventures, type AdventureId } from './adventures';
import { RelationshipArt } from './RelationshipArt';
import { SwitchQuestion } from './SwitchQuestion';
import { chooseReplacement, switchQuestion } from './questionSwitching';
import { OTHER_ANSWER, responseLabel } from './writtenAnswers';
import './styles.css';
import './card-deck.css';
import './hub.css';
import './playground.css';
import './theme.css';
import './relationshipGames.css';

const SAVE_KEY = 'same-page-session-v1';
const emptyAnswer = (): Answer => ({ verdict: -1, emotion: -1, factor: -1, explanation: '' });
type Setup = 'local' | 'online' | 'join' | null;
type HomeScreen = 'home' | 'about' | 'games';
const screenFromHash = (): HomeScreen => location.hash === '#about' ? 'about' : ['#games', '#game-collection', '#playlist'].includes(location.hash) ? 'games' : 'home';

function App() {
  const [game, setGame] = useState<SessionState | null>(null);
  const [showHome, setShowHome] = useState(location.hash !== '#play');
  const [homeScreen, setHomeScreen] = useState<HomeScreen>(screenFromHash);
  const [restoring, setRestoring] = useState(true);
  const [selectedGame, setSelectedGame] = useState<GameId>('same-page');
  const [playlist, setPlaylist] = useState<GameId[]>([]);
  const [settingNight, setSettingNight] = useState(false);
  const [myId, setMyId] = useState('');
  const [setup, setSetup] = useState<Setup>(new URLSearchParams(location.search).has('room') ? 'join' : null);
  const [name, setName] = useState('');
  const [partner, setPartner] = useState('');
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') ?? '');
  const [count, setCount] = useState(5);
  const [category, setCategory] = useState('');
  const [adventure, setAdventure] = useState<AdventureId>('stranded');
  const [seconds, setSeconds] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [answer, setAnswer] = useState<Answer>(emptyAnswer);
  const [unlocked, setUnlocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const [partnerHere, setPartnerHere] = useState(false);
  const syncSequence = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;
  const curatedConversation = settingNight ? playlist.some(id => id === 'if-i-were-you' || id === 'when-things-get-hard') : selectedGame === 'if-i-were-you' || selectedGame === 'when-things-get-hard';
  useEffect(() => { setCategory(''); }, [selectedGame]);
  useEffect(() => { if (curatedConversation) setCount(current => Math.min(current, 30)); }, [curatedConversation]);

  function applyState(next: SessionState | null) {
    setGame(previous => previous?.id === next?.id && (previous?.revision ?? 0) > (next?.revision ?? 0) ? previous : next);
  }

  function persist(next: SessionState | null, playerId = myId) {
    if (next && gameRef.current?.id !== next.id) {
      resumeGame();
      try { rememberQuestions(next); }
      catch { setError('Your game is ready, but question history could not be saved. Repeat avoidance may not work on the next visit.'); }
    }
    applyState(next);
    try {
      if (next) localStorage.setItem(SAVE_KEY, JSON.stringify(next.mode === 'online' ? { onlineId: next.id, myId: playerId } : { game: next, myId: playerId }));
      else localStorage.removeItem(SAVE_KEY);
    } catch {
      setError('Browser storage is unavailable. Your game works, but this device cannot restore it after a refresh.');
    }
  }

  function goHome() {
    openHomeScreen('home');
  }

  function openHomeScreen(screen: HomeScreen) {
    setHomeScreen(screen);
    setShowHome(true); setSetup(null); setUnlocked(false); setNotice('');
    history.pushState(null, '', `${location.pathname}${location.search}#${screen}`);
    window.scrollTo({ top: 0 });
  }

  function resumeGame() {
    setShowHome(false); setUnlocked(false);
    history.replaceState(null, '', `${location.pathname}${location.search}#play`);
    window.scrollTo({ top: 0 });
  }

  async function sync(id: string) {
    const sequence = ++syncSequence.current;
    try {
      const next = await getRoom(id);
      if (sequence === syncSequence.current && gameRef.current?.id === id) {
        applyState(next); setConnected(true); setError('');
      }
    } catch (e) {
      if (sequence === syncSequence.current && gameRef.current?.id === id) { setConnected(false); setError(message(e)); }
    }
  }

  useEffect(() => {
    const onHistory = () => {
      if (!['#home', '#about', '#games', '#game-collection', '#playlist', '#play', ''].includes(location.hash)) return;
      setHomeScreen(screenFromHash());
      setShowHome(location.hash !== '#play');
      setSetup(null); setUnlocked(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onHistory);
    window.addEventListener('hashchange', onHistory);
    return () => { window.removeEventListener('popstate', onHistory); window.removeEventListener('hashchange', onHistory); };
  }, []);

  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(e => setError(`Offline installation failed: ${message(e)}. Please keep this page open or try again with connectivity.`));
    }
    let cancelled = false;
    async function restore() {
      try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (!saved) return;
        const value = JSON.parse(saved);
        if (value.onlineId) {
          const id = await identity();
          const next = await getRoom(value.onlineId);
          if (!cancelled) { setMyId(id); setGame(next); }
        } else if (value.game?.id && ['local', 'demo'].includes(value.game.mode) && Array.isArray(value.game.deck) && isGameId(value.game.gameType ?? 'same-page')) {
          if (!cancelled) { setMyId(value.myId); setGame(value.game); }
        } else throw new Error('The saved game could not be restored. Please start a new game.');
      } catch (e) { if (!cancelled) setError(message(e)); }
      finally { if (!cancelled) setRestoring(false); }
    }
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const handoffIndex = game?.mode === 'local' ? game.submitted.length : 0;
  const questionId = game?.deck[game.round]?.id;
  useEffect(() => { setAnswer(emptyAnswer()); setUnlocked(false); }, [game?.id, game?.gameType, game?.round, questionId, handoffIndex]);
  const previousQuestion = useRef<{ game: string; round: number; question: string } | null>(null);
  useEffect(() => {
    const previous = previousQuestion.current;
    previousQuestion.current = game && questionId ? { game: game.id, round: game.round, question: questionId } : null;
    if (game && questionId && previous?.game === game.id && previous.round === game.round && previous.question !== questionId) {
      setNotice('Question switched for both of you. Unsent selections have been cleared.');
      try { rememberQuestions(game); }
      catch { setError('The question was switched, but question history could not be saved. Repeat avoidance may not work on the next visit.'); }
    }
  }, [game, questionId]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [game?.id, game?.round, game?.phase, handoffIndex]);

  useEffect(() => {
    if (!setup) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setSetup(null);
      if (event.key !== 'Tab') return;
      const elements = document.querySelector('[role="dialog"]')?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, a[href]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); if (previousFocus instanceof HTMLElement) previousFocus.focus(); };
  }, [setup, busy]);

  useEffect(() => {
    if (!game || game.mode !== 'online' || !supabase) return;
    const id = game.id;
    void sync(id);
    const channel = supabase.channel(`room-${id}`, { config: { presence: { key: myId } } })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${id}` }, () => { void sync(id); })
      .on('presence', { event: 'sync' }, () => setPartnerHere(Object.keys(channel.presenceState()).some(key => key !== myId)))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { setConnected(true); void channel.track({ online: true }); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnected(false);
      });
    const timer = setInterval(() => { void sync(id); }, 3000);
    const onVisible = () => { if (!document.hidden) void sync(id); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); void supabase?.removeChannel(channel); };
  }, [game?.id, game?.mode, myId]);

  async function act(work: () => Promise<void> | void) {
    if (busy) return;
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  async function begin(event: React.FormEvent) {
    event.preventDefault();
    await act(async () => {
      if (restoring) throw new Error('Please wait while your saved session is restored.');
      if (game) throw new Error('Resume or end your saved session before starting another game.');
      const prepared = setup === 'join' ? null : await prepareForPlay(settingNight ? playlist : [selectedGame], count);
      const entry = prepared?.entries[0];
      if (setup === 'local') {
        if (!entry) throw new Error('Your questions could not be prepared.');
        const next = settingNight ? createNight('local', [name.trim(), partner.trim()], playlist, count, seconds, undefined, prepared?.entries) : entry.gameType === 'same-page'
          ? createGame('local', [name.trim(), partner.trim()], count, seconds, undefined, entry.deck)
          : createChoiceGame(entry.gameType, 'local', [name.trim(), partner.trim()], count, seconds, entry.deck);
        setMyId('player-0'); persist(next, 'player-0'); setSetup(null); setNotice(prepared?.notice ?? '');
      } else {
        const id = await identity();
        const next = setup === 'join' ? await joinRoom(code, name.trim()) : settingNight
          ? await createNightRoom(name.trim(), playlist, count, seconds, undefined, prepared?.entries) : await createRoom(name.trim(), count, seconds, selectedGame, undefined, entry?.deck);
        setMyId(id); persist(next, id); setSetup(null); setNotice(prepared?.notice ?? '');
      }
    });
  }

  function prepareForPlay(ids: GameId[], rounds: number, selected?: readonly Section[], world = adventure) {
    const requests: PlayRequest[] = ids.map(id => ({ game: id, count: id === 'same-page' && selected ? selected.length * 5 : rounds, ...(id === 'same-page' && selected ? { sections: [...selected] } : {}), ...(id === 'us-against-the-world' ? { adventure: world } : {}), ...(!settingNight && category && ['if-i-were-you', 'when-things-get-hard'].includes(id) ? { category } : {}) }));
    return prepareQuestions(requests, onlineConfigured && navigator.onLine ? generateQuestions : null);
  }

  async function demo(id: GameId = 'same-page') {
    if (game) { setNotice('Resume or end your saved session before starting another game.'); return; }
    setNotice(''); setError(''); setSettingNight(false);
    setSelectedGame(id);
    await act(async () => {
      const prepared = await prepareQuestions([{ game: id, count: 3 }], null);
      const entry = prepared.entries[0];
      const next = entry.gameType === 'same-page' ? createGame('demo', ['You', 'Alex (demo)'], 3, 30, undefined, entry.deck) : createChoiceGame(entry.gameType, 'demo', ['You', 'Alex (demo)'], 3, 30, entry.deck);
      setMyId('player-0'); persist(next, 'player-0'); setNotice(prepared.notice);
    });
  }

  function openSetup(id: GameId, mode: Setup) {
    if (game) { setNotice('Resume or end your saved session before starting another game.'); return; }
    setSettingNight(false); setSelectedGame(id); setError(''); setNotice(''); setSetup(mode);
  }
  function openNightSetup() {
    if (game) { setNotice('Resume or end your saved session before starting another game night.'); return; }
    setSettingNight(true); setError(''); setNotice(''); setSetup('local');
  }
  function togglePlaylist(id: GameId) { setPlaylist(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]); }
  function movePlaylist(index: number, direction: -1 | 1) {
    setPlaylist(previous => {
      const next = [...previous], target = index + direction;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  const definition = gameDefinition(game?.gameType ?? selectedGame);
  const setupDefinition = gameDefinition(selectedGame);
  const setupRounds = settingNight ? playlist.reduce((sum, id) => sum + (id === 'us-against-the-world' ? 5 : count), 0) : selectedGame === 'us-against-the-world' ? 5 : count;
  useEffect(() => { document.title = `${game && !showHome ? game.night?.finished ? 'Our game-night reflection' : definition.title : homeScreen === 'about' ? 'About the Playground' : homeScreen === 'games' ? 'Choose your games' : 'The Playroom'} — Get to Know Your Partner`; }, [definition.title, game?.id, game?.night?.finished, showHome, homeScreen]);
  const activeId = game?.mode === 'local' ? game.players[game.submitted.length === 0 ? 0 : 1]?.id : myId;
  const activePlayer = game?.players.find(p => p.id === activeId);
  const scenario = game?.deck[game.round];
  const remaining = Math.max(0, Math.ceil(((game?.discussionUntil ?? 0) - now) / 1000));
  const departed = game?.players.some(p => p.left);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!game || isChoiceGame(game) || !activeId) return;
    await act(async () => {
      if (game.mode === 'online') persist(await sendAnswer(game.id, game.round, answer, game.night?.index, game.deck[game.round].id));
      else {
        let next = submitAnswer(game, activeId, answer);
        if (game.mode === 'demo') {
          next = submitAnswer(next, 'player-1', { verdict: game.round % 2 ? 2 : 1, emotion: 1, factor: 1, explanation: 'I would want to understand the intention and talk about what feels comfortable for both of us.' });
        }
        persist(next);
      }
    });
  }

  async function submitParty(answer: ChoiceAnswer) {
    await act(async () => {
      if (!game || !isChoiceGame(game) || !activeId) throw new Error('This game is not accepting a choice right now.');
      if (game.mode === 'online') persist(await sendAnswer(game.id, game.round, answer, game.night?.index, game.deck[game.round].id));
      else {
        let next = submitChoiceAnswer(game, activeId, answer);
        if (game.mode === 'demo') next = submitChoiceAnswer(next, 'player-1', demoChoiceAnswer(game));
        persist(next);
      }
    });
  }
  async function skipQuestion() {
    await act(async () => {
      if (!game || !isChoiceGame(game) || !activeId) throw new Error('There is no active question to skip.');
      persist(game.mode === 'online' ? await sendSkip(game.id, game.round, game.night?.index, game.deck[game.round].id) : skipSensitiveQuestion(game, activeId));
    });
  }
  async function replaceQuestion() {
    await act(async () => {
      if (!game || !activeId) throw new Error('There is no active question to switch.');
      persist(game.mode === 'online'
        ? await sendQuestionSwitch(game.id, game.round, game.deck[game.round].id, chooseReplacement(game), game.night?.index)
        : switchQuestion(game, activeId));
    });
  }
  async function reflect(playerId: string, note: GameReflection) {
    await act(async () => {
      if (!game || !isChoiceGame(game)) throw new Error('There is no revealed game to reflect on.');
      if (game.mode === 'online' && playerId !== myId) throw new Error('You can only save your own reflection.');
      persist(game.mode === 'online' ? await sendReflection(game.id, game.round, note, game.night?.index) : saveReflection(game, playerId, note));
    });
  }

  async function replay() {
    if (!game) return;
    await act(async () => {
      setNotice('');
      if (game.night) {
        const ids = game.night.playlist.map(entry => entry.gameType);
        const partyEntry = game.night.playlist.find(entry => entry.gameType !== 'same-page' && entry.gameType !== 'us-against-the-world') ?? game.night.playlist.find(entry => entry.gameType === 'same-page');
        if (!partyEntry) throw new Error('Your playlist needs another game before replaying.');
        const samePageEntry = game.night.playlist.find(entry => entry.gameType === 'same-page');
        const replaySections = samePageEntry ? selectedSectionsFromDeck(samePageEntry.deck) : undefined;
        const prepared = await prepareForPlay(ids, partyEntry.deck.length, replaySections);
        persist(game.mode === 'online'
          ? await createNightRoom(game.players.find(p => p.id === myId)?.name ?? 'Player', ids, partyEntry.deck.length, game.discussionSeconds, replaySections, prepared.entries)
          : createNight(game.mode, game.players.map(p => p.name), ids, partyEntry.deck.length, game.discussionSeconds, replaySections, prepared.entries));
        setNotice(prepared.notice);
      } else {
        const selected = isChoiceGame(game) ? undefined : selectedSectionsFromDeck(game.deck);
        const prepared = await prepareForPlay([game.gameType ?? 'same-page'], game.deck.length, selected, isChoiceGame(game) ? game.deck[0].adventure?.world ?? adventure : adventure);
        const entry = prepared.entries[0];
        persist(game.mode === 'online'
          ? await createRoom(game.players.find(p => p.id === myId)?.name ?? 'Player', game.deck.length, game.discussionSeconds, game.gameType ?? 'same-page', selected, entry.deck)
          : entry.gameType === 'same-page'
            ? createGame(game.mode, game.players.map(p => p.name), game.deck.length, game.discussionSeconds, selected, entry.deck)
            : createChoiceGame(entry.gameType, game.mode, game.players.map(p => p.name), game.deck.length, game.discussionSeconds, entry.deck));
        setNotice(prepared.notice);
      }
    });
  }

  async function nextRound() {
    if (!game) return;
    await act(async () => {
      if (game.mode === 'online') persist(await sendReady(game.id, game.round, game.night?.index));
      else {
        let next = readyForNext(game, game.players[0].id);
        next = readyForNext(next, game.players[1].id);
        persist(next);
      }
    });
  }

  async function nextGame() {
    if (!game?.night) return;
    const index = game.night.index;
    await act(async () => {
      if (game.mode === 'online') persist(await advanceNightRoom(game.id, index));
      else {
        let next = advanceNight(game, game.players[0].id, index);
        next = advanceNight(next, game.players[1].id, index);
        persist(next);
      }
    });
  }

  async function exit() {
    if (!game) return;
    await act(async () => {
      if (game.mode === 'online' && !game.players.find(p => p.id === myId)?.left) {
        try {
          await leaveRoom(game.id);
        } catch (e) {
          setError(`You have left on this device, but we could not notify the room: ${message(e)}. Your partner may still see the session as open.`);
        }
      }
      syncSequence.current++;
      persist(null); setShowHome(true); setHomeScreen('home'); setUnlocked(false); setNotice('This device has left the session. Locally saved game data has been removed.');
      history.replaceState(null, '', location.pathname);
    });
  }

  async function invite() {
    if (!game) return;
    await act(async () => {
      const link = new URL(location.href); link.search = ''; link.searchParams.set('room', game.code);
      await navigator.clipboard.writeText(link.toString());
      setNotice('Invite link copied. Send it to your person.');
    });
  }

  return <div className={`app-shell phone-screen-${homeScreen} ${game && !showHome ? 'phone-in-session' : ''}`}>
    <aside className="sidebar">
      <a className="brand" href={`${import.meta.env.BASE_URL}#home`} aria-label="Get to Know Your Partner home" onClick={e => { e.preventDefault(); goHome(); }}>
        <span className="brand-mark"><ConnectionMark /></span>
        <span className="brand-wordmark"><span>get to know</span><strong>your partner<span className="brand-period">.</span></strong></span>
      </a>
      <div className="sidebar-label">A LITTLE CLOSER, EVERY ROUND</div>
      <nav aria-label="Main navigation" className="desktop-navigation">
        <button className={`nav-item ${!game || showHome ? 'selected' : ''}`} onClick={goHome}><span><Home size={19} /> Home · All games</span><span className="tiny-dot" /></button>
        <a className="nav-item" href="#our-promise" onClick={e => { if (game && !showHome) { e.preventDefault(); setNotice('Not a test or a verdict on your relationship. Different answers do not make either of you wrong. Stay curious and kind; you can end the session at any time.'); } }}><span><Heart size={19} /> Our little promise</span></a>
      </nav>
      <div className="sidebar-note"><Flower2 size={36} strokeWidth={1.2} /><p>Good relationships<br />start with <em>good<br />conversations.</em></p><span>No perfect answers needed.</span></div>
      <div className="sidebar-footer"><span className="status-dot" /> Made for your kind of love.</div>
    </aside>

    <div className="main-column">
      <header className="topbar"><span className="breadcrumb">The playroom <ChevronRight size={14} /> <strong>{game && !showHome ? definition.title : 'All games'}</strong></span><span className="top-note"><LockKeyhole size={13} /> Just the two of you</span></header>
      <main>
        {error && <div role="alert" className="alert error"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={17} /></button></div>}
        {notice && <div role="status" className="alert"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={17} /></button></div>}

        {!game || showHome ? <>
          {game && <section className="home-session" aria-labelledby="saved-session-title"><div><h2 id="saved-session-title">Your session is still here.</h2><p>{game.players.map(player => player.name).join(' & ')} · {game.night ? 'Game-night playlist' : definition.title}. Submitted answers and completed reports stay saved. Returning home does not leave an online room or pause its timer.</p><p>Resume below, or save any reports you want to keep before ending this session to start another.</p></div><div className="home-session-actions"><button className="button primary" onClick={resumeGame}>{game.phase === 'recap' && (!game.night || game.night.finished) ? 'Return to report' : 'Resume session'}<ArrowRight size={16} /></button><button className="button cream" disabled={busy} onClick={() => void exit()}>End session to start another</button></div></section>}
          <section className="playground-hero">
            <div className="playground-intro"><div className="eyebrow">A PLAYGROUND FOR TWO</div><h1>A little play.<br />A little more <em>us.</em></h1><p>More ways to laugh, get curious, and understand your person. Same sofa or miles apart.</p><div className="playground-hero-actions"><button className="button primary" onClick={() => { openHomeScreen('games'); if (!matchMedia('(max-width: 700px)').matches) requestAnimationFrame(() => document.getElementById('game-collection')?.scrollIntoView()); }}>Choose how to play <ArrowRight size={16} /></button><button className="button cream" disabled={restoring || Boolean(game) || busy} onClick={() => openSetup('same-page', 'join')}><LinkIcon size={16} /> Join a room</button></div><button className="text-button phone-about-link" onClick={() => openHomeScreen('about')}>New here? Meet the playground <ArrowRight size={16} /></button><p className="playground-report-note">One game, one private report. A whole playlist, one shared reflection.</p></div>
            <aside className="playground-guide" aria-labelledby="playground-guide-title">
              <h2 id="playground-guide-title">Before you play</h2>
              <p className="phone-about-description">A playful space to discover your shared tastes, understand your differences, and start conversations. No perfect answers needed.</p>
              <ul>
                <li><Users size={21} aria-hidden="true" /><div><h3>Together or miles apart</h3><p>Pass one device in person, or choose online play and invite your partner by link or room code.</p></div></li>
                <li><MessageCircle size={21} aria-hidden="true" /><div><h3>Answer privately. Then talk.</h3><p>Answers stay hidden until you both submit. Every round includes time to discuss the reveal.</p></div></li>
                <li><Sparkles size={21} aria-hidden="true" /><div><h3>Finish with a reflection</h3><p>One game gets its own report. A playlist gets one combined report after all games, not a relationship rating.</p></div></li>
              </ul>
              <button className="button primary phone-about-link" onClick={() => openHomeScreen('games')}>Explore the games <ArrowRight size={16} /></button>
            </aside>
          </section>
          {restoring ? <div className="alert" role="status">Checking for your saved session…</div> : <GameHub onPlay={id => openSetup(id, 'local')} onDemo={demo} playlist={playlist} onToggle={togglePlaylist} onMove={movePlaylist} onSelectAll={() => setPlaylist(games.map(item => item.id))} onStart={openNightSetup} disabled={Boolean(game) || busy} />}
          <section id="our-promise" className="promise"><FloralSticker className="promise-sticker" /><div><h3>Not a test. Not a verdict on your relationship.</h3><p>No points, no competition. Just curiosity. Different answers never make either of you wrong.</p></div></section>
          <footer className="page-footer"><span>Less right or wrong. More “tell me more.”</span><span>Made with care, for connection <Heart size={12} /></span></footer>
        </> : <section className={`play-area play-${game.gameType ?? 'same-page'}`}>
          <div className="play-top"><div><div className="eyebrow">{game.mode === 'demo' ? 'A PRACTICE DATE · SIMULATED PARTNER' : game.mode === 'local' ? 'SIDE BY SIDE · ONE DEVICE' : 'YOUR PRIVATE ROOM'}</div><h1 className="play-title">{game.night?.finished ? 'Our game-night reflection' : definition.title}</h1></div><div className="play-navigation"><button className="button cream" onClick={goHome}><Home size={16} /> Home · All games</button><button className="icon-button" onClick={() => void exit()} disabled={busy} aria-label="Leave and end this session"><LogOut size={19} /></button></div></div>
          <div className="session-bar"><span><Users size={15} /> {game.players.map(p => p.name).join(' & ')}</span>{game.mode === 'online' ? <span><span className={`status-dot ${connected ? '' : 'offline'}`} />{connected ? partnerHere ? 'Both connected' : 'Connected · partner away' : 'Reconnecting…'} · {game.code}</span> : <span><LockKeyhole size={13} /> {game.mode === 'local' ? 'Pass the device, not the answers' : 'Demo answers are simulated'}</span>}</div>
          <NightProgress game={game} />
          {departed && game.phase === 'recap' && <div className="soft-note">Your partner has left. Your completed reflection is still available in this room until it expires.</div>}
          {departed && game.phase !== 'recap' ? <div className="center-card"><Heart size={38} /><h2>Your partner has left the room.</h2><p>This session is paused. Start a new room whenever you are both ready.</p><NightArchive game={game} /><button className="button primary" onClick={() => void exit()}>Back to the playroom</button></div>
          : game.phase === 'lobby' ? <div className="center-card"><div className="round-icon"><LinkIcon /></div><h2>A little invitation to connect.</h2><p>Share this room code or send your private invite link.</p><div className="room-code">{game.code}</div><button className="button cream" onClick={() => void invite()}><Copy size={16} /> Copy invite link</button><div className="lobby-players">{game.players.map(p => <span key={p.id}><span className="status-dot" /> {p.name} is here</span>)}{game.players.length < 2 && <span className="muted">Waiting for your person…</span>}</div>{game.players[0].id === myId ? <button className="button primary" disabled={game.players.length < 2 || busy} onClick={() => void act(async () => persist(await startRoom(game.id)))}>We’re ready. Let’s play <ArrowRight size={16} /></button> : <p>Your partner can start when you are both ready.</p>}</div>
          : game.phase === 'recap' && game.night ? <NightRecap game={game} myId={myId} busy={busy} onNext={nextGame} onReplay={replay} onExit={exit} />
          : isChoiceGame(game) ? <PartyGame game={game} myId={myId} busy={busy} now={now} onSubmit={submitParty} onContinue={nextRound} onReplay={replay} onExit={exit} onSkip={skipQuestion} onReflect={reflect} onSwitch={replaceQuestion} />
          : game.phase === 'recap' ? <>
            <CompatibilityReport game={game} />
            <div className="recap-actions">
              <button className="button primary" disabled={busy} onClick={() => void replay()}><RotateCcw size={16} /> Play again{game.mode === 'online' ? ' in a new room' : ''}</button>
              <button className="button cream" onClick={() => void exit()} disabled={busy}>Back to playroom</button>
            </div>
          </>
          : scenario && <>
            <div className="round-progress"><span>ROUND {String(game.round + 1).padStart(2, '0')} <span className="muted">OF {String(game.deck.length).padStart(2, '0')}</span></span></div><div className="progress-track"><div style={{ width: `${((game.round + 1) / game.deck.length) * 100}%` }} /></div>
            <RoundQuestion scenario={scenario} />
            <SwitchQuestion game={game} busy={busy} onSwitch={replaceQuestion} />
            {game.phase === 'answering' ? game.mode === 'online' && game.submitted.includes(myId) ? <div className="center-card"><LockKeyhole size={32} /><h2>Your perspective is tucked away.</h2><p>Waiting for your partner. Both answers will reveal together.</p><span className="soft-note">Take a breath. There’s no rush.</span></div>
              : game.mode === 'local' && !unlocked ? <div className="handoff-card"><div className="round-icon"><Users /></div><h2>{game.submitted.length ? `Pass the device to ${activePlayer?.name}.` : `${activePlayer?.name}, you’re up first.`}</h2><p>{game.submitted.length ? 'The first answer is saved and hidden. Take a moment to answer on your own.' : 'Answer privately, then hand the device to your person. No peeking!'}</p><button className="button primary" onClick={() => setUnlocked(true)}>I’m {activePlayer?.name}. Let’s answer <ArrowRight size={16} /></button><small>On a shared device, privacy is based on trust. Answers are stored locally.</small></div>
              : <form className="answer-form" onSubmit={submit}><div className="answer-heading"><span><span className="status-dot" /> {activePlayer?.name}’s perspective</span><span><LockKeyhole size={12} /> Hidden until you both submit</span></div><Choices title="What’s your take?" options={scenarioVerdicts(scenario)} selected={answer.verdict} onChange={verdict => setAnswer({ ...answer, verdict, customVerdict: verdict === OTHER_ANSWER ? answer.customVerdict : undefined })} customValue={answer.customVerdict} onCustomChange={customVerdict => setAnswer({ ...answer, customVerdict })} name="verdict" /><Choices title="How would it make you feel?" options={emotions} selected={answer.emotion} onChange={emotion => setAnswer({ ...answer, emotion, customEmotion: emotion === OTHER_ANSWER ? answer.customEmotion : undefined })} customValue={answer.customEmotion} onCustomChange={customEmotion => setAnswer({ ...answer, customEmotion })} name="emotion" /><Choices title="What matters most to you in this situation?" options={scenarioFactors(scenario)} descriptions={scenario.reasonOptions ? samePageReasons.map(reason => reason.description) : undefined} selected={answer.factor} onChange={factor => setAnswer({ ...answer, factor, customFactor: factor === OTHER_ANSWER ? answer.customFactor : undefined })} customValue={answer.customFactor} onCustomChange={customFactor => setAnswer({ ...answer, customFactor })} name="factor" /><label className="explanation-label" htmlFor="explanation">A little context <span>optional</span></label><textarea id="explanation" maxLength={600} value={answer.explanation} onChange={e => setAnswer({ ...answer, explanation: e.target.value })} placeholder="What would you want your partner to understand?" /><div className="answer-submit"><span>{answer.explanation.length}/600</span><button className="button primary" disabled={busy || !validAnswer(answer, scenario)}>Submit answer <LockKeyhole size={15} /></button></div></form>
            : game.phase === 'discussion' && <div className="discussion"><div className="reveal-heading"><Sparkles size={21} /><h2>Two perspectives. One conversation.</h2><p>Same or different, there’s something to learn here.</p></div><div className="reveal-grid">{game.players.map(p => { const a = game.answers[game.round]?.[p.id]; return a ? <article className="reveal-card" key={p.id}><h3><span className="person-circle">{p.name.charAt(0)}</span>{p.name}</h3><dl><dt>THEIR TAKE</dt><dd>{responseLabel(scenarioVerdicts(scenario), a.verdict, a.customVerdict)}</dd><dt>THEIR FEELING</dt><dd>{responseLabel(emotions, a.emotion, a.customEmotion)}</dd><dt>WHAT MATTERS MOST</dt><dd>{responseLabel(scenarioFactors(scenario), a.factor, a.customFactor)}</dd></dl>{a.explanation && <blockquote>“{a.explanation}”</blockquote>}</article> : null; })}</div>{game.players.every(p => game.answers[game.round]?.[p.id]) && <div className="alignment-row">{Object.entries(alignment(game.answers[game.round][game.players[0].id], game.answers[game.round][game.players[1].id])).map(([key, same]) => <div key={key}><span>{key === 'emotion' ? 'Emotional' : key === 'values' ? 'Values' : 'Verdict'} alignment</span><strong>{same === null ? <><MessageCircle size={14} /> Written · discuss together</> : same ? <><Check size={14} /> Same page</> : <><MessageCircle size={14} /> Room to explore</>}</strong></div>)}</div>}<QuickDiscussion game={game} myId={myId} remaining={remaining} busy={busy} onContinue={nextRound} /></div>}
          </>}
        </section>}
      </main>
    </div>

    <nav className="phone-navigation" aria-label="Phone navigation">
      <button aria-current={showHome && homeScreen === 'home' ? 'page' : undefined} onClick={goHome}><Home size={20} />Home</button>
      <button aria-current={showHome && homeScreen === 'about' ? 'page' : undefined} onClick={() => openHomeScreen('about')}><Heart size={20} />About</button>
      <button aria-current={showHome && homeScreen === 'games' ? 'page' : undefined} onClick={() => openHomeScreen('games')}><Flower2 size={20} />Games</button>
      {game && <button aria-current={!showHome ? 'page' : undefined} onClick={resumeGame}><ArrowRight size={20} />{game.phase === 'recap' && (!game.night || game.night.finished) ? 'Report' : 'Resume'}</button>}
    </nav>
    {setup && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setSetup(null); }}>
      <section className="setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
        <button className="modal-close" aria-label="Close setup" onClick={() => setSetup(null)} disabled={busy}><X size={20} /></button>
        <div className="round-icon">{setup === 'local' ? <Users /> : setup === 'join' ? <LinkIcon /> : <Globe2 />}</div>
        <div className="eyebrow">{setup === 'local' ? 'SAME SOFA. NEW PERSPECTIVES.' : 'NEAR OR FAR, A LITTLE CLOSER.'}</div>
        <h2 id="setup-title">{setup === 'join' ? 'Your person is waiting.' : 'Make a little room for us.'}</h2>
        <p>{setup === 'local' ? 'One device, two honest perspectives. Pass it between you and reveal together.' : 'Your own private room. Just a link, your person, and a good conversation.'}</p>
        {setup !== 'join' && <>
          <div className="setup-game-banner"><Flower2 size={21} /><div><strong>{settingNight ? 'Your game-night playlist' : setupDefinition.title}</strong>{settingNight ? <><ol className="setup-playlist">{playlist.map(id => <li key={id}>{gameDefinition(id).title}</li>)}</ol><p>{setupRounds} rounds total. {count} questions per conversation game; adventures have five chapters. One combined report after all games.</p></> : <p>{setupRounds} {selectedGame === 'us-against-the-world' ? 'chapters' : 'questions'}. {setupDefinition.reflection}</p>}</div></div>
          <div className="setup-mode-switch" aria-label="Play mode"><button type="button" aria-pressed={setup === 'local'} onClick={() => setSetup('local')}><Users size={15} /> One device</button><button type="button" aria-pressed={setup === 'online'} onClick={() => setSetup('online')}><Globe2 size={15} /> Online room</button></div>
        </>}
        {setup !== 'local' && !onlineConfigured && <div className="setup-warning"><ShieldCheck size={20} /><div>
          <strong>Online play needs a backend connection.</strong>
          <p>Configure Supabase using the included setup guide to enable private rooms. Same-device play and the demo work right now.</p>
          <button type="button" className="text-button" onClick={() => setSetup('local')}>Play on one device instead <ArrowRight size={14} /></button>
        </div></div>}
        <form onSubmit={begin}>
          <label htmlFor="your-name">Your first name</label>
          <input autoFocus id="your-name" required maxLength={24} value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" />
          {setup === 'local' && <><label htmlFor="partner-name">Your partner’s first name</label><input id="partner-name" required maxLength={24} value={partner} onChange={e => setPartner(e.target.value)} placeholder="And your person?" /></>}
          {setup === 'join' ? <><label htmlFor="room-code">Room code</label><input id="room-code" required minLength={8} maxLength={8} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="8-character code" autoComplete="off" /></> : <div className="setup-selects">
            {(settingNight || selectedGame !== 'us-against-the-world') && <label>{settingNight ? 'Questions per conversation game' : 'Conversation length'}<select value={count} onChange={e => setCount(Number(e.target.value))}><option value={3}>3 questions · quick play</option><option value={5}>5 questions</option>{!category && <><option value={10}>10 questions</option><option value={20}>20 questions</option><option value={30}>30 questions · longer play</option>{!curatedConversation && <option value={50}>50 questions · full game night</option>}</>}</select></label>}
            <label>Suggested discussion time · skippable<select value={seconds} onChange={e => setSeconds(Number(e.target.value))}><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={180}>3 minutes</option></select></label>
          </div>}
          {setup !== 'join' && !settingNight && (selectedGame === 'if-i-were-you' || selectedGame === 'when-things-get-hard') && <label>Situation category<select value={category} onChange={event => { setCategory(event.target.value); if (event.target.value) setCount(current => Math.min(current, 5)); }}><option value="">All categories · mixed</option>{[...new Set(partyDecks[selectedGame].map(q => q.category))].map(value => <option key={value}>{value}</option>)}</select></label>}
          {setup !== 'join' && (selectedGame === 'us-against-the-world' || settingNight && playlist.includes('us-against-the-world')) && <section aria-label="Choose your adventure"><h3>Choose your five-chapter adventure</h3><div className="adventure-picker">{adventures.map(world => <button type="button" key={world.id} aria-pressed={adventure === world.id} onClick={() => setAdventure(world.id)}><RelationshipArt kind={world.id} /><strong>{world.title}</strong><p>{world.description}</p></button>)}</div></section>}
          {setup !== 'join' && <p className="question-source-note">New relationship games use curated questions and original adventures. Repeats are avoided within each curated selection. Player answers, private clues and reflections are never sent to the AI question service.{isRelationshipGame(selectedGame) && setup === 'online' && ' Online play for these new games requires database migrations 006 and 007.'}</p>}
          <button className="button primary full-width" disabled={restoring || busy || (setup !== 'local' && !onlineConfigured) || !name.trim() || (setup === 'local' && !partner.trim())}>{busy ? 'A little moment…' : setup === 'join' ? 'Join our room' : setup === 'local' ? 'Let’s get to know each other' : 'Create our private room'}<ArrowRight size={16} /></button>
          <div className="modal-foot"><LockKeyhole size={12} /> {setup === 'local' ? 'Works offline after the app is loaded. Saved on this device.' : 'Answers stay hidden until both of you submit.'}</div>
        </form>
        {error && <p className="modal-error" role="alert">{error}</p>}
      </section>
    </div>}
  </div>;
}

function message(e: unknown) { return e instanceof Error ? e.message : 'Something went wrong. Please try again.'; }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
