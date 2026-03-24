# Cinematic Design Language — Scroll-Driven Editorial Pages

A portable reference for building cinematic, editorial, visual-first landing pages. Think Apple/Nike product launches — NOT generic SaaS templates. Every section is a magazine spread told through full-bleed photography, bold typography, and scroll-driven animations.

---

## 1. Stack & Dependencies

```bash
npm install framer-motion lenis
# Tailwind CSS assumed (v3+)
```

| Library | Role |
|---|---|
| **React 18+** | Component framework |
| **Framer Motion** | Declarative scroll-linked transforms (`motion`, `useScroll`, `useTransform`) |
| **Lenis** | Browser-level smooth scroll — replaces per-transform `useSpring` which causes choppiness |
| **Tailwind CSS** | Rapid layout, responsive typography, utility-first styling |

**Import pattern:**
```jsx
import { useEffect, useRef } from 'react';
import { motion as Motion, useScroll, useTransform } from 'framer-motion';
import Lenis from 'lenis';
```

---

## 2. Core Design Principles

1. **Cinematic, not corporate** — every section should feel like a frame from a brand film
2. **Full-bleed photography** — images fill the viewport, darkened with `brightness-[0.3]`
3. **Bold typography** — section headings 80–120px, nothing timid
4. **Scroll-driven reveals** — content appears through scroll progress, not on-load
5. **Alternating dark/light rhythm** — black sections alternate with `#e4e4e7` for visual pacing
6. **Dual accent color strategy** — light accent (e.g. `#65E4CF`) on dark backgrounds, dark accent (e.g. `#056363`) on light backgrounds for proper contrast

---

## 3. Performance — GPU Pre-Promotion

These patterns prevent the "first-paint jerk" and ensure 60fps animations.

### On every animated `Motion` element:
```jsx
style={{ willChange: 'transform' }}
// or for elements that also fade:
style={{ willChange: 'transform, opacity' }}
```

### On containers that will be animated into view:
```jsx
// Force GPU compositing layer BEFORE first paint
style={{ transform: 'translate3d(0,0,0)' }}
```

### On images inside animated containers:
```jsx
<img
  src="..."
  className="h-full w-full object-cover"
  style={{ transform: 'translate3d(0,0,0)' }}
/>
```

**Why:** Without pre-promotion, the browser promotes the layer to the GPU on first animation frame, causing a visible jank/jerk. `translate3d(0,0,0)` forces promotion at paint time.

---

## 4. Lenis Smooth Scroll Setup

Place this in your page component. It smooths the native browser scroll position so all `useScroll`-driven animations feel buttery.

```jsx
useEffect(() => {
  const lenis = new Lenis({
    duration: 1.4,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
  return () => lenis.destroy();
}, []);
```

**Why Lenis over `useSpring`:** Applying `useSpring` to individual string-value transforms (`'0%'`, `'-120%'`) causes frame drops on fast scroll. Lenis smooths at the scroll level, so all downstream `useTransform` values are naturally smooth.

---

## 5. Animation Recipes

### A. Split-Panel Hero (panels open to reveal content)

Two image panels cover the screen, then split apart on scroll to reveal brand text behind them.

**Structure:**
```
[Fixed hero layer (z-0)]
  ├── Split panels (z-20) — translate x on scroll
  ├── Brand text (z-10) — naturally revealed as panels move
  └── Taglines, marquee, etc.
[Spacer div] — provides scroll height, ref for useScroll
[Rest of page (z-10+)] — scrolls over the fixed hero
```

**Scroll setup:**
```jsx
const heroRef = useRef(null);
const { scrollYProgress: heroProgress } = useScroll({
  target: heroRef,
  offset: ['start start', 'end start'],
});
```

**Transforms:**
```jsx
// Panels split apart
const leftX  = useTransform(heroProgress, [0, 0.55, 1], ['0%', '-120%', '-120%']);
const rightX = useTransform(heroProgress, [0, 0.55, 1], ['0%',  '120%',  '120%']);
const splitOpacity = useTransform(heroProgress, [0, 0.55, 0.8, 1], [1, 1, 0, 0]);

// Brand text fades in as panels split
const brandOpacity = useTransform(heroProgress, [0, 0.1, 0.25, 0.35], [0.15, 0.5, 0.85, 1]);

// Brand moves up + scales after reveal
const brandY     = useTransform(heroProgress, [0, 0.35, 0.5, 1], ['0%', '0%', '-120%', '-120%']);
const brandScale = useTransform(heroProgress, [0, 0.35, 0.5, 1], [1, 1, 1.8, 1.8]);
```

**JSX pattern:**
```jsx
{/* Fixed hero — always behind, never moves */}
<div className="fixed inset-0 z-0 overflow-hidden bg-[#e4e4e7]">
  {/* Split panels */}
  <Motion.div className="absolute inset-0 flex z-20" style={{ opacity: splitOpacity }}>
    <Motion.div className="relative h-full w-1/2 overflow-hidden"
      style={{ x: leftX, willChange: 'transform' }}>
      <img src="..." className="h-full w-full object-cover" />
    </Motion.div>
    <Motion.div className="relative h-full w-1/2 overflow-hidden"
      style={{ x: rightX, willChange: 'transform' }}>
      <img src="..." className="h-full w-full object-cover" />
    </Motion.div>
  </Motion.div>

  {/* Brand text at z-10, behind panels */}
  <div className="absolute inset-0 z-10 flex items-center justify-center">
    <Motion.div style={{ y: brandY, scale: brandScale, opacity: brandOpacity, willChange: 'transform' }}>
      <div className="text-[120px] font-extrabold tracking-widest" style={{ color: '#056363' }}>
        BRAND
      </div>
    </Motion.div>
  </div>
</div>

{/* Spacer — gives scroll room */}
<div ref={heroRef} className="relative z-0 h-[285vh]" />
```

---

### B. Curtain Close (panels slide IN from sides to cover content)

The reverse of the hero split. Two panels slide inward to cover the current section, revealing new content. Supports asymmetric splits (e.g. 70/30).

**Structure:**
```
[Tall wrapper (235vh) with sticky inner]
  └── Sticky container (h-screen)
       ├── Background content (z-10) — the section being covered
       └── Closing panels (z-20) — slide in from ±100% to 0%
```

**Transforms (driven by the wrapper's scroll progress):**
```jsx
const sectionRef = useRef(null);
const { scrollYProgress: progress } = useScroll({
  target: sectionRef,
  offset: ['start end', 'end start'],
});

// Panels close during second half of scroll
const closeLeftX  = useTransform(progress, [0.35, 0.55], ['-100%', '0%']);
const closeRightX = useTransform(progress, [0.35, 0.55], ['100%',  '0%']);
```

**JSX pattern (70/30 split — image left, text right):**
```jsx
<div ref={sectionRef} className="relative z-10" style={{ height: '235vh' }}>
  <div className="sticky top-0 h-screen overflow-hidden bg-black"
    style={{ transform: 'translate3d(0,0,0)' }}>

    {/* Content being covered */}
    <div className="relative z-10 flex h-full items-center justify-center">
      <div className="text-[96px] font-extrabold" style={{ color: '#65E4CF' }}>
        Section text here
      </div>
    </div>

    {/* Closing panels */}
    <div className="absolute inset-0 z-20 flex pointer-events-none"
      style={{ transform: 'translate3d(0,0,0)' }}>
      <Motion.div
        className="h-full w-[70%] shrink-0 overflow-hidden bg-[#e4e4e7] pointer-events-auto"
        style={{ x: closeLeftX, willChange: 'transform', transform: 'translate3d(0,0,0)' }}>
        <img src="..." className="h-full w-full object-cover" />
      </Motion.div>
      <Motion.div
        className="flex h-full w-[30%] shrink-0 items-center bg-[#e4e4e7] px-14 pointer-events-auto"
        style={{ x: closeRightX, willChange: 'transform', transform: 'translate3d(0,0,0)' }}>
        <div>
          <div className="text-[56px] font-extrabold text-black/85">
            New content
          </div>
        </div>
      </Motion.div>
    </div>
  </div>
</div>
```

---

### C. Parallax Background Image

Subtle upward drift on a full-bleed background image as the section scrolls through the viewport.

```jsx
const sectionRef = useRef(null);
const { scrollYProgress: progress } = useScroll({
  target: sectionRef,
  offset: ['start end', 'end start'],
});
const imgY = useTransform(progress, [0, 1], ['0%', '-15%']);
```

```jsx
<section ref={sectionRef} className="relative h-screen overflow-hidden bg-black">
  <Motion.div className="absolute inset-0" style={{ y: imgY, willChange: 'transform' }}>
    <img src="..." className="h-[115%] w-full object-cover brightness-[0.3]" />
  </Motion.div>
  <div className="relative z-10 flex h-full items-center justify-center">
    {/* Content over the image */}
  </div>
</section>
```

**Key details:**
- Image height is `115%` (not 100%) to provide room for the -15% translate without exposing the bottom edge
- `brightness-[0.3]` or `brightness-[0.35]` darkens the image so overlaid text is readable

---

### D. Sticky Section with Scrolling Images

Text stays pinned while images scroll upward and disappear.

```jsx
const sectionRef = useRef(null);
const { scrollYProgress: progress } = useScroll({
  target: sectionRef,
  offset: ['start start', 'end start'],
});
const imgsY     = useTransform(progress, [0, 0.5, 1], ['0%', '-100%', '-100%']);
const imgsScale = useTransform(progress, [0, 1], [1, 1.08]);
```

```jsx
<section ref={sectionRef} className="relative bg-black z-30"
  style={{ transform: 'translate3d(0,0,0)' }}>
  <div className="relative h-[230vh]">
    {/* Images — clipped independently */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <Motion.div className="absolute inset-0"
        style={{ y: imgsY, scale: imgsScale, willChange: 'transform' }}>
        {/* Staggered absolute-positioned images */}
        <div className="absolute left-[2%] top-[10%] h-[50%] w-[30%] overflow-hidden rounded-2xl">
          <img src="..." className="h-full w-full object-cover blur-[2px]"
            style={{ transform: 'translate3d(0,0,0)' }} />
        </div>
        {/* More images at different positions... */}
      </Motion.div>
    </div>

    {/* Sticky text — stays pinned */}
    <div className="sticky top-24 px-6 pb-20">
      <div className="text-[96px] font-extrabold" style={{ color: '#65E4CF' }}>
        Heading Here
      </div>
    </div>
  </div>
</section>
```

**Critical:** The `overflow-hidden` MUST be on the image wrapper, NOT on a parent of the sticky text. Overflow hidden on a sticky element's ancestor breaks `position: sticky`.

---

### E. Text Fade-In with Y Translate

```jsx
const textOpacity = useTransform(progress, [0, 0.3, 0.55], [0, 0, 1]);
const textY       = useTransform(progress, [0, 0.3, 0.55], ['40px', '40px', '0px']);
```

```jsx
<Motion.div style={{ opacity: textOpacity, y: textY, willChange: 'transform, opacity' }}>
  <div className="text-[96px] font-extrabold" style={{ color: '#65E4CF' }}>
    Headline
  </div>
</Motion.div>
```

---

### F. Scale-In CTA

```jsx
const ctaOpacity = useTransform(progress, [0, 0.25, 0.5], [0, 0, 1]);
const ctaScale   = useTransform(progress, [0, 0.25, 0.5], [0.85, 0.85, 1]);
```

```jsx
<Motion.div style={{ opacity: ctaOpacity, scale: ctaScale, willChange: 'transform, opacity' }}>
  <div className="text-[120px] font-extrabold" style={{ color: '#65E4CF' }}>
    Your turn.
  </div>
  <div className="mt-12 flex gap-5">
    <button className="rounded-full px-10 py-4 text-[18px] font-semibold text-white"
      style={{ backgroundColor: '#65E4CF' }}>
      Primary Action
    </button>
    <button className="rounded-full border-2 px-10 py-4 text-[18px] font-semibold"
      style={{ borderColor: '#65E4CF', color: '#65E4CF' }}>
      Secondary Action
    </button>
  </div>
</Motion.div>
```

---

### G. Infinite Logo Marquee

Pure CSS — no JavaScript animation needed.

**CSS (add to your global stylesheet):**
```css
.marquee-mask {
  -webkit-mask-image: linear-gradient(
    to right, transparent 0%, black 15%, black 85%, transparent 100%
  );
  mask-image: linear-gradient(
    to right, transparent 0%, black 15%, black 85%, transparent 100%
  );
}

.marquee-track {
  width: max-content;
  animation: marquee-scroll 30s linear infinite;
}

@keyframes marquee-scroll {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}
```

**JSX:**
```jsx
<div className="marquee-mask overflow-hidden">
  <div className="marquee-track flex items-center gap-20">
    {/* First set */}
    {logos.map((logo, i) => (
      <img key={`a-${i}`} src={logo} className="h-[84px] w-auto shrink-0 opacity-60" />
    ))}
    {/* Identical duplicate for seamless loop */}
    {logos.map((logo, i) => (
      <img key={`b-${i}`} src={logo} className="h-[84px] w-auto shrink-0 opacity-60" />
    ))}
  </div>
</div>
```

**Why duplicate:** The track is `max-content` wide. The animation translates `-50%` — when the first set scrolls off-screen, the identical second set is in its exact starting position. Seamless loop.

---

### H. Gradient Transition Between Sections

Softens a hard edge when a dark section appears over a light background (e.g. fixed hero).

```jsx
<div className="absolute top-0 left-0 right-0 -translate-y-full h-[30vh]
  bg-gradient-to-b from-transparent to-black z-30 pointer-events-none" />
```

Place this as the first child inside the dark section. The `-translate-y-full` pushes it above the section boundary, creating a smooth fade from the previous section.

---

## 6. Scroll Offset Cheatsheet

| Pattern | `offset` value | What it means |
|---|---|---|
| Fixed hero + spacer | `['start start', 'end start']` | Progress 0 when spacer top hits viewport top; 1 when spacer bottom hits viewport top |
| Sticky section tracking own scroll | `['start start', 'end start']` | Same — tracks how far through the tall wrapper you've scrolled |
| Section entering viewport (parallax, fade-in) | `['start end', 'end start']` | Progress 0 when section top enters viewport bottom; 1 when section bottom exits viewport top |

---

## 7. Typography Rules

| Element | Size | Weight | Other |
|---|---|---|---|
| Section headlines | 80–120px | `font-extrabold` | `tracking-tight leading-[0.95]` |
| Section subtext | 20–28px | `font-light` | Often italic, `text-white/50` on dark bg |
| Image captions | 18px | `font-light` | `text-white/50`, `leading-snug` |
| Buttons | 18px | `font-semibold` | `rounded-full`, `px-10 py-4` |
| Footer fine print | 14–16px | normal | `text-white/30` |

**Responsive pattern:**
```
text-[64px] sm:text-[96px]
text-[80px] sm:text-[120px]
```

---

## 8. z-Index Layering Convention

| Layer | z-index | Purpose |
|---|---|---|
| Fixed hero | `z-0` | Always behind everything |
| Hero spacer | `z-0` | Invisible scroll room |
| Content sections | `z-10` | Normal flow sections |
| Curtain/closing panels | `z-20` | Inside sticky containers, overlays content |
| Sticky image section | `z-30` | Must cover the fixed hero |
| Navigation | `z-50` | Always on top |

---

## 9. Anti-Patterns — What NOT to Do

| Don't | Why | Do Instead |
|---|---|---|
| `useSpring` on string-value transforms | Causes frame drops on fast scroll | Use Lenis for global smooth scroll |
| `position: sticky` inside `overflow: hidden` parent | Sticky behavior breaks entirely | Isolate `overflow-hidden` to image wrapper only |
| Negative margins for section overlap | Causes layout reflow jerk | Use `position: fixed` hero + spacer, or sticky inside tall wrapper |
| Skip `translate3d(0,0,0)` on animated layers | First-paint jank as GPU promotion happens mid-animation | Always pre-promote with `translate3d(0,0,0)` |
| Feature cards, numbered steps, glass-morphism | Looks like every other SaaS template | Use full-bleed images, massive text, parallax reveals |
| Inline `useSpring` per transform | Each spring runs independently, creating visual discord | Single scroll source → multiple `useTransform` branches |

---

## 10. CSS Animations

Add these to your global CSS file alongside Tailwind imports.

```css
/* ===== Marquee ===== */
@keyframes marquee-scroll {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}

.marquee-mask {
  -webkit-mask-image: linear-gradient(
    to right, transparent 0%, black 15%, black 85%, transparent 100%
  );
  mask-image: linear-gradient(
    to right, transparent 0%, black 15%, black 85%, transparent 100%
  );
}

.marquee-track {
  width: max-content;
  animation: marquee-scroll 30s linear infinite;
}

/* ===== Liquid Blob Navbar Background ===== */
@keyframes liquid-blob {
  0%   { transform: translate3d(-10%, -10%, 0) scale(1.05) rotate(0deg);
         filter: blur(28px) saturate(120%); }
  50%  { transform: translate3d(10%, 8%, 0) scale(1.15) rotate(12deg);
         filter: blur(34px) saturate(140%); }
  100% { transform: translate3d(-10%, -10%, 0) scale(1.05) rotate(0deg);
         filter: blur(28px) saturate(120%); }
}

.liquid-nav-bg {
  background:
    radial-gradient(circle at 20% 30%, rgba(56, 189, 248, 0.25), transparent 45%),
    radial-gradient(circle at 70% 20%, rgba(16, 185, 129, 0.22), transparent 40%),
    radial-gradient(circle at 60% 80%, rgba(236, 72, 153, 0.16), transparent 46%);
  animation: liquid-blob 9s ease-in-out infinite;
}
```

---

## 11. Quick-Start Skeleton

Putting it all together — a minimal page skeleton using this design language:

```jsx
import { useEffect, useRef } from 'react';
import { motion as Motion, useScroll, useTransform } from 'framer-motion';
import Lenis from 'lenis';

export default function CinematicPage() {
  // 1. Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  // 2. Scroll refs + transforms
  const heroRef = useRef(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const panelLeftX  = useTransform(heroProgress, [0, 0.55, 1], ['0%', '-120%', '-120%']);
  const panelRightX = useTransform(heroProgress, [0, 0.55, 1], ['0%',  '120%',  '120%']);

  const sectionRef = useRef(null);
  const { scrollYProgress: sectionProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const parallaxY   = useTransform(sectionProgress, [0, 1], ['0%', '-15%']);
  const textOpacity = useTransform(sectionProgress, [0, 0.3, 0.55], [0, 0, 1]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fixed hero */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#e4e4e7]">
        <Motion.div className="absolute inset-0 flex z-20">
          <Motion.div className="h-full w-1/2 overflow-hidden"
            style={{ x: panelLeftX, willChange: 'transform' }}>
            <img src="..." className="h-full w-full object-cover" />
          </Motion.div>
          <Motion.div className="h-full w-1/2 overflow-hidden"
            style={{ x: panelRightX, willChange: 'transform' }}>
            <img src="..." className="h-full w-full object-cover" />
          </Motion.div>
        </Motion.div>
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-[120px] font-extrabold tracking-widest"
            style={{ color: '#056363' }}>
            BRAND
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div ref={heroRef} className="relative z-0 h-[285vh]" />

      {/* Dark section with parallax */}
      <section ref={sectionRef} className="relative z-10 h-screen overflow-hidden bg-black"
        style={{ transform: 'translate3d(0,0,0)' }}>
        <Motion.div className="absolute inset-0"
          style={{ y: parallaxY, willChange: 'transform' }}>
          <img src="..." className="h-[115%] w-full object-cover brightness-[0.3]" />
        </Motion.div>
        <div className="relative z-10 flex h-full items-center justify-center">
          <Motion.div style={{ opacity: textOpacity, willChange: 'opacity' }}>
            <div className="text-[96px] font-extrabold" style={{ color: '#65E4CF' }}>
              Section Headline
            </div>
          </Motion.div>
        </div>
      </section>
    </div>
  );
}
```

---

## 12. Adapting the Color Theme

This design language is color-agnostic. To adapt:

1. Pick a **light accent** (for dark backgrounds) and a **dark accent** (for light backgrounds)
2. Replace all `#65E4CF` / `#056363` references with your pair
3. Keep the alternating `bg-black` / `bg-[#e4e4e7]` rhythm (or substitute your own dark/light pair)
4. Button backgrounds use the accent color; outlines use `border-2` with accent color + text

---

*Generated from the BuyTree landing page (PureVisualsTemplate.jsx) — a cinematic, editorial homepage built with React + Framer Motion + Lenis + Tailwind CSS.*
