// Source: Google Maps Platform Code Assist
import React, { useState, useEffect, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Phone, Globe, Compass } from 'lucide-react';

export interface AgentLocationData {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  role?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  district?: string;
  thana?: string;
  address?: string;
  img?: string;
  lat: number;
  lng: number;
  active?: boolean;
  distanceKm?: number | null;
}

interface GoogleAgentMapProps {
  agents: AgentLocationData[];
  mapType: 'world' | 'bangladesh';
  onMapTypeChange: (type: 'world' | 'bangladesh') => void;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  userLocation: { lat: number; lng: number } | null;
  onRequestUserLocation: () => void;
  locatingUser?: boolean;
}

// Controller to smoothly pan map camera when selected agent or mapType changes
function MapCameraController({
  center,
  zoom,
}: {
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (map && center) {
      map.panTo(center);
      map.setZoom(zoom);
    }
  }, [map, center, zoom]);

  return null;
}

export const GoogleAgentMap: React.FC<GoogleAgentMapProps> = ({
  agents,
  mapType,
  onMapTypeChange,
  selectedAgentId,
  onSelectAgent,
  userLocation,
  onRequestUserLocation,
  locatingUser = false,
}) => {
  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    (typeof window !== 'undefined' && (window as any).VITE_GOOGLE_MAPS_API_KEY) ||
    '';

  // Map viewport center & zoom calculation
  const mapCenter = useMemo(() => {
    if (selectedAgentId) {
      const selected = agents.find((a) => a.id === selectedAgentId);
      if (selected && selected.lat && selected.lng) {
        return { lat: Number(selected.lat), lng: Number(selected.lng) };
      }
    }
    if (mapType === 'bangladesh') {
      return { lat: 23.685, lng: 90.3563 };
    }
    return { lat: 20, lng: 20 };
  }, [selectedAgentId, mapType, agents]);

  const mapZoom = useMemo(() => {
    if (selectedAgentId) return 13;
    return mapType === 'bangladesh' ? 7 : 2;
  }, [selectedAgentId, mapType]);

  const selectedAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

  return (
    <div className="w-full space-y-3">
      {/* Map Card Header with Map View Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-2.5xl border border-slate-200/60 shadow-xs">
        <button
          type="button"
          onClick={() => {
            onSelectAgent(null);
            onMapTypeChange('world');
          }}
          className={`flex-1 py-2.5 rounded-2xl text-[11px] font-black tracking-wide flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            mapType === 'world'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Globe className="w-3.5 h-3.5 shrink-0" /> ওয়ার্ল্ড ম্যাপ
        </button>
        <button
          type="button"
          onClick={() => {
            onSelectAgent(null);
            onMapTypeChange('bangladesh');
          }}
          className={`flex-1 py-2.5 rounded-2xl text-[11px] font-black tracking-wide flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            mapType === 'bangladesh'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" /> বাংলাদেশ ম্যাপ
        </button>
      </div>

      {/* Main Google Maps Container */}
      <div className="relative w-full h-[400px] sm:h-[450px] rounded-3xl overflow-hidden border border-emerald-900/20 shadow-md bg-slate-900">
        {!apiKey ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-white space-y-3">
            <Compass className="w-10 h-10 text-emerald-400 animate-spin" />
            <h3 className="text-sm font-black text-emerald-300">Google Maps Integration Active</h3>
            <p className="text-xs text-slate-300 max-w-sm font-medium">
              গুগল ম্যাপস লোড হচ্ছে...
            </p>
          </div>
        ) : (
          <APIProvider apiKey={apiKey}>
            <Map
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              defaultCenter={mapCenter}
              defaultZoom={mapZoom}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            >
              <MapCameraController center={mapCenter} zoom={mapZoom} />

              {/* User Current Location Marker */}
              {userLocation && (
                <AdvancedMarker
                  position={{ lat: userLocation.lat, lng: userLocation.lng }}
                  title="আপনার বর্তমান অবস্থান"
                >
                  <div className="relative flex items-center justify-center">
                    <span className="absolute w-8 h-8 bg-sky-500/40 rounded-full animate-ping" />
                    <div className="w-6 h-6 bg-sky-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-[10px] font-black">
                      📍
                    </div>
                  </div>
                </AdvancedMarker>
              )}

              {/* Agent Custom Circular Avatar Markers */}
              {agents.map((agent) => {
                if (!agent.lat || !agent.lng) return null;
                const isSelected = selectedAgentId === agent.id;
                const avatarSrc =
                  agent.img ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                    agent.name || agent.id
                  )}`;

                return (
                  <AdvancedMarker
                    key={agent.id}
                    position={{ lat: Number(agent.lat), lng: Number(agent.lng) }}
                    title={agent.name}
                    onClick={() => onSelectAgent(agent.id)}
                  >
                    <div
                      className={`relative group cursor-pointer transition-transform duration-200 ${
                        isSelected ? 'scale-125 z-50' : 'hover:scale-115 z-10'
                      }`}
                    >
                      {/* Outer pulse ring for active agents */}
                      <span className="absolute -inset-1 bg-emerald-400/40 rounded-full animate-pulse blur-2xs" />

                      {/* Circular Avatar Frame */}
                      <div className="relative w-11 h-11 rounded-full border-2 border-emerald-500 overflow-hidden bg-white shadow-md shadow-slate-900/30 flex items-center justify-center">
                        <img
                          src={avatarSrc}
                          alt={agent.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://api.dicebear.com/7.x/avataaars/svg?seed=agent';
                          }}
                        />
                      </div>

                      {/* Small Active Badge Dot */}
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs" />
                    </div>
                  </AdvancedMarker>
                );
              })}

              {/* Selected Agent InfoWindow Popup */}
              {selectedAgent && selectedAgent.lat && selectedAgent.lng && (
                <InfoWindow
                  position={{
                    lat: Number(selectedAgent.lat),
                    lng: Number(selectedAgent.lng),
                  }}
                  onCloseClick={() => onSelectAgent(null)}
                  pixelOffset={[0, -20]}
                >
                  <div className="p-1 min-w-[200px] max-w-[260px] space-y-2 text-slate-800 font-sans">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={
                          selectedAgent.img ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                            selectedAgent.name
                          )}`
                        }
                        alt={selectedAgent.name}
                        className="w-10 h-10 rounded-full object-cover border border-emerald-500 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-slate-900 truncate">
                          {selectedAgent.name}
                        </h4>
                        <p className="text-[10px] text-emerald-700 font-bold">
                          {selectedAgent.country || 'বাংলাদেশ'} • {selectedAgent.city || selectedAgent.district || 'এজেন্ট'}
                        </p>
                        {selectedAgent.distanceKm != null && (
                          <span className="inline-block mt-0.5 text-[9px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded-full">
                            📏 {selectedAgent.distanceKm.toFixed(1)} কি.মি. দূরত্বে
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <a
                        href={`tel:${selectedAgent.phone}`}
                        className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg flex items-center gap-1 hover:bg-emerald-700 transition"
                      >
                        <Phone className="w-3 h-3" /> কল করুন
                      </a>
                      {selectedAgent.whatsapp && (
                        <a
                          href={`https://wa.me/${selectedAgent.whatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-[#25D366] text-white font-bold rounded-lg flex items-center gap-1 hover:bg-emerald-600 transition"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        )}

        {/* Top-Right GPS Action Floating Button */}
        <div className="absolute top-3 right-3 z-20">
          <button
            type="button"
            onClick={onRequestUserLocation}
            disabled={locatingUser}
            className="px-3 py-2 bg-white/95 hover:bg-white text-slate-800 rounded-2xl text-[10.5px] font-black shadow-md border border-slate-200/80 flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Navigation
              className={`w-3.5 h-3.5 text-emerald-600 ${locatingUser ? 'animate-spin' : 'animate-pulse'}`}
            />
            <span>{locatingUser ? 'খুঁজছে...' : 'আমার জিপিএস লোকেশন'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleAgentMap;
