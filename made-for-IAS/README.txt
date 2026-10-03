SHRADDHA PROPOSAL — by Anmol
================================

This is a pure HTML/CSS/JS romantic proposal website. No build step is required.

1) PHOTOS
----------
Put your 15 photos into:
  assets/photo-01.jpg
  assets/photo-02.jpg
  ...
  assets/photo-15.jpg

For best visual quality, use portrait images with a 3:4-ish ratio. JPG or WEBP works best.
If you use a different extension, update the `photoPaths` line in script.js.

2) PERSONALIZED LETTER
----------------------
Open index.html and replace the content inside:
  <div id="letterText" class="letter-text"> ... </div>

Paste your real personalized letter there. Keep the <p>...</p> structure for clean spacing.

3) RUN LOCALLY
--------------
The static site can still be opened directly as index.html, but the response
notification API requires Vercel's local server and configured environment.

From this directory:
  npm install
  npx vercel login
  npx vercel link
  npx vercel env pull .env.local
  npm run dev

Add the environment variables listed in .env.example to the linked Vercel
project before running `vercel env pull`. `npm install` installs no additional
packages; this project uses Node.js built-ins and the built-in fetch API.

4) RESPONSE NOTIFICATIONS
-------------------------
The YES and time buttons send only their selected answer to POST /api/response.
The visitor receives the existing response UI immediately. The server validates
and records the answer in the Upstash Redis list `proposal:responses`, with a
server-generated UUID and ISO timestamp. Responses from the same network
address are limited to one notification every 60 seconds; only an HMAC of the
network address is used as the short-lived Redis cooldown key. No user-agent,
browser fingerprint, or other device data is stored.

Configure the required Upstash Redis REST URL/token and a random
RATE_LIMIT_SECRET in Vercel Environment Variables. Generate the latter with:
  node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

Email is sent with Resend when RESEND_API_KEY, RESEND_FROM_EMAIL (a verified
sender), and NOTIFICATION_EMAIL are configured. SMS is sent with Twilio only
when SMS_PROVIDER=twilio and all TWILIO_* and NOTIFICATION_PHONE variables are
configured. WhatsApp uses Meta's official Cloud API only when all
WHATSAPP_* variables are configured. Create two approved WhatsApp Business
message templates whose bodies exactly match the YES and LATER messages, then
set their template names and language in the corresponding environment
variables. Missing or failed notification providers are safely skipped/logged;
they do not change the visitor experience. Do not add credentials to source
files or commit .env.local.

The private response dashboard was not added: the site has no authentication
system, and an unauthenticated dashboard would expose private responses.

5) DEPLOY
---------
Deploy this repository on Vercel with the project Root Directory set to
`made-for-IAS`. Add the variables in .env.example under Project Settings >
Environment Variables, then deploy or redeploy. The API function requires
Vercel and Upstash; GitHub Pages/Netlify static hosting alone will not run it.

6) TEST
-------
From this directory, run:
  npm test

7) MUSIC AND SOUND
------------------
A temporary romantic instrumental is placed at:
  assets/romantic-music.mp3

Replace that file with your favourite song (keep the same name) or point
AUDIO_CONFIG.music.src in script.js at another file. That single constant near
the top of the audio section in script.js is the only place to change; no other
JavaScript has to be touched. It also holds the volume (0.22), the fade timings
and the ducking level.

Short UI sounds (chimes, sparkles, clicks, the YES/LATER/NO answers) are
generated with the Web Audio API, so no extra audio files are needed. The track
loops continuously, fades in once the visitor unlocks the site, and never
restarts during normal interaction. If a browser blocks audible autoplay, the
playback promise is caught silently and the music simply begins with the first
tap or key press. The button in the top bar always silences everything.

8) CUSTOMIZE
-------------
- Name is currently Shraddha and Anmol.
- All main proposal lines are in Hinglish.
- The final screen offers Haan / Time / No so the recipient can answer freely.
- The music button toggles the music and every sound effect at once, and the
  choice is remembered for the current browser session.

TIP
---
The strongest result will come from replacing the 15 placeholders and adding your exact real letter. The website is intentionally designed so your real memories stay at the center.
