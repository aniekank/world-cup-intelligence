'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { wcHistory } from '@/data/wcHistory';
import { X, Loader2, Trophy } from 'lucide-react';

// react-globe.gl touches window/WebGL — load it client-only.
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

export interface GlobeNation {
  id: string;
  code: string;
  name: string;
  flag: string;
  color: string;
  group: string | null;
  confederation: string;
  manager: string;
}

interface SquadPlayer {
  id: string;
  name: string;
  position: string;
  detailedPosition: string;
  shirtNumber: number;
  stats: { goals: number; assists: number; minutes: number };
}

// Normalize a country name and resolve aliases so our nations match the atlas.
function keyFor(name: string): string {
  const n = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, '')
    .trim();
  const alias: Record<string, string> = {
    'united states of america': 'usa', 'united states': 'usa', usa: 'usa',
    'united kingdom': 'england', england: 'england',
    'south korea': 'south korea', 'korea republic': 'south korea', 'republic of korea': 'south korea', 'korea rep': 'south korea',
    czechia: 'czechia', 'czech republic': 'czechia',
    turkey: 'turkey', turkiye: 'turkey',
    'ivory coast': 'ivory coast', 'cote divoire': 'ivory coast',
    'bosnia and herz': 'bosnia', 'bosnia and herzegovina': 'bosnia', 'bosnia  herzegovina': 'bosnia',
    'dem rep congo': 'dr congo', 'congo dr': 'dr congo', 'dr congo': 'dr congo',
    'cabo verde': 'cape verde', 'cape verde islands': 'cape verde', 'cape verde': 'cape verde',
    russia: 'russia', 'russian federation': 'russia',
    iran: 'iran', 'islamic republic of iran': 'iran',
  };
  return alias[n] ?? n;
}

export function GlobeExplorer({ nations }: { nations: GlobeNation[] }) {
  const globeRef = useRef<{ controls: () => { autoRotate: boolean; autoRotateSpeed: number }; pointOfView: (p: object, ms?: number) => void } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<{ properties: { name: string } }[]>([]);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [selected, setSelected] = useState<GlobeNation | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[] | null>(null);
  const [loadingSquad, setLoadingSquad] = useState(false);

  const nationByKey = useMemo(() => {
    const m = new Map<string, GlobeNation>();
    for (const n of nations) m.set(keyFor(n.name), n);
    return m;
  }, [nations]);

  // Load country polygons
  useEffect(() => {
    fetch('/world-countries.json')
      .then((r) => r.json())
      .then((topo) => {
        const geo = feature(topo, topo.objects.countries) as unknown as { features: { properties: { name: string } }[] };
        setFeatures(geo.features);
      })
      .catch(() => {});
  }, []);

  // Responsive sizing
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Auto-rotate + framing
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !features.length) return;
    const c = g.controls();
    c.autoRotate = true;
    c.autoRotateSpeed = 0.45;
    g.pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 0);
  }, [features.length]);

  const dark = useMemo(() => new THREE.MeshPhongMaterial({ color: '#120c20', emissive: '#0a0612', shininess: 6 }), []);

  const capColor = (f: { properties: { name: string } }) => {
    const n = nationByKey.get(keyFor(f.properties.name));
    if (!n) return 'rgba(45,31,71,0.55)';
    return n.id === selected?.id ? n.color : `${n.color}cc`;
  };

  const select = (f: { properties: { name: string } }) => {
    const n = nationByKey.get(keyFor(f.properties.name));
    if (!n) return;
    setSelected(n);
    setSquad(null);
    setLoadingSquad(true);
    const c = globeRef.current?.controls();
    if (c) c.autoRotate = false;
    fetch(`/api/teams/${n.id}`)
      .then((r) => r.json())
      .then((j) => setSquad(j.data?.squad ?? []))
      .finally(() => setLoadingSquad(false));
  };

  const close = () => {
    setSelected(null);
    const c = globeRef.current?.controls();
    if (c) c.autoRotate = true;
  };

  return (
    <div className="relative h-[78vh] min-h-[520px] overflow-hidden rounded-2xl border border-terminal-border">
      <div ref={wrapRef} className="absolute inset-0">
        {features.length > 0 && (
          <Globe
            ref={globeRef as never}
            width={size.w}
            height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            globeMaterial={dark as never}
            showAtmosphere
            atmosphereColor="#1fe5c4"
            atmosphereAltitude={0.16}
            polygonsData={features as never}
            polygonCapColor={capColor as never}
            polygonSideColor={() => 'rgba(31,229,196,0.06)'}
            polygonStrokeColor={() => 'rgba(120,90,170,0.35)'}
            polygonAltitude={((f: { properties: { name: string } }) => (nationByKey.has(keyFor(f.properties.name)) ? (selected && nationByKey.get(keyFor(f.properties.name))?.id === selected.id ? 0.12 : 0.05) : 0.008)) as never}
            polygonLabel={((f: { properties: { name: string } }) => {
              const n = nationByKey.get(keyFor(f.properties.name));
              return n ? `<div style="font:600 12px sans-serif;color:#f6f1ff">${n.flag} ${n.name}</div>` : '';
            }) as never}
            onPolygonClick={select as never}
            polygonsTransitionDuration={300}
          />
        )}
        {features.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-terminal-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering globe…
          </div>
        )}
      </div>

      {/* Hint */}
      {!selected && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-terminal-border bg-terminal-panel/70 px-4 py-1.5 text-xs text-terminal-muted backdrop-blur">
          Drag to rotate · scroll to zoom · click a highlighted nation
        </div>
      )}

      {/* Country detail panel */}
      {selected && (
        <CountryPanel nation={selected} squad={squad} loading={loadingSquad} onClose={close} />
      )}
    </div>
  );
}

function CountryPanel({ nation, squad, loading, onClose }: { nation: GlobeNation; squad: SquadPlayer[] | null; loading: boolean; onClose: () => void }) {
  const h = wcHistory(nation.code);
  const positions = ['GK', 'DF', 'MF', 'FW'] as const;
  return (
    <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-terminal-border bg-terminal-bg/92 backdrop-blur-xl sm:w-[26rem]">
      <div className="flex items-center justify-between border-b border-terminal-border p-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{nation.flag}</span>
          <div>
            <h2 className="text-lg font-bold text-terminal-bright">{nation.name}</h2>
            <p className="text-xs text-terminal-muted">
              {nation.confederation}
              {nation.group ? ` · Group ${nation.group}` : ''}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-terminal-muted hover:text-terminal-bright">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* WC history */}
        <section className="rounded-lg border border-terminal-border bg-terminal-elevated p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-amber">
            <Trophy className="h-3.5 w-3.5" /> World Cup History
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Titles" value={String(h.titles)} accent={h.titles > 0 ? '#ffb020' : undefined} />
            <Mini label="Runners-up" value={String(h.runnerUp)} />
            <Mini label="First" value={h.firstAppearance ? String(h.firstAppearance) : '—'} />
          </div>
          <p className="mt-2 text-sm text-terminal-text">
            Best: <span className="font-medium text-terminal-bright">{h.bestFinish}</span>
            {h.titleYears.length > 0 && <span className="text-terminal-muted"> · Won {h.titleYears.join(', ')}</span>}
          </p>
        </section>

        {/* Coach */}
        <section className="rounded-lg border border-terminal-border bg-terminal-elevated p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Head Coach</p>
          <p className="mt-1 text-sm font-medium text-terminal-bright">
            {nation.manager && nation.manager !== '—' ? nation.manager : 'Not available on this feed'}
          </p>
        </section>

        {/* Squad */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">Squad</p>
            <Link href={`/teams/${nation.id}`} className="text-xs text-accent hover:underline">
              Full profile →
            </Link>
          </div>
          {loading && (
            <p className="flex items-center gap-2 text-sm text-terminal-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading squad…
            </p>
          )}
          {!loading && squad && squad.length === 0 && <p className="text-sm text-terminal-muted">No squad data on this feed.</p>}
          {!loading && squad && squad.length > 0 && (
            <div className="space-y-3">
              {positions.map((pos) => {
                const group = squad.filter((p) => p.position === pos);
                if (!group.length) return null;
                const label = { GK: 'Goalkeepers', DF: 'Defenders', MF: 'Midfielders', FW: 'Forwards' }[pos];
                return (
                  <div key={pos}>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-terminal-muted">{label}</p>
                    <div className="space-y-0.5">
                      {group.map((p) => (
                        <Link
                          key={p.id}
                          href={`/players/${p.id}`}
                          className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-terminal-elevated"
                        >
                          <span className="tnum w-6 text-xs text-terminal-muted">{p.shirtNumber || '·'}</span>
                          <span className="flex-1 truncate text-terminal-bright">{p.name}</span>
                          <span className="text-[10px] text-terminal-muted">{p.detailedPosition}</span>
                          {p.stats.goals > 0 && <span className="tnum text-xs text-accent">{p.stats.goals}⚽</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded border border-terminal-border bg-terminal-panel py-1.5">
      <p className="text-[9px] uppercase text-terminal-muted">{label}</p>
      <p className="tnum text-base font-bold" style={{ color: accent ?? '#f6f1ff' }}>
        {value}
      </p>
    </div>
  );
}
