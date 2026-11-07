import React, { useState, useEffect } from 'react';
import { Store, MapPin, Compass } from 'lucide-react';

interface LeafletActiveMapProps {
  mapType: 'world' | 'bangladesh';
  agents: any[];
  highlightedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  zoomLevel: number;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  manualAddress?: string;
}

// Major district coordinates for reference fallback
const districtCoordinates: Record<string, { x: number; y: number; bn: string }> = {
  'ঢাকা': { x: 50, y: 52, bn: 'ঢাকা' },
  'চট্টগ্রাম': { x: 74, y: 76, bn: 'চট্টগ্রাম' },
  'সিলেট': { x: 78, y: 35, bn: 'সিলেট' },
  'রাজশাহী': { x: 26, y: 38, bn: 'রাজশাহী' },
  'খুলনা': { x: 32, y: 74, bn: 'খুলনা' },
  'বরিশাল': { x: 52, y: 82, bn: 'বরিশাল' },
  'রংপুর': { x: 25, y: 18, bn: 'রংপুর' },
  'ময়মনসিংহ': { x: 48, y: 32, bn: 'ময়মনসিংহ' },
  'কুমিল্লা': { x: 68, y: 62, bn: 'কুমিল্লা' },
  'বগুড়া': { x: 34, y: 34, bn: 'বগুড়া' },
  'যশোর': { x: 28, y: 70, bn: 'যশোর' }
};

export default function LeafletActiveMap({
  mapType,
  agents,
  highlightedAgentId,
  onSelectAgent,
  zoomLevel,
  userLocation,
  manualAddress = ''
}: LeafletActiveMapProps) {
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);

  // Helper to project lat/lng to SVG percentages (0-100)
  const getCoordinatesPct = (lat?: number, lng?: number, bdX?: number, bdY?: number, idx: number = 0) => {
    if (mapType === 'bangladesh') {
      if (typeof lat === 'number' && typeof lng === 'number' && lat > 20 && lat < 27 && lng > 87 && lng < 93) {
        // Precise geographic projection for Bangladesh
        const x = Math.min(92, Math.max(8, ((lng - 88.0) / 4.8) * 100));
        const y = Math.min(92, Math.max(8, 100 - ((lat - 20.6) / 6.2) * 100));
        return { x, y };
      }
      if (typeof bdX === 'number' && typeof bdY === 'number' && bdX > 0 && bdY > 0) {
        return { x: bdX, y: bdY };
      }
      // Standard distributed grid fallback
      const x = 20 + ((idx * 17) % 65);
      const y = 20 + ((idx * 23) % 60);
      return { x, y };
    } else {
      // World projection
      if (typeof lat === 'number' && typeof lng === 'number') {
        const x = Math.min(92, Math.max(8, ((lng + 180) / 360) * 100));
        const y = Math.min(92, Math.max(8, (1 - (lat + 90) / 180) * 100));
        return { x, y };
      }
      const x = 15 + ((idx * 29) % 70);
      const y = 20 + ((idx * 19) % 60);
      return { x, y };
    }
  };

  const visibleAgents = agents.filter(a => {
    if (mapType === 'bangladesh') {
      return !a.country || a.country.toLowerCase() === 'bangladesh' || a.country === 'বাংলাদেশ';
    }
    return true;
  });

  // Calculate User Location pin position
  const userPinPos = userLocation ? getCoordinatesPct(userLocation.lat, userLocation.lng, 50, 52, 0) : null;

  return (
    <div className="w-full h-full relative bg-gradient-to-br from-slate-900 via-teal-950 to-slate-950 rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center p-3 select-none font-sans">
      {/* Background Grid Lines */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#14b8a6_1px,transparent_1px)] [background-size:16px_16px]" />
      </div>

      {/* Top Map Status Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between bg-slate-900/90 backdrop-blur-md border border-teal-500/30 px-3 py-1.5 rounded-xl text-white shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span className="text-[11px] font-black text-teal-300">
            📍 স্থায়ী গুগল ম্যাপ পিন লোকেশন (রেড পিন)
          </span>
        </div>
        <span className="text-[10px] font-black text-emerald-300 bg-teal-950 px-2.5 py-0.5 rounded-lg border border-teal-700/60">
          {mapType === 'bangladesh' ? 'বাংলাদেশ নেটওয়ার্ক' : 'গ্লোবাল নেটওয়ার্ক'}
        </span>
      </div>

      {/* Map Canvas */}
      <div className="relative w-full h-[280px] sm:h-[340px] flex items-center justify-center my-auto">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl overflow-visible">
          {/* Map Base Outline */}
          <path
            d="M 35,12 Q 50,8 65,18 Q 80,22 85,38 Q 90,58 75,75 Q 60,88 45,84 Q 25,78 20,58 Q 15,38 35,12 Z"
            fill="#0b2426"
            stroke="#14b8a6"
            strokeWidth="0.6"
            strokeDasharray="2,2"
            className="opacity-60"
          />

          {/* Key District Reference Dots */}
          {Object.entries(districtCoordinates).map(([name, coord]) => (
            <g key={name} className="opacity-40">
              <circle cx={coord.x} cy={coord.y} r="0.8" fill="#5eead4" />
              <text x={coord.x} y={coord.y - 1.5} fontSize="2.2" fill="#99f6e4" fontWeight="bold" textAnchor="middle">
                {coord.bn}
              </text>
            </g>
          ))}

          {/* Active User Position Pin (Blue/Emerald Target Pin) */}
          {userPinPos && (
            <g className="transition-all duration-500" transform={`translate(${userPinPos.x}, ${userPinPos.y})`}>
              <circle cx="0" cy="0" r="6" fill="#3b82f6" className="opacity-30 animate-ping" style={{ animationDuration: '3s' }} />
              <circle cx="0" cy="0" r="3" fill="#2563eb" stroke="#ffffff" strokeWidth="0.8" />
              <path d="M 0,0 L 0,-6" stroke="#2563eb" strokeWidth="0.8" />
              <circle cx="0" cy="-6" r="2" fill="#38bdf8" />
              <foreignObject x="-25" y="-17" width="50" height="10">
                <div className="bg-blue-600 text-white text-[4.5px] font-black px-1 py-0.2 rounded text-center shadow border border-blue-400 truncate">
                  আপনার অবস্থান
                </div>
              </foreignObject>
            </g>
          )}

          {/* Clean Red Pin Markers for Agents (No overlapping text blocks!) */}
          {visibleAgents.map((agent, idx) => {
            const { x, y } = getCoordinatesPct(
              agent.realLat || agent.lat,
              agent.realLng || agent.lng,
              agent.bdX,
              agent.bdY,
              idx
            );
            const isSelected = highlightedAgentId === agent.id;
            const isHovered = hoveredAgentId === agent.id;

            return (
              <g 
                key={agent.id || idx}
                onClick={() => onSelectAgent(agent.id)}
                onMouseEnter={() => setHoveredAgentId(agent.id)}
                onMouseLeave={() => setHoveredAgentId(null)}
                className="cursor-pointer group"
                transform={`translate(${x}, ${y})`}
              >
                {/* Red Pin Pulse Ring */}
                {isSelected && (
                  <circle cx="0" cy="-4" r="7" fill="#ef4444" className="opacity-30 animate-ping" style={{ animationDuration: '1.5s' }} />
                )}

                {/* Clean Red Map Pin Drop Shadow & Stem */}
                <ellipse cx="0" cy="0" rx="1.8" ry="0.8" fill="#000000" className="opacity-50" />
                <path 
                  d="M 0,0 L -2,-5 C -2.5,-6.5 -2.5,-8 0,-10 C 2.5,-8 2.5,-6.5 2,-5 Z" 
                  fill={isSelected ? "#f59e0b" : "#ef4444"} 
                  stroke="#ffffff" 
                  strokeWidth="0.5" 
                  className="transition-transform group-hover:scale-125"
                />
                <circle cx="0" cy="-6.5" r="1.2" fill="#ffffff" />

                {/* Hover / Selection Badge ONLY shown when pin is active (prevents text overlap clutter!) */}
                {(isSelected || isHovered) && (
                  <foreignObject x="-30" y="-22" width="60" height="12" className="pointer-events-none z-30">
                    <div className="bg-slate-900/95 text-amber-300 text-[5px] font-black px-1.5 py-0.5 rounded text-center border border-amber-500/80 shadow-lg truncate">
                      📍 {agent.name.split(' ')[0]} ({agent.city || agent.district || 'এজেন্ট'})
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Coordinates & Location Details Footer */}
      <div className="absolute bottom-3 left-3 right-3 z-20 bg-slate-900/95 backdrop-blur-md border border-teal-500/40 p-2.5 rounded-2xl text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
            <MapPin className="w-4 h-4 text-rose-400 animate-bounce" />
          </div>
          <div className="text-left overflow-hidden">
            <p className="text-[9.5px] font-bold text-teal-300 uppercase tracking-tight">সক্রিয় গুগল ম্যাপ লোকেশন স্থানাংকঃ</p>
            <p className="text-xs font-black text-white truncate font-sans">
              {manualAddress || (userLocation ? `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}` : 'স্থানাংক লোড হচ্ছে...')}
            </p>
          </div>
        </div>
        <div className="shrink-0 bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 text-[9.5px] font-black px-2.5 py-1 rounded-xl">
          ✓ রেড পিন সচল
        </div>
      </div>
    </div>
  );
}
