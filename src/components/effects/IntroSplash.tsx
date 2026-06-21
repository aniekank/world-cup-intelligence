'use client';

import { useEffect, useState } from 'react';

/**
 * Opening flourish: a duotone player strikes a purple ball that flies at the
 * screen, then the overlay fades to reveal the app. Plays once per browser
 * session, is click-to-skip, and is skipped entirely under prefers-reduced-motion.
 */
export function IntroSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Decide on the client so there's no SSR flash / hydration mismatch.
    try {
      if (sessionStorage.getItem('wci-intro-seen')) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        sessionStorage.setItem('wci-intro-seen', '1');
        return;
      }
      sessionStorage.setItem('wci-intro-seen', '1');
    } catch {
      /* storage blocked — just play it */
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="wci-splash" onClick={() => setShow(false)} role="presentation">
      <style>{`
        .wci-splash{position:fixed;inset:0;z-index:120;overflow:hidden;cursor:pointer;
          background:radial-gradient(120% 120% at 60% 45%, #1a0f2e 0%, #0b0613 60%);
          animation:wciFade 2.6s ease forwards;}
        .wci-splash .halo{position:absolute;left:50%;top:50%;width:62vmin;height:62vmin;
          transform:translate(-50%,-50%);border-radius:50%;
          background:radial-gradient(circle, rgba(157,61,240,.35), transparent 62%);
          filter:blur(8px);animation:wciHalo 2.6s ease forwards;}
        .wci-splash .dots{position:absolute;inset:0;opacity:.18;
          background-image:radial-gradient(rgba(157,61,240,.9) 1.1px, transparent 1.2px);
          background-size:16px 16px;}
        .wci-player{position:absolute;left:14%;bottom:14%;width:min(34vmin,260px);
          transform-origin:bottom left;animation:wciPlayer 2.6s cubic-bezier(.2,.7,.3,1) forwards;
          filter:drop-shadow(0 6px 18px rgba(31,229,196,.25));}
        .wci-ball{position:absolute;left:50%;top:50%;width:18vmin;height:18vmin;will-change:transform,opacity;
          animation:wciBall 2.6s cubic-bezier(.45,.02,.55,1) forwards;
          filter:drop-shadow(0 0 26px rgba(157,61,240,.6));}
        .wci-word{position:absolute;left:0;right:0;top:14%;text-align:center;
          color:#f6f1ff;font-weight:800;letter-spacing:.18em;text-transform:uppercase;
          font-size:clamp(13px,2.4vmin,20px);animation:wciWord 2.6s ease forwards;}
        .wci-word small{display:block;margin-top:.5em;font-size:.6em;letter-spacing:.3em;color:#9d3df0;}
        .wci-skip{position:absolute;right:18px;bottom:16px;color:#7a6b95;font-size:12px;letter-spacing:.08em;
          animation:wciWord 2.6s ease forwards;}
        @keyframes wciFade{0%,80%{opacity:1}100%{opacity:0;visibility:hidden}}
        @keyframes wciHalo{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}24%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.6)}}
        @keyframes wciWord{0%,16%{opacity:0;transform:translateY(10px)}34%{opacity:1;transform:translateY(0)}70%{opacity:1}100%{opacity:0}}
        @keyframes wciPlayer{0%{opacity:0;transform:translateX(-40px) rotate(-3deg)}
          22%{opacity:1;transform:translateX(0) rotate(-3deg)}
          30%{transform:translateX(0) rotate(2deg)}        /* strike / recoil */
          44%{transform:translateX(0) rotate(0deg)}
          80%{opacity:1}100%{opacity:0}}
        @keyframes wciBall{
          0%{opacity:0;transform:translate(-50%,-50%) translate(-20vw,9vh) scale(.18) rotate(0deg)}
          14%{opacity:1;transform:translate(-50%,-50%) translate(-17vw,8vh) scale(.22) rotate(20deg)}
          26%{transform:translate(-50%,-50%) translate(-14vw,6vh) scale(.34) rotate(120deg)}  /* kicked */
          100%{opacity:1;transform:translate(-50%,-50%) translate(4vw,8vh) scale(8) rotate(680deg)}}
        @media (prefers-reduced-motion: reduce){.wci-splash{animation:wciFade .4s forwards}}
      `}</style>

      <div className="dots" />
      <div className="halo" />

      <div className="wci-word">World Cup Intelligence<small>TASK Enterprises</small></div>

      {/* Duotone striker, mid-kick, facing the ball */}
      <svg className="wci-player" viewBox="0 0 220 260" aria-hidden="true">
        <g stroke="#1fe5c4" strokeWidth="14" strokeLinecap="round" fill="none">
          <path d="M78 72 L110 140" />
          <path d="M110 140 L88 212 L80 236" />
          <path d="M110 140 L170 150 L198 140" />
          <path d="M88 88 L52 108" />
          <path d="M88 88 L122 62" />
        </g>
        <circle cx="72" cy="48" r="19" fill="#1fe5c4" />
        {/* duotone shadow split */}
        <g stroke="#0b0613" strokeOpacity="0.22" strokeWidth="14" strokeLinecap="round" fill="none">
          <path d="M110 140 L88 212 L80 236" />
        </g>
      </svg>

      {/* Purple soccer ball */}
      <svg className="wci-ball" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id="wciBallG" cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#cda6ff" />
            <stop offset="44%" stopColor="#9d3df0" />
            <stop offset="100%" stopColor="#56198f" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#wciBallG)" stroke="#34115e" strokeWidth="2" />
        <polygon points="50,29 65,40 59,58 41,58 35,40" fill="#280d49" />
        <g stroke="#280d49" strokeWidth="2.6" fill="none" strokeLinejoin="round">
          <path d="M50 29 L50 10" />
          <path d="M65 40 L84 33" />
          <path d="M59 58 L71 74" />
          <path d="M41 58 L29 74" />
          <path d="M35 40 L16 33" />
        </g>
        <ellipse cx="37" cy="33" rx="12" ry="8" fill="#ffffff" opacity="0.22" />
      </svg>

      <div className="wci-skip">tap to skip ›</div>
    </div>
  );
}
