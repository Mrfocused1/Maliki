/* Maliki Atelier — Micro Animations (GSAP + ScrollTrigger) */
(function () {
  if (typeof gsap === 'undefined') return;

  // Respect reduced-motion preference
  const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (noMotion) return;

  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const q   = (sel) => document.querySelector(sel);
  const qa  = (sel) => gsap.utils.toArray(sel);
  const on  = (el, ev, fn) => el && el.addEventListener(ev, fn);
  const ST  = typeof ScrollTrigger !== 'undefined';

  // scrollTrigger shorthand — fade+rise on scroll
  const onScroll = (el, vars = {}) => ST && gsap.from(el, {
    scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    y: 28, opacity: 0, duration: 0.75, ease: 'power3.out',
    ...vars,
  });

  // ─── Page entrance ─────────────────────────────────────────────────────────
  gsap.from('body', { opacity: 0, duration: 0.45, ease: 'power2.out' });

  // ─── Topbar slide-down ──────────────────────────────────────────────────────
  gsap.from('.topbar', {
    y: -20, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.1,
  });

  // ─── Nav link hover — subtle lift ──────────────────────────────────────────
  qa('.nav a:not(.cart-btn)').forEach(a => {
    on(a, 'mouseenter', () => gsap.to(a, { y: -2, duration: 0.18, ease: 'power2.out' }));
    on(a, 'mouseleave', () => gsap.to(a, { y: 0,  duration: 0.18, ease: 'power2.out' }));
  });

  // ─── Cart count pulse when value changes ───────────────────────────────────
  const cartCount = document.getElementById('cartCount');
  if (cartCount) {
    new MutationObserver(() => {
      gsap.fromTo(cartCount,
        { scale: 1.6 },
        { scale: 1, duration: 0.45, ease: 'elastic.out(1.1,0.5)' }
      );
    }).observe(cartCount, { childList: true, characterData: true, subtree: true });
  }

  // ─── Mobile nav — stagger links on open ────────────────────────────────────
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav) {
    new MutationObserver(() => {
      if (mobileNav.classList.contains('open')) {
        gsap.from(mobileNav.querySelectorAll('a'), {
          y: 28, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.07, delay: 0.05,
        });
      }
    }).observe(mobileNav, { attributes: true, attributeFilter: ['class'] });
  }

  // ─── Button press feedback ─────────────────────────────────────────────────
  document.querySelectorAll('.hero-cta, .story-link, .collection-link a, .cart-btn').forEach(btn => {
    on(btn, 'mousedown', () => gsap.to(btn, { scale: 0.96, duration: 0.1, ease: 'power2.in' }));
    on(btn, 'mouseup',   () => gsap.to(btn, { scale: 1, duration: 0.25, ease: 'elastic.out(1.2,0.5)' }));
    on(btn, 'mouseleave',() => gsap.to(btn, { scale: 1, duration: 0.15 }));
  });

  // ─── Form input focus glow ─────────────────────────────────────────────────
  document.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea, select').forEach(inp => {
    on(inp, 'focus', () => gsap.to(inp, {
      boxShadow: '0 0 0 2px rgba(217,176,112,0.38)', duration: 0.22, ease: 'power2.out',
    }));
    on(inp, 'blur', () => gsap.to(inp, {
      boxShadow: '0 0 0 0px rgba(217,176,112,0)', duration: 0.22, ease: 'power2.out',
    }));
  });

  // ─── Hero — eyebrow / h1 / sub / cta (skip .reveal elements; CSS handles those) ──
  const hero = q('.hero');
  if (hero) {
    const tl  = gsap.timeline({ delay: 0.3 });
    const sub = hero.querySelector('.hero-sub:not(.reveal)');
    const lede = hero.querySelector('.lede:not(.reveal)');
    const cta  = hero.querySelector('.hero-cta:not(.reveal), .cta-primary:not(.reveal)');

    // Only animate elements that don't already carry the CSS .reveal animation
    if (sub)  tl.from(sub,  { y: 18, opacity: 0, duration: 0.75, ease: 'power3.out' });
    if (lede) tl.from(lede, { y: 18, opacity: 0, duration: 0.75, ease: 'power3.out' }, '-=0.4');
    if (cta)  tl.from(cta,  { y: 14, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5');
  }

  // ─── Scroll animations ─────────────────────────────────────────────────────
  if (!ST) return;

  // Section titles + labels
  qa('.section-title, .section-heading, .section-label').forEach(el => onScroll(el));

  // Promise items — stagger
  qa('.promise-item').forEach((el, i) => onScroll(el, { delay: i * 0.1 }));

  // Press logos — stagger in from below
  qa('.press-logos li').forEach((el, i) => onScroll(el, {
    y: 16, opacity: 0, duration: 0.55, delay: i * 0.09,
  }));

  // Testimonials grid children
  qa('.testimonials-grid > *').forEach((el, i) => onScroll(el, { delay: i * 0.12, y: 36 }));

  // Story section — visual slides in from left, text from right
  const sv = q('.story-visual');
  const st = q('.story-text');
  if (sv) gsap.from(sv, {
    scrollTrigger: { trigger: sv, start: 'top 85%', once: true },
    x: -40, opacity: 0, duration: 0.9, ease: 'power3.out',
  });
  if (st) gsap.from(st, {
    scrollTrigger: { trigger: st, start: 'top 85%', once: true },
    x: 40, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.1,
  });

  // About page — prose paragraphs
  qa('.prose p').forEach((p, i) => onScroll(p, { y: 18, duration: 0.6, delay: i * 0.04 }));

  // About image-break
  const imgBreak = q('.img-break');
  if (imgBreak) gsap.from(imgBreak, {
    scrollTrigger: { trigger: imgBreak, start: 'top 88%', once: true },
    scale: 0.97, opacity: 0, duration: 0.9, ease: 'power3.out',
  });

  // Cart line items — stagger in on load
  qa('.line').forEach((el, i) => gsap.from(el, {
    y: 18, opacity: 0, duration: 0.45, ease: 'power2.out', delay: 0.15 + i * 0.08,
  }));

  // Cart panels
  qa('.panel').forEach((el, i) => gsap.from(el, {
    y: 24, opacity: 0, duration: 0.6, ease: 'power2.out', delay: 0.1 + i * 0.1,
  }));

  // Reviews on product page (dynamic — use MutationObserver)
  const reviewsSection = q('.reviews-section');
  if (reviewsSection) {
    const animReviews = () => {
      qa('.review-card').forEach((card, i) => {
        if (card.dataset.animated) return;
        card.dataset.animated = '1';
        gsap.from(card, {
          scrollTrigger: { trigger: card, start: 'top 90%', once: true },
          y: 28, opacity: 0, duration: 0.6, ease: 'power2.out', delay: i * 0.08,
        });
      });
    };
    animReviews();
    new MutationObserver(animReviews).observe(reviewsSection, { childList: true, subtree: true });
  }

  // Footer fade
  const footer = q('.footer');
  if (footer) gsap.from(footer, {
    scrollTrigger: { trigger: footer, start: 'top 96%', once: true },
    opacity: 0, duration: 0.7, ease: 'power2.out',
  });

  // ─── Shop: product cards — animate on load and when grid is updated ─────────
  const grid = document.getElementById('grid');
  if (grid) {
    const animCards = () => {
      qa('.card').forEach((card, i) => {
        if (card.dataset.animated) return;
        card.dataset.animated = '1';
        gsap.from(card, {
          y: 36, opacity: 0, duration: 0.6, ease: 'power2.out',
          delay: (i % 4) * 0.07 + 0.1,
        });
      });
    };
    animCards();
    new MutationObserver(animCards).observe(grid, { childList: true });

    // Image hover zoom on product cards (delegated)
    grid.addEventListener('mouseover', e => {
      const img = e.target.closest('.card')?.querySelector('.frame img');
      if (img) gsap.to(img, { scale: 1.05, duration: 0.55, ease: 'power2.out' });
    });
    grid.addEventListener('mouseout', e => {
      const img = e.target.closest('.card')?.querySelector('.frame img');
      if (img) gsap.to(img, { scale: 1, duration: 0.55, ease: 'power2.out' });
    });
  }

  // ─── Product page — hero content animated when rendered ────────────────────
  const root = document.getElementById('root');
  if (root && !grid) {
    const animPDP = () => {
      const pdpImg  = q('.pdp-img img, .pdp-image img');
      const pdpInfo = q('.pdp-info, .product-info');
      if (pdpImg && !pdpImg.dataset.animated) {
        pdpImg.dataset.animated = '1';
        gsap.from(pdpImg, { x: -32, opacity: 0, duration: 0.85, ease: 'power3.out', delay: 0.1 });
      }
      if (pdpInfo && !pdpInfo.dataset.animated) {
        pdpInfo.dataset.animated = '1';
        gsap.from(pdpInfo, { x: 32, opacity: 0, duration: 0.85, ease: 'power3.out', delay: 0.2 });
      }
      // Size swatches stagger
      qa('.size-btn:not([data-animated])').forEach((btn, i) => {
        btn.dataset.animated = '1';
        gsap.from(btn, { scale: 0.8, opacity: 0, duration: 0.35, ease: 'back.out(2)', delay: 0.4 + i * 0.05 });
      });
    };
    new MutationObserver(animPDP).observe(root, { childList: true, subtree: true });
  }

  // ─── Filter pills hover on shop ────────────────────────────────────────────
  document.querySelectorAll('.filterpill').forEach(btn => {
    on(btn, 'mouseenter', () => gsap.to(btn, { y: -2, duration: 0.15, ease: 'power2.out' }));
    on(btn, 'mouseleave', () => gsap.to(btn, { y: 0,  duration: 0.15, ease: 'power2.out' }));
  });
  // Also catch dynamically added filter pills
  const filters = document.getElementById('filters');
  if (filters) {
    new MutationObserver(() => {
      document.querySelectorAll('.filterpill:not([data-animated])').forEach(btn => {
        btn.dataset.animated = '1';
        on(btn, 'mouseenter', () => gsap.to(btn, { y: -2, duration: 0.15, ease: 'power2.out' }));
        on(btn, 'mouseleave', () => gsap.to(btn, { y: 0,  duration: 0.15, ease: 'power2.out' }));
      });
    }).observe(filters, { childList: true });
  }

})();
