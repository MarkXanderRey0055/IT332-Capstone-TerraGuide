import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Compass, MapPin, Home } from 'lucide-react';
import type { Property } from '../../types/types';
import { getLotSize } from '../../services/buyerPrefs';

interface PropertyFormModalProps {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
  onSave: (data: Omit<Property, 'id'>) => Promise<void>;
}

const PROPERTY_TYPES: Property['type'][] = [
  'Agricultural',
  'Residential',
  'Commercial',
  'Condominium',
  'House & Lot',
];

// Same five values as the buyer's intendedUse preference in WelcomeModal —
// this vocabulary must stay in sync so recommendation matching stays exact.
const SUITABLE_FOR_OPTIONS: NonNullable<Property['suitableFor']>[number][] = [
  'Primary Residence',
  'Investment',
  'Business',
  'Farming',
  'Vacation Home',
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
  const [suitableFor, setSuitableFor] = useState<NonNullable<Property['suitableFor']>>([]);
  const [image, setImage] = useState('');
  const [docTax, setDocTax] = useState<'pending' | 'verified' | 'missing'>('pending');
  const [docDeed, setDocDeed] = useState<'pending' | 'verified' | 'missing'>('pending');
  const [docSurvey, setDocSurvey] = useState<'pending' | 'verified' | 'missing'>('pending');
  const [status, setStatus] = useState<'Available' | 'Sold' | 'Reserved'>('Available');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [imgPreviewFailed, setImgPreviewFailed] = useState(false);

  useEffect(() => {
    if (property) {
      setName(property.name);
      setOwner(property.owner ?? '');
      setPrice(property.price.toLocaleString());
      setLotSize(getLotSize(property) || '');
      setLocation(property.location);
      setType(property.type);
      setSuitableFor(property.suitableFor ?? []);
      setImage(property.images?.[0] || '');
      setImgPreviewFailed(false);
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
      setSuitableFor([]);
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

  const toggleSuitableFor = (option: NonNullable<Property['suitableFor']>[number]) => {
    setSuitableFor((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const handleSave = async () => {
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

    try {
      setIsSaving(true);
      await onSave({
        name: name.trim(),
        owner: owner.trim(),
        price: parsedPrice,
        size,
        lotSize: size,
        location: location.trim(),
        type,
        suitableFor,
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
      // onSave (in AdminProperties) already closes the modal on success,
      // so there's nothing else to do here once the await resolves.
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Could not save this listing. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Shared label style — matches CabinetFormModal / TransactionFormModal
  const labelCls = 'text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1';
  // Sub-label for grouped fields (GPS sub-fields, document selects)
  const subLabelCls = 'text-[10px] uppercase tracking-wider font-bold text-[#9d8c76] block mb-1';

  return (
    <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="admin-panel w-full max-w-xl rounded-2xl flex flex-col overflow-hidden max-h-[90vh]"
        style={{ boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.45)' }}
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2]">
          <h3 className="text-[#2f2417] font-serif text-lg font-bold flex items-center gap-2">
            <Home className="w-4 h-4 text-emerald-700" />
            {property ? 'Edit Property Listing' : 'Add Property Listing'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#8f7d69] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="px-6 py-5 overflow-y-auto space-y-5">

          {/* Error banner */}
          {errorMsg && (
            <div className="px-3 py-2.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* ── Section: Basic Info ── */}
          <div className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
              Basic Information
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Property Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Riverside Villa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
              <div>
                <label className={labelCls}>
                  Owner Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Juan dela Cruz"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Price (₱) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 450,000"
                  value={price}
                  onChange={handlePriceChange}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
              <div>
                <label className={labelCls}>
                  Lot Size (sqm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1200"
                  value={lotSize || ''}
                  onChange={(e) => setLotSize(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Balayan, Batangas"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
              <div>
                <label className={labelCls}>
                  Property Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as Property['type'])}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
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
          </div>

          {/* ── Section: Suitable For ── */}
          <div className="border-t border-[#d6c7b2] pt-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
              Suitable For
              <span className="normal-case font-normal text-[#9d8c76] ml-1">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {SUITABLE_FOR_OPTIONS.map((option) => {
                const checked = suitableFor.includes(option);
                return (
                  <label
                    key={option}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      checked
                        ? 'admin-button text-white border-transparent'
                        : 'admin-panel-muted text-[#5d503f] border-[#d6c7b2] hover:border-[#b8a990]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSuitableFor(option)}
                      className="cursor-pointer accent-emerald-700"
                    />
                    {option}
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Section: GPS Coordinates ── */}
          <div className="border-t border-[#d6c7b2] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
                <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                GPS Coordinates
              </p>
              <span className="text-[10px] text-[#9d8c76] font-mono">WGS-84</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={subLabelCls}>Latitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 13.948324"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
              <div>
                <label className={subLabelCls}>Longitude</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 120.722989"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
            </div>

            {/* Batangas preset quick-fills */}
            <div className="admin-panel-muted flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-[#d6c7b2] text-xs">
              <span className="text-[#7c6a57] font-semibold flex items-center gap-1 text-[11px]">
                <Compass className="w-3.5 h-3.5 text-emerald-700" />
                Batangas Presets:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setLat('13.948324'); setLng('120.722989'); }}
                  className="admin-button-secondary px-2 py-1 rounded-lg cursor-pointer transition-all text-[#5d503f] font-semibold text-[10px]"
                >
                  Balayan Capstone
                </button>
                <button
                  type="button"
                  onClick={() => { setLat('13.943187'); setLng('120.720345'); }}
                  className="admin-button-secondary px-2 py-1 rounded-lg cursor-pointer transition-all text-[#5d503f] font-semibold text-[10px]"
                >
                  WalterMart
                </button>
                <button
                  type="button"
                  onClick={() => { setLat('13.931890'); setLng('120.718300'); }}
                  className="admin-button-secondary px-2 py-1 rounded-lg cursor-pointer transition-all text-[#5d503f] font-semibold text-[10px]"
                >
                  Balayan East Central
                </button>
              </div>
            </div>
          </div>

          {/* ── Section: Image URL ── */}
          <div className="border-t border-[#d6c7b2] pt-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
              <ImageIcon className="w-3.5 h-3.5 text-emerald-700" />
              Image URL
              <span className="normal-case font-normal text-[#9d8c76] ml-1">(optional)</span>
            </p>
            <input
              type="text"
              placeholder="https://example.com/image.jpg"
              value={image}
              onChange={(e) => {
                setImage(e.target.value);
                setImgPreviewFailed(false);
              }}
              className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
            />
            {image.trim() && (
              <div className="mt-2 h-36 w-full rounded-xl overflow-hidden border border-[#d6c7b2] bg-[#f0ece4] flex items-center justify-center">
                {!imgPreviewFailed ? (
                  <img
                    src={image}
                    alt="Property Preview"
                    className="w-full h-full object-cover"
                    onError={() => setImgPreviewFailed(true)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#9d8c76] gap-1.5 p-3 text-center">
                    <ImageIcon className="w-6 h-6 text-[#c4b49e]" />
                    <span className="text-xs text-[#7c6a57]">Unable to load image from URL</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section: Document Status ── */}
          <div className="border-t border-[#d6c7b2] pt-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
              Document Status
            </p>
            <div className="admin-panel-muted grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border border-[#d6c7b2]">
              <div>
                <label className={subLabelCls}>Tax Declaration</label>
                <select
                  value={docTax}
                  onChange={(e) => setDocTax(e.target.value as typeof docTax)}
                  className="admin-input w-full px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
              <div>
                <label className={subLabelCls}>Title Deed</label>
                <select
                  value={docDeed}
                  onChange={(e) => setDocDeed(e.target.value as typeof docDeed)}
                  className="admin-input w-full px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
              <div>
                <label className={subLabelCls}>Survey Plan</label>
                <select
                  value={docSurvey}
                  onChange={(e) => setDocSurvey(e.target.value as typeof docSurvey)}
                  className="admin-input w-full px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Section: Listing Status ── */}
          <div className="border-t border-[#d6c7b2] pt-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
              Listing Status
            </p>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
            >
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Sold">Sold</option>
            </select>
          </div>

        </div>{/* end scrollable body */}

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#d6c7b2]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="admin-button px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer border-none hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Listing'}
          </button>
        </div>

      </div>
    </div>
  );
};