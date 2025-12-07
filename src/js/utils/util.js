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

// Distinct milestone entries (17) with unique titles and texts
const MILESTONE_COLORS = [
  '#f6ff00', '#CF3D3E', '#cfd6ec', '#8fb57b', '#eaeef6',
  '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#8338ec'
];

export const MILESTONES = [
  { id: 1, title: 'NEXT.JS / SEO', text: 'We have released Next.js at the end of August (besides a few major struggles with SEO 😉)', },
  { id: 2, title: 'STORYBLOK', text: 'Improved scaling of our units for CSS Typography.', },
  { id: 3, title: 'SUPPORT / ZENDESK', text: 'SSO Support for our Help Customer Support Page <> calimoto 🚀. (yes with a small twist - A Hacker asked for a NDA 😉.', },
  { id: 4, title: '🐛-Fix --> TABLET SUPPORT FOR TOURPLANER', text: 'User can now use Android / iOS / Windows tablet for our Tourplaner without any issues ', },
  { id: 5, title: 'STORYBLOK', text: 'Storyblok neue Feature Table - Rein via Flexbox, statt kompliziertet Table', },
  { id: 6, title: 'GOOGLE TAG MANAGER', text: 'Web fits newest standards for Google Tag Manager. GTM works again 🚀', },
  { id: 7, title: 'GROWTH LAB FAST DEPLOYMENT', text: 'We have added an additional deployment instance and process for quick release for our web-ftt.test.calimot.com page. Also added FlashOffer Experiment and a better saving process for the user when saving a Tour in inside Tourplaner 🚀.', },
  { id: 8, title: 'STORYBLOK - BLACK FRIDAY', text: 'Added complete new Dialog in Storyblok, which is re-usable for many use cases (Flash Offer Dialog, Black Friday, Post-Planning Feedback an more) ⭐.', },
  { id: 9, title: 'SEO', text: 'Clean-up of what we have missed after releasing Next.js - We proceeded with the proper Tour-Feed SEO release and after a lot of debugging sessions, meetings, research, we can tell that we fixed it, recently! ⭐. Thanks to Anna, Vivian and all participants for their help and patience. 🙏', },
  { id: 10, title: 'TOURPLANER / MAPBOX', text: 'Removed legacy Tegola BE Service and replaced it with Mapbox Studio integration. (yes, Web tries to close the gap towards the Apps 🚀', },
  { id: 11, title: 'WEB / KMM', text: 'Galina set the sails for KMM & WEB integrations as well as USE CASES! 🚀. Thanks to Willy for the initial Web Setup. 🙏', },
  { id: 12, title: '⏳ LOADING TIME ', text: 'Reduced Loading Time and File Sizes to improve speed of our production page 🏍️.', },
  { id: 13, title: 'SEO', text: 'First step towards correct error codes for Page Not Found (404), Gone (410) and more', },
  { id: 14, title: 'Upgrade from NEXT.js 15.3 to 16.0.7 / SEO', text: '👀 ... 👀 ... 👀, Yes again upgrade of Next.js for faster turbopack loads on local environment and production (SEO 👅), and there was a hacking attempt last Friday because the previous Next.js Version had a vulnerability issue, which is fixed 🙏', },
  { id: 15, title: 'Continous Improvement for Web tracking in MIXPANEL', text: 'Such as advanced profiles we email tracking.', },
  { id: 16, title: 'STORYBLOK', text: 'Custom Storyblok Plugins for a more versatile usage of Storyblok without upgrading to Enterprise model! 💰🐷:', },
  { id: 17, title: 'A lot of 🐛-Fixes (SEO & User Feedback & Co.)', text: 'Just Silence nothing more. 🤫', },
].map((m, i) => ({
  ...m,
  htmlText: `<span style="color: ${MILESTONE_COLORS[i % MILESTONE_COLORS.length]}">${m.text}</span>`
}));
