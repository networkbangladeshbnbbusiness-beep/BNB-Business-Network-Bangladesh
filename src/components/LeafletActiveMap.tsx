import React, { useEffect, useRef, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  role: string;
  country: string;
  flag: string;
  city: string;
  phone: string;
  lat: number;
  lng: number;
  bdX?: number;
  bdY?: number;
  img: string;
  realLat?: number;
  realLng?: number;
}

interface LeafletActiveMapProps {
  mapType: 'world' | 'bangladesh';
  agents: any[];
  highlightedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  zoomLevel: number;
  userLocation?: { lat: number; lng: number } | null;
}

// Map percentages back to real lat/lng if not already populated
const getAgentLatLng = (agent: any): { lat: number; lng: number } => {
  if (typeof agent.realLat === 'number' && typeof agent.realLng === 'number' && agent.realLat !== 0 && agent.realLng !== 0) {
    return { lat: agent.realLat, lng: agent.realLng };
  }
  if (typeof agent.lat === 'number' && typeof agent.lng === 'number' && agent.lat !== 0 && agent.lng !== 0) {
    return { lat: agent.lat, lng: agent.lng };
  }
  
  return { lat: 23.8103, lng: 90.4125 };
};

export default function LeafletActiveMap({
  mapType,
  agents,
  highlightedAgentId,
  onSelectAgent,
  zoomLevel,
  userLocation
}: LeafletActiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  // Simulated LIVE drifting locations to show real-time tracking
  const [liveDrifts, setLiveDrifts] = useState<{ [key: string]: { lat: number; lng: number } }>({});

  // 1. Load Leaflet CSS and JS Dynamically (extremely safe for build systems)
  useEffect(() => {
    let cssInserted = false;
    let jsInserted = false;

    if (!document.getElementById('leaflet-css-cdn')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-cdn';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      cssInserted = true;
    }

    if (!document.getElementById('leaflet-js-cdn')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js-cdn';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
      jsInserted = true;
    } else {
      // If already appended but loaded
      if (typeof window !== 'undefined' && (window as any).L) {
        setLeafletLoaded(true);
      } else {
        // Poll for load
        const interval = setInterval(() => {
          if ((window as any).L) {
            setLeafletLoaded(true);
            clearInterval(interval);
          }
        }, 100);
        return () => clearInterval(interval);
      }
    }
  }, []);

  // 2. Setup simulated live real-time location drift/pulses (updates slightly every 4s)
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveDrifts((prev) => {
        const nextDrifts = { ...prev };
        agents.forEach((agent) => {
          const base = getAgentLatLng(agent);
          const current = nextDrifts[agent.id] || base;
          // Drift slightly (Simulate walking/patrolling/driving around 5-20 meters)
          nextDrifts[agent.id] = {
            lat: current.lat + (Math.random() - 0.5) * 0.00015,
            lng: current.lng + (Math.random() - 0.5) * 0.00015,
          };
        });
        return nextDrifts;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [agents]);

  // 3. Initialize/Update Leaflet Map View & Layer Setup
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Center coordinates
    const centerWorld = [24.0, 50.0]; // Centered at Middle-East/Asia gateway
    const centerBD = [23.85, 90.35]; // Centered on Dhaka/Bangladesh

    const targetCenter = mapType === 'world' ? centerWorld : centerBD;
    const targetZoom = mapType === 'world' ? (zoomLevel > 1 ? 3.5 : 2.2) : (zoomLevel > 1 ? 9 : 7.2);

    // Create Map if it doesn't exist
    if (!mapInstanceRef.current) {
      // Set anchor with zoomSnap for smooth visual rendering
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1,
        maxZoom: 18,
        minZoom: 2,
      }).setView(targetCenter, targetZoom);

      // Add CartoDB Voyager Tile layer for extremely premium executive map styling
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(mapInstanceRef.current);
    } else {
      // Smooth flyTo transitions instead of abrupt hops
      mapInstanceRef.current.flyTo(targetCenter, targetZoom, {
        animate: true,
        duration: 1.2
      });
    }
  }, [leafletLoaded, mapType, zoomLevel]);

  // 4. Handle Redrawing Live Markers & Highlighting Selection
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Clear old markers
    Object.keys(markersRef.current).forEach((key) => {
      mapInstanceRef.current.removeLayer(markersRef.current[key]);
    });
    markersRef.current = {};

    // Draw User Location Marker if available
    if (userLocation && userLocation.lat && userLocation.lng) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        html: `
          <div class="relative w-9 h-9 flex items-center justify-center cursor-pointer">
            <div class="absolute -inset-1 rounded-full bg-blue-500/35 animate-ping" style="animation-duration: 2s"></div>
            <div class="relative w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center">
              <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            </div>
          </div>
        `
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(mapInstanceRef.current);
      
      userMarker.bindPopup(`
        <div class="font-sans text-xs p-1 text-slate-800 font-extrabold text-center">
          <p class="text-blue-600 font-black mb-0.5">📍 আপনার অবস্থান</p>
          <p class="text-[9px] text-slate-500 leading-none">GPS এর মাধ্যমে সনাক্তকৃত</p>
        </div>
      `, { closeButton: false });

      markersRef.current['_user_location_'] = userMarker;
    }

    // Filter agents shown based on mapType (World vs Bangladesh view)
    const visibleAgents = agents.filter((agent) => {
      if (mapType === 'bangladesh') {
        return agent.country.toLowerCase() === 'bangladesh';
      }
      return true;
    });

    // Draw Visible Map Markers with real-time drifts
    visibleAgents.forEach((agent) => {
      const livePos = liveDrifts[agent.id] || getAgentLatLng(agent);
      const isHighlighted = highlightedAgentId === agent.id;

      // Premium Custom HTML Marker with Avatar icon and pulsing beacon glow
      const customIcon = L.divIcon({
        className: 'custom-leaflet-agent-marker',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        html: `
          <div class="relative w-10 h-10 flex items-center justify-center cursor-pointer">
            <!-- Pulsating dynamic live status bubble -->
            <div class="absolute -inset-1.5 rounded-full bg-emerald-500/35 animate-ping" style="animation-duration: 2.2s"></div>
            
            <!-- Avatar Frame -->
            <div class="relative w-8 h-8 rounded-full bg-white border-2 border-slate-50 shadow-md flex items-center justify-center overflow-hidden transition-all duration-300 ${isHighlighted ? 'ring-4 ring-emerald-500 scale-115 !border-emerald-100' : 'hover:scale-105 border-teal-500'}" style="width: 34px; height: 34px;">
              <img src="${agent.img}" style="width: 100%; height: 100%; object-fit: cover;" referrerPolicy="no-referrer" />
              <!-- Status Active Dot -->
              <span class="absolute right-0.5 bottom-0.5 w-2 h-2 rounded-full border border-white bg-green-500 shadow-xs"></span>
            </div>
          </div>
        `
      });

      // Place Marker
      const marker = L.marker([livePos.lat, livePos.lng], { icon: customIcon })
        .addTo(mapInstanceRef.current)
        .on('click', () => {
          onSelectAgent(agent.id);
          // Fly smoothly to marker upon click
          mapInstanceRef.current.flyTo([livePos.lat, livePos.lng], mapType === 'world' ? 10 : 12, {
            animate: true,
            duration: 1.0
          });
        });

      // Bind custom popup tooltip
      const popupHtml = `
        <div class="font-sans text-xs p-1.5 min-w-[145px] text-slate-800">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-sm">${agent.flag}</span>
            <span class="font-black text-slate-900 text-xs">${agent.name}</span>
          </div>
          <p class="text-[9.5px] font-bold text-teal-600 mb-0.5">${agent.role}</p>
          <p class="text-[9.5px] text-slate-600 leading-tight">📍 ${agent.city}${agent.district ? `, ${agent.district}` : ''}</p>
          <p class="text-[9px] text-slate-500 font-mono mt-0.5">📞 ${agent.phone}</p>
          ${agent.district || agent.thana || agent.postOffice ? `
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #f1f5f9; font-size: 8px; color: #475569; line-height: 1.2;">
              <p style="font-weight: 800; color: #0d9488; margin: 0 0 2px 0;">🏠 ঠিকানাঃ</p>
              ${agent.postOffice ? `<p style="margin: 0;">পোস্টঃ ${agent.postOffice}</p>` : ''}
              ${agent.thana ? `<p style="margin: 0;">থানাঃ ${agent.thana}</p>` : ''}
              ${agent.district ? `<p style="margin: 0;">জেলাঃ ${agent.district}</p>` : ''}
            </div>
          ` : ''}
          ${agent.distance !== null && agent.distance !== undefined ? `
            <div style="margin-top: 5px; padding: 4px 6px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 8.5px; font-weight: 800; color: #166534;">
              📏 দূরত্বঃ ${agent.distance.toFixed(1)} কি.মি.
            </div>
          ` : ''}
          <a href="${agent.shopMapLink || 'https://www.google.com/maps/dir/?api=1&destination=' + livePos.lat + ',' + livePos.lng}" target="_blank" rel="noreferrer" style="margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 4px; background-color: #0d9488; color: white; padding: 4px 8px; border-radius: 8px; font-size: 9px; font-weight: 800; text-decoration: none; text-align: center;">
            🗺️ গুগল ম্যাপে অবস্থান দেখুন
          </a>
        </div>
      `;
      marker.bindPopup(popupHtml, {
        closeButton: false,
        offset: [0, -10]
      });

      if (isHighlighted) {
        marker.openPopup();
      }

      markersRef.current[agent.id] = marker;
    });

    // Handle flying and focusing on agent if dynamically selected from the user cards
    if (highlightedAgentId) {
      const selectedAgent = agents.find(a => a.id === highlightedAgentId);
      if (selectedAgent) {
        const livePos = liveDrifts[selectedAgent.id] || getAgentLatLng(selectedAgent);
        mapInstanceRef.current.flyTo([livePos.lat, livePos.lng], mapType === 'world' ? 10 : 12, {
          animate: true,
          duration: 1.2
        });
        
        // Open popup after flyTo completes
        setTimeout(() => {
          if (markersRef.current[selectedAgent.id]) {
            markersRef.current[selectedAgent.id].openPopup();
          }
        }, 1200);
      }
    }
  }, [leafletLoaded, mapType, highlightedAgentId, agents, liveDrifts, userLocation]);

  // Clean elements on unmount for memory safety
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative bg-[#E8F0F2]">
      {!leafletLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white z-20 space-y-3 font-sans">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black text-slate-400 animate-pulse">রিয়েল-টাইম লাইভ ম্যাপ লোড হচ্ছে...</p>
        </div>
      )}
      
      {/* Real Map Canvas Element */}
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', outline: 'none' }}
        className="z-10"
      />
    </div>
  );
}
