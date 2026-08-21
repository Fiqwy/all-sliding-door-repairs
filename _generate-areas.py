#!/usr/bin/env python3
"""Build areas/*.html — one page per region that ACTUALLY EXISTS in content.js.

    python3 _generate-areas.py            regenerate
    python3 _generate-areas.py --check    exit 1 if any page is out of date

ONE PAGE PER REAL REGION, AND NOT ONE MORE
------------------------------------------
The region list is `content.areas.regions` and nothing else. **Redlands was
deleted from it on honesty grounds** (HANDOFF, P4b): his current website does
not list it, his IG bio does not, and the only two Redlands data points are
six-year-old hipages jobs. It is a historical claim, not a present-tense
promise, so it is not in the visible copy, not in `schema.areaServed`, not in
the sitemap and there is no page for it. If Lachlan confirms it (CONFIRM 20),
restore the region in content.js and every one of those follows automatically.
Do NOT special-case it here.

NOT A DOORWAY PAGE
------------------
A doorway page is the same page six times with the town swapped. These are
not, and the difference is deliberate and structural:

  · 150-ish words of region-specific prose per page, written by the copy
    phase and used VERBATIM (`areas.regions[].page.intro`) — the Gold Coast
    page argues about sea air and sand, Logan about rentals being reported
    late, Ipswich about old Booval joinery vs new Ripley estates. Different
    arguments, not different nouns.
  · a unique <title>, meta description and <h1> per page, also verbatim from
    the copy deck.
  · three DIFFERENT hipages recommendations per page (see pick_voices).
  · every other string is REUSED from the home page's own content, so an area
    page can never claim something the home page does not.

WHAT THESE PAGES DELIBERATELY DO NOT HAVE
-----------------------------------------
  · script.js. It is index-only: it mounts #heroReel, #symptomChips,
    #workRail, the drawer and the SMS refresher by id, and none of those ids
    exist here. Loading it would throw on every page.
    Consequence: everything on an area page must work with CSS alone.
    It does — <details> is native, the .rail is native overflow, .reveal only
    engages under the .has-js class that script.js adds, and the nav has no
    burger because there is no drawer to open.
  · a contact FORM. The form composes an SMS in JS; without script.js it
    would be a form that silently does nothing. The CTAs are direct sms: and
    tel: links instead, which is the honest version of the same thing.
  · FAQPage JSON-LD. The visible questions are here because they answer real
    pre-call objections, but the FAQPage markup lives on the home page only —
    six copies of the same ten questions is noise, not structured data.
  · aggregateRating / review markup. Same rule as the home page: his 5.0 from
    61 is real, but hipages hosts those reviews, not this site.

analytics.js IS included: it is a plain script, dependency-free, and Lachlan's
dashboard should count an area-page visit the same as a home-page one.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.parse

import _seo

ROOT = _seo.ROOT
OUT_DIR = _seo.AREAS_DIR


# ============================================================
# CURATION: which three recommendations each page shows
# ============================================================
# Every suburb below was checked against its actual local government area, not
# guessed from the postcode. Only certainties are listed.
#
# ⚠️ DELIBERATE OMISSIONS
#   Cashmere (Andrea) is Moreton Bay Region, NOT City of Brisbane, so it is
#   not mapped to Brisbane even though it reads "north side" to a local.
#   Carbrook (Gloria T) is Logan City, not Redlands.
#   Tweed and Ipswich have NO written hipages recommendation at all. They are
#   not given a fake local one.
#
# Nothing on the page claims the reviewer is local to the region: the card
# prints "name · suburb" exactly as the home page does, and the reader draws
# their own conclusion from a suburb they recognise. That is why the top-up
# rule below is allowed to be pure curation.
REGION_SUBURBS = {
    "gold-coast":  {"Bundall", "Reedy Creek", "Pimpama", "Upper Coomera",
                    "Southport", "Molendinar"},          # City of Gold Coast
    # ADVERSARIAL-B1 2026-08-22: Bracken Ridge arrives with Dan M, who
    # replaced the duplicated Sarah quote in content.voices.items. It is
    # City of Brisbane (checked against the LGA, like every name here),
    # so Brisbane now has TWO genuinely local recommendations instead of
    # Chermside alone.
    "brisbane":    {"Chermside", "Bracken Ridge"},       # City of Brisbane
    # Slacks Creek left with Sarah, who now appears once, in #value on
    # the home page. Logan still has four local matches for three slots.
    "logan":       {"Browns Plains", "Jimboomba", "Carbrook"},
    "tweed-heads": set(),                                # none exist
    "ipswich":     set(),                                # none exist
}

VOICES_PER_PAGE = 3


def trim_caveat(voices, picked):
    """The shortening disclosure, COUNTED from the quotes actually placed.

    ⚠️ ADVERSARIAL-B1 2026-08-22. The home page's lede used to carry a TYPED
    count ("two are shortened with an ellipsis and nothing else") and
    `pageCommon.voicesLede` was the same sentence WITH THAT CLAUSE DELETED —
    so all five area pages printed Miya's ellipsis-trimmed quote under a lede
    that promised only "nothing is reworded". Five pages, one undisclosed
    truncation each, and the home page's own number was wrong as well.

    A typed count cannot survive a curation change. This counts the items on
    THIS page and writes the matching sentence; a page that happens to draw
    three untrimmed quotes prints no caveat at all. `script.js` carries the
    identical function (`trimCaveat`) for the home page — if you change one,
    change both, and re-run this generator.
    """
    n = sum(1 for it in picked if it.get("trimmed"))
    if not n:
        return ""
    note = voices["trimNote"]
    words = note["words"]
    word = words[n] if n < len(words) else str(n)
    tmpl = note["one"] if n == 1 else note["many"]
    return " " + tmpl.replace("{N}", word)


def pick_voices(voices, slug, region_index, used):
    """Three cards per page: local matches first, then the freshest, then the best.

    Twelve recommendations have to cover five pages of three, so some reuse is
    arithmetic, not a choice. The rule, in order:

      1. any recommendation whose suburb is a CONFIRMED match for this region
         (see REGION_SUBURBS) — Gold Coast and Logan fill all three this way;
      2. top up from the ones no earlier page has used yet, walked from an
         offset of `region_index` so the pages do not all start at the same
         card;
      3. if everything has been used, top up from the TOP of
         `content.voices.items`, which the copy phase left in strength order:
         the seven-security-door roller job and the quoted-and-fixed job are
         items 0 and 1 and they are the two quotes the whole argument rests
         on. (Item 1 was Sarah until 2026-08-22; she now appears once, in
         #value on the home page, and this slot is Dan M. See
         ADVERSARIAL-B1 in content.js.)

    Deterministic, and it puts 11 of the 12 on the site with no two pages
    carrying the same trio. `used` is threaded through by the caller.
    """
    picked = [i for i, v in enumerate(voices)
              if v["suburb"] in REGION_SUBURBS.get(slug, set())][:VOICES_PER_PAGE]

    def topup(pool, rotate):
        n = len(pool)
        for k in range(n):
            if len(picked) == VOICES_PER_PAGE:
                return
            c = pool[(region_index + k) % n] if rotate else pool[k]
            if c not in picked:
                picked.append(c)

    topup([i for i in range(len(voices)) if i not in used], rotate=True)
    topup(list(range(len(voices))), rotate=False)
    used.update(picked)
    return [voices[i] for i in picked]


# The five questions that get asked before someone rings a one-man trade.
# Indices into content.faq — kept as indices, not copies, so the answers can
# never drift from the home page.
FAQ_INDEXES = [0, 1, 2, 5, 7]


# ============================================================
# helpers
# ============================================================
def esc(s):
    """Same escaping script.js uses, so generated and rendered markup match."""
    return (str("" if s is None else s)
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


def sms_href(booking, details):
    """buildSmsHref() from script.js, in Python.

    ⚠️ THE FILL-IN BLANKS GO LAST. ALWAYS. They are the words the visitor
    types over ("My name: , Suburb: , Door type: "). Anything appended after
    them lands inside the visitor's own half-typed answer and quietly breaks
    every CTA on the page. There is a test for this in the verification pass.
    """
    body = "%s %s" % (str(details).strip(), booking["fillIns"])
    # encodeURIComponent's unreserved set, exactly.
    return "%s?&body=%s" % (booking["smsHref"],
                            urllib.parse.quote(body, safe="-_.!~*'()"))


def mark_svg():
    """The nav glyph, lifted from assets/logo/mark.svg.

    index.html inlines the same four paths (LOGO.md §7) because
    fill="currentColor" only inherits when the SVG is in the DOM — referenced
    through <img src> it renders black. Reading the file means these pages can
    never show a retired drawing.
    """
    import re
    src = open(os.path.join(ROOT, "assets", "logo", "mark.svg")).read()
    paths = re.findall(r"<path\b[^>]*/>", src)
    if len(paths) != 4:
        raise SystemExit("mark.svg has %d paths, expected 4" % len(paths))
    return "".join(paths)


def drawn_door_svg():
    """The hairline sliding-door diagram, lifted out of script.js.

    It is the same drawing the "Glass Sliding Windows" service card uses (the
    category with zero photographs anywhere). Reading it out of script.js
    rather than pasting a copy means the two can never diverge — and a second
    hand-maintained copy of a technical drawing is exactly the kind of thing
    that silently rots.
    """
    import re
    src = open(os.path.join(ROOT, "script.js")).read()
    m = re.search(r"const SVC_DRAWN = `(.*?)`;", src, re.S)
    if not m:
        raise SystemExit("could not find SVC_DRAWN in script.js")
    svg = m.group(1).strip()
    return svg.replace('class="svc__drawn"', 'class="ap-hero__drawn"', 1)


CHEV = ('<svg class="area__chev" viewBox="0 0 12 12" fill="none" '
        'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
        'stroke-linejoin="round" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>')

SMS_ICON = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" '
            'aria-hidden="true"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.2-2h6.6L16.5 6h2A2.5 '
            '2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>'
            '<circle cx="12" cy="12.5" r="3.4"/></svg>')

TEL_ICON = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" '
            'aria-hidden="true"><path d="M5 3.5h3.2l1.6 4-2 1.4a12.5 12.5 0 0 0 5.8 '
            '5.8l1.4-2 4 1.6V19a1.5 1.5 0 0 1-1.6 1.5C9.4 20 3.9 14.5 3.5 5.1A1.5 '
            '1.5 0 0 1 5 3.5z"/></svg>')

FAQ_CHEV = ('<svg class="faq__chev" viewBox="0 0 12 12" fill="none" '
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>')


# ============================================================
# JSON-LD
# ============================================================
PRICED_WORK_WORDS = ("roller", "track")


def priced(item):
    """Mirror of script.js PRICED_WORK.

    A Service carries the "FROM $150 +GST" figure if and only if its own
    detail list contains a roller or track repair, because that is what the
    flyer the price comes from is advertising. Mesh replacement and Petways
    installation are supply-and-install jobs nobody has quoted $150 for, so
    they carry no offer at all. CONFIRM 9.
    """
    return any(any(w in x["name"].lower() for w in PRICED_WORK_WORDS)
               for x in item["items"])


def page_graph(c, region):
    site = c["brand"]["siteUrl"]
    biz_id = site + "#business"
    url = _seo.area_url(region["slug"])
    price = c["value"]["priceFrom"]
    area = {"@type": "AdministrativeArea", "name": region["name"]}

    crumbs = {
        "@type": "BreadcrumbList",
        "@id": url + "#breadcrumb",
        "itemListElement": [
            {"@type": "ListItem", "position": 1,
             "name": c["seo"]["breadcrumbHome"], "item": site},
            {"@type": "ListItem", "position": 2,
             "name": c["seo"]["breadcrumbAreas"], "item": site + "#areas"},
            {"@type": "ListItem", "position": 3, "name": region["name"]},
        ],
    }

    # The provider, so every Service's `provider` reference resolves and the
    # page carries his NAP. Same @id as the home page: one entity, described
    # consistently, which is exactly what @id is for.
    biz = {"@id": biz_id}
    biz.update({k: v for k, v in c["schema"].items() if k != "@context"})

    services = []
    for it in c["services"]["items"]:
        node = {
            "@type": "Service",
            "@id": url + "#service-" + it["id"],
            "name": it["name"],
            "serviceType": it["name"],
            "description": it["blurb"],
            "provider": {"@id": biz_id},
            "areaServed": area,
        }
        if priced(it):
            node["offers"] = {
                "@type": "Offer",
                "priceCurrency": price["currency"],
                "priceSpecification": {
                    "@type": "PriceSpecification",
                    "priceCurrency": price["currency"],
                    "minPrice": price["amount"],
                    "valueAddedTaxIncluded": not price["gst"],
                },
            }
        services.append(node)

    return {"@context": "https://schema.org",
            "@graph": [crumbs, biz] + services}


# ============================================================
# the page
# ============================================================
def build_page(c, region, region_index, used):
    b, book = c["brand"], c["booking"]
    hero, pg = c["hero"], region["page"]
    common = c["areas"]["pageCommon"]
    name = region["name"]

    nav_links = "".join(
        '<a href="../index.html%s">%s</a>' % (esc(l["href"]), esc(l["label"]))
        for l in c["nav"])

    spec = "".join(
        '<div class="spec__i"><span class="spec__k mono">%s</span>'
        '<span class="spec__v">%s</span></div>' % (esc(s["key"]), esc(s["value"]))
        for s in hero["spec"])

    trust = "".join('<span class="trust__i">%s</span>' % esc(t) for t in c["trust"])

    intro = "".join(
        '<p class="%s">%s</p>' % ("lede" if i == 0 else "ap-p", esc(p))
        for i, p in enumerate(pg["intro"]))

    svc_cards = "".join(
        '''<article class="ap-svc">
          <h3 class="ap-svc__name">%s</h3>
          <p class="ap-svc__blurb">%s</p>
          <a class="ap-svc__go mono-label" href="../index.html#svc-%s">%s%s</a>
        </article>''' % (esc(it["name"]), esc(it["blurb"]), esc(it["id"]),
                         esc(c["services"]["detailsLabel"]), CHEV)
        for it in c["services"]["items"])

    v = c["voices"]
    # ⚠️ pick_voices MUTATES `used`, so it must be called exactly once per
    # page. The result is held here because the lede's shortening caveat is
    # counted from these three quotes (ADVERSARIAL-B1).
    picked_voices = pick_voices(v["items"], region["slug"], region_index, used)
    voice_cards = "".join(
        '''<figure class="voice">
          <span class="voice__cat mono-label">%s</span>
          <blockquote class="voice__quote">%s</blockquote>
          <figcaption class="voice__foot">
            <span class="voice__handle">%s &middot; %s</span>
            <span class="voice__src">%s &middot; %s</span>
          </figcaption>
        </figure>''' % (esc(it["category"]), esc(it["quote"]), esc(it["name"]),
                        esc(it["suburb"]), esc(it["date"]), esc(v["sourceLabel"]))
        for it in picked_voices)
    voices_lede_text = common["voicesLede"] + trim_caveat(v, picked_voices)

    faqs = "".join(
        '''<details class="faq__item">
          <summary class="faq__q">%s%s</summary>
          <div class="faq__inner"><div><p class="faq__a">%s</p></div></div>
        </details>''' % (esc(c["faq"][i]["q"]), FAQ_CHEV, esc(c["faq"][i]["a"]))
        for i in FAQ_INDEXES)

    # Sibling regions: the current one is a plain <span> with aria-current, not
    # a link to itself.
    area_rows = "".join(
        ('<span class="area area--here" aria-current="page">'
         '<span class="area__name">%s</span>'
         '<span class="area__go mono">You are here</span></span>'
         if r["slug"] == region["slug"] else
         '<a class="area" href="%s.html">'
         '<span class="area__name">%s</span>'
         '<span class="area__go mono">Covered%s</span></a>')
        % ((esc(r["name"]),) if r["slug"] == region["slug"]
           else (esc(r["slug"]), esc(r["name"]), CHEV))
        for r in c["areas"]["regions"])

    footer_services = "".join(
        '<li><a href="../index.html#svc-%s">%s</a></li>' % (esc(s["id"]), esc(s["name"]))
        for s in c["services"]["items"])
    footer_areas = "".join(
        '<li><a href="%s.html"%s>%s</a></li>'
        % (esc(r["slug"]),
           ' aria-current="page"' if r["slug"] == region["slug"] else "",
           esc(r["name"]))
        for r in c["areas"]["regions"])
    social = ('<li><a href="%s" rel="noopener" target="_blank">%s</a></li>'
              % (esc(b["socials"]["instagram"]), esc(c["footer"]["directLabels"]["instagram"]))
              if b["socials"]["instagram"] else "")
    abn = '<span>ABN %s</span>' % esc(b["abn"]) if b.get("abn") else ""

    primary_sms = sms_href(book, hero["primaryCta"]["smsBody"])
    contact_sms = sms_href(book, c["value"]["ctaSmsBody"])

    graph = json.dumps(page_graph(c, region), ensure_ascii=False,
                       indent=2, separators=(",", ": "))

    return """<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <!-- Matches --ink: an area page opens on the dark band, like the home page. -->
  <meta name="theme-color" content="#0F2132">

  {seo}

  <link rel="icon" href="../assets/logo/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="../assets/logo/favicon.svg">

  <!-- Archivo only: it sets the H1, which is the LCP element here as it is
       on the home page. There is no hero video and no poster to preload. -->
  <link rel="preload" href="../assets/fonts/Archivo-500-800.woff2" as="font" type="font/woff2" crossorigin>

  <link rel="stylesheet" href="../styles.css">

  <!-- GENERATED by _generate-areas.py from content.js. BreadcrumbList +
       the business + one Service per category, scoped to this region.
       NO FAQPage (home page only), NO aggregateRating, NO review. -->
  <script type="application/ld+json">
{graph}
  </script>
</head>
<body class="type-base ap">

<a class="skip" href="#main">Skip to content</a>

<!-- The nav is SOLID here, not overlaid: there is no reel behind it to sit
     on. No burger and no drawer, because the drawer is script.js's and
     script.js is index-only. The phone pill is painted on frame one, which
     is the same sales requirement it is on the home page. -->
<header class="nav nav--solid">
  <div class="wrap nav__in">
    <a class="brand" href="../index.html" aria-label="All Sliding Door Repairs, home">
      <svg class="brand__glyph" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" focusable="false">{mark}</svg>
      <span class="brand__words">
        <span class="brand__n1">All Sliding Door</span>
        <span class="brand__n2">Repairs</span>
      </span>
    </a>

    <nav class="nav__links nav__links--static" aria-label="Primary">{nav_links}</nav>

    <a class="nav__call" href="{phone_href}">
      <span class="dot" aria-hidden="true"></span>
      <span class="num">{phone}</span>
    </a>
  </div>
</header>

<main id="main">

  <nav class="ap-crumbs" aria-label="Breadcrumb">
    <div class="wrap">
      <ol class="mono-label">
        <li><a href="../index.html">{crumb_home}</a></li>
        <li><a href="../index.html#areas">{crumb_areas}</a></li>
        <li><span aria-current="page">{name}</span></li>
      </ol>
    </div>
  </nav>

  <section class="band--ink ap-hero" aria-labelledby="apH1">
    <div class="wrap ap-hero__in">
      <div class="ap-hero__type">
        <p class="eyebrow mono-label">{areas_eyebrow} &middot; {name}</p>
        <h1 id="apH1">{h1}</h1>

        <div class="ap-intro">
{intro}
        </div>

        <div class="spec">{spec}</div>

        <div class="cta">
          <a class="btn btn--primary" href="{primary_sms}">{sms_icon}<span>{primary_label}</span></a>
          <a class="btn btn--ghost" href="{phone_href}">{tel_icon}<span>{secondary_label} <span class="num">{phone}</span></span></a>
        </div>

        <p class="note">{note}</p>
      </div>

      <!-- The same hairline diagram the type-only service card uses, at
           size. It is plainly a DRAWING and claims nothing about any job —
           which is the whole point: there is no honest photograph of a
           Gold Coast doorway as opposed to a Logan one, so the hero does
           not pretend to have one. Desktop only. -->
      <figure class="ap-hero__fig" aria-hidden="true">
        {drawn}
      </figure>
    </div>
  </section>

  <!-- A11Y-H2: below 760 the seam is a horizontal scroller whose last
       facts WebKit cannot reach without a tab stop. Same treatment as
       the home page. -->
  <div class="trust">
    <div class="wrap trust__in" tabindex="0" role="region"
         aria-label="What he brings to the job">{trust}</div>
  </div>

  <section class="band--white sec" id="services" aria-labelledby="apServices">
    <div class="wrap">
      <header class="sec__head">
        <span class="eyebrow mono-label">{svc_eyebrow}</span>
        <h2 id="apServices">{svc_heading}</h2>
        <div class="track-rule" aria-hidden="true"></div>
        <p class="lede">{svc_lede}</p>
      </header>
      <div class="ap-grid">{svc_cards}</div>
    </div>
  </section>

  <section class="band--ink sec" id="value" aria-labelledby="apValue">
    <div class="wrap ap-value">
      <div>
        <header class="sec__head sec__head--on-ink">
          <span class="eyebrow mono-label">{value_eyebrow}</span>
          <h2 id="apValue">{value_heading} <span class="em">{value_heading_em}</span></h2>
          <div class="track-rule" aria-hidden="true"></div>
          <p class="lede">{value_body}</p>
        </header>
        <div class="cta">
          <a class="btn btn--primary" href="{contact_sms}">{sms_icon}<span>{value_cta}</span></a>
        </div>
      </div>
      <!-- A11Y-A5: this was an <aside>, i.e. an UNNAMED `complementary`
           landmark in every screen reader's landmark list. It is a price
           card, not a landmark. A <div> carries the same styling and
           adds nothing to navigate past. -->
      <div class="value__price-card">
        <span class="value__from mono-label">{price_label}</span>
        <span class="value__figure figure-mega"><span class="cur">$</span>{price_amount}</span>
        <span class="value__gst mono">+GST</span>
        <div class="value__rule"></div>
        <p class="value__note">{warranty_heading}</p>
      </div>
    </div>
  </section>

  <section class="band--white sec" id="voices" aria-labelledby="apVoices">
    <div class="wrap">
      <header class="sec__head sec__head--centre">
        <span class="eyebrow mono-label">{voices_eyebrow}</span>
        <h2 id="apVoices">{voices_heading}</h2>
        <div class="track-rule" aria-hidden="true"></div>
        <p class="lede">{voices_lede}</p>
      </header>
      <div class="ap-voices">{voice_cards}</div>
      <p class="voices__foot">
        <a class="voices__link" href="{profile_url}" rel="nofollow noopener" target="_blank">{profile_label}</a>
      </p>
    </div>
  </section>

  <section class="band--bone-2 sec" id="faq" aria-labelledby="apFaq">
    <div class="wrap wrap--narrow">
      <header class="sec__head sec__head--centre">
        <span class="eyebrow mono-label">{faq_eyebrow}</span>
        <h2 id="apFaq">{faq_heading}</h2>
        <div class="track-rule" aria-hidden="true"></div>
      </header>
      <div class="faq__list">{faqs}</div>
    </div>
  </section>

  <section class="band--ink sec" id="contact" aria-labelledby="apContact">
    <div class="wrap ap-contact">
      <div>
        <header class="sec__head sec__head--on-ink">
          <span class="eyebrow mono-label">{contact_eyebrow}</span>
          <h2 id="apContact">{contact_heading}</h2>
          <div class="track-rule" aria-hidden="true"></div>
        </header>
        <p class="contact__italic em-serif">{contact_italic}</p>
        <div class="cta">
          <a class="btn btn--primary" href="{primary_sms}">{sms_icon}<span>{primary_label}</span></a>
          <a class="btn btn--ghost" href="{phone_href}">{tel_icon}<span>{secondary_label} <span class="num">{phone}</span></span></a>
        </div>
        <div class="contact__direct">
          <a href="{phone_href}"><span class="k">{direct_phone}</span><span class="num">{phone}</span></a>
          <a href="mailto:{email}"><span class="k">{direct_email}</span>{email}</a>
        </div>
      </div>
      <div class="ap-areas">
        <h3 class="ap-areas__h mono-label">{areas_col}</h3>
        <div class="areas__card">{area_rows}</div>
      </div>
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap footer__in">
    <div class="footer__col footer__col--blurb">
      <p class="footer__blurb">{footer_blurb}</p>
    </div>
    <div class="footer__col">
      <h3>{col_repairs}</h3>
      <ul>{footer_services}</ul>
    </div>
    <div class="footer__col footer__col--areas">
      <h3>{col_areas}</h3>
      <p class="footer__intro">{areas_lede}</p>
      <ul>{footer_areas}</ul>
    </div>
    <div class="footer__col">
      <h3>{col_direct}</h3>
      <ul>
        <li><a href="{phone_href}"><span class="num">{phone}</span></a></li>
        <li><a href="mailto:{email}">{email}</a></li>
        {social}
      </ul>
    </div>
    <div class="footer__callrow">
      <a class="btn btn--primary footer__call" href="{phone_href}">{secondary_label} <span class="num">{phone}</span></a>
    </div>
    <div class="footer__bottom">
      <span>&copy; {year} {brand_name}</span>
      {abn}
      <a href="{built_href}" rel="noopener" target="_blank">{built_label}</a>
    </div>
  </div>
</footer>

<script defer src="../analytics.js"></script>
</body>
</html>
""".format(
        seo=_seo.area_head_block(c, region),
        graph=graph,
        mark=mark_svg(),
        nav_links=nav_links,
        phone=esc(book["phone"]), phone_href=esc(book["phoneHref"]),
        email=esc(book["email"]),
        crumb_home=esc(c["seo"]["breadcrumbHome"]),
        crumb_areas=esc(c["seo"]["breadcrumbAreas"]),
        name=esc(name), h1=esc(pg["h1"]),
        areas_eyebrow=esc(c["areas"]["eyebrow"]),
        drawn=drawn_door_svg(),
        intro=intro, spec=spec, trust=trust,
        primary_sms=esc(primary_sms), contact_sms=esc(contact_sms),
        primary_label=esc(hero["primaryCta"]["label"]),
        secondary_label=esc(hero["secondaryCtaLabel"]),
        note=esc(hero["note"]),
        sms_icon=SMS_ICON, tel_icon=TEL_ICON,
        svc_eyebrow=esc(c["services"]["eyebrow"]),
        svc_heading=esc(c["services"]["heading"]),
        svc_lede=esc(c["services"]["lede"]),
        svc_cards=svc_cards,
        value_eyebrow=esc(c["value"]["eyebrow"]),
        value_heading=esc(c["value"]["heading"]),
        value_heading_em=esc(c["value"]["headingEm"]),
        value_body=esc(c["value"]["body"]),
        value_cta=esc(c["value"]["ctaLabel"]),
        price_label=esc(c["value"]["priceFrom"]["label"]),
        price_amount=c["value"]["priceFrom"]["amount"],
        warranty_heading=esc(c["warranty"]["italicLine"]),
        voices_eyebrow=esc(v["eyebrow"]),
        voices_heading=esc(common["voicesHeading"]),
        voices_lede=esc(voices_lede_text),   # ADVERSARIAL-B1: base sentence + COUNTED shortening caveat
        voice_cards=voice_cards,
        profile_url=esc(v["profileUrl"]), profile_label=esc(v["profileLinkLabel"]),
        faq_eyebrow=esc(c["faqIntro"]["eyebrow"]),
        faq_heading=esc(c["faqIntro"]["heading"]),
        faqs=faqs,
        contact_eyebrow=esc(c["contact"]["eyebrow"]),
        contact_heading=esc(c["contact"]["heading"]),
        contact_italic=esc(c["contact"]["italicLine"]),
        direct_phone=esc(c["footer"]["directLabels"]["phone"]),
        direct_email=esc(c["footer"]["directLabels"]["email"]),
        areas_col=esc(c["footer"]["columns"]["areas"]),
        area_rows=area_rows,
        footer_blurb=esc(c["footer"]["blurb"]),
        col_repairs=esc(c["footer"]["columns"]["repairs"]),
        col_areas=esc(c["footer"]["columns"]["areas"]),
        col_direct=esc(c["footer"]["columns"]["direct"]),
        areas_lede=esc(c["areas"]["lede"]),
        footer_services=footer_services, footer_areas=footer_areas,
        social=social, abn=abn,
        year=YEAR, brand_name=esc(b["name"]),
        built_href=esc(c["footer"]["builtBy"]["href"]),
        built_label=esc(c["footer"]["builtBy"]["label"]),
    )


# The home page prints `new Date().getFullYear()`. Pinning the generated pages
# to the same source of truth is impossible without JS, so the year is baked —
# re-running this in January is what updates it, and _seo.py --check will not
# catch that. It is in CLAUDE.md's deploy notes for exactly that reason.
YEAR = __import__("datetime").date.today().year


def main(check=False):
    c = _seo.load_content()
    os.makedirs(OUT_DIR, exist_ok=True)
    slugs = [r["slug"] for r in c["areas"]["regions"]]
    dirty = False
    used = set()          # threaded through pick_voices — see its docstring

    for i, region in enumerate(c["areas"]["regions"]):
        path = os.path.join(OUT_DIR, region["slug"] + ".html")
        html = build_page(c, region, i, used)
        cur = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        rel = os.path.relpath(path, ROOT)
        if check:
            print("  %-9s  %s" % ("STALE" if cur != html else "ok", rel))
            dirty |= cur != html
        else:
            if cur == html:
                print("  unchanged  %s" % rel)
            else:
                open(path, "w", encoding="utf-8").write(html)
                print("  %-9s  %s" % ("WROTE" if cur is None else "updated", rel))
                dirty = True

    # A page for a region that no longer exists is a live claim nobody
    # reviewed. Say so loudly rather than leaving it on disk.
    for name in sorted(os.listdir(OUT_DIR)):
        if name.endswith(".html") and name[:-5] not in slugs:
            print("  ORPHAN     areas/%s — no such region in content.js. DELETE IT." % name)
            dirty = True

    print()
    print("  %d region page(s): %s" % (len(slugs), ", ".join(slugs)))
    print("  now run `python3 _seo.py` so the sitemap and the heads agree.")
    return dirty


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true",
                    help="do not write; exit 1 if any page is out of date")
    a = ap.parse_args()
    if main(check=a.check) and a.check:
        sys.exit(1)
