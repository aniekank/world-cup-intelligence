'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NAV, SECTION_LABEL, type NavItem } from './nav';
import { BrandMark } from '@/components/brand/BrandMark';
import { cn } from '@/lib/utils';

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections: NavItem['section'][] = ['main', 'analyze', 'discover'];

  return (
    <nav className="flex flex-col gap-6 px-3 py-4">
      {sections.map((section) => (
        <div key={section}>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
            {SECTION_LABEL[section]}
          </p>
          <ul className="space-y-0.5">
            {NAV.filter((n) => n.section === section).map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-accent/10 text-accent shadow-[inset_2px_0_0_0_#1fe5c4]'
                        : 'text-terminal-text hover:bg-terminal-elevated hover:text-terminal-bright',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge === 'live' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-accent-red">
                        <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent-red" />
                        Live
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-md border border-terminal-border bg-terminal-panel p-2 text-terminal-text lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-terminal-border lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="glass absolute inset-y-0 left-0 flex w-64 flex-col border-r border-terminal-border">
            <div className="flex items-center justify-between">
              <Brand />
              <button aria-label="Close" onClick={() => setOpen(false)} className="mr-3 text-terminal-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 border-b border-terminal-border px-5 py-4">
      <BrandMark size={30} className="animate-spinSlow" />
      <div className="leading-tight">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-terminal-muted">TASK Enterprises presents</p>
        <p className="text-manifesto-anim text-sm font-extrabold tracking-tight">World Cup Intelligence</p>
        <p className="text-[10px] uppercase tracking-widest text-accent">Analytics Terminal</p>
      </div>
    </Link>
  );
}
