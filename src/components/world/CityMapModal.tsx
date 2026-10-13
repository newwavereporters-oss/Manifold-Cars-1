// MANIFOLD WORLD - INTERACTIVE LAGOS MAINLAND CITY MAP MODAL
// Full-screen tactical GPS map showing connected roads, landmarks, player position,
// rivals, traffic, and interactive destination waypoint routing.

import React from 'react';
import { X, Navigation, Compass, Flag, Package, Building, ShieldCheck, MapPin } from 'lucide-react';
import { CITY_LANDMARKS, LAGOS_ROAD_NODES, CityLandmark } from './lagosCityData';

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
  if (!isOpen) return null;

  // Coordinate conversion: World coordinates [-150, 150] map to SVG viewBox [0, 600]
  const worldToSvg = (x: number, z: number) => {
    const svgX = 300 + (x / 160) * 270;
    const svgY = 300 + (z / 160) * 270;
    return { x: svgX, y: svgY };
  };

  const pSvg = worldToSvg(playerPos.x, playerPos.z);
  const destSvg = activeDestination ? worldToSvg(activeDestination.x, activeDestination.z) : null;
  const distToDest = activeDestination
    ? Math.round(Math.hypot(activeDestination.x - playerPos.x, activeDestination.z - playerPos.z) * 1.5)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[88vh] bg-[#071A2B] border border-white/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#071A2B]/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wider uppercase">Lagos Mainland GPS Map</h2>
              <p className="text-xs text-gray-400">Yaba Tech Corridor · Commercial Ave · Surulere Express</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeDestination && (
              <button
                onClick={onClearDestination}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-gray-300 transition-colors"
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

        {/* Map Body & Sidebar Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Interactive SVG City Map */}
          <div className="flex-1 relative bg-[#040E19] overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 600 600" className="w-full h-full select-none cursor-crosshair">
              {/* Grid Background */}
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="600" height="600" fill="url(#grid)" />

              {/* District Area Watermarks */}
              <text x="300" y="80" textAnchor="middle" fill="rgba(255,255,255,0.08)" fontSize="18" fontWeight="bold">
                YABA TECH HUB DISTRICT
              </text>
              <text x="490" y="300" textAnchor="middle" fill="rgba(255,255,255,0.08)" fontSize="16" fontWeight="bold">
                COMMERCIAL AVENUE
              </text>
              <text x="110" y="300" textAnchor="middle" fill="rgba(255,255,255,0.08)" fontSize="16" fontWeight="bold">
                SURULERE EXPRESSWAY
              </text>
              <text x="140" y="480" textAnchor="middle" fill="rgba(255,255,255,0.08)" fontSize="16" fontWeight="bold">
                CARGO LOGISTICS
              </text>

              {/* Connected Road Network Ribbons */}
              {Object.values(LAGOS_ROAD_NODES).map((node) =>
                node.neighbors.map((nId) => {
                  const target = LAGOS_ROAD_NODES[nId];
                  if (!target) return null;
                  const p1 = worldToSvg(node.x, node.z);
                  const p2 = worldToSvg(target.x, target.z);
                  return (
                    <line
                      key={`${node.id}--${target.id}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="#1e293b"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                  );
                })
              )}

              {/* Road Inner Asphalt Line */}
              {Object.values(LAGOS_ROAD_NODES).map((node) =>
                node.neighbors.map((nId) => {
                  const target = LAGOS_ROAD_NODES[nId];
                  if (!target) return null;
                  const p1 = worldToSvg(node.x, node.z);
                  const p2 = worldToSvg(target.x, target.z);
                  return (
                    <line
                      key={`center-${node.id}--${target.id}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="#334155"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                  );
                })
              )}

              {/* Active GPS Route Line */}
              {destSvg && (
                <line
                  x1={pSvg.x}
                  y1={pSvg.y}
                  x2={destSvg.x}
                  y2={destSvg.y}
                  stroke="#10b981"
                  strokeWidth="5"
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                />
              )}

              {/* Traffic Vehicles Dots */}
              {trafficPositions.map((t, i) => {
                const pt = worldToSvg(t.x, t.z);
                return <circle key={`traffic-${i}`} cx={pt.x} cy={pt.y} r="3.5" fill="#facc15" opacity="0.8" />;
              })}

              {/* Rival Racers Dots */}
              {rivalPositions.map((r, i) => {
                const pr = worldToSvg(r.x, r.z);
                return (
                  <g key={`rival-${i}`}>
                    <circle cx={pr.x} cy={pr.y} r="5" fill="#dc2626" />
                    <text x={pr.x} y={pr.y - 7} textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold">
                      {r.name}
                    </text>
                  </g>
                );
              })}

              {/* Landmark Pins */}
              {CITY_LANDMARKS.map((lm) => {
                const plm = worldToSvg(lm.x, lm.z);
                const isSelected = activeDestination?.name === lm.name;
                return (
                  <g
                    key={lm.id}
                    className="cursor-pointer group"
                    onClick={() => onSelectDestination({ x: lm.x, z: lm.z, name: lm.name })}
                  >
                    <circle
                      cx={plm.x}
                      cy={plm.y}
                      r="14"
                      fill={lm.color}
                      fillOpacity={isSelected ? '0.45' : '0.2'}
                      stroke={lm.color}
                      strokeWidth={isSelected ? '3' : '1.5'}
                    />
                    <circle cx={plm.x} cy={plm.y} r="5" fill={lm.color} />
                    <text
                      x={plm.x}
                      y={plm.y + 22}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="9"
                      fontWeight="bold"
                      className="drop-shadow"
                    >
                      {lm.name}
                    </text>
                  </g>
                );
              })}

              {/* Player Arrow Marker */}
              <g
                transform={`translate(${pSvg.x}, ${pSvg.y}) rotate(${
                  (playerPos.heading * 180) / Math.PI + 180
                })`}
              >
                <circle cx="0" cy="0" r="10" fill="rgba(239, 35, 60, 0.25)" />
                <polygon points="0,-12 7,8 0,3 -7,8" fill="#EF233C" stroke="#FFFFFF" strokeWidth="1.5" />
              </g>

              {/* Active Destination Target Pin */}
              {destSvg && (
                <g transform={`translate(${destSvg.x}, ${destSvg.y})`}>
                  <circle cx="0" cy="0" r="16" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
                  <circle cx="0" cy="0" r="5" fill="#10b981" />
                  <text x="0" y="-12" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold">
                    DESTINATION
                  </text>
                </g>
              )}
            </svg>

            {/* GPS HUD Overlay Card on Map */}
            {activeDestination && (
              <div className="absolute bottom-4 left-4 bg-[#071A2B]/95 backdrop-blur-md p-3.5 rounded-2xl border border-emerald-500/40 shadow-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Navigation className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                    Active GPS Waypoint
                  </span>
                  <span className="text-sm font-black text-white block">{activeDestination.name}</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {distToDest} meters away · ~{Math.ceil((distToDest || 100) / 25)}s drive
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Quick Navigation Directory */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 bg-[#071A2B]/95 p-4 flex flex-col justify-between overflow-y-auto">
            <div>
              <span className="text-xs font-black uppercase text-gray-400 tracking-wider block mb-3">
                Key Destinations & Hubs
              </span>
              <div className="flex flex-col gap-2">
                {CITY_LANDMARKS.map((lm) => {
                  const isSelected = activeDestination?.name === lm.name;
                  return (
                    <button
                      key={lm.id}
                      onClick={() => onSelectDestination({ x: lm.x, z: lm.z, name: lm.name })}
                      className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-200'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${lm.color}25`, color: lm.color }}
                      >
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black block text-white">{lm.name}</span>
                        <span className="text-[10px] text-gray-400 block leading-snug">{lm.subTitle}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 mt-4 text-[10px] text-gray-400 leading-relaxed">
              <span className="font-bold text-gray-300 block mb-1">PRO-TIP:</span>
              Click any landmark pin or card to lock in your GPS route. In-world road guidance ribbons will direct you through connected streets.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
