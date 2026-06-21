'use client';

import { useEffect, useState } from 'react';

/**
 * Opening flourish: a real striker (photo) stands over the spot and the purple
 * ball launches off his boot straight at the camera, growing to fill the screen
 * before the overlay wipes to the dark app. Plays once per browser session, is
 * click-to-skip, and is reduced to a quick fade under prefers-reduced-motion.
 */
export function IntroSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
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
          background:radial-gradient(120% 120% at 50% 38%, #ffffff 0%, #efeaf7 64%, #e1d8f1 100%);
          animation:wciFade 3s ease forwards;}
        .wci-speed{position:absolute;inset:0;opacity:0;
          background:repeating-conic-gradient(from 0deg at 50% 50%, transparent 0 5.4deg, rgba(86,25,143,.10) 5.4deg 6.4deg);
          -webkit-mask:radial-gradient(circle at 50% 50%, transparent 24%, #000 64%);
                  mask:radial-gradient(circle at 50% 50%, transparent 24%, #000 64%);
          animation:wciSpeed 3s ease forwards;}
        .wci-striker{position:absolute;left:50%;bottom:0;max-height:min(92vh,880px);max-width:92vw;width:auto;height:auto;
          transform-origin:50% 100%;animation:wciStriker 3s cubic-bezier(.2,.7,.3,1) forwards;
          -webkit-user-drag:none;user-select:none;}
        .wci-ball{position:absolute;left:50%;top:50%;width:15vmin;height:15vmin;will-change:transform,opacity;
          animation:wciBall 3s cubic-bezier(.5,.02,.6,1) forwards;
          filter:drop-shadow(0 0 28px rgba(86,25,143,.5));}
        .wci-flash{position:absolute;inset:0;opacity:0;
          background:radial-gradient(circle at 50% 50%, rgba(157,61,240,.95), rgba(86,25,143,.5) 30%, transparent 62%);
          animation:wciFlash 3s ease forwards;}
        .wci-word{position:absolute;left:0;right:0;top:7%;text-align:center;color:#1c1030;font-weight:800;
          letter-spacing:.2em;text-transform:uppercase;font-size:clamp(13px,2.4vmin,21px);animation:wciWord 3s ease forwards;z-index:2;}
        .wci-word small{display:block;margin-top:.5em;font-size:.6em;letter-spacing:.32em;color:#7c2fc7;}
        .wci-skip{position:absolute;right:18px;bottom:16px;color:#6b5a85;font-size:12px;letter-spacing:.08em;animation:wciWord 3s ease forwards;z-index:2;}
        @keyframes wciFade{0%,88%{opacity:1}100%{opacity:0;visibility:hidden}}
        @keyframes wciWord{0%,12%{opacity:0;transform:translateY(8px)}30%{opacity:1;transform:translateY(0)}74%{opacity:1}100%{opacity:0}}
        @keyframes wciSpeed{0%,22%{opacity:0}46%{opacity:.85}82%{opacity:.55}100%{opacity:0}}
        @keyframes wciFlash{0%,82%{opacity:0}91%{opacity:.85}100%{opacity:0}}
        @keyframes wciStriker{0%{opacity:0;transform:translateX(-50%) scale(1.07)}12%{opacity:1}28%{transform:translateX(-50%) scale(1)}88%{opacity:1}100%{opacity:0}}
        @keyframes wciBall{
          0%{opacity:0;transform:translate(-50%,-50%) translate(-13vw,25vh) scale(.10) rotate(0)}
          7%{opacity:1;transform:translate(-50%,-50%) translate(-13vw,25vh) scale(.10) rotate(0)}    /* off the boot */
          16%{transform:translate(-50%,-50%) translate(-10vw,16vh) scale(.26) rotate(150deg)}         /* launched */
          100%{opacity:1;transform:translate(-50%,-50%) translate(0,-1vh) scale(15) rotate(940deg)}}  /* at the camera */
        @media (prefers-reduced-motion: reduce){.wci-splash{animation:wciFade .4s forwards}.wci-ball,.wci-striker,.wci-speed,.wci-flash{animation:none}}
      `}</style>

      <div className="wci-speed" />

      <div className="wci-word">World Cup Intelligence<small>TASK Enterprises</small></div>

      {/* Real striker, mid-set-piece */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-striker" src="/intro/striker.png" alt="" aria-hidden="true" decoding="async" />

      {/* Purple ball off the boot, straight at the camera */}
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
