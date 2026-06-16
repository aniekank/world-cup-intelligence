import Link from 'next/link';
import { cn } from '@/lib/utils';
import { GrowBar, ProbSplitFill } from './AnimatedBar';

// ── Card / Panel ─────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('glass rounded-lg border border-terminal-border', className)}>{children}</div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-terminal-border px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-terminal-bright">{title}</h2>}
            {subtitle && <p className="text-xs text-terminal-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </Card>
  );
}

// ── Section heading ──────────────────────────────────────────
export function PageHeader({
  title,
  description,
  kicker,
  action,
}: {
  title: React.ReactNode;
  description?: string;
  kicker?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker && <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-accent">{kicker}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-terminal-bright">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-terminal-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Stat tile ────────────────────────────────────────────────
export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-elevated px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-terminal-muted">{label}</p>
      <p className="tnum mt-1 text-2xl font-bold text-terminal-bright" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sub && <p className="tnum mt-0.5 text-xs text-terminal-muted">{sub}</p>}
    </div>
  );
}

// ── Badge / Pill ─────────────────────────────────────────────
const badgeTones = {
  default: 'border-terminal-border text-terminal-text',
  accent: 'border-accent/40 bg-accent/10 text-accent',
  amber: 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber',
  red: 'border-accent-red/40 bg-accent-red/10 text-accent-red',
  blue: 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue',
  violet: 'border-accent-violet/40 bg-accent-violet/10 text-accent-violet',
} as const;

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof badgeTones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot() {
  return <span className="inline-block h-2 w-2 animate-pulseDot rounded-full bg-accent-red" />;
}

// ── Progress / metric bar ────────────────────────────────────
export function MetricBar({
  value,
  max = 100,
  color,
  height = 6,
  showValue,
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  showValue?: boolean;
  label?: string;
}) {
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-xs text-terminal-muted">
          <span>{label}</span>
          {showValue && <span className="tnum text-terminal-text">{value}</span>}
        </div>
      )}
      <GrowBar value={value} max={max} color={color} height={height} />
    </div>
  );
}

// ── Probability split bar (home/draw/away) ───────────────────
export function ProbBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  return (
    <ProbSplitFill home={home} draw={draw} away={away} />
  );
}

// ── Team badge ───────────────────────────────────────────────
export function TeamBadge({
  team,
  size = 'md',
  href,
  showName = true,
}: {
  team: { id: string; name: string; code: string; flag: string };
  size?: 'sm' | 'md' | 'lg';
  href?: boolean;
  showName?: boolean;
}) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' };
  const content = (
    <span className="inline-flex items-center gap-2">
      <span className={sizes[size]}>{team.flag}</span>
      {showName && <span className="font-medium text-terminal-bright">{team.name}</span>}
    </span>
  );
  return href ? (
    <Link href={`/teams/${team.id}`} className="hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}

// ── Form string (W/D/L pills) ────────────────────────────────
export function FormString({ form }: { form: string[] }) {
  const colors: Record<string, string> = { W: 'bg-accent text-terminal-bg', D: 'bg-terminal-muted text-terminal-bg', L: 'bg-accent-red text-white' };
  return (
    <div className="flex gap-1">
      {form.length === 0 && <span className="text-xs text-terminal-muted">—</span>}
      {form.map((f, i) => (
        <span
          key={i}
          className={cn('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', colors[f])}
        >
          {f}
        </span>
      ))}
    </div>
  );
}

// ── Empty / hint ─────────────────────────────────────────────
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-terminal-border px-6 py-10 text-center text-sm text-terminal-muted">
      {children}
    </div>
  );
}

// ── Data table primitives ────────────────────────────────────
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}
export function Th({ children, className, align = 'left' }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={cn(
        'border-b border-terminal-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-terminal-muted',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </th>
  );
}
export function Td({ children, className, align = 'left' }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'border-b border-terminal-border/60 px-3 py-2 text-terminal-text',
        align === 'right' && 'tnum text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}
