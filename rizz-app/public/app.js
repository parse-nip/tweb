'use strict';
/* Rizzmate — practice texting like chess: every message is graded like a move, your rating moves, a coach reviews the game. */
const API = '/api/openrouter';
const JEV = 'typesafe/jev-1.13';
const FAST = 'google/gemini-2.5-flash-lite';
const FALLBACKS = [FAST, 'google/gemini-2.5-flash', 'openai/gpt-4.1-nano'];
const STORE = 'rizzmate:v1';
const WIN_INTEREST = 85, LOSE_INTEREST = 8;

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmt = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
const now = () => new Date().toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}).toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 9);
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2600); }

// ── labels (the badges are the supplied drawings in icons/) ────────────────────────────────────────────────────
const LABELS = [
  ['brilliant', 'Brilliant', 'rare, genuinely clever or emotionally perfect: witty, disarming, escalates the vibe without trying too hard', 100, '#1baca6'],
  ['great', 'Great', 'a strong message that moves the conversation forward, shows personality, or turns the chat around', 92, '#5c8bb0'],
  ['best', 'Best', 'the best reply available in this position', 88, '#81b64c'],
  ['excellent', 'Excellent', 'a very good message, close to the best one', 80, '#81b64c'],
  ['good', 'Good', 'fine and natural, but nothing special', 65, '#95b776'],
  ['book', 'Book', 'a standard, expected message (greetings, small talk, logistics)', 60, '#a88865'],
  ['forced', 'Forced', 'the only sensible thing to say (a direct question that must be answered, a thank-you, an apology owed)', 70, '#97af8b'],
  ['inaccuracy', 'Inaccuracy', 'a bit off: dry, a little needy, or a missed chance', 40, '#f7c631'],
  ['mistake', 'Mistake', 'a message that hurts the vibe: awkward, boring, try-hard, or pushy', 25, '#e58f2a'],
  ['miss', 'Miss', 'ignored an obvious opening or question, or dodged what they were offering', 20, '#ca3431'],
  ['blunder', 'Blunder', 'a conversation-killer: rude, creepy, desperate, passive-aggressive or offensive', 0, '#ca3431'],
  ['checkmate', 'Checkmate', "ends the conversation in the user's favour: a date agreed, a number given, a perfect last word. Very rare", 100, '#3d4249'],
  ['resign', 'Resign', 'gives up: a surrender, an apology spiral, "forget it", "never mind"', 0, '#6e747b']
];
const L = Object.fromEntries(LABELS.map(([id, title, hint, acc, color]) => [id, {id, title, hint, acc, color}]));
const REVIEW_ROWS = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'forced', 'inaccuracy', 'mistake', 'miss', 'blunder'];
const icon = (id, dark) => '/icons/' + ((dark && (id === 'checkmate' || id === 'resign')) ? id + '-black' : id) + '.svg';

// ── the bots, a ladder like chess.com's ────────────────────────────────────────────────────────────────────────
const BOTS = [
  {id: 'mia', name: 'Mia', title: 'The Shy Bookworm', elo: 600, e: '📚', c: '#8b6bb7', start: 45, tag: 'Short answers, warms up to genuine curiosity', open: 'um, hi. sorry, i was reading. hello', prompt: 'You are shy and a bit awkward, a bookworm. You answer briefly at first, use "haha" and "um", and open up when the user asks specific, genuine questions. Generic pickup lines or pressure make you retreat.'},
  {id: 'dev', name: 'Dev', title: 'The Dry Texter', elo: 900, e: '🪨', c: '#6f7b86', start: 35, tag: '"lol", "k", "yeah" — you do the heavy lifting', open: 'yo', prompt: 'You are a dry texter: lowercase, one-to-four word replies, "lol", "yeah", "ok" — not actually uninterested, just no effort. A truly funny message or a question worth answering makes you write a full sentence.'},
  {id: 'sam', name: 'Sam', title: 'The Chaos Goblin', elo: 1100, e: '🌪️', c: '#d9822b', start: 55, tag: 'Random tangents, memes, plays along if you do', open: 'ok so hypothetically if a goose wore a tiny hat would it still be a goose', prompt: 'You are a chaotic, playful, meme-brained texter who sends tangents, bits and absurd questions. You love when the user matches your energy and builds on the bit, and lose interest when they are serious and flat.'},
  {id: 'nora', name: 'Nora', title: 'The Overthinker', elo: 1250, e: '🫠', c: '#3f9aa0', start: 50, tag: 'Reads into everything, needs reassurance', open: 'hey! um. is it weird that i texted first? it is weird isn\'t it', prompt: 'You overthink everything. You ask "wait what do you mean?" and "is that a good thing?", read into tone and punctuation, and need clear, warm, confident messages. Mixed signals or sarcasm that is too sharp make you spiral politely.'},
  {id: 'kai', name: 'Kai', title: 'The Sarcastic Comedian', elo: 1400, e: '🙄', c: '#c0504d', start: 40, tag: 'Roasts everything, respects a quick comeback', open: 'oh look, a stranger with a phone. impressive.', prompt: 'You are sarcastic, quick and teasing. You roast the user lightly and respect witty comebacks and confidence. You are bored by try-hard compliments and needy messages. Never cruel, always playful.'},
  {id: 'alex', name: 'Alex', title: 'The Ex Who Left You on Read', elo: 1550, e: '💔', c: '#b04a73', start: 20, tag: 'Recover it with zero desperation', open: 'oh. hi. i saw your messages. i was busy', prompt: "You are the user's ex. You left them on read last week. Guarded, a little curious, a little proud. Apologising too much, guilt-tripping or anger make you leave; calm, funny, self-aware messages thaw you."},
  {id: 'vera', name: 'Vera', title: 'The Hard-to-Get', elo: 1750, e: '🧊', c: '#5c8bb0', start: 25, tag: 'Slow, low effort, you must earn it', open: 'hey', prompt: 'You are hard to get: few words, rarely ask questions back, mildly unimpressed. Your interest only climbs when the user is confident, funny, specific and not desperate. Double-texting and neediness drop it fast.'},
  {id: 'luca', name: 'Luca', title: 'The Confident Flirt', elo: 1950, e: '😏', c: '#c99a2e', start: 60, tag: 'Flirts back hard, tests your frame', open: "well well. you finally texted. i was starting to think you'd lost my number", prompt: 'You are a confident flirt used to attention. You tease, flirt back and test whether the user can hold their frame. Boring or safe messages bore you; bold, playful ones thrill you.'}
];
const bot = (id) => BOTS.find((b) => b.id === id);

// ── store: everything lives in this browser ────────────────────────────────────────────────────────────────────
let DB = (() => { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } })() || {rating: 800, moves: 0, games: [], history: [800], puzzle: {rating: 800, streak: 0, best: 0, solved: 0, failed: 0}, active: null, lastBot: 'kai'};
DB.puzzle ||= {rating: 800, streak: 0, best: 0, solved: 0, failed: 0};
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(DB, (k, v) => (k === 'el' ? undefined : v))); } catch {} };

// ── api: retries on rate limits and upstream hiccups, so a chat never just goes quiet ──────────────────────────
async function post(path, body, signal) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(API + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal});
      const j = await r.json().catch(() => null);
      if (r.ok) return j;
      const err = new Error(j?.error?.message || 'HTTP ' + r.status); err.status = r.status;
      if ((r.status !== 429 && r.status < 500) || attempt >= 2) throw err;
    } catch (err) {
      if (signal?.aborted || (err.status && err.status < 500 && err.status !== 429) || attempt >= 2) throw err;
    }
    await sleep(attempt ? 1800 : 700);
  }
}
const chat = (messages, o = {}) => post('/v1/chat/completions', {model: FAST, models: FALLBACKS, temperature: .8, max_tokens: 300, messages, ...o}).then((j) => j.choices[0].message.content.trim());
const parse = (t) => { const s = String(t).replace(/```(?:json)?/g, ''); const a = s.search(/[{[]/); const b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']')); try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } };
function parseBot(t) {   // the JSON asked for, or what can be salvaged of a broken one; raw JSON is never a message
  const j = parse(t), raw = j && (j.replies ?? j.reply);
  const list = (Array.isArray(raw) ? raw : [raw]).filter((x) => typeof x === 'string' && x.trim());
  if (list.length) return {replies: list, interest: Number.isFinite(Number(j.interest)) ? Number(j.interest) : undefined, status: typeof j.status === 'string' ? j.status.toLowerCase() : undefined};
  if (/^\s*[{[`]/.test(t) || /"replies"\s*:/.test(t)) {
    const block = (t.match(/"replies?"\s*:\s*\[?([^\]}]*)/) || [])[1] || '';
    const replies = [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"').trim()).filter(Boolean);
    const i = (t.match(/"interest"\s*:\s*(\d+)/) || [])[1], st = (t.match(/"status"\s*:\s*"(\w+)"/) || [])[1];
    return {replies, interest: i !== undefined ? Number(i) : undefined, status: st && st.toLowerCase()};
  }
  return {replies: [t.trim()].filter(Boolean)};
}

// ── rating: each message is a game against the bot, the label is the result ────────────────────────────────────
const ACC = Object.fromEntries(LABELS.map(([id, , , acc]) => [id, acc]));
const expected = (r, opp) => 1 / (1 + 10 ** ((opp - r) / 400));
function eloStep(r, opp, rating, moves) {
  const k = moves < 10 ? 48 : 32;
  const score = Math.min(1, Math.max(0, (ACC[rating] / 100 - 0.6) / 0.4 * 0.5 + 0.5));
  const delta = Math.round(k * (score - expected(r, opp)));
  return {elo: Math.max(100, r + delta), delta};
}
const ANCHORS = ['A bare greeting or a dead-end reply, around 400 Elo', 'An ordinary, fine reply, around 1000 Elo', 'A sharp, warm or witty message, around 1800 Elo', 'An exceptional message that turns the whole chat, around 2600 Elo'];
async function grade(msgs, index, signal) {
  const m = msgs[index];
  const j = await post('/alpha/decisions', {
    model: JEV,
    state: {
      conversation_before: msgs.slice(Math.max(0, index - 14), index).map((x) => (x.out ? 'me' : 'them') + ': ' + x.text).join('\n') || '(this is the first message)',
      graded_message_sender: m.out ? 'me' : 'them', graded_message: m.text
    },
    questions: {
      rating: {type: 'choice', instructions: 'How well does the graded message play in its position, the way a chess engine grades a move? Judge how it lands on the person reading it, whether it moves the conversation forward, humour, warmth, confidence, timing, and whether it answers what came before. Most messages are good or book; brilliant, checkmate and blunder are rare.', criteria: Object.fromEntries(LABELS.map(([id, , hint]) => [id, hint]))},
      strength: {type: 'score', instructions: 'How strong is the graded message, as the chess Elo of the move?', criteria: ANCHORS}
    }
  }, signal);
  const a = j.answers; let rating = a.rating.choice; const sure = a.rating.confidence ?? 0, probs = a.rating.probabilities || {};
  if (sure < 0.5 && ACC[rating] !== undefined && !['checkmate', 'resign'].includes(rating)) {   // an unsure call moves to the label nearest the probability-weighted result
    let tot = 0, ex = 0; for (const id in probs) if (ACC[id] !== undefined && probs[id] >= 0.08) { tot += probs[id]; ex += probs[id] * ACC[id]; }
    if (tot) { ex /= tot; let best = rating, d = Infinity; for (const id in probs) if (probs[id] >= 0.08 && !['checkmate', 'resign'].includes(id) && Math.abs(ACC[id] - ex) < d) { d = Math.abs(ACC[id] - ex); best = id; } rating = best; }
  }
  return {rating, sure: Math.round(sure * 100), elo: Math.round(400 + (Number(a.strength?.score) / 3) * 2200) || 800};
}

// ── the chat board: bubbles are added once and patched in place, so nothing re-animates or blinks ──────────────
function badgeEl(m, scroller) {
  const b = document.createElement('div'); b.className = 'badge';
  if (m.pending) { b.classList.add('pending'); return b; }
  if (!m.v) return null;
  const d = L[m.v.rating], cap = d.hint.charAt(0).toUpperCase() + d.hint.slice(1) + '.', delta = m.delta != null ? fmt(m.delta) : '';
  b.style.setProperty('--c', d.color); b.tabIndex = 0; b.setAttribute('role', 'button'); b.setAttribute('aria-label', d.title + (delta ? ', ' + delta + ' rating' : '') + '. ' + cap);
  b.innerHTML = '<img class="ball" alt="" src="' + icon(m.v.rating, !m.out) + '"><span class="lbl">' + d.title + (delta ? '<i>' + delta + '</i>' : '') + '</span><div class="why"><div class="wt">' + d.title + '</div><div class="ws">~' + m.v.elo + ' Elo' + (m.v.sure ? ' · ' + m.v.sure + '% sure' : '') + (delta ? ' · ' + delta + ' rating' : '') + '</div><div class="wd">' + esc(cap) + '</div></div>';
  const place = () => b.classList.toggle('flip', b.getBoundingClientRect().top - scroller.getBoundingClientRect().top < 130);
  b.addEventListener('mouseenter', place); b.addEventListener('focus', place);
  b.addEventListener('click', (e) => { e.stopPropagation(); const open = !b.classList.contains('open'); document.querySelectorAll('.badge.open').forEach((x) => x.classList.remove('open')); if (open) { place(); b.classList.add('open'); } });
  return b;
}
document.addEventListener('click', () => document.querySelectorAll('.badge.open').forEach((x) => x.classList.remove('open')));

function createChat(scroller) {
  let typingEl;
  const bubble = (m, animate) => {
    const d = document.createElement('div'); d.className = 'msg ' + (m.out ? 'me' : 'them'); if (!animate) d.style.animation = 'none';
    const t = document.createElement('span'); t.className = 'tx'; t.textContent = m.text; d.append(t);
    const dl = document.createElement('span'); dl.className = 'dl'; d.append(dl);
    m.el = d; patchBubble(m); return d;
  };
  function patchBubble(m) {   // only the badge and the rating change are touched
    const d = m.el; if (!d) return;
    d.querySelector('.badge')?.remove(); const b = badgeEl(m, scroller); if (b) d.append(b);
    const dl = d.querySelector('.dl'); dl.textContent = m.out && m.delta != null ? fmt(m.delta) : ''; dl.className = 'dl ' + (m.delta >= 0 ? 'up' : 'down'); dl.style.display = dl.textContent ? '' : 'none';
  }
  const api = {
    add(m, animate = true) { const d = bubble(m, animate); typingEl ? scroller.insertBefore(d, typingEl) : scroller.append(d); api.scroll(animate); return d; },
    update: patchBubble,
    sys(text) { const d = document.createElement('div'); d.className = 'sys'; d.textContent = text; typingEl ? scroller.insertBefore(d, typingEl) : scroller.append(d); api.scroll(); },
    typing(on) {
      if (on && !typingEl) { typingEl = document.createElement('div'); typingEl.className = 'typing'; typingEl.innerHTML = '<i></i><i></i><i></i>'; scroller.append(typingEl); api.scroll(); }
      if (!on && typingEl) { typingEl.remove(); typingEl = null; }
    },
    scroll(smooth = true) { requestAnimationFrame(() => scroller.scrollTo({top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto'})); },
    clear() { scroller.replaceChildren(); typingEl = null; }
  };
  return api;
}

// ── shell ──────────────────────────────────────────────────────────────────────────────────────────────────────
const view = $('#view');
let unmount = null;
const nodes = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
function updateRail() {
  const d = DB.rating - 800;
  $('#rcNum').textContent = DB.rating; $('#rcD').textContent = d ? fmt(d) + ' since start' : 'Play to get rated'; $('#rcD').className = 'd ' + (d >= 0 ? 'up' : 'down');
}
function modal(html, cls = '') { const m = $('#modal'); m.innerHTML = '<div class="mcard ' + cls + '" role="dialog">' + html + '</div>'; m.classList.add('on'); return m.firstChild; }
function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.replaceChildren(); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
const accOf = (ms) => { const g = ms.filter((m) => m.v); return g.length ? Math.round(g.reduce((a, m) => a + L[m.v.rating].acc, 0) / g.length) : 0; };
const gameRatingOf = (ms) => { const g = ms.filter((m) => m.v); return g.length ? Math.round(g.reduce((a, m) => a + m.v.elo, 0) / g.length) : 0; };
const resultOf = (G) => G.ended === 'checkmate' ? 'W' : G.ended === 'draw' ? 'D' : 'L';
const counts = (ms) => { const c = {}; ms.forEach((m) => m.v && (c[m.v.rating] = (c[m.v.rating] || 0) + 1)); return c; };

// ── home ───────────────────────────────────────────────────────────────────────────────────────────────────────
function viewHome() {
  const g = DB.games, wins = g.filter((x) => x.ended === 'checkmate').length, acc = g.length ? Math.round(g.reduce((a, x) => a + accOf(x.msgs.filter((m) => m.out)), 0) / g.length) : 0;
  view.replaceChildren(nodes(`<div class="page">
    <div class="hero">
      <div class="herocard"><div><h1>Practice your rizz.<br>Level up.</h1><p class="sub" style="margin:.5rem 0 0">Text a bot. Every message is graded like a chess move — Brilliant to Blunder — and your rating moves. Win them over for <b>checkmate</b>.</p></div>
        <a href="#/play" class="btn big">Play a bot</a><a href="#/drills" class="btn big alt">Solve a drill</a></div>
      <div class="card herochat">
        <div class="msg them" style="animation:none">oh look, a stranger with a phone. impressive.</div>
        <div class="msg me" style="animation:none">chapter two should be tea this weekend<span class="badge open" style="--c:#5c8bb0;pointer-events:none"><img class="ball" alt="" src="/icons/great.svg"><span class="lbl">Great<i>+31</i></span></span></div>
        <div class="msg them" style="animation:none">ok that was actually good<span class="badge" style="--c:#81b64c;pointer-events:none"><img class="ball" alt="" src="/icons/excellent.svg"></span></div>
      </div>
    </div>
    <div class="grid g4" style="margin:1.5rem 0">
      <div class="card stat"><b>${DB.rating}</b><small>Rizz rating</small></div><div class="card stat"><b>${g.length}</b><small>Games</small></div>
      <div class="card stat"><b>${g.length ? Math.round(wins / g.length * 100) + '%' : '—'}</b><small>Win rate</small></div><div class="card stat"><b>${acc ? acc + '%' : '—'}</b><small>Avg accuracy</small></div>
    </div>
    <div class="grid g3">
      <a class="card tile" href="#/drills"><span class="big">🧩</span><div><b>Daily drill</b><span>Pick the best reply. Puzzle rating ${DB.puzzle.rating}${DB.puzzle.streak ? ' · 🔥 ' + DB.puzzle.streak : ''}</span></div></a>
      <a class="card tile" href="${g[0] ? '#/review/' + g[0].id : '#/play'}"><span class="big">📋</span><div><b>Review your last game</b><span>${g[0] ? 'Coach goes through it move by move' : 'Play a game first'}</span></div></a>
      <a class="card tile" href="#/learn"><span class="big">🎓</span><div><b>Learn the labels</b><span>What makes a Brilliant, and a Blunder</span></div></a>
    </div>
    ${g.length ? '<h2 style="margin-top:1.75rem">Recent games</h2><div class="card" style="padding:.5rem">' + g.slice(0, 5).map(gameRow).join('') + '</div>' : ''}
  </div>`));
  view.querySelectorAll('.gl').forEach((r) => r.onclick = () => location.hash = '#/review/' + r.dataset.id);
}
function gameRow(G) {
  const B = bot(G.bot), r = resultOf(G), d = (G.endElo ?? DB.rating) - G.startElo;
  return `<div class="gl" data-id="${G.id}"><span class="av sm" style="--c:${B.c}">${B.e}</span><div style="flex:1"><b>${B.name}</b> <small>${B.elo} · ${B.title}</small></div><span class="res ${r === 'W' ? 'up' : r === 'L' ? 'down' : ''}">${r === 'W' ? 'Won' : r === 'L' ? 'Lost' : 'Draw'}</span><b class="${d >= 0 ? 'up' : 'down'}" style="width:3rem;text-align:end">${fmt(d)}</b><small>${accOf(G.msgs.filter((m) => m.out))}%</small></div>`;
}

// ── play: the ladder of bots ───────────────────────────────────────────────────────────────────────────────────
function viewPlay() {
  let pick = DB.lastBot && bot(DB.lastBot) ? DB.lastBot : 'kai';
  view.replaceChildren(nodes(`<div class="page"><h1>Play a bot</h1><p class="sub">Pick who you’re texting. Higher-rated bots are harder to win over — and worth more rating.</p>
    <div class="grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:start" id="pl"><div class="botlist" id="bl"></div><div class="card chosen" id="ch"></div></div></div>`));
  const paint = () => {
    $('#bl').replaceChildren(...BOTS.map((b) => { const e = document.createElement('button'); e.className = 'bot' + (b.id === pick ? ' on' : ''); e.innerHTML = `<span class="av" style="--c:${b.c}">${b.e}</span><span class="meta"><b>${b.name}</b><span>${b.title} — ${b.tag}</span></span><span class="pill elo">${b.elo}</span>`; e.onclick = () => { pick = b.id; paint(); }; return e; }));
    const b = bot(pick), p = expected(DB.rating, b.elo);
    $('#ch').innerHTML = `<span class="av lg" style="--c:${b.c}">${b.e}</span><div><h2 style="margin:0">${b.name} <span class="pill elo">${b.elo}</span></h2><div class="sub" style="margin:.25rem 0 0">${b.title}</div></div><div class="bubble-quote">${esc(b.open)}</div>
      <div style="color:var(--muted);font-size:.9375rem">Your chance to win them over: <b style="color:#fff">${Math.round(p * 100)}%</b></div><button class="btn big" id="go">Play</button>`;
    $('#go').onclick = () => startGame(pick);
  };
  paint();
}
function startGame(botId) {
  const b = bot(botId); DB.lastBot = botId;
  DB.active = {id: uid(), bot: botId, startedAt: Date.now(), startElo: DB.rating, interest: b.start, ended: '', review: null, msgs: [{out: false, text: b.open, time: now(), int: b.start}]};
  save(); location.hash = '#/game';
}

// ── the game ───────────────────────────────────────────────────────────────────────────────────────────────────
const DONE = new Set();
function viewGame() {
  const G = DB.active; if (!G) { location.hash = '#/play'; return; }
  const B = bot(G.bot), run = new AbortController(), grading = new Set();
  let busy = false, ghost = '', ghostTimer, ghostAbort, askedAt = -1, typingOn = false;
  view.replaceChildren(nodes(`<div class="game">
    <div class="eval"><div class="num t" id="evT"></div><div class="fill" id="evF" style="background:#81b64c"></div><div class="num b" id="evB"></div></div>
    <div class="col">
      <div class="pbar"><span class="av" style="--c:${B.c}">${B.e}</span><div><b>${B.name}<span class="r">(${B.elo})</span></b><span class="st" id="oppSt">online</span></div></div>
      <div class="board"><div class="chat" id="chat"></div><div class="tips" id="tips"></div>
        <div class="composer"><div class="field" id="field"><div class="editor" id="editor" contenteditable="true" role="textbox" aria-label="Message" data-placeholder="Type a message…" data-ghost="" spellcheck="false"></div><span class="tabkey" aria-hidden="true">Tab</span></div><button class="sendbtn" id="send" aria-label="Send" disabled>➤</button></div></div>
      <div class="pbar"><span class="av" style="--c:#7a6f66">🙂</span><div><b>You<span class="r" id="myR"></span></b><span class="st" id="myD"></span></div></div>
    </div>
    <div class="side2"><div class="panel" style="flex:1"><div class="ph"><span>Moves</span><span class="pill" id="mvc"></span></div><div class="moves" id="moves"></div>
      <div class="acts"><button class="btn alt sm" id="hint">💡 Hint</button><button class="btn alt sm" id="draw">½ Draw</button><button class="btn alt sm" id="resign">⚑ Resign</button></div></div></div></div>`));
  const chatEl = $('#chat'), editor = $('#editor'), board = createChat(chatEl);
  const text = () => editor.textContent.replace(/​/g, '');

  function sync() {
    const i = G.interest; $('#evF').style.height = i + '%'; $('#evB').textContent = i; $('#evT').textContent = 100 - i;
    const d = DB.rating - G.startElo; $('#myR').textContent = '(' + DB.rating + ')'; $('#myD').textContent = d ? fmt(d) + ' this game' : ' '; $('#myD').className = 'st ' + (d > 0 ? 'up' : d < 0 ? 'down' : '');
    $('#oppSt').textContent = G.ended === 'left' ? 'last seen recently' : typingOn ? 'typing…' : 'online';
    moves(); updateRail();
  }
  function moves() {
    const box = $('#moves'), rows = [];
    for (let i = 0; i < G.msgs.length; i += 2) rows.push(i);
    box.replaceChildren(...rows.map((i, k) => { const r = document.createElement('div'); r.className = 'mrow'; r.innerHTML = '<span class="n">' + (k + 1) + '.</span>'; for (const m of [G.msgs[i], G.msgs[i + 1]]) { const c = document.createElement('button'); c.className = 'mcell'; if (m) { c.innerHTML = (m.v ? '<img alt="" src="' + icon(m.v.rating, !m.out) + '">' : '') + '<span>' + esc(m.text) + '</span>'; c.title = m.text; c.onclick = () => { document.querySelectorAll('.msg.sel').forEach((x) => x.classList.remove('sel')); m.el?.classList.add('sel'); m.el?.scrollIntoView({block: 'center', behavior: 'smooth'}); }; } r.append(c); } return r; }));
    $('#mvc').textContent = G.msgs.filter((m) => m.out).length + ' moves'; box.scrollTop = box.scrollHeight;
  }

  // grading: my message moves the rating; a Checkmate or a Resign ends the game
  function gradeMsg(m) {
    m.pending = true; board.update(m);
    const p = grade(G.msgs, G.msgs.indexOf(m), run.signal).then((v) => {
      m.v = v;
      if (m.out && v && m.delta == null) {
        const r = eloStep(DB.rating, B.elo, v.rating, DB.moves); DB.rating = r.elo; DB.moves++; m.delta = r.delta; DB.history.push(r.elo); if (DB.history.length > 400) DB.history.shift();
        if (v.rating === 'checkmate') setTimeout(() => end('checkmate'), 900); else if (v.rating === 'resign') setTimeout(() => end('resign'), 900);
      }
    }).catch(() => { m.v = null; }).finally(() => { m.pending = false; board.update(m); grading.delete(p); save(); sync(); });
    grading.add(p); return p;
  }
  function end(kind) {
    if (G.ended) return; G.ended = kind; busy = false; typingOn = false; board.typing(false); clearTimeout(ghostTimer); ghostAbort?.abort(); setGhost(''); $('#tips').replaceChildren();
    G.endElo = DB.rating; G.endedAt = Date.now(); DB.games.unshift(G); if (DB.games.length > 60) DB.games.pop(); DB.active = null; save();
    editor.contentEditable = 'false'; editor.dataset.placeholder = 'Game over'; $('#send').disabled = true; sync();
    board.sys(kind === 'checkmate' ? 'Checkmate — you won them over' : kind === 'left' ? 'Checkmate — they left you on read' : kind === 'resign' ? 'You resigned' : 'Draw agreed');
    setTimeout(() => showEnd(G), 1000);
  }

  // ghost text: a grey suggestion after the caret; Tab takes it
  function setGhost(v) { ghost = v; editor.dataset.ghost = v; $('#field').classList.toggle('has-ghost', !!v); }
  function caretEnd() { const r = document.createRange(); r.selectNodeContents(editor); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function stripEcho(draft, t) {
    const typed = draft.replace(/\s+$/, ''); if (!typed.trim()) return t; const w = typed.split(/\s+/);
    for (let i = 0; i < w.length; i++) { const tail = w.slice(i).join(' '); if (tail.length >= 2 && t.toLowerCase().startsWith(tail.toLowerCase()) && (i === 0 || tail.length >= 4)) return t.slice(tail.length); }
    const at = t.toLowerCase().indexOf(typed.toLowerCase()); return at > 0 ? t.slice(at + typed.length) : t;
  }
  async function suggest(again = true) {
    const draft = text(), last = G.msgs[G.msgs.length - 1];
    if (G.ended || busy) return;
    if (draft.trim() ? draft.trim().length < 3 : (last.out || askedAt === G.msgs.length)) return;
    if (!draft.trim()) askedAt = G.msgs.length;
    ghostAbort?.abort(); const c = ghostAbort = new AbortController();
    const hist = G.msgs.slice(-12).map((l) => (l.out ? 'me' : 'them') + ': ' + l.text).join('\n');
    try {
      const j = await post('/v1/chat/completions', {model: FAST, models: FALLBACKS, temperature: .8, max_tokens: 80, messages: [
        {role: 'system', content: 'You ghostwrite text messages for the user ("me") in a chat with another person ("them"). You write ONLY the text of the message, nothing else: no quotes, no labels, no explanation. Sound like the user: short (under 20 words), natural, confident, warm, a little humour. Answer what they said, then move the conversation forward. Never needy, creepy or try-hard.'},
        {role: 'user', content: 'Conversation:\n' + hist + '\n\n' + (draft.trim() ? 'The user has started typing: "' + draft + '"\nWrite ONLY the words that come AFTER it, appended right after the typed text. Do NOT repeat, quote or rephrase anything already typed: start with the first new word.' : 'Write the best next message from the user.')}]}, c.signal);
      let t = j.choices[0].message.content.trim().replace(/^["“'`]+|["”'`]+$/g, '').replace(/\n+/g, ' ');
      if (draft.trim()) t = stripEcho(draft, t).replace(/^\s+(?=[.,!?;:)\]])/, '');
      if (c.signal.aborted || text() !== draft) return;
      if (!t.trim()) { if (again) return suggest(false); return; }
      if (draft && !/\s$/.test(draft) && !/^[\s.,!?;:)\]]/.test(t)) t = ' ' + t;
      setGhost(t);
    } catch { if (!draft.trim()) askedAt = -1; }
  }
  const wake = () => { clearTimeout(ghostTimer); ghostTimer = setTimeout(suggest, 700); };
  const accept = () => { editor.textContent = text() + ghost; setGhost(''); caretEnd(); $('#send').disabled = false; };
  editor.addEventListener('input', () => { clearTimeout(ghostTimer); ghostAbort?.abort(); setGhost(''); ghostTimer = setTimeout(suggest, 700); $('#send').disabled = !text().trim() || busy; });
  editor.addEventListener('keydown', (e) => {
    if (ghost && (e.key === 'Tab' || (e.key === 'ArrowRight' && !e.shiftKey)) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); accept(); return; }
    if (e.key === 'Escape') setGhost(''); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  editor.addEventListener('click', () => { if (ghost && matchMedia('(pointer: coarse)').matches) accept(); });

  async function send() {
    const v = text().trim(); if (!v || busy || G.ended) return; busy = true;
    editor.textContent = ''; setGhost(''); $('#send').disabled = true; $('#tips').replaceChildren(); G.review = null;
    const m = {out: true, text: v, time: now(), int: G.interest}; G.msgs.push(m); board.add(m); typingOn = true; board.typing(true); sync(); save(); gradeMsg(m);
    try {
      const sys = 'You are role-playing a person in a texting simulator so the user can practise texting. Stay in character; never mention being an AI or a simulator.\n\nCharacter: ' + B.name + ', ' + B.title + '. ' + B.prompt + '\n\nStyle: texting on a phone. Short, casual, natural messages, no stage directions or quotes. Usually one message, sometimes two; each under 20 words, like a real text, never a paragraph. You track a hidden interest 0..100 (now ' + G.interest + '). ' + (B.elo >= 1700 ? 'Be picky: only a genuinely good message earns +4..+9, bland ones cost -2..-5, a bad one -8..-18.' : B.elo >= 1000 ? 'Be fair: a good message is +5..+12, a bland one 0..-3, a bad one -5..-10.' : 'Be forgiving: decent effort earns +6..+14 interest, a poor message costs at most -5.') + ' Ending the chat: set "status" to "won" as soon as the user has WON you over: you agree to meet, go on a date, give your number or a clear yes to what they proposed, or you are plainly sold (do not make them ask twice). Set "status" to "lost" when you decide you are done with this conversation (you say goodbye, block them, or tell them it is over). Otherwise "continue". When won set interest to 100, when lost 0.\nJSON only: {"replies":["<message>","<optional second>"],"interest":<0..100>,"status":"continue|won|lost"}';
      const txt = await chat([{role: 'system', content: sys}, ...G.msgs.map((x) => ({role: x.out ? 'user' : 'assistant', content: x.text}))], {temperature: .9, max_tokens: 200, response_format: {type: 'json_object'}});
      if (run.signal.aborted) return;
      const j = parseBot(txt), replies = j.replies.slice(0, 2); if (!replies.length) throw new Error('empty answer');
      const next = Math.max(0, Math.min(100, Math.round(j.interest ?? G.interest)));
      for (const r of replies) {
        await sleep(500 + Math.min(1200, r.length * 22)); if (run.signal.aborted) return;
        board.typing(false); const mm = {out: false, text: String(r), time: now(), int: next}; G.msgs.push(mm); board.add(mm); sync(); save(); gradeMsg(mm);
        if (r !== replies[replies.length - 1]) { board.typing(true); }
      }
      await Promise.allSettled([...grading]);
      G.interest = next; typingOn = false; board.typing(false); sync();
      if ((j.status === 'won' || G.interest >= WIN_INTEREST) && !G.ended) {   // won over: the message that did it is the mating move
        G.interest = 100; const mine = [...G.msgs].reverse().find((x) => x.out);
        if (mine && mine.v?.rating !== 'checkmate') { mine.v = {rating: 'checkmate', elo: 2800, sure: 100}; const r = eloStep(DB.rating, B.elo, 'checkmate', DB.moves); DB.rating = r.elo; DB.moves++; DB.history.push(r.elo); mine.delta = (mine.delta || 0) + r.delta; board.update(mine); }
        sync(); return end('checkmate');
      }
      if ((j.status === 'lost' || G.interest <= LOSE_INTEREST) && !G.ended) { G.interest = Math.min(G.interest, LOSE_INTEREST); sync(); return end('left'); }
    } catch (err) { if (!run.signal.aborted) { typingOn = false; board.typing(false); board.sys('They didn’t answer (' + err.message + '). Send again to retry.'); } }
    if (run.signal.aborted || G.ended) return;
    busy = false; typingOn = false; board.typing(false); $('#send').disabled = !text().trim(); sync(); save(); wake();
  }
  $('#send').onclick = send;

  $('#hint').onclick = async () => {
    if (G.ended) return; const b = $('#hint'); b.disabled = true; b.textContent = '💡 …';
    try {
      const t = await chat([{role: 'system', content: 'You are a warm, honest texting coach. Be specific, short and practical.'}, {role: 'user', content: 'Simulated person: ' + B.name + ', ' + B.title + ' — ' + B.tag + '.\nConversation (me = the user):\n' + G.msgs.map((m) => (m.out ? 'me' : 'them') + ': ' + m.text).join('\n') + '\n\nWrite 3 different messages the user could send next, in the user\'s voice: natural, confident, not cringe, each under 20 words, each a different approach. JSON only: {"options":["...","...","..."]}'}], {response_format: {type: 'json_object'}});
      const tips = $('#tips'); tips.replaceChildren();
      (parse(t)?.options || []).slice(0, 3).forEach((o) => { const x = document.createElement('button'); x.textContent = o; x.onclick = () => { editor.textContent = o; setGhost(''); caretEnd(); $('#send').disabled = false; tips.replaceChildren(); editor.focus(); }; tips.append(x); });
    } catch { toast('The coach could not be reached — try again'); }
    b.disabled = false; b.textContent = '💡 Hint';
  };
  $('#draw').onclick = () => { if (G.ended || busy) return; if (G.msgs.filter((m) => m.out).length < 2) return toast('Send a couple of messages first'); if (G.interest >= 35 && G.interest <= 75) { board.sys(B.name + ' accepted the draw'); end('draw'); } else toast(B.name + ' declined the draw'); };
  $('#resign').onclick = () => {
    if (G.ended) return; const m = modal('<div style="padding:1.5rem;text-align:center"><h2>Resign this game?</h2><p class="sub" style="margin:0 0 1rem">It counts as a loss and costs rating.</p><div class="macts" style="padding:0"><button class="btn" id="yes">Resign</button><button class="btn alt" id="no">Keep playing</button></div></div>');
    m.querySelector('#no').onclick = closeModal;
    m.querySelector('#yes').onclick = () => { closeModal(); const r = eloStep(DB.rating, B.elo, 'resign', DB.moves); DB.rating = r.elo; DB.moves++; DB.history.push(r.elo); end('resign'); };
  };

  // mount: a game in progress is drawn once, without animation
  G.msgs.forEach((m) => { m.pending = false; board.add(m, false); }); board.scroll(false);
  G.msgs.filter((m) => !m.v && (m.out || G.msgs.indexOf(m) > 0)).forEach((m) => gradeMsg(m));
  sync(); wake();
  unmount = () => { run.abort(); clearTimeout(ghostTimer); ghostAbort?.abort(); };
}

// the game-over card, after chess.com's
function showEnd(G) {
  const B = bot(G.bot), win = G.ended === 'checkmate', draw = G.ended === 'draw', d = DB.rating - G.startElo;
  const mine = G.msgs.filter((m) => m.out && m.v);
  const title = win ? 'You Won!' : draw ? 'Draw' : G.ended === 'resign' ? 'You Resigned' : 'You Lost', sub = win ? 'by checkmate — you won them over' : draw ? 'by agreement' : G.ended === 'resign' ? 'the chat ends here' : 'by checkmate — they left you on read';
  const m = modal(`<div class="mhead ${win ? 'win' : draw ? 'draw' : 'lose'}"><img alt="" src="${icon(draw ? 'forced' : G.ended === 'resign' ? 'resign' : 'checkmate', G.ended === 'left')}"><h3>${title}</h3><p>${sub}</p></div>
    <div class="mvs"><div class="pl"><span class="av" style="--c:#7a6f66">🙂</span><b>You</b><small>${G.startElo}</small></div><span class="x">vs</span><div class="pl"><span class="av" style="--c:${B.c}">${B.e}</span><b>${B.name}</b><small>${B.elo}</small></div></div>
    <div class="mrate"><span class="num" id="rn">${G.startElo}</span><span class="dd ${d >= 0 ? 'up' : 'down'}">${d ? fmt(d) : '±0'}</span><small>your rating · ${mine.length} moves · ${accOf(mine)}% accuracy</small></div>
    <div class="macts"><button class="btn big" id="rv">Game Review</button><div class="row"><button class="btn alt" id="rm">Rematch</button><button class="btn alt" id="nb">New bot</button></div></div>`);
  const t0 = performance.now(), tick = (t) => { const k = Math.min(1, (t - t0) / 900); const n = $('#rn'); if (n) n.textContent = Math.round(G.startElo + d * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  m.querySelector('#rv').onclick = () => { closeModal(); location.hash = '#/review/' + G.id; };
  m.querySelector('#rm').onclick = () => { closeModal(); startGame(G.bot); };
  m.querySelector('#nb').onclick = () => { closeModal(); location.hash = '#/play'; };
  if (win) { const f = document.createElement('div'); f.className = 'confetti'; const cols = ['#81b64c', '#5c8bb0', '#f7c631', '#ff6b6b', '#1baca6', '#a88865']; for (let i = 0; i < 46; i++) { const c = document.createElement('i'); c.style.cssText = 'left:' + Math.random() * 100 + '%;background:' + cols[i % cols.length] + ';animation-duration:' + (1.8 + Math.random() * 1.8) + 's;animation-delay:' + Math.random() * .6 + 's'; f.append(c); } $('#modal').append(f); setTimeout(() => f.remove(), 4500); }
}
