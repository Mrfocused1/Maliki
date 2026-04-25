// Generates inline SVG illustrations of rings as data URLs.
// Used as default product imagery for the seed catalogue. Crafted to feel
// like atelier sketches rather than stock photography.
(function () {
  const METALS = {
    gold: {
      stops: [
        ['0%', '#f8e3b4'],
        ['35%', '#d9b070'],
        ['60%', '#a77b41'],
        ['100%', '#5a3f1c'],
      ],
      shadow: '#3a2812',
      prong: '#b68a4e',
    },
    'white-gold': {
      stops: [
        ['0%', '#f5f5f7'],
        ['35%', '#cfd2d8'],
        ['60%', '#9ca0a8'],
        ['100%', '#5a5d63'],
      ],
      shadow: '#2a2c30',
      prong: '#bbbec3',
    },
    'rose-gold': {
      stops: [
        ['0%', '#fbe1d4'],
        ['35%', '#e3a98b'],
        ['60%', '#b97758'],
        ['100%', '#6b3d28'],
      ],
      shadow: '#3a1f12',
      prong: '#c98a6b',
    },
    platinum: {
      stops: [
        ['0%', '#fbfbfd'],
        ['35%', '#dde0e6'],
        ['60%', '#aab0bb'],
        ['100%', '#6e747f'],
      ],
      shadow: '#2c2f35',
      prong: '#c8ccd4',
    },
  };

  const STONES = {
    diamond: { core: '#ffffff', mid: '#dfeefb', edge: '#7aa6cc' },
    ruby:    { core: '#ffd6d6', mid: '#e84a52', edge: '#7a1820' },
    emerald: { core: '#dcf2dc', mid: '#3aa066', edge: '#0e3a24' },
    sapphire:{ core: '#dde6ff', mid: '#3a64c8', edge: '#0e1c5a' },
    morganite:{core: '#fde6ee', mid: '#e898b4', edge: '#7d3a55' },
    onyx:    { core: '#3a3a3a', mid: '#161616', edge: '#000000' },
    citrine: { core: '#fff0c4', mid: '#e9b950', edge: '#7d5410' },
    amethyst:{ core: '#efdcff', mid: '#9a5fc6', edge: '#3e1a5f' },
  };

  const gradient = (id, type, stops, cx = '50%', cy = '50%') => {
    const stopXml = stops
      .map(([off, color]) => `<stop offset="${off}" stop-color="${color}"/>`)
      .join('');
    if (type === 'radial') {
      return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="0.7">${stopXml}</radialGradient>`;
    }
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stopXml}</linearGradient>`;
  };

  const stoneGradient = (id, stone) =>
    gradient(id, 'radial', [
      ['0%', stone.core],
      ['45%', stone.mid],
      ['100%', stone.edge],
    ], '40%', '35%');

  const stoneFacets = (cx, cy, r) => `
    <polygon points="${cx},${cy - r * 0.85} ${cx + r * 0.6},${cy} ${cx - r * 0.6},${cy}" fill="rgba(255,255,255,0.18)"/>
    <polygon points="${cx + r * 0.6},${cy} ${cx},${cy + r * 0.85} ${cx - r * 0.6},${cy}" fill="rgba(0,0,0,0.18)"/>
    <ellipse cx="${cx - r * 0.25}" cy="${cy - r * 0.4}" rx="${r * 0.18}" ry="${r * 0.12}" fill="rgba(255,255,255,0.55)"/>
  `;

  const prongs = (cx, cy, r, color) => `
    <line x1="${cx - r * 0.95}" y1="${cy - r * 0.55}" x2="${cx - r * 0.55}" y2="${cy - r * 0.95}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="${cx + r * 0.95}" y1="${cy - r * 0.55}" x2="${cx + r * 0.55}" y2="${cy - r * 0.95}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="${cx - r * 0.95}" y1="${cy + r * 0.55}" x2="${cx - r * 0.55}" y2="${cy + r * 0.95}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="${cx + r * 0.95}" y1="${cy + r * 0.55}" x2="${cx + r * 0.55}" y2="${cy + r * 0.95}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
  `;

  const STYLES = {
    solitaire: ({ stoneColor, metalColor }) => {
      const r = 38;
      return `
        ${prongs(200, 130, r, metalColor.prong)}
        <circle cx="200" cy="130" r="${r}" fill="url(#stone)" stroke="${metalColor.shadow}" stroke-width="1.5"/>
        ${stoneFacets(200, 130, r)}
      `;
    },

    halo: ({ stoneColor, metalColor }) => {
      const r = 26;
      const small = 9;
      const halo = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const cx = 200 + Math.cos(angle) * (r + small + 4);
        const cy = 130 + Math.sin(angle) * (r + small + 4);
        halo.push(`<circle cx="${cx}" cy="${cy}" r="${small}" fill="url(#stone)" stroke="${metalColor.shadow}" stroke-width="0.8"/>`);
      }
      return `
        ${halo.join('')}
        <circle cx="200" cy="130" r="${r}" fill="url(#stone)" stroke="${metalColor.shadow}" stroke-width="1.5"/>
        ${stoneFacets(200, 130, r)}
      `;
    },

    threeStone: ({ stoneColor, metalColor }) => {
      const positions = [[150, 140, 22], [200, 125, 32], [250, 140, 22]];
      return positions
        .map(([cx, cy, r]) => `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#stone)" stroke="${metalColor.shadow}" stroke-width="1.4"/>
          ${stoneFacets(cx, cy, r)}
        `)
        .join('');
    },

    eternity: ({ stoneColor, metalColor }) => {
      // Tiny stones running around the visible top of the band.
      const stones = [];
      const angles = [-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270];
      for (const a of angles) {
        const rad = (a * Math.PI) / 180;
        const r = 130;
        const cx = 200 + Math.cos(rad) * r;
        const cy = 250 + Math.sin(rad) * r;
        stones.push(`<circle cx="${cx}" cy="${cy}" r="6" fill="url(#stone)" stroke="${metalColor.shadow}" stroke-width="0.5"/>`);
      }
      return stones.join('');
    },

    pave: ({ stoneColor, metalColor }) => {
      // Crown of small stones across the top
      const stones = [];
      for (let i = 0; i < 9; i++) {
        const cx = 130 + i * 17;
        const r = 7 + (i === 4 ? 3 : 0);
        stones.push(`<circle cx="${cx}" cy="135" r="${r}" fill="url(#stone)" stroke="${metalColor.shadow}" stroke-width="0.6"/>`);
      }
      return stones.join('');
    },

    signet: ({ metalColor }) => {
      // Flat oval signet face — no gemstone
      return `
        <ellipse cx="200" cy="130" rx="58" ry="42" fill="url(#metal)" stroke="${metalColor.shadow}" stroke-width="2"/>
        <ellipse cx="200" cy="130" rx="48" ry="34" fill="none" stroke="${metalColor.shadow}" stroke-width="0.8" opacity="0.5"/>
        <text x="200" y="142" text-anchor="middle" fill="${metalColor.shadow}" font-family="Georgia, serif" font-style="italic" font-size="32" opacity="0.7">M</text>
      `;
    },
  };

  function ring({ metal = 'gold', stone = 'diamond', style = 'solitaire' } = {}) {
    const metalColor = METALS[metal] || METALS.gold;
    const stoneColor = STONES[stone] || STONES.diamond;

    const centerpiece = STYLES[style]({ stoneColor, metalColor });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
  <defs>
    ${gradient('metal', 'linear', metalColor.stops)}
    ${stoneGradient('stone', stoneColor)}
    <radialGradient id="bg" cx="50%" cy="40%" r="0.75">
      <stop offset="0%" stop-color="#1a1815"/>
      <stop offset="100%" stop-color="#0a0908"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>

  <!-- Subtle floor reflection -->
  <ellipse cx="200" cy="370" rx="140" ry="14" fill="rgba(217,176,112,0.08)"/>

  <!-- Ring band (outer + inner ellipse to make a torus seen from a slight angle) -->
  <ellipse cx="200" cy="250" rx="130" ry="125" fill="url(#metal)" stroke="${metalColor.shadow}" stroke-width="1.5"/>
  <ellipse cx="200" cy="252" rx="100" ry="95" fill="url(#bg)"/>

  <!-- Inner highlight on band -->
  <path d="M 100 240 Q 200 165 300 240" fill="none" stroke="rgba(255,240,210,0.35)" stroke-width="2"/>

  <!-- Centerpiece (stones / signet / etc.) -->
  ${centerpiece}
</svg>`;

    return 'data:image/svg+xml;base64,' + (typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg, 'utf8').toString('base64'));
  }

  // Expose
  if (typeof window !== 'undefined') window.RingSvg = { ring, METALS, STONES, STYLES };
  if (typeof module !== 'undefined') module.exports = { ring, METALS, STONES, STYLES };
})();
