import { cn } from '@/lib/utils';

/**
 * A small "?" badge that reveals a plain-language explanation on hover/focus.
 * CSS-only (no client JS) so it works inside Server Components. Place it in
 * non-clipping regions — panel titles/subtitles, headings — not inside the
 * scrolling table body, which would crop the popover.
 */
export function InfoTip({
  children,
  label = 'More information',
  wide,
  className,
}: {
  children: React.ReactNode;
  label?: string;
  wide?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('group/tip relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={label}
        className="ml-1 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-terminal-border text-[9px] font-bold leading-none text-terminal-muted transition-colors hover:border-accent hover:text-accent focus:border-accent focus:text-accent focus:outline-none"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 translate-y-1 rounded-lg border border-terminal-border bg-terminal-elevated px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-terminal-text opacity-0 shadow-xl transition-all duration-150 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100',
          wide ? 'w-72' : 'w-56',
        )}
      >
        {children}
      </span>
    </span>
  );
}
