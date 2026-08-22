// ============================================================
// ALL SLIDING DOOR REPAIRS — APP SCRIPT  (Direction 2 retheme)
// ============================================================
// Renders every section from content.js, wires Lenis + GSAP, and
// installs the reveal layer. It contains NO copy, NO phone number,
// NO price and NO photo path — all of that lives in content.js.
//
// Motion doctrine (DESIGN.md): things that slide. clip-path wipes on
// IO + a 1500ms failsafe; ONE rAF source (gsap.ticker driving Lenis);
// the two scroll-scrub effects (hero parallax, roller rotation) read
// scroll INSIDE that ticker callback behind the desktop gate. The
// drag-the-door demo is CUT (client decision) — #problem is the
// symptom picker only.
// ============================================================

import { content } from './content.js';

const REDUCED  = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NO_HOVER = !matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.classList.add('has-js');

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Escape anything going into innerHTML. content.js is ours, but a
// Content Studio override (content.client.js) is not necessarily, and
// one unescaped quote in an alt attribute is an injection.
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// A <img> built from a content.js photo object. `capPx` is the DPR2
// honesty ceiling and is applied as a real max-width so no CSS change
// can ever render the photo above it.
function imgHtml(photo, extraClass = '', loading = 'lazy') {
  if (!photo || !photo.src) return '';
  const srcset = photo.srcset ? ` srcset="${esc(photo.srcset)}"` : '';
  const sizes  = photo.sizes ? ` sizes="${esc(photo.sizes)}"` : '';
  const cap    = photo.capPx ? ` style="max-width:${Number(photo.capPx)}px"` : '';
  return `<img class="${esc(extraClass)}" src="${esc(photo.src)}"${srcset}${sizes}` +
         ` width="${Number(photo.width)}" height="${Number(photo.height)}"` +
         ` loading="${esc(loading)}" decoding="async" alt="${esc(photo.alt)}"${cap}>`;
}

// 🚨 P15 — THE FIX FOR THE DEFECT THE CLIENT REPORTED: A PHOTO SLOT
// PAINTING ITS ALT TEXT INSTEAD OF A PICTURE. It is a LOADING failure,
// not a 404 — every path returns 200.
//
// `loading="lazy"` is resolved against the VIEWPORT, and two of this
// page's photo components defeat that:
//
//   · #work is a HORIZONTALLY scrolling rail. WebKit (Safari, i.e. the
//     iPhone this was seen on) only treats a lazy candidate as near the
//     viewport within a narrow HORIZONTAL margin, so cards more than
//     about two viewport widths to the right are never fetched until
//     the rail is dragged to them. Reproduced on the live site in
//     headless WebKit at 390: three of nine rail images at
//     naturalWidth 0 with the rail fully in view and the page settled.
//     The same run in Chromium is clean, which is why every desktop
//     check has passed for three phases.
//   · #services is a two-row grid whose bottom row can be scrolled
//     PAST faster than the lazy loader reacts, and once a lazy image is
//     far above the viewport the browser will not fetch it until it
//     comes back. Measured at 1440: cards 5 and 6 at naturalWidth 0
//     after a fast pass down the page.
//
// Both are the same defect with the same cure: keep the band's images
// free until the visitor actually reaches the band, then stop being
// clever. `wakeImages()` promotes them all to eager in one go on the
// FIRST intersection, so before that moment the band still costs zero
// bytes and after it there is no positional heuristic left in the path.
//
// ⛔ Not conditional on Save-Data. A photograph that renders as a
// paragraph of alt text is not a saving.
// ⚠️ Each band gets its OWN observer. An earlier draft hung the rail's
// wake-up off the reel's observer; if `work.reel` were ever pulled from
// content.js, ten photographs would silently fall back to Safari's
// heuristic with nothing in the diff to explain it.
function wakeImages(root) {
  if (!root) return;
  const go = () => $$('img', root).forEach(im => {
    if (im.naturalWidth) return;
    im.setAttribute('fetchpriority', 'low');
    im.loading = 'eager';
  });
  if (!('IntersectionObserver' in window)) { go(); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.disconnect();
      go();
    });
  }, { rootMargin: '250px 0px' });
  io.observe(root);
}

// ============================================================
// 1. SMS — the site's one repeated idea
// ============================================================
// ⚠️ ORDER MATTERS AND IT IS NOT COSMETIC.
// what the message is about → FILL-IN BLANKS, ALWAYS LAST.
// `data-sms-body` holds the DETAILS ONLY and must never contain the
// blanks: anything appended after them lands inside the visitor's own
// half-typed answer and destroys every CTA on the page.
const SMS_FILL_INS = content.booking.fillIns;

let symptomPicks = [];

// ⭐ P15 — THE COMPOSER. This is the one piece of copy on the site the
// VISITOR puts their own name to, and until now it read like a form
// dump: each chip carried a whole sentence and they were concatenated
// in tap order, so three chips produced "My sliding door is stuck and
// hard to slide. My sliding door has jumped off its track. My sliding
// door won't lock properly." — the same four words three times.
//
// Now the chips carry either a `clause` (a predicate that hangs off one
// shared subject) or a `solo` (a lowercase independent clause with its
// own subject). See the rules above content.symptoms.
//
//   greeting + first clause (lowercase) + "." + any further clauses as
//   their own sentences + the photo line + the blanks
//
// ⚠️ ARRAY ORDER, NOT TAP ORDER. Tap order produced a different
// sentence for the same three chips depending on which was pressed
// first. The preview under the chips shows the exact string that will
// open, so the ordering is never a surprise.
const oxford = (parts) => parts.length < 2
  ? (parts[0] || '')
  // The comma before "and" is not a style tic: several predicates
  // contain their own "and" ("sticks and is hard to slide"), and
  // without it a two-item list reads as one run-on clause.
  : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;

function symptomSentences() {
  if (!symptomPicks.length) return [];
  const picked = content.symptoms.filter(s => symptomPicks.includes(s.id));
  const out = [];
  const clauses = picked.filter(s => s.clause).map(s => s.clause);
  if (clauses.length) out.push(`my sliding door ${oxford(clauses)}`);
  picked.filter(s => s.solo).forEach(s => out.push(s.solo));
  return out;
}

// The full body, exactly as the messages app will receive it. The
// preview renders THIS, so what the visitor is shown and what opens can
// never diverge.
function composeSmsBody(details, fillIns = SMS_FILL_INS) {
  const b = content.booking;
  const sentences = symptomSentences();
  let lead;
  if (sentences.length) {
    // First clause is lowercase because the greeting ends in a comma;
    // every following clause becomes its own capitalised sentence.
    const [first, ...rest] = sentences;
    lead = b.smsGreeting + first + '.'
         + rest.map(s => ' ' + s.charAt(0).toUpperCase() + s.slice(1) + '.').join('')
         + ' ' + b.smsPhotoLine;
  } else {
    // NOTHING PICKED: the message is the CTA's own sentence, unchanged.
    // Every `smsBody` in content.js is already a complete, natural text,
    // so the zero-chip state of every button on the page is exactly
    // what that button has always sent.
    lead = String(details || '').trim();
  }
  return lead ? `${lead} ${fillIns}` : fillIns;      // blanks LAST, always
}

function buildSmsHref(details, fillIns = SMS_FILL_INS) {
  return `${content.booking.smsHref}?&body=${encodeURIComponent(composeSmsBody(details, fillIns))}`;
}

function refreshSmsLinks() {
  $$('[data-sms-body]').forEach(a => {
    a.href = buildSmsHref(a.dataset.smsBody, a.dataset.smsFill ?? SMS_FILL_INS);
  });
}

// ============================================================
// 2. RENDERERS — one per section
// ============================================================
function run(name, fn) {
  try { fn(); }
  catch (err) { console.warn(`[render:${name}] skipped —`, err && err.message); }
}

// --- NAV + DRAWER ------------------------------------------------
// The drawer is a second sales surface, not a table of contents:
// links + the two conversion rows (ELEVATION §3.15).
//
// ⚠️ P12 ADDED #problem AND #areas, and that is a consequence of the
// breakpoint fix, not a change of mind. The drawer used to be a phone
// component only, where four links and two big CTAs is the right
// density. Now it is the ONLY navigation between 641 and 1024 as well
// (the burger used to switch off at 641 and the link strip does not
// switch on until 1025 — see styles.css), so it has to carry the same
// six destinations the desktop strip does. A11Y-A3 flagged the two
// missing ones as "the two most conversion-relevant sections".
const DRAWER_LINKS = ['#problem', '#value', '#services', '#work', '#areas', '#faq'];
function renderNav() {
  $('#navLinks').innerHTML = content.nav
    .map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
  $('#drawerLinks').innerHTML = content.nav
    .filter(l => DRAWER_LINKS.includes(l.href))
    .map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
  $('#drawerFoot').innerHTML =
    `<a class="btn btn--primary" data-sms-body="${esc(content.hero.primaryCta.smsBody)}" href="${esc(content.booking.smsHref)}">${esc(content.hero.primaryCta.label)}</a>` +
    `<a class="btn btn--ghost" href="${esc(content.booking.phoneHref)}">${esc(content.hero.secondaryCtaLabel)} <span class="num">${esc(content.booking.phone)}</span></a>`;
}

// --- 1 · HERO ----------------------------------------------------
// index.html carries a STATIC MIRROR of this copy so the H1 (the LCP
// element) paints on the first frame. This renderer re-asserts the
// same strings from content.js so a content.client.js override still
// takes effect — the two must stay identical.
function renderHero() {
  const h = content.hero;
  $('#heroEyebrow').textContent = h.eyebrow;
  $('#heroHeadline').innerHTML =
    `<span class="s1">${esc(h.headline1)}</span>` +
    `<span class="s2">${esc(h.headline2)}</span>`;
  $('#heroLede').innerHTML = h.lede;      // the ONE rich-text field; <b> is intentional
  $('#heroSpec').innerHTML = h.spec.map(s =>
    `<div class="spec__i"><span class="spec__k mono">${esc(s.key)}</span>` +
    `<span class="spec__v">${esc(s.value)}</span></div>`).join('');
  $('#heroNote').textContent = h.note;

  const sms = $('#heroSms');
  sms.dataset.smsBody = h.primaryCta.smsBody;
  sms.querySelector('span').textContent = h.primaryCta.label;

  // The reel behind everything. Only the POSTER and the metadata are
  // set here; the <source> elements are attached later by initHeroReel
  // so the poster cannot lose the LCP race to the mp4.
  const reel = h.reel;
  const video = $('#heroReel');
  if (video && reel) {
    video.poster = reel.poster;
    video.width = Number(reel.width);
    video.height = Number(reel.height);
    // A11Y-M7: NO aria-label here. This <video> sits inside
    // .hero__media[aria-hidden="true"], so a label on it could never be
    // read by anything — the description was dead string. The reel is
    // decorative, and the sentence describing it is rendered as real
    // text in the credit line below instead (see #heroCreditDesc).
    video.dataset.webm = reel.webm;
    video.dataset.mp4 = reel.mp4;
  }
  const credit = $('#heroCreditLink');
  if (credit && reel) {
    credit.href = reel.permalink;
    $('#heroCreditLabel').textContent = reel.creditLabel;
  }
  // The page credits footage a blind visitor is told exists and was
  // previously told nothing about. One sentence, real text, visually
  // hidden so the hero's measured type column does not move by a pixel.
  const desc = $('#heroCreditDesc');
  if (desc && reel) desc.textContent = reel.description;
}

// --- 1a · PAUSE CONTROLS -----------------------------------------
// ⚠️ A11Y-B4 (WCAG 2.2.2 Pause, Stop, Hide, LEVEL A). Two videos start
// on their own and loop forever beside text — the hero reel (14.25s,
// full-bleed behind the H1) and the work-rail reel (5.4s). 2.2.2 applies
// to ANY auto-starting motion over five seconds presented in parallel
// with other content; "it is only ambient decoration" is not an
// exemption. Honouring prefers-reduced-motion (which this build does
// perfectly) is a USER-AGENT preference, not the in-content mechanism
// the success criterion asks for: a visitor with a vestibular disorder
// who has never found that OS setting had no way to stop it.
//
// The design brief was "quiet and premium, and it must not cheapen the
// hero", so: a 44px ink disc with a mono glyph, in the corner of its own
// media, cream on navy (the same audited pair as the skip link). It is a
// real <button>, so it is keyboard-operable for free.
//
// THREE THINGS THAT MATTER MORE THAN THE BUTTON:
//   1. The choice is REMEMBERED for the session and it is GLOBAL. Both
//      reels answer to one flag, so pausing the hero and then scrolling
//      to the work rail does not start new motion behind the visitor.
//   2. Both reels have IntersectionObservers that call play() when they
//      re-enter view. Those now go through playReel(), which refuses
//      while paused — otherwise scrolling would silently undo the fix.
//   3. NO CONTROL IS CREATED IF NO VIDEO EVER PLAYS. Under reduced
//      motion, Save-Data or a 2g/3g link no source is ever attached, so
//      the control would be a button that does nothing. It is built at
//      arm time, beside the footage it governs, and nowhere else.
const REELS_KEY = 'asdr:reels-paused';
let reelsPaused = false;
try { reelsPaused = sessionStorage.getItem(REELS_KEY) === '1'; } catch (_) { /* private mode */ }

const REEL_ICON_PAUSE = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><rect x="2.6" y="1.9" width="2.4" height="8.2" rx="0.5"/><rect x="7" y="1.9" width="2.4" height="8.2" rx="0.5"/></svg>';
const REEL_ICON_PLAY  = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3.4 2.2l6 3.5a0.35 0.35 0 0 1 0 0.6l-6 3.5A0.35 0.35 0 0 1 2.9 9.5v-7a0.35 0.35 0 0 1 0.5-0.3z"/></svg>';

const reelControls = [];   // every control re-labels when the flag moves

function playReel(video) {
  if (!video || reelsPaused) return;
  const p = video.play();
  if (p && p.catch) p.catch(() => {});
}

function syncReelControls() {
  reelControls.forEach(({ btn, label }) => {
    btn.innerHTML = reelsPaused ? REEL_ICON_PLAY : REEL_ICON_PAUSE;
    // LABEL SWAP, not aria-pressed. "Pause"/"Play" names the ACTION the
    // button performs, which is what a visitor hears and what the visible
    // glyph shows; a pressed-state toggle on a media control reads as
    // "pause, pressed" and is routinely misannounced.
    const text = (reelsPaused ? 'Play ' : 'Pause ') + label;
    btn.setAttribute('aria-label', text);
    btn.setAttribute('title', text);
  });
}

function attachReelPause(video, mount, label, extraClass) {
  if (!video || !mount || typeof document === 'undefined') return;
  if (mount.querySelector('.reelbtn')) return;         // never two
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'reelbtn' + (extraClass ? ' ' + extraClass : '');
  btn.addEventListener('click', () => {
    reelsPaused = !reelsPaused;
    try { sessionStorage.setItem(REELS_KEY, reelsPaused ? '1' : '0'); } catch (_) {}
    // Act on EVERY reel on the page, not just this one — one flag, one
    // decision, no motion left running somewhere the visitor cannot see.
    reelControls.forEach(({ video: v }) => {
      if (reelsPaused) v.pause(); else playReel(v);
    });
    syncReelControls();
  });
  reelControls.push({ btn, video, label });
  mount.appendChild(btn);
  syncReelControls();
  if (reelsPaused) video.pause();
}

// --- 1b · THE HERO REEL ------------------------------------------
// Nothing of the clip is fetched until after `load`, and nothing at
// all is fetched under reduced motion, Save-Data or a 2g/3g link —
// in those cases the scrimmed poster IS the hero and the <video>
// never gains a source. A second IntersectionObserver pauses the
// clip whenever the hero is off screen; it adds no rAF and no
// scroll listener.
function initHeroReel() {
  const video = $('#heroReel');
  if (!video || !video.dataset.mp4) return;

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = !!(conn && conn.saveData);
  const slowNet  = !!(conn && conn.effectiveType && /^(slow-2g|2g|3g)$/.test(conn.effectiveType));
  if (REDUCED || saveData || slowNet) return;

  let armed = false;
  // A11Y-B4: playReel() is the ONLY way this clip starts, and it refuses
  // while the visitor has paused. The IO below would otherwise restart
  // it every time the hero scrolled back into view.
  const play = () => playReel(video);

  function arm() {
    if (armed) return;
    armed = true;
    const webm = document.createElement('source');
    webm.src = video.dataset.webm; webm.type = 'video/webm';
    const mp4 = document.createElement('source');
    mp4.src = video.dataset.mp4; mp4.type = 'video/mp4';
    video.append(webm, mp4);
    video.load();
    play();

    // The control mounts on .hero__stage, NOT inside .hero__media —
    // that plane is aria-hidden and pointer-events:none, so a button in
    // it would be neither operable nor announced.
    attachReelPause(video, $('.hero__stage'), 'the background reel', 'reelbtn--hero');

    const hero = $('#hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        entries.forEach(e => { e.isIntersecting ? play() : video.pause(); });
      }, { threshold: 0 }).observe(hero);
    }
  }

  if (document.readyState === 'complete') setTimeout(arm, 200);
  else window.addEventListener('load', () => setTimeout(arm, 200), { once: true });
}

// --- 2 · TRUST SEAM ----------------------------------------------
function renderTrust() {
  $('#trustMount').innerHTML = content.trust
    .map(t => `<span class="trust__i">${esc(t)}</span>`).join('');
  $('#trust').classList.add('reveal', 'reveal--rtl');
  $('#trust').setAttribute('data-reveal', '');
}

// ⚠️ THE RAIL READOUT (P12). Two horizontal scrollers, one shared
// wiring: a roller that travels the sill as the rail scrolls, and an
// "01 / 10" counter beside it. One PASSIVE listener on the rail itself,
// so it owns no scroll and needs no rAF, no observer and no reduced-
// motion branch — a position is not an animation, and
// document.getAnimations() stays 0.
function wireRail(rail, sill, count) {
  if (!rail) return () => {};
  const update = () => {
    const items = $$('.rail__item:not([hidden]), .voice:not([hidden])', rail);
    if (sill) {
      const max = rail.scrollWidth - rail.clientWidth;
      sill.style.setProperty('--rail-p', max > 1 ? String(rail.scrollLeft / max) : '0');
      sill.classList.toggle('is-static', max <= 1);
    }
    if (!count) return;
    if (!items.length) { count.textContent = ''; return; }
    // The LEADING item, not the middle one: at scrollLeft 0 a midpoint
    // test reports "03 / 10" beside a roller parked at the left end.
    const lead = items.findIndex(it => it.offsetLeft + it.offsetWidth > rail.scrollLeft + 4);
    const i = lead < 0 ? items.length - 1 : lead;
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
  };
  rail.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
  return update;
}

// ⚠️ NO-BREAK PHRASES (P12). A heading is copy, so it is escaped, so
// it cannot carry markup — which is why "Every job carries a 12-month
// workmanship warranty." was shipping broken across two lines AT THE
// HYPHEN ("12-" / "month") at 1440. This is the escape hatch, and it is
// deliberately dumb: a section may list `headingNb: ["12-month"]` and
// each listed phrase is wrapped in a nowrap span AFTER escaping, so no
// raw HTML ever enters from content.js. It cannot introduce a claim; it
// can only stop a line break.
function nbHtml(escaped, phrases) {
  if (!Array.isArray(phrases)) return escaped;
  return phrases.reduce((html, ph) => {
    const e = esc(String(ph));
    return e ? html.split(e).join(`<span class="nb">${e}</span>`) : html;
  }, escaped);
}

// Shared section header. `headingEm` is the Direction-2 roman →
// italic display device: heading + headingEm render as ONE sentence.
function headHtml(o, h2id) {
  const em = o.headingEm ? ` <span class="em">${nbHtml(esc(o.headingEm), o.headingNb)}</span>` : '';
  const id = h2id ? ` id="${esc(h2id)}"` : '';
  return (o.eyebrow ? `<span class="eyebrow mono-label">${esc(o.eyebrow)}</span>` : '') +
         `<h2${id}>${nbHtml(esc(o.heading), o.headingNb)}${em}</h2>` +
         `<div class="track-rule" aria-hidden="true"></div>` +
         (o.lede ? `<p class="lede">${esc(o.lede)}</p>` : '');
}

// --- 3 · PROBLEM — the symptom picker (the demo is CUT) ----------
function renderProblem() {
  const p = content.problem;
  // A11Y-M2: the region was named by its whole <header>, so landmark
  // navigation announced the eyebrow, the heading AND the lede as one
  // name. Named by the h2 now, like #services / #work / #areas already
  // were. Same treatment in #story, #voices, #faq and #contact.
  $('#problemHead').innerHTML = headHtml(p, 'problemHeadH2');
  $('#problem').setAttribute('aria-labelledby', 'problemHeadH2');

  // D9 rule: the preview NEVER renders empty placeholders or dangling
  // punctuation. It is hidden until at least one chip is pressed, and
  // it shows the symptom sentences only — the fill-in blanks belong to
  // the messages app, not the page.
  // A11Y-M6: the symptom chips ARE correct multi-select toggles, but the
  // eight of them were unlabelled as a set — a screen-reader user met
  // eight buttons with no statement of what they belonged to or that
  // more than one could be pressed. The visible copy says exactly that
  // ("Tick as many as you like."); it just was not associated. It is
  // now the group's description.
  //
  // A11Y-M3: the preview is a live region and it used to be `hidden`
  // whenever it was empty. paint() removed `hidden` and injected the
  // text in the SAME TICK, so at mutation time the region was not yet in
  // the accessibility tree and the announcement was unreliable (worst in
  // VoiceOver); going back to zero chips re-hid it, so a removal was
  // never announced at all. The element is now permanently in the DOM
  // and permanently in the tree — only its CONTENTS come and go, and
  // `.picker__preview:empty` handles the visual side in CSS.
  // `aria-atomic` makes the whole sentence re-read rather than the diff.
  $('#problemPicker').innerHTML =
    `<p class="picker__label" id="pickerLabel">${esc(p.pickerLabel)}</p>
     <div class="chips" id="symptomChips" role="group"
          aria-label="${esc(p.chipGroupLabel)}" aria-describedby="pickerLabel pickerFoot">${
       content.symptoms.map(s =>
         `<button class="chip" type="button" data-symptom="${esc(s.id)}" aria-pressed="false">${esc(s.label)}</button>`
       ).join('')}
     </div>
     <div class="picker__preview" id="symptomPreview" aria-live="polite" aria-atomic="true"></div>
     <p class="picker__foot" id="pickerFoot">${esc(p.footNote)}</p>
     <div class="picker__cta">
       <span class="picker__hint">${esc(p.ctaHint)}</span>
       <a class="btn btn--dark" id="problemSms" data-sms-body="${esc(p.ctaSmsLead)}" href="${esc(content.booking.smsHref)}">${esc(p.ctaLabelEmpty)}</a>
     </div>`;

  const preview = $('#symptomPreview');
  const sendBtn = $('#problemSms');
  function paint() {
    const picked = symptomPicks.length > 0;
    // The label only says "that" once there IS a that. With nothing
    // picked the button is the same free-quote ask as every other CTA
    // on the page, and its body carries the photo sentence, so the
    // message is never a bare set of fill-in blanks.
    sendBtn.textContent = picked ? content.problem.ctaLabel : content.problem.ctaLabelEmpty;
    // data-sms-body is the DETAILS ONLY — it is what the message says
    // when NO chip is pressed. composeSmsBody() replaces it entirely
    // once there are picks, and appends the fill-in blanks either way.
    sendBtn.dataset.smsBody = content.problem.ctaSmsLead;
    // ⭐ P15 — THE PREVIEW IS NOW THE MESSAGE, NOT A SUMMARY OF IT.
    // It used to print the symptom sentences only, so the string on the
    // page and the string that opened in the messages app were
    // different objects and the blanks the visitor is asked to fill in
    // appeared nowhere until the app opened. It renders composeSmsBody()
    // verbatim now, so "Your message so far" is literally true and the
    // risk-reversal line under it ("nothing sends until you press
    // send") is checkable by the person reading it.
    // A11Y-M3: never toggle `hidden` on a live region. Emptying it is
    // enough — an empty element is still in the accessibility tree, so
    // the NEXT injection is announced, and clearing it announces the
    // removal. `.picker__preview:empty { display: none }` does the
    // visual half in CSS, so nothing on screen changed.
    preview.innerHTML = picked
      ? `<span class="k">${esc(content.problem.previewLabel)}</span>` +
        esc(composeSmsBody(content.problem.ctaSmsLead))
      : '';
    refreshSmsLinks();
  }
  $$('#symptomChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.symptom;
      const on = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!on));
      symptomPicks = on ? symptomPicks.filter(x => x !== id) : symptomPicks.concat(id);
      paint();
    });
  });
  paint();

  const g = $('#problemPicker');
  g.classList.add('reveal');
  g.setAttribute('data-reveal', '');
}

// --- 4 · VALUE ---------------------------------------------------
// The money section, on ink. Left: the argument + the customer's
// sentence. Right: the price card + the framed track print.
function renderValue() {
  const v = content.value;
  const q = v.counterAnchor;
  $('#valueMount').innerHTML =
    `<div class="sec__head sec__head--on-ink" style="margin-bottom:0">
       ${headHtml(v, 'valueHead')}
       <p class="value__body">${esc(v.body)}</p>
       <blockquote class="value__quote">
         <span class="pull">${esc(q.pullQuote)}</span>
         <span class="rest">${esc(q.rest)}</span>
         <div class="value__attr">
           <span class="value__handle">${esc(q.attribution)}</span>
           <span class="value__src">${q.permalink
              ? `<a href="${esc(q.permalink)}" rel="nofollow noopener" target="_blank">${esc(q.sourceLabel)}</a>`
              : esc(q.sourceLabel)}</span>
         </div>
       </blockquote>
       <div class="value__cta">
         <a class="btn btn--primary" id="valueSms" data-sms-body="${esc(v.ctaSmsBody)}" href="${esc(content.booking.smsHref)}">${esc(v.ctaLabel)}</a>
       </div>
     </div>
     <div>
       <div class="value__price-card">
         <span class="value__from mono-label">${esc(v.priceFrom.label)}</span>
         <span class="value__figure figure-mega"><span class="cur">$</span>${esc(String(v.priceFrom.amount))}${v.priceFrom.gst ? '<span class="suf">+GST</span>' : ''}</span>
         <div class="value__rule"></div>
         <p class="value__note">${esc(v.priceAnchor)}</p>
         <p class="value__pricenote">${esc(v.priceNote)}</p>
         <blockquote class="value__pricequote">
           <span class="q">${esc(v.priceQuote.quote)}</span>
           <span class="value__attr">
             <span class="value__handle">${esc(v.priceQuote.attribution)}</span>
             <span class="value__src"><a href="${esc(v.priceQuote.permalink)}" rel="nofollow noopener" target="_blank">${esc(v.priceQuote.sourceLabel)}</a></span>
           </span>
         </blockquote>
       </div>
       <figure class="frame frame--ink value__frame">
         <div class="frame__inner">${imgHtml(v.framePhoto, 'frame__img')}</div>
         <figcaption class="frame__cap">
           <span class="mono-label">${esc(v.frameCaption)}</span>
           <span class="sub">${esc(v.frameSub)}</span>
         </figcaption>
       </figure>
     </div>`;
  const g = $('#valueMount');
  g.classList.add('reveal', 'reveal--split');
  g.setAttribute('data-reveal', '');
}

// --- 5 · SERVICES ------------------------------------------------
// CLIENT DIRECTION 2026-08-21: "make it cleaner on desktop so they
// line up nice and photos a little bigger, maybe drop down info."
//
// So: ONE anatomy, six times, on a strict 3x2 grid at ≥1120.
//   photo mount (140px, fixed) → name → one-line summary → drop-down
// Every row is a reserved height at ≥760, so names align, summaries
// align and the chevrons align across the whole grid. The detail
// breakdown is now behind a <details> at EVERY breakpoint — one
// component, no desktop/mobile fork, no `data-macc` force-open.
// The type-only card (Glass Sliding Windows has zero photographs
// anywhere) gets a DRAWN hairline diagram in the same mount, so the
// grid never breaks and no supplier stock shot is ever published.
const CHEV = `<svg class="faq__chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="position:static;margin-top:0"><path d="M4 2l4 4-4 4"/></svg>`;

// A drawn sliding window, hairline, same language as the roller
// cross-section in the section head. It claims nothing about any job
// and is plainly a diagram, not a photograph.
const SVC_DRAWN = `<svg class="svc__drawn" viewBox="0 0 120 160" fill="none" stroke="currentColor"
   stroke-width="1.2" stroke-linecap="square" aria-hidden="true" focusable="false">
  <path d="M6 30.5h108" stroke-opacity=".3"/>
  <rect x="10.5" y="40.5" width="99" height="70"/>
  <rect x="62.5" y="45.5" width="43" height="60" stroke-opacity=".45"/>
  <rect class="accent" x="14.5" y="43.5" width="52" height="64"/>
  <path d="M60 66v18" stroke-opacity=".8"/>
  <path d="M22 56h12M22 62h12" stroke-opacity=".4"/>
  <path d="M10.5 110.5h99M10.5 116.5h99" stroke-opacity=".75"/>
  <circle class="accent" cx="26" cy="113.5" r="3"/>
  <circle cx="52" cy="113.5" r="3" stroke-opacity=".45"/>
  <path d="M6 124.5h108" stroke-opacity=".3"/>
  <path d="M40 140h38m-8-6 8 6-8 6" stroke-opacity=".65"/>
</svg>`;

function renderServices() {
  const s = content.services;
  $('#servicesHead').innerHTML = headHtml(s, 'servicesHeadH2');
  $('#services').setAttribute('aria-labelledby', 'servicesHeadH2');

  // The head payload: the roller cross-section — hairline technical
  // drawing, and the site's ONE rotation (desktop scrub).
  $('#servicesPayload').innerHTML =
    `<figure class="roller-fig" aria-hidden="true">
       <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1">
         <path d="M14 96h92M14 104h92" />
         <path d="M22 96v-8h10v8M88 96v-8h10v8" stroke-opacity=".55"/>
         <g class="roller-spin">
           <circle cx="60" cy="62" r="30"/>
           <circle cx="60" cy="62" r="24" stroke-opacity=".4"/>
           <circle class="accent" cx="60" cy="62" r="5" stroke="currentColor"/>
           <path d="M60 38v10M60 76v10M36 62h10M74 62h10M43 45l7 7M70 72l7 7M77 45l-7 7M50 72l-7 7"/>
         </g>
         <path d="M30 96a30 30 0 0 1 60 0" stroke-opacity=".25"/>
       </svg>
     </figure>`;

  const label = s.detailsLabel;
  // see wakeImages(): the bottom row of this grid was measurably
  // scrolled past unloaded at 1440.

  $('#servicesMount').innerHTML = s.items.map((it, i) => {
    const hasPhoto = !!(it.photo && it.photo.src);
    // The mount is a fixed 140px square at every breakpoint above 640,
    // so `sizes` is a constant and the browser always picks the
    // DPR2-honest file. 140 is the LARGEST square every source can
    // fill without breaching native ÷ 2 — wardrobe-doors-281 caps it.
    const fig = hasPhoto
      ? imgHtml(Object.assign({}, it.photo, { sizes: '(max-width: 640px) 108px, 140px' }))
      : SVC_DRAWN;
    return `<article class="svc reveal reveal--card ${i % 2 ? 'reveal--rtl' : ''} ${hasPhoto ? '' : 'svc--drawn'}"
                     data-reveal id="svc-${esc(it.id)}">
      <figure class="svc__figure">${fig}</figure>
      <h3 class="svc__name">${esc(it.name)}</h3>
      <p class="svc__blurb">${esc(it.blurb)}</p>
      <details class="svc__acc">
        <summary>
          <span class="svc__acc-label">${esc(label)}</span>
          <span class="svc__acc-n mono">${String(it.items.length).padStart(2, '0')}</span>${CHEV}
        </summary>
        <dl class="svc__items">
          ${it.items.map(x => `<div class="svc__item"><dt>${esc(x.name)}</dt><dd>${esc(x.text)}</dd></div>`).join('')}
        </dl>
        ${it.note ? `<p class="svc__note">${esc(it.note)}</p>` : ''}
      </details>
    </article>`;
  }).join('');
  wakeImages($('#servicesMount'));

  // P14 — THE BAND'S NEXT STEP. Deliberately the mono go-link idiom the
  // area pages already use inside this same band, not a `.btn`: six
  // cards two bands above #warranty do not need a primary button, they
  // need one quiet way out. `data-sms-body` routes it through the same
  // blanks-last builder as every other ask on the site.
  const foot = $('#servicesFoot');
  foot.innerHTML =
    `<p class="svc__foot-lead">${esc(s.footLead)}</p>
     <a class="svc__go mono-label" data-sms-body="${esc(s.ctaSmsBody)}" href="${esc(content.booking.smsHref)}">${esc(s.ctaLabel)}${CHEV}</a>`;
  // Same door-wipe every other band's payload gets, so it arrives with
  // the last row of cards instead of being the one element on the page
  // that is simply already there.
  foot.classList.add('reveal', 'reveal--up');
  foot.setAttribute('data-reveal', '');
}

// --- 6 · EMERGENCY — a REAL h2 (fixes D5) ------------------------
// P12: the band was type plus a right-aligned button with a 45% dead
// column between them, and it was flagged twice as "spec-correct but
// plain". It is now copy + CTA in one column and a framed ink print in
// the other. The CALL moved UNDER the argument it belongs to instead of
// floating at the far right of the band, which is also the better
// funnel position. The print is ≥761 only: at ≤760 the band stacks and
// a 236px photo would buy 300px of phone scroll for a photograph that
// already appears in the work rail two sections down.
function renderEmergency() {
  const e = content.emergency;
  const print = e.photo && e.photo.src
    ? `<figure class="frame frame--ink emergency__frame">
         <div class="frame__inner">${imgHtml(e.photo, 'frame__img')}</div>
         <figcaption class="frame__cap"><span class="mono-label">${esc(e.photoCaption)}</span></figcaption>
       </figure>`
    : '';
  $('#emergencyMount').innerHTML =
    `<div class="emergency__text">
       <div class="emergency__copy">
         <span class="emergency__label">${esc(e.label)}</span>
         <h2 class="emergency__heading" id="emergencyHead">${esc(e.heading)}</h2>
       </div>
       <div class="emergency__act">
         <p class="emergency__body">${esc(e.body)}</p>
         <a class="btn btn--primary emergency__cta" href="${esc(content.booking.phoneHref)}">
           ${esc(e.ctaLabel)} <span class="num">${esc(content.booking.phone)}</span>
         </a>
       </div>
     </div>
     ${print}`;
}

// --- 7 · WORK ----------------------------------------------------
// TWO card sizes (slot "l"/"s"), 3:4, cover-cropped, scrim caption on
// every item, the reel at position 1 with preload="none" — its
// sources attach only when the rail intersects.
function renderWork() {
  const w = content.work;
  $('#workHead').innerHTML = headHtml(w, 'workHeadH2');
  $('#work').setAttribute('aria-labelledby', 'workHeadH2');

  // A11Y-M6: the filters are MUTUALLY EXCLUSIVE, so they are a radio
  // group, not eight independent toggles. aria-pressed described the
  // wrong thing. Native <button> + role="radio" keeps the visual
  // component and the click handling exactly as they were.
  // A11Y-H3: #railCount was aria-hidden="true", so pressing a filter
  // swapped the rail from 10 photos to 2 with NO announcement at all —
  // the only feedback on the page was the one node deliberately hidden
  // from assistive tech. It is a live region now, and it says a sentence
  // rather than a fraction. The `03 / 10` typography survives as a
  // separate aria-hidden glyph so nothing on screen changed.
  $('#workFilters').innerHTML =
    `<span class="work__chips" id="workFilterGroup" role="radiogroup" aria-label="${esc(w.filterGroupLabel)}">${
      w.categories.map((c, i) =>
        `<button class="filter-chip" type="button" role="radio" data-filter="${esc(c.id)}" aria-checked="${i === 0}">${esc(c.label)}</button>`
      ).join('')}</span>` +
    `<span class="visually-hidden" id="railStatus" role="status" aria-live="polite" aria-atomic="true"></span>`;
    // #railCount lives in index.html, on the sill, since P12 — it is the
    // rail's readout, not a filter.

  const reel = w.reel;
  const reelHtml = reel ? `
    <figure class="rail__item rail__item--${esc(reel.slot || 'l')}" data-cats="${esc((reel.cats || []).join(' '))}">
      <video id="railReel" width="${Number(reel.width)}" height="${Number(reel.height)}"
             muted loop playsinline disablepictureinpicture preload="none"
             aria-label="${esc(reel.ariaLabel)}" data-poster="${esc(reel.poster)}"
             data-webm="${esc(reel.webm)}" data-mp4="${esc(reel.mp4)}"></video>
      <figcaption class="rail__cap">${esc(reel.railCaption)}</figcaption>
    </figure>` : '';

  $('#workRail').innerHTML = reelHtml + w.photos.map(p => {
    // srcset `sizes` for a COVER crop: the browser picks by width, but
    // a cover crop can be governed by height, so the effective size is
    // max(box_w, box_h × aspect). Without this a square source gets the
    // small file and breaches native ÷ 2 by height.
    const aspect = p.width / p.height;
    const effL = Math.round(Math.max(220, 293 * aspect));
    const effS = Math.round(Math.max(156, 208 * aspect));
    const sizes = (p.slot === 's') ? `${effS}px` : `(max-width: 640px) ${effS}px, ${effL}px`;
    return `<figure class="rail__item rail__item--${esc(p.slot || 'l')}" data-cats="${esc((p.cats || []).join(' '))}">
       ${imgHtml(Object.assign({}, p, { sizes }))}
       <figcaption class="rail__cap">${esc(p.railCaption || '')}</figcaption>
     </figure>`;
  }).join('');

  const rail = $('#workRail');
  const count = $('#railCount');
  const status = $('#railStatus');
  const total = $$('.rail__item', rail).length;

  const updateCount = wireRail(rail, $('#railSill'), count);

  $$('#workFilters .filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      $$('#workFilters .filter-chip').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
      $$('#workRail .rail__item').forEach(item => {
        item.hidden = !(f === 'all' || (item.dataset.cats || '').split(' ').includes(f));
      });
      rail.scrollTo({ left: 0, behavior: REDUCED ? 'auto' : 'smooth' });
      updateCount();
      // A11Y-H3: say what changed, in words. Only on a real press —
      // a status region that fires on first paint announces nothing
      // useful and talks over the page load.
      if (status) {
        const shown = $$('.rail__item:not([hidden])', rail).length;
        status.textContent = (content.work.railStatus || 'Showing {N} of {T}.')
          .replace('{N}', String(shown)).replace('{T}', String(total));
      }
    });
  });

  rail.classList.add('reveal');
  rail.setAttribute('data-reveal', '');

  // The reel loads ONLY when the rail is ≥25% visible, and never under
  // reduced motion or Save-Data — the poster stands in.
  // Nothing of the reel — not even the poster — costs a byte until
  // the rail is ≥25% visible. Under reduced motion or Save-Data only
  // the poster ever loads and the clip never does.
  const video = $('#railReel');
  if (video) {
    const conn = navigator.connection;
    const noVideo = REDUCED || (conn && conn.saveData);
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.disconnect();
        video.poster = video.dataset.poster;
        if (noVideo) return;
        const webm = document.createElement('source');
        webm.src = video.dataset.webm; webm.type = 'video/webm';
        const mp4 = document.createElement('source');
        mp4.src = video.dataset.mp4; mp4.type = 'video/mp4';
        video.append(webm, mp4);
        video.load();
        playReel(video);                                  // A11Y-B4
        attachReelPause(video, video.parentElement, 'the workshop reel');
      });
    }, { threshold: 0.25 });
    io.observe(rail);
  }

  wakeImages(rail);
}

// --- 7b · THE ONE REAL BEFORE/AFTER ------------------------------
// His own "Before"/"After" labels are burned into the photographs;
// the spans are the accessible layer and are visually hidden.
function renderBeforeAfter() {
  const b = content.beforeAfter;
  if (!b || !b.before || !b.after) return;
  $('#beforeAfterMount').innerHTML =
    `<header class="ba__head">
       <span class="eyebrow mono-label">${esc(b.eyebrow)}</span>
       <h3>${esc(b.heading)}</h3>
     </header>
     <div class="ba__grid">
       <div class="ba__pair">
         <figure class="ba__fig"><span class="ba__label">${esc(b.beforeLabel)}</span>${imgHtml(b.before)}</figure>
         <figure class="ba__fig"><span class="ba__label">${esc(b.afterLabel)}</span>${imgHtml(b.after)}</figure>
       </div>
       <div class="ba__aside">
         <p class="ba__cap">${esc(b.caption)}</p>
         <p class="ba__src">${b.permalink
            ? `<a href="${esc(b.permalink)}" rel="nofollow noopener" target="_blank">${esc(b.sourceLabel)}</a>`
            : esc(b.sourceLabel)}</p>
       </div>
     </div>`;
}

// --- 8 · WARRANTY — a REAL h2 at display scale (fixes D5) --------
function renderWarranty() {
  const w = content.warranty;
  $('#warrantyMount').innerHTML =
    `<div class="warranty__figure">
       <span class="warranty__num figure-mega">${esc(w.figure)}<span class="suf">${esc(w.figureUnit)}</span></span>
     </div>
     <div>
       <h2 class="warranty__heading" id="warrantyHead">${nbHtml(esc(w.heading), w.headingNb)}</h2>
       <p class="warranty__italic em-serif">${esc(w.italicLine)}</p>
       <div class="warranty__points">
         ${w.points.map(p => `<div class="warranty__point"><span class="warranty__k">${esc(p.label)}</span><span class="warranty__v">${esc(p.value)}</span></div>`).join('')}
       </div>
       <p class="warranty__hw">${esc(w.hardwareNote)}</p>
       <div class="value__cta warranty__cta">
         <a class="btn btn--dark" data-sms-body="${esc(w.ctaSmsBody)}" href="${esc(content.booking.smsHref)}">${esc(w.ctaLabel)}</a>
         <span class="picker__hint">${esc(w.ctaHint)}</span>
       </div>
     </div>`;
  const g = $('#warrantyMount');
  g.classList.add('reveal', 'reveal--up');
  g.setAttribute('data-reveal', '');
}

// --- 9 · STORY ---------------------------------------------------
// Timeline first; paragraph 2 sits behind "Read the rest" at ≤640.
function renderStory() {
  const s = content.story;
  $('#storyHead').innerHTML = headHtml(s, 'storyHeadH2');   // A11Y-M2
  $('#story').setAttribute('aria-labelledby', 'storyHeadH2');
  // ⭐ P15 — THE WHOLE VERBATIM RUN IS INSIDE THE ATTRIBUTED BLOCK NOW.
  // `body[0]` and `body[1]` are BOTH his own About-page paragraphs,
  // quoted and never reworded (see the note above `story.body`), but the
  // renderer used to print `body[0]` as unmarked site prose and attribute
  // only the rest. That was survivable while the site narrated in the
  // third person. Since P15 the site speaks as Lachlan in the FIRST
  // person, and `body[0]` is written in the third ("…was established in
  // 2002 by Craig Board. Now his son, Lachlan has taken over…") — so
  // unattributed it read as the page contradicting its own voice three
  // lines under "I didn't pick this trade."
  //
  // It is not reworded to fix that, because the rails forbid rewording
  // his sourced copy. It is ATTRIBUTED, which is what it always should
  // have been: `quoteAttr` now heads both paragraphs, the third person
  // is explained by the label above it, and the only words the page
  // speaks in its own voice are first person.
  // ⚠️ `moreLabel`'s <details> still wraps only the LATER paragraphs —
  // the first one must never be collapsed behind a summary, because it
  // is the one that settles the generation count at two.
  const [p1, ...rest] = s.body;
  $('#storyMount').innerHTML =
    `<div class="gens">
       ${s.generations.map(g => `
         <div class="gen">
           <div class="gen__fig">
             <span class="gen__num">${esc(g.figure)}</span>
             <span class="gen__unit">${esc(g.unit)}</span>
           </div>
           <div class="gen__who">${esc(g.who)}</div>
         </div>`).join('')}
     </div>
     <div class="story__body">
       <div class="story__quoted">
         <p class="story__attr mono-label">${esc(s.quoteAttr)}</p>
         <p>${esc(p1)}</p>
         ${rest.length ? `
         <details class="story__more" data-macc open>
           <summary>${esc(s.moreLabel)}${CHEV}</summary>
           <div>${rest.map(p => `<p>${esc(p)}</p>`).join('')}</div>
         </details>` : ''}
       </div>
       <p class="story__italic em-serif">${esc(s.italicLine)}</p>
       <p class="story__sig">${esc(s.signature)}</p>
     </div>`;
  const g = $('#storyMount');
  g.classList.add('reveal', 'reveal--rtl');
  g.setAttribute('data-reveal', '');
}

// --- 10 · VOICES -------------------------------------------------
// CLIENT DIRECTION 2026-08-21: "import his reviews and make them
// horizontal scroll."
//
// Twelve of his 71 written hipages recommendations, VERBATIM (two
// shortened with an ellipsis, nothing reworded), on a rail with the
// SAME mechanics as #work: native overflow-x, snap, contained
// overscroll, an edge mask, and a real tab stop so a keyboard can
// reach it. One component at every breakpoint.
//
// ⚠️ NO stars, NO ratings widget, NO AggregateRating and NO Review
// JSON-LD. The figures are shown as an attributed banner and nothing
// else — hipages' own rule is that they must never be presented as
// Google reviews.
// ⚠️ ADVERSARIAL-B1 · THE SHORTENING CAVEAT IS COMPUTED, NEVER TYPED.
// content.js used to END voices.lede with a hardcoded "…two are
// shortened with an ellipsis and nothing else." It was false as
// shipped, and any future edit to a `trimmed` flag would have made it
// false again silently. This counts the quotes ACTUALLY ON THE PAGE and
// writes the sentence from that count. Zero trims prints nothing.
// _generate-areas.py carries the identical function for the area pages —
// if you change one, change both, and re-run the generator.
function renderVoices() {
  const v = content.voices;
  if (!v.items || !v.items.length) { $('#voices').hidden = true; return; }
  // CLIENT 2026-08-22: the computed trim caveat is gone (see
  // content.js voices.lede). The rendered ellipsis on each trimmed
  // quote is the disclosure.
  const head = v;
  $('#voicesHead').innerHTML =
    headHtml(head, 'voicesHeadH2') + `<p class="voices__banner mono-label">${esc(v.banner)}</p>`;
  // A11Y-M2: name the landmark by its h2, not by the whole header —
  // this region was announcing a 280-character name.
  $('#voices').setAttribute('aria-labelledby', 'voicesHeadH2');

  const rail = $('#voicesMount');
  rail.innerHTML = v.items.map(it =>
    `<figure class="voice">
       <span class="voice__cat mono-label">${esc(it.category)}</span>
       <blockquote class="voice__quote">${esc(it.quote)}</blockquote>
       <figcaption class="voice__foot">
         <span class="voice__handle">${esc(it.name)} &middot; ${esc(it.suburb)}</span>
         <span class="voice__src">${esc(it.date)} &middot; ${esc(v.sourceLabel)}</span>
       </figcaption>
     </figure>`).join('');
  rail.classList.add('reveal');
  rail.setAttribute('data-reveal', '');
  wireRail(rail, $('#voicesSill'), $('#voicesCount'));   // P12: same readout as the work rail

  $('#voicesFoot').innerHTML =
    `<span>${esc(v.foot)}</span> ` +
    `<a class="voices__link" href="${esc(v.profileUrl)}" rel="nofollow noopener" target="_blank">${esc(v.profileLinkLabel)}</a>` +
    `<span class="voices__cta"><a class="btn btn--primary" data-sms-body="${esc(v.ctaSmsBody)}" href="${esc(content.booking.smsHref)}">${esc(v.ctaLabel)}</a></span>`;
}

// --- 11 · AREAS --------------------------------------------------
// One card, a spec sheet of regions. No invented suburb counts — the
// right column is the honest mono word on every row.
//
// The rows were inert <div>s until the area pages existed. They are
// anchors now, in the same pass that created areas/*.html — which is
// the condition P4 set. The WORDS are unchanged ("Covered" is the
// honest label the copy deck chose); only a chevron was added, because
// a row that navigates has to look like one and a chevron is not copy.
// If areas/*.html is ever deleted, revert this to a <div> in the same
// commit: a nav link into a 404 is worse than no link.
const AREA_HREF = (slug) => `areas/${slug}.html`;
const GO_CHEV = `<svg class="area__chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>`;

// ============================================================
// THE SERVICE-AREA MAP — A REAL SLIPPY MAP (P15)
// ============================================================
// CLIENT, 2026-08-22, after three rejections of the drawn plate:
// "make the map look like an actual map... make it look like an actual
// map and nice." His reference is the agency's Shocked Solar build
// ("like what we've done for Marcos"), which is Leaflet against CARTO
// tiles. This is that pattern.
//
// ⚠️ WHY THE DRAWN SVG PLATE IS GONE, IN ONE SENTENCE.
// P12 and P13 both tried to make a hand-projected chart of Natural
// Earth 10m data read as "where he works", and a chart of a coastline
// with no suburbs, no street network and no place names cannot: the
// visitor's test for a map is whether he can find his own street on
// it. Three iterations of better colour did not change that, so the
// basemap now comes from a tile server and the ONLY thing this build
// still owns is HIS TERRITORY drawn on top of it.
//
// ⚠️ THIS IS THE SITE'S ONE OFF-ORIGIN RUNTIME DEPENDENCY, AND IT IS
// A DELIBERATE, CLIENT-CHOSEN EXCEPTION. Tiles are fetched from
// basemaps.cartocdn.com (OpenStreetMap data, CARTO Voyager raster).
// Attribution is mandatory and is set on the layer; do not remove it.
// The page has never been fully off-origin anyway (analytics.js POSTs
// a beacon on every load), but this is the first VISIBLE dependency:
// if CARTO is unreachable the plate must still be a map, which is what
// the `tileerror` fallback below is for.
//
// ⚠️ NOTHING LOADS UNTIL #areas IS NEARLY ON SCREEN — NOT THE TILES,
// NOT LEAFLET ITSELF. leaflet.js (144 kB) and leaflet.css (14 kB) are
// vendored in vendor/ and injected by the SAME IntersectionObserver
// that triggers the first tile request, so the first view of this page
// costs exactly zero bytes for the map, exactly as the drawn plate
// did. There is no <script> or <link> for Leaflet in index.html and
// there must not be one: adding it puts 158 kB on the critical path
// for a section most visitors never reach.
const LEAFLET_CSS = 'vendor/leaflet.css';
const LEAFLET_JS  = 'vendor/leaflet.js';
const TILE_URL    = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
// CARTO's terms require BOTH credits, and OpenStreetMap's licence
// requires the ODbL link. ⛔ Never trim this string.
const TILE_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions" rel="noopener">CARTO</a>';

// 🚨 DO NOT SIMPLIFY THIS TO `if (window.L)`. THE MINIFIED GSAP BUNDLE
// IN vendor/ LEAKS A GLOBAL CALLED `L` (one of its internal one-letter
// variables escapes its UMD wrapper), so `window.L` is a function on
// this page BEFORE Leaflet has been fetched at all. The first build of
// this map resolved on that global and died on `L.map is not a
// function` with the plate showing its offline message. Feature-detect
// the API, never the name. ⚠️ The same latent trap exists in the
// Shocked Solar build this pattern came from.
const isLeaflet = (o) => !!(o && typeof o.map === 'function' && typeof o.tileLayer === 'function');

let leafletPromise = null;
function loadLeaflet() {
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (isLeaflet(window.L)) { resolve(window.L); return; }
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = LEAFLET_JS;
    js.async = true;
    js.onload = () => (isLeaflet(window.L) ? resolve(window.L) : reject(new Error('leaflet loaded but window.L is not Leaflet')));
    js.onerror = () => reject(new Error('leaflet failed to load'));
    document.head.appendChild(js);
  });
  return leafletPromise;
}

// Brand colours come out of :root, so the map can never drift from the
// palette and no hex is duplicated between the stylesheet and here.
function token(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// The plate's markup. The Leaflet canvas replaces the SVG field; every
// other piece of chrome — the rim, the radius, the key strip below the
// field and the caption under it — is P12/P13's and is unchanged, so
// the component still reads as part of this site rather than as an
// embedded widget.
function mapFigure(a) {
  return `<figure class="map">
    <div class="map__plate" id="areaMapPlate">
      <div class="map__field">
        <div class="map__canvas" id="areaMapCanvas"></div>
        <p class="map__hint" id="areaMapHint" aria-hidden="true">${esc(a.map.hint)}</p>
        <p class="map__dead" id="areaMapDead" role="status">${esc(a.map.deadNote)}</p>
      </div>
      <div class="map__strip">
        <p class="map__legend mono-label"><span class="map__swatch" aria-hidden="true"></span>${esc(a.map.legend)}</p>
        <p class="map__key mono-label"><span class="map__keydot" aria-hidden="true"></span>${esc(a.map.keyLabel)}</p>
      </div>
    </div>
    <figcaption class="map__note"><span class="visually-hidden">${esc(a.map.alt)}</span>${esc(a.map.note)}</figcaption>
  </figure>`;
}

// ⚠️ P13's SUBURB CAP IS UNCHANGED. Client: "not too much information
// where it doesn't need to be." Gold Coast listed eleven suburbs,
// Logan and Ipswich eight; at 1440 that wrapped every row to two lines
// and turned a five-item list into a wall of place names nobody reads
// to the end of. Six is the number that holds ONE line at 1440 for
// every region.
//   · the DATA is untouched — `suburbs` stays complete, because the
//     region page's own intro prose names every one of them and the
//     row links straight to it.
//   · when there are more, the strip says so. A truncated list with no
//     marker reads as an EXCLUSION to anyone living in name seven, and
//     that is the one thing this section must never do.
const SUB_CAP = 6;
const subsHtml = (subs) => {
  const shown = subs.slice(0, SUB_CAP).map(esc).join(' &middot; ');
  return subs.length > SUB_CAP ? `${shown} &middot; and more` : shown;
};

function renderAreas() {
  const a = content.areas;
  $('#areasHead').innerHTML = headHtml(a, 'areasHeadH2');
  $('#areas').setAttribute('aria-labelledby', 'areasHeadH2');
  $('#areasMount').innerHTML =
    `<div class="areas__map reveal reveal--up" data-reveal>${mapFigure(a)}</div>
     <div class="areas__card reveal reveal--rtl" data-reveal>
      ${a.regions.map(r =>
        // A11Y-A4: the row's accessible name was the region PLUS its
        // whole suburb list ("Gold Coast Coomera · Helensvale · …"),
        // which is unusable in a links list. The link is named for where
        // it goes; the suburb strip is visible supporting text and is
        // hidden from the name. Nothing on screen changed.
        // P12: the row carries the SAME marker as the map pin, so the
        // list reads as the map's key rather than as a second, unrelated
        // component. It is the one piece of drawing shared by both
        // halves, which is what makes the cross-highlight legible.
        `<a class="area" href="${esc(AREA_HREF(r.slug))}" data-region="${esc(r.slug)}"
            aria-label="Sliding door repairs in ${esc(r.name)}">
           <span class="area__mark" aria-hidden="true"></span>
           <span class="area__body" aria-hidden="true">
             <span class="area__name">${esc(r.name)}</span>
             <span class="area__subs">${subsHtml(r.suburbs)}</span>
           </span>
           <span class="area__go mono" aria-hidden="true">Covered${GO_CHEV}</span>
         </a>`).join('')}
     </div>`;
  initAreaMap();
}

// Cross-highlight. No rAF, no scroll listener, no observer: six
// listeners on a delegated root, and the state is one class on the
// #areas element plus one attribute, so CSS does all the drawing.
function initAreaMap() {
  const root = $('#areasMount');
  if (!root) return;
  const set = (slug) => {
    root.querySelectorAll('[data-region]').forEach(el =>
      el.classList.toggle('is-lit', !!slug && el.dataset.region === slug));
    root.classList.toggle('is-picking', !!slug);
  };
  const from = (e) => {
    const el = e.target.closest && e.target.closest('[data-region]');
    return el ? el.dataset.region : null;
  };
  root.addEventListener('pointerover', (e) => { const s = from(e); if (s) set(s); });
  root.addEventListener('pointerleave', () => set(null));
  root.addEventListener('focusin', (e) => set(from(e)));
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) set(null);
  });

  mountMapWhenNear(set);
}

// ⚠️ THE GATE. Everything about the map — the library, the stylesheet,
// the first tile — hangs off this one observer, and 320px of rootMargin
// is the whole budget conversation: the map costs nothing until #areas
// is about a third of a screen away, and by the time it is on screen the
// tiles are painted. Same pattern the work reel uses, same reason.
function mountMapWhenNear(setLit) {
  const plate = $('#areaMapPlate');
  if (!plate) return;
  if (!('IntersectionObserver' in window)) { mountMap(setLit); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.disconnect();
      mountMap(setLit);
    });
  }, { rootMargin: '320px 0px' });
  io.observe(plate);
}

function mountMap(setLit) {
  const el = $('#areaMapCanvas');
  const plate = $('#areaMapPlate');
  if (!el || !plate) return;

  loadLeaflet().then(L => buildMap(L, el, plate, setLit)).catch((err) => {
    console.warn('[map] not mounted —', err && err.message);
    // Leaflet itself could not be fetched. The plate says so in one
    // sentence rather than sitting there as an empty grey box, and the
    // region list beside it — which is the actual information — is
    // untouched. #areaMapDead is already in the DOM and already a
    // status region; it only becomes visible.
    plate.classList.add('map--dead');
  });
}

function buildMap(L, el, plate, setLit) {
  const a = content.areas;
  const g = a.map.geo;
  const INK    = token('--ink', '#0F2132');
  const BRONZE = token('--bronze', '#8A5A24');

  // ⚠️ INTERACTION DISCIPLINE — every one of these is a rail, not a
  // preference, and each has a reason on the line above it.
  const map = L.map(el, {
    // The page owns the wheel. A map that eats a scroll gesture is the
    // single worst thing an embedded map does, and this site's whole
    // motion doctrine is that scrolling is never hijacked.
    scrollWheelZoom: false,
    // On a touch device the map starts INERT and the hint says so, so a
    // thumb dragging past #areas scrolls the page instead of panning
    // the map. One tap turns dragging on for the rest of the visit.
    dragging: !NO_HOVER,
    zoomControl: true,
    attributionControl: true,
    keyboard: true,
    zoomSnap: 0.25,
    minZoom: 7,
    maxZoom: 14,
    // Reduced motion gets the static frame it is entitled to: no zoom
    // easing, no tile cross-fade, no marker travel. There is no fly-to
    // anywhere in this component at any setting.
    zoomAnimation: !REDUCED,
    fadeAnimation: !REDUCED,
    markerZoomAnimation: !REDUCED
  });
  map.attributionControl.setPrefix('');

  const tiles = L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIB,
    subdomains: 'abcd',
    maxZoom: 19,
    className: 'map__tiles',
    // Cross-origin images with no credentials, so a broken tile is a
    // clean error we can count rather than a console mystery.
    crossOrigin: true
  });
  // THE FALLBACK, AND IT IS NOT DECORATION. If CARTO is unreachable —
  // offline, blocked, a corporate proxy — the plate must not be an
  // empty grey void. `.map--notiles` gives the canvas the same
  // parchment ground the drawn plate used, and the envelope and the
  // five pins are already vector, so what is left is a legible
  // basemap-less map of his patch rather than nothing at all.
  let tileErrors = 0;
  tiles.on('tileerror', () => {
    if (++tileErrors >= 3) plate.classList.add('map--notiles');
  });
  tiles.on('tileload', () => { plate.classList.add('map--tiled'); });
  tiles.addTo(map);

  // HIS TERRITORY. `envLatLng` is the same ring the drawn plate used,
  // inverse-projected by build_map.py: the east edge IS the Natural
  // Earth coastline between Sandgate and Pottsville, the west and south
  // are the nine named inland places. Two strokes, because one line on
  // a busy basemap disappears: a wide brass casing underneath, then the
  // navy boundary itself on top of it.
  L.polygon(g.envLatLng, {
    color: BRONZE, weight: 9, opacity: 0.28,
    fill: false, interactive: false,
    lineJoin: 'round', lineCap: 'round'
  }).addTo(map);
  const envelope = L.polygon(g.envLatLng, {
    color: INK, weight: 2, opacity: 0.85,
    fillColor: BRONZE, fillOpacity: 0.13,
    interactive: false,
    lineJoin: 'round', lineCap: 'round'
  }).addTo(map);

  // THE PINS ARE THE SAME DRAWING AS THE ROWS. divIcon, not an image
  // marker, so the dot and its label chip are the site's own components
  // (--card plate, --bronze dot, real type) and the anchor box is
  // 44 x 44 by construction — Leaflet is told the icon is 44 x 44 and
  // anchors it at its centre, so there is no invisible hit circle to
  // keep in sync with anything.
  //
  // `data-region` on the icon root is what wires it into the EXISTING
  // cross-highlight: initAreaMap()'s delegated listeners are on
  // #areasMount, the map lives inside #areasMount, so hovering a pin
  // lights its row and hovering a row lights its pin with no new code.
  const bySlug = Object.fromEntries(a.regions.map(r => [r.slug, r]));
  const SIDE_DIR = { w: 'left', e: 'right', s: 'bottom' };
  g.regions.forEach(m => {
    const r = bySlug[m.slug];
    if (!r) return;
    const icon = L.divIcon({
      className: 'map__pinwrap',
      html: `<span class="map__pin" data-region="${esc(m.slug)}" data-side="${esc(m.side)}">
               <span class="map__dot" aria-hidden="true"></span>
               <span class="map__tag">${esc(r.name)}</span>
             </span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
    const marker = L.marker([m.lat, m.lng], {
      icon,
      keyboard: true,
      riseOnHover: true,
      // The accessible name of the marker. The <figcaption> already
      // gives every visitor the description of the whole plate; this is
      // the one region.
      alt: `Sliding door repairs in ${r.name}`,
      title: r.name
    }).addTo(map);
    // Tapping a pin does what tapping the row does: it goes to that
    // region's page. A popup would be a second, weaker copy of the row
    // that is already beside it, on a device where the row is easier to
    // hit. One destination, one behaviour.
    marker.on('click', () => { window.location.href = AREA_HREF(m.slug); });
    marker.on('mouseover', () => setLit(m.slug));
    marker.on('mouseout',  () => setLit(null));
    // Keyboard: Leaflet's markers are focusable, and Enter fires click.
    marker.on('focus', () => setLit(m.slug));
    marker.on('blur',  () => setLit(null));
    // `side` is emitted by build_map.py beside the coordinates and is a
    // LAYOUT fact: it keeps Brisbane, the Gold Coast and Tweed Heads
    // hanging WEST, over his own ground, instead of printing an opaque
    // place-name chip on Moreton Bay or on the Pacific.
    marker.bindTooltip('', { permanent: false, opacity: 0, direction: SIDE_DIR[m.side] || 'left' });
  });

  // A STATIC FIRST FRAME. fitBounds to his patch with `animate: false`
  // at every motion setting — the map is simply already showing the
  // right place when it appears, which is also why there is no
  // setView-then-flyTo anywhere.
  map.fitBounds(envelope.getBounds(), { padding: [26, 26], animate: false });
  // The visitor may pan, but never off into the Pacific or out to
  // Longreach: the frame stays a frame around south-east Queensland.
  map.setMaxBounds(envelope.getBounds().pad(0.55));
  map.setMinZoom(Math.max(7, map.getZoom() - 1.5));

  L.control.scale({ metric: true, imperial: false, position: 'bottomleft', maxWidth: 110 }).addTo(map);

  // The tap-to-interact affordance, and it is only ever shown on a
  // device that needs it: `dragging` was started disabled above for
  // coarse pointers, so until the visitor opts in, a swipe over the map
  // scrolls the page.
  const hint = $('#areaMapHint');
  if (NO_HOVER) {
    plate.classList.add('map--inert');
    const wake = () => {
      map.dragging.enable();
      plate.classList.remove('map--inert');
      el.removeEventListener('click', wake);
    };
    el.addEventListener('click', wake);
  } else if (hint) {
    hint.remove();
  }

  // The canvas is inside a clip-path reveal and inside a grid column
  // that resolves after fonts land; Leaflet measures once at
  // construction, so it has to be told when the box it measured is no
  // longer the box it is in.
  if ('ResizeObserver' in window) {
    let first = true;
    new ResizeObserver(() => {
      if (first) { first = false; return; }
      map.invalidateSize({ animate: false });
    }).observe(el);
  }
  setTimeout(() => map.invalidateSize({ animate: false }), 400);
}

// --- 12 · FAQ ----------------------------------------------------
function renderFaq() {
  $('#faqHead').innerHTML = headHtml(content.faqIntro, 'faqHeadH2');   // A11Y-M2
  $('#faq').setAttribute('aria-labelledby', 'faqHeadH2');
  $('#faqMount').innerHTML = content.faq.map(f =>
    `<details class="faq__item">
       <summary class="faq__q">
         ${esc(f.q)}
         <svg class="faq__chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>
       </summary>
       <div class="faq__inner"><div><p class="faq__a">${esc(f.a)}</p></div></div>
     </details>`).join('') +
    `<div class="faq__foot">
       <p class="faq__foot-lead">${esc(content.faqIntro.footLead)}</p>
       <a class="btn btn--primary" data-sms-body="${esc(content.faqIntro.ctaSmsBody)}" href="${esc(content.booking.smsHref)}">${esc(content.faqIntro.ctaLabel)}</a>
     </div>`;
  const l = $('#faqMount');
  l.classList.add('reveal', 'reveal--up');
  l.setAttribute('data-reveal', '');
}

// --- 13 · CONTACT ------------------------------------------------
// Left: the italic line, the call and text rows, and the risk-reversal
// stack repeated at the point of conversion. Right: the form card.
//
// ⚠️ P13 — THE FORM IS FULLY VISIBLE AT EVERY WIDTH AND NEVER TAKES
// FOCUS. It used to be a `<details data-macc>`: at ≤640 initMobileStructure()
// closed it and `.contact__formwrap:not([open]) .contact__formcard` hid
// every field behind a summary, so on a phone — the device that
// composes the SMS — the last section of the page showed a heading, two
// phone rows and a closed drawer. The four fields ARE the offer
// ("fill in the blanks and it writes the text"), and an offer behind a
// disclosure is one extra decision at the exact point the visitor is
// deciding. It is a plain <div> now, so there is no toggle, no
// `open` state and no summary to press.
// ⛔ Do NOT add autofocus, .focus() or scrollIntoView to these fields.
// Nothing here may pop the keyboard: focus is the visitor's, on a
// deliberate tap. `--fs-input` is a 16px floor so iOS cannot zoom.
function renderContact() {
  const c = content.contact;
  const f = c.fields;
  $('#contactHead').innerHTML = headHtml(c, 'contactHeadH2');   // A11Y-M2
  $('#contact').setAttribute('aria-labelledby', 'contactHeadH2');

  // A11Y-H4 (1.3.5 Identify Input Purpose, AA). None of the four inputs
  // carried `autocomplete`, so browser and AT autofill could not work on
  // the two fields that collect information ABOUT THE USER. `door` and
  // `message` are not in the SC's input-purpose list and correctly get
  // nothing. `inputmode`/`enterkeyhint` ride along because this form is
  // at the bottom of a 16,000px page on a phone.
  const AUTO = {
    name:    { autocomplete: 'name',            enterkeyhint: 'next' },
    suburb:  { autocomplete: 'address-level2',  enterkeyhint: 'next' },
    door:    { autocomplete: 'off',             enterkeyhint: 'next' },
    message: { autocomplete: 'off',             enterkeyhint: 'send' }
  };
  const attrs = (id) => Object.entries(AUTO[id] || {})
    .map(([k, val]) => ` ${k}="${esc(val)}"`).join('');
  const field = (id, o, textarea) => textarea
    ? `<div class="field"><label for="f-${id}">${esc(o.label)}</label><textarea id="f-${id}" name="${id}" rows="4" placeholder="${esc(o.placeholder)}"${attrs(id)}></textarea></div>`
    : `<div class="field"><label for="f-${id}">${esc(o.label)}</label><input id="f-${id}" name="${id}" type="text" placeholder="${esc(o.placeholder)}"${attrs(id)}></div>`;

  // ⭐ THE RISK-REVERSAL STACK (P13). The warranty panel's three rows
  // repeated at the point of conversion — never a new claim — with the
  // one reversal that actually decides the page prepended to them, so
  // the stack reads offer first and credentials after it. See
  // content.contact.quoteFact.
  const facts = [c.quoteFact].concat(content.warranty.points).map(p =>
    `<span class="contact__fact">${esc(p.label)} · ${esc(p.value)}</span>`).join('');

  $('#contactMount').innerHTML =
    `<div>
       <p class="contact__italic em-serif">${esc(c.italicLine)}</p>
       <div class="contact__direct">
         <a class="contact__primary" href="${esc(content.booking.smsHref)}" data-sms-body="${esc(content.hero.primaryCta.smsBody)}"><span class="k">${esc(content.hero.primaryCta.label)}</span><span class="num">${esc(content.booking.phone)}</span></a>
         <!-- P14: this row used to reprint content.booking.phone, so the
              closing section stacked the SAME ten digits twice, 70px
              apart, and read as a duplication bug. It is the same
              number as the row above it by definition — the row's job
              is the second VERB, not a second destination — so it says
              so instead of repeating it. The tel: href is unchanged,
              the label is unchanged, and the number is still on screen
              one row up and again in the footer. -->
         <a href="${esc(content.booking.phoneHref)}"><span class="k">${esc(c.fallbackLabel)}</span><span class="num">${esc(c.fallbackValue)}</span></a>
         <a href="mailto:${esc(content.booking.email)}"><span class="k">${esc(c.emailNote)}</span>${esc(content.booking.email)}</a>
       </div>
       <div class="contact__facts">${facts}</div>
     </div>
     <div class="contact__formwrap">
       <div class="contact__formcard">
         <form class="form" id="contactForm" novalidate>
           ${field('name', f.name)}
           ${field('suburb', f.suburb)}
           ${field('door', f.door)}
           ${field('message', f.message, true)}
           <button class="btn btn--primary btn--block" type="submit">${esc(c.submitLabel)}</button>
           <p class="form__note">${esc(content.booking.responseNote)}</p>
           <p class="form__fail" id="formFail" role="alert" hidden>${esc(c.noteFailure)}
             <a href="${esc(content.booking.phoneHref)}" class="num">${esc(c.noteFailureTel)}</a>.</p>
         </form>
       </div>
     </div>`;

  // The form NEVER posts. It composes a text message; nothing is sent
  // until the visitor presses send, and there is no success state.
  $('#contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(e.target);
    const trim = (k) => String(d.get(k) || '').trim();

    // ⚠️ ADVERSARIAL-H5 FIX 2026-08-22. `fillIns` used to be hardcoded
    // to '' here, on the reasoning that the form supplies the values.
    // It does not supply the ones the visitor left BLANK — so a visitor
    // who opened the form, typed nothing and pressed the button sent
    // Lachlan a photo with no name, no suburb, no door type and NO
    // PROMPT TO ADD ANY, which is strictly worse than every other CTA on
    // the site. content.js:69 states the rule this broke: the fill-in
    // blanks are ALWAYS appended last.
    //
    // The blanks are now computed PER FIELD: each one the visitor left
    // empty comes through as a blank for them to fill in the messages
    // app, and each one they filled is already in the body, so nothing
    // is ever asked for twice. An entirely empty form now composes the
    // EXACT default CTA body, blanks and all.
    const filled = {
      name:   trim('name'),
      suburb: trim('suburb'),
      door:   trim('door')
    };
    // ⚠️ NO symptomSuffix() IN THIS LIST. buildSmsHref appends it
    // itself, between the details and the blanks — putting it here as
    // well shipped every symptom sentence TWICE the moment a chip was
    // pressed and the form was submitted. Found while fixing H5.
    const parts = [
      content.hero.primaryCta.smsBody,
      filled.name   ? `My name: ${filled.name}.`   : '',
      filled.suburb ? `Suburb: ${filled.suburb}.`  : '',
      filled.door   ? `Door type: ${filled.door}.` : '',
      trim('message')
    ].filter(Boolean).join(' ');

    // SMS_FILL_INS is content.booking.fillIns, e.g.
    // "My name: , Suburb: , Door type: ". Drop the clauses this
    // submission already answered, keep the rest in their original
    // order, and hand the remainder to buildSmsHref so they land LAST
    // exactly as they do on every other CTA.
    //
    // ⚠️ THE TRAILING SPACE IN EACH CLAUSE IS THE BLANK. `fillIns` is
    // "My name: , Suburb: , Door type: " — strip the space after a colon
    // and there is nowhere for the visitor to type. So the clauses are
    // matched with [^,]+ and only their LEADING space is removed; the
    // trailing one is the whole point. Rejoining all three reproduces
    // `fillIns` byte for byte, which is asserted below.
    const KEY = { name: 'My name:', suburb: 'Suburb:', door: 'Door type:' };
    const remaining = (String(SMS_FILL_INS).match(/[^,]+/g) || [])
      .map(s => s.replace(/^\s+/, ''))
      .filter(clause => !Object.keys(KEY)
        .some(k => filled[k] && clause.indexOf(KEY[k]) === 0))
      .join(', ');
    window.location.href = buildSmsHref(parts, remaining);

    // A11Y-M5 / ADVERSARIAL-H4 — THE FAILURE PATH, AND ONLY THE FAILURE
    // PATH. On a desktop with no SMS handler the sms: navigation does
    // nothing at all: no error, no feedback, a form that looks broken.
    // If we are still here and still visible a beat later, that is what
    // happened, so the notice appears. If the messages app opened, the
    // document is hidden (or we have navigated away) and the visitor
    // never sees a pre-emptive apology for a failure that did not
    // happen. `role="alert"` announces it when it appears.
    const fail = $('#formFail');
    if (fail) {
      setTimeout(() => {
        if (document.visibilityState === 'visible' && document.hasFocus()) {
          fail.hidden = false;
        }
      }, 1200);
    }
  });

  const g = $('#contactMount');
  g.classList.add('reveal', 'reveal--split');
  g.setAttribute('data-reveal', '');
}

// --- 14 · FOOTER -------------------------------------------------
function renderFooter() {
  const b = content.brand, f = content.footer;
  const social = b.socials.instagram
    ? `<li><a href="${esc(b.socials.instagram)}" rel="noopener" target="_blank">${esc(f.directLabels.instagram)}</a></li>` : '';
  const fb = b.socials.facebook
    ? `<li><a href="${esc(b.socials.facebook)}" rel="noopener" target="_blank">Facebook</a></li>` : '';

  $('#footerMount').innerHTML =
    `<div class="footer__col footer__col--blurb">
       <p class="footer__blurb">${esc(f.blurb)}</p>
       <!-- P12: the blurb column was one paragraph and then ~330px of
            nothing at 1440. The hours and the warranty are the two facts
            people go to a footer to find, and both are already on the
            page in the trust seam — this repeats them, it does not
            invent them. content.trust[3] and [1], read by index so a
            copy change in one place still moves both. -->
       <dl class="footer__facts">
         <div><dt>${esc(f.factLabels.hours)}</dt><dd>${esc(content.trust[3])}</dd></div>
         <div><dt>${esc(f.factLabels.warranty)}</dt><dd>${esc(content.trust[1])}</dd></div>
       </dl>
     </div>
     <div class="footer__col">
       <h3>${esc(f.columns.repairs)}</h3>
       <ul>${content.services.items.map(s => `<li><a href="#svc-${esc(s.id)}">${esc(s.name)}</a></li>`).join('')}</ul>
     </div>
     <div class="footer__col footer__col--areas">
       <h3>${esc(f.columns.areas)}</h3>
       <p class="footer__intro">${esc(content.areas.lede)}</p>
       <ul>${content.areas.regions.map(r => `<li><a href="${esc(AREA_HREF(r.slug))}">${esc(r.name)}</a></li>`).join('')}</ul>
     </div>
     <div class="footer__col">
       <h3>${esc(f.columns.direct)}</h3>
       <ul>
         <li><a href="${esc(content.booking.phoneHref)}"><span class="num">${esc(content.booking.phone)}</span></a></li>
         <li><a href="mailto:${esc(content.booking.email)}">${esc(content.booking.email)}</a></li>
         ${social}${fb}
       </ul>
     </div>
     <div class="footer__callrow">
       <a class="btn btn--primary footer__call" href="${esc(content.booking.phoneHref)}">${esc(content.hero.secondaryCtaLabel)} <span class="num">${esc(content.booking.phone)}</span></a>
     </div>
     <div class="footer__bottom">
       <span>&copy; ${new Date().getFullYear()} ${esc(b.name)}</span>
       ${b.abn ? `<span>ABN ${esc(b.abn)}</span>` : ''}
       <a href="${esc(f.builtBy.href)}" rel="noopener" target="_blank">${esc(f.builtBy.label)}</a>
     </div>`;
}

// --- JSON-LD -----------------------------------------------------
// ONE @graph, four kinds of node: the business, the WebSite, one
// Service per visible category, and the FAQPage.
//
// ⛔ WHAT THIS MUST NEVER EMIT (see content.js → schema):
//    aggregateRating · review · address · any price other than the
//    from-figure · any opening hours other than the real ones.
//    His 5.0/61 on hipages is REAL, but the reviews are hosted by
//    hipages, not by this site. Marking up someone else's reviews as
//    your own rich result is the exact pattern that gets sites
//    penalised, and the ACL view on review presentation is
//    unforgiving. The rating lives in the VISIBLE #voices banner,
//    attributed and linked, and nowhere else.
//
// THE minPrice RULE, WRITTEN DOWN SO IT CANNOT DRIFT
//    His only published price is the flyer's "FROM $150 +GST", and
//    the flyer is advertising SLIDING DOOR REPAIRS — the running
//    gear. So a Service carries the from-price if, and only if, its
//    own detail list contains a roller or track repair. That is
//    derived from content.js, not typed in: mesh replacement and
//    Petways pet-door installation are supply-and-install jobs
//    nobody has quoted $150 for, so they carry no offer at all.
//    CONFIRM 9 is still open on what the $150 buys; if the answer
//    narrows it, narrow this test, do not add a second number.
const PRICED_WORK = /roller|track/i;

function renderSchema() {
  const b = content.brand;
  const site = b.siteUrl;
  const bizId = site + '#business';
  const price = content.value.priceFrom;

  // content.schema IS the business node; _seo.py owns its url/image/logo.
  const org = Object.assign({ '@id': bizId }, content.schema);
  delete org['@context'];                     // the @graph carries it once

  const website = {
    '@type': 'WebSite',
    '@id': site + '#website',
    url: site,
    name: b.name,
    inLanguage: 'en-AU',
    publisher: { '@id': bizId }
  };

  const services = content.services.items.map(it => {
    const node = {
      '@type': 'Service',
      '@id': site + '#service-' + it.id,
      name: it.name,
      serviceType: it.name,
      description: it.blurb,
      provider: { '@id': bizId },
      areaServed: content.schema.areaServed
    };
    if (it.items.some(x => PRICED_WORK.test(x.name))) {
      node.offers = {
        '@type': 'Offer',
        priceCurrency: price.currency,
        priceSpecification: {
          '@type': 'PriceSpecification',
          priceCurrency: price.currency,
          minPrice: price.amount,
          valueAddedTaxIncluded: !price.gst   // he quotes "+GST", so false
        }
      };
    }
    return node;
  });

  const faqPage = {
    '@type': 'FAQPage',
    '@id': site + '#faq',
    mainEntity: content.faq.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  $('#ldSchema').textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [org, website].concat(services, [faqPage])
  });
}

// ============================================================
// 3. NAV DRAWER
// ============================================================
function initDrawer(lenis) {
  const burger = $('#navBurger');
  const drawer = $('#navDrawer');
  const closeBtn = $('#drawerClose');
  const main = $('#main');
  const footer = $('#footer');
  let lastFocus = null;

  // ⚠️ A11Y-B3 (2.4.3 Focus Order · 4.1.2) — THE DRAWER LEAKED FOCUS.
  // The panel declares role="dialog" aria-modal="true", but only #main
  // and #footer were inerted. `<header class="nav">` and the `.fab` are
  // their SIBLINGS, so tabbing past the last drawer button walked
  // straight out of the "modal" into 7 controls behind the scrim —
  // including a `.fab` that is invisible. Screen-reader users got a
  // virtual buffer confined to the dialog while their keyboard focus was
  // not: the two disagreed. Measured trail was 6 in-drawer stops → the
  // fab → body → the skip link → the whole header → back in.
  //
  // Everything outside the dialog is inert now. The header is inerted as
  // a whole and the drawer is INSIDE it, so `inert` would swallow the
  // dialog too — `.nav__in` (the bar itself) is inerted instead, which
  // is every control in the header except the drawer. If the drawer is
  // ever moved out of <header>, inert `#nav` itself and delete this note.
  // ⚠️ THIS LIST IS EVERY DIRECT CHILD OF <body> THAT CAN TAKE FOCUS,
  // minus the drawer. Found by re-running the 16-Tab trail after the
  // first fix: `.skip` is also a body-level sibling, so with main,
  // footer, the nav bar and the fab all inerted, tabbing out of the
  // drawer still landed on the skip link. If anything focusable is ever
  // added at body level, add it here in the same commit.
  const navBar = $('.nav__in');
  const fab = $('#callFab');
  const skip = $('.skip');
  const outside = [main, footer, navBar, fab, skip].filter(Boolean);

  function open() {
    lastFocus = document.activeElement;
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));   // one-shot, not a loop
    burger.setAttribute('aria-expanded', 'true');
    outside.forEach(el => { el.inert = true; });
    if (lenis && lenis.stop) lenis.stop();
    closeBtn.focus();
  }
  function close() {
    drawer.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    outside.forEach(el => { el.inert = false; });
    if (lenis && lenis.start) lenis.start();
    const done = () => { drawer.hidden = true; };
    if (REDUCED) done(); else setTimeout(done, 320);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  burger.addEventListener('click', () => {
    burger.getAttribute('aria-expanded') === 'true' ? close() : open();
  });
  closeBtn.addEventListener('click', close);
  drawer.addEventListener('click', e => { if (e.target === drawer) close(); });
  // Any link inside the drawer closes it — including tel:/sms:.
  drawer.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') close();
  });
}

// ============================================================
// 4. LENIS + GSAP — a SINGLE rAF source
// ============================================================
// Smooth WHEEL on desktop; on touch, Lenis hands scrolling back to
// the OS (syncTouch:false). Exactly ONE rAF driver on this page: the
// gsap.ticker (or the bare fallback loop when GSAP is absent).
// The desktop scrubs (hero parallax, roller rotation) run inside the
// SAME ticker callback — never a second rAF, never a scroll listener.
let lenis = null;

function initScroll() {
  if (typeof Lenis === 'undefined') return null;
  lenis = new Lenis({
    duration: 1.15,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 1
  });

  const scrub = makeScrub();   // no-op unless the desktop gate passes

  if (window.gsap) {
    gsap.ticker.add(time => { lenis.raf(time * 1000); scrub(); });
    gsap.ticker.lagSmoothing(0);
  } else {
    // Fallback driver ONLY when GSAP is absent. Never both.
    const loop = t => { lenis.raf(t); scrub(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  return lenis;
}

// The two sanctioned scroll scrubs, both behind the ONE desktop gate.
// Returns a function called from the existing ticker — it never
// installs its own driver.
function makeScrub() {
  if (REDUCED || NO_HOVER || innerWidth < 1025) return () => {};

  const media = $('.hero__media');
  const hero = $('#hero');
  const rollerFig = $('.roller-fig svg');
  const services = $('#services');
  let lastY = -1;

  return function scrub() {
    const y = window.scrollY;
    if (y === lastY) return;
    lastY = y;

    // Hero parallax — the REEL PLANE only, never the type. Written to
    // `translate`, not `transform`, so it never collides with the
    // cover-crop object-position or any CSS transform on the video.
    if (media && hero) {
      const h = hero.offsetHeight || 1;
      const p = Math.min(1, Math.max(0, y / h));
      media.style.translate = `0 ${(12 * p).toFixed(2)}px`;
    }

    // Roller rotation — the one rotation, mapped to section progress.
    if (rollerFig && services) {
      const r = services.getBoundingClientRect();
      const vh = innerHeight || 1;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      rollerFig.style.setProperty('--deg', (p * 360).toFixed(1));
    }
  };
}

// Anchor smooth-scroll. The href is re-read INSIDE the handler and
// anything that is not a same-page hash bails immediately — tel: and
// sms: links must never be hijacked.
function initAnchors() {
  document.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');            // re-read, not cached
    if (!href || href.charAt(0) !== '#') return;    // tel:/sms:/mailto:/http bail here
    if (href.length < 2) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    if (lenis && lenis.scrollTo) {
      lenis.scrollTo(target, { offset: -60, duration: NO_HOVER ? 0.6 : 1.2 });
    } else {
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 60, behavior: REDUCED ? 'auto' : 'smooth' });
    }
    moveFocusTo(target);
  });
}

// ⚠️ A11Y-B1 (2.4.1 Bypass Blocks · 2.4.3 Focus Order) — THE HIGHEST
// IMPACT FIX IN THE AUDIT, AND IT IS THIS FUNCTION.
// initAnchors() calls preventDefault() on every in-page hash link, which
// killed the browser's own behaviour of moving FOCUS to the target. The
// page scrolled and focus stayed put. Consequences, both measured:
//   · the skip link — the FIRST tab stop on every visit — did nothing
//     at all. Enter scrolled nowhere and the next Tab was `.brand`, so a
//     keyboard or switch user tabbed the whole header on every load.
//   · all six in-page nav links scrolled the page and left focus in the
//     nav, so a visitor looking at the FAQ pressed Tab and landed on the
//     phone pill at the top of the page.
// Scrolling is now only half the job: focus follows the scroll, which is
// what the browser would have done if we had not intercepted it.
//
// The tabindex is TEMPORARY. A permanent tabindex="-1" on a dozen
// sections is a trap for anyone who later queries focusable elements, so
// it is removed on blur. `preventScroll` is essential: without it the
// browser jumps to the target instantly and fights Lenis' animation.
function moveFocusTo(target) {
  if (!target || !target.focus) return;
  const hadTabindex = target.hasAttribute('tabindex');
  if (!hadTabindex) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  if (!hadTabindex) {
    target.addEventListener('blur', function drop() {
      target.removeAttribute('tabindex');
      target.removeEventListener('blur', drop);
    });
  }
}

// ============================================================
// 5. REVEALS — IntersectionObserver + a 1500ms failsafe
// ============================================================
function initReveals() {
  // Section heads carry data-reveal WITHOUT the .reveal clip class:
  // .is-in only fires the track-rule roller travel.
  $$('.sec__head').forEach(h => h.setAttribute('data-reveal', ''));
  const els = $$('[data-reveal]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

  els.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
    else io.observe(el);
  });

  setTimeout(() => {
    $$('[data-reveal]:not(.is-in)').forEach(el => el.classList.add('is-in'));
  }, 1500);
}

// ============================================================
// 6. FAB — labelled pill, ≤640, hidden over ANY primary CTA
// ============================================================
// ⚠️ 2026-08-22: THE WATCH LIST GREW, AND IT IS A BUG FIX.
// The fab is fixed to the bottom centre of the viewport, and #problem
// now carries its risk reversal ("nothing sends until you press send")
// and its send button in that exact strip. The pill was landing on top
// of both: the site's most important reassurance, hidden at the exact
// moment of doubt. It also sat over the new CTAs in #warranty, #voices
// and #faq.
// The fix is the fab's own logic, not padding. A fab exists to offer a
// call when NOTHING else is on screen; if a real CTA is visible, the
// fab has no job and gets out of the way.
function initFab() {
  const fab = $('#callFab');
  if (!fab) return;
  fab.setAttribute('aria-label', content.booking.fabLabel);

  let scrolled = false;
  let overConversion = false;
  const apply = () => fab.classList.toggle('is-visible', scrolled && !overConversion);

  const toggle = () => { scrolled = window.scrollY > 600; apply(); };
  toggle();
  window.addEventListener('scroll', toggle, { passive: true });

  // #contact and #footer at 30% (they are tall), every in-page CTA at
  // any visibility (they are one button high). Same observer, two
  // thresholds, no second rAF and no scroll listener beyond the one
  // above, which was already here.
  const bands = ['#contact', '#footer'].map(sel => $(sel)).filter(Boolean);
  // ⚠️ P14 ADDED TWO. `.emergency__cta` was always a `.btn--primary`
  // and was never on this list, so the pill has been sitting on top of
  // the ONE call button on the page that answers an urgent door — the
  // exact defect the note above says was fixed, with one band missed.
  // `.svc__foot` is #services' new next step and would have been the
  // second. If a band gains a CTA, it gains a selector here.
  const ctas = $$('.picker__cta, .value__cta, .voices__cta, .faq__foot, .contact__direct, .emergency__cta, .svc__foot');
  if ('IntersectionObserver' in window && (bands.length || ctas.length)) {
    const seen = new Map();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const min = bands.includes(e.target) ? 0.3 : 0;
        seen.set(e.target, e.isIntersecting && e.intersectionRatio > min - 0.0001);
      });
      overConversion = Array.from(seen.values()).some(Boolean);
      apply();
    }, { threshold: [0, 0.3] });
    bands.forEach(el => io.observe(el));
    ctas.forEach(el => io.observe(el));
  }
}

// ============================================================
// 7. MOBILE STRUCTURE (M0)
//    [data-macc] details: forced open ≥641, accordion ≤640.
//    ⚠️ P13: ONLY #story uses it now. #contact's form was taken out
//    of it deliberately — the fill-in-the-blanks form must be fully
//    visible at ≤640, because on a phone it IS the offer. See the
//    note above renderContact(). #services owns a real <details> at
//    every breakpoint (client direction: "maybe drop down info"),
//    and #voices is a rail everywhere, so the ≤640 DOM move of the
//    voices cards into #work has been RETIRED — a rail costs one
//    card height on a phone, which is what the merge existed to save.
// ============================================================
function initMobileStructure() {
  const mq = matchMedia('(max-width: 640px)');
  function apply() { $$('[data-macc]').forEach(d => { d.open = !mq.matches; }); }
  apply();
  if (mq.addEventListener) mq.addEventListener('change', apply);
  else mq.addListener(apply);
}

// ============================================================
// 8. KICK OFF
// ============================================================
run('nav',          renderNav);
run('hero',         renderHero);
run('trust',        renderTrust);
run('problem',      renderProblem);
run('value',        renderValue);
run('services',     renderServices);
run('emergency',    renderEmergency);
run('work',         renderWork);
run('beforeAfter',  renderBeforeAfter);
run('warranty',     renderWarranty);
run('story',        renderStory);
run('voices',       renderVoices);
run('areas',        renderAreas);
run('faq',          renderFaq);
run('contact',      renderContact);
run('footer',       renderFooter);
run('schema',       renderSchema);

// Every [data-sms-body] link is built by the helper, so the fill-in
// blanks are last on all of them by construction.
run('sms',          refreshSmsLinks);

run('scroll',  () => { initScroll(); });
run('drawer',  () => { initDrawer(lenis); });
run('anchors', initAnchors);
run('reveals', initReveals);
run('fab',     initFab);
run('mobile',  initMobileStructure);
run('heroReel', initHeroReel);
