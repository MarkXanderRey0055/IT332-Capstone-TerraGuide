import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Image as ImageIcon, Compass, MapPin, Home, UploadCloud } from 'lucide-react';
import type { Property } from '../../types/types';
import { getLotSize } from '../../services/buyerPrefs';
import { uploadPropertyImages } from '../../services/PropertyService';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

interface PropertyFormModalProps {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
  onSave: (data: Omit<Property, 'id'>) => Promise<Property>;
}

type ImageMode = 'url' | 'upload';
type SelectedImage = { id: string; file: File; previewUrl: string };
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

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
  const modalRef = useModalAccessibility({ isOpen, onClose });
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [price, setPrice] = useState('');
  const [lotSize, setLotSize] = useState<number | ''>('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<Property['type'] | ''>('');
  const [suitableFor, setSuitableFor] = useState<NonNullable<Property['suitableFor']>>([]);
  const [image, setImage] = useState('');
  const [imageMode, setImageMode] = useState<ImageMode>('url');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [removedExistingImages, setRemovedExistingImages] = useState<Set<string>>(new Set());
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [imageError, setImageError] = useState('');
  const [uploadRecoveryId, setUploadRecoveryId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [docTax, setDocTax] = useState<'pending' | 'verified' | 'missing'>('pending');
  const [docDeed, setDocDeed] = useState<'pending' | 'verified' | 'missing'>('pending');
  const [docSurvey, setDocSurvey] = useState<'pending' | 'verified' | 'missing'>('pending');
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [status, setStatus] = useState<'Available' | 'Sold' | 'Reserved'>('Available');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [imgPreviewFailed, setImgPreviewFailed] = useState(false);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const clearSelectedImages = useCallback(() => {
    selectedImagesRef.current.forEach((selected) => URL.revokeObjectURL(selected.previewUrl));
    setSelectedImages([]);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      clearSelectedImages();
      setUploadRecoveryId(null);
      return;
    }
    clearSelectedImages();
    setImageMode('url');
    if (property) {
      setName(property.name);
      setOwner(property.owner ?? '');
      setPrice(property.price.toLocaleString());
      setLotSize(getLotSize(property) || '');
      setLocation(property.location);
      setType(property.type);
      setSuitableFor(property.suitableFor ?? []);
      setImage(property.images?.[0] || '');
      setExistingImages(property.images ?? []);
      setRemovedExistingImages(new Set());
      setImgPreviewFailed(false);
      setDocTax(property.documents?.tax || 'pending');
      setDocDeed(property.documents?.deed || 'pending');
      setDocSurvey(property.documents?.survey || 'pending');
      setVerificationRemarks(property.verificationRemarks || '');
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
      setExistingImages([]);
      setRemovedExistingImages(new Set());
      setDocTax('pending');
      setDocDeed('pending');
      setDocSurvey('pending');
      setVerificationRemarks('');
      setStatus('Available');
      setLat('');
      setLng('');
    }
    setErrorMsg('');
    setImageError('');
    setUploadRecoveryId(null);
  }, [property, isOpen, clearSelectedImages]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => () => {
    selectedImagesRef.current.forEach((selected) => URL.revokeObjectURL(selected.previewUrl));
  }, []);

  const retainedExistingImages = useMemo(
    () => existingImages.filter((url) => !removedExistingImages.has(url)),
    [existingImages, removedExistingImages]
  );

  const handleImageModeChange = (mode: ImageMode) => {
    setImageMode(mode);
    setImageError('');
    if (mode === 'url') clearSelectedImages();
    else setImage('');
  };

  const handleFiles = (files: File[]) => {
    setImageError('');
    const availableSlots = MAX_IMAGES - retainedExistingImages.length - selectedImages.length;
    if (files.length > availableSlots) {
      setImageError(`You can select ${Math.max(availableSlots, 0)} more image${availableSlots === 1 ? '' : 's'} for this property.`);
      return;
    }

    const validFiles: SelectedImage[] = [];
    for (const file of files) {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        setImageError(`${file.name} is not supported. Choose a JPG, JPEG, or PNG image.`);
        continue;
      }
      if (file.size === 0) {
        setImageError(`${file.name} is empty.`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setImageError(`${file.name} is larger than 5 MB.`);
        continue;
      }
      validFiles.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, previewUrl: URL.createObjectURL(file) });
    }
    setSelectedImages((current) => [...current, ...validFiles]);
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isSaving) setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (!isSaving) handleFiles(Array.from(event.dataTransfer.files));
  };

  const removeSelectedImage = (id: string) => {
    setSelectedImages((current) => {
      const selected = current.find((item) => item.id === id);
      if (selected) URL.revokeObjectURL(selected.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const removeExistingImage = (url: string) => {
    if (image.trim() === url) setImage('');
    setRemovedExistingImages((current) => new Set(current).add(url));
  };

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
    setImageError('');
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

    let desiredImages = retainedExistingImages;
    const trimmedImage = image.trim();
    if (imageMode === 'url' && trimmedImage) {
      try {
        const parsedUrl = new URL(trimmedImage);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        setImageError('Image URL must be a valid HTTP or HTTPS URL.');
        return;
      }
      if (!desiredImages.includes(trimmedImage)) desiredImages = [...desiredImages, trimmedImage];
    }
    if (desiredImages.length + selectedImages.length > MAX_IMAGES) {
      setImageError(`A property can have a maximum of ${MAX_IMAGES} images.`);
      return;
    }

    try {
      setIsSaving(true);
      const savedProperty = await onSave({
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
        // When files are pending, preserve saved images until the upload
        // succeeds. This keeps failed uploads from removing existing images.
        images: selectedImages.length > 0 ? existingImages : desiredImages,
        documents: {
          tax: docTax,
          deed: docDeed,
          survey: docSurvey,
        },
        verificationRemarks: verificationRemarks.trim(),
        lat: parsedLat,
        lng: parsedLng,
      });
      if (selectedImages.length > 0) {
        try {
          const uploadedProperty = await uploadPropertyImages(savedProperty.id, selectedImages.map((selected) => selected.file));
          if (removedExistingImages.size > 0) {
            await onSave({
              name: name.trim(), owner: owner.trim(), price: parsedPrice, size, lotSize: size,
              location: location.trim(), type, suitableFor, status,
              pricePerSqm: Math.round(parsedPrice / size),
              images: (uploadedProperty.images ?? []).filter((url) => !removedExistingImages.has(url)),
              documents: { tax: docTax, deed: docDeed, survey: docSurvey },
              verificationRemarks: verificationRemarks.trim(), lat: parsedLat, lng: parsedLng,
            });
          }
          clearSelectedImages();
        } catch (error) {
          setUploadRecoveryId(savedProperty.id);
          setErrorMsg(`Property saved, but image upload failed: ${error instanceof Error ? error.message : 'Please retry the image upload.'}`);
          return;
        }
      }
      onClose();
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

  const retryImageUpload = async () => {
    if (!uploadRecoveryId || selectedImages.length === 0) return;
    setIsSaving(true);
    setErrorMsg('');
    try {
      await uploadPropertyImages(uploadRecoveryId, selectedImages.map((selected) => selected.file));
      clearSelectedImages();
      onClose();
    } catch (error) {
      setErrorMsg(`Image upload failed again: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const labelCls = 'text-xs font-semibold text-[#5d503f] block mb-1.5';
  // Sub-label for grouped fields (GPS sub-fields, document selects)
  const subLabelCls = 'text-[10px] uppercase tracking-wider font-bold text-[#5d503f] block mb-1';

  return (
    <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-form-modal-title"
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl border border-[#d6c7b2] bg-[#f7f4ed] flex flex-col overflow-hidden max-h-[90vh]"
        style={{ boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.45)' }}
      >

        {/* ── Header ── */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[#d6c7b2] bg-[#fcfaf5]">
          <div>
          <h3 id="property-form-modal-title" className="text-[#2f2417] font-serif text-lg font-bold flex items-center gap-2">
            <Home className="w-4 h-4 text-emerald-700" />
            {property ? 'Edit Property Listing' : 'Add Property Listing'}
          </h3>
          <p className="text-xs text-[#5d503f] mt-1">Fields marked * are required. Review all sections before saving.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-[#5d503f] hover:text-[#2f2417] hover:bg-[#e7eee3] rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-800 focus-visible:outline-offset-2 transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="min-h-0 flex-1 px-4 sm:px-6 py-4 overflow-y-auto space-y-5">

          {/* Error banner */}
          {errorMsg && (
            <div className="px-3 py-2.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {errorMsg}
            </div>
          )}

          <section aria-labelledby="property-essentials-title" className="space-y-4">
            <div>
              <h4 id="property-essentials-title" className="text-sm font-bold text-[#223127] flex items-center gap-2"><Home aria-hidden="true" className="w-4 h-4 text-emerald-800" />Essentials</h4>
              <p className="text-xs text-[#5d503f] mt-1">Identify the property, its value, and suitable uses.</p>
            </div>
          <div className="space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="property-name" className={labelCls}>
                  Property Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="property-name"
                  placeholder="e.g. Riverside Villa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
              <div>
                <label htmlFor="property-owner" className={labelCls}>
                  Owner Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="property-owner"
                  placeholder="e.g. Juan dela Cruz"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="property-price" className={labelCls}>
                  Price (₱) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="property-price"
                  placeholder="e.g. 450,000"
                  value={price}
                  onChange={handlePriceChange}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
              <div>
                <label htmlFor="property-size" className={labelCls}>
                  Lot Size (sqm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="property-size"
                  placeholder="e.g. 1200"
                  value={lotSize || ''}
                  onChange={(e) => setLotSize(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="property-type" className={labelCls}>
                  Property Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="property-type"
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
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
              Suitable For
              <span className="normal-case font-normal text-[#5d503f] ml-1">(optional)</span>
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
          </section>

          {/* ── Section: GPS Coordinates ── */}
          <section aria-labelledby="property-location-title" className="border-t border-[#d6c7b2] pt-4 space-y-4">
            <div>
              <h4 id="property-location-title" className="text-sm font-bold text-[#223127] flex items-center gap-2"><MapPin aria-hidden="true" className="w-4 h-4 text-emerald-800" />Location &amp; photos</h4>
              <p className="text-xs text-[#5d503f] mt-1">Set the location and coordinates, then add an optional image URL.</p>
            </div>
            <div>
              <label htmlFor="property-location" className={labelCls}>Location <span className="text-red-500">*</span></label>
              <input id="property-location" type="text" placeholder="e.g. Balayan, Batangas" value={location} onChange={(e) => setLocation(e.target.value)} className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30" />
            </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
                <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                GPS Coordinates
              </p>
              <span className="text-[10px] text-[#5d503f] font-mono">WGS-84</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="property-latitude" className={subLabelCls}>Latitude <span className="normal-case font-normal">(optional)</span></label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 13.948324"
                  id="property-latitude"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
              <div>
                <label htmlFor="property-longitude" className={subLabelCls}>Longitude <span className="normal-case font-normal">(optional)</span></label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 120.722989"
                  id="property-longitude"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
              </div>
            </div>

            {/* Batangas preset quick-fills */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-[#d6c7b2] bg-[#eef3ea] text-xs">
              <span className="text-[#5d503f] font-semibold flex items-center gap-1 text-[11px]">
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

          {/* ── Section: Property Images ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
                <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
                <ImageIcon className="w-3.5 h-3.5 text-emerald-700" />
                Property Images <span className="normal-case font-normal text-[#5d503f]">(optional)</span>
              </label>
              <span className="text-[10px] text-[#7c6a57]">{retainedExistingImages.length + selectedImages.length}/{MAX_IMAGES}</span>
            </div>
            <div className="flex rounded-lg border border-[#d6c7b2] overflow-hidden w-fit" role="tablist" aria-label="Property image input method">
              <button type="button" role="tab" aria-selected={imageMode === 'url'} onClick={() => handleImageModeChange('url')} className={`px-3 py-1.5 text-xs font-semibold ${imageMode === 'url' ? 'bg-emerald-700 text-white' : 'bg-[#fcfaf5] text-[#5d503f]'}`}>Image URL</button>
              <button type="button" role="tab" aria-selected={imageMode === 'upload'} onClick={() => handleImageModeChange('upload')} className={`px-3 py-1.5 text-xs font-semibold ${imageMode === 'upload' ? 'bg-emerald-700 text-white' : 'bg-[#fcfaf5] text-[#5d503f]'}`}>Upload Images</button>
            </div>

            {imageMode === 'url' ? (
              <div className="space-y-2">
                <label htmlFor="property-image" className={subLabelCls}>HTTP/HTTPS image URL</label>
                <input id="property-image" type="url" placeholder="https://example.com/image.jpg" value={image} onChange={(e) => { setImage(e.target.value); setImgPreviewFailed(false); setImageError(''); }} className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30" />
                {image.trim() && (
                  <div className="h-36 w-full rounded-xl overflow-hidden border border-[#d6c7b2] bg-[#f0ece4] flex items-center justify-center">
                    {!imgPreviewFailed ? <img src={image} alt="Property URL preview" className="w-full h-full object-cover" onError={() => setImgPreviewFailed(true)} /> : <div className="text-xs text-[#7c6a57] flex flex-col items-center gap-1"><ImageIcon className="w-6 h-6 text-[#c4b49e]" /><span>Unable to load image from URL</span></div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  role="region"
                  aria-label="Property image upload"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`rounded-xl border-2 border-dashed p-5 sm:p-7 text-center transition-colors ${
                    isDragOver
                      ? 'border-emerald-700 bg-[#e3eee0]'
                      : 'border-[#9eaf9e] bg-[#eef3ea]/70 hover:border-emerald-700/60 hover:bg-[#eef3ea]'
                  }`}
                >
                  <UploadCloud aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-emerald-700" />
                  <h5 className="text-sm font-bold text-[#2f2417]">Drag and drop your images here</h5>
                  <p className="mt-1 text-xs text-[#7c6a57]">or</p>
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    disabled={retainedExistingImages.length + selectedImages.length >= MAX_IMAGES || isSaving}
                    className="mt-2 inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-800 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ImageIcon aria-hidden="true" className="mr-1.5 h-4 w-4" />
                    Browse Images
                  </button>
                  <p id="property-image-upload-help" className="mt-3 text-[10px] text-[#5d503f]">
                    JPG, JPEG or PNG · Maximum 5 MB per image · Up to 5 images
                  </p>
                  <label htmlFor="property-image-files" className="sr-only">Select property images</label>
                  <input
                    ref={imageFileInputRef}
                    id="property-image-files"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                    onChange={handleFileSelection}
                    disabled={retainedExistingImages.length + selectedImages.length >= MAX_IMAGES || isSaving}
                    aria-describedby="property-image-upload-help"
                    className="sr-only"
                  />
                </div>
              </div>
            )}

            {(retainedExistingImages.length > 0 || selectedImages.length > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Property image previews">
                {retainedExistingImages.map((url) => (
                  <div key={url} className="relative h-24 rounded-lg overflow-hidden border border-[#d6c7b2] bg-[#f0ece4]">
                    <img src={url} alt="Existing property image" className="w-full h-full object-cover" onError={(event) => { event.currentTarget.style.opacity = '0.35'; }} />
                    <button type="button" onClick={() => removeExistingImage(url)} aria-label="Remove existing property image" className="absolute top-1 right-1 rounded-full bg-black/65 text-white p-1 text-xs">×</button>
                  </div>
                ))}
                {selectedImages.map((selected) => (
                  <div key={selected.id} className="relative overflow-hidden rounded-lg border border-emerald-400 bg-[#f0ece4]">
                    <div className="h-24">
                      <img src={selected.previewUrl} alt={`Selected property image ${selected.file.name}`} className="w-full h-full object-cover" />
                    </div>
                    <p className="truncate px-2 py-1 text-[10px] text-[#5d503f]" title={selected.file.name}>{selected.file.name}</p>
                    <button type="button" onClick={() => removeSelectedImage(selected.id)} aria-label={`Remove ${selected.file.name}`} className="absolute top-1 right-1 rounded-full bg-black/65 text-white p-1 text-xs focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2">×</button>
                  </div>
                ))}
              </div>
            )}
            {removedExistingImages.size > 0 && <p className="text-[10px] text-amber-800">{removedExistingImages.size} existing image{removedExistingImages.size === 1 ? '' : 's'} marked for removal. Save to apply.</p>}
            {imageError && <p className="text-xs text-red-600" role="alert" aria-live="polite">{imageError}</p>}
            {uploadRecoveryId && <button type="button" onClick={retryImageUpload} disabled={isSaving} className="admin-button-secondary px-3 py-2 rounded-lg text-xs font-bold">{isSaving ? 'Retrying upload...' : 'Retry image upload'}</button>}
          </div>
          </section>

          {/* ── Section: Document Status ── */}
          <section aria-labelledby="property-documents-title" className="border-t border-[#d6c7b2] pt-4 space-y-4">
            <div>
              <h4 id="property-documents-title" className="text-sm font-bold text-[#223127]">Document verification</h4>
              <p className="text-xs text-[#5d503f] mt-1">Record the manual verification state for each document. These values do not change listing availability.</p>
            </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-[#d6c7b2] bg-[#eef3ea]">
              <div>
                <label htmlFor="property-tax" className={subLabelCls}>Tax Declaration</label>
                <p className="text-[10px] text-[#7c6a57] mb-1">Confirm the tax record is available for review.</p>
                <select
                  id="property-tax"
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
                <label htmlFor="property-deed" className={subLabelCls}>Title Deed</label>
                <p className="text-[10px] text-[#7c6a57] mb-1">Record the current manual title-deed review state.</p>
                <select
                  id="property-deed"
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
                <label htmlFor="property-survey" className={subLabelCls}>Survey Plan</label>
                <p className="text-[10px] text-[#7c6a57] mb-1">Record whether the survey plan is available and reviewed.</p>
                <select
                  id="property-survey"
                  value={docSurvey}
                  onChange={(e) => setDocSurvey(e.target.value as typeof docSurvey)}
                  className="admin-input w-full px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="verification-remarks" className={subLabelCls}>Verification Remarks <span className="normal-case font-normal text-[#7c6a57]">(optional)</span></label>
                <textarea id="verification-remarks" value={verificationRemarks} onChange={(e) => setVerificationRemarks(e.target.value)} rows={2} placeholder="Add context for pending or missing documents, or explain a status change..." className="admin-input w-full px-3 py-2 rounded-lg text-xs resize-none" />
              </div>
              {property?.documentVerificationHistory && property.documentVerificationHistory.length > 0 && (
                <div className="sm:col-span-2 rounded-lg border border-[#d6c7b2] bg-[#fcfaf5] p-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#5d503f] mb-2">Verification history</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {[...property.documentVerificationHistory].reverse().map((entry) => (
                      <div key={entry.id} className="text-[10px] text-[#5d503f] border-t border-[#ded2c0] pt-1.5 first:border-t-0 first:pt-0">
                        <span className="font-bold capitalize">{entry.document}</span>: {entry.previousStatus} → {entry.newStatus} · {new Date(entry.changedAt).toLocaleString('en-PH')}
                        <span className="block text-[#7c6a57]">By {entry.changedBy?.fullName || entry.changedBy?.username || 'Administrator'}{entry.remarks ? ` — ${entry.remarks}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          {/* Listing status shares the two-column document grid. */}
          <div className="space-y-2">
            <label htmlFor="property-status" className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block" />
              Listing Status
            </label>
            <select
              id="property-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
            >
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Sold">Sold</option>
            </select>
          </div>
            </div>
          </div>
          </section>

        </div>{/* end scrollable body */}

        {/* ── Footer ── */}
        <div className="shrink-0 flex flex-wrap items-center justify-end gap-3 px-4 sm:px-6 py-3 border-t border-[#d6c7b2] bg-[#fcfaf5]">
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
