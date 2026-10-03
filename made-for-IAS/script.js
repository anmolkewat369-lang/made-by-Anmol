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
    }
  });
},{threshold:0.12});
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Gallery lightbox
const photos = [...document.querySelectorAll('.photo-card')];
photos.forEach((card, index) => {
  card.addEventListener('click', () => {
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
  noButton.addEventListener('mouseenter', moveNoButton);
  noButton.addEventListener('pointerdown', e => { e.preventDefault(); moveNoButton(); });
  noButton.addEventListener('focus', moveNoButton);
  noButton.addEventListener('click', e => { e.preventDefault(); moveNoButton(); });
  window.addEventListener('resize', () => { if(noMoves) moveNoButton(); });
}

// Tiny ambient sound using Web Audio API, only starts after a deliberate tap.
let audioCtx = null;
let ambience = null;
function startAmbience(){
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const master = audioCtx.createGain();
  master.gain.value = 0.035;
  master.connect(audioCtx.destination);
  const notes = [261.63,329.63,392,493.88];
  notes.forEach((freq,i)=>{
    const osc = audioCtx.createOscillator();
    osc.type='sine'; osc.frequency.value=freq; osc.detune.value=(i-1)*2;
    const gain=audioCtx.createGain(); gain.gain.value=0.07;
    osc.connect(gain).connect(master); osc.start();
    gain.gain.exponentialRampToValueAtTime(0.018,audioCtx.currentTime+9+i*1.3);
  });
  ambience = master;
  musicBtn.innerHTML='♪ <span>ambience on</span>';
}
function stopAmbience(){ if(ambience){ ambience.disconnect(); ambience=null; } if(audioCtx){ audioCtx.suspend(); } musicBtn.innerHTML='♪ <span>soft ambience</span>'; }
let soundOn=false;
musicBtn.addEventListener('click',()=>{soundOn=!soundOn; if(soundOn) startAmbience(); else stopAmbience();});

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
