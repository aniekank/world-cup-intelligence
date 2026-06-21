'use client';

import { useEffect, useState } from 'react';

/**
 * Opening flourish: a player stands over a set-piece ball and strikes it dead
 * at the camera — the purple ball grows to fill the screen, then the overlay
 * fades to reveal the app. Plays once per browser session, is click-to-skip,
 * and is reduced to a quick fade under prefers-reduced-motion.
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
    const t = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="wci-splash" onClick={() => setShow(false)} role="presentation">
      <style>{`
        .wci-splash{position:fixed;inset:0;z-index:120;overflow:hidden;cursor:pointer;
          background:radial-gradient(120% 130% at 50% 58%, #1c1030 0%, #0b0613 62%);
          animation:wciFade 2.8s ease forwards;}
        .wci-splash .dots{position:absolute;inset:0;opacity:.16;
          background-image:radial-gradient(rgba(157,61,240,.9) 1.1px, transparent 1.2px);background-size:17px 17px;}
        .wci-speed{position:absolute;inset:0;opacity:0;
          background:repeating-conic-gradient(from 0deg at 50% 50%, transparent 0 5.4deg, rgba(157,61,240,.20) 5.4deg 6.4deg);
          -webkit-mask:radial-gradient(circle at 50% 50%, transparent 26%, #000 62%);
                  mask:radial-gradient(circle at 50% 50%, transparent 26%, #000 62%);
          animation:wciSpeed 2.8s ease forwards;}
        .wci-flash{position:absolute;inset:0;opacity:0;
          background:radial-gradient(circle at 50% 50%, rgba(205,166,255,.95), rgba(157,61,240,.35) 28%, transparent 60%);
          animation:wciFlash 2.8s ease forwards;}
        .wci-player{position:absolute;left:9%;bottom:11%;width:min(40vmin,330px);
          transform-origin:42% 92%;animation:wciPlayer 2.8s cubic-bezier(.2,.7,.3,1) forwards;
          filter:drop-shadow(0 8px 22px rgba(31,229,196,.28));}
        .wci-ball{position:absolute;left:50%;top:50%;width:17vmin;height:17vmin;will-change:transform,opacity;
          animation:wciBall 2.8s cubic-bezier(.5,.02,.62,1) forwards;
          filter:drop-shadow(0 0 30px rgba(157,61,240,.65));}
        .wci-word{position:absolute;left:0;right:0;top:11%;text-align:center;color:#f6f1ff;font-weight:800;
          letter-spacing:.2em;text-transform:uppercase;font-size:clamp(13px,2.4vmin,20px);animation:wciWord 2.8s ease forwards;}
        .wci-word small{display:block;margin-top:.5em;font-size:.6em;letter-spacing:.32em;color:#9d3df0;}
        .wci-skip{position:absolute;right:18px;bottom:16px;color:#7a6b95;font-size:12px;letter-spacing:.08em;animation:wciWord 2.8s ease forwards;}
        @keyframes wciFade{0%,86%{opacity:1}100%{opacity:0;visibility:hidden}}
        @keyframes wciWord{0%,14%{opacity:0;transform:translateY(10px)}32%{opacity:1;transform:translateY(0)}72%{opacity:1}100%{opacity:0}}
        @keyframes wciSpeed{0%,26%{opacity:0}48%{opacity:.75}82%{opacity:.5}100%{opacity:0}}
        @keyframes wciFlash{0%,82%{opacity:0}91%{opacity:.9}100%{opacity:0}}
        @keyframes wciPlayer{
          0%{opacity:0;transform:translateX(-46px) rotate(-2deg)}
          12%{opacity:1;transform:translateX(0) rotate(-5deg)}   /* planted over the ball, leaning back */
          24%{transform:translateX(0) rotate(8deg)}               /* swing through — the strike */
          38%{transform:translateX(0) rotate(1deg)}               /* follow-through */
          86%{opacity:1}100%{opacity:0}}
        @keyframes wciBall{
          0%{opacity:0;transform:translate(-50%,-50%) translate(-11vw,17vh) scale(.16) rotate(0)}
          8%{opacity:1;transform:translate(-50%,-50%) translate(-11vw,17vh) scale(.16) rotate(0)}    /* dead ball, resting */
          22%{opacity:1;transform:translate(-50%,-50%) translate(-11vw,17vh) scale(.17) rotate(6deg)} /* the moment before the strike */
          30%{transform:translate(-50%,-50%) translate(-8vw,12vh) scale(.30) rotate(140deg)}          /* struck — off the ground */
          100%{opacity:1;transform:translate(-50%,-50%) translate(0,-1vh) scale(14) rotate(960deg)}}  /* dead at the camera */
        @media (prefers-reduced-motion: reduce){.wci-splash{animation:wciFade .4s forwards}}
      `}</style>

      <div className="dots" />
      <div className="wci-speed" />

      <div className="wci-word">World Cup Intelligence<small>TASK Enterprises</small></div>

      {/* Striker over the dead ball, swinging through */}
      <svg className="wci-player" viewBox="0 0 240 300" aria-hidden="true">
        <g stroke="#1fe5c4" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M112 150 L98 212 L106 276" />
          <path d="M120 150 L162 176 L198 196" />
          <path d="M86 78 L56 60 L36 66" />
          <path d="M104 80 L132 100 L152 92" />
        </g>
        <path d="M76 60 Q100 50 110 64 L126 150 Q104 162 92 152 Z" fill="#1fe5c4" />
        <circle cx="92" cy="44" r="21" fill="#1fe5c4" />
        <ellipse cx="108" cy="278" rx="16" ry="9" fill="#1fe5c4" />
        <ellipse cx="202" cy="198" rx="17" ry="9" fill="#1fe5c4" transform="rotate(18 202 198)" />
        <path d="M112 150 L98 212 L106 276" stroke="#0b0613" strokeOpacity="0.2" strokeWidth="22" strokeLinecap="round" fill="none" />
      </svg>

      {/* Purple set-piece ball */}
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

      <div className="wci-flash" />
      <div className="wci-skip">tap to skip ›</div>
    </div>
  );
}
