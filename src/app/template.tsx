/**
 * Route template — Next.js remounts this on every navigation, so the `page-in`
 * animation (fade + rise) replays as the user moves between pages. Pure CSS,
 * disabled under prefers-reduced-motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
