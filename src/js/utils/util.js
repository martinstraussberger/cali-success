// Utility helpers (DRY/KISS)
export const Util = {
  clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
  randRange: (min, max) => min + Math.random() * (max - min),
  randInt: (min, max) => Math.floor(Util.randRange(min, max + 1)),
  choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  lerpColor: (c1, c2, t) => {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  },
};

export const SPEED_FACTS = [
  "At this speed, your hair is now a helmet.",
  "Wind speed: 100% sass, 0% mercy.",
  "Your shadow is officially lagging behind.",
  "Speed translates coffee into quantum optimism.",
  "You're approaching plaid. Careful with the fabric.",
  "The bugs have applied for flight insurance.",
  "Your playlist can't keep up with the vibes.",
  "Physics called. It says: 'Nice wheelie.'",
  "You're now legally faster than boredom.",
  "Even the birds are gossiping about you.",
];

export const MILESTONES = [
  {
    id: 1, title: '1. NEXT.JS / SEO', text: [
      'We have released Next.js at the end of August (besides a few major struggles with SEO 😉). Huge Thank you to the complete Web Team! 🕸️',
      'SEO: Clean-up of what we have missed after releasing Next.js - We proceeded with the proper Tour-Feed SEO release and after a lot of debugging sessions, meetings, research, we can tell that we fixed it, recently! ⭐.',
      'SEO: Reduced Loading Time and File Sizes to improve speed of our production page 🏍️.',
      'SEO: correct error codes (404/410…)',
      'Thanks to Anna, Vivian and all participants for their help and patience. 🙏',
    ]
  },
  {
    id: 2, title: '2. STORYBLOK', text: [
      'STORYBLOK: improved scaling of our units for CSS Typography.',
      'STORYBLOK: added complete new Dialog in Storyblok, which is re-usable for many use cases (Flash Offer Dialog, Black Friday, Post-Planning Feedback and more) ⭐.',
      'STORYBLOK: new Feature Table - via Flexbox, instead of complex HTML Table.',
      'STORYBLOK: custom plugins (versatile usage without Enterprise)'
    ]
  },
  {
    id: 3, title: '3. SUPPORT / ZENDESK', text: [
      'SSO: Support for our Help Customer Support Page <> calimoto 🚀. (yes with a small twist - A Hacker asked for a NDA 😉.',
    ]
  },
  {
    id: 4, title: '4. 🐛-Fix --> TABLET SUPPORT FOR Trip PLaner', text: [
      'User can now use Android / iOS / Windows tablet for our Trip PLaner without any issues ',]
  },
  {
    id: 5, title: '5. GOOGLE TAG MANAGER', text: [
      'Web fits newest standards for Google Tag Manager. GTM works again 🚀',
    ]
  },
  {
    id: 6, title: '6. GROWTH LAB FAST DEPLOYMENT', text: [
      'GROWTH: ae have added an additional deployment instance and process for quick release for FTT Test Environment.',
      'GROWTH: also added FlashOffer Experiment (new FlashOffer Dialog)',
      'GROWTH: tested and deployed a better saving process for the user when saving a Tour in inside Trip PLaner 🚀.',
    ]
  },
  {
    id: 7, title: '7. Trip PLaner / MAPBOX', text: [
      'Removed legacy Tegola BE Service and replaced it with Mapbox Studio integration. (yes, Web tries to close the gap towards the Apps 🚀',
    ]
  },
  {
    id: 8, title: '8. WEB / KMM', text: [
      'Galina set the sails for KMM & WEB integrations as well as USE CASES! 🚀.Thanks to Willy for the initial Web Setup. 🙏',
    ]
  },
  {
    id: 9, title: '9. ⏳ LOADING TIME & NEXT.JS UPGRADE (AGAIN 😩)', text: [
      'NEXT.js upgrade to 16.0.7 + React upgrade from 19.0 to 19.2.0(fixed vulnerability which directly came from Next.js Framework & React, faster loads)',
    ]
  },
  {
    id: 10, title: '10. MISC. FIXES & UPDATES', text: [
      'Fixed various bugs and issues reported from users and team members 🐛.',
      'Mixpanel tracking improvements (advanced profiles)',
      'Updated various dependencies and libraries to their latest versions for improved performance and security. 📦',
    ]
  },
].map((m, i) => ({
  ...m,
  htmlText: Array.isArray(m.text)
    ? (`<ul style="color: #fff; padding-left: 22px; margin: 8px 0 0; list-style-type: disc;">`
      + m.text.map(t => `<li style="margin: 14px 0;">${t}</li>`).join('')
      + `</ul>`)
    : `<p style="color: #fff; margin: 0">${m.text}</p>`
}));
