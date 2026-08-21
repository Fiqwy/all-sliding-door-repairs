#!/usr/bin/env python3
"""ALL SLIDING DOOR REPAIRS — the SEO layer, in one file.

    python3 _seo.py            regenerate everything
    python3 _seo.py --check    exit 1 if anything is out of date (CI / pre-deploy)
    python3 _seo.py --touch    also bump every <lastmod> in sitemap.xml to today

TWO CONSTANTS OWN THE WHOLE LAYER
---------------------------------
    SITE_URL   the host this build is deployed to
    INDEXABLE  whether search engines may index it

Change one of them, run this, and the canonical, every og:url, the robots
meta on all six pages, robots.txt, sitemap.xml and the absolute URLs inside
the JSON-LD all move together. Nothing else in the repo hard-codes the host.
That single-switch property is the entire reason this file exists: the cutover
from the GitHub Pages preview to allslidingdoorrepairs.com.au must not be six
separate find-and-replaces done by hand at 11pm.

WHAT IT REWRITES, AND HOW IT AVOIDS BREAKING ANYTHING ELSE
----------------------------------------------------------
It is SURGICAL. It never regenerates a whole hand-built file. Every target
carries a pair of marker comments and only the text BETWEEN them is replaced;
every other byte in the file is preserved exactly.

    index.html        <!-- seo:start --> ... <!-- seo:end -->   in <head>
    areas/*.html      <!-- seo:start --> ... <!-- seo:end -->   in <head>
    content.js        // seo:start      ... // seo:end          (x2)
    sitemap.xml       whole file (generated; no hand content)
    robots.txt        whole file (generated; no hand content)

index.html's <head> has been rewritten across several design passes and holds
things that MUST NOT MOVE: the Archivo font preload (one preload only — a
second competes with the LCP H1), the hero poster preload with
fetchpriority=high (the poster IS the LCP element by construction), and
theme-color #0F2132 (the first thing on screen is the dark hero, not the cream
page). None of them are inside the markers, so none of them can be touched.

Running twice in a row is a guaranteed zero-diff: files are only written when
their bytes actually change, and every generated string is a pure function of
SITE_URL, INDEXABLE and content.js.

WHERE THE COPY COMES FROM
-------------------------
content.js is the single source of truth and this file never writes copy. It
reads the real module through node (`node --input-type=module`), so the
deep-merge with content.client.js is applied exactly as the browser applies it
and there is no second, drifting parser. Home strings come from
`content.seo.*`; each area page's strings come from
`content.areas.regions[i].page.*`.

⚠️ ROBOTS.TXT ON THE PREVIEW HOST IS NOT PROTECTION
GitHub Pages serves a project site at fiqwy.github.io/all-sliding-door-repairs/,
and crawlers only read robots.txt from the DOMAIN root — fiqwy.github.io/robots.txt
— which this repo does not control. The robots.txt written here is correct and
will start working the moment the site moves to its own domain, but while
INDEXABLE is False the thing actually keeping the preview out of the index is
the `noindex, nofollow` META on all six pages. Do not remove one thinking the
other covers it.
"""
import argparse
import datetime
import html
import json
import os
import re
import subprocess
import sys

# ============================================================
# THE TWO CONSTANTS
# ============================================================

SITE_URL = "https://fiqwy.github.io/all-sliding-door-repairs"

# False  -> noindex,nofollow on every page + Disallow: / in robots.txt.
#           Correct while the build lives on the preview host: an indexed
#           preview competes with allslidingdoorrepairs.com.au for Lachlan's
#           own brand name, which costs him money.
# True   -> index,follow + Allow: /. Flip this in the SAME commit as the
#           domain cutover, never before.
INDEXABLE = False

# ============================================================

ROOT = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(ROOT, "index.html")
CONTENT = os.path.join(ROOT, "content.js")
AREAS_DIR = os.path.join(ROOT, "areas")
SITEMAP = os.path.join(ROOT, "sitemap.xml")
ROBOTS = os.path.join(ROOT, "robots.txt")

OG_IMAGE_PATH = "assets/og/og-image.jpg"
OG_IMAGE_W, OG_IMAGE_H = 1200, 630
LOGO_PATH = "assets/logo/lockup-stacked.svg"

BASE = SITE_URL.rstrip("/")
HOME = BASE + "/"

ROBOTS_INDEXABLE = ("index, follow, max-image-preview:large, "
                    "max-snippet:-1, max-video-preview:-1")
ROBOTS_BLOCKED = "noindex, nofollow"


# ------------------------------------------------------------------ helpers
def abs_url(path):
    """Absolute URL for a repo-relative path. '' -> the home page."""
    return HOME + path.lstrip("/")


def attr(s):
    """Escape a string for an HTML double-quoted attribute.

    quote=True also escapes ' as &#x27;, which is noise inside a
    double-quoted attribute, so apostrophes are put back verbatim. The site's
    copy is full of them and they must read as the copy deck wrote them.
    """
    return html.escape(str(s), quote=True).replace("&#x27;", "'")


def load_content():
    """Read content.js the way the browser reads it: through the real module."""
    script = (
        "const m = await import('./content.js');"
        "process.stdout.write(JSON.stringify(m.content));"
    )
    out = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit("could not import content.js through node:\n" + out.stderr)
    return json.loads(out.stdout)


def write_if_changed(path, text, log):
    old = None
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            old = f.read()
    rel = os.path.relpath(path, ROOT)
    if old == text:
        log.append(("unchanged", rel))
        return False
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    log.append(("WROTE" if old is None else "updated", rel))
    return True


MARKERS = {
    ".html": ("<!-- seo:start -->", "<!-- seo:end -->"),
    ".js": ("// seo:start", "// seo:end"),
}


def replace_marked(src, blocks, kind, path):
    """Replace the Nth marked region with blocks[N]. Everything else survives.

    Deliberately strict: a missing marker, a stray marker or the wrong number
    of regions is a hard error rather than a silent partial write. A half-
    rewritten <head> is worse than a failed build.
    """
    start, end = MARKERS[kind]
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    found = pattern.findall(src)
    if len(found) != len(blocks):
        raise SystemExit(
            "%s: found %d seo:start/seo:end region(s), expected %d. "
            "Restore the markers before running this."
            % (os.path.relpath(path, ROOT), len(found), len(blocks)))
    it = iter(blocks)
    return pattern.sub(lambda _m: next(it).replace("\\", "\\\\"), src)


# ------------------------------------------------------------------ <head>
def head_block(*, title, description, canonical, og_title, og_description,
               og_image_alt, tw_title, tw_description, indent="  "):
    """The one and only <head> SEO block builder.

    _generate-areas.py imports this so the area pages and the home page can
    never drift apart in shape, only in strings.
    """
    robots = ROBOTS_INDEXABLE if INDEXABLE else ROBOTS_BLOCKED
    robots_note = (
        "INDEXABLE = True: this build is on its own domain and may be indexed."
        if INDEXABLE else
        "INDEXABLE = False: the site is on the preview host, so it must never\n"
        "%s     compete with allslidingdoorrepairs.com.au for Lachlan's own brand." % indent
    )
    og_img = abs_url(OG_IMAGE_PATH)

    lines = [
        MARKERS[".html"][0],
        "<!-- ⚠️ GENERATED. Everything between seo:start and seo:end is written by",
        "     `python3 _seo.py`. Do not hand-edit it: the next run overwrites it.",
        "     Copy lives in content.js; the host lives in _seo.py → SITE_URL;",
        "     the robots line follows _seo.py → INDEXABLE. -->",
        "<title>%s</title>" % attr(title),
        '<meta name="description" content="%s">' % attr(description),
        '<link rel="canonical" href="%s">' % attr(canonical),
        "",
        "<!-- %s -->" % robots_note,
        '<meta name="robots" content="%s">' % robots,
        "",
        '<meta property="og:site_name" content="All Sliding Door Repairs">',
        '<meta property="og:title" content="%s">' % attr(og_title),
        '<meta property="og:description" content="%s">' % attr(og_description),
        '<meta property="og:type" content="website">',
        '<meta property="og:locale" content="en_AU">',
        '<meta property="og:url" content="%s">' % attr(canonical),
        '<meta property="og:image" content="%s">' % attr(og_img),
        '<meta property="og:image:width" content="%d">' % OG_IMAGE_W,
        '<meta property="og:image:height" content="%d">' % OG_IMAGE_H,
        '<meta property="og:image:alt" content="%s">' % attr(og_image_alt),
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="%s">' % attr(tw_title),
        '<meta name="twitter:description" content="%s">' % attr(tw_description),
        '<meta name="twitter:image" content="%s">' % attr(og_img),
        '<meta name="twitter:image:alt" content="%s">' % attr(og_image_alt),
        MARKERS[".html"][1],
    ]
    # Indent every line EXCEPT the blank separators — an indented blank line is
    # trailing whitespace, and trailing whitespace in a generated block turns
    # every future `git diff` of this file into noise.
    return "\n".join((indent + ln) if ln else "" for ln in lines).lstrip()


def index_head_block(c):
    s = c["seo"]
    return head_block(
        title=s["title"],
        description=s["description"],
        canonical=HOME,
        og_title=s["ogTitle"],
        og_description=s["ogDescription"],
        og_image_alt=s["ogImageAlt"],
        tw_title=s["twitterTitle"],
        tw_description=s["twitterDescription"],
    )


def area_head_block(c, region):
    """An area page's <head> block. Its own title/description, the shared card.

    The OG card is deliberately shared: it carries the brand, the phone number
    and the five regions, so it is true of every page. A per-region card would
    be six near-identical images and six more things to keep in sync.
    """
    p = region["page"]
    s = c["seo"]
    return head_block(
        title=p["title"],
        description=p["description"],
        canonical=area_url(region["slug"]),
        og_title=p["title"],
        og_description=p["description"],
        og_image_alt=s["ogImageAlt"],
        tw_title=p["title"],
        tw_description=p["description"],
    )


def area_url(slug):
    return abs_url("areas/%s.html" % slug)


# ------------------------------------------------------------------ content.js
def content_blocks():
    """The two marked regions in content.js, in file order."""
    site_url_block = "\n".join([
        MARKERS[".js"][0] + " — GENERATED by `python3 _seo.py` from SITE_URL. Hand edits",
        "    // here are overwritten on the next run; change SITE_URL instead.",
        '    siteUrl: "%s",' % HOME,
        "    " + MARKERS[".js"][1],
    ])
    schema_block = "\n".join([
        MARKERS[".js"][0] + " — GENERATED by `python3 _seo.py` from SITE_URL. These are the",
        "    // only absolute URLs in the structured data; everything else is relative",
        "    // and resolves against the page. Hand edits are overwritten.",
        '    url: "%s",' % HOME,
        '    image: "%s",' % abs_url(OG_IMAGE_PATH),
        '    logo: "%s",' % abs_url(LOGO_PATH),
        "    " + MARKERS[".js"][1],
    ])
    return [site_url_block, schema_block]


# ------------------------------------------------------------------ sitemap
def sitemap_urls(c):
    """Exactly the pages that exist. Home first, then one row per REAL region.

    `areas.regions` is the only source. Redlands was deleted from it on
    honesty grounds (HANDOFF P4b) and must not reappear here: a sitemap that
    lists a service area the visible copy will not claim is the same lie in a
    machine-readable file.
    """
    rows = [(HOME, "weekly", "1.0")]
    for r in c["areas"]["regions"]:
        rows.append((area_url(r["slug"]), "monthly", "0.7"))
    return rows


def build_sitemap(c, touch):
    today = datetime.date.today().isoformat()
    existing = {}
    if os.path.exists(SITEMAP) and not touch:
        src = open(SITEMAP, encoding="utf-8").read()
        for loc, mod in re.findall(r"<loc>(.*?)</loc>\s*<lastmod>(.*?)</lastmod>", src, re.S):
            existing[loc.strip()] = mod.strip()

    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           "<!-- GENERATED by _seo.py. Do not hand-edit. -->",
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, freq, prio in sitemap_urls(c):
        out += ["  <url>",
                "    <loc>%s</loc>" % loc,
                "    <lastmod>%s</lastmod>" % existing.get(loc, today),
                "    <changefreq>%s</changefreq>" % freq,
                "    <priority>%s</priority>" % prio,
                "  </url>"]
    out.append("</urlset>")
    return "\n".join(out) + "\n"


# ------------------------------------------------------------------ robots
def build_robots():
    sitemap_line = "Sitemap: %s" % abs_url("sitemap.xml")
    if INDEXABLE:
        return "\n".join([
            "# All Sliding Door Repairs — generated by _seo.py. Do not hand-edit.",
            "# INDEXABLE = True.",
            "",
            "User-agent: *",
            "Allow: /",
            "",
            sitemap_line,
        ]) + "\n"
    return "\n".join([
        "# All Sliding Door Repairs — generated by _seo.py. Do not hand-edit.",
        "#",
        "# INDEXABLE = False. This build is on the GitHub Pages preview host and",
        "# must not be indexed: an indexed preview competes with",
        "# allslidingdoorrepairs.com.au for Lachlan's own brand name.",
        "#",
        "# ⚠️ On a PROJECT page (fiqwy.github.io/all-sliding-door-repairs/) crawlers",
        "# read robots.txt from the DOMAIN root, not from this path, so this file is",
        "# advisory until the site moves to its own domain. What is actually holding",
        "# the preview out of the index is the noindex META on all six pages. Flip",
        "# INDEXABLE in _seo.py at cutover and both change together.",
        "",
        "User-agent: *",
        "Disallow: /",
        "",
        sitemap_line,
    ]) + "\n"


# ------------------------------------------------------------------ run
def run(check=False, touch=False):
    c = load_content()
    log = []
    changed = False

    # ---- index.html
    src = open(INDEX, encoding="utf-8").read()
    new = replace_marked(src, [index_head_block(c)], ".html", INDEX)
    changed |= write_if_changed(INDEX, new, log) if not check else (new != src)
    if check and new != src:
        log.append(("STALE", "index.html"))
    elif check:
        log.append(("ok", "index.html"))

    # ---- content.js
    src = open(CONTENT, encoding="utf-8").read()
    new = replace_marked(src, content_blocks(), ".js", CONTENT)
    if check:
        log.append((("STALE" if new != src else "ok"), "content.js"))
        changed |= new != src
    else:
        changed |= write_if_changed(CONTENT, new, log)

    # ---- areas/*.html  (only those that exist; _generate-areas.py creates them)
    by_slug = {r["slug"]: r for r in c["areas"]["regions"]}
    if os.path.isdir(AREAS_DIR):
        for name in sorted(os.listdir(AREAS_DIR)):
            if not name.endswith(".html"):
                continue
            slug = name[:-5]
            path = os.path.join(AREAS_DIR, name)
            if slug not in by_slug:
                log.append(("ORPHAN", "areas/%s — no region with this slug in "
                            "content.js. Delete it or restore the region." % name))
                changed = True
                continue
            src = open(path, encoding="utf-8").read()
            new = replace_marked(src, [area_head_block(c, by_slug[slug])], ".html", path)
            if check:
                log.append((("STALE" if new != src else "ok"), "areas/" + name))
                changed |= new != src
            else:
                changed |= write_if_changed(path, new, log)
        missing = sorted(set(by_slug) - {n[:-5] for n in os.listdir(AREAS_DIR)
                                         if n.endswith(".html")})
        for slug in missing:
            log.append(("MISSING", "areas/%s.html — run _generate-areas.py" % slug))
            changed = True

    # ---- sitemap.xml + robots.txt
    for path, text in ((SITEMAP, build_sitemap(c, touch)), (ROBOTS, build_robots())):
        if check:
            cur = open(path, encoding="utf-8").read() if os.path.exists(path) else None
            log.append((("STALE" if cur != text else "ok"), os.path.relpath(path, ROOT)))
            changed |= cur != text
        else:
            changed |= write_if_changed(path, text, log)

    width = max(len(s) for s, _ in log)
    for status, what in log:
        print("  %-*s  %s" % (width, status, what))
    print()
    print("  SITE_URL   %s" % SITE_URL)
    print("  INDEXABLE  %s  ->  robots meta: %s"
          % (INDEXABLE, ROBOTS_INDEXABLE if INDEXABLE else ROBOTS_BLOCKED))
    print("  pages      %d  (home + %d area pages)"
          % (len(sitemap_urls(c)), len(c["areas"]["regions"])))
    return changed


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true",
                    help="do not write; exit 1 if anything is out of date")
    ap.add_argument("--touch", action="store_true",
                    help="also refresh every sitemap <lastmod> to today")
    a = ap.parse_args()
    dirty = run(check=a.check, touch=a.touch)
    if a.check and dirty:
        print("\n  OUT OF DATE — run `python3 _seo.py`")
        sys.exit(1)
