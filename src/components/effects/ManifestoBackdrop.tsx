/**
 * Living background — drifting, blurred gradient blobs in the cover palette,
 * overlaid with an animated halftone dot veil and a vignette. Pure CSS
 * animation (transform/opacity only); pauses under prefers-reduced-motion.
 * Rendered once at the app root, fixed behind all content.
 */
export function ManifestoBackdrop() {
  return (
    <div className="manifesto-backdrop" aria-hidden>
      <span
        className="manifesto-blob animate-blobA"
        style={{ width: '46vw', height: '46vw', top: '-12vh', left: '-8vw', background: 'radial-gradient(circle, #ff2e9a, transparent 70%)' }}
      />
      <span
        className="manifesto-blob animate-blobB"
        style={{ width: '42vw', height: '42vw', top: '-6vh', right: '-10vw', background: 'radial-gradient(circle, #9d3df0, transparent 70%)' }}
      />
      <span
        className="manifesto-blob animate-blobC"
        style={{ width: '50vw', height: '50vw', bottom: '-20vh', left: '20vw', background: 'radial-gradient(circle, #1fe5c4, transparent 70%)' }}
      />
      <span
        className="manifesto-blob animate-blobA"
        style={{ width: '32vw', height: '32vw', bottom: '-14vh', right: '-6vw', background: 'radial-gradient(circle, #a8e020, transparent 72%)', opacity: 0.3, animationDelay: '-8s' }}
      />
      <span className="veil" />
      <span className="vignette" />
    </div>
  );
}
