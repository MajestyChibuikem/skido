import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FaCamera, FaCheckCircle, FaExclamationTriangle, FaHeartbeat, FaUpload } from 'react-icons/fa';
import Lenis from 'lenis';

const MotionDiv = motion.div;
const featureCards = [
  {
    title: 'AI-Powered Gait Analysis',
    description: 'Upload herd footage and automatically detect movement patterns linked to lameness.',
    icon: FaHeartbeat,
  },
  {
    title: 'Snapshot-Based Evidence',
    description: 'Get per-cow snapshots with affected animals visibly highlighted for fast review.',
    icon: FaCamera,
  },
  {
    title: 'Actionable Recommendations',
    description: 'Receive clear feedback and practical steps for each suspected or confirmed case.',
    icon: FaExclamationTriangle,
  },
];

export default function HomePage() {
  // Lenis smooth scroll
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

  // ─── Parallax section ───
  const parallaxRef = useRef(null);
  const { scrollYProgress: parallaxProgress } = useScroll({
    target: parallaxRef,
    offset: ['start end', 'end start'],
  });
  const imgY = useTransform(parallaxProgress, [0, 1], ['0%', '-15%']);
  const parallaxTextOpacity = useTransform(parallaxProgress, [0, 0.3, 0.55], [0, 0, 1]);
  const parallaxTextY = useTransform(parallaxProgress, [0, 0.3, 0.55], ['40px', '40px', '0px']);

  // ─── Features section ───
  const featuresRef = useRef(null);
  const { scrollYProgress: featuresProgress } = useScroll({
    target: featuresRef,
    offset: ['start end', 'end start'],
  });
  const feat1Opacity = useTransform(featuresProgress, [0, 0.15, 0.3], [0, 0, 1]);
  const feat1Y = useTransform(featuresProgress, [0, 0.15, 0.3], ['40px', '40px', '0px']);
  const feat2Opacity = useTransform(featuresProgress, [0.1, 0.25, 0.4], [0, 0, 1]);
  const feat2Y = useTransform(featuresProgress, [0.1, 0.25, 0.4], ['40px', '40px', '0px']);
  const feat3Opacity = useTransform(featuresProgress, [0.2, 0.35, 0.5], [0, 0, 1]);
  const feat3Y = useTransform(featuresProgress, [0.2, 0.35, 0.5], ['40px', '40px', '0px']);

  // ─── Curtain close ───
  const curtainRef = useRef(null);
  const { scrollYProgress: curtainProgress } = useScroll({
    target: curtainRef,
    offset: ['start end', 'end start'],
  });
  const closeLeftX = useTransform(curtainProgress, [0.35, 0.55], ['-100%', '0%']);
  const closeRightX = useTransform(curtainProgress, [0.35, 0.55], ['100%', '0%']);

  // ─── CTA section ───
  const ctaRef = useRef(null);
  const { scrollYProgress: ctaProgress } = useScroll({
    target: ctaRef,
    offset: ['start end', 'end start'],
  });
  const ctaOpacity = useTransform(ctaProgress, [0, 0.25, 0.5], [0, 0, 1]);
  const ctaScale = useTransform(ctaProgress, [0, 0.25, 0.5], [0.85, 0.85, 1]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ════════ Hero — static, no split animation ════════ */}
      <section className="relative h-screen overflow-hidden bg-[#e4e4e7]">
        <img
          src="/images/hero-left.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover brightness-[0.35]"
          style={{ transform: 'translate3d(0,0,0)' }}
        />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
          <MotionDiv
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="text-[80px] sm:text-[120px] font-extrabold tracking-widest leading-none text-white">
              AGROCARE
            </div>
            <div className="mt-4 text-[18px] sm:text-[24px] font-light italic text-white/50">
              Early Detection. Healthier Herds.
            </div>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-5">
              <Link
                to="/signup"
                className="rounded-full px-10 py-4 text-[18px] font-semibold text-black no-underline"
                style={{ backgroundColor: '#65E4CF' }}
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="rounded-full border-2 px-10 py-4 text-[18px] font-semibold no-underline"
                style={{ borderColor: '#65E4CF', color: '#65E4CF' }}
              >
                Log In
              </Link>
            </div>
          </MotionDiv>
        </div>
      </section>

      {/* ════════ Dark parallax section ════════ */}
      <section
        ref={parallaxRef}
        className="relative z-10 h-screen overflow-hidden bg-black"
        style={{ transform: 'translate3d(0,0,0)' }}
      >
        <MotionDiv className="absolute inset-0" style={{ y: imgY, willChange: 'transform' }}>
          <img
            src="/images/parallax-bg.jpg"
            alt=""
            className="h-[115%] w-full object-cover brightness-[0.3]"
            style={{ transform: 'translate3d(0,0,0)' }}
          />
        </MotionDiv>
        <div className="relative z-10 flex h-full items-center justify-center px-6">
          <MotionDiv
            style={{
              opacity: parallaxTextOpacity,
              y: parallaxTextY,
              willChange: 'transform, opacity',
            }}
          >
            <div
              className="text-[48px] sm:text-[80px] lg:text-[96px] font-extrabold tracking-tight leading-[0.95] text-center"
              style={{ color: '#65E4CF' }}
            >
              See lameness
              <br />
              before it costs you.
            </div>
          </MotionDiv>
        </div>
      </section>

      {/* ════════ Light features section ════════ */}
      <section
        ref={featuresRef}
        className="relative z-10 bg-[#e4e4e7] py-32 px-6"
        style={{ transform: 'translate3d(0,0,0)' }}
      >
        <div className="mx-auto max-w-5xl">
          <MotionDiv
            style={{ opacity: feat1Opacity, y: feat1Y, willChange: 'transform, opacity' }}
          >
            <div className="text-[48px] sm:text-[72px] font-extrabold tracking-tight leading-[0.95]" style={{ color: '#1a472a' }}>
              One visual system.
              <br />
              One clear workflow.
            </div>
            <p className="mt-4 max-w-2xl text-[20px] font-light text-black/55">
              From upload to report, AgroCare uses the same card-based language and icon-led guidance so every screen feels familiar.
            </p>
          </MotionDiv>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
            {featureCards.map((feature, index) => {
              const Icon = feature.icon;
              const anim = index === 0 ? { opacity: feat1Opacity, y: feat1Y } : index === 1 ? { opacity: feat2Opacity, y: feat2Y } : { opacity: feat3Opacity, y: feat3Y };
              return (
                <MotionDiv
                  key={feature.title}
                  style={{ ...anim, willChange: 'transform, opacity' }}
                  className="rounded-xl border border-black/10 bg-white/70 p-6"
                >
                  <Icon className="text-[22px]" style={{ color: '#056363' }} />
                  <div className="mt-4 text-[24px] font-extrabold leading-tight text-black/85">
                    {feature.title}
                  </div>
                  <p className="mt-3 text-[15px] text-black/60 leading-relaxed">
                    {feature.description}
                  </p>
                </MotionDiv>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════ Curtain close — How It Works ════════ */}
      <div ref={curtainRef} className="relative z-10" style={{ height: '235vh' }}>
        <div
          className="sticky top-0 h-screen overflow-hidden bg-black"
          style={{ transform: 'translate3d(0,0,0)' }}
        >
          {/* Content being covered */}
          <div className="relative z-10 flex h-full items-center justify-center px-6">
            <div
              className="text-[48px] sm:text-[80px] lg:text-[96px] font-extrabold tracking-tight leading-[0.95] text-center"
              style={{ color: '#65E4CF' }}
            >
              Simple to use.
              <br />
              Powerful results.
            </div>
          </div>

          {/* Closing panels */}
          <div
            className="absolute inset-0 z-20 flex pointer-events-none"
            style={{ transform: 'translate3d(0,0,0)' }}
          >
            <MotionDiv
              className="h-full w-[70%] shrink-0 overflow-hidden bg-[#e4e4e7] pointer-events-auto"
              style={{ x: closeLeftX, willChange: 'transform', transform: 'translate3d(0,0,0)' }}
            >
              <img
                src="/images/curtain-left.jpg"
                alt=""
                className="h-full w-full object-cover"
                style={{ transform: 'translate3d(0,0,0)' }}
              />
            </MotionDiv>
            <MotionDiv
              className="flex h-full w-[30%] shrink-0 items-center bg-[#e4e4e7] px-8 sm:px-14 pointer-events-auto"
              style={{ x: closeRightX, willChange: 'transform', transform: 'translate3d(0,0,0)' }}
            >
              <div>
                <div className="text-[36px] sm:text-[48px] font-extrabold text-black/85 leading-tight">
                  How it
                  <br />
                  works
                </div>
                <div className="mt-8 space-y-4">
                  <div className="rounded-xl border border-black/10 bg-black/5 p-4">
                    <div className="flex items-center gap-2">
                      <FaCamera style={{ color: '#056363' }} />
                      <div className="text-[16px] font-semibold text-black/70">Capture herd movement</div>
                    </div>
                    <div className="text-[14px] text-black/45 mt-1">Use farm cameras to record natural walking behavior.</div>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-black/5 p-4">
                    <div className="flex items-center gap-2">
                      <FaUpload style={{ color: '#056363' }} />
                      <div className="text-[16px] font-semibold text-black/70">Upload and analyze</div>
                    </div>
                    <div className="text-[14px] text-black/45 mt-1">Get snapshot highlights, risk scores, and per-cow recommendations.</div>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-black/5 p-4">
                    <div className="flex items-center gap-2">
                      <FaCheckCircle style={{ color: '#056363' }} />
                      <div className="text-[16px] font-semibold text-black/70">Take action early</div>
                    </div>
                    <div className="text-[14px] text-black/45 mt-1">Follow guidance quickly to reduce treatment delays and herd loss.</div>
                  </div>
                </div>
              </div>
            </MotionDiv>
          </div>
        </div>
      </div>

      {/* ════════ CTA section ════════ */}
      <section
        ref={ctaRef}
        className="relative z-10 flex min-h-screen items-center justify-center bg-black px-6"
        style={{ transform: 'translate3d(0,0,0)' }}
      >
        <MotionDiv
          className="text-center"
          style={{ opacity: ctaOpacity, scale: ctaScale, willChange: 'transform, opacity' }}
        >
          <div
            className="text-[56px] sm:text-[80px] lg:text-[120px] font-extrabold tracking-tight leading-[0.95]"
            style={{ color: '#65E4CF' }}
          >
            Start protecting
            <br />
            your herd.
          </div>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5">
            <Link
              to="/signup"
              className="rounded-full px-10 py-4 text-[18px] font-semibold text-black no-underline"
              style={{ backgroundColor: '#65E4CF' }}
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="rounded-full border-2 px-10 py-4 text-[18px] font-semibold no-underline"
              style={{ borderColor: '#65E4CF', color: '#65E4CF' }}
            >
              Log In
            </Link>
          </div>
        </MotionDiv>
      </section>

      {/* ════════ Footer ════════ */}
      <footer className="relative z-10 bg-black border-t border-white/10 py-8 px-6">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[14px] text-white/30">
            &copy; {new Date().getFullYear()} AgroCare. All rights reserved.
          </div>
          <div className="flex gap-6 text-[14px] text-white/30">
            <Link to="/login" className="hover:text-white/60 no-underline text-white/30">
              Log In
            </Link>
            <Link to="/signup" className="hover:text-white/60 no-underline text-white/30">
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
