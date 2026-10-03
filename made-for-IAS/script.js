const dateBoxes = Array.from(document.querySelectorAll('.date-box'));
const unlockButton = document.getElementById('unlockButton');
const passwordScreen = document.getElementById('passwordScreen');
const passwordError = document.getElementById('passwordError');
const correctPassword = '07082007';

function normalizeDigit(value) {
  return value.replace(/\D/g, '').slice(0, 1);
}

function getEnteredDate() {
  return dateBoxes.map((box) => normalizeDigit(box.value)).join('');
}

function focusNextBox(currentIndex) {
  const next = dateBoxes[currentIndex + 1];
  if (next) next.focus();
}

function unlockWebsite() {
  const entered = getEnteredDate();
  if (entered === correctPassword) {
    passwordScreen.classList.add('hidden');
    dateBoxes.forEach((box) => {
      box.value = '';
      box.placeholder = box.getAttribute('aria-label').includes('Day') ? 'D' : box.getAttribute('aria-label').includes('Month') ? 'M' : 'Y';
    });
    passwordError.textContent = '';
    localStorage.setItem('ias-site-unlocked', 'true');
    // Opening the site is the first meaningful interaction: unlock Web Audio,
    // fade the track in and greet with a soft chime.
    ensureAudioContext();
    startMusic(disarmAutoplayFallback);
    playSoftChime();
    return;
  }

  passwordError.textContent = 'Incorrect date. Use the IAS birth date in dd mm yyyy format.';
  dateBoxes[0].focus();
}

localStorage.removeItem('ias-site-unlocked');
passwordScreen.classList.remove('hidden');

dateBoxes.forEach((box, index) => {
  box.addEventListener('input', () => {
    box.value = normalizeDigit(box.value);
    if (box.value) focusNextBox(index);
    passwordError.textContent = '';
  });

  box.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !box.value && index > 0) {
      const prev = dateBoxes[index - 1];
      prev.focus();
      prev.value = '';
    }

    if (event.key === 'Enter') {
      unlockWebsite();
    }
  });

  box.addEventListener('focus', () => {
    box.select();
  });
});

unlockButton.addEventListener('click', unlockWebsite);

const photoPaths = Array.from({length:15}, (_,i) => `assets/photo-${String(i+1).padStart(2,'0')}.jpg`);
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxCaption = document.getElementById('lightboxCaption');
const responseOverlay = document.getElementById('responseOverlay');
const responseCard = document.getElementById('responseCard');
const musicBtn = document.getElementById('musicBtn');

// Smooth scrolling buttons
for (const btn of document.querySelectorAll('[data-scroll]')) {
  btn.addEventListener('click', () => document.querySelector(btn.dataset.scroll)?.scrollIntoView({behavior:'smooth'}));
}

// Reveal-on-scroll
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
      playRevealSparkle();
    }
  });
},{threshold:0.12});
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Gallery lightbox
const photos = [...document.querySelectorAll('.photo-card')];
photos.forEach((card, index) => {
  card.addEventListener('click', () => {
    playClick();
    lightboxImage.src = photoPaths[index];
    lightboxCaption.textContent = `MEMORY ${String(index+1).padStart(2,'0')} · SHRADDHA ♥`;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden','false');
  });
});
function closeLightbox(){
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden','true');
}
document.getElementById('closeLightbox').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if(e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeLightbox(); });

// Handwritten letter pages — open the real pages in the same cinematic lightbox.
document.querySelectorAll('.letter-page').forEach((page, index) => {
  page.addEventListener('click', () => {
    playLetterChime();
    lightboxImage.src = `assets/letter-page-${String(index+1).padStart(2,'0')}.jpg`;
    lightboxCaption.textContent = `ANMOL → SHRADDHA · HANDWRITTEN LETTER · PAGE ${index+1}`;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden','false');
  });
});

// Final answer interactions — never pressure the recipient.
function openResponse(type){
  const content = {
    yes: {
      title:'Tumne “haan” kaha… ❤️',
      body:'Shayad is screen se zyada khoobsurat reply koi ho hi nahi sakta. Aaj se ek nayi kahaani officially hum dono ki hai. Thank you for choosing this “us”.',
      emoji:'✨'
    },
    later: {
      title:'Take your time. 🌷',
      body:'Mere liye tumhara comfort sabse important hai. Socho, feel karo, apna time lo — koi pressure nahi. Jab dil ready ho, tab jawab dena.',
      emoji:'🤍'
    },
    no: {
      title:'Thank you for being honest. 🤍',
      body:'Meri feelings sach thi, isliye tumhara honest answer bhi respect ke layak hai. Tumhari happiness aur comfort mere liye important rahenge.',
      emoji:'🌷'
    }
  }[type];
  responseCard.innerHTML = `<div style="font-size:3rem;margin-bottom:10px">${content.emoji}</div><h3>${content.title}</h3><p>${content.body}</p><button id="closeResponse">Close</button>`;
  responseOverlay.classList.add('open');
  responseOverlay.setAttribute('aria-hidden','false');
  document.getElementById('closeResponse').addEventListener('click', closeResponse);
  if(type === 'yes') makeConfetti();
}
function closeResponse(){ responseOverlay.classList.remove('open'); responseOverlay.setAttribute('aria-hidden','true'); }
responseOverlay.addEventListener('click', e => { if(e.target === responseOverlay) closeResponse(); });
function sendResponseNotification(answer){
  if(answer !== 'yes' && answer !== 'later') return;
  fetch('/api/response', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({answer})
  }).catch(() => {});
}
document.querySelectorAll('.answer').forEach(btn => btn.addEventListener('click', () => {
  const answer = btn.dataset.answer;
  if(answer !== 'yes' && answer !== 'later') return;
  if(answer === 'yes') playSuccess(); else playGentleTone();
  sendResponseNotification(answer);
  openResponse(answer);
}));

// The playful "No" button is intentionally evasive: hover/tap makes it jump
// to a new safe position instead of opening the no-response. The YES button
// remains completely normal and easy to press.
const noButton = document.getElementById('noButton');
const answerBox = document.getElementById('answerButtons');
const noTeases = ['No 😈','Too slow 😜','Almost! 😂','Try again 🙈','Nahi pakad paogi 😌','Oops! 💨','Dil ne mana kar diya 😭','Hehe… no? 😏'];
let noMoves = 0;
function moveNoButton(){
  if(!noButton || !answerBox) return;

  const pad = 8;
  const viewportWidth = Math.max(window.innerWidth, 320);
  const viewportHeight = Math.max(window.innerHeight, 480);
  const button = noButton.getBoundingClientRect();
  const box = answerBox.getBoundingClientRect();

  const maxX = Math.max(pad, Math.min(viewportWidth - button.width - pad, box.right - button.width));
  const minX = Math.min(Math.max(pad, box.left), maxX);
  const maxY = Math.max(pad, Math.min(viewportHeight - button.height - pad, box.bottom - button.height));
  const minY = Math.min(Math.max(pad, box.top), maxY);
  const x = minX + Math.random() * Math.max(0, maxX - minX);
  const y = minY + Math.random() * Math.max(0, maxY - minY);

  noButton.style.position = 'fixed';
  noButton.style.left = `${Math.min(Math.max(x, pad), viewportWidth - button.width - pad)}px`;
  noButton.style.top = `${Math.min(Math.max(y, pad), viewportHeight - button.height - pad)}px`;
  noButton.style.zIndex = '80';
  noButton.style.transform = `rotate(${(Math.random()*10-5).toFixed(1)}deg) scale(${(0.94+Math.random()*0.12).toFixed(2)})`;
  noButton.textContent = noTeases[noMoves % noTeases.length];
  noMoves++;
}
if(noButton){
  noButton.addEventListener('mouseenter', () => { moveNoButton(); playNoTease(); });
  noButton.addEventListener('pointerdown', e => { e.preventDefault(); moveNoButton(); playNoTease(); });
  noButton.addEventListener('focus', moveNoButton);
  noButton.addEventListener('click', e => { e.preventDefault(); moveNoButton(); playNoTease(); });
  window.addEventListener('resize', () => { if(noMoves) moveNoButton(); });
}

// ---------------------------------------------------------------------------
// IMMERSIVE AUDIO
// One looping background track + short generated effects (Web Audio API).
// AUDIO_CONFIG is the only place to change: drop your own romantic
// instrumental at assets/romantic-music.mp3 (or point music.src elsewhere) and
// nothing else in this file needs to change.
// The visitor always keeps control: the music button mutes the track and every
// effect at once, and the choice is remembered for the browser session.
// ---------------------------------------------------------------------------
const AUDIO_CONFIG = {
  music: {
    src: 'assets/romantic-music.mp3',
    volume: 0.22,        // background level, kept well under the effects
    fadeIn: 2800,        // smooth fade-in once playback is allowed
    fadeOut: 800,        // smooth fade-out before pausing
    duckTo: 0.7,         // music dips while a short effect plays
    duckTime: 900
  },
  effects: {
    bus: 0.85,           // effect bus headroom, keeps the mix unclipped
    revealGap: 1500,     // min. ms between reveal sparkles (no scroll spam)
    teaseGap: 340        // min. ms between "No" boops
  }
};

const motionQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false, addEventListener() {} };
const prefersReducedMotion = () => motionQuery.matches === true;
const audioSupported = () => Boolean(window.AudioContext || window.webkitAudioContext);

let audioCtx = null;
let effectsBus = null;
let musicEl = null;          // the one and only audio element on the page
let musicOn = true;          // visitor master switch (track + effects)
let musicAudible = false;
let fadeHandle = 0;
let duckHandle = 0;
let lastRevealSound = -Infinity; // first reveal / first tease always plays
let lastTeaseSound = -Infinity;
let fallbackArmed = false;
let effectsPending = false;

function readMusicPreference(){
  try { return window.sessionStorage.getItem('ias-audio-state'); } catch { return null; }
}
function rememberMusicPreference(){
  try { window.sessionStorage.setItem('ias-audio-state', musicOn ? 'on' : 'off'); } catch { /* private mode */ }
}
musicOn = readMusicPreference() !== 'off';

// A limiter on the master bus keeps overlapping effects from clipping.
function ensureAudioContext(){
  if(!audioSupported()) return null;
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 20;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.22;
    effectsBus = audioCtx.createGain();
    effectsBus.gain.value = AUDIO_CONFIG.effects.bus;
    effectsBus.connect(limiter);
    limiter.connect(audioCtx.destination);
  }
  if(audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

// Some browsers only report "running" one tick after resume(); wait once.
function withEffects(fn){
  const ctx = ensureAudioContext();
  if(!ctx) return;
  if(ctx.state === 'running'){ fn(); return; }
  if(effectsPending) return;
  effectsPending = true;
  const onChange = () => {
    if(ctx.state !== 'running') return;
    ctx.removeEventListener('statechange', onChange);
    effectsPending = false;
    fn();
  };
  ctx.addEventListener('statechange', onChange);
  ctx.resume().catch(() => {});
}

function effectsLive(){
  return musicOn && audioCtx && effectsBus && audioCtx.state === 'running';
}

function fadeMusicTo(level, duration){
  if(!musicEl) return;
  window.cancelAnimationFrame(fadeHandle);
  const from = musicEl.volume;
  const startedAt = performance.now();
  const step = now => {
    const progress = Math.min(1, (now - startedAt) / Math.max(1, duration));
    musicEl.volume = from + (level - from) * progress;
    if(progress < 1) fadeHandle = window.requestAnimationFrame(step);
  };
  fadeHandle = window.requestAnimationFrame(step);
}

function duckMusic(){
  if(!musicAudible || !musicEl) return;
  window.clearTimeout(duckHandle);
  fadeMusicTo(AUDIO_CONFIG.music.volume * AUDIO_CONFIG.music.duckTo, 240);
  duckHandle = window.setTimeout(() => {
    if(musicAudible) fadeMusicTo(AUDIO_CONFIG.music.volume, 900);
  }, AUDIO_CONFIG.music.duckTime);
}

function musicElement(){
  if(musicEl) return musicEl;
  musicEl = new Audio();
  musicEl.preload = 'none';
  musicEl.loop = true;
  musicEl.src = AUDIO_CONFIG.music.src;
  musicEl.volume = 0;
  musicEl.setAttribute('aria-hidden','true');
  document.body.appendChild(musicEl);
  return musicEl;
}

// Starts (or resumes) the single looping track. A blocked autoplay promise is
// swallowed silently and simply leaves the fallback gesture listener armed.
function startMusic(onStarted){
  if(!musicOn){ if(onStarted) onStarted(); return; }
  if(musicAudible){ if(onStarted) onStarted(); return; }
  const el = musicElement();
  let request = null;
  try { request = el.play(); } catch { request = null; }
  const begun = () => {
    musicAudible = true;
    fadeMusicTo(AUDIO_CONFIG.music.volume, AUDIO_CONFIG.music.fadeIn);
    syncMusicButton();
    if(onStarted) onStarted();
  };
  if(request && typeof request.then === 'function'){
    request.then(begun).catch(() => {});
  } else {
    begun();
  }
}

function stopMusic(){
  musicAudible = false;
  fadeMusicTo(0, AUDIO_CONFIG.music.fadeOut);
  window.setTimeout(() => { if(!musicAudible && musicEl) musicEl.pause(); }, AUDIO_CONFIG.music.fadeOut + 140);
}

const FIRST_GESTURES = ['pointerdown','touchstart','keydown','click'];
function disarmAutoplayFallback(){
  if(!fallbackArmed) return;
  fallbackArmed = false;
  FIRST_GESTURES.forEach(type => document.removeEventListener(type, handleFirstGesture, true));
}
function handleFirstGesture(){
  ensureAudioContext();
  if(musicOn && !musicAudible) startMusic(disarmAutoplayFallback);
  else disarmAutoplayFallback();
}
function armAutoplayFallback(){
  if(fallbackArmed || musicAudible || !audioSupported()) return;
  fallbackArmed = true;
  FIRST_GESTURES.forEach(type => document.addEventListener(type, handleFirstGesture, true));
}

function syncMusicButton(){
  if(!musicBtn) return;
  const live = musicOn && musicAudible;
  musicBtn.classList.toggle('is-playing', live);
  musicBtn.classList.toggle('is-muted', !musicOn);
  musicBtn.setAttribute('aria-pressed', String(live));
  musicBtn.setAttribute('aria-label', live ? 'Turn sound off' : 'Turn sound on');
  const label = musicBtn.querySelector('.music-label');
  if(label) label.textContent = live ? 'music on' : 'soft ambience';
}

// ---- generated sound effects ----------------------------------------------
function voice(options){
  if(!effectsLive()) return;
  const { freq, to, type = 'sine', delay = 0, duration = 1.2, peak = 0.1, attack = 0.02, cutoff = 0, detune = 0 } = options;
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, start);
  if(to) osc.frequency.exponentialRampToValueAtTime(to, start + duration * 0.85);
  const amp = audioCtx.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(peak, start + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  let tail = amp;
  if(cutoff){
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    amp.connect(filter);
    tail = filter;
  }
  osc.connect(amp);
  tail.connect(effectsBus);
  osc.start(start);
  osc.stop(start + duration + 0.06);
  osc.onended = () => { osc.disconnect(); amp.disconnect(); if(tail !== amp) tail.disconnect(); };
  duckMusic();
}

function playSoftChime(){
  withEffects(() => {
    voice({ freq: 880, duration: 2, peak: 0.1, attack: 0.05 });
    voice({ freq: 1320, duration: 1.6, peak: 0.055, attack: 0.07 });
    voice({ freq: 1760, duration: 1.1, peak: 0.025, attack: 0.1, cutoff: 5200 });
  });
}
function playSparkle(){
  withEffects(() => [2093, 2637, 3136].forEach((freq, i) => {
    voice({ freq, duration: 0.5, peak: 0.035 - i * 0.006, attack: 0.008, delay: i * 0.07 });
  }));
}
function playClick(){
  withEffects(() => voice({ freq: 1500, to: 900, type: 'triangle', duration: 0.09, peak: 0.07, attack: 0.005 }));
}
function playSuccess(){
  withEffects(() => [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    voice({ freq, duration: 1.7 - i * 0.15, peak: 0.11, attack: 0.012, delay: i * 0.1 });
    voice({ freq: freq * 2, duration: 0.9, peak: 0.028, attack: 0.02, delay: i * 0.1 });
  }));
}
function playGentleTone(){
  withEffects(() => {
    voice({ freq: 349.23, duration: 1.5, peak: 0.1, attack: 0.12, cutoff: 1600 });
    voice({ freq: 440, duration: 1.7, peak: 0.085, attack: 0.16, delay: 0.22, cutoff: 1600 });
  });
}
function playLetterChime(){
  withEffects(() => {
    voice({ freq: 523.25, duration: 2.1, peak: 0.1, attack: 0.09, cutoff: 2600 });
    voice({ freq: 659.25, duration: 2.4, peak: 0.075, attack: 0.14, delay: 0.16, cutoff: 2400 });
    voice({ freq: 1046.5, duration: 1.2, peak: 0.028, attack: 0.1, delay: 0.3, cutoff: 4200 });
  });
}
function playBoop(){
  withEffects(() => voice({ freq: 240, to: 150, type: 'triangle', duration: 0.2, peak: 0.09, attack: 0.006, cutoff: 900 }));
}

// Reveal sparkles are throttled so fast scrolling never machine-guns them.
function playRevealSparkle(){
  if(prefersReducedMotion() || !effectsLive()) return;
  const now = performance.now();
  if(now - lastRevealSound < AUDIO_CONFIG.effects.revealGap) return;
  lastRevealSound = now;
  playSparkle();
}
function playNoTease(){
  if(!effectsLive()) return;
  const now = performance.now();
  if(now - lastTeaseSound < AUDIO_CONFIG.effects.teaseGap) return;
  lastTeaseSound = now;
  playBoop();
}

musicBtn.addEventListener('click', () => {
  playClick();
  musicOn = !musicOn;
  rememberMusicPreference();
  if(musicOn){
    ensureAudioContext();
    startMusic(disarmAutoplayFallback);
  } else {
    stopMusic();
  }
  syncMusicButton();
});

// Pause while the tab is hidden, resume in place when it comes back.
document.addEventListener('visibilitychange', () => {
  if(!musicEl) return;
  if(document.hidden){
    if(!musicEl.paused) musicEl.pause();
  } else if(musicOn && musicAudible && musicEl.paused){
    const request = musicEl.play();
    if(request && typeof request.catch === 'function') request.catch(() => {});
  }
});

syncMusicButton();
armAutoplayFallback();

function makeConfetti(){
  const count = 90;
  for(let i=0;i<count;i++){
    const el=document.createElement('div');
    el.textContent = i%4===0 ? '♥' : '✦';
    Object.assign(el.style,{position:'fixed',left:(45+Math.random()*10)+'%',top:'48%',zIndex:100,fontSize:(10+Math.random()*18)+'px',color:i%3===0?'#ffd6e3':'#f8d6a8',pointerEvents:'none',transition:'transform 1.5s ease,opacity 1.5s ease'});
    document.body.appendChild(el);
    requestAnimationFrame(()=>{
      const x=(Math.random()-0.5)*900, y=520+Math.random()*520;
      el.style.transform=`translate(${x}px,${y}px) rotate(${Math.random()*700-350}deg)`;
      el.style.opacity='0';
    });
    setTimeout(()=>el.remove(),1600);
  }
}

// Friendly error fallback for missing personalized photos.
window.addEventListener('load',()=>{
  document.querySelectorAll('.photo-card img').forEach((img, index)=>{
    img.addEventListener('error',()=>{
      img.src='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3b1728"/><stop offset="1" stop-color="#12070d"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="450" cy="470" r="80" fill="#ff7aa8" opacity=".18"/><text x="450" y="610" text-anchor="middle" fill="#ffe1ea" font-family="Georgia" font-size="46">Photo ${String(index+1).padStart(2,'0')}</text><text x="450" y="665" text-anchor="middle" fill="#cdbfc8" font-family="Arial" font-size="22">Replace with Shraddha's photo</text></svg>`);
    }, {once:true});
  });
});
