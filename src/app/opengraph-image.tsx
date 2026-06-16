import { ImageResponse } from 'next/og';

export const alt = 'WC26 Intelligence — World Cup Analytics Terminal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Satori (the OG renderer) supports linear-gradient and simple radial-gradient
// only — no multi-position "circle at X%" syntax — so the background is built
// from layered linear-gradient panels.
export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#0b0613',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            background: 'linear-gradient(135deg, #ff2e9a 0%, #9d3df0 38%, #1fe5c4 72%, #a8e020 100%)',
            opacity: 0.22,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            background: 'radial-gradient(circle, rgba(11,6,19,0) 30%, rgba(11,6,19,0.85) 100%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 72,
            width: '100%',
            height: '100%',
            color: '#f6f1ff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                background: 'linear-gradient(135deg, #ff2e9a, #9d3df0, #1fe5c4, #a8e020)',
              }}
            >
              🏆
            </div>
            <div style={{ display: 'flex', fontSize: 28, letterSpacing: 8, color: '#1fe5c4', fontWeight: 700 }}>
              ANALYTICS TERMINAL
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 96, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>
              WC26 Intelligence
            </div>
            <div style={{ display: 'flex', fontSize: 34, color: '#9683b5', marginTop: 16, maxWidth: 940 }}>
              Live analytics · Monte Carlo predictions · AI insights for the 2026 World Cup
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            {['xG & Advanced Stats', '8,000 Simulations', 'Natural-Language Search'].map((t) => (
              <div
                key={t}
                style={{
                  display: 'flex',
                  fontSize: 24,
                  padding: '10px 22px',
                  borderRadius: 999,
                  border: '1px solid #2e1f47',
                  color: '#d9cdef',
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
