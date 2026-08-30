import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Property } from '../../types/types';
import {
  MapPin,
  Eye,
  X,
  Compass,
  ArrowUpRight,
  Search,
  Trees,
  Building2,
  Home,
  Landmark,
} from 'lucide-react';

interface PropertyExplorerProps {
  properties: Property[];
  onSelectProperty: (id: string) => void;
  focusProperty?: Property | null;
}

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

// One small icon per property type — used both on the list and the preview card,
// so there's never a dependency on a photo existing.
const TYPE_ICON: Record<string, React.ElementType> = {
  Agricultural: Trees,
  Commercial: Building2,
  Condominium: Building2,
  'House & Lot': Home,
  Residential: Home,
};
const getTypeIcon = (type: string) => TYPE_ICON[type] || Landmark;

// Shows the admin-entered property image if one exists and loads successfully;
// falls back to the type icon otherwise. No external/stock image is ever used.
const PropertyThumb: React.FC<{
  property: Property;
  className: string;
  iconClassName: string;
  fallbackBg: string;
}> = ({ property, className, iconClassName, fallbackBg }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = property.images?.[0];
  const TypeIcon = getTypeIcon(property.type);

  if (imageUrl && !imgFailed) {
    return (
      <img
        src={imageUrl}
        alt={property.name}
        onError={() => setImgFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <div className={`${className} ${fallbackBg} flex items-center justify-center`}>
      <TypeIcon className={iconClassName} />
    </div>
  );
};

const STATUS_STYLES: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-800',
  Reserved: 'bg-amber-100 text-amber-800',
  Sold: 'bg-rose-100 text-rose-800',
};

const MapCenterController: React.FC<{ center: [number, number] | null; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true, duration: 1.2 });
  }, [center, zoom, map]);
  return null;
};

const getCustomIcon = (property: Property, isFocused: boolean) => {
  const circleColor = isFocused ? '#10B981' : '#3E5C4D';
  return L.divIcon({
    html: `
      <div class="flex flex-col items-center select-none cursor-pointer">
        <div class="px-3 py-1 bg-[#121E29] text-white text-[10px] font-bold rounded-lg shadow-md border border-neutral-800 whitespace-nowrap mb-1.5 transition-all text-center">
          ${property.name}
        </div>
        <div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg transition-all ${isFocused ? 'scale-110 ring-4 ring-emerald-500/30' : 'hover:scale-110'}" style="background-color: ${circleColor};">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z" />
          </svg>
        </div>
      </div>
    `,
    className: 'custom-div-icon',
    iconSize: [160, 68],
    iconAnchor: [80, 58],
  });
};

// Coordinate validation — from the earlier map bug-fix phase, kept as-is.
const hasValidCoords = (lat: number, lng: number) =>
  typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng);

export const PropertyExplorer: React.FC<PropertyExplorerProps> = ({ properties, onSelectProperty, focusProperty }) => {
  const defaultCenter: [number, number] = [13.948324, 120.722989];

  const [selectedMapProperty, setSelectedMapProperty] = useState<Property | null>(focusProperty || null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(16);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Reserved' | 'Sold'>('All');

  const filteredProperties = properties.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Selecting from the list focuses the map — the list itself never disappears.
  const handleSelectPropertyFromList = (property: Property) => {
    setSelectedMapProperty(property);
    if (hasValidCoords(property.lat, property.lng)) {
      setMapCenter([property.lat, property.lng]);
      setMapZoom(18);
    }
  };

  // Kept from the earlier fix — only updates state when the focused property actually changes,
  // so the map doesn't jump/reset on unrelated re-renders.
  useEffect(() => {
    if (focusProperty) {
      setSelectedMapProperty((prev) =>
        prev?.id === focusProperty.id ? prev : focusProperty
      );
      if (hasValidCoords(focusProperty.lat, focusProperty.lng)) {
        setMapCenter([focusProperty.lat, focusProperty.lng]);
        setMapZoom(18);
      }
    }
  }, [focusProperty]);

  const resetToPrimary = () => {
    const primary = properties.find((p) => hasValidCoords(p.lat, p.lng));
    if (primary) {
      setSelectedMapProperty(primary);
      setMapCenter([primary.lat, primary.lng]);
      setMapZoom(16);
    }
  };

  return (
    <div className="w-full h-full min-h-[500px] flex flex-col sm:flex-row bg-slate-100 overflow-hidden font-sans">

      {/* Left panel — always-visible property list */}
      <div className="w-full sm:w-[320px] shrink-0 h-64 sm:h-full bg-white/95 border-b sm:border-b-0 sm:border-r border-neutral-200/70 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-neutral-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif font-black text-xs text-neutral-800 uppercase tracking-wider">Properties</h3>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full">{filteredProperties.length}</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-8 py-2 text-xs text-neutral-800 placeholder-neutral-400 font-semibold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 border-none bg-transparent cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex gap-1 mt-2">
            {(['All', 'Available', 'Reserved', 'Sold'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 py-1 rounded-lg text-[9px] font-extrabold tracking-wider uppercase transition-all cursor-pointer border-none ${statusFilter === status ? 'bg-[#1C3A27] text-white shadow-sm' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border border-neutral-150'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
          {filteredProperties.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-neutral-400 font-medium">No properties match your filters</p>
            </div>
          ) : (
            filteredProperties.map((property) => {
              const isSelected = selectedMapProperty?.id === property.id;
              return (
                <div
                  key={property.id}
                  onClick={() => handleSelectPropertyFromList(property)}
                  className={`p-2.5 rounded-2xl cursor-pointer transition-all flex items-start gap-2.5 border text-left group ${isSelected ? 'bg-emerald-50 border-emerald-200' : 'bg-white/40 border-transparent hover:bg-neutral-50/80 hover:border-neutral-100'}`}
                >
                  <PropertyThumb
                    property={property}
                    className={`w-10 h-10 rounded-xl shrink-0 border ${isSelected ? 'border-emerald-200' : 'border-neutral-200/55'}`}
                    iconClassName={`w-4.5 h-4.5 ${isSelected ? 'text-emerald-700' : 'text-neutral-500'}`}
                    fallbackBg={isSelected ? 'bg-emerald-100' : 'bg-neutral-100'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-serif font-black text-xs text-neutral-900 truncate leading-tight group-hover:text-[#1C3A27] transition-colors">{property.name}</h4>
                      <span className="text-[10px] font-black text-emerald-800 shrink-0">{formatPrice(property.price)}</span>
                    </div>
                    <p className="text-[9px] text-neutral-400 font-medium truncate mt-0.5">{property.location}</p>
                    <div className="flex items-center justify-between mt-1 text-[8px] font-bold text-neutral-500">
                      <span>{property.type} • {(property.lotSize || property.size || 0).toLocaleString()} sqm</span>
                      <span className={`px-1 py-0.5 rounded uppercase font-black text-[7px] ${STATUS_STYLES[property.status] || 'bg-neutral-100 text-neutral-700'}`}>
                        {property.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel — map */}
      <div className="flex-1 min-h-[320px] relative">
        {/* Map top bar */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-end gap-2.5 pointer-events-none">
          <div className="flex flex-wrap items-center gap-2.5 pointer-events-auto">
            <button
              onClick={resetToPrimary}
              className="bg-white hover:bg-neutral-50 active:scale-95 text-neutral-900 text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-neutral-100/50 transition-all cursor-pointer"
            >
              <Compass className="w-4 h-4 text-emerald-600" />
              Re-center map
            </button>
            <div className="bg-white p-1 rounded-2xl shadow-xl flex items-center border border-neutral-100/50">
              <button
                onClick={() => setMapType('standard')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${mapType === 'standard' ? 'bg-[#1C3A27] text-white' : 'bg-transparent text-neutral-600 hover:text-neutral-900'}`}
              >
                Standard
              </button>
              <button
                onClick={() => setMapType('satellite')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${mapType === 'satellite' ? 'bg-[#1C3A27] text-white' : 'bg-transparent text-neutral-600 hover:text-neutral-900'}`}
              >
                Satellite
              </button>
            </div>
          </div>
        </div>

        <MapContainer
          center={focusProperty && hasValidCoords(focusProperty.lat, focusProperty.lng) ? [focusProperty.lat, focusProperty.lng] : defaultCenter}
          zoom={16}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          attributionControl={false}
        >
          <MapCenterController center={mapCenter} zoom={mapZoom} />
          <TileLayer
            attribution="&copy; Google Maps"
            url={mapType === 'satellite'
              ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
              : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'}
            maxZoom={21}
          />

          {/* Only properties with valid coordinates get a marker — kept from the earlier fix. */}
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
                    setMapCenter([property.lat, property.lng]);
                    setMapZoom(18);
                  },
                }}
              />
            );
          })}
        </MapContainer>

        {/* Compact property preview card — appears over the map, doesn't cover the list. */}
        {selectedMapProperty && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-80 z-[2010] bg-white rounded-2xl shadow-2xl border border-neutral-200/70 overflow-hidden">
            <div className="flex items-start justify-between gap-2 p-3.5 pb-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl shrink-0 border border-emerald-100 overflow-hidden">
                  <PropertyThumb
                    property={selectedMapProperty}
                    className="w-9 h-9 rounded-xl"
                    iconClassName="w-4.5 h-4.5 text-emerald-700"
                    fallbackBg="bg-emerald-50"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-serif font-black text-sm text-neutral-900 leading-tight truncate">{selectedMapProperty.name}</h4>
                  <p className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-3 h-3 text-rose-500 shrink-0" /> {selectedMapProperty.location}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMapProperty(null)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors border-none bg-transparent cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3.5 flex items-center justify-between text-[10px] font-bold text-neutral-500">
              <span>{selectedMapProperty.type} • {(selectedMapProperty.lotSize || selectedMapProperty.size || 0).toLocaleString()} sqm</span>
              <span className={`px-1.5 py-0.5 rounded uppercase font-black text-[8px] ${STATUS_STYLES[selectedMapProperty.status] || 'bg-neutral-100 text-neutral-700'}`}>
                {selectedMapProperty.status}
              </span>
            </div>

            <div className="px-3.5 mt-1.5">
              <span className="text-base font-black text-emerald-700">{formatPrice(selectedMapProperty.price)}</span>
            </div>

            <div className="p-3.5 pt-3 flex gap-2">
              <button
                onClick={() => onSelectProperty(selectedMapProperty.id)}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#1C3A27] hover:bg-emerald-800 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border-none"
              >
                <Eye className="w-3.5 h-3.5" /> Inspect & Apply
              </button>
              {hasValidCoords(selectedMapProperty.lat, selectedMapProperty.lng) && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedMapProperty.lat},${selectedMapProperty.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  title="View in Google Maps"
                  className="p-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center active:scale-95 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 no-underline shrink-0"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyExplorer;