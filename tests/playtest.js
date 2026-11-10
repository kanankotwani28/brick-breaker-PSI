/* =====================================================================
   BRICK BREAKER - first-time-player playtest

   Loads the real game (../www/index.html) in a phone-sized iframe and
   plays it the way a new player would: buttons are tapped by their
   on-screen LABELS at their on-screen positions, the shop is swiped, the
   level list is dragged, and levels are played by moving the paddle with
   pointer events - the same input path a finger uses.

   The game's own clock is stopped and stepped from here, so a five-minute
   level runs in seconds and the result does not depend on frame rate or on
   whether the tab is visible.

   Anything a player could NOT do (crediting coins instead of grinding for
   an hour, counting bolts) is marked "instrumentation" in that test's notes.

   Run:  cd brickbreaker && python -m http.server 8098
         open http://localhost:8098/tests/playtest.html
   Results also land in window.__playtest. Running it erases the save for
   localhost:8098 only.
   ===================================================================== */
'use strict';

(async function () {
  const DT = 1000 / 60;
  const frameEl = document.getElementById('game');
  const statusEl = document.getElementById('status');
  const summaryEl = document.getElementById('summary');
  const table = document.getElementById('results');
  const results = [];
  const errors = [];
  window.__playtest = { done: false, results: results, errors: errors };

  let w = null;       // the game's window
  let T = 0;          // simulated clock, ms

  /* ---------------- plumbing ---------------- */
  /* Real-time wait that a background tab cannot stretch: timers there are
     clamped to about one a second, so setTimeout(20) can take a full
     second. Yield through the (unthrottled) message channel instead. */
  async function sleep(ms) {
    const end = performance.now() + ms;
    while (performance.now() < end) await tick();
  }
  /* Yield to the browser between batches of frames. A MessageChannel rather
     than setTimeout(0): a background tab clamps timers to one a second,
     which turns a 2-minute run into an hour. */
  const yieldCh = new MessageChannel();
  const tick = () => new Promise((r) => { yieldCh.port1.onmessage = () => r(); yieldCh.port2.postMessage(0); });
  const E = (code) => w.eval(code);                 // reads the game's top-level consts
  const SAVE = () => E('SAVE');
  const RUN = () => E('RUN');
  const W = () => E('W');
  const H = () => E('H');
  const px = (v) => E('px')(v);
  const scene = () => E('game.scene.getScenes(true, true)[0]');
  const key = () => { const s = scene(); return s ? s.scene.key : null; };
  const play = () => { const s = scene(); return s && s.scene.key === 'Play' ? s : null; };

  /* render=false skips drawing, for speed while a level plays itself out.
     Taps must be processed on DRAWN frames: Phaser decides which object is
     on top from the camera's render list, which only a render refreshes -
     without one, a popup's dimmer and the button under it tie. */
  function stepOnce(render) {
    T += DT;
    try { if (render === false) w.game.headlessStep(T, DT); else w.game.step(T, DT); }
    catch (e) { errors.push('game step threw: ' + (e && e.stack ? e.stack.split('\n')[0] : e)); throw e; }
  }
  async function frames(n) {
    for (let i = 0; i < n; i++) {
      stepOnce();
      if (i % 120 === 119) await tick();
    }
    await tick();
  }
  const seconds = (s) => frames(Math.round(s * 60));

  async function waitFor(pred, maxFrames, what) {
    for (let i = 0; i <= maxFrames; i += 5) {
      if (pred()) return;
      await frames(5);
    }
    if (!pred()) throw new Error('timed out waiting for ' + what + ' (on ' + key() + ')');
  }
  const waitScene = (k) => waitFor(() => key() === k, 600, k);

  /* Phaser runs tweens on the REAL clock, not the stepped one, so after
     anything that slides (the shop carousel) give it real time to land. */
  async function settle() {
    /* ...and step WHILE it passes: the tween clock credits only a sliver of
       real time per frame, so one long sleep then a few frames leaves a
       slide two-thirds done. */
    for (let i = 0; i < 24; i++) { await sleep(20); await frames(1); }
  }

  /* Load the game. fresh = a brand-new install (empty save). */
  async function load(fresh, size) {
    if (fresh) localStorage.clear();
    if (size) { frameEl.style.width = size[0] + 'px'; frameEl.style.height = size[1] + 'px'; }
    const loaded = new Promise((r) => { frameEl.onload = r; });
    frameEl.src = '../www/index.html?v=' + Date.now();   // never a cached copy
    await loaded;
    w = frameEl.contentWindow;
    w.addEventListener('error', (e) => errors.push('uncaught: ' + e.message));
    w.addEventListener('unhandledrejection', (e) => errors.push('unhandled rejection: ' + (e.reason && e.reason.message || e.reason)));
    const ce = w.console.error.bind(w.console);
    w.console.error = function () { errors.push('console.error: ' + [].join.call(arguments, ' ')); ce.apply(null, arguments); };
    /* Take the clock away from requestAnimationFrame once Phaser starts it. */
    for (let i = 0; i < 400 && !(w.game && w.game.isRunning); i++) await sleep(25);
    if (!w.game || !w.game.isRunning) throw new Error('game never started');
    w.game.loop.stop();
    T = performance.now();
    await waitScene('Home');
    await frames(10);
  }

  /* ---------------- finding things on screen ---------------- */
  function everything(s) {
    const out = [];
    const walk = (list) => list.forEach((o) => { out.push(o); if (o.list) walk(o.list); });
    walk((s || scene()).children.list);
    return out;
  }
  function texts(s) { return everything(s).filter((o) => o.type === 'Text' && o.active && o.visible); }
  /* Prefers a match that is actually on screen: the shop builds every card
     at once, so "EQUIP" can match an off-screen card as well as the one in
     view - and a player can only tap what they can see. */
  function findText(label, s) {
    const hits = texts(s).filter((t) => label instanceof RegExp ? label.test(t.text.trim()) : t.text.trim() === label);
    const onScreen = (t) => { const b = t.getBounds(); return b.centerX > 0 && b.centerX < W() && b.centerY > 0 && b.centerY < H(); };
    return hits.find(onScreen) || hits[0] || null;
  }
  const hasText = (label, s) => !!findText(label, s);
  function findImage(texKey, s) {
    return everything(s).find((o) => o.type === 'Image' && o.active && o.texture && o.texture.key === texKey) || null;
  }
  function centre(o) { const b = o.getBounds(); return [b.centerX, b.centerY]; }

  /* ---------------- fingers ---------------- */
  function mouse(type, x, y, buttons) {
    const c = w.game.canvas, r = c.getBoundingClientRect();
    c.dispatchEvent(new w.MouseEvent(type, {
      clientX: r.left + x * r.width / W(), clientY: r.top + y * r.height / H(),
      bubbles: true, cancelable: true, button: 0, buttons: buttons,
    }));
  }
  async function tap(x, y) { mouse('mousedown', x, y, 1); await frames(3); mouse('mouseup', x, y, 0); await frames(8); }
  async function tapText(label) {
    const t = findText(label);
    if (!t) throw new Error('no "' + label + '" on the ' + key() + ' screen');
    const c = centre(t); await tap(c[0], c[1]);
  }
  async function tapImage(k) {
    const o = findImage(k);
    if (!o) throw new Error('no ' + k + ' image on the ' + key() + ' screen');
    const c = centre(o); await tap(c[0], c[1]);
  }
  async function drag(x0, y0, x1, y1, steps) {
    steps = steps || 10;
    mouse('mousedown', x0, y0, 1); await frames(2);
    for (let i = 1; i <= steps; i++) {
      mouse('mousemove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, 1);
      await frames(2);
    }
    mouse('mouseup', x1, y1, 0); await frames(20);
  }

  /* From any screen back to Home, through the UI. */
  async function goHome() {
    for (let i = 0; i < 6 && key() !== 'Home'; i++) {
      const p = play();
      if (p) {
        if (!p.overlay) { await tapImage('lvPause'); }
        await tapText('MAP'); await waitScene('LevelSelect');
      } else if (key() === 'LevelSelect' || key() === 'Shop') {
        await tapImage('icBackLight'); await waitScene('Home');
      } else {
        await frames(30);
      }
    }
  }

  /* ---------------- the paddle bot ----------------
     Moves the paddle with pointer moves, under the falling ball that will
     land first, aiming a little off-centre (a slow sweep) so the ball does
     not settle into a straight up-and-down loop. mode 'miss' keeps the
     paddle away from the ball. */
  /* Like a person, it picks a fresh spot on the paddle for each return -
     a fixed pattern can lock the ball into one path forever. */
  /* Each time the ball starts down it also decides where to SEND it, the
     way a player chasing the last bricks does: usually at a remaining brick
     (Play.onPaddleHit turns the contact point into the rebound angle, so the
     paddle is placed to produce the angle that points there), sometimes
     anywhere, so it still explores bank shots. */
  const bot = { off: 0, lastVy: 0, aimAt: null };
  function landingX(p, b) {
    const v = b.body.velocity;
    if (v.y <= 0) return b.x;
    const lo = p.physics.world.bounds.x + b.displayWidth / 2, hi = p.physics.world.bounds.right - b.displayWidth / 2;
    let x = b.x + v.x * (p.paddle.y - b.y) / v.y;
    const span = hi - lo;                       // fold side-wall bounces back in
    x = ((x - lo) % (2 * span) + 2 * span) % (2 * span);
    return lo + (x > span ? 2 * span - x : x);
  }
  function aim(p, mode) {
    const balls = [p.ball].concat(p.extraBalls).filter((b) => b.active);
    let target = null;
    balls.forEach((b) => { if (b.body.velocity.y > 0 && (!target || b.y > target.y)) target = b; });
    if (!target) target = p.ball;
    const half = p.paddle.displayWidth / 2;
    if (mode === 'miss') {
      mouse('mousemove', target.x < W() / 2 ? W() - half - 10 : half + 10, p.paddle.y, 0);
      return;
    }
    const vy = p.ball.body.velocity.y;
    if (vy > 0 && bot.lastVy <= 0) {
      const left = p.bricksGroup.getChildren().filter((b) => b.active && b.getData('hp') !== Infinity);
      bot.aimAt = left.length && Math.random() < 0.7 ? left[Math.floor(Math.random() * left.length)] : null;
      bot.off = (Math.random() * 2 - 1) * 0.75;
    }
    bot.lastVy = vy;
    const lx = landingX(p, target);
    let off = bot.off;
    if (bot.aimAt && bot.aimAt.active && target === p.ball) {
      const ang = Math.atan2(bot.aimAt.y - p.paddle.y, bot.aimAt.x - lx);   // upward, so negative
      off = Math.max(-0.9, Math.min(0.9, (ang + Math.PI / 2) / 1.05));
    }
    mouse('mousemove', lx - off * half, p.paddle.y, 0);
  }

  /* Play the current level until Level Complete / Out of Lives, a stuck
     ball, or the time limit. Taps to launch the way a player does. */
  async function playLevel(opts) {
    opts = opts || {};
    const mode = opts.mode || 'win';
    const maxFrames = (opts.maxSec || 300) * 60;
    const p = play();
    const r = { result: 'timeout', simSec: 0, livesLost: 0, flags: [] };
    let lastBricks = p.bricksLeft, lastBreak = 0, flat = 0, still = 0, lives = RUN().lives, up = -1;
    const flag = (f) => { if (r.flags.indexOf(f) < 0) r.flags.push(f); };
    const topY = p.physics.world.bounds.y;
    let f = 0;
    for (; f < maxFrames; f++) {
      if (p.overlay) { r.result = p.overlayKind; break; }
      if (opts.untilLives !== undefined && RUN().lives <= opts.untilLives) { r.result = 'lives'; break; }
      if (up === f) mouse('mouseup', p.paddle.x, H() * 0.6, 0);
      if (p.launch) {
        if (f % 15 === 0) { mouse('mousedown', p.paddle.x, H() * 0.6, 1); up = f + 2; }
      } else {
        aim(p, mode);
        const v = p.ball.body.velocity, sp = Math.hypot(v.x, v.y);
        flat = (Math.abs(v.y) < sp * 0.12) ? flat + 1 : 0;
        if (flat > 300) flag('ball ran near-horizontal for 5s+');
        still = sp < 1 ? still + 1 : 0;
        if (still > 60) flag('ball stopped dead mid-rally');
        if (p.ball.y < topY - px(60)) flag('ball escaped above the play area');
      }
      if (RUN().lives < lives) r.livesLost += lives - RUN().lives;
      lives = RUN().lives;
      if (p.bricksLeft < lastBricks) { lastBricks = p.bricksLeft; lastBreak = f; }
      if (mode === 'win' && f - lastBreak > 60 * (opts.stuckSec || 90)) {
        r.result = 'stuck';
        r.stuck = { bricksLeft: p.bricksLeft, ball: [Math.round(p.ball.x), Math.round(p.ball.y)],
          vel: [Math.round(p.ball.body.velocity.x), Math.round(p.ball.body.velocity.y)] };
        break;
      }
      stepOnce(f % 20 === 0);   // draw now and then so input stays ordered
      if (f % 120 === 119) await tick();
    }
    mouse('mouseup', p.paddle.x, H() * 0.6, 0);
    r.simSec = f / 60;
    await frames(10);
    return r;
  }

  const shownCoins = () => {          // the "+N" on Level Complete - not the lives badge
    const p = play();
    const t = p && p.overlay && p.overlay.find((o) => o.type === 'Text' && /^\+\d+$/.test(o.text));
    return t ? parseInt(t.text.slice(1), 10) : null;
  };

  /* ---------------- reporting ---------------- */
  function addRow(res) {
    const tr = document.createElement('tr');
    const st = document.createElement('td');
    st.textContent = res.ok ? 'PASS' : 'FAIL';
    st.className = res.ok ? 'pass' : 'fail';
    const body = document.createElement('td');
    const name = document.createElement('div');
    name.textContent = res.name;
    body.appendChild(name);
    if (res.fails.length || res.notes.length) {
      const ul = document.createElement('ul');
      res.fails.forEach((m) => { const li = document.createElement('li'); li.className = 'f'; li.textContent = m; ul.appendChild(li); });
      res.notes.forEach((m) => { const li = document.createElement('li'); li.className = 'n'; li.textContent = m; ul.appendChild(li); });
      body.appendChild(ul);
    }
    tr.appendChild(st); tr.appendChild(body);
    table.appendChild(tr);
  }

  async function test(name, fn) {
    statusEl.textContent = 'running: ' + name;
    const errBefore = errors.length, fails = [], notes = [];
    const check = (cond, msg) => { if (!cond) fails.push(msg); return !!cond; };
    const note = (msg) => notes.push(msg);
    try { await fn(check, note); }
    catch (e) { fails.push('stopped: ' + (e && e.message ? e.message : e)); }
    errors.slice(errBefore).forEach((e) => fails.push('page error: ' + e));
    const res = { name: name, ok: fails.length === 0, fails: fails, notes: notes };
    results.push(res);
    addRow(res);
  }

  /* Exposed for poking at a failure by hand from the console. */
  window.__playtest.api = { E, SAVE, RUN, W, H, px, scene, key, play, frames, seconds, waitScene,
    load, everything, texts, findText, findImage, centre, mouse, tap, tapText, tapImage, drag, goHome,
    aim, playLevel, game: () => w.game, win: () => w };
  if (/[?&]manual=1/.test(location.search)) { statusEl.textContent = 'manual mode - use window.__playtest.api'; window.__playtest.done = true; return; }

  /* =====================================================================
     THE PLAYTHROUGH
     ===================================================================== */

  await test('First launch: the game boots to the Home screen', async (check, note) => {
    await load(true, [390, 844]);
    check(key() === 'Home', 'expected Home, got ' + key());
    ['PLAY', 'LEVELS', 'SHOP'].forEach((b) => check(hasText(b), 'Home has no ' + b + ' button'));
    check(hasText('0'), 'coin balance does not read 0 on a new install');
    check(hasText('0 / 75 STARS'), 'star counter does not read 0 / 75 STARS');
    check(hasText('BEST 0'), 'best score does not read BEST 0');
    check(!hasText('PROGRESS WILL NOT BE SAVED IN THIS BROWSER MODE'), 'warns that progress will not be saved');
    note('canvas ' + W() + 'x' + H() + ' in a 390x844 frame');
  });

  await test('Every level layout can be finished (no sealed-off bricks)', async (check, note) => {
    const levels = E('LEVELS');
    levels.forEach((lv, i) => {
      const u = window.checkLevels.unreachable(lv.rows);
      check(!u.length, 'level ' + (i + 1) + ' ' + lv.name + ': ' + u.length + ' brick(s) the ball can never reach, at row/col ' +
        u.map(([r, c]) => (r + 1) + '/' + (c + 1)).join(' '));
    });
    note(levels.length + ' layouts checked');
  });

  await test('Settings: open, can\'t tap through, reset needs two taps, close', async (check) => {
    await tapImage('nbGear');
    check(hasText('SETTINGS'), 'gear did not open Settings');
    const lv = findText('LEVELS'); const c = centre(lv);
    await tap(c[0], c[1]);
    check(key() === 'Home' && hasText('SETTINGS'), 'a tap on the dimmed LEVELS button went through the popup');
    await tapText('RESET PROGRESS');
    check(hasText('TAP AGAIN TO ERASE'), 'first RESET tap did not ask for confirmation');
    await seconds(3);
    check(hasText('RESET PROGRESS'), 'RESET did not disarm after 2.5s');
    await tapText('CLOSE');
    check(!hasText('SETTINGS'), 'CLOSE did not close Settings');
    await tapImage('nbGear');
    check(hasText('SETTINGS'), 'gear did not work a second time');
    check(w.bbBack() === true && !hasText('SETTINGS'), 'back key did not close Settings');
    check(w.bbBack() === false, 'back key on Home should let the app exit');
  });

  await test('Coin "+" next to the balance opens the Shop', async (check) => {
    await tapImage('nbGear');
    await tapImage('nbPlus');
    check(key() === 'Home', 'tapping + with Settings open went through the popup');
    await tapText('CLOSE');
    await tapImage('nbPlus'); await frames(20);
    check(key() === 'Shop', 'tapping + on Home did not open the Shop (on ' + key() + ')');
    if (key() === 'Shop') {
      await tapImage('nbPlus'); await frames(20);
      check(key() === 'Shop', 'tapping + on the Shop screen left it');
    }
    await goHome();
    await tapText('LEVELS'); await waitScene('LevelSelect');
    const ls = scene();          // scrolled cards sit under the header and must not swallow the tap
    await drag(W() / 2, ls.viewTop + ls.viewH * 0.8, W() / 2, ls.viewTop + ls.viewH * 0.1); await frames(60);
    const c = centre(findImage('nbCoin')); await tap(c[0], c[1]); await frames(20);
    check(key() === 'Shop', 'tapping the coin capsule on a scrolled Level Select did not open the Shop');
    await goHome();
  });

  await test('Shop with no coins: browse, try to buy, tabs, back', async (check) => {
    await goHome();
    await tapText('SHOP'); await waitScene('Shop');
    const s = scene();
    check(hasText('CLASSIC') && hasText('EQUIPPED'), 'CLASSIC is not shown as EQUIPPED');
    const artY = E('tp')(408) + s.cardH * 0.30;
    await drag(W() * 0.7, artY, W() * 0.2, artY); await settle();
    check(s.page === 1, 'swipe left did not move to the next ball (page ' + s.page + ')');
    await tapText('300');
    check(s.hint.text === 'NOT ENOUGH COINS', 'no "NOT ENOUGH COINS" hint');
    check(SAVE().coins() === 0 && !SAVE().owns('ball', 'ember'), 'bought EMBER with 0 coins');
    await seconds(1.4);
    check(s.hint.text === 'EARN COINS BY BREAKING BRICKS', 'hint did not reset');
    await tap(s.dots[3].x, s.dotY);
    check(s.page === 3, 'tapping the 4th dot did not show the 4th ball');
    await drag(W() * 0.2, artY, W() * 0.8, artY);
    check(s.page === 2, 'swipe right did not go back a page');
    await tapText('PADDLES');
    check(s.tab === 'paddle' && hasText('WOOD'), 'PADDLES tab did not switch');
    await drag(W() * 0.2, artY, W() * 0.8, artY);
    check(s.page === 0, 'swiping right past the first card moved off it');
    await tapImage('icBackLight'); await waitScene('Home');
  });

  await test('Level select on a new save: locks, scrolling, back, start level 1', async (check) => {
    await goHome();
    await tapText('LEVELS'); await waitScene('LevelSelect');
    const ls = scene();
    check(hasText('THE STONE CIRCLE'), 'level 1 card missing');
    check(hasText('CLEAR THE PREVIOUS LEVEL'), 'locked level 2 does not say why');
    check(hasText('NEEDS 8 MORE STARS'), 'tier 2 does not show its star gate');
    check(hasText('PLAY LEVEL 1'), 'footer button is not PLAY LEVEL 1');
    await tapText('MOONLIT HOLLOW');
    check(key() === 'LevelSelect', 'tapping LOCKED level 2 started it');
    const y0 = ls.list.y;
    await drag(W() / 2, ls.viewTop + ls.viewH * 0.8, W() / 2, ls.viewTop + ls.viewH * 0.2);
    check(ls.list.y < y0, 'the list did not scroll');
    await tapImage('icBackLight');
    check(key() === 'Home', 'back button dead after scrolling');
    await tapText('LEVELS'); await waitScene('LevelSelect');
    await tapText('THE STONE CIRCLE'); await waitScene('Play');
    check(play().levelIndex === 0, 'tapping level 1 opened level ' + (play().levelIndex + 1));
  });

  await test('First rally: launch, HUD, pause, resume, map', async (check) => {
    const p = play();
    check(p.launchPrompt.visible, 'no TAP TO LAUNCH prompt');
    check(hasText('THE STONE CIRCLE'), 'level title missing');
    check(hasText(/^LEVEL 1 OF 25/), 'LEVEL 1 OF 25 subtitle missing');
    await tap(W() / 2, H() * 0.6); await frames(5);
    check(!p.launch && p.ball.body.velocity.y < 0, 'tap did not launch the ball upward');
    check(!p.launchPrompt.visible, 'launch prompt still visible in play');
    const padX = p.paddle.x;
    await tapImage('lvPause');
    check(p.paddle.x === padX, 'tapping pause dragged the paddle to the pause button');
    check(hasText('PAUSED') && p.physics.world.isPaused, 'pause button did not pause');
    const bx = p.ball.x, by = p.ball.y;
    await frames(60);
    check(p.ball.x === bx && p.ball.y === by, 'ball kept moving while paused');
    await tapText('RESUME'); await frames(10);
    check(!p.overlay && (p.ball.x !== bx || p.ball.y !== by), 'RESUME did not resume');
    await tapImage('lvPause'); await tapText('MAP'); await waitScene('LevelSelect');
    await tapImage('icBackLight'); await waitScene('Home');
    await tapText('PLAY'); await waitScene('Play');
    check(play().levelIndex === 0, 'PLAY did not open level 1');
  });

  await test('Losing a life', async (check) => {
    const p = play();
    const r = await playLevel({ mode: 'miss', untilLives: 2, maxSec: 30 });
    check(r.result === 'lives' && RUN().lives === 2, 'expected 2 lives left, got ' + RUN().lives);
    check(p.hearts[2].texture.key === 'heartEmpty', 'third heart not emptied');
    check(p.launch && p.launchPrompt.visible, 'ball not back on the paddle with TAP TO LAUNCH');
    mouse('mousemove', W() * 0.25, p.paddle.y, 0); await frames(3);
    check(Math.abs(p.ball.x - p.paddle.x) < 2, 'resting ball does not follow the paddle');
  });

  await test('Clearing level 1, then NEXT', async (check, note) => {
    const p = play();
    const coins0 = SAVE().coins();
    const r = await playLevel();
    check(r.result === 'complete', 'level 1 not cleared: ' + r.result + ' ' + JSON.stringify(r.stuck || r.flags));
    if (r.result !== 'complete') return;
    check(hasText('LEVEL COMPLETE'), 'no LEVEL COMPLETE title');
    const got = SAVE().coins() - coins0, shown = shownCoins();
    check(shown === got, 'screen says +' + shown + ' coins, balance went up ' + got);
    check(p.progPct.text === '100%', 'progress bar reads ' + p.progPct.text);
    check(p.scoreText.text === RUN().score.toLocaleString('en-US'), 'HUD score ' + p.scoreText.text + ' vs ' + RUN().score);
    check(SAVE().bestScore() === RUN().score, 'best score not saved on clear');
    r.flags.forEach((f) => check(false, f));
    note('cleared in ' + r.simSec.toFixed(0) + 's of play, ' + SAVE().starsFor(0) + ' stars, +' + got + ' coins');
    const score = RUN().score;
    await tapText('NEXT');
    check(p.levelIndex === 1 && !p.overlay, 'NEXT did not start level 2');
    check(RUN().lives === 3 && RUN().score === score, 'level 2 should start with 3 lives and keep the run score');
    check(p.launch, 'the NEXT tap also launched the ball');
    check(hasText('MOONLIT HOLLOW'), 'level 2 title missing');
  });

  await test('Running out of lives, TRY AGAIN, then MAP', async (check) => {
    const p = play();
    const before = RUN().score;
    const r = await playLevel({ mode: 'miss', maxSec: 60 });
    check(r.result === 'over' && hasText('OUT OF LIVES'), 'no OUT OF LIVES screen');
    check(hasText('2 / 25'), 'level row is not 2 / 25');
    if (hasText('NEW PERSONAL BEST')) check(SAVE().bestScore() === RUN().score, 'NEW PERSONAL BEST shown but not saved');
    await tapText('TRY AGAIN');
    check(!p.overlay && RUN().lives === 3, 'TRY AGAIN did not restart the level');
    check(p.launch, 'the TRY AGAIN tap also launched the ball');
    check(RUN().score === before, 'TRY AGAIN kept points from the failed attempt (' + RUN().score + ' vs ' + before + ')');
    await playLevel({ mode: 'miss', maxSec: 60 });
    await tapText('MAP'); await waitScene('LevelSelect');
  });

  await test('Power-ups: each one caught by the paddle', async (check, note) => {
    note('instrumentation: drops are spawned above the paddle instead of waiting for a random one');
    await goHome();
    await tapText('LEVELS'); await waitScene('LevelSelect');
    await tapText('THE STONE CIRCLE'); await waitScene('Play');
    const p = play();
    const catchDrop = async (kind) => {
      p.spawnDrop(p.paddle.x, p.paddle.y - px(260));
      const d = p.dropsGroup.getChildren()[p.dropsGroup.getChildren().length - 1];
      d.setData('kind', kind);
      for (let i = 0; i < 120 && d.active; i++) { mouse('mousemove', d.x, p.paddle.y, 0); await frames(1); }
      return !d.active;
    };
    check(await catchDrop(1), 'EXTRA LIFE drop was not caught');
    check(RUN().lives === 4 && p.livesPlus.visible && p.livesPlus.text === '+1', 'EXTRA LIFE: lives ' + RUN().lives + ', badge "' + p.livesPlus.text + '"');
    check(await catchDrop(0), 'MULTI-BALL drop was not caught');
    check(p.extraBalls.length === 2 && p.extraBalls.every((b) => b.body.velocity.y < 0), 'MULTI-BALL did not add two balls heading up');
    const bricks0 = p.bricksLeft;
    check(await catchDrop(2), 'LASER drop was not caught');
    check(p.laserT > 0, 'LASER did not start');
    await seconds(3);
    check(p.bricksLeft < bricks0, 'LASER bolts broke no bricks in 3s');
    const base = p.paddle.displayWidth;
    check(await catchDrop(3), 'WIDE drop was not caught');
    check(p.paddle.displayWidth > base * 1.3, 'WIDE did not widen the paddle');
    check(Math.abs(p.paddle.body.width - p.paddle.displayWidth) < 2, 'WIDE: paddle hitbox ' + p.paddle.body.width + ' vs sprite ' + p.paddle.displayWidth);
    check(await catchDrop(4), 'SLOW drop was not caught');
    check(p.physics.world.timeScale > 1, 'SLOW did not slow time');
    /* The laser broke bricks, and broken bricks drop RANDOM power-ups that
       may land on the paddle during the wait and restart a timer - correct
       behaviour, so wait those out too rather than fail on them. */
    const later = [];
    const realApply = p.applyPowerUp;
    p.applyPowerUp = function (k) { later.push(E('POWERUPS')[k].label); return realApply.call(p, k); };
    await seconds(12);
    for (let i = 0; i < 5 && (p.wideT > 0 || p.slowT > 0 || p.laserT > 0); i++) await seconds(12);
    delete p.applyPowerUp;
    if (later.length) note('random drops also caught while waiting: ' + later.join(', '));
    check(Math.abs(p.paddle.displayWidth - base) < 2, 'WIDE did not wear off after 11s');
    check(Math.abs(p.paddle.body.width - base) < 2, 'paddle hitbox did not shrink back after WIDE');
    check(p.physics.world.timeScale === 1, 'SLOW did not wear off after 9s');
    check(p.laserT <= 0, 'LASER did not wear off after 9s');
  });

  await test('Buying everything in the shop', async (check, note) => {
    note('instrumentation: 5,000 coins credited instead of grinding for them');
    await goHome();
    SAVE().addCoins(5000);
    const start = SAVE().coins();
    await tapText('SHOP'); await waitScene('Shop');
    const s = scene();
    const buyTab = async (tab) => {
      if (s.tab !== tab) await tapText(tab === 'ball' ? 'BALLS' : 'PADDLES');
      for (let i = 1; i < E('SHOP')[tab].length; i++) {
        const it = E('SHOP')[tab][i];
        await tap(s.dots[i].x, s.dotY); await settle();
        const c0 = SAVE().coins();
        await tapText(String(it.price));
        check(SAVE().owns(tab, it.id), 'tapping ' + it.price + ' did not buy ' + it.name);
        check(c0 - SAVE().coins() === it.price, it.name + ' cost ' + (c0 - SAVE().coins()) + ', price says ' + it.price);
        check(SAVE().equippedId(tab) === it.id, it.name + ' not auto-equipped');
        check(hasText('EQUIPPED'), it.name + ' card does not say EQUIPPED');
      }
    };
    await buyTab('ball');
    await buyTab('paddle');
    check(start - SAVE().coins() === 4700, 'whole shop cost ' + (start - SAVE().coins()) + ', expected 4700');
    await tapText('BALLS');
    await tap(s.dots[0].x, s.dotY); await settle();
    await tapText('EQUIP');
    check(SAVE().equippedId('ball') === 'classic', 'EQUIP did not switch back to CLASSIC');
    await tapImage('icBackLight'); await waitScene('Home');
    check(hasText(String(SAVE().coins())), 'Home coin balance not updated');
  });

  /* Equip through the shop UI, then start level `lvl` from the level list. */
  async function equipAndPlay(ball, paddle, lvl) {
    await goHome();
    await tapText('SHOP'); await waitScene('Shop');
    const s = scene();
    for (const [tab, id] of [['ball', ball], ['paddle', paddle]]) {
      if (s.tab !== tab) await tapText(tab === 'ball' ? 'BALLS' : 'PADDLES');
      const i = E('SHOP')[tab].findIndex((it) => it.id === id);
      await tap(s.dots[i].x, s.dotY); await settle();
      if (SAVE().equippedId(tab) !== id) await tapText('EQUIP');
    }
    await tapImage('icBackLight'); await waitScene('Home');
    await tapText('LEVELS'); await waitScene('LevelSelect');
    await tapText(E('LEVELS')[lvl].name); await waitScene('Play');
    return play();
  }

  await test('Shop items actually change the game', async (check, note) => {
    let p = await equipAndPlay('ember', 'wide', 0);
    check(p.ballTex === 'rdBall4' && p.ball.texture.key === 'rdBall4', 'EMBER ball art not used in play');
    const wantW = Math.round(266 * E('paddleScaleFor')(0) * 1.14);
    check(p.paddleW === wantW, 'WIDE paddle width ' + p.paddleW + ', expected ' + wantW);
    const dBricks = () => p.bricksGroup.getChildren().filter((b) => b.active && b.getData('type') === 'damaged').length;
    const d0 = dBricks();
    let cracked = false;
    for (let i = 0; i < 8 && dBricks() === d0; i++) {
      await playLevel({ maxSec: 5 });
      cracked = cracked || p.bricksGroup.getChildren().some((b) => b.active && /^brickCracked/.test(b.texture.key));
      if (p.overlay) break;
    }
    check(dBricks() < d0, 'no two-hit brick broke in 40s with EMBER');
    check(!cracked, 'EMBER: a two-hit brick was left cracked instead of breaking');

    p = await equipAndPlay('bolt', 'sticky', 0);
    await tap(p.paddle.x, H() * 0.6); await frames(2);
    const sp = Math.hypot(p.ball.body.velocity.x, p.ball.body.velocity.y), want = px(E('speedFor')(0)) * 1.08;
    check(Math.abs(sp - want) < 2, 'BOLT launch speed ' + sp.toFixed(0) + ', expected ' + want.toFixed(0));
    let caught = false;
    for (let f = 0; f < 60 * 20 && !caught; f++) { aim(p, 'win'); await frames(1); caught = p.launch; }
    check(caught, 'STICKY paddle never caught the ball');
    if (caught) {
      check(RUN().lives === 3, 'STICKY catch cost a life');
      await tap(p.paddle.x, H() * 0.6);
      let bounced = false;
      for (let f = 0; f < 60 * 20 && !bounced; f++) {
        aim(p, 'win'); const vy = p.ball.body.velocity.y; await frames(1);
        if (p.launch) break;
        bounced = vy > 0 && p.ball.body.velocity.y < 0 && p.ball.y > p.paddle.y - px(140);
      }
      check(bounced && !p.launch, 'STICKY caught the ball a second time in the same life');
    }

    p = await equipAndPlay('magnet', 'cannon', 0);
    check(p.mods.homing > 0 && p.mods.autoFire === 7, 'MAGNET/CANNON modifiers not applied');
    let shots = 0;
    const realCreate = p.boltsGroup.create.bind(p.boltsGroup);
    p.boltsGroup.create = function () { shots++; return realCreate.apply(null, arguments); };
    note('instrumentation: bolt creation counted for CANNON');
    await tap(p.paddle.x, H() * 0.6);
    for (let f = 0; f < 60 * 15; f++) { aim(p, 'win'); await frames(1); if (p.overlay) break; }
    check(shots >= 2, 'CANNON fired ' + shots + ' bolts in 15s (expected one every 7s)');
    p.boltsGroup.create = realCreate;
    await equipAndPlay('classic', 'wood', 0);
  });

  await test('Campaign: a new player plays all 25 levels in order', async (check, note) => {
    await load(true);
    await tapText('PLAY'); await waitScene('Play');
    const rows = [];
    let guard = 0, gateStops = 0;
    const tries = {}, hard = [];
    while (guard++ < 90) {
      const p = play();
      const idx = p.levelIndex;
      const coins0 = SAVE().coins();
      const r = await playLevel({ maxSec: 600, stuckSec: 150 });   // late levels can take minutes
      r.flags.forEach((f) => check(false, 'level ' + (idx + 1) + ': ' + f));
      if (r.result !== 'complete') {
        tries[idx] = (tries[idx] || 0) + 1;
        /* A last brick in a pocket can take a long time to hit - a player
           would quit and restart, so do that. Fail only if it never clears. */
        if (tries[idx] < 5 && r.result !== 'lives') {
          hard.push('L' + (idx + 1) + ' ' + r.result + ' with ' + p.bricksLeft + ' left');
          if (r.result === 'over') { await tapText('TRY AGAIN'); continue; }
          await tapImage('lvPause'); await tapText('MAP'); await waitScene('LevelSelect');
          await tapText(/^PLAY LEVEL \d+$/); await waitScene('Play');
          continue;
        }
        check(false, 'level ' + (idx + 1) + ' never cleared in 5 tries, last "' + r.result + '" ' + JSON.stringify(r.stuck || ''));
        break;
      }
      const got = SAVE().coins() - coins0, shown = shownCoins();
      check(shown === got, 'level ' + (idx + 1) + ': screen +' + shown + ' vs credited ' + got);
      check(p.progPct.text === '100%', 'level ' + (idx + 1) + ': progress reads ' + p.progPct.text);
      rows.push('L' + (idx + 1) + ' ' + r.simSec.toFixed(0) + 's ' + SAVE().starsFor(idx) + '★ +' + got + (r.livesLost ? ' (-' + r.livesLost + ' life)' : ''));
      if (idx === 24) {
        check(hasText('ALL LEVELS CLEAR') && hasText('FINISH'), 'last level does not say ALL LEVELS CLEAR / FINISH');
        await tapText('FINISH'); await waitScene('LevelSelect');
        break;
      }
      if (SAVE().isUnlocked(idx + 1)) {
        await tapText('NEXT');
        check(play().levelIndex === idx + 1, 'NEXT after level ' + (idx + 1) + ' opened level ' + (play().levelIndex + 1));
      } else {
        gateStops++;
        check(hasText(/^NEXT TIER NEEDS \d+ MORE STARS$/), 'locked next tier is not explained on Level Complete');
        await tapText('MAP'); await waitScene('LevelSelect');
        await tapText(/^PLAY LEVEL \d+$/); await waitScene('Play');
        check(SAVE().isUnlocked(play().levelIndex), 'PLAY LEVEL opened a locked level');
      }
    }
    check(SAVE().starsFor(24) > 0, 'never cleared level 25');
    note(SAVE().totalStars() + '/75 stars, ' + SAVE().coins() + ' coins, best ' + SAVE().bestScore() + (gateStops ? ', stopped at a star gate ' + gateStops + 'x' : ''));
    if (hard.length) note('needed a restart: ' + hard.join(', '));
    note(rows.join(' | '));
  });

  await test('Replaying a mastered level pays half', async (check, note) => {
    await goHome();
    await tapText('LEVELS'); await waitScene('LevelSelect');
    const ls = scene();          // the list opens on the current level - scroll back to the top
    for (let i = 0; i < 6 && ls.scrollY < 0; i++) { await drag(W() / 2, ls.viewTop + px(40), W() / 2, ls.viewTop + ls.viewH - px(40)); await frames(60); }
    await tapText('THE STONE CIRCLE'); await waitScene('Play');
    const p = play();
    const mastered = SAVE().starsFor(0) === 3, c0 = SAVE().coins();
    const r = await playLevel();
    check(r.result === 'complete', 'replay of level 1 did not complete');
    const got = SAVE().coins() - c0;
    const full = 20 * 2 + 25;
    if (mastered) check(got === Math.floor(full / 2), 'mastered replay paid ' + got + ', expected ' + Math.floor(full / 2));
    check(shownCoins() === got, 'screen +' + shownCoins() + ' vs credited ' + got);
    note((mastered ? 'mastered' : 'not mastered') + ' replay paid +' + got);
    await tapText('MAP'); await waitScene('LevelSelect');
  });

  await test('Back key on every screen', async (check) => {
    await goHome();
    check(w.bbBack() === false, 'Home: back should let the app exit');
    await tapText('LEVELS'); await waitScene('LevelSelect');
    check(w.bbBack() === true, 'Level Select: back not handled'); await waitScene('Home');
    await tapText('SHOP'); await waitScene('Shop');
    check(w.bbBack() === true, 'Shop: back not handled'); await waitScene('Home');
    await tapText('PLAY'); await waitScene('Play');
    const p = play();
    await tap(W() / 2, H() * 0.6);
    check(w.bbBack() === true && p.overlayKind === 'pause' && p.overlay, 'Play: back did not pause');
    check(w.bbBack() === true && !p.overlay, 'Pause: back did not resume');
    await playLevel({ mode: 'miss', maxSec: 60 });
    check(p.overlayKind === 'over', 'could not reach Out of Lives');
    check(w.bbBack() === true, 'Out of Lives: back not handled'); await waitScene('LevelSelect');
  });

  await test('Quitting and reopening keeps progress', async (check) => {
    await goHome();
    const before = JSON.stringify(SAVE().data);
    await load(false);
    check(JSON.stringify(SAVE().data) === before, 'save changed across a reload');
    check(hasText(String(SAVE().coins())), 'Home coin balance wrong after reload');
    check(hasText(SAVE().totalStars() + ' / 75 STARS'), 'star count wrong after reload');
    await tapText('SHOP'); await waitScene('Shop');
    const s = scene();
    for (const tab of ['ball', 'paddle']) {
      if (s.tab !== tab) await tapText(tab === 'ball' ? 'BALLS' : 'PADDLES');
      E('SHOP')[tab].forEach((it) => {
        if (it.price > 0 && SAVE().owns(tab, it.id) && it.price !== SAVE().coins()) {
          check(!hasText(String(it.price)), it.name + ' is owned but shows its price again after reload');
        }
      });
    }
    check(hasText('EQUIPPED'), 'no item shows EQUIPPED after reload');
  });

  await test('Fast double taps', async (check) => {
    await goHome();
    const t = findText('PLAY'), c = centre(t);
    mouse('mousedown', c[0], c[1], 1); mouse('mouseup', c[0], c[1], 0);
    mouse('mousedown', c[0], c[1], 1); mouse('mouseup', c[0], c[1], 0);
    await frames(30);
    check(key() === 'Play', 'double-tapping PLAY did not land in Play');
    const p = play();
    /* instrumentation: break every brick to reach Level Complete quickly */
    await tap(W() / 2, H() * 0.6);
    p.bricksGroup.getChildren().slice().forEach((b) => { if (b.active && b.getData('hp') !== Infinity) { b.setData('hp', 1); p.damageBrick(b); } });
    await frames(5);
    check(p.overlayKind === 'complete', 'did not reach Level Complete');
    const idx = p.levelIndex, coins = SAVE().coins();
    /* the last level says FINISH (to the level map) rather than NEXT */
    const label = hasText('NEXT') ? 'NEXT' : 'FINISH';
    const nc = centre(findText(label));
    mouse('mousedown', nc[0], nc[1], 1); mouse('mouseup', nc[0], nc[1], 0);
    mouse('mousedown', nc[0], nc[1], 1); mouse('mouseup', nc[0], nc[1], 0);
    await frames(30);
    if (label === 'NEXT') check(p.levelIndex === idx + 1, 'double-tapping NEXT moved ' + (p.levelIndex - idx) + ' levels');
    else check(key() === 'LevelSelect', 'double-tapping FINISH did not land on the level map');
    check(SAVE().coins() === coins, 'double-tapping ' + label + ' changed the coin balance');
  });

  await test('Screen size change (split screen / rotation)', async (check, note) => {
    await goHome();
    frameEl.style.width = '412px'; frameEl.style.height = '915px';
    await sleep(400); await frames(30);
    check(key() === 'Home', 'Home did not come back after a resize');
    await tapText('SHOP'); await waitScene('Shop');
    check(key() === 'Shop', 'buttons dead after a resize');
    await goHome();
    await tapText('PLAY'); await waitScene('Play');
    const p = play();
    await tap(W() / 2, H() * 0.6);
    await playLevel({ maxSec: 8 });
    const left = p.bricksLeft, idx = p.levelIndex;
    frameEl.style.width = '390px'; frameEl.style.height = '760px';
    await sleep(400); await frames(30);
    const q = play();
    check(!!q && q.levelIndex === idx, 'resize mid-level left Play or changed level');
    if (q && q.bricksLeft > left) note('a resize mid-level restarts the level from scratch (the app is portrait-locked, so on phones only split-screen triggers this)');
  });

  /* ---------------- done ---------------- */
  const failed = results.filter((r) => !r.ok).length;
  summaryEl.textContent = (results.length - failed) + ' passed, ' + failed + ' failed';
  summaryEl.className = failed ? 'fail' : 'pass';
  statusEl.textContent = 'finished';
  window.__playtest.done = true;
})().catch((e) => {
  document.getElementById('status').textContent = 'harness crashed: ' + (e && e.stack || e);
  window.__playtest = Object.assign(window.__playtest || {}, { done: true, crashed: String(e && e.stack || e) });
});
