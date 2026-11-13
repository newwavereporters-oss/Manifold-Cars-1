// MANIFOLD WORLD - INTERACTIVE LAGOS, EPE, BRIDGE & MAINLAND CITY GPS MAP
// Full-world pan/zoom map covering Lagos Island, Epe Corridor, Lagos Lagoon, Third Mainland Bridge,
// Iyana-Oworo, Oshodi, Ikeja, Iyana Ipaja, Egbeda, Igando, Akesan, and LASU Campus,
// with shortest-path road GPS routing and turn-by-turn guidance.

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Navigation,
  Compass,
  MapPin,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Route,
} from 'lucide-react';
import {
  CITY_LANDMARKS,
  LAGOS_ROAD_NODES,
  findShortestRoadPathDetailed,
  CityLandmark,
} from './lagosCityData';

interface CityMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerPos: { x: number; z: number; heading: number };
  activeDestination: { x: number; z: number; name: string } | null;
  onSelectDestination: (dest: { x: number; z: number; name: string }) => void;
  onClearDestination: () => void;
  trafficPositions?: { x: number; z: number }[];
  rivalPositions?: { name: string; x: number; z: number }[];
}

type RegionFilter = 'ALL' | 'ISLAND' | 'OBALENDE_IKOYI' | 'LEKKI_AJAH_EPE' | 'MAINLAND' | 'LASU';

// Fixed World-to-SVG base projection: World X [-1020, 1620] -> [0, 1060], Z [-960, 280] -> [0, 500]
const SVG_W = 1060;
const SVG_H = 500;
const MIN_X = -1020;
const MAX_X = 1620;
const MIN_Z = -960;
const MAX_Z = 280;

function worldToSvg(wx: number, wz: number): { x: number; y: number } {
  const x = ((wx - MIN_X) / (MAX_X - MIN_X)) * SVG_W;
  const y = ((wz - MIN_Z) / (MAX_Z - MIN_Z)) * SVG_H;
  return { x, y };
}

export const CityMapModal: React.FC<CityMapModalProps> = ({
  isOpen,
  onClose,
  playerPos,
  activeDestination,
  onSelectDestination,
  onClearDestination,
  trafficPositions = [],
  rivalPositions = [],
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('ALL');
  const draggingRef = useRef<{ active: boolean; startX: number; startY: number; origPanX: number; origPanY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origPanX: 0,
    origPanY: 0,
  });

  // Deduplicated road segments for crisp SVG rendering
  const uniqueEdges = useMemo(() => {
    const seen = new Set<string>();
    const list: {
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isDual: boolean;
      isBridge: boolean;
    }[] = [];

    Object.values(LAGOS_ROAD_NODES).forEach((node) => {
      node.neighbors.forEach((nId) => {
        const nb = LAGOS_ROAD_NODES[nId];
        if (!nb) return;
        const key = [node.id, nb.id].sort().join('--');
        if (seen.has(key)) return;
        seen.add(key);

        const p1 = worldToSvg(node.x, node.z);
        const p2 = worldToSvg(nb.x, nb.z);
        list.push({
          key,
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          isDual: Boolean(node.isDualCarriageway && nb.isDualCarriageway),
          isBridge: Boolean(node.isBridge || nb.isBridge),
        });
      });
    });
    return list;
  }, []);

  const routeInfo = useMemo(() => {
    if (!activeDestination) return null;
    return findShortestRoadPathDetailed(playerPos, activeDestination);
  }, [playerPos.x, playerPos.z, activeDestination]);

  const filteredLandmarks = useMemo(() => {
    return CITY_LANDMARKS.filter((lm: CityLandmark) => {
      if (regionFilter === 'ALL') return true;
      if (regionFilter === 'OBALENDE_IKOYI') {
        return lm.district === 'OBALENDE' || lm.district === 'IKOYI' || lm.id === 'IKOYI_LINK_BRIDGE';
      }
      if (regionFilter === 'LEKKI_AJAH_EPE') {
        return lm.district === 'LEKKI' || lm.district === 'AJAH' || lm.district === 'EPE' || lm.id === 'IKOYI_LINK_BRIDGE';
      }
      if (regionFilter === 'LASU') return lm.district === 'LASU';
      if (regionFilter === 'MAINLAND') return lm.district === 'MAINLAND' || lm.id === 'THIRD_MAINLAND_BRIDGE';
      return (
        lm.district === 'SHOWROOM_HUB' ||
        lm.district === 'YABA_TECH' ||
        lm.district === 'COMMERCIAL_ROW' ||
        lm.district === 'SURULERE_EXPRESS' ||
        lm.district === 'LOGISTICS_DEPOT' ||
        lm.district === 'MARKETPLACE'
      );
    });
  }, [regionFilter]);

  if (!isOpen) return null;

  const pSvg = worldToSvg(playerPos.x, playerPos.z);
  const destSvg = activeDestination ? worldToSvg(activeDestination.x, activeDestination.z) : null;

  // Water polygons matching WORLD_BOUNDS
  const lagoonTopLeft = worldToSvg(MIN_X, -585);
  const lagoonBotRight = worldToSvg(MAX_X, -165);
  const ikoyiChanTopLeft = worldToSvg(445, -165);
  const ikoyiChanBotRight = worldToSvg(595, MAX_Z);
  const epeCreekTopLeft = worldToSvg(1350, -165);
  const epeCreekBotRight = worldToSvg(1425, MAX_Z);
  const eastBayTopLeft = worldToSvg(1600, -165);
  const eastBayBotRight = worldToSvg(MAX_X, MAX_Z);
  const southCoastTop = worldToSvg(MIN_X, 250);

  const routeSvgPoints = routeInfo
    ? routeInfo.path.map((pt) => {
        const s = worldToSvg(pt.x, pt.z);
        return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
      }).join(' ')
    : '';

  const centerOnPlayer = () => {
    const z = Math.max(1.8, zoom);
    setZoom(z);
    setPan({
      x: (SVG_W / 2 - pSvg.x) * (z - 1) * 0.45 + (SVG_W / 2 - pSvg.x) * 0.65,
      y: (SVG_H / 2 - pSvg.y) * (z - 1) * 0.45 + (SVG_H / 2 - pSvg.y) * 0.65,
    });
  };

  const resetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[data-pin]')) {
      return;
    }
    draggingRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current.active) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    setPan({
      x: draggingRef.current.origPanX + dx / zoom,
      y: draggingRef.current.origPanY + dy / zoom,
    });
  };

  const handlePointerUp = () => {
    draggingRef.current.active = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prev) => Math.max(0.85, Math.min(4.2, Number((prev * factor).toFixed(2)))));
  };

  // Compute SVG viewBox reflecting pan + zoom
  const vbW = SVG_W / zoom;
  const vbH = SVG_H / zoom;
  const vbX = (SVG_W - vbW) / 2 - pan.x;
  const vbY = (SVG_H - vbH) / 2 - pan.y;

  const formatDist = (meters: number) =>
    meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters} m`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[90vh] bg-[#071A2B] border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#071A2B]/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wider uppercase">
                MANIFOLD Lagos Metro GPS Map
              </h2>
              <p className="text-[11px] text-gray-400">
                Lagos Island · TMB · Adekunle · Obalende · Ikoyi · Ikoyi Link Bridge · Lekki · Ikate · Eleganza · VGC · Ajah · Epe · LASU
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeDestination && (
              <button
                onClick={onClearDestination}
                className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-xs font-bold text-red-300 transition-colors"
              >
                Clear GPS
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Map Canvas + Right Destination Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Interactive Pan & Zoom Map */}
          <div
            className="flex-1 relative bg-[#04101d] overflow-hidden cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* Map Zoom Controls */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-[#071A2B]/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-xl">
              <button
                onClick={() => setZoom((z) => Math.min(4.2, Number((z * 1.25).toFixed(2))))}
                className="p-2 rounded-xl hover:bg-white/10 text-gray-200"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.85, Number((z * 0.8).toFixed(2))))}
                className="p-2 rounded-xl hover:bg-white/10 text-gray-200"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={centerOnPlayer}
                className="p-2 rounded-xl hover:bg-white/10 text-amber-400"
                title="Center on Vehicle"
              >
                <Crosshair className="w-4 h-4" />
              </button>
              <button
                onClick={resetView}
                className="p-2 rounded-xl hover:bg-white/10 text-gray-300"
                title="Fit Full World"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            <svg
              viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full select-none"
            >
              <defs>
                <pattern id="metroGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
                </pattern>
              </defs>

              <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="url(#metroGrid)" />

              {/* Lagos Lagoon Main Band */}
              <rect
                x={0}
                y={lagoonTopLeft.y}
                width={SVG_W}
                height={lagoonBotRight.y - lagoonTopLeft.y}
                fill="#0b3b59"
                fillOpacity="0.65"
              />
              {/* Ikoyi-Lekki Lagoon Channel */}
              <rect
                x={ikoyiChanTopLeft.x}
                y={ikoyiChanTopLeft.y}
                width={ikoyiChanBotRight.x - ikoyiChanTopLeft.x}
                height={ikoyiChanBotRight.y - ikoyiChanTopLeft.y}
                fill="#0b3b59"
                fillOpacity="0.65"
              />
              {/* Epe Lagoon Creek */}
              <rect
                x={epeCreekTopLeft.x}
                y={epeCreekTopLeft.y}
                width={epeCreekBotRight.x - epeCreekTopLeft.x}
                height={epeCreekBotRight.y - epeCreekTopLeft.y}
                fill="#0b3b59"
                fillOpacity="0.65"
              />
              {/* Eastern Lagoon Bay framing Epe Waterfront */}
              <rect
                x={eastBayTopLeft.x}
                y={eastBayTopLeft.y}
                width={SVG_W - eastBayTopLeft.x}
                height={eastBayBotRight.y - eastBayTopLeft.y}
                fill="#0b3b59"
                fillOpacity="0.55"
              />
              {/* Southern Atlantic Coast */}
              <rect
                x={0}
                y={southCoastTop.y}
                width={SVG_W}
                height={SVG_H - southCoastTop.y}
                fill="#0b3b59"
                fillOpacity="0.5"
              />

              {/* Lagoon Label */}
              <text
                x={worldToSvg(240, -375).x}
                y={(lagoonTopLeft.y + lagoonBotRight.y) / 2 + 5}
                textAnchor="middle"
                fill="rgba(56, 189, 248, 0.35)"
                fontSize="16"
                fontWeight="900"
                letterSpacing="6"
              >
                LAGOS LAGOON
              </text>

              {/* LASU Campus Precinct Boundary Shading */}
              {(() => {
                const c1 = worldToSvg(-980, -780);
                const c2 = worldToSvg(-785, -580);
                return (
                  <rect
                    x={c1.x}
                    y={c1.y}
                    width={c2.x - c1.x}
                    height={c2.y - c1.y}
                    rx="8"
                    fill="#065f46"
                    fillOpacity="0.24"
                    stroke="#10b981"
                    strokeOpacity="0.35"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                );
              })()}

              {/* District Labels */}
              {[
                { x: 0, z: 45, label: 'LAGOS ISLAND' },
                { x: 160, z: -152, label: 'ADEKUNLE' },
                { x: 180, z: 75, label: 'OBALENDE' },
                { x: 335, z: -145, label: 'IKOYI' },
                { x: 520, z: -48, label: 'IKOYI LINK BRIDGE' },
                { x: 660, z: -105, label: 'LEKKI PHASE 1' },
                { x: 790, z: 145, label: 'IKATE' },
                { x: 905, z: 145, label: 'ELEGANZA' },
                { x: 1015, z: -38, label: 'VGC' },
                { x: 1135, z: 155, label: 'AJAH FLYOVER' },
                { x: 1388, z: 58, label: 'EPE BRIDGE' },
                { x: 1545, z: 145, label: 'EPE WATERFRONT' },
                { x: 85, z: -380, label: 'THIRD MAINLAND BRIDGE' },
                { x: 30, z: -618, label: 'IYANA-OWORO' },
                { x: -260, z: -612, label: 'OSHODI' },
                { x: -65, z: -918, label: 'IKEJA CBD' },
                { x: -260, z: -918, label: 'IYANA IPAJA' },
                { x: -410, z: -875, label: 'EGBEDA' },
                { x: -550, z: -828, label: 'IGANDO' },
                { x: -680, z: -755, label: 'AKESAN' },
                { x: -885, z: -762, label: 'LASU CAMPUS' },
              ].map((d) => {
                const pt = worldToSvg(d.x, d.z);
                return (
                  <text
                    key={d.label}
                    x={pt.x}
                    y={pt.y}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.28)"
                    fontSize="8.5"
                    fontWeight="800"
                    letterSpacing="1.2"
                  >
                    {d.label}
                  </text>
                );
              })}

              {/* Connected Road Network Outer Curbs */}
              {uniqueEdges.map((e) => (
                <line
                  key={`outer-${e.key}`}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke={e.isBridge ? '#38bdf8' : '#1e293b'}
                  strokeWidth={e.isDual ? 9.5 : 7}
                  strokeLinecap="round"
                />
              ))}

              {/* Road Asphalt Center */}
              {uniqueEdges.map((e) => (
                <line
                  key={`inner-${e.key}`}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke={e.isBridge ? '#1e3a5f' : '#475569'}
                  strokeWidth={e.isDual ? 6.2 : 4.2}
                  strokeLinecap="round"
                />
              ))}

              {/* Dual-Carriageway Median Line */}
              {uniqueEdges
                .filter((e) => e.isDual)
                .map((e) => (
                  <line
                    key={`med-${e.key}`}
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    stroke="#facc15"
                    strokeOpacity="0.45"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                  />
                ))}

              {/* Active Shortest-Path Road GPS Polyline */}
              {routeSvgPoints && (
                <polyline
                  points={routeSvgPoints}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={4.2 / Math.sqrt(zoom)}
                  strokeDasharray="8 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Live Traffic Vehicles */}
              {trafficPositions.map((t, i) => {
                const pt = worldToSvg(t.x, t.z);
                return (
                  <circle
                    key={`traffic-${i}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={2.2 / Math.sqrt(zoom)}
                    fill="#facc15"
                    opacity="0.85"
                  />
                );
              })}

              {/* Live Rival Racers */}
              {rivalPositions.map((r, i) => {
                const pr = worldToSvg(r.x, r.z);
                return (
                  <g key={`rival-${i}`}>
                    <circle cx={pr.x} cy={pr.y} r={3.5 / Math.sqrt(zoom)} fill="#ef4444" />
                    <text
                      x={pr.x}
                      y={pr.y - 6 / Math.sqrt(zoom)}
                      textAnchor="middle"
                      fill="#f87171"
                      fontSize={8 / Math.sqrt(zoom)}
                      fontWeight="bold"
                    >
                      {r.name}
                    </text>
                  </g>
                );
              })}

              {/* Landmark / Destination Interactive Pins */}
              {filteredLandmarks.map((lm) => {
                const plm = worldToSvg(lm.x, lm.z);
                const isSelected = activeDestination?.name === lm.name;
                const scaleInv = 1 / Math.sqrt(zoom);
                return (
                  <g
                    key={lm.id}
                    data-pin="true"
                    className="cursor-pointer"
                    onClick={() => onSelectDestination({ x: lm.x, z: lm.z, name: lm.name })}
                  >
                    <circle
                      cx={plm.x}
                      cy={plm.y}
                      r={9 * scaleInv}
                      fill={lm.color}
                      fillOpacity={isSelected ? '0.45' : '0.22'}
                      stroke={lm.color}
                      strokeWidth={(isSelected ? 2.4 : 1.3) * scaleInv}
                    />
                    <circle cx={plm.x} cy={plm.y} r={3.6 * scaleInv} fill={lm.color} />
                    <text
                      x={plm.x}
                      y={plm.y + 15 * scaleInv}
                      textAnchor="middle"
                      fill={isSelected ? '#6ee7b7' : '#e2e8f0'}
                      fontSize={7.8 * scaleInv}
                      fontWeight="800"
                    >
                      {lm.name.replace(' (LASU)', '')}
                    </text>
                  </g>
                );
              })}

              {/* Player Arrow Marker */}
              <g
                transform={`translate(${pSvg.x}, ${pSvg.y}) rotate(${
                  (-playerPos.heading * 180) / Math.PI + 180
                }) scale(${1 / Math.sqrt(zoom)})`}
              >
                <circle cx="0" cy="0" r="10" fill="rgba(239, 35, 60, 0.3)" />
                <polygon points="0,-11 6.5,7 0,3 -6.5,7" fill="#EF233C" stroke="#FFFFFF" strokeWidth="1.4" />
              </g>

              {/* Active Destination Target Pulse */}
              {destSvg && (
                <g transform={`translate(${destSvg.x}, ${destSvg.y}) scale(${1 / Math.sqrt(zoom)})`}>
                  <circle cx="0" cy="0" r="13" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" />
                  <circle cx="0" cy="0" r="4" fill="#10b981" />
                </g>
              )}
            </svg>

            {/* Bottom-Left Turn-by-Turn GPS Guidance Card */}
            {activeDestination && routeInfo && (
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md bg-[#071A2B]/95 backdrop-blur-md p-3.5 rounded-2xl border border-emerald-500/50 shadow-2xl flex items-center gap-3 z-20">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Navigation className="w-5 h-5 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider truncate">
                      GPS Active · {formatDist(routeInfo.totalMeters)} remaining
                    </span>
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">
                      ~{Math.max(1, Math.ceil(routeInfo.totalMeters / 1200))} min
                    </span>
                  </div>
                  <span className="text-sm font-black text-white block truncate">
                    {activeDestination.name}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1 truncate">
                    <Route className="w-3 h-3 shrink-0" />
                    {routeInfo.nextTurnText} ({formatDist(routeInfo.distToNextTurnMeters)})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Filterable Destinations Directory */}
          <div className="w-full lg:w-88 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#071A2B]/95 p-4 flex flex-col overflow-hidden max-h-[38vh] lg:max-h-none">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase text-gray-300 tracking-wider">
                Destinations ({filteredLandmarks.length})
              </span>
              <span className="text-[10px] font-mono text-gray-500">
                Zoom {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Region Filter Tabs */}
            <div className="flex flex-wrap gap-1 mb-3">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'ISLAND', label: 'Island' },
                  { id: 'OBALENDE_IKOYI', label: 'Obalende & Ikoyi' },
                  { id: 'LEKKI_AJAH_EPE', label: 'Lekki · Ajah · Epe' },
                  { id: 'MAINLAND', label: 'TMB & Mainland' },
                  { id: 'LASU', label: 'LASU' },
                ] as { id: RegionFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRegionFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                    regionFilter === tab.id
                      ? 'bg-[#EF233C] text-white'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {filteredLandmarks.map((lm) => {
                const isSelected = activeDestination?.name === lm.name;
                return (
                  <button
                    key={lm.id}
                    onClick={() => onSelectDestination({ x: lm.x, z: lm.z, name: lm.name })}
                    className={`flex items-start gap-2.5 p-2.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-200'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: `${lm.color}25`, color: lm.color }}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black block text-white truncate">{lm.name}</span>
                      <span className="text-[10px] text-gray-400 block leading-snug truncate">
                        {lm.subTitle}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-white/10 mt-2 text-[10px] text-gray-400 leading-relaxed">
              Drag to pan, scroll or tap +/- to zoom. Select any hub to compute a live road-following GPS route.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
