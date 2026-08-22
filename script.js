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

// ============================================================
// 1. SMS — the site's one repeated idea
// ============================================================
// ⚠️ ORDER MATTERS AND IT IS NOT COSMETIC.
// details (what the CTA is about) → symptom (what they tapped)
// → FILL-IN BLANKS, ALWAYS LAST. `data-sms-body` holds the DETAILS
// ONLY and must never contain the blanks.
const SMS_FILL_INS = content.booking.fillIns;

let symptomPicks = [];

function symptomSuffix() {
  if (!symptomPicks.length) return '';
  return symptomPicks.map(id => {
    const s = content.symptoms.find(x => x.id === id);
    return s ? s.smsBody : '';
  }).filter(Boolean).join(' ');
}

function buildSmsHref(details, fillIns = SMS_FILL_INS) {
  const lead = [String(details || '').trim(), symptomSuffix()].filter(Boolean).join(' ');
  const body = lead ? `${lead} ${fillIns}` : fillIns;   // blanks LAST, always
  return `${content.booking.smsHref}?&body=${encodeURIComponent(body)}`;
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
    const body = symptomSuffix();
    // The label only says "that" once there IS a that. With nothing
    // picked the button is the same free-quote ask as every other CTA
    // on the page, and its body carries the photo sentence, so the
    // message is never a bare set of fill-in blanks.
    sendBtn.textContent = body ? content.problem.ctaLabel : content.problem.ctaLabelEmpty;
    // data-sms-body is the DETAILS ONLY. buildSmsHref appends the
    // symptom suffix and then the fill-in blanks, in that order — put
    // the suffix in here as well and every sentence ships twice.
    sendBtn.dataset.smsBody = content.problem.ctaSmsLead;
    // A11Y-M3: never toggle `hidden` on a live region. Emptying it is
    // enough — an empty element is still in the accessibility tree, so
    // the NEXT injection is announced, and clearing it announces the
    // removal. `.picker__preview:empty { display: none }` does the
    // visual half in CSS, so nothing on screen changed.
    preview.innerHTML = body
      ? `<span class="k">${esc(content.problem.previewLabel)}</span>` + esc(body)
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
         <p class="value__note">${esc(content.warranty.heading)}</p>
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
       <p>${esc(p1)}</p>
       ${rest.length ? `
       <div class="story__quoted">
         <p class="story__attr mono-label">${esc(s.quoteAttr)}</p>
         <details class="story__more" data-macc open>
           <summary>${esc(s.moreLabel)}${CHEV}</summary>
           <div>${rest.map(p => `<p>${esc(p)}</p>`).join('')}</div>
         </details>
       </div>` : ''}
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
function trimCaveat(items) {
  const n = items.filter(it => it && it.trimmed).length;
  if (!n) return '';
  const t = content.voices.trimNote;
  const word = t.words[n] || String(n);
  return ' ' + (n === 1 ? t.one : t.many).replace('{N}', word);
}

function renderVoices() {
  const v = content.voices;
  if (!v.items || !v.items.length) { $('#voices').hidden = true; return; }
  // The lede is the base sentence plus the computed caveat. `v` itself
  // is never mutated: content.js stays the source of truth.
  const head = Object.assign({}, v, { lede: v.lede + trimCaveat(v.items) });
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

// The map is a VENDORED SVG. Every path in content.areas.map.geo was
// generated from the Natural Earth 10m coastline by
// design/map-build/build_map.py; nothing is fetched, so the page's
// off-origin request count is unchanged by a map. There is no tile
// server, no Leaflet, and no second scroll owner.
//
// ⭐ P12 — THE LAYER STACK, and why it is in this order. The old map was
// four flat shapes (sea, land, envelope, pins) and read as a beige blob
// on navy. It is now nine layers, every one of them derived from the
// same projection, painted back to front:
//
//   1  sea            --ink
//   2  graticule      real quarter-degree lat/lon hairlines, 0.06 cream.
//                     Painted UNDER the land, so it only shows in water.
//   3  shelf          three strokes of the OPEN coastline at 34/18/7 and
//                     0.035/0.045/0.07 cream. Under the land, so only the
//                     seaward half survives: the coast glow of a chart.
//   4  land           the unserved ground, --map-land
//   5  envelope lift  a real feDropShadow, so the service area sits ON
//                     the land instead of being painted into it
//   6  envelope       --map-served, a WARMER, LIGHTER ground. The area he
//                     covers is the lit part of the picture; everything
//                     else steps back. This is what replaced a 0.20
//                     bronze tint that was nearly invisible over cream.
//   7  envelope glow  an 18-unit bronze stroke CLIPPED to the envelope,
//                     i.e. an inner rim light, not an outline
//   8  envelope edge  the 3-unit brass edge itself
//   9  shore          a 1.4-unit --ink hairline on the coastline, which
//                     is what stops the lit envelope from bleeding into
//                     the bay at small sizes
//
// ⚠️ THE PINS AND LABELS ARE HTML, NOT SVG, AND THAT IS THE POINT.
// SVG <text> in a viewBox scales with the plate, which is why the old
// build needed a 30-unit label at desktop and a 42-unit one at ≤640 and
// still could not give a pin a 44px tap target without an r=78 invisible
// circle. As HTML the label is a real chip from the type system on a
// real --card plate, it sets at one size at every plate width, the
// anchor IS 44x44, and focus is a normal CSS ring. The geometry still
// comes from the same generated data: each pin is placed at the
// xPct/yPct the build script emits.
//
// Interaction is one idea used twice: a region is either hovered or
// focused, in the list OR on the map, and both halves light up. It is
// colour, shadow and opacity only, so reduced motion only has to turn
// the transition off, not the feature.
function mapSvg(a) {
  const g = a.map.geo;
  const byslug = Object.fromEntries(a.regions.map(r => [r.slug, r]));
  const pins = g.regions.map(m => {
    const r = byslug[m.slug];
    if (!r) return '';
    return `<a class="map__pin" href="${esc(AREA_HREF(m.slug))}" data-region="${esc(m.slug)}"
               data-side="${esc(m.side)}" style="--px:${m.xPct}%;--py:${m.yPct}%"
               aria-label="Sliding door repairs in ${esc(r.name)}">
              <span class="map__dot" aria-hidden="true"></span>
              <span class="map__tag" aria-hidden="true">${esc(r.name)}</span>
            </a>`;
  }).join('');

  // ⚠️ A11Y-M1 (4.1.2 · 1.3.1) — the history, because it constrains this.
  // The <svg> once carried `role="img"`, which makes its ENTIRE SUBTREE
  // presentational by ARIA rule, and that subtree then held five
  // focusable links. The fix at the time was to strip the role. Now that
  // the links are HTML siblings the <svg> owns no focusable content at
  // all, so it can simply be aria-hidden in one place. The description
  // is unchanged: it is the <figcaption>'s first sentence, real text
  // every visitor gets, and each pin keeps its own aria-label.
  const grat = g.graticule.map(d => `<path d="${esc(d)}"></path>`).join('');
  const shelf = [[34, '.035'], [18, '.045'], [7, '.07']]
    .map(([w, o]) => `<path d="${esc(g.coast)}" stroke-width="${w}" stroke-opacity="${o}"></path>`).join('');
  const islands = g.islands.map(d => `<path class="map__land" d="${esc(d)}"></path>`).join('');
  return `<figure class="map">
    <div class="map__plate">
      <div class="map__field">
        <svg class="map__svg" viewBox="${esc(g.viewBox)}" focusable="false" aria-hidden="true">
          <defs>
            <clipPath id="mapEnvClip"><path d="${esc(g.envelope)}"></path></clipPath>
            <filter id="mapEnvLift" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="7" stdDeviation="10"
                            flood-color="rgb(15,33,50)" flood-opacity="0.30"></feDropShadow>
            </filter>
          </defs>
          <rect class="map__sea" x="0" y="0" width="100%" height="100%"></rect>
          <g class="map__grat">${grat}</g>
          <g class="map__shelf">${shelf}</g>
          <path class="map__land" d="${esc(g.land)}"></path>
          ${islands}
          <g filter="url(#mapEnvLift)"><path class="map__area" d="${esc(g.envelope)}"></path></g>
          <g clip-path="url(#mapEnvClip)"><path class="map__area-glow" d="${esc(g.envelope)}"></path></g>
          <path class="map__area-edge" d="${esc(g.envelope)}"></path>
          <path class="map__shore" d="${esc(g.coast)}"></path>
        </svg>
        <div class="map__pins">${pins}</div>
      </div>
      <div class="map__strip">
        <p class="map__legend mono-label"><span class="map__swatch" aria-hidden="true"></span>${esc(a.map.legend)}</p>
        <p class="map__key mono-label"><span class="map__keydot" aria-hidden="true"></span>${esc(a.map.keyLabel)}</p>
        <p class="map__scale mono-label" aria-hidden="true">
          <span class="map__bar" style="--sw:${g.scale.pct}"></span>${esc(g.scale.label)}
        </p>
      </div>
    </div>
    <figcaption class="map__note"><span class="visually-hidden">${esc(a.map.alt)}</span>${esc(a.map.note)}</figcaption>
  </figure>`;
}

function renderAreas() {
  const a = content.areas;
  $('#areasHead').innerHTML = headHtml(a, 'areasHeadH2');
  $('#areas').setAttribute('aria-labelledby', 'areasHeadH2');
  $('#areasMount').innerHTML =
    `<div class="areas__map reveal reveal--up" data-reveal>${mapSvg(a)}</div>
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
             <span class="area__subs">${r.suburbs.map(esc).join(' &middot; ')}</span>
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
// Left: the italic line, the call and text rows, and the three trust
// facts repeated at the point of conversion. Right: the form card.
// At ≤640 the form collapses behind "Or fill in the details" and the
// call row leads (M0).
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

  // The trust facts repeated here are the warranty panel's rows —
  // repetition at the point of conversion, never a new claim.
  const facts = content.warranty.points.map(p =>
    `<span class="contact__fact">${esc(p.label)} · ${esc(p.value)}</span>`).join('');

  $('#contactMount').innerHTML =
    `<div>
       <p class="contact__italic em-serif">${esc(c.italicLine)}</p>
       <div class="contact__direct">
         <a class="contact__primary" href="${esc(content.booking.smsHref)}" data-sms-body="${esc(content.hero.primaryCta.smsBody)}"><span class="k">${esc(content.hero.primaryCta.label)}</span><span class="num">${esc(content.booking.phone)}</span></a>
         <a href="${esc(content.booking.phoneHref)}"><span class="k">${esc(c.fallbackLabel)}</span><span class="num">${esc(content.booking.phone)}</span></a>
         <a href="mailto:${esc(content.booking.email)}"><span class="k">${esc(c.emailNote)}</span>${esc(content.booking.email)}</a>
       </div>
       <div class="contact__facts">${facts}</div>
     </div>
     <details class="contact__formwrap" data-macc open>
       <summary>${esc(c.formOpenLabel)}${CHEV}</summary>
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
     </details>`;

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
  const ctas = $$('.picker__cta, .value__cta, .voices__cta, .faq__foot, .contact__direct');
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
//    Only #story and #contact use it now. #services owns a real
//    <details> at every breakpoint (client direction: "maybe drop
//    down info"), and #voices is a rail everywhere, so the ≤640
//    DOM move of the voices cards into #work has been RETIRED —
//    a rail costs one card height on a phone, which is what the
//    merge existed to save.
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
