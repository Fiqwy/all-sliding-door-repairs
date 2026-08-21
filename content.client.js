// ============================================================
// DO NOT EDIT BY HAND — CLIENT OVERRIDES
// ============================================================
// This file is the portal hook. It is the ONE file a Content Studio
// (or Lachlan, through a dashboard) is ever allowed to write to, so
// the site can be re-skinned without touching content.js, script.js
// or styles.css.
//
// content.js merges this on top of its base:
//   · objects merge KEY BY KEY   (patch { brand: { phone: "…" } }
//     changes only the phone and leaves the rest of brand alone)
//   · arrays and scalars REPLACE WHOLESALE (patch an array and you
//     own every item in it, including the ones you didn't retype)
//
// Leave it as an empty object until something is genuinely being
// overridden. An empty override is the safest possible state: the
// site renders entirely from content.js.
// ============================================================

export const overrides = {};
