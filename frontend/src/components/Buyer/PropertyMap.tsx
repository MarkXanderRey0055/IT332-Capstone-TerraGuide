import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Compass, Eye, MapPin, Maximize, X } from 'lucide-react';
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

  const resetToPrimary = () => {
    const target = focusProperty ?? properties.find((p) => hasValidCoords(p.lat, p.lng));
    if (target) {
      setSelectedMapProperty(target);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#F5F7F6] overflow-hidden flex flex-col font-sans">

      {/* Top controls */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-3 border border-neutral-100 pointer-events-auto select-none">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="min-w-0">
            <h4 className="text-[11px] font-extrabold text-[#1C3A27] uppercase tracking-wide truncate">{mapTitle}</h4>
            <p className="text-[9px] text-neutral-500 truncate">{mapSubtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetToPrimary}
          className="bg-white hover:bg-neutral-50 text-[#1C3A27] text-[11px] font-extrabold px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-1.5 border border-neutral-100 transition-all cursor-pointer pointer-events-auto active:translate-y-0.5 whitespace-nowrap"
        >
          <Compass className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          {recenterLabel}
        </button>

        <div className="bg-white/95 backdrop-blur-md px-2 py-2 rounded-xl shadow-xl border border-neutral-100 pointer-events-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMapStyle('standard')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer border-none ${mapStyle === 'standard' ? 'bg-[#1C3A27] text-white shadow' : 'text-[#1C3A27] hover:bg-neutral-50 bg-transparent'}`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('satellite')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer border-none ${mapStyle === 'satellite' ? 'bg-[#1C3A27] text-white shadow' : 'text-[#1C3A27] hover:bg-neutral-50 bg-transparent'}`}
          >
            Satellite
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 w-full h-full z-10 relative">
        <MapContainer
          center={focusProperty && hasValidCoords(focusProperty.lat, focusProperty.lng) ? [focusProperty.lat, focusProperty.lng] : defaultCenter}
          zoom={13}
          scrollWheelZoom={scrollWheelZoom}
          style={{ width: '100%', height: '100%' }}
          zoomControl
        >
          <MapUpdater focusProperty={selectedMapProperty ?? focusProperty ?? null} focusZoom={focusZoom} />

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

          {/* Only render markers for properties with valid coordinates. */}
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
        </MapContainer>
      </div>

      {/* Property detail bar — shown when a marker is selected */}
      {selectedMapProperty && (
        <div className="relative z-[1000] bg-[#1C3A27]/95 backdrop-blur-md border-t border-white/10 shadow-2xl px-4 py-3 text-white flex flex-col sm:flex-row items-start sm:items-center gap-3 pointer-events-auto">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-white/10 text-slate-200 rounded uppercase tracking-wider">
                {selectedMapProperty.type ?? 'Property'}
              </span>
              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {selectedMapProperty.status ?? 'Available'}
              </span>
            </div>
            <h4 className="font-serif text-sm font-bold text-white leading-tight truncate">
              {getPropertyLabel(selectedMapProperty)}
            </h4>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
              {selectedMapProperty.location}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-slate-300 mt-1.5">
              <span className="flex items-center gap-1 font-semibold">
                <Maximize className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                {getLotSize(selectedMapProperty).toLocaleString()} sqm
              </span>
              <span className="text-slate-700">|</span>
              <span className="font-bold text-emerald-400">{formatPrice(selectedMapProperty.price)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setSelectedMapProperty(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onSelectProperty?.(selectedMapProperty)}
              className="px-4 py-2 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg transition-all flex items-center gap-1 cursor-pointer active:translate-y-0.5 border-none whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              Inspect Listing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyMap;