import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Compass, Eye, MapPin, Maximize, X, Locate, Navigation } from 'lucide-react';
import type { Property } from '../../types/types';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface PropertyMapProps {
  properties: Property[];
  focusProperty?: Property | null;
  onSelectProperty?: (property: Property) => void;
  initialMapStyle?: 'standard' | 'satellite';
  mapTitle?: string;
  mapSubtitle?: string;
  recenterLabel?: string;
  focusZoom?: number;
  scrollWheelZoom?: boolean;
}

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

const getPropertyLabel = (property: Property) => property.title ?? property.name ?? 'Property';

const getLotSize = (property: Property) => property.size ?? property.lotSize ?? 0;

const MapUpdater: React.FC<{ focusProperty?: Property | null; focusZoom: number }> = ({
  focusProperty,
  focusZoom,
}) => {
  const map = useMap();

  useEffect(() => {
    const timers = [0, 100, 300].map((delay) =>
      window.setTimeout(() => {
        map.invalidateSize({ animate: false });

        if (focusProperty) {
          map.setView([focusProperty.lat, focusProperty.lng], focusZoom, {
            animate: delay !== 0,
            duration: 0.8,
          });
        }
      }, delay),
    );

    return () => {
      timers.forEach(window.clearTimeout);
    };
  }, [focusProperty, focusZoom, map]);

  return null;
};

const hasValidCoords = (lat: number, lng: number) =>
  typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng);

const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number | null => {
  if (!hasValidCoords(lat1, lon1) || !hasValidCoords(lat2, lon2)) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const result = R * c;
  return isFinite(result) ? result : null;
};

const getCustomIcon = (property: Property, isFocused: boolean) => {
  const color = isFocused ? '#1C3A27' : '#4f6f5f';
  const label = getPropertyLabel(property);

  return L.divIcon({
    html: `
      <div class="flex flex-col items-center select-none cursor-pointer">
        <div class="px-2 py-0.5 bg-slate-900/95 text-white text-[9px] font-bold rounded shadow border border-slate-700 whitespace-nowrap mb-1">
          ${label}
        </div>
        <div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg transition-all ${isFocused ? 'scale-125 ring-4 ring-emerald-400/50' : 'hover:scale-110'}" style="background-color: ${color};">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
        </div>
      </div>
    `,
    className: 'custom-div-icon',
    iconSize: [140, 64],
    iconAnchor: [70, 56],
  });
};

const getStartIcon = () => {
  return L.divIcon({
    html: `
      <div class="flex flex-col items-center select-none cursor-grab active:cursor-grabbing">
        <div class="px-2.5 py-1 bg-amber-600 text-white text-[9px] font-black rounded-lg shadow-md border border-amber-500 whitespace-nowrap mb-1 transition-all text-center uppercase tracking-wider">
          Drag Your Location
        </div>
        <div class="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center border-2 border-white shadow-xl animate-bounce">
          <div class="w-3.5 h-3.5 rounded-full bg-amber-700 flex items-center justify-center border border-white">
            <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
          </div>
        </div>
      </div>
    `,
    className: 'start-div-icon',
    iconSize: [120, 56],
    iconAnchor: [60, 48],
  });
};

const MapClickHandler: React.FC<{
  isActive: boolean;
  onSetLocation: (lat: number, lng: number) => void;
}> = ({ isActive, onSetLocation }) => {
  useMapEvents({
    click(e) {
      if (isActive) {
        onSetLocation(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  focusProperty,
  onSelectProperty,
  initialMapStyle = 'standard',
  mapTitle = 'Live Property View',
  mapSubtitle = 'Click markers to inspect nearby listings',
  recenterLabel = 'Re-center map',
  focusZoom = 15,
  scrollWheelZoom = false,
}) => {
  const defaultCenter: [number, number] = [13.9483, 120.723];
  const [selectedMapProperty, setSelectedMapProperty] = useState<Property | null>(focusProperty ?? null);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite'>(initialMapStyle);

  const [startLat, setStartLat] = useState<number>(13.9448);
  const [startLng, setStartLng] = useState<number>(120.7265);
  const [startName, setStartName] = useState<string>('WalterMart Balayan');
  const [startOption, setStartOption] = useState<string>('waltermart');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');
  const [isPickingLocation, setIsPickingLocation] = useState<boolean>(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState<boolean>(false);
  const [hasPromptedLocation, setHasPromptedLocation] = useState<boolean>(false);

  useEffect(() => {
    setMapStyle(initialMapStyle);
  }, [initialMapStyle]);

  useEffect(() => {
    if (focusProperty) {
      setSelectedMapProperty((prev) =>
        prev?.id === focusProperty.id ? prev : focusProperty
      );
    } else {
      setSelectedMapProperty(null);
    }
  }, [focusProperty]);

  useEffect(() => {
    if (selectedMapProperty && !hasPromptedLocation && startOption !== 'gps') {
      setShowLocationPrompt(true);
    }
  }, [selectedMapProperty, hasPromptedLocation, startOption]);

  let distanceText = '';
  if (selectedMapProperty && hasValidCoords(selectedMapProperty.lat, selectedMapProperty.lng)) {
    const d = calculateHaversineDistance(startLat, startLng, selectedMapProperty.lat, selectedMapProperty.lng);
    if (d !== null) {
      distanceText = d < 1
        ? `${Math.round(d * 1000)}m (Est. ${Math.round((d / 30) * 60) || 1} min drive)`
        : `${d.toFixed(2)} km (Est. ${Math.round((d / 30) * 60)} mins drive)`;
    }
  }

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setStartOption('waltermart');
      return;
    }
    setIsLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setStartLat(latitude);
        setStartLng(longitude);
        setStartName('My Current GPS Location');
        setStartOption('gps');
        setIsLocating(false);
      },
      (error) => {
        console.error('GPS error:', error);
        const msg =
          error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. Please allow it in your browser settings.'
            : error.code === error.TIMEOUT
            ? 'Location request timed out. Try again or select a preset.'
            : 'Unable to get your location. Using default starting point.';
        setGpsError(msg);
        setStartOption('waltermart');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSelectStartPreset = (opt: string) => {
    setStartOption(opt);
    if (opt === 'waltermart') {
      setStartLat(13.9448);
      setStartLng(120.7265);
      setStartName('WalterMart Balayan');
    } else if (opt === 'canda') {
      setStartLat(13.9515);
      setStartLng(120.7095);
      setStartName('Canda Elementary School');
    } else if (opt === 'medical') {
      setStartLat(13.9525);
      setStartLng(120.7205);
      setStartName('Medical Center Western Batangas');
    } else if (opt === 'gps') {
      handleLocateMe();
    } else if (opt === 'custom') {
      setIsPickingLocation(true);
    }
  };

  const resetToPrimary = () => {
    const target = focusProperty ?? properties[0];
    if (target) {
      setSelectedMapProperty(target);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#F5F7F6] overflow-hidden flex flex-col font-sans">
      {showLocationPrompt && selectedMapProperty && (
        <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-neutral-100 text-center space-y-4 pointer-events-auto">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <Locate className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-neutral-900 font-serif">
                Calculate Real-time Driving Directions?
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                TerraGuide can use your browser&apos;s GPS coordinates to display instant route navigation and
                driving times to{' '}
                <span className="font-bold text-neutral-800">{getPropertyLabel(selectedMapProperty)}</span>.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setHasPromptedLocation(true);
                  setShowLocationPrompt(false);
                  handleLocateMe();
                }}
                className="w-full bg-[#1C3A27] hover:bg-emerald-800 text-white font-black text-xs py-3 rounded-2xl transition-all cursor-pointer shadow-md border-none"
              >
                Yes, Share My Location
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasPromptedLocation(true);
                  setShowLocationPrompt(false);
                }}
                className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs py-3 rounded-2xl transition-all cursor-pointer border-none"
              >
                No, Keep Default Starting Point
              </button>
            </div>

            <p className="text-[10px] text-neutral-400">
              Your location data is processed securely in your browser and is never stored on our servers.
            </p>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-3 border border-neutral-100 pointer-events-auto select-none">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h4 className="text-[11px] font-extrabold text-[#1C3A27] uppercase tracking-wide">{mapTitle}</h4>
            <p className="text-[9px] text-neutral-500">{mapSubtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetToPrimary}
          className="bg-white hover:bg-neutral-50 text-[#1C3A27] text-[11px] font-extrabold px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-1.5 border border-neutral-100 transition-all cursor-pointer pointer-events-auto active:translate-y-0.5"
        >
          <Compass className="w-3.5 h-3.5 text-emerald-600" />
          {recenterLabel}
        </button>

        <div className="bg-white/95 backdrop-blur-md px-2 py-2 rounded-xl shadow-xl border border-neutral-100 pointer-events-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMapStyle('standard')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all ${mapStyle === 'standard' ? 'bg-[#1C3A27] text-white shadow' : 'text-[#1C3A27] hover:bg-neutral-50'}`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('satellite')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all ${mapStyle === 'satellite' ? 'bg-[#1C3A27] text-white shadow' : 'text-[#1C3A27] hover:bg-neutral-50'}`}
          >
            Satellite
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full z-10 relative">
        <MapContainer
          center={focusProperty ? [focusProperty.lat, focusProperty.lng] : defaultCenter}
          zoom={13}
          scrollWheelZoom={scrollWheelZoom}
          style={{ width: '100%', height: '100%' }}
          zoomControl
        >
          <MapUpdater focusProperty={selectedMapProperty ?? focusProperty ?? null} focusZoom={focusZoom} />

          <MapClickHandler
            isActive={isPickingLocation}
            onSetLocation={(lat, lng) => {
              setStartLat(lat);
              setStartLng(lng);
              setStartName('Custom Pin on Map');
              setStartOption('custom');
              setIsPickingLocation(false);
            }}
          />

          {mapStyle === 'satellite' ? (
            <TileLayer
              attribution="&copy; Google Maps"
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              maxZoom={21}
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}

          {properties.filter((p) => hasValidCoords(p.lat, p.lng)).map((property) => {
            const isFocused = selectedMapProperty?.id === property.id;
            return (
              <Marker
                key={property.id}
                position={[property.lat, property.lng]}
                icon={getCustomIcon(property, isFocused)}
                eventHandlers={{
                  click: () => {
                    setSelectedMapProperty(property);
                    if (onSelectProperty) {
                      onSelectProperty(property);
                    }
                  },
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-1 max-w-[220px] text-slate-800">
                    <h5 className="font-serif text-xs font-bold text-[#1C3A27] leading-tight mb-0.5">
                      {getPropertyLabel(property)}
                    </h5>
                    <p className="text-[10px] text-neutral-600 mb-2">{property.location}</p>
                    <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-1.5 mt-1.5">
                      <span className="text-xs font-bold text-emerald-700">{formatPrice(property.price)}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {selectedMapProperty && (
            <>
              <Marker
                position={[startLat, startLng]}
                draggable
                icon={getStartIcon()}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target as L.Marker;
                    const position = marker.getLatLng();
                    setStartLat(position.lat);
                    setStartLng(position.lng);
                    setStartName('Custom Pin Location');
                    setStartOption('custom');
                  },
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-1 max-w-[180px] font-sans text-neutral-800">
                    <h6 className="font-bold text-amber-600 text-xs uppercase leading-tight mb-1">
                      Your Starting Point
                    </h6>
                    <p className="text-[10px] text-neutral-500 leading-snug">
                      Drag this pin to any point on the map to recalculate directions!
                    </p>
                  </div>
                </Popup>
              </Marker>

              <Polyline
                positions={[
                  [startLat, startLng],
                  [selectedMapProperty.lat, selectedMapProperty.lng],
                ]}
                color="#f59e0b"
                weight={4}
                opacity={0.8}
                dashArray="10, 10"
              />
            </>
          )}
        </MapContainer>

        {selectedMapProperty && (
          <div className="absolute top-24 right-5 z-[1000] bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-neutral-200/55 shadow-2xl max-w-[280px] sm:max-w-xs text-neutral-800 space-y-3 pointer-events-auto">
            <div className="flex items-center gap-1.5 justify-between">
              <div className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                <span className="font-extrabold text-[10px] uppercase tracking-wider text-neutral-500">
                  Route Directions Planner
                </span>
              </div>
              {isPickingLocation && (
                <span className="text-[9px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded-md animate-bounce uppercase tracking-wide">
                  Click Map!
                </span>
              )}
            </div>

            {gpsError && (
              <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 leading-snug">
                {gpsError}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">
                1. Set Starting Point
              </label>
              <div className="flex items-center gap-1">
                <select
                  value={startOption}
                  onChange={(e) => handleSelectStartPreset(e.target.value)}
                  className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-[11px] text-neutral-800 font-semibold cursor-pointer focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="waltermart">WalterMart Balayan</option>
                  <option value="medical">Medical Center Western Batangas</option>
                  <option value="canda">Canda Elementary School</option>
                  <option value="gps">My Live GPS Location</option>
                  <option value="custom">Custom Location Pin</option>
                </select>
                <button
                  type="button"
                  onClick={handleLocateMe}
                  disabled={isLocating}
                  className="p-2 rounded-xl bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 text-emerald-600 disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center shrink-0"
                  title="Get live GPS coordinates"
                >
                  <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsPickingLocation(!isPickingLocation)}
                className={`w-full py-2 rounded-xl text-[10px] font-extrabold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isPickingLocation
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400 animate-pulse'
                    : 'bg-emerald-50/50 hover:bg-emerald-100/50 text-emerald-800 border-emerald-200/50'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                {isPickingLocation ? 'Cancel Map Pick' : 'Click Map to Set Starting Point'}
              </button>
            </div>

            <div className="text-[10px] text-neutral-500 font-mono bg-neutral-50 p-2.5 rounded-2xl border border-neutral-100 space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="shrink-0 text-neutral-400">From:</span>
                <span className="font-extrabold text-neutral-700 truncate max-w-[170px]" title={startName}>
                  {startName}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="shrink-0 text-neutral-400">To:</span>
                <span
                  className="font-extrabold text-emerald-700 truncate max-w-[170px]"
                  title={getPropertyLabel(selectedMapProperty)}
                >
                  {getPropertyLabel(selectedMapProperty)}
                </span>
              </div>
              {distanceText && (
                <div className="flex justify-between border-t border-dashed border-neutral-200 pt-1.5 mt-1.5 text-[11px]">
                  <span className="font-bold text-neutral-600">Route Distance:</span>
                  <span className="font-black text-emerald-600">{distanceText}</span>
                </div>
              )}
            </div>

            <p className="text-[9px] text-amber-600 font-bold italic text-center leading-normal">
              Tip: Drag the amber pin or click anywhere on the map to set a custom starting location!
            </p>
          </div>
        )}
      </div>

      {selectedMapProperty && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-[#1C3A27]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-4 text-white flex flex-col sm:flex-row items-stretch gap-4 pointer-events-auto">
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-white/10 text-slate-200 rounded uppercase tracking-wider">
                  {selectedMapProperty.type ?? 'Property'}
                </span>
                <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {selectedMapProperty.status ?? 'Available'}
                </span>
              </div>
              <h4 className="font-serif text-sm font-bold text-white leading-tight">
                {getPropertyLabel(selectedMapProperty)}
              </h4>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-rose-500" /> {selectedMapProperty.location}
              </p>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-300 mt-2">
              <span className="flex items-center gap-1 font-semibold">
                <Maximize className="w-3.5 h-3.5 text-slate-500" />
                {getLotSize(selectedMapProperty).toLocaleString()} sqm
              </span>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-1 font-bold text-emerald-400">
                {formatPrice(selectedMapProperty.price)}
              </span>
            </div>
          </div>

          <div className="flex flex-row sm:flex-col justify-between items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedMapProperty(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer self-end border-none bg-transparent"
            >
              <X className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onSelectProperty?.(selectedMapProperty)}
              className="w-full sm:w-auto px-4 py-2 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1 cursor-pointer active:translate-y-0.5 border-none"
            >
              <Eye className="w-3.5 h-3.5" />
              Inspect Listing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyMap;