import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Property } from '../../types/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MapPin,
  Eye,
  X,
  Compass,
  ArrowUpRight,
  ArrowLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  List,
} from 'lucide-react';

interface PropertyExplorerProps {
  properties: Property[];
  onSelectProperty: (id: string) => void;
  focusProperty?: Property | null;
}

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

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

// From previous phase — keeps coordinate validation intact
const hasValidCoords = (lat: number, lng: number) =>
  typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng);

export const PropertyExplorer: React.FC<PropertyExplorerProps> = ({ properties, onSelectProperty, focusProperty }) => {
  const defaultCenter: [number, number] = [13.948324, 120.722989];

  const [selectedMapProperty, setSelectedMapProperty] = useState<Property | null>(focusProperty || null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(16);
  const [isListExpanded, setIsListExpanded] = useState<boolean>(true);
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

  const handleSelectPropertyFromList = (property: Property) => {
    setSelectedMapProperty(property);
    if (hasValidCoords(property.lat, property.lng)) {
      setMapCenter([property.lat, property.lng]);
      setMapZoom(18);
    }
  };

  // From previous phase — only updates state when the focused property actually changes
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
    <div className="relative w-full h-full min-h-[500px] bg-slate-100 overflow-hidden flex flex-col font-sans">

      {/* Map top bar */}
      <div className="absolute top-5 left-5 right-5 z-[1000] flex flex-col sm:flex-row sm:items-center justify-between gap-3 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3.5 border border-neutral-100/50 pointer-events-auto select-none shrink-0">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </div>
          <div>
            <h4 className="text-xs font-black text-neutral-900 tracking-wider uppercase leading-none">LIVE PROPERTY VIEW</h4>
            <p className="text-[10px] text-neutral-500 mt-1 font-medium">Click markers to inspect nearby listings</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 pointer-events-auto">
          <button
            onClick={resetToPrimary}
            className="bg-white hover:bg-neutral-50 active:scale-95 text-neutral-900 text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-neutral-100/50 transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4 text-emerald-600 animate-spin-slow" />
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

      {/* Map */}
      <div className="flex-1 w-full h-full z-10 relative">
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

          {/* Only render markers for properties with valid coordinates — from previous phase */}
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
                    setIsListExpanded(true);
                  },
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-1 max-w-[210px] text-neutral-800 font-sans">
                    <h5 className="font-serif text-sm font-bold text-neutral-900 leading-tight mb-1">{property.name}</h5>
                    <p className="text-[10px] text-neutral-500 mb-2.5">{property.location} • {(property.lotSize || property.size || 0).toLocaleString()} sqm</p>
                    <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-2 mt-2">
                      <span className="text-xs font-black text-emerald-700">{formatPrice(property.price)}</span>
                      <button
                        onClick={() => onSelectProperty(property.id)}
                        className="text-[10px] bg-[#1C3A27] hover:bg-emerald-800 text-white px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer border-none flex items-center gap-0.5"
                      >
                        Inspect<ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Property list / detail panel */}
        <div className="absolute top-[180px] sm:top-24 bottom-5 left-5 z-[2010] pointer-events-none flex flex-col justify-start">
          {!isListExpanded ? (
            <button
              onClick={() => setIsListExpanded(true)}
              className="flex items-center justify-between gap-2.5 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-neutral-100/50 pointer-events-auto text-neutral-800 font-extrabold text-xs transition-all hover:bg-neutral-50 active:scale-95 group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-emerald-600" />
                <span>Browse Listings ({properties.length})</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>
          ) : (
            <div className="w-[calc(100vw-40px)] sm:w-80 flex-1 min-h-0 bg-white/95 backdrop-blur-md border border-neutral-200/55 rounded-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
              <AnimatePresence mode="wait">
                {!selectedMapProperty ? (
                  // List view
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col flex-1 w-full min-h-0 overflow-hidden"
                  >
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/20 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600"><List className="w-4 h-4" /></div>
                        <div>
                          <h3 className="font-serif font-black text-xs text-neutral-800 uppercase tracking-wider">Properties List</h3>
                          <p className="text-[9px] text-neutral-400 font-medium">Click to focus on map</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full">{filteredProperties.length}</span>
                        <button onClick={() => setIsListExpanded(false)} className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors border-none bg-transparent cursor-pointer">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Search + filter */}
                    <div className="p-3 bg-neutral-50/50 border-b border-neutral-100 space-y-2 shrink-0">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                        <input
                          type="text"
                          placeholder="Search by name or location..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-8 py-2 text-xs text-neutral-800 placeholder-neutral-400 font-semibold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 border-none bg-transparent cursor-pointer">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {(['All', 'Available', 'Reserved', 'Sold'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`flex-1 py-1 rounded-lg text-[9px] font-extrabold tracking-wider uppercase transition-all cursor-pointer border-none ${statusFilter === status ? 'bg-[#1C3A27] text-white shadow-sm' : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-150'}`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Property list items */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                      {filteredProperties.length === 0 ? (
                        <div className="py-10 text-center">
                          <p className="text-xs text-neutral-400 font-medium">No properties match your filters</p>
                        </div>
                      ) : (
                        filteredProperties.map((property) => (
                          <div
                            key={property.id}
                            onClick={() => handleSelectPropertyFromList(property)}
                            className="p-2.5 rounded-2xl cursor-pointer transition-all flex items-start gap-2.5 border text-left group bg-white/40 border-transparent hover:bg-neutral-50/80 hover:border-neutral-100"
                          >
                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-neutral-100 border border-neutral-200/55 relative">
                              <img
                                src={property.images?.[0] || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=100&q=80'}
                                alt={property.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                referrerPolicy="no-referrer"
                              />
                              <span className={`absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full border-2 border-white ${property.status === 'Available' ? 'bg-emerald-500 animate-pulse' : property.status === 'Reserved' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="font-serif font-black text-xs text-neutral-900 truncate leading-tight group-hover:text-[#1C3A27] transition-colors">{property.name}</h4>
                                <span className="text-[10px] font-black text-emerald-800 shrink-0">{formatPrice(property.price)}</span>
                              </div>
                              <p className="text-[9px] text-neutral-400 font-medium truncate mt-0.5">{property.location}</p>
                              <div className="flex items-center justify-between mt-1 text-[8px] font-bold text-neutral-500">
                                <span>{property.type} • {(property.lotSize || property.size || 0).toLocaleString()} sqm</span>
                                <span className={`px-1 py-0.5 rounded uppercase font-black text-[7px] ${property.status === 'Available' ? 'bg-emerald-100 text-emerald-800' : property.status === 'Reserved' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {property.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                ) : (
                  // Detail view
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col flex-1 w-full min-h-0 overflow-hidden"
                  >
                    <div className="p-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/20 shrink-0">
                      <button
                        onClick={() => setSelectedMapProperty(null)}
                        className="flex items-center gap-1.5 p-1.5 px-3 rounded-xl hover:bg-neutral-100 text-neutral-600 transition-colors border-none bg-transparent cursor-pointer font-bold text-[10px] uppercase tracking-wider"
                      >
                        <ArrowLeft className="w-4 h-4" />Back to List
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                      <div className="w-full h-40 bg-neutral-100 relative">
                        <img
                          src={selectedMapProperty.images?.[0] || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=500&q=80'}
                          alt={selectedMapProperty.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] font-extrabold px-2 py-1 bg-white/95 backdrop-blur-md text-neutral-800 rounded-lg uppercase tracking-wider shadow-sm">{selectedMapProperty.type} Plot</span>
                          <span className={`text-[9px] font-extrabold px-2 py-1 rounded-lg uppercase tracking-wider shadow-sm ${selectedMapProperty.status === 'Available' ? 'bg-emerald-500 text-white' : selectedMapProperty.status === 'Reserved' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
                            {selectedMapProperty.status}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        <div>
                          <h4 className="font-serif text-lg font-bold text-neutral-900 leading-tight mb-1">{selectedMapProperty.name}</h4>
                          <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-rose-500 shrink-0" /> {selectedMapProperty.location}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 py-3 border-y border-neutral-100">
                          <div className="flex-1">
                            <span className="block text-[9px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Price</span>
                            <span className="text-sm font-black text-emerald-700">{formatPrice(selectedMapProperty.price)}</span>
                          </div>
                          <div className="w-px h-8 bg-neutral-200" />
                          <div className="flex-1">
                            <span className="block text-[9px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Lot Size</span>
                            <span className="text-sm font-bold text-neutral-700">{(selectedMapProperty.lotSize || selectedMapProperty.size || 0).toLocaleString()} sqm</span>
                          </div>
                        </div>

                        <div className="space-y-2.5 pt-2">
                          <button
                            onClick={() => onSelectProperty(selectedMapProperty.id)}
                            className="w-full py-3 text-sm font-bold text-white bg-[#1C3A27] hover:bg-emerald-800 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border-none"
                          >
                            <Eye className="w-4 h-4" /> Inspect & Apply
                          </button>
                          {hasValidCoords(selectedMapProperty.lat, selectedMapProperty.lng) && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${selectedMapProperty.lat},${selectedMapProperty.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full py-3 text-xs font-extrabold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 no-underline"
                            >
                              <Compass className="w-4 h-4 text-amber-500" /> View in Google Maps
                              <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyExplorer;