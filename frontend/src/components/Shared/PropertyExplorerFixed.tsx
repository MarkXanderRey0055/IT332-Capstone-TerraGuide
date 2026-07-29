import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Polyline,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { Property } from '../../types/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MapPin,
  Maximize,
  Eye,
  X,
  Compass,
  ArrowUpRight,
  ArrowLeft,
  Locate,
  Navigation,
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

const formatPrice = (num: number) => {
  return '₱' + Math.round(num).toLocaleString();
};

const MapCenterController: React.FC<{ center: [number, number] | null; zoom: number }> = ({
  center,
  zoom,
}) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom, { animate: true, duration: 1.2 });
    }
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

const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getStartIcon = () => {
  return L.divIcon({
    html: `
      <div class="flex flex-col items-center select-none">
        <div class="px-2.5 py-1 bg-amber-600 text-white text-[9px] font-black rounded-lg shadow-md border border-amber-500 whitespace-nowrap mb-1 transition-all text-center uppercase tracking-wider">
          Your Location
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

const MapClickHandler: React.FC<{ isActive: boolean; onSetLocation: (lat: number, lng: number) => void }> = ({
  isActive,
  onSetLocation,
}) => {
  useMapEvents({
    click(e) {
      if (isActive) {
        onSetLocation(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const PropertyExplorer: React.FC<PropertyExplorerProps> = ({ properties, onSelectProperty, focusProperty }) => {
  const defaultCenter: [number, number] = [13.948324, 120.722989];
  const [selectedMapProperty, setSelectedMapProperty] = useState<Property | null>(focusProperty || null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(16);
  const [showImmersiveStreetView, setShowImmersiveStreetView] = useState<boolean>(false);

  const [isListExpanded, setIsListExpanded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Reserved' | 'Sold'>('All');

  const [startLat, setStartLat] = useState<number>(13.9448);
  const [startLng, setStartLng] = useState<number>(120.7265);
  const [startName, setStartName] = useState<string>('WalterMart Balayan');
  const [startOption, setStartOption] = useState<string>('waltermart');
  const [cameraOrigin, setCameraOrigin] = useState<'start' | 'property'>('property');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isPickingLocation, setIsPickingLocation] = useState<boolean>(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState<boolean>(false);
  const [hasPromptedLocation, setHasPromptedLocation] = useState<boolean>(false);

  const filteredProperties = properties.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.location.toLowerCase().includes(searchQuery.toLowerCase()) || p.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSelectPropertyFromList = (property: Property) => {
    const lat = property.lat || 13.948324;
    const lng = property.lng || 120.722989;
    setSelectedMapProperty(property);
    setMapCenter([lat, lng]);
    setMapZoom(18);
  };

  useEffect(() => {
    if (selectedMapProperty && !hasPromptedLocation && startOption !== 'gps') {
      setShowLocationPrompt(true);
    }
  }, [selectedMapProperty, hasPromptedLocation, startOption]);

  let distanceText = '';
  if (selectedMapProperty) {
    const d = calculateHaversineDistance(startLat, startLng, selectedMapProperty.lat || 13.948324, selectedMapProperty.lng || 120.722989);
    if (d < 1) {
      distanceText = `${Math.round(d * 1000)}m (Est. ${Math.round((d / 30) * 60) || 1} min drive)`;
    } else {
      distanceText = `${d.toFixed(2)} km (Est. ${Math.round((d / 30) * 60)} mins drive)`;
    }
  }

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setStartLat(latitude);
        setStartLng(longitude);
        setStartName('My Current GPS Location');
        setStartOption('gps');
        setMapCenter([latitude, longitude]);
        setMapZoom(17);
        setIsLocating(false);
      },
      (error) => {
        console.error('GPS error:', error);
        alert('Unable to fetch your GPS coordinates. Using default start location instead.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000 },
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

  useEffect(() => {
    if (focusProperty) {
      setSelectedMapProperty(focusProperty);
      const lat = focusProperty.lat || 13.948324;
      const lng = focusProperty.lng || 120.722989;
      setMapCenter([lat, lng]);
      setMapZoom(18);
    }
  }, [focusProperty]);

  const resetToPrimary = () => {
    const primary = properties[0];
    if (primary) {
      const lat = primary.lat || 13.948324;
      const lng = primary.lng || 120.722989;
      setSelectedMapProperty(primary);
      setMapCenter([lat, lng]);
      setMapZoom(16);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-100 overflow-hidden flex flex-col font-sans">
      {showLocationPrompt && selectedMapProperty && (
        <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-neutral-100 text-center space-y-4 pointer-events-auto">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <Locate className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-neutral-900 font-serif">Calculate Real-time Driving Directions?</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">TerraGuide can use your browser's GPS coordinates to display instant route navigation and driving times to <span className="font-bold text-neutral-800">{selectedMapProperty.name}</span>.</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button onClick={() => { setHasPromptedLocation(true); setShowLocationPrompt(false); handleLocateMe(); }} className="w-full bg-[#1C3A27] hover:bg-emerald-800 text-white font-black text-xs py-3 rounded-2xl transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-95 border-none">🛰️ Yes, Share My Location</button>
              <button onClick={() => { setHasPromptedLocation(true); setShowLocationPrompt(false); }} className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs py-3 rounded-2xl transition-all cursor-pointer border-none">No, Keep Default Starting Point</button>
            </div>
            <p className="text-[10px] text-neutral-400">Your location data is processed securely in your browser and is never stored on our servers.</p>
          </div>
        </div>
      )}

      {!showImmersiveStreetView && (
        <div className="absolute top-5 left-5 right-5 z-[1000] flex flex-col sm:flex-row sm:items-center justify-between gap-3 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3.5 border border-neutral-100/50 pointer-events-auto select-none shrink-0">
            <div className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></div>
            <div>
              <h4 className="text-xs font-black text-neutral-900 tracking-wider uppercase leading-none">LIVE PROPERTY VIEW</h4>
              <p className="text-[10px] text-neutral-500 mt-1 font-medium">Click markers to inspect nearby listings</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pointer-events-auto">
            <button onClick={resetToPrimary} className="bg-white hover:bg-neutral-50 active:scale-95 text-neutral-900 text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-neutral-100/50 transition-all cursor-pointer"><Compass className="w-4 h-4 text-emerald-600 animate-spin-slow"/>Re-center map</button>
            <div className="bg-white p-1 rounded-2xl shadow-xl flex items-center border border-neutral-100/50">
              <button onClick={() => setMapType('standard')} className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${mapType === 'standard' ? 'bg-[#1C3A27] text-white' : 'bg-transparent text-neutral-600 hover:text-neutral-900'}`}>Standard</button>
              <button onClick={() => setMapType('satellite')} className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${mapType === 'satellite' ? 'bg-[#1C3A27] text-white' : 'bg-transparent text-neutral-600 hover:text-neutral-900'}`}>Satellite</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 w-full h-full z-10 relative">
        {showImmersiveStreetView && selectedMapProperty ? (
          <div className="w-full h-full relative bg-neutral-950 flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/60 to-transparent z-[99] pointer-events-none" />
            <iframe title="Google Street View Immersive Tour with Route Directions" src={`https://maps.google.com/maps?saddr=${startLat},${startLng}&daddr=${selectedMapProperty.lat || 13.948324},${selectedMapProperty.lng || 120.722989}&layer=c&cbll=${cameraOrigin === 'start' ? startLat : (selectedMapProperty.lat || 13.948324)},${cameraOrigin === 'start' ? startLng : (selectedMapProperty.lng || 120.722989)}&output=embed`} className="w-full h-full border-none" allowFullScreen loading="lazy" referrerPolicy="no-referrer" />
            <div className="absolute top-4 right-4 z-[100] bg-black/85 backdrop-blur-md p-4 rounded-2xl border border-white/10 max-w-xs text-white space-y-3 shadow-2xl pointer-events-auto">
              <div className="flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5 text-amber-400 animate-pulse"/><span className="font-extrabold text-[10px] uppercase tracking-wider text-neutral-300">Route Directions Navigation</span></div>
              <div className="space-y-1"><label className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">Starting Origin</label>
                <div className="flex items-center gap-1"><select value={startOption} onChange={(e) => handleSelectStartPreset(e.target.value)} className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-neutral-200 focus:outline-none focus:ring-amber-500 font-semibold cursor-pointer"><option value="waltermart">📍 WalterMart Balayan</option><option value="medical">🏥 Medical Center Western Batangas</option><option value="canda">🏫 Canda Elementary School</option><option value="gps">📡 My Live GPS Location</option><option value="custom">🎯 Custom Pin Location</option></select><button onClick={handleLocateMe} disabled={isLocating} className="p-1.5 rounded-xl bg-neutral-800 border border-white/10 hover:bg-neutral-700 hover:border-white/20 active:scale-95 text-amber-400 disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center shrink-0" title="Get live GPS coordinates"><Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`}/></button></div>
                {startOption === 'custom' && (<p className="text-[9px] text-amber-400 font-medium italic mt-1 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20 leading-snug">💡 Tip: Go back to 'Map View' and click on the map to set a new location!</p>)}
              </div>
              <div className="space-y-1 border-t border-white/10 pt-2"><label className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">Destination</label><div className="bg-neutral-900/50 px-2 py-1.5 rounded-xl text-[11px] font-black text-amber-300 border border-white/5 truncate">🏁 {selectedMapProperty.name}</div></div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2"><span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">Perspective:</span><div className="flex gap-1"><button onClick={() => setCameraOrigin('start')} className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border-none cursor-pointer ${cameraOrigin === 'start' ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}>Start Origin</button><button onClick={() => setCameraOrigin('property')} className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border-none cursor-pointer ${cameraOrigin === 'property' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}>Property POV</button></div></div>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-black/85 backdrop-blur-md px-5 py-3.5 rounded-2xl text-white text-xs font-medium border border-white/10 max-w-xs space-y-1 shadow-2xl">
              <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold uppercase tracking-wider text-[9px]"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>Google 360° Street View Active</div>
              <p className="text-neutral-100 font-serif font-bold text-sm leading-tight">{selectedMapProperty.name}</p>
              <p className="text-[10px] text-neutral-400 font-mono">Coords: {(selectedMapProperty.lat||0).toFixed(6)}, {(selectedMapProperty.lng||0).toFixed(6)}</p>
              <p className="text-[9px] text-amber-400 font-bold">Routing From: {startName}</p>
            </div>
            <div className="absolute bottom-4 right-4 z-[100] flex items-center gap-2 pointer-events-auto"><a href={`https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${selectedMapProperty.lat || 13.948324},${selectedMapProperty.lng || 120.722989}&travelmode=driving`} target="_blank" rel="noreferrer" className="bg-white hover:bg-neutral-50 active:scale-95 text-neutral-900 text-xs font-black px-4.5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-1.5 transition-all no-underline border border-neutral-100">Open full directions in Google Maps<ArrowUpRight className="w-4 h-4 text-emerald-600"/></a></div>
          </div>
        ) : (
          <>
            <MapContainer center={focusProperty ? [focusProperty.lat || 13.948324, focusProperty.lng || 120.722989] : defaultCenter} zoom={16} style={{ width: '100%', height: '100%' }} zoomControl={true} attributionControl={false}>
              <MapCenterController center={mapCenter} zoom={mapZoom} />
              <MapClickHandler isActive={isPickingLocation} onSetLocation={(lat, lng) => { setStartLat(lat); setStartLng(lng); setStartName('Custom Pin on Map'); setStartOption('custom'); setIsPickingLocation(false); }} />
              <TileLayer attribution="&copy; Google Maps" url={mapType === 'satellite' ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" : "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"} maxZoom={21} />
              {properties.map((property) => {
                const lat = property.lat || 13.948324;
                const lng = property.lng || 120.722989;
                const isFocused = selectedMapProperty?.id === property.id;
                return (
                  <Marker key={property.id} position={[lat, lng]} icon={getCustomIcon(property, isFocused)} eventHandlers={{ click: () => { setSelectedMapProperty(property); setMapCenter([lat, lng]); setMapZoom(18); setShowImmersiveStreetView(false); } }}>
                    <Popup className="custom-popup"><div className="p-1 max-w-[210px] text-neutral-800 font-sans"><h5 className="font-serif text-sm font-bold text-neutral-900 leading-tight mb-1">{property.name}</h5><p className="text-[10px] text-neutral-500 mb-2.5">{property.location} • {(property.lotSize||property.size||0).toLocaleString()} sqm</p><div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-2 mt-2"><span className="text-xs font-black text-emerald-700">{formatPrice(property.price)}</span><button onClick={() => onSelectProperty(property.id)} className="text-[10px] bg-[#1C3A27] hover:bg-emerald-800 text-white px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer border-none flex items-center gap-0.5">Inspect<ArrowUpRight className="w-3 h-3"/></button></div></div></Popup>
                  </Marker>
                );
              })}

              {selectedMapProperty && (
                <Marker position={[startLat, startLng]} draggable={false} icon={getStartIcon()}>
                  <Popup className="custom-popup"><div className="p-1 max-w-[180px] font-sans text-neutral-800"><h6 className="font-bold text-amber-600 text-xs uppercase leading-tight mb-1">Your Starting Point</h6><p className="text-[10px] text-neutral-500 leading-snug">This is your selected starting point for directions.</p></div></Popup>
                </Marker>
              )}

              {selectedMapProperty && (
                <Polyline positions={[[startLat, startLng], [selectedMapProperty.lat || 13.948324, selectedMapProperty.lng || 120.722989]]} color="#f59e0b" weight={4} opacity={0.8} dashArray="10, 10" />
              )}
            </MapContainer>

            {selectedMapProperty && (
              <div className="absolute top-24 right-5 z-[1000] bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-neutral-200/55 shadow-2xl max-w-[280px] sm:max-w-xs text-neutral-800 space-y-3 pointer-events-auto animate-fade-down">
                <div className="flex items-center gap-1.5 justify-between"><div className="flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5 text-emerald-600 animate-pulse"/><span className="font-extrabold text-[10px] uppercase tracking-wider text-neutral-500">Route Directions Planner</span></div>{isPickingLocation && (<span className="text-[9px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded-md animate-bounce uppercase tracking-wide">Click Map!</span>)}</div>
                <div className="space-y-1.5"><label className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">1. Set Starting Point</label><div className="flex items-center gap-1"><select value={startOption} onChange={(e) => handleSelectStartPreset(e.target.value)} className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-[11px] text-neutral-800 font-semibold cursor-pointer focus:ring-1 focus:ring-emerald-500 focus:outline-none"><option value="waltermart">📍 WalterMart Balayan</option><option value="medical">🏥 Medical Center Western Batangas</option><option value="canda">🏫 Canda Elementary School</option><option value="gps">📡 My Live GPS Location</option><option value="custom">🎯 Custom Location Pin</option></select><button onClick={handleLocateMe} disabled={isLocating} className="p-2 rounded-xl bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 text-emerald-600 disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center shrink-0" title="Get live GPS coordinates"><Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`}/></button></div><button onClick={() => setIsPickingLocation(!isPickingLocation)} className={`w-full py-2 rounded-xl text-[10px] font-extrabold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isPickingLocation ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400 animate-pulse' : 'bg-emerald-50/50 hover:bg-emerald-100/50 text-emerald-800 border-emerald-200/50'}`}><MapPin className="w-3.5 h-3.5 text-amber-500"/>{isPickingLocation ? 'Cancel Map Pick' : '🎯 Click Map to Set Starting Point'}</button></div>
                <div className="text-[10px] text-neutral-500 font-mono bg-neutral-50 p-2.5 rounded-2xl border border-neutral-100 space-y-1.5"><div className="flex justify-between gap-2"><span className="shrink-0 text-neutral-400">From:</span><span className="font-extrabold text-neutral-700 truncate max-w-[170px]" title={startName}>{startName}</span></div><div className="flex justify-between gap-2"><span className="shrink-0 text-neutral-400">To:</span><span className="font-extrabold text-emerald-700 truncate max-w-[170px]" title={selectedMapProperty.name}>{selectedMapProperty.name}</span></div>{distanceText && (<div className="flex justify-between border-t border-dashed border-neutral-200 pt-1.5 mt-1.5 text-[11px]"><span className="font-bold text-neutral-600">Route Distance:</span><span className="font-black text-emerald-600">{distanceText}</span></div>)}</div>
                <p className="text-[9px] text-amber-600 font-bold italic text-center leading-normal">💡 Tip: Click anywhere on the map to set a custom starting location!</p>
              </div>
            )}
          </>
        )}

        <div className="absolute top-[180px] sm:top-24 bottom-5 left-5 z-[2010] pointer-events-none flex flex-col justify-start">
          {!isListExpanded ? (
            <div className="flex flex-col gap-2 pointer-events-auto"><button onClick={() => setIsListExpanded(true)} className="flex items-center justify-between gap-2.5 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-neutral-100/50 pointer-events-auto text-neutral-800 font-extrabold text-xs transition-all hover:scale-102 hover:bg-neutral-50 active:scale-95 group cursor-pointer"><div className="flex items-center gap-2"><List className="w-4 h-4 text-emerald-600 transition-transform duration-300 group-hover:rotate-6"/><span>Browse Listings ({properties.length})</span></div><ChevronRight className="w-4 h-4 text-neutral-400"/></button>{showImmersiveStreetView && (<button onClick={() => setShowImmersiveStreetView(false)} className="flex items-center justify-between gap-2.5 bg-amber-600 px-4 py-3 rounded-2xl shadow-xl border-amber-500 pointer-events-auto text-white font-extrabold text-xs transition-all hover:scale-102 hover:bg-amber-700 active:scale-95 cursor-pointer"><div className="flex items-center gap-2"><Compass className="w-4 h-4 text-white animate-spin-slow"/><span>Back to Map View</span></div></button>)}</div>
          ) : (
            <div className="w-[calc(100vw-40px)] sm:w-80 flex-1 min-h-0 bg-white/95 backdrop-blur-md border border-neutral-200/55 rounded-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto transition-all">
              <AnimatePresence mode="wait">
                {!selectedMapProperty ? (
                  <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/20 shrink-0"><div className="flex items-center gap-2"><div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600"><List className="w-4 h-4"/></div><div><h3 className="font-serif font-black text-xs text-neutral-800 uppercase tracking-wider">Properties List</h3><p className="text-[9px] text-neutral-400 font-medium">Click to navigate on map</p></div></div><div className="flex items-center gap-1.5"><span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full">{filteredProperties.length}</span><button onClick={() => setIsListExpanded(false)} className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors border-none bg-transparent cursor-pointer"><ChevronLeft className="w-4.5 h-4.5"/></button></div></div>
                    <div className="p-3 bg-neutral-50/50 border-b border-neutral-100 space-y-2 shrink-0">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400"/>
                        <input type="text" placeholder="Search by name or location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-8 py-2 text-xs text-neutral-800 placeholder-neutral-400 font-semibold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"/>
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 border-none bg-transparent cursor-pointer"><X className="w-3 h-3"/></button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {(['All','Available','Reserved','Sold'] as const).map((status) => (
                          <button key={status} onClick={() => setStatusFilter(status)} className={`flex-1 py-1 rounded-lg text-[9px] font-extrabold tracking-wider uppercase transition-all cursor-pointer border-none ${statusFilter===status ? 'bg-[#1C3A27] text-white shadow-sm font-black' : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-150'}`}>
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
                              <span
                                className={`absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full border-2 border-white ${
                                  property.status === 'Available'
                                    ? 'bg-emerald-500 animate-pulse'
                                    : property.status === 'Reserved'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className="font-serif font-black text-xs text-neutral-900 truncate leading-tight group-hover:text-[#1C3A27] transition-colors">{property.name}</h4>
                                <span className="text-[10px] font-black text-emerald-800 shrink-0">{formatPrice(property.price)}</span>
                              </div>
                              <p className="text-[9px] text-neutral-400 font-medium truncate mt-0.5">{property.location}</p>
                              <div className="flex items-center justify-between mt-1 text-[8px] font-bold text-neutral-500">
                                <span>{property.type} • {(property.lotSize || property.size || 0).toLocaleString()} sqm</span>
                                <span
                                  className={`px-1 py-0.5 rounded uppercase font-black text-[7px] ${
                                    property.status === 'Available'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : property.status === 'Reserved'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
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
                  <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
                    <div className="p-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/20 shrink-0"><button onClick={() => { setSelectedMapProperty(null); setShowImmersiveStreetView(false); }} className="flex items-center gap-1.5 p-1.5 px-3 rounded-xl hover:bg-neutral-100 text-neutral-600 transition-colors border-none bg-transparent cursor-pointer font-bold text-[10px] uppercase tracking-wider"><ArrowLeft className="w-4 h-4"/>Back to List</button></div>
                    <div className="flex-1 overflow-y-auto scrollbar-thin"><div className="w-full h-40 bg-neutral-100 relative"><img src={selectedMapProperty.images?.[0] || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=500&q=80'} alt={selectedMapProperty.name} referrerPolicy="no-referrer" className="w-full h-full object-cover"/><div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5"><span className="text-[9px] font-extrabold px-2 py-1 bg-white/95 backdrop-blur-md text-neutral-800 rounded-lg uppercase tracking-wider shadow-sm">{selectedMapProperty.type} Plot</span><span className={`text-[9px] font-extrabold px-2 py-1 rounded-lg uppercase tracking-wider shadow-sm ${selectedMapProperty.status==='Available' ? 'bg-emerald-500 text-white' : selectedMapProperty.status==='Reserved' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>{selectedMapProperty.status}</span></div></div>
                      <div className="p-5 space-y-4"><div><h4 className="font-serif text-lg font-bold text-neutral-900 leading-tight mb-1">{selectedMapProperty.name}</h4><p className="text-xs text-neutral-500 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-rose-500 shrink-0"/> {selectedMapProperty.location}</p></div><div className="flex items-center gap-4 py-3 border-y border-neutral-100"><div className="flex-1"><span className="block text-[9px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Price</span><span className="text-sm font-black text-emerald-700">{formatPrice(selectedMapProperty.price)}</span></div><div className="w-px h-8 bg-neutral-200"/><div className="flex-1"><span className="block text-[9px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">Lot Size</span><span className="text-sm font-bold text-neutral-700 flex items-center gap-1">{(selectedMapProperty.lotSize||selectedMapProperty.size||0).toLocaleString()} sqm</span></div></div>
                        <div className="space-y-2.5 pt-2"><button onClick={() => onSelectProperty(selectedMapProperty.id)} className="w-full py-3 text-sm font-bold text-white bg-[#1C3A27] hover:bg-emerald-800 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border-none"><Eye className="w-4.5 h-4.5"/>Inspect & Apply</button><button onClick={() => setShowImmersiveStreetView(!showImmersiveStreetView)} className={`w-full py-3 text-xs font-extrabold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border ${showImmersiveStreetView ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500' : 'bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200'}`}><Compass className={`w-4.5 h-4.5 ${showImmersiveStreetView ? 'animate-spin-slow' : 'text-amber-500'}`}/>{showImmersiveStreetView ? 'Map View' : 'Explore Street View'}</button></div></div></div>
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