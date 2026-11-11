// Source: Google Maps Platform Code Assist
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Phone, Globe, Clock, AlertTriangle } from 'lucide-react';

export interface AgentLocationData {
  id: string;
  agentCode?: string;
  badgeLabel?: string;
  name: string;
  country: string;
  city: string;
  address: string;
  openingHours?: string;
  phone: string;
  lat: number;
  lng: number;
  img?: string;
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

function isBangladeshAgent(agent: AgentLocationData): boolean {
  const c = (agent.country || '').toLowerCase().trim();
  if (
    c === 'bangladesh' ||
    c === 'বাংলাদেশ' ||
    c === 'bd' ||
    c.includes('bangladesh') ||
    c.includes('বাংলাদেশ')
  ) {
    return true;
  }
  if (!c) {
    const lat = Number(agent.lat);
    const lng = Number(agent.lng);
    if (lat >= 20.5 && lat <= 26.7 && lng >= 88.0 && lng <= 92.7) {
      return true;
    }
  }
  return false;
}

// Controller to smoothly pan and zoom map camera when selected agent or mapType changes
function MapCameraController({
  center,
  zoom,
  onMapReady,
  onStatusError,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  onMapReady: () => void;
  onStatusError: (status: string) => void;
}) {
  const map = useMap();
  const loadingStatus = useApiLoadingStatus();

  useEffect(() => {
    if (loadingStatus === APILoadingStatus.AUTH_FAILURE) {
      onStatusError('AUTH_FAILURE');
    } else if (loadingStatus === APILoadingStatus.FAILED) {
      onStatusError('FAILED');
    }
  }, [loadingStatus, onStatusError]);

  useEffect(() => {
    if (map) {
      onMapReady();
      if (center) {
        map.panTo(center);
        map.setZoom(zoom);
      }
    }
  }, [map, center, zoom, onMapReady]);

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
    (typeof process !== 'undefined' &&
      process.env &&
      (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY)) ||
    '';

  const [mapLoaded, setMapLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loaderErrorMsg, setLoaderErrorMsg] = useState<string>('');

  // Redact API key from any error message so the key is NEVER shown on screen or in logs
  const sanitizeLoaderError = useCallback(
    (err: unknown): string => {
      const raw =
        err instanceof Error
          ? `${err.name ? `${err.name}: ` : ''}${err.message}`
          : typeof err === 'string'
            ? err
            : err && typeof err === 'object' && 'message' in err
              ? String((err as { message?: unknown }).message || '')
              : '';
      let cleaned = raw.trim();
      if (!cleaned) return '';
      if (apiKey) {
        cleaned = cleaned.split(apiKey).join('[REDACTED]');
      }
      cleaned = cleaned.replace(/key=[^&\s"']+/gi, 'key=[REDACTED]');
      return cleaned;
    },
    [apiKey]
  );

  const handleMapReady = useCallback(() => {
    setMapLoaded(true);
    setTimedOut(false);
  }, []);

  const handleStatusError = useCallback((status: string) => {
    if (status === 'AUTH_FAILURE') {
      setAuthFailed(true);
      setLoaderErrorMsg((prev) => prev || 'APILoadingStatus: AUTH_FAILURE');
    } else if (status === 'FAILED') {
      setLoadFailed(true);
      setLoaderErrorMsg((prev) => prev || 'APILoadingStatus: FAILED');
    }
  }, []);

  // 3. Set window.gm_authFailure to detect Google Maps authentication failure
  useEffect(() => {
    if (!apiKey || typeof window === 'undefined') return;
    const w = window as unknown as { gm_authFailure?: () => void };
    const previousHandler = w.gm_authFailure;

    w.gm_authFailure = () => {
      setAuthFailed(true);
      setLoaderErrorMsg(
        (prev) => prev || 'Google Maps API authentication failed (gm_authFailure)'
      );
      if (typeof previousHandler === 'function') {
        try {
          previousHandler();
        } catch {
          // ignore secondary error
        }
      }
    };

    return () => {
      w.gm_authFailure = previousHandler;
    };
  }, [apiKey]);

  // 2. 10-second timeout if map does not finish loading
  useEffect(() => {
    if (!apiKey || mapLoaded || authFailed) return;
    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [apiKey, mapLoaded, authFailed]);

  // Filter visible agents based on map tab:
  // - 'world': all approved agents worldwide
  // - 'bangladesh': only approved agents in Bangladesh
  const visibleAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (
        !agent ||
        typeof agent.lat !== 'number' ||
        typeof agent.lng !== 'number' ||
        isNaN(agent.lat) ||
        isNaN(agent.lng) ||
        (agent.lat === 0 && agent.lng === 0)
      ) {
        return false;
      }
      if (mapType === 'bangladesh') {
        return isBangladeshAgent(agent);
      }
      return true;
    });
  }, [agents, mapType]);

  const selectedAgent = useMemo(() => {
    if (!selectedAgentId) return null;
    return (
      visibleAgents.find((a) => a.id === selectedAgentId) ||
      agents.find((a) => a.id === selectedAgentId) ||
      null
    );
  }, [visibleAgents, agents, selectedAgentId]);

  // Map viewport center & street-level zoom (17) when an agent is selected
  const mapCenter = useMemo(() => {
    if (selectedAgent && selectedAgent.lat && selectedAgent.lng) {
      return { lat: Number(selectedAgent.lat), lng: Number(selectedAgent.lng) };
    }
    if (mapType === 'bangladesh') {
      return { lat: 23.685, lng: 90.356 };
    }
    return { lat: 20, lng: 20 };
  }, [selectedAgent, mapType]);

  const mapZoom = useMemo(() => {
    if (selectedAgent && selectedAgent.lat && selectedAgent.lng) {
      return 17;
    }
    return mapType === 'bangladesh' ? 7 : 2;
  }, [selectedAgent, mapType]);

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

      {/* Main Google Maps Container (light/clean map style preserved) */}
      <div className="relative w-full h-[400px] sm:h-[450px] rounded-3xl overflow-hidden border border-emerald-900/20 shadow-md bg-white">
        {!apiKey ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-50 text-slate-700 space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-600" />
            <h3 className="text-sm font-black text-rose-700">
              ম্যাপ key পাওয়া যায়নি (প্রোডাকশন বিল্ডে key নেই)
            </h3>
          </div>
        ) : (
          <>
            <APIProvider
              apiKey={apiKey}
              onLoad={() => {
                setTimedOut(false);
              }}
              onError={(err: unknown) => {
                setLoadFailed(true);
                const msg = sanitizeLoaderError(err);
                if (msg) {
                  setLoaderErrorMsg(msg);
                }
              }}
            >
              <Map
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={[
                  'gmp_mcp_codeassist_v1_aistudio',
                  'gmp_git_agentskills_v1',
                ]}
                defaultCenter={mapCenter}
                defaultZoom={mapZoom}
                gestureHandling="greedy"
                disableDefaultUI={false}
                onTilesLoaded={handleMapReady}
                onIdle={handleMapReady}
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              >
                <MapCameraController
                  center={mapCenter}
                  zoom={mapZoom}
                  onMapReady={handleMapReady}
                  onStatusError={handleStatusError}
                />

              {/* User Current Location Marker (only when requested via 'আমার জিপিএস লোকেশন') */}
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

              {/* Approved Agent Static Markers (Dark Blue Pin when selected) */}
              {visibleAgents.map((agent) => {
                if (!agent.lat || !agent.lng) return null;
                const isSelected = selectedAgentId === agent.id;

                return (
                  <AdvancedMarker
                    key={agent.id}
                    position={{ lat: Number(agent.lat), lng: Number(agent.lng) }}
                    title={agent.name}
                    onClick={() => onSelectAgent(agent.id)}
                  >
                    {isSelected ? (
                      /* Dark Blue Pin on Selection */
                      <div className="relative flex flex-col items-center cursor-pointer z-50 transition-transform duration-200 scale-110">
                        <div className="px-2 py-0.5 mb-1 bg-[#1E3A8A] text-white text-[10px] font-black rounded-md shadow-md whitespace-nowrap border border-white">
                          {agent.name}
                        </div>
                        <div className="relative flex items-center justify-center">
                          <span className="absolute w-10 h-10 bg-blue-900/30 rounded-full animate-ping" />
                          <div className="w-9 h-9 bg-[#1E3A8A] border-2 border-white rounded-full shadow-xl flex items-center justify-center text-white">
                            <MapPin className="w-5 h-5 text-white fill-blue-300" />
                          </div>
                        </div>
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#1E3A8A] -mt-0.5" />
                      </div>
                    ) : (
                      <div className="relative group cursor-pointer transition-transform duration-200 hover:scale-110 z-10 flex flex-col items-center">
                        <div className="w-8 h-8 bg-[#1E40AF] border-2 border-white rounded-full shadow-md flex items-center justify-center text-white">
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-[#1E40AF] -mt-0.5" />
                      </div>
                    )}
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
                  pixelOffset={[0, -38]}
                >
                  <div className="p-1.5 min-w-[215px] max-w-[270px] space-y-2 text-slate-800 font-sans">
                    <div className="space-y-1">
                      <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-200">
                        {selectedAgent.badgeLabel || `এজেন্ট পয়েন্ট • ${selectedAgent.agentCode || 'AG-2041'}`}
                      </span>
                      <h4 className="text-xs font-black text-slate-900">
                        {selectedAgent.name}
                      </h4>
                      <p className="text-[10.5px] text-slate-700 font-semibold leading-snug break-words">
                        📍 {selectedAgent.address || [selectedAgent.city, selectedAgent.country].filter(Boolean).join(', ')}
                      </p>
                      {selectedAgent.openingHours && (
                        <p className="text-[10px] text-slate-600 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{selectedAgent.openingHours}</span>
                        </p>
                      )}
                      <p className="text-[10.5px] text-emerald-700 font-mono font-extrabold">
                        📞 {selectedAgent.phone}
                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[10.5px]">
                      <a
                        href={`tel:${selectedAgent.phone}`}
                        className="px-2.5 py-1.5 bg-emerald-600 text-white font-bold rounded-lg flex items-center justify-center gap-1 hover:bg-emerald-700 transition flex-1 text-center"
                      >
                        <Phone className="w-3 h-3 shrink-0" /> কল করুন
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedAgent.lat},${selectedAgent.lng}&travelmode=driving`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 bg-[#1E3A8A] text-white font-bold rounded-lg flex items-center justify-center gap-1 hover:bg-blue-900 transition flex-1 text-center"
                      >
                        <Navigation className="w-3 h-3 shrink-0" /> দিকনির্দেশনা (Map)
                      </a>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>

            {(authFailed || ((timedOut || loadFailed) && !mapLoaded)) && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-slate-50/95 text-slate-700 space-y-2.5">
                <AlertTriangle className="w-10 h-10 text-rose-600 shrink-0" />
                <h3 className="text-sm font-black text-rose-700">
                  {authFailed
                    ? 'Google key অনুমোদিত নয় (referrer/API/billing সমস্যা)'
                    : 'ম্যাপ লোড হয়নি, নেটওয়ার্ক বা key সমস্যা হতে পারে'}
                </h3>
                {loaderErrorMsg && (
                  <p className="text-[11px] text-slate-500 max-w-md font-mono break-words bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    {loaderErrorMsg}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Top-Right GPS Action Floating Button (kept as-is) */}
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

        {/* Corner Distance Badge when an agent is selected AND user GPS is permitted */}
        {selectedAgent &&
          userLocation &&
          selectedAgent.distanceKm != null &&
          !isNaN(selectedAgent.distanceKm) && (
            <div className="absolute bottom-3 left-3 z-20 bg-[#1E3A8A]/95 text-white px-3 py-1.5 rounded-2xl shadow-lg border border-white/20 flex items-center gap-1.5 text-[11px] font-black">
              <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>
                দূরত্ব: {selectedAgent.distanceKm < 1
                  ? `${Math.round(selectedAgent.distanceKm * 1000)} মিটার`
                  : `${selectedAgent.distanceKm.toFixed(1)} কি.মি.`}
              </span>
            </div>
          )}
      </div>
    </div>
  );
};

export default GoogleAgentMap;
