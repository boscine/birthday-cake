/* ==========================================================================
   CENTERED STATIONARY ARCADE PIXEL ART CAKE (CANVAS 2D PIXEL ENGINE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // PHASE STATE
  //
  //  FLOW DIAGRAM:
  //    'countdown'   ──(targetDate reached)──▶ 'candle-gate'
  //    'candle-gate' ──(all 5 candles lit)───▶ 'revealed'
  //
  //  'countdown'   : full-screen black + countdown text (before target date)
  //  'candle-gate' : full-screen black + click 5 candles one by one to light them
  //  'revealed'    : full pixel cake shown, music plays, blow-out interaction active
  //
  //  updateCountdown() polls every 1 s and drives countdown → candle-gate.
  //  onCandleClick()   drives candle-gate → revealed once all 5 are lit.
  // ==========================================================================
  let currentPhase = 'countdown'; // updated by each enterXxxPhase() — single source of truth

  // Countdown target date for the birthday reveal.
  const targetDate = new Date(2026, 7, 6, 0, 0, 0);

  // ---- DOM refs ----
  const lockOverlay    = document.getElementById('lock-overlay');
  const countdownText  = document.getElementById('countdown-text');
  const cakeCanvas     = document.getElementById('pixel-cake-canvas');
  const candleGate     = document.getElementById('candle-gate');
  const candleTargets  = document.getElementById('candle-targets');
  const spCanvas       = document.getElementById('sparkles-canvas');
  const messageGate       = document.getElementById('message-gate');
  const messageGateInner  = document.querySelector('.message-gate-inner');
  const messageGateText   = document.getElementById('message-gate-text');
  const messageProceedBtn = document.getElementById('message-proceed-btn');
  const messageSecondLine = document.getElementById('message-second-line');

  // ---- Canvas context ----
  const ctx    = cakeCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const spCtx  = spCanvas.getContext('2d');

  // ==========================================================================
  // PHASE TRANSITIONS
  //  Always use these functions to move between phases — never mutate DOM directly.
  //  Each function: (1) sets currentPhase, (2) updates overlay/canvas visibility.
  // ==========================================================================

  // ── (re)enter countdown: full-screen black + countdown text ───────────────
  function enterCountdownPhase() {
    currentPhase = 'countdown';
    cakeCanvas.style.visibility = 'hidden';   // cake not visible yet
    candleGate.classList.add('hidden');
    messageGate.classList.add('hidden');
    lockOverlay.classList.remove('hidden');   // show black screen + countdown text
    lockOverlay.style.display = 'flex';
    lockOverlay.style.visibility = 'visible';
  }

  // ── countdown → candle-gate: black screen + sequential candle targets ─────
  // ⚠ IMPORTANT: buildCandleTargets() reads CANDLE_DEFS / litCount / gateCandles
  //   which are declared ~50 lines below. The bootstrap call for updateCountdown()
  //   is placed AFTER those declarations (search "BOOTSTRAP") to avoid a
  //   Temporal Dead Zone ReferenceError that would crash the whole script.
  function enterCandleGatePhase() {
    currentPhase = 'candle-gate';
    lockOverlay.classList.add('hidden');      // remove countdown text
    cakeCanvas.style.visibility = 'hidden';  // cake still hidden
    buildCandleTargets();                     // build #candle-targets + start flicker anim
    candleGate.classList.remove('hidden');   // show black screen + candle targets
  }

  // ── candle-gate → revealed: full cake + music + interactions ─────────────
  // Called by messageProceedBtn click handler.
  function enterRevealedPhase() {
    currentPhase = 'revealed';
    if (gateAnimId) { cancelAnimationFrame(gateAnimId); gateAnimId = null; } // stop gate flicker
    candleGate.classList.add('hidden');       // remove candle gate overlay
    cakeCanvas.style.visibility = 'visible'; // show pixel cake
    triggerBurstSparks();                     // celebration sparks
    playBackgroundMusic();                    // start music
  }

  // ── candle-gate → message-phase: full-screen message before reveal ───────
  function enterMessagePhase() {
    currentPhase = 'message-phase';
    if (gateAnimId) { cancelAnimationFrame(gateAnimId); gateAnimId = null; }
    lockOverlay.classList.add('hidden');
    candleGate.classList.add('hidden');
    cakeCanvas.style.visibility = 'hidden'; // keep cake hidden until revealed phase

    // Reset inner state so re-entry is clean and the overlay is guaranteed to be visible.
    messageGateText.style.display = '';
    messageProceedBtn.style.display = '';
    messageGate.style.pointerEvents = 'auto';
    messageGate.style.display = 'flex';
    messageGate.style.visibility = 'visible';
    messageGate.style.opacity = '1';
    if (messageGateInner) messageGateInner.style.background = 'rgba(0, 0, 0, 0.82)';
    messageGate.classList.remove('fading-out');
    messageSecondLine.classList.add('hidden');
    messageGate.classList.remove('hidden');
    // Music starts only after the user clicks proceed
  }

  if (messageProceedBtn) {
    messageProceedBtn.addEventListener('click', () => {
      messageGateText.style.display = 'none';
      messageProceedBtn.style.display = 'none';
      messageGate.style.pointerEvents = 'none'; // let clicks reach the cake underneath
      if (messageGateInner) messageGateInner.style.background = 'transparent';
      enterRevealedPhase();
    });
  }

  // ==========================================================================
  // COUNTDOWN LOGIC
  //  Polled every 1 s by setInterval (bootstrapped after CANDLE_DEFS below).
  //  Uses currentPhase so the countdown → candle-gate transition fires exactly once.
  // ==========================================================================
  function updateCountdown() {
    const now    = new Date();
    const diffMs = targetDate - now;

    if (diffMs <= 0) {
      // Time is up — transition from 'countdown' to 'candle-gate' (fires once)
      if (currentPhase === 'countdown') enterCandleGatePhase();
      return; // no-op if already in candle-gate, message-phase, or revealed
    }

    // Still before target date — ensure countdown overlay is visible on first load.
    if (currentPhase !== 'countdown' || lockOverlay.classList.contains('hidden')) {
      enterCountdownPhase();
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days    = Math.floor(totalSeconds / (3600 * 24));
    const hours   = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let parts = [];
    if (days > 0) parts.push(days === 1 ? '1 day' : `${days} days`);
    if (hours > 0 || days > 0) parts.push(hours === 1 ? '1 hour' : `${hours} hours`);
    if (days === 0) {
      if (minutes > 0) parts.push(minutes === 1 ? '1 minute' : `${minutes} minutes`);
      parts.push(seconds === 1 ? '1 second' : `${seconds} seconds`);
    }

    countdownText.textContent = parts.join(' ') + ' left';
  }

  // ⚠ Bootstrap intentionally omitted here — see "BOOTSTRAP" section below.

  // ==========================================================================
  // CANDLE GATE — build 5 clickable targets
  //
  //  cx/cy are in the 128×128 pixel-canvas coordinate space (same as `candles` array).
  // ==========================================================================
  const CANDLE_DEFS = [
    { cx: 50, cy: 26 },
    { cx: 57, cy: 26 },
    { cx: 64, cy: 24 }, // centre candle is 2px taller
    { cx: 71, cy: 26 },
    { cx: 78, cy: 26 },
  ];

  let litCount = 0;
  const gateCandles = []; // { canvas, ctx, isLit, label }
  let gateTick = 0;
  let gateFrameCount = 0; // counts raw rAF frames; redraws only every 9th (~150 ms at 60 fps)
  let gateAnimId = null;

  // Draw one pixel candle onto a 7×20 canvas
  function drawGateCandle(cctx, isLit, tick) {
    cctx.clearRect(0, 0, 7, 20);
    // Candle body (yellow)
    cctx.fillStyle = '#ffe600';
    cctx.fillRect(2, 10, 3, 8);
    // White stripe
    cctx.fillStyle = '#ffffff';
    cctx.fillRect(2, 12, 3, 2);
    // Wick
    cctx.fillStyle = '#111111';
    cctx.fillRect(3, 8, 1, 2);
    if (isLit) {
      const off = tick % 3;
      // Outer flame (orange)
      cctx.fillStyle = '#ff6600';
      cctx.fillRect(1, 3 + (off % 2), 5, 5);
      // Mid flame (yellow)
      cctx.fillStyle = '#ffee00';
      cctx.fillRect(2, 4 + (off === 1 ? 0 : 1), 3, 3);
      // Core (white)
      cctx.fillStyle = '#ffffff';
      cctx.fillRect(3, 5, 1, 1);
    }
  }

  function animateGateCandles() {
    gateFrameCount++;
    // Throttle to ~6-7 fps (every 9 rAF frames ≈ 150 ms) to match the cake's own
    // setInterval(renderPixelCake, 150) flicker rate — prevents candle from looking
    // unnaturally fast compared to the revealed cake.
    if (gateFrameCount % 9 === 0) {
      gateTick++;
      gateCandles.forEach(({ ctx, isLit }) => drawGateCandle(ctx, isLit, gateTick));
    }
    gateAnimId = requestAnimationFrame(animateGateCandles);
  }

  function buildCandleTargets() {
    candleTargets.innerHTML = '';
    litCount = 0;
    gateCandles.length = 0;
    if (gateAnimId) cancelAnimationFrame(gateAnimId);

    CANDLE_DEFS.forEach((def, i) => {
      const pctLeft   = (def.cx / 128) * 100;
      const pctTop    = (def.cy / 128) * 100;
      const pctWidth  = (7 / 128) * 100;
      const pctHeight = (20 / 128) * 100;

      const el = document.createElement('div');
      el.className = i === 0 ? 'candle-target' : 'candle-target target-hidden';
      el.style.left   = `${pctLeft}%`;
      el.style.top    = `${pctTop}%`;
      el.style.width  = `${pctWidth}%`;
      el.style.height = `${pctHeight}%`;
      el.style.transform = 'translate(-50%, -50%)';
      el.dataset.index = i;

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = 'light the candle';

      const cnv = document.createElement('canvas');
      cnv.width  = 7;
      cnv.height = 20;
      cnv.className = 'pixel-candle';
      const cctx = cnv.getContext('2d');
      cctx.imageSmoothingEnabled = false;

      gateCandles.push({ ctx: cctx, isLit: false, label });
      drawGateCandle(cctx, false, 0);

      el.appendChild(label);
      el.appendChild(cnv);
      el.addEventListener('click', () => onCandleClick(el, i));
      candleTargets.appendChild(el);
    });

    animateGateCandles();
  }

  function onCandleClick(el, idx) {
    if (el.classList.contains('lit')) return;

    el.classList.add('lit');
    gateCandles[idx].isLit = true;

    // Hide label
    gateCandles[idx].label.classList.add('label-hidden');

    // Spark burst at candle canvas location
    const cnv  = el.querySelector('.pixel-candle');
    const rect = cnv.getBoundingClientRect();
    triggerPixelSparks(rect.left + rect.width / 2, rect.top, 14);

    litCount++;

    // Reveal next candle
    const next = candleTargets.querySelector(`[data-index="${idx + 1}"]`);
    if (next) setTimeout(() => next.classList.remove('target-hidden'), 350);

    if (litCount === CANDLE_DEFS.length) {
      setTimeout(enterMessagePhase, 900);
    }
  }

  // ==========================================================================
  // BOOTSTRAP — start the phase system
  //
  //  Placed HERE (after CANDLE_DEFS, litCount, gateCandles, gateTick, gateAnimId
  //  are all declared above) so that when updateCountdown() immediately calls
  //  enterCandleGatePhase() → buildCandleTargets(), those variables are no longer
  //  in the Temporal Dead Zone.
  //
  //  Moving this call earlier (e.g. right after updateCountdown() is defined)
  //  causes a ReferenceError on CANDLE_DEFS and silently kills the whole script,
  //  leaving only the red body background visible.
  // ==========================================================================
  enterCountdownPhase();                // ensure the countdown overlay is visible immediately
  lockOverlay.style.display = 'flex';
  lockOverlay.style.visibility = 'visible';
  updateCountdown();                    // run once immediately to set initial phase
  setInterval(updateCountdown, 1000);   // then poll every 1 s for countdown → gate transition

  // ==========================================================================
  // CAKE CANDLE STATE
  // ==========================================================================
  const candles = [
    { x: 50, y: 26, isLit: true },
    { x: 57, y: 26, isLit: true },
    { x: 64, y: 24, isLit: true }, // Center taller candle
    { x: 71, y: 26, isLit: true },
    { x: 78, y: 26, isLit: true }
  ];

  let flameTick        = 0;
  let showHappyBirthday = false;
  let scrollX1 = 0;
  let scrollX2 = -80;

  // ==========================================================================
  // AUDIO
  // ==========================================================================
  let audioCtx        = null;
  const bgMusic       = document.getElementById('bg-music');
  let synthMusicPlaying = false;
  let musicTimeout    = null;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function startChiptuneMusic() {
    if (synthMusicPlaying) return;
    initAudioContext();
    if (!audioCtx) return;
    synthMusicPlaying = true;

    const melody = [
      264, 264, 297, 264, 352, 330,
      264, 264, 297, 264, 396, 352,
      264, 264, 528, 440, 352, 330, 297,
      466, 466, 440, 352, 396, 352
    ];
    const durations = [
      0.25, 0.25, 0.5, 0.5, 0.5, 1.0,
      0.25, 0.25, 0.5, 0.5, 0.5, 1.0,
      0.25, 0.25, 0.5, 0.5, 0.5, 0.5, 1.0,
      0.25, 0.25, 0.5, 0.5, 0.5, 1.0
    ];

    let noteIdx = 0;
    function playNextNote() {
      if (!synthMusicPlaying) return;
      const freq = melody[noteIdx];
      const dur  = durations[noteIdx];

      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur * 0.85);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur * 0.9);

      noteIdx = (noteIdx + 1) % melody.length;
      musicTimeout = setTimeout(playNextNote, dur * 450);
    }

    playNextNote();
  }

  function stopChiptuneMusic() {
    synthMusicPlaying = false;
    if (musicTimeout) clearTimeout(musicTimeout);
  }

  function stopBackgroundMusic() {
    if (bgMusic) bgMusic.pause();
    stopChiptuneMusic();
  }

  function playBackgroundMusic() {
    if (bgMusic) {
      bgMusic.play().catch(() => startChiptuneMusic());
    } else {
      startChiptuneMusic();
    }
  }

  function playBlowSound() {
    initAudioContext();
    if (!audioCtx) return;
    const now  = audioCtx.currentTime;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  function playFanfare() {
    initAudioContext();
    if (!audioCtx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.1);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + idx * 0.1);
      osc.stop(audioCtx.currentTime + idx * 0.1 + 0.25);
    });
  }

  // ==========================================================================
  // DRAW RETRO PIXEL ART CAKE
  // ==========================================================================
  function renderPixelCake() {
    ctx.clearRect(0, 0, 128, 128);

    // 1. Arcade Cake Stand (Gold Pixel Pedestal)
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(44, 114, 40, 4);
    ctx.fillStyle = '#ffe600';
    ctx.fillRect(48, 112, 32, 2);
    // Stem
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(58, 106, 12, 6);
    // Plate Rim
    ctx.fillStyle = '#ffe600';
    ctx.fillRect(24, 102, 80, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(28, 102, 72, 1);

    // 2. Bottom Cake Tier (Purple Velvet)
    ctx.fillStyle = '#4c1d95'; // Dark purple shadow
    ctx.fillRect(32, 80, 64, 22);
    ctx.fillStyle = '#7e22ce'; // Main purple
    ctx.fillRect(34, 80, 60, 20);
    ctx.fillStyle = '#a855f7'; // Purple highlight
    ctx.fillRect(34, 80, 20, 20);

    // Gold Trim Line
    ctx.fillStyle = '#ffe600';
    ctx.fillRect(32, 100, 64, 2);

    // 3. Middle Cake Tier (Vanilla & Strawberry Drips)
    ctx.fillStyle = '#9f1239'; // Dark drip shadow
    ctx.fillRect(40, 60, 48, 20);
    ctx.fillStyle = '#fff0f5'; // Cream main
    ctx.fillRect(42, 60, 44, 18);
    // Strawberry Drips
    ctx.fillStyle = '#ff416c';
    ctx.fillRect(42, 60, 44, 4);
    ctx.fillRect(46, 64, 4, 6);
    ctx.fillRect(58, 64, 6, 8);
    ctx.fillRect(72, 64, 4, 5);

    // 4. TOP TIER - VIBRANT PIXEL PINK FROSTING TOP
    ctx.fillStyle = '#c026d3'; // Deep pink shadow
    ctx.fillRect(48, 42, 32, 18);
    ctx.fillStyle = '#ff007f'; // Vibrant Hot Pink Top Coating
    ctx.fillRect(50, 42, 28, 16);
    ctx.fillStyle = '#ff69b4'; // Pastel Pink Highlight
    ctx.fillRect(50, 42, 12, 16);

    // Pink Icing Drip Top Cap
    ctx.fillStyle = '#ff1493'; // Deep Rich Pink Icing
    ctx.fillRect(48, 40, 32, 4);
    // Drips hanging down
    ctx.fillRect(52, 44, 3, 5);
    ctx.fillRect(60, 44, 4, 7);
    ctx.fillRect(70, 44, 3, 4);

    // Pixel Whipped Cream Swirls (White dots)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(50, 39, 3, 2);
    ctx.fillRect(58, 39, 3, 2);
    ctx.fillRect(67, 39, 3, 2);
    ctx.fillRect(75, 39, 3, 2);

    // Pixel Sprinkles
    ctx.fillStyle = '#ffe600';
    ctx.fillRect(53, 47, 2, 1);
    ctx.fillRect(65, 52, 1, 2);
    ctx.fillRect(73, 48, 2, 1);

    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(57, 50, 2, 1);
    ctx.fillRect(68, 46, 1, 2);
    ctx.fillRect(62, 54, 2, 1);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(52, 53, 1, 2);
    ctx.fillRect(71, 53, 2, 1);

    ctx.fillStyle = '#b000ff';
    ctx.fillRect(61, 48, 2, 1);
    ctx.fillRect(56, 54, 1, 2);

    // 5. Pixel Lit Candles on Top of Pink Tier
    candles.forEach((c, idx) => {
      // Candle Body (Yellow striped)
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(c.x, c.y + 6, 3, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(c.x, c.y + 8, 3, 2);

      // Wick
      ctx.fillStyle = '#111111';
      ctx.fillRect(c.x + 1, c.y + 4, 1, 2);

      // Pixel Flame (Flickering Animation)
      if (c.isLit) {
        const offset = (flameTick + idx) % 3;
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(c.x - 1, c.y - 1 + offset % 2, 5, 5);
        ctx.fillStyle = '#ffee00';
        ctx.fillRect(c.x, c.y + (offset === 1 ? 0 : 1), 3, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(c.x + 1, c.y + 1, 1, 1);
      }
    });

    flameTick++;
  }

  // Animation Loop (6 FPS for authentic retro pixel flicker)
  setInterval(renderPixelCake, 150);

  // ==========================================================================
  // CAKE CLICK INTERACTION (only active after reveal)
  // ==========================================================================
  cakeCanvas.addEventListener('click', (e) => {
    // Ignore clicks before full reveal
    if (cakeCanvas.style.visibility === 'hidden') return;

    initAudioContext();

    const litCandles = candles.filter(c => c.isLit);
    if (litCandles.length > 0) {
      litCandles[0].isLit = false;
      playBlowSound();
      triggerPixelSparks(e.clientX, e.clientY, 30);

      if (candles.every(c => !c.isLit)) {
        showHappyBirthday = true;
        scrollX1 = 0;
        scrollX2 = -200;
        playFanfare();
        playBackgroundMusic();
        triggerBurstSparks();
        messageGate.style.display = 'none';
        messageGate.style.visibility = 'hidden';
        messageGate.classList.add('hidden');
      }
    }
  });

  // ==========================================================================
  // PIXEL SPARKS & FULL-WIDTH MARQUEE OVERLAY
  // ==========================================================================
  let sparks = [];

  function resizeSpCanvas() {
    spCanvas.width  = window.innerWidth;
    spCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeSpCanvas);
  resizeSpCanvas();

  function triggerPixelSparks(x, y, count = 30) {
    const colors = ['#ff007f', '#ffe600', '#00f0ff', '#ffffff', '#b000ff'];
    for (let i = 0; i < count; i++) {
      sparks.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        size: Math.floor(Math.random() * 4) + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0
      });
    }
  }

  function triggerBurstSparks() {
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    for (let b = 0; b < 4; b++) {
      setTimeout(() => {
        triggerPixelSparks(
          cx + (Math.random() - 0.5) * 300,
          cy + (Math.random() - 0.5) * 200
        );
      }, b * 200);
    }
  }

  // Disproportionate row state tracker (up to 25 rows)
  let rowScrolls = new Array(25).fill(0);

  function drawFullWidthMarquee() {
    if (!showHappyBirthday) return;

    const phrase = 'HAPPY BIRTHDAY';
    const font = {
      'H': ['101', '101', '111', '101', '101'],
      'A': ['010', '101', '111', '101', '101'],
      'P': ['110', '101', '110', '100', '100'],
      'Y': ['101', '101', '010', '010', '010'],
      'B': ['110', '101', '110', '101', '110'],
      'I': ['111', '010', '010', '010', '111'],
      'R': ['110', '101', '110', '101', '101'],
      'T': ['111', '010', '010', '010', '010'],
      'D': ['110', '101', '101', '101', '110'],
      ' ': ['000', '000', '000', '000', '000']
    };

    const baseP = Math.max(2, Math.floor(window.innerWidth / 320));

    const rowSpecs = [
      { scaleMultiplier: 1.8, speed: 0.06,   dir: -1, gap: 14 },
      { scaleMultiplier: 0.9, speed: 0.045,  dir:  1, gap: 10 },
      { scaleMultiplier: 2.6, speed: 0.075,  dir: -1, gap: 18 },
      { scaleMultiplier: 1.1, speed: 0.05,   dir:  1, gap: 12 },
      { scaleMultiplier: 2.1, speed: 0.07,   dir: -1, gap: 15 },
      { scaleMultiplier: 0.8, speed: 0.0375, dir:  1, gap: 10 },
      { scaleMultiplier: 3.0, speed: 0.0875, dir: -1, gap: 20 },
      { scaleMultiplier: 1.3, speed: 0.055,  dir:  1, gap: 12 },
      { scaleMultiplier: 1.9, speed: 0.065,  dir: -1, gap: 16 },
      { scaleMultiplier: 1.0, speed: 0.045,  dir:  1, gap: 10 },
      { scaleMultiplier: 2.3, speed: 0.08,   dir: -1, gap: 17 },
      { scaleMultiplier: 1.4, speed: 0.06,   dir:  1, gap: 13 }
    ];

    let currentY = 10;
    let rIdx     = 0;
    const phraseBlockWidth = 53;

    // Vibrant vibrant arcade color palette array (Fill + Deep Shadow pair per row)
    const rowPalettes = [
      { fill: '#ff007f', shadow: '#3b001e' }, // Neon Hot Pink
      { fill: '#00f0ff', shadow: '#003a40' }, // Cyber Cyan
      { fill: '#ffe600', shadow: '#474000' }, // Electric Gold
      { fill: '#b000ff', shadow: '#2d0042' }, // Neon Purple
      { fill: '#ff5500', shadow: '#421600' }, // Vivid Orange
      { fill: '#00ff66', shadow: '#00421a' }  // Bright Lime Green
    ];

    while (currentY < window.innerHeight + 80 && rIdx < 25) {
      const spec            = rowSpecs[rIdx % rowSpecs.length];
      const palette         = rowPalettes[rIdx % rowPalettes.length];
      const P               = Math.max(2, Math.round(baseP * spec.scaleMultiplier));
      const phraseGapBlocks = spec.gap;
      const unitWidth       = (phraseBlockWidth + phraseGapBlocks) * P;

      rowScrolls[rIdx] += spec.dir * spec.speed * P;
      if (spec.dir < 0 && rowScrolls[rIdx] <= -unitWidth) rowScrolls[rIdx] += unitWidth;
      if (spec.dir > 0 && rowScrolls[rIdx] >= 0)          rowScrolls[rIdx] -= unitWidth;

      const totalReps = Math.ceil(window.innerWidth / unitWidth) + 3;

      for (let rep = -1; rep < totalReps; rep++) {
        let currentX = rowScrolls[rIdx] + rep * unitWidth;

        for (let i = 0; i < phrase.length; i++) {
          const char      = phrase[i];
          const glyph     = font[char] || font[' '];
          const charWidth = (char === ' ') ? 2 : 3;

          for (let row = 0; row < 5; row++) {
            for (let col = 0; col < charWidth; col++) {
              if (glyph[row] && glyph[row][col] === '1') {
                const px = currentX + col * P;
                const py = currentY + row * P;
                if (px >= -P && px < window.innerWidth + P && py >= -P && py < window.innerHeight + P) {
                  // Dynamic deep shadow
                  spCtx.fillStyle = palette.shadow;
                  spCtx.fillRect(px + P, py + P, P, P);
                  // Vibrant main color
                  spCtx.fillStyle = palette.fill;
                  spCtx.fillRect(px, py, P, P);
                }
              }
            }
          }
          currentX += (charWidth + 1) * P;
        }
      }

      currentY += (5 * P) + (6 * P);
      rIdx++;
    }
  }

  function loopSparks() {
    spCtx.clearRect(0, 0, spCanvas.width, spCanvas.height);

    drawFullWidthMarquee();

      // Efficient array cleanup from tail end
      for (let idx = sparks.length - 1; idx >= 0; idx--) {
        const s = sparks[idx];
        s.x  += s.vx;
        s.y  += s.vy;
        s.vy += 0.2; // Gravity
        s.life -= 0.03;

        spCtx.fillStyle = s.color;
        spCtx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);

        if (s.life <= 0) sparks.splice(idx, 1);
      }
      requestAnimationFrame(loopSparks);
    }
    loopSparks();

});
