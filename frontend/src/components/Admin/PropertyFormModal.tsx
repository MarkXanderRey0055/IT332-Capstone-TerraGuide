import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Compass, MapPin } from 'lucide-react';
import type { Property } from '../../types/types';
import { getLotSize } from '../../services/buyerPrefs';

interface PropertyFormModalProps {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
  onSave: (data: Omit<Property, 'id'>) => void;
}

const PROPERTY_TYPES: Property['type'][] = [
  'Agricultural',
  'Residential',
  'Commercial',
  'Condominium',
  'House & Lot',
];

export const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  isOpen,
  property,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [price, setPrice] = useState('');
  const [lotSize, setLotSize] = useState<number | ''>('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<Property['type'] | ''>('');
  const [image, setImage] = useState('');
  const [docTax, setDocTax] = useState<'pending' | 'verified' | 'missing'>('pending');
  const [docDeed, setDocDeed] = useState<'pending' | 'verified' | 'missing'>('pending');
  const [docSurvey, setDocSurvey] = useState<'pending' | 'verified' | 'missing'>('pending');
  const [status, setStatus] = useState<'Available' | 'Sold' | 'Reserved'>('Available');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (property) {
      setName(property.name);
      setOwner(property.owner ?? '');
      setPrice(property.price.toLocaleString());
      setLotSize(getLotSize(property) || '');
      setLocation(property.location);
      setType(property.type);
      setImage(property.images?.[0] || '');
      setDocTax(property.documents?.tax || 'pending');
      setDocDeed(property.documents?.deed || 'pending');
      setDocSurvey(property.documents?.survey || 'pending');
      setStatus(property.status || 'Available');
      setLat(property.lat.toString());
      setLng(property.lng.toString());
    } else {
      setName('');
      setOwner('');
      setPrice('');
      setLotSize('');
      setLocation('');
      setType('');
      setImage('');
      setDocTax('pending');
      setDocDeed('pending');
      setDocSurvey('pending');
      setStatus('Available');
      setLat('');
      setLng('');
    }
    setErrorMsg('');
  }, [property, isOpen]);

  if (!isOpen) return null;

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/,/g, '');
    if (rawVal === '') {
      setPrice('');
      return;
    }
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed)) {
      setPrice(parsed.toLocaleString());
    }
  };

  const handleSave = () => {
    setErrorMsg('');
    const parsedPrice = parseFloat(price.replace(/,/g, ''));

    if (!name.trim()) {
      setErrorMsg('Property name is required.');
      return;
    }
    if (!owner.trim()) {
      setErrorMsg('Owner name is required.');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setErrorMsg('Please enter a valid price greater than 0.');
      return;
    }
    if (!lotSize || lotSize <= 0) {
      setErrorMsg('Please enter a valid lot size greater than 0.');
      return;
    }
    if (!location.trim()) {
      setErrorMsg('Location is required.');
      return;
    }
    if (!type) {
      setErrorMsg('Please select a property type.');
      return;
    }

    const parsedLat = lat === '' ? 13.948324 : parseFloat(lat);
    const parsedLng = lng === '' ? 120.722989 : parseFloat(lng);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setErrorMsg('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setErrorMsg('Longitude must be a valid number between -180 and 180.');
      return;
    }

    const size = Number(lotSize);

    onSave({
      name: name.trim(),
      owner: owner.trim(),
      price: parsedPrice,
      size,
      lotSize: size,
      location: location.trim(),
      type,
      status,
      pricePerSqm: Math.round(parsedPrice / size),
      images: image.trim() ? [image.trim()] : [],
      documents: {
        tax: docTax,
        deed: docDeed,
        survey: docSurvey,
      },
      lat: parsedLat,
      lng: parsedLng,
    });
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-forest-950/40 backdrop-blur-md">
      <div className="w-full max-w-xl bg-white/90 backdrop-blur-lg border border-white/90 rounded-3xl shadow-lg flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between p-6 pb-2">
          <h3 className="font-serif text-xl font-bold text-forest-900">
            {property ? 'Edit Property Listing' : 'Add Property Listing'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors border-none cursor-pointer bg-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pt-2 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs font-semibold text-red-700 bg-red-100 border border-red-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Property Name
              </label>
              <input
                type="text"
                placeholder="e.g. Riverside Villa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Owner Name
              </label>
              <input
                type="text"
                placeholder="e.g. Juan dela Cruz"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Price (₱)
              </label>
              <input
                type="text"
                placeholder="e.g. 450,000"
                value={price}
                onChange={handlePriceChange}
                className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Lot Size (sqm)
              </label>
              <input
                type="number"
                placeholder="e.g. 1200"
                value={lotSize || ''}
                onChange={(e) => setLotSize(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Location
              </label>
              <input
                type="text"
                placeholder="e.g. Balayan, Batangas"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Property Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Property['type'])}
                className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
              >
                <option value="">Select Type</option>
                {PROPERTY_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 border-t border-forest-900/10 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                GPS Coordinates
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">WGS-84 Format</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Latitude</span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 13.948324"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Longitude</span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 120.722989"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/60 text-xs mt-1">
              <span className="text-neutral-500 font-semibold flex items-center gap-1 text-[11px]">
                <Compass className="w-3.5 h-3.5 text-sage-500" />
                Batangas Presets:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setLat('13.948324');
                    setLng('120.722989');
                  }}
                  className="px-2 py-1 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-lg cursor-pointer transition-all font-semibold text-[10px]"
                >
                  Balayan Capstone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLat('13.943187');
                    setLng('120.720345');
                  }}
                  className="px-2 py-1 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-lg cursor-pointer transition-all font-semibold text-[10px]"
                >
                  WalterMart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLat('13.931890');
                    setLng('120.718300');
                  }}
                  className="px-2 py-1 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-lg cursor-pointer transition-all font-semibold text-[10px]"
                >
                  Balayan East Central
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
              Image URL <span className="text-neutral-400 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="https://example.com/image.jpg"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
            />
            {image.trim() && (
              <div className="mt-2 h-36 w-full rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
                <img
                  src={image}
                  alt="Property Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80';
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-forest-900/10 pt-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Document Status
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200/60">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Tax Declaration</span>
                <select
                  value={docTax}
                  onChange={(e) => setDocTax(e.target.value as typeof docTax)}
                  className="w-full p-1.5 bg-white border border-neutral-200 rounded text-xs text-neutral-800 focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Title Deed</span>
                <select
                  value={docDeed}
                  onChange={(e) => setDocDeed(e.target.value as typeof docDeed)}
                  className="w-full p-1.5 bg-white border border-neutral-200 rounded text-xs text-neutral-800 focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Survey Plan</span>
                <select
                  value={docSurvey}
                  onChange={(e) => setDocSurvey(e.target.value as typeof docSurvey)}
                  className="w-full p-1.5 bg-white border border-neutral-200 rounded text-xs text-neutral-800 focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Listing Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full p-2.5 bg-white/70 border border-neutral-200 rounded-lg text-sm text-neutral-800 focus:outline-none focus:border-sage-400 focus:bg-white"
            >
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Sold">Sold</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/60 bg-white/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-neutral-500 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors shadow-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-sage-500 to-forest-800 rounded-xl hover:brightness-110 transition-all shadow-md cursor-pointer border-none"
          >
            Save Listing
          </button>
        </div>
      </div>
    </div>
  );
};
