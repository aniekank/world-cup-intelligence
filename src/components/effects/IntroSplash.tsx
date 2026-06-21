'use client';

import { useEffect, useState } from 'react';

/**
 * Opening flourish: a real striker strikes the set-piece ball; the purple ball
 * arcs off the boot (clear of his face) and rushes at the camera with a blurred
 * motion trail, filling the screen with a beat of impact-shake before the dark
 * curtain wipes it into the app. Plays once per browser session, click-to-skip,
 * reduced-motion safe.
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
    const t = setTimeout(() => setShow(false), 2800);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="wci-splash" onClick={() => setShow(false)} role="presentation">
      <style>{`
        .wci-splash{position:fixed;inset:-24px;z-index:120;overflow:hidden;cursor:pointer;
          background:radial-gradient(120% 120% at 50% 38%, #ffffff 0%, #efeaf7 64%, #e1d8f1 100%);
          animation:wciFade 2.8s ease forwards, wciShake 2.8s ease both;}
        .wci-speed{position:absolute;inset:0;z-index:1;opacity:0;
          background:repeating-conic-gradient(from 0deg at 50% 50%, transparent 0 5deg, rgba(86,25,143,.12) 5deg 6.2deg);
          -webkit-mask:radial-gradient(circle at 50% 50%, transparent 22%, #000 64%);
                  mask:radial-gradient(circle at 50% 50%, transparent 22%, #000 64%);
          animation:wciSpeed 2.8s ease forwards;}
        .wci-striker{position:absolute;z-index:2;left:50%;bottom:0;max-height:min(92vh,880px);max-width:92vw;width:auto;height:auto;
          transform-origin:50% 100%;animation:wciStriker 2.8s cubic-bezier(.2,.7,.3,1) forwards;
          -webkit-user-drag:none;user-select:none;}
        .wci-ground{position:absolute;z-index:3;left:0;right:0;bottom:0;height:21vh;opacity:0;
          background:
            repeating-linear-gradient(93deg, rgba(255,255,255,.05) 0 5%, rgba(0,0,0,.06) 5% 10%),
            linear-gradient(180deg, #57a83f 0%, #3a852d 46%, #21551a 100%);
          -webkit-mask:linear-gradient(180deg, transparent 0, #000 28%);
                  mask:linear-gradient(180deg, transparent 0, #000 28%);
          animation:wciGround 2.8s ease forwards;}
        .wci-word{position:absolute;z-index:3;left:0;right:0;top:7%;text-align:center;color:#1c1030;font-weight:800;
          letter-spacing:.2em;text-transform:uppercase;font-size:clamp(13px,2.4vmin,21px);animation:wciWord 2.8s ease forwards;}
        .wci-word small{display:block;margin-top:.5em;font-size:.6em;letter-spacing:.32em;color:#7c2fc7;}
        .wci-skip{position:absolute;z-index:3;right:16px;bottom:14px;color:#efeaf7;font-size:12px;letter-spacing:.06em;
          background:rgba(28,16,48,.55);padding:5px 11px;border-radius:999px;animation:wciWord 2.8s ease forwards;}
        .wci-curtain{position:absolute;inset:0;z-index:4;opacity:0;background:#0b0613;animation:wciCurtain 2.8s ease forwards;}
        .wci-flash{position:absolute;inset:0;z-index:5;opacity:0;
          background:radial-gradient(circle at 50% 50%, rgba(157,61,240,.95), rgba(86,25,143,.5) 30%, transparent 62%);
          animation:wciFlash 2.8s ease forwards;}
        .wci-ball{position:absolute;left:50%;top:50%;width:15vmin;height:15vmin;will-change:transform,opacity;
          clip-path:circle(39% at 50% 50%);
          animation:wciBallMove 2.8s cubic-bezier(.42,.05,.55,1) forwards, wciBallIn 2.8s ease forwards;}
        .wci-ball.lead{z-index:11;filter:drop-shadow(0 0 30px rgba(157,61,240,.6));}
        .wci-ball.t1{z-index:10;opacity:.66;filter:blur(3px);animation:wciBallMove 2.8s cubic-bezier(.42,.05,.55,1) 55ms both;}
        .wci-ball.t2{z-index:9;opacity:.54;filter:blur(5px);animation:wciBallMove 2.8s cubic-bezier(.42,.05,.55,1) 120ms both;}
        .wci-ball.t3{z-index:8;opacity:.43;filter:blur(8px);animation:wciBallMove 2.8s cubic-bezier(.42,.05,.55,1) 195ms both;}
        .wci-ball.t4{z-index:7;opacity:.32;filter:blur(11px);animation:wciBallMove 2.8s cubic-bezier(.42,.05,.55,1) 280ms both;}
        .wci-ball.t5{z-index:6;opacity:.22;filter:blur(15px);animation:wciBallMove 2.8s cubic-bezier(.42,.05,.55,1) 375ms both;}
        @keyframes wciFade{0%,93%{opacity:1}100%{opacity:0;visibility:hidden}}
        @keyframes wciShake{0%,80%{transform:translate(0,0)}
          82%{transform:translate(-9px,6px)}84%{transform:translate(8px,-7px)}86%{transform:translate(-6px,5px)}
          88%{transform:translate(4px,-3px)}90%{transform:translate(-3px,2px)}92%{transform:translate(2px,-1px)}
          94%,100%{transform:translate(0,0)}}
        @keyframes wciWord{0%,12%{opacity:0;transform:translateY(8px)}30%{opacity:1;transform:translateY(0)}66%{opacity:1}78%{opacity:0}}
        @keyframes wciSpeed{0%,22%{opacity:0}48%{opacity:.95}84%{opacity:.6}100%{opacity:0}}
        @keyframes wciCurtain{0%,78%{opacity:0}92%{opacity:1}100%{opacity:1}}
        @keyframes wciFlash{0%,82%{opacity:0}90%{opacity:.95}100%{opacity:0}}
        @keyframes wciStriker{0%{opacity:0;transform:translateX(-50%) scale(1.07)}12%{opacity:1}26%{transform:translateX(-50%) scale(1)}100%{opacity:1;transform:translateX(-50%) scale(1)}}
        @keyframes wciGround{0%{opacity:0}14%{opacity:1}100%{opacity:1}}
        @keyframes wciBallIn{0%{opacity:0}8%{opacity:1}100%{opacity:1}}
        @keyframes wciBallMove{
          0%{transform:translate(-50%,-50%) translate(-13vw,25vh) scale(.10) rotate(0)}
          8%{transform:translate(-50%,-50%) translate(-13vw,25vh) scale(.10) rotate(0)}      /* resting on the spot */
          16%{transform:translate(-50%,-50%) translate(-14vw,18vh) scale(.34) rotate(120deg)} /* struck off the boot */
          46%{transform:translate(-50%,-50%) translate(-12vw,10vh) scale(1.2) rotate(320deg)}  /* low, off to his side */
          74%{transform:translate(-50%,-50%) translate(-7vw,2vh) scale(4.0) rotate(620deg)}     /* rising past his shoulder */
          100%{transform:translate(-50%,-50%) translate(0,-1vh) scale(17) rotate(980deg)}}      /* at the camera, fills screen */
        @media (prefers-reduced-motion: reduce){.wci-splash{animation:wciFade .4s forwards}.wci-ball,.wci-striker,.wci-speed,.wci-flash,.wci-curtain{animation:none}.wci-ball.t1,.wci-ball.t2,.wci-ball.t3,.wci-ball.t4,.wci-ball.t5{display:none}}
      `}</style>

      <div className="wci-speed" />

      {/* Real striker, mid-set-piece */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-striker" src="/intro/striker.webp" alt="" aria-hidden="true" decoding="async" />

      {/* Grassy pitch band over the photo's gravel strip */}
      <div className="wci-ground" />

      <div className="wci-word">World Cup Intelligence<small>TASK Enterprises</small></div>
      <div className="wci-skip">tap to skip ›</div>

      {/* Dark curtain rises behind the ball so the purple wipes into the app */}
      <div className="wci-curtain" />
      <div className="wci-flash" />

      {/* Purple ball off the boot, straight at the camera — blurred trail ghosts behind a sharp lead */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-ball t5" src="/intro/ball.webp" alt="" aria-hidden="true" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-ball t4" src="/intro/ball.webp" alt="" aria-hidden="true" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-ball t3" src="/intro/ball.webp" alt="" aria-hidden="true" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-ball t2" src="/intro/ball.webp" alt="" aria-hidden="true" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-ball t1" src="/intro/ball.webp" alt="" aria-hidden="true" decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wci-ball lead" src="/intro/ball.webp" alt="" aria-hidden="true" decoding="async" />
    </div>
  );
}
