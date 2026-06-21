'use client';

import { useEffect, useState } from 'react';

/**
 * Opening flourish: a real striker stands over the set-piece ball and strikes
 * it; the purple ball arcs up off the boot (clear of his face) and rushes
 * straight at the camera, filling the screen — then a dark curtain rises behind
 * it so the purple "wipes" cleanly into the dark app (no white flash at the
 * handoff). Plays once per browser session, click-to-skip, reduced-motion safe.
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
    const t = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="wci-splash" onClick={() => setShow(false)} role="presentation">
      <style>{`
        .wci-splash{position:fixed;inset:0;z-index:120;overflow:hidden;cursor:pointer;
          background:radial-gradient(120% 120% at 50% 38%, #ffffff 0%, #efeaf7 64%, #e1d8f1 100%);
          animation:wciFade 2.5s ease forwards;}
        .wci-speed{position:absolute;inset:0;z-index:1;opacity:0;
          background:repeating-conic-gradient(from 0deg at 50% 50%, transparent 0 5.4deg, rgba(86,25,143,.10) 5.4deg 6.4deg);
          -webkit-mask:radial-gradient(circle at 50% 50%, transparent 24%, #000 64%);
                  mask:radial-gradient(circle at 50% 50%, transparent 24%, #000 64%);
          animation:wciSpeed 2.5s ease forwards;}
        .wci-striker{position:absolute;z-index:2;left:50%;bottom:0;max-height:min(92vh,880px);max-width:92vw;width:auto;height:auto;
          transform-origin:50% 100%;animation:wciStriker 2.5s cubic-bezier(.2,.7,.3,1) forwards;
          -webkit-user-drag:none;user-select:none;}
        .wci-word{position:absolute;z-index:3;left:0;right:0;top:7%;text-align:center;color:#1c1030;font-weight:800;
          letter-spacing:.2em;text-transform:uppercase;font-size:clamp(13px,2.4vmin,21px);animation:wciWord 2.5s ease forwards;}
        .wci-word small{display:block;margin-top:.5em;font-size:.6em;letter-spacing:.32em;color:#7c2fc7;}
        .wci-skip{position:absolute;z-index:3;right:16px;bottom:14px;color:#efeaf7;font-size:12px;letter-spacing:.06em;
          background:rgba(28,16,48,.55);padding:5px 11px;border-radius:999px;animation:wciWord 2.5s ease forwards;}
        .wci-curtain{position:absolute;inset:0;z-index:4;opacity:0;background:#0b0613;animation:wciCurtain 2.5s ease forwards;}
        .wci-flash{position:absolute;inset:0;z-index:5;opacity:0;
          background:radial-gradient(circle at 50% 50%, rgba(157,61,240,.95), rgba(86,25,143,.5) 30%, transparent 62%);
          animation:wciFlash 2.5s ease forwards;}
        .wci-ball{position:absolute;z-index:6;left:50%;top:50%;width:15vmin;height:15vmin;will-change:transform,opacity;
          clip-path:circle(39% at 50% 50%);
          animation:wciBall 2.5s cubic-bezier(.5,.02,.6,1) forwards;
          filter:drop-shadow(0 0 30px rgba(157,61,240,.6));}
        @keyframes wciFade{0%,93%{opacity:1}100%{opacity:0;visibility:hidden}}
        @keyframes wciWord{0%,12%{opacity:0;transform:translateY(8px)}30%{opacity:1;transform:translateY(0)}64%{opacity:1}76%{opacity:0}}
        @keyframes wciSpeed{0%,24%{opacity:0}50%{opacity:.8}84%{opacity:.5}100%{opacity:0}}
        @keyframes wciCurtain{0%,76%{opacity:0}92%{opacity:1}100%{opacity:1}}
        @keyframes wciFlash{0%,84%{opacity:0}92%{opacity:.85}100%{opacity:0}}
        @keyframes wciStriker{0%{opacity:0;transform:translateX(-50%) scale(1.07)}12%{opacity:1}26%{transform:translateX(-50%) scale(1)}100%{opacity:1;transform:translateX(-50%) scale(1)}}
        @keyframes wciBall{
          0%{opacity:0;transform:translate(-50%,-50%) translate(-13vw,25vh) scale(.10) rotate(0)}
          7%{opacity:1;transform:translate(-50%,-50%) translate(-13vw,25vh) scale(.10) rotate(0)}    /* resting on the spot */
          15%{transform:translate(-50%,-50%) translate(-14vw,18vh) scale(.34) rotate(120deg)}         /* struck off the boot */
          42%{transform:translate(-50%,-50%) translate(-12vw,11vh) scale(1.1) rotate(300deg)}         /* low, off to his side */
          68%{transform:translate(-50%,-50%) translate(-7vw,3vh) scale(3.4) rotate(560deg)}           /* rising past his shoulder */
          100%{opacity:1;transform:translate(-50%,-50%) translate(0,-1vh) scale(16) rotate(900deg)}}  /* at the camera, fills screen */
        @media (prefers-reduced-motion: reduce){.wci-splash{animation:wciFade .4s forwards}.wci-ball,.wci-striker,.wci-speed,.wci-flash,.wci-curtain{animation:none}}
      `}</style>

      <div className="wci-speed" />

      {/* Real striker, mid-set-piece */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-striker" src="/intro/striker.webp" alt="" aria-hidden="true" decoding="async" />

      <div className="wci-word">World Cup Intelligence<small>TASK Enterprises</small></div>
      <div className="wci-skip">tap to skip ›</div>

      {/* Dark curtain rises behind the ball so the purple wipes into the app */}
      <div className="wci-curtain" />
      <div className="wci-flash" />

      {/* Purple ball off the boot, straight at the camera */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-ball" src="/intro/ball.webp" alt="" aria-hidden="true" decoding="async" />
    </div>
  );
}
