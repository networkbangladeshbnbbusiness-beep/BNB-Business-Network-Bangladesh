// Source: Google Maps Platform Code Assist
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  Phone,
  Globe,
  Clock,
  AlertTriangle,
  Maximize2,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';

export interface AgentLocationData {
  id: string;
  agentCode?: string;
  badgeLabel?: string;
  name: string;
  country: string;
  city: string;
  address: string;
  openingHours?: string;
  scheduleStatusLabel?: string;
  scheduleState?: 'open' | 'break' | 'closed' | 'unknown';
  todayHours?: string;
  closedDaysLabel?: string;
  phone: string;
  whatsapp?: string;
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
  isFullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
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

function formatBanglaDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.max(10, Math.round(distanceKm * 1000))} মিটার`;
  }
  return `${distanceKm.toFixed(1)} কি.মি.`;
}

function formatBanglaEta(distanceKm: number): string {
  if (distanceKm < 2) {
    const mins = Math.max(1, Math.round((distanceKm / 4.5) * 60));
    return `প্রায় ${mins} মিনিট (হাঁটা পথ)`;
  }
  const mins = Math.max(2, Math.round((distanceKm / 25) * 60));
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `প্রায় ${hrs} ঘণ্টা ${rem} মিনিট (গাড়ি/বাইক)` : `প্রায় ${hrs} ঘণ্টা (গাড়ি/বাইক)`;
  }
  return `প্রায় ${mins} মিনিট (গাড়ি/বাইক)`;
}

function buildGoogleMapsDirectionsUrl(
  agentLat: number,
  agentLng: number,
  userLocation: { lat: number; lng: number } | null
): string {
  const originParam = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : '';
  return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${agentLat},${agentLng}&travelmode=driving`;
}

function buildGoogleMapsPlaceUrl(agentLat: number, agentLng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${agentLat},${agentLng}`;
}

function AgentAvatarPin({
  agent,
  isSelected,
}: {
  agent: AgentLocationData;
  isSelected: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [agent.img]);

  const initial = (agent.name || 'A').trim().charAt(0).toUpperCase();
  const hasImage = Boolean(agent.img && agent.img.trim().length > 5 && !imgFailed);

  if (isSelected) {
    return (
      <div className="relative flex flex-col items-center cursor-pointer z-50 transition-transform duration-200 scale-110">
        <div className="px-2 py-0.5 mb-1 bg-[#1E3A8A] text-white text-[10px] font-black rounded-md shadow-md whitespace-nowrap border border-white max-w-[140px] truncate">
          {agent.name}
        </div>
        <div className="relative flex items-center justify-center">
          <span className="absolute w-14 h-14 bg-orange-500/35 rounded-full animate-ping" />
          <div className="w-12 h-12 rounded-full border-[3px] border-orange-500 bg-[#1E3A8A] shadow-xl overflow-hidden flex items-center justify-center ring-2 ring-white">
            {hasImage ? (
              <img
                src={agent.img}
                alt={agent.name}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-black text-white">{initial}</span>
            )}
          </div>
        </div>
        <div className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] border-t-orange-500 -mt-0.5" />
      </div>
    );
  }

  return (
    <div className="relative group cursor-pointer transition-transform duration-200 hover:scale-110 z-10 flex flex-col items-center">
      <div className="w-10 h-10 rounded-full border-[2.5px] border-white bg-[#0D9488] shadow-lg overflow-hidden flex items-center justify-center ring-2 ring-[#1E40AF]">
        {hasImage ? (
          <img
            src={agent.img}
            alt={agent.name}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs font-black text-white">{initial}</span>
        )}
      </div>
      <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-[#1E40AF] -mt-0.5" />
    </div>
  );
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
  const prevCenterRef = useRef<string>('');

  useEffect(() => {
    if (loadingStatus === APILoadingStatus.AUTH_FAILURE) {
      onStatusError('AUTH_FAILURE');
    } else if (loadingStatus === APILoadingStatus.FAILED) {
      onStatusError('FAILED');
    }
  }, [loadingStatus, onStatusError]);

  useEffect(() => {
    if (!map) return;
    onMapReady();
    if (center) {
      const signature = `${center.lat.toFixed(5)}:${center.lng.toFixed(5)}:${zoom}`;
      if (prevCenterRef.current !== signature) {
        prevCenterRef.current = signature;
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
  isFullscreen: controlledFullscreen,
  onFullscreenChange,
}) => {
  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    (typeof process !== 'undefined' &&
      process.env &&
      (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY)) ||
    'AIzaSyBsEZaLW1kpzMu2QP-T8IrdmkZqiM3gfe8';

  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isFullscreen =
    controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen;

  const setFullscreen = useCallback(
    (next: boolean) => {
      if (onFullscreenChange) {
        onFullscreenChange(next);
      }
      if (controlledFullscreen === undefined) {
        setInternalFullscreen(next);
      }
    },
    [controlledFullscreen, onFullscreenChange]
  );

  // Allow Escape key to exit full-screen map
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, setFullscreen]);

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

  useEffect(() => {
    if (!apiKey || mapLoaded || authFailed) return;
    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [apiKey, mapLoaded, authFailed]);

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

  const mapCenter = useMemo(() => {
    if (selectedAgent && selectedAgent.lat && selectedAgent.lng) {
      return { lat: Number(selectedAgent.lat), lng: Number(selectedAgent.lng) };
    }
    if (userLocation && mapType === 'bangladesh') {
      return { lat: userLocation.lat, lng: userLocation.lng };
    }
    if (mapType === 'bangladesh') {
      return { lat: 23.685, lng: 90.356 };
    }
    return { lat: 20, lng: 20 };
  }, [selectedAgent, userLocation, mapType]);

  const mapZoom = useMemo(() => {
    if (selectedAgent && selectedAgent.lat && selectedAgent.lng) {
      return 16;
    }
    if (userLocation && mapType === 'bangladesh') {
      return 12;
    }
    return mapType === 'bangladesh' ? 7 : 2;
  }, [selectedAgent, userLocation, mapType]);

  const renderMapViewport = () => (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[150] w-screen h-screen bg-white overflow-hidden'
          : 'relative w-full h-[400px] sm:h-[450px] rounded-3xl overflow-hidden border border-emerald-900/20 shadow-md bg-white'
      }
    >
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
            libraries={['marker']}
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
              fullscreenControl={false}
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

              {/* User Current Location Marker */}
              {userLocation && (
                <AdvancedMarker
                  position={{ lat: userLocation.lat, lng: userLocation.lng }}
                  title="আপনার বর্তমান অবস্থান"
                  zIndex={90}
                >
                  <div className="relative flex items-center justify-center">
                    <span className="absolute w-8 h-8 bg-sky-500/40 rounded-full animate-ping" />
                    <div className="w-6 h-6 bg-sky-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-[10px] font-black">
                      📍
                    </div>
                  </div>
                </AdvancedMarker>
              )}

              {/* Approved Agent Profile-Avatar Markers */}
              {visibleAgents.map((agent, index) => {
                if (!agent.lat || !agent.lng) return null;
                const isSelected = selectedAgentId === agent.id;

                return (
                  <AdvancedMarker
                    key={agent.id}
                    position={{ lat: Number(agent.lat), lng: Number(agent.lng) }}
                    title={agent.name}
                    zIndex={isSelected ? 100 : index + 1}
                    onClick={() => onSelectAgent(agent.id)}
                  >
                    <AgentAvatarPin agent={agent} isSelected={isSelected} />
                  </AdvancedMarker>
                );
              })}

              {/* Selected Agent InfoWindow Popup with Profile Photo, Distance, ETA & Direct Google Maps Link */}
              {selectedAgent && selectedAgent.lat && selectedAgent.lng && (
                <InfoWindow
                  position={{
                    lat: Number(selectedAgent.lat),
                    lng: Number(selectedAgent.lng),
                  }}
                  onCloseClick={() => onSelectAgent(null)}
                  pixelOffset={[0, -52]}
                >
                  <div className="p-1 min-w-[230px] max-w-[285px] space-y-2 text-slate-800 font-sans">
                    <div className="flex items-start gap-2.5">
                      {selectedAgent.img ? (
                        <img
                          src={selectedAgent.img}
                          alt={selectedAgent.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border-2 border-[#0D9488] shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#0D9488] text-white font-black flex items-center justify-center shrink-0">
                          {(selectedAgent.name || 'A').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-200">
                          {selectedAgent.badgeLabel || `এজেন্ট পয়েন্ট • ${selectedAgent.agentCode || 'AG-2041'}`}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 leading-snug">
                          {selectedAgent.name}
                        </h4>
                      </div>
                    </div>

                    <div className="space-y-1 text-[10.5px]">
                      <p className="text-slate-700 font-semibold leading-snug break-words">
                        📍 {selectedAgent.address || [selectedAgent.city, selectedAgent.country].filter(Boolean).join(', ')}
                      </p>

                      {userLocation &&
                      selectedAgent.distanceKm != null &&
                      !isNaN(selectedAgent.distanceKm) ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-emerald-900 font-black space-y-0.5">
                          <p className="text-[10.5px]">
                            📏 দূরত্ব: {formatBanglaDistance(selectedAgent.distanceKm)}
                          </p>
                          <p className="text-[9.5px] font-bold text-emerald-700">
                            ⏱️ যেতে সময়: {formatBanglaEta(selectedAgent.distanceKm)}
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={onRequestUserLocation}
                          className="w-full text-left bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-2 py-1 text-[9.5px] font-black text-amber-800 cursor-pointer transition"
                        >
                          📡 আপনার থেকে দূরত্ব দেখতে এখানে ট্যাপ করুন
                        </button>
                      )}

                      {(selectedAgent.todayHours || selectedAgent.openingHours) && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 space-y-0.5">
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-700 font-black flex items-center gap-1">
                              <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>আজকের সময়:</span>
                            </span>
                            {selectedAgent.scheduleStatusLabel && (
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                                  selectedAgent.scheduleState === 'open'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : selectedAgent.scheduleState === 'break'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : selectedAgent.scheduleState === 'closed'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {selectedAgent.scheduleStatusLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-[9.5px] text-slate-700 font-bold leading-snug">
                            {selectedAgent.todayHours || selectedAgent.openingHours}
                          </p>
                          {selectedAgent.closedDaysLabel && (
                            <p className="text-[9px] text-rose-600 font-bold">
                              📅 {selectedAgent.closedDaysLabel}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-[10.5px] text-emerald-700 font-mono font-extrabold">
                        📞 {selectedAgent.phone}
                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-1.5 text-[10px]">
                      <a
                        href={`tel:${selectedAgent.phone}`}
                        className="px-2 py-1.5 bg-emerald-600 text-white font-black rounded-lg flex items-center justify-center gap-1 hover:bg-emerald-700 transition text-center"
                      >
                        <Phone className="w-3 h-3 shrink-0" /> কল করুন
                      </a>
                      <a
                        href={buildGoogleMapsDirectionsUrl(
                          selectedAgent.lat,
                          selectedAgent.lng,
                          userLocation
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1.5 bg-[#1E3A8A] text-white font-black rounded-lg flex items-center justify-center gap-1 hover:bg-blue-900 transition text-center"
                      >
                        <Navigation className="w-3 h-3 shrink-0" /> গুগল ম্যাপ পথ
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

      {/* Floating Map Top Controls */}
      {isFullscreen ? (
        /* Full-Screen Pure Map Top Bar Controls */
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="px-3 py-2 bg-slate-900/90 hover:bg-slate-900 text-white rounded-2xl text-[11px] font-black shadow-lg border border-white/20 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>বের হন</span>
            </button>
            <div className="bg-white/95 p-0.5 rounded-2xl shadow-md border border-slate-200 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  onSelectAgent(null);
                  onMapTypeChange('world');
                }}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition cursor-pointer ${
                  mapType === 'world' ? 'bg-[#0D9488] text-white' : 'text-slate-700'
                }`}
              >
                ওয়ার্ল্ড
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectAgent(null);
                  onMapTypeChange('bangladesh');
                }}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition cursor-pointer ${
                  mapType === 'bangladesh' ? 'bg-[#0D9488] text-white' : 'text-slate-700'
                }`}
              >
                বাংলাদেশ
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onRequestUserLocation}
            disabled={locatingUser}
            className="pointer-events-auto px-3 py-2 bg-white/95 hover:bg-white text-slate-800 rounded-2xl text-[10.5px] font-black shadow-lg border border-slate-200/80 flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Navigation
              className={`w-3.5 h-3.5 text-emerald-600 ${locatingUser ? 'animate-spin' : 'animate-pulse'}`}
            />
            <span>{locatingUser ? 'খুঁজছে...' : 'আমার জিপিএস লোকেশন'}</span>
          </button>
        </div>
      ) : (
        /* Embedded Map Controls: Top-Right GPS Button + Bottom-Right "সরাসরি ম্যাপে ঢুকুন" */
        <>
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRequestUserLocation}
              disabled={locatingUser}
              className="px-2.5 py-1.5 bg-white/95 hover:bg-white text-slate-800 rounded-2xl text-[10px] font-black shadow-md border border-slate-200/80 flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Navigation
                className={`w-3.5 h-3.5 text-emerald-600 ${locatingUser ? 'animate-spin' : 'animate-pulse'}`}
              />
              <span>{locatingUser ? 'খুঁজছে...' : 'আমার জিপিএস লোকেশন'}</span>
            </button>
          </div>

          <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="px-3 py-1.5 bg-[#0D9488] hover:bg-[#0B7A70] text-white rounded-2xl text-[10.5px] font-black shadow-lg border border-white/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />
              <span>সরাসরি ম্যাপে ঢুকুন</span>
            </button>

            <a
              href={
                selectedAgent
                  ? buildGoogleMapsDirectionsUrl(
                      selectedAgent.lat,
                      selectedAgent.lng,
                      userLocation
                    )
                  : buildGoogleMapsPlaceUrl(mapCenter.lat, mapCenter.lng)
              }
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-white/95 hover:bg-white text-[#1E3A8A] rounded-2xl text-[10px] font-black shadow-md border border-blue-200 flex items-center gap-1 transition active:scale-95"
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span>গুগল ম্যাপে দেখুন</span>
            </a>
          </div>
        </>
      )}

      {/* Corner Distance & Google Maps Navigation Pill when an agent is selected */}
      {selectedAgent && (
        <div
          className={`absolute ${
            isFullscreen ? 'bottom-4 left-3 right-14 sm:right-auto sm:max-w-sm' : 'bottom-12 left-3'
          } z-20 bg-[#1E3A8A]/95 text-white px-3 py-2 rounded-2xl shadow-lg border border-white/25 flex items-center justify-between gap-2.5 text-[10.5px] font-black`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-black">{selectedAgent.name}</p>
              {userLocation &&
              selectedAgent.distanceKm != null &&
              !isNaN(selectedAgent.distanceKm) ? (
                <p className="text-[9.5px] text-emerald-200 font-bold truncate">
                  দূরত্ব: {formatBanglaDistance(selectedAgent.distanceKm)} •{' '}
                  {formatBanglaEta(selectedAgent.distanceKm)}
                </p>
              ) : (
                <p className="text-[9.5px] text-amber-200 font-bold truncate">
                  সরাসরি রুট দেখতে ডিরেকশন চাপুন
                </p>
              )}
            </div>
          </div>
          <a
            href={buildGoogleMapsDirectionsUrl(
              selectedAgent.lat,
              selectedAgent.lng,
              userLocation
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-xl text-[9.5px] font-black shrink-0 flex items-center gap-1"
          >
            <Navigation className="w-3 h-3" />
            <span>যান</span>
          </a>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full space-y-3">
      {/* Map Card Header with Map View Toggle (Hidden in pure fullscreen mode) */}
      {!isFullscreen && (
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
      )}

      {/* Main / Fullscreen Google Maps Container */}
      {renderMapViewport()}
    </div>
  );
};

export default GoogleAgentMap;
