import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Image as ImageIcon, Compass, MapPin, Home, UploadCloud } from 'lucide-react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { Property } from '../../types/types';
import { getLotSize } from '../../services/buyerPrefs';
import { uploadPropertyImages } from '../../services/PropertyService';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';
import { ApiError } from '../../utils/api';

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
const PHILIPPINES_CENTER: [number, number] = [12.8797, 121.774];
const PHILIPPINES_VIEW_ZOOM = 5;
const BATANGAS_TOWN_VIEW_ZOOM = 12;
const BATANGAS_PRESETS = [
  { label: 'Balayan Capstone', lat: '13.948324', lng: '120.722989' },
  { label: 'WalterMart', lat: '13.943187', lng: '120.720345' },
  { label: 'Balayan East Central', lat: '13.931890', lng: '120.718300' },
];
// Other coordinates are approximate town centers for map framing only; verify on the map.
// Balayan intentionally reuses the existing Balayan Capstone preset coordinates.
const BATANGAS_TOWN_CENTERS: Array<{ name: string; aliases?: string[]; center: [number, number] }> = [
  { name: 'Batangas City', center: [13.7561, 121.0577] },
  { name: 'Lipa City', aliases: ['Lipa'], center: [13.9414, 121.1642] },
  { name: 'Tanauan', aliases: ['Tanauan City'], center: [14.0853, 121.1528] },
  { name: 'Calaca', center: [13.9304, 120.8128] },
  { name: 'Nasugbu', center: [14.0734, 120.6322] },
  { name: 'Balayan', center: [Number(BATANGAS_PRESETS[0].lat), Number(BATANGAS_PRESETS[0].lng)] },
  { name: 'Lemery', center: [13.8837, 120.9132] },
  { name: 'Taal', center: [13.8803, 120.9238] },
  { name: 'Bauan', center: [13.7925, 121.0076] },
  { name: 'Mabini', center: [13.7476, 120.9412] },
  { name: 'San Juan', center: [13.8246, 121.3962] },
  { name: 'Rosario', center: [13.8442, 121.2035] },
  { name: 'Ibaan', center: [13.8196, 121.1358] },
  { name: 'Cuenca', center: [13.9015, 121.0492] },
  { name: 'Lobo', center: [13.6473, 121.2100] },
  { name: 'Malvar', center: [14.0542, 121.1548] },
  { name: 'Padre Garcia', center: [13.8777, 121.2116] },
  { name: 'Laurel', center: [14.0504, 120.9332] },
  { name: 'Santa Teresita', center: [13.8698, 120.9769] },
  { name: 'Talisay', center: [14.0944, 121.0219] },
  { name: 'San Nicolas', center: [13.9302, 120.9521] },
  { name: 'Agoncillo', center: [13.9348, 120.9285] },
  { name: 'Alitagtag', center: [13.8653, 121.0046] },
  { name: 'Mataasnakahoy', aliases: ['Mataas na Kahoy'], center: [13.9625, 121.1137] },
  { name: 'Santo Tomas', aliases: ['Sto. Tomas', 'Sto Tomas'], center: [14.1068, 121.1616] },
  { name: 'Taysan', center: [13.7968, 121.1885] },
  { name: 'Tingloy', center: [13.6592, 120.8734] },
  { name: 'Balete', center: [14.0168, 121.0998] },
  { name: 'Lian', center: [14.0357, 120.6534] },
];
const DEFAULT_MARKER_ICON = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
type RequiredField = 'name' | 'owner' | 'price' | 'lotSize' | 'type' | 'location';
type CoordinateField = 'lat' | 'lng';
type RequiredFieldValues = {
  name: string;
  owner: string;
  price: string;
  lotSize: number | '';
  type: Property['type'] | '';
  location: string;
};
type RequiredFieldErrors = Partial<Record<RequiredField, string>>;
type CoordinateErrors = Partial<Record<CoordinateField, string>>;

function normalizeLocationWords(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function findBatangasTown(location: string) {
  const normalizedLocation = ` ${normalizeLocationWords(location)} `;
  return BATANGAS_TOWN_CENTERS
    .flatMap((town) => [town.name, ...(town.aliases ?? [])].map((label) => ({ town, label })))
    .filter(({ label }) => normalizedLocation.includes(` ${normalizeLocationWords(label)} `))
    .sort((first, second) => normalizeLocationWords(second.label).length - normalizeLocationWords(first.label).length)[0]?.town;
}

function parseGoogleMapsLink(value: string): [number, number] | null {
  try {
    const url = new URL(value.trim());
    const pathMatch = url.pathname.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    const candidate = pathMatch?.slice(1) ?? [url.searchParams.get('q'), url.searchParams.get('ll')]
      .filter((entry): entry is string => Boolean(entry))
      .map((entry) => entry.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)?.slice(1))
      .find((coordinates): coordinates is string[] => Boolean(coordinates));
    if (!candidate) return null;
    const coordinates = candidate.map(Number);
    if (coordinates.length !== 2 || coordinates.some((coordinate) => !Number.isFinite(coordinate))) return null;
    return [coordinates[0], coordinates[1]];
  } catch {
    return null;
  }
}

function coordinateError(value: string, field: CoordinateField) {
  if (!value.trim()) return field === 'lat' ? 'Latitude is required.' : 'Longitude is required.';
  const coordinate = Number(value);
  const minimum = field === 'lat' ? -90 : -180;
  const maximum = field === 'lat' ? 90 : 180;
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) {
    return field === 'lat'
      ? 'Latitude must be between -90 and 90.'
      : 'Longitude must be between -180 and 180.';
  }
  return undefined;
}

function hasValidCoordinatePair(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function MapViewport({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click: ({ latlng }) => onSelect(latlng.lat, latlng.lng) });
  return null;
}
const SERVER_FIELD_TO_FORM_FIELD: Record<string, RequiredField> = {
  name: 'name',
  owner: 'owner',
  price: 'price',
  lotSize: 'lotSize',
  type: 'type',
  location: 'location',
};

function mapServerFieldErrors(errors: Record<string, unknown>) {
  const fieldErrors: RequiredFieldErrors = {};
  const unmappedMessages: string[] = [];

  for (const [serverKey, message] of Object.entries(errors)) {
    const formField = SERVER_FIELD_TO_FORM_FIELD[serverKey];
    if (formField && typeof message === 'string') {
      fieldErrors[formField] = message;
    } else if (typeof message === 'string' && message.trim()) {
      unmappedMessages.push(message);
    } else {
      unmappedMessages.push(`${serverKey} validation error could not be displayed.`);
    }
  }

  return { fieldErrors, unmappedMessages };
}

function validateRequiredFields(values: RequiredFieldValues): RequiredFieldErrors {
  const errors: RequiredFieldErrors = {};
  const parsedPrice = parseFloat(values.price.replace(/,/g, ''));

  if (!values.name.trim()) errors.name = 'Property name is required.';
  if (!values.owner.trim()) errors.owner = 'Owner name is required.';
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    errors.price = 'Please enter a valid price greater than 0.';
  }
  if (!values.lotSize || values.lotSize <= 0) {
    errors.lotSize = 'Please enter a valid lot size greater than 0.';
  }
  if (!values.type) errors.type = 'Please select a property type.';
  if (!values.location.trim()) errors.location = 'Location is required.';

  return errors;
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
  const [coordinateErrors, setCoordinateErrors] = useState<CoordinateErrors>({});
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [mapLinkError, setMapLinkError] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>(PHILIPPINES_CENTER);
  const [mapZoom, setMapZoom] = useState(PHILIPPINES_VIEW_ZOOM);
  const [errorMsg, setErrorMsg] = useState('');
  const [requiredFieldErrors, setRequiredFieldErrors] = useState<RequiredFieldErrors>({});
  const [suppressRequiredSummary, setSuppressRequiredSummary] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [imgPreviewFailed, setImgPreviewFailed] = useState(false);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const ownerInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);
  const lotSizeInputRef = useRef<HTMLInputElement | null>(null);
  const typeInputRef = useRef<HTMLSelectElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const latitudeInputRef = useRef<HTMLInputElement | null>(null);
  const longitudeInputRef = useRef<HTMLInputElement | null>(null);
  const locationRecenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSelectedImages = useCallback(() => {
    selectedImagesRef.current.forEach((selected) => URL.revokeObjectURL(selected.previewUrl));
    setSelectedImages([]);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (locationRecenterTimerRef.current) clearTimeout(locationRecenterTimerRef.current);
      locationRecenterTimerRef.current = null;
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
    setCoordinateErrors({});
    setGoogleMapsLink('');
    setMapLinkError('');
    const propertyHasPin = property && hasValidCoordinatePair(property.lat, property.lng);
    const initialTown = findBatangasTown(property?.location ?? '');
    if (propertyHasPin) {
      setMapCenter([property.lat, property.lng]);
      setMapZoom(14);
    } else if (initialTown) {
      setMapCenter(initialTown.center);
      setMapZoom(BATANGAS_TOWN_VIEW_ZOOM);
    } else {
      setMapCenter(PHILIPPINES_CENTER);
      setMapZoom(PHILIPPINES_VIEW_ZOOM);
    }
    setRequiredFieldErrors({});
    setSuppressRequiredSummary(false);
    setHasSubmitted(false);
    setImageError('');
    setUploadRecoveryId(null);
  }, [property, isOpen, clearSelectedImages]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => () => {
    selectedImagesRef.current.forEach((selected) => URL.revokeObjectURL(selected.previewUrl));
    if (locationRecenterTimerRef.current) clearTimeout(locationRecenterTimerRef.current);
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
      revalidateRequiredField('price', '');
      return;
    }
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed)) {
      const nextPrice = parsed.toLocaleString();
      setPrice(nextPrice);
      revalidateRequiredField('price', nextPrice);
    } else {
      revalidateRequiredField('price', rawVal);
    }
  };

  const recenterOnCoordinates = (nextLat: string, nextLng: string) => {
    if (!nextLat.trim() || !nextLng.trim()) return;
    const latitude = Number(nextLat);
    const longitude = Number(nextLng);
    if (!hasValidCoordinatePair(latitude, longitude)) return;
    setMapCenter([latitude, longitude]);
    setMapZoom(14);
  };

  const updateCoordinatePair = (latitude: number, longitude: number) => {
    if (locationRecenterTimerRef.current) clearTimeout(locationRecenterTimerRef.current);
    locationRecenterTimerRef.current = null;
    const nextLat = String(latitude);
    const nextLng = String(longitude);
    setLat(nextLat);
    setLng(nextLng);
    setCoordinateErrors({
      lat: coordinateError(nextLat, 'lat'),
      lng: coordinateError(nextLng, 'lng'),
    });
    recenterOnCoordinates(nextLat, nextLng);
  };

  const handleCoordinateChange = (field: CoordinateField, value: string) => {
    const nextLat = field === 'lat' ? value : lat;
    const nextLng = field === 'lng' ? value : lng;
    if (field === 'lat') setLat(value);
    else setLng(value);
    setCoordinateErrors((current) => ({ ...current, [field]: coordinateError(value, field) }));
    if (hasValidCoordinatePair(Number(nextLat), Number(nextLng))) {
      if (locationRecenterTimerRef.current) clearTimeout(locationRecenterTimerRef.current);
      locationRecenterTimerRef.current = null;
    }
    recenterOnCoordinates(nextLat, nextLng);
  };

  const handleGoogleMapsPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedValue = event.clipboardData.getData('text').trim();
    if (!pastedValue) return;
    event.preventDefault();
    setGoogleMapsLink(pastedValue);
    const coordinates = parseGoogleMapsLink(pastedValue);
    if (!coordinates) {
      setMapLinkError('Couldn’t read coordinates from that link. Try copying the coordinates from Google Maps instead.');
      return;
    }
    setMapLinkError('');
    updateCoordinatePair(coordinates[0], coordinates[1]);
  };

  const applyBatangasPreset = (preset: (typeof BATANGAS_PRESETS)[number]) => {
    updateCoordinatePair(Number(preset.lat), Number(preset.lng));
  };

  const requiredValues: RequiredFieldValues = { name, owner, price, lotSize, type, location };
  const numericLatitude = lat.trim() ? Number(lat) : Number.NaN;
  const numericLongitude = lng.trim() ? Number(lng) : Number.NaN;
  const hasCoordinatePair = Boolean(lat.trim() && lng.trim()
    && Number.isFinite(numericLatitude) && Number.isFinite(numericLongitude));
  const hasMapMarker = hasCoordinatePair && hasValidCoordinatePair(numericLatitude, numericLongitude);
  const locationTown = findBatangasTown(location);
  const coordinatesLookSwapped = hasCoordinatePair
    && numericLatitude >= 116 && numericLatitude <= 127
    && numericLongitude >= 4 && numericLongitude <= 21;
  const coordinatesOutsidePhilippines = hasCoordinatePair
    && (numericLatitude < 4 || numericLatitude > 21 || numericLongitude < 116 || numericLongitude > 127);
  const recenterForLocation = (value: string) => {
    if (hasMapMarker) return;
    const town = findBatangasTown(value);
    setMapCenter(town?.center ?? PHILIPPINES_CENTER);
    setMapZoom(town ? BATANGAS_TOWN_VIEW_ZOOM : PHILIPPINES_VIEW_ZOOM);
  };
  const scheduleLocationRecenter = (value: string) => {
    if (locationRecenterTimerRef.current) clearTimeout(locationRecenterTimerRef.current);
    locationRecenterTimerRef.current = setTimeout(() => {
      recenterForLocation(value);
      locationRecenterTimerRef.current = null;
    }, 600);
  };
  const recenterWhenLocationLosesFocus = (value: string) => {
    if (locationRecenterTimerRef.current) clearTimeout(locationRecenterTimerRef.current);
    locationRecenterTimerRef.current = null;
    recenterForLocation(value);
  };
  const revalidateRequiredField = (field: RequiredField, value: RequiredFieldValues[RequiredField]) => {
    if (!hasSubmitted && !requiredFieldErrors[field]) return;
    const nextValues = { ...requiredValues, [field]: value } as RequiredFieldValues;
    const nextError = validateRequiredFields(nextValues)[field];
    setRequiredFieldErrors((current) => {
      const updated = { ...current };
      if (nextError) updated[field] = nextError;
      else delete updated[field];
      return updated;
    });
  };

  const toggleSuitableFor = (option: NonNullable<Property['suitableFor']>[number]) => {
    setSuitableFor((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const handleSave = async () => {
    setErrorMsg('');
    setImageError('');
    setSuppressRequiredSummary(false);
    setHasSubmitted(true);
    const validationErrors = validateRequiredFields(requiredValues);
    setRequiredFieldErrors(validationErrors);
    const firstInvalidField = (['name', 'owner', 'price', 'lotSize', 'type', 'location'] as const)
      .find((field) => validationErrors[field]);
    const focusRequiredField = (field: RequiredField) => {
      const fieldRefs = {
        name: nameInputRef,
        owner: ownerInputRef,
        price: priceInputRef,
        lotSize: lotSizeInputRef,
        type: typeInputRef,
        location: locationInputRef,
      };
      fieldRefs[field].current?.focus();
    };
    if (firstInvalidField) {
      focusRequiredField(firstInvalidField);
      return;
    }
    const parsedPrice = parseFloat(price.replace(/,/g, ''));

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const nextCoordinateErrors = {
      lat: coordinateError(lat, 'lat'),
      lng: coordinateError(lng, 'lng'),
    };
    setCoordinateErrors(nextCoordinateErrors);
    if (nextCoordinateErrors.lat || nextCoordinateErrors.lng) {
      if (nextCoordinateErrors.lat) latitudeInputRef.current?.focus();
      else longitudeInputRef.current?.focus();
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
      if (error instanceof ApiError && error.status === 400 && error.details) {
        const { fieldErrors, unmappedMessages } = mapServerFieldErrors(error.details);
        const firstServerError = (['name', 'owner', 'price', 'lotSize', 'type', 'location'] as const)
          .find((field) => fieldErrors[field]);
        if (firstServerError) {
          setRequiredFieldErrors(fieldErrors);
          setSuppressRequiredSummary(true);
          setErrorMsg(unmappedMessages.join(' '));
          focusRequiredField(firstServerError);
        } else {
          setErrorMsg(unmappedMessages.join(' ') || error.message);
        }
      } else {
        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'Could not save this listing. Please try again.'
        );
      }
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
  const requiredInputClass = (field: RequiredField) =>
    `admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30 ${requiredFieldErrors[field] ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : ''}`;
  const requiredInputStyle = (field: RequiredField): React.CSSProperties | undefined =>
    requiredFieldErrors[field] ? { borderColor: 'var(--color-danger)' } : undefined;
  const requiredErrorCount = Object.keys(requiredFieldErrors).length;
  const renderFieldError = (field: RequiredField, id: string) =>
    requiredFieldErrors[field] ? (
      <p id={id} className="mt-1 text-xs font-medium text-[var(--color-danger)]">
        {requiredFieldErrors[field]}
      </p>
    ) : null;
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
            <Home className="w-4 h-4 text-neutral" />
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
          {((requiredErrorCount > 0 && !suppressRequiredSummary) || errorMsg) && (
            <div role="alert" className="status-warning px-3 py-2.5 text-xs font-semibold rounded-lg">
              {requiredErrorCount > 0 && !suppressRequiredSummary
                ? `Fix ${requiredErrorCount} required field${requiredErrorCount === 1 ? '' : 's'} to save.`
                : errorMsg}
            </div>
          )}

          <section aria-labelledby="property-essentials-title" className="space-y-4">
            <div>
              <h4 id="property-essentials-title" className="text-sm font-bold text-[#223127] flex items-center gap-2"><Home aria-hidden="true" className="w-4 h-4 text-neutral" />Essentials</h4>
              <p className="text-xs text-[#5d503f] mt-1">Identify the property, its value, and suitable uses.</p>
            </div>
          <div className="space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="property-name" className={labelCls}>
                  Property Name <span className="text-warning">*</span>
                </label>
                <input
                  type="text"
                  id="property-name"
                  ref={nameInputRef}
                  placeholder="e.g. Riverside Villa"
                  value={name}
                  onChange={(e) => { setName(e.target.value); revalidateRequiredField('name', e.target.value); }}
                  aria-invalid={Boolean(requiredFieldErrors.name)}
                  aria-describedby={requiredFieldErrors.name ? 'property-name-error' : undefined}
                  className={requiredInputClass('name')}
                  style={requiredInputStyle('name')}
                />
                {renderFieldError('name', 'property-name-error')}
              </div>
              <div>
                <label htmlFor="property-owner" className={labelCls}>
                  Owner Name <span className="text-warning">*</span>
                </label>
                <input
                  type="text"
                  id="property-owner"
                  ref={ownerInputRef}
                  placeholder="e.g. Juan dela Cruz"
                  value={owner}
                  onChange={(e) => { setOwner(e.target.value); revalidateRequiredField('owner', e.target.value); }}
                  aria-invalid={Boolean(requiredFieldErrors.owner)}
                  aria-describedby={requiredFieldErrors.owner ? 'property-owner-error' : undefined}
                  className={requiredInputClass('owner')}
                  style={requiredInputStyle('owner')}
                />
                {renderFieldError('owner', 'property-owner-error')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="property-price" className={labelCls}>
                  Price (₱) <span className="text-warning">*</span>
                </label>
                <input
                  type="text"
                  id="property-price"
                  ref={priceInputRef}
                  placeholder="e.g. 450,000"
                  value={price}
                  onChange={handlePriceChange}
                  aria-invalid={Boolean(requiredFieldErrors.price)}
                  aria-describedby={requiredFieldErrors.price ? 'property-price-error' : undefined}
                  className={requiredInputClass('price')}
                  style={requiredInputStyle('price')}
                />
                {renderFieldError('price', 'property-price-error')}
              </div>
              <div>
                <label htmlFor="property-size" className={labelCls}>
                  Lot Size (sqm) <span className="text-warning">*</span>
                </label>
                <input
                  type="number"
                  id="property-size"
                  ref={lotSizeInputRef}
                  placeholder="e.g. 1200"
                  value={lotSize || ''}
                  onChange={(e) => {
                    const nextValue = e.target.value === '' ? '' : parseFloat(e.target.value);
                    setLotSize(nextValue);
                    revalidateRequiredField('lotSize', nextValue);
                  }}
                  aria-invalid={Boolean(requiredFieldErrors.lotSize)}
                  aria-describedby={requiredFieldErrors.lotSize ? 'property-lot-size-error' : undefined}
                  className={requiredInputClass('lotSize')}
                  style={requiredInputStyle('lotSize')}
                />
                {renderFieldError('lotSize', 'property-lot-size-error')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="property-type" className={labelCls}>
                  Property Type <span className="text-warning">*</span>
                </label>
                <select
                  id="property-type"
                  ref={typeInputRef}
                  value={type}
                  onChange={(e) => {
                    const nextValue = e.target.value as Property['type'] | '';
                    setType(nextValue);
                    revalidateRequiredField('type', nextValue);
                  }}
                  aria-invalid={Boolean(requiredFieldErrors.type)}
                  aria-describedby={requiredFieldErrors.type ? 'property-type-error' : undefined}
                  className={requiredInputClass('type')}
                  style={requiredInputStyle('type')}
                >
                  <option value="">Select Type</option>
                  {PROPERTY_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {renderFieldError('type', 'property-type-error')}
              </div>
            </div>
          </div>

          {/* ── Section: Suitable For ── */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-[var(--color-brand)] rounded-full inline-block" />
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
              <h4 id="property-location-title" className="text-sm font-bold text-[#223127] flex items-center gap-2"><MapPin aria-hidden="true" className="w-4 h-4 text-neutral" />Location &amp; photos</h4>
              <p className="text-xs text-[#5d503f] mt-1">Set the property location, then add optional photos.</p>
            </div>
            <div>
              <label htmlFor="property-location" className={labelCls}>Location <span className="text-warning">*</span></label>
              <input
                ref={locationInputRef}
                id="property-location"
                type="text"
                placeholder="e.g. Balayan, Batangas"
                value={location}
                onChange={(e) => {
                  const value = e.target.value;
                  setLocation(value);
                  revalidateRequiredField('location', value);
                  scheduleLocationRecenter(value);
                }}
                onBlur={(e) => recenterWhenLocationLosesFocus(e.target.value)}
                aria-invalid={Boolean(requiredFieldErrors.location)}
                aria-describedby={requiredFieldErrors.location ? 'property-location-error' : undefined}
                className={requiredInputClass('location')}
                style={requiredInputStyle('location')}
              />
              {renderFieldError('location', 'property-location-error')}
            </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#4d5e4d] flex items-center gap-1.5">
                <span className="w-1 h-3.5 bg-[var(--color-brand)] rounded-full inline-block" />
                <MapPin className="w-3.5 h-3.5 text-neutral" />
                GPS Coordinates <span className="normal-case font-normal text-warning">(required)</span>
              </p>
              <span className="text-[10px] text-[#5d503f] font-mono">WGS-84</span>
            </div>

            <p className="text-xs text-[#5d503f]">
              Where is this property on the map? Click the map to place a pin. You can also paste a Google Maps link.
            </p>
            <div className="relative z-0 h-56 sm:h-64 overflow-hidden rounded-xl border border-[#d6c7b2]">
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                scrollWheelZoom={false}
                style={{ width: '100%', height: '100%' }}
              >
                <MapViewport center={mapCenter} zoom={mapZoom} />
                <MapClickHandler onSelect={updateCoordinatePair} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {hasMapMarker && (
                  <Marker
                    position={[numericLatitude, numericLongitude]}
                    icon={DEFAULT_MARKER_ICON}
                    draggable
                    eventHandlers={{
                      dragend: (event) => {
                        const position = event.target.getLatLng();
                        updateCoordinatePair(position.lat, position.lng);
                      },
                    }}
                  />
                )}
              </MapContainer>
            </div>
            {!locationTown && (
              <p className="text-xs text-[#5d503f]">
                Click the map to place the pin, or paste a Google Maps link below.
              </p>
            )}

            <div>
              <label htmlFor="property-google-maps-link" className={subLabelCls}>Or paste a Google Maps link</label>
              <input
                id="property-google-maps-link"
                type="url"
                value={googleMapsLink}
                onChange={(event) => { setGoogleMapsLink(event.target.value); setMapLinkError(''); }}
                onPaste={handleGoogleMapsPaste}
                aria-invalid={Boolean(mapLinkError)}
                aria-describedby={mapLinkError ? 'property-google-maps-link-error' : undefined}
                placeholder="https://maps.google.com/..."
                className={`admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30 ${mapLinkError ? 'border-[var(--color-danger)]' : ''}`}
              />
              {mapLinkError && (
                <p id="property-google-maps-link-error" className="mt-1 text-xs font-medium text-[var(--color-danger)]" role="alert">
                  {mapLinkError}
                </p>
              )}
            </div>

            {coordinatesLookSwapped && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-warning)] bg-amber-50 px-3 py-2 text-xs text-[#5d503f]" role="status">
                <span>These look swapped. Latitude should be the smaller number, around 14 for Batangas. Swap them?</span>
                <button
                  type="button"
                  onClick={() => updateCoordinatePair(numericLongitude, numericLatitude)}
                  className="font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >Swap them</button>
              </div>
            )}
            {coordinatesOutsidePhilippines && (
              <p className="text-xs text-[#7c6a57]" role="status">These coordinates are outside the Philippines. Check that the pin is in the intended location.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="property-latitude" className={subLabelCls}>Latitude <span className="normal-case font-normal text-warning">(required)</span></label>
                <input
                  ref={latitudeInputRef}
                  type="number"
                  step="any"
                  placeholder="e.g. 13.948324"
                  id="property-latitude"
                  value={lat}
                  onChange={(e) => handleCoordinateChange('lat', e.target.value)}
                  aria-invalid={Boolean(coordinateErrors.lat)}
                  aria-describedby={coordinateErrors.lat ? 'property-latitude-error' : undefined}
                  className={`admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30 ${coordinateErrors.lat ? 'border-[var(--color-danger)]' : ''}`}
                />
                {coordinateErrors.lat && <p id="property-latitude-error" className="mt-1 text-xs font-medium text-[var(--color-danger)]" role="alert">{coordinateErrors.lat}</p>}
              </div>
              <div>
                <label htmlFor="property-longitude" className={subLabelCls}>Longitude <span className="normal-case font-normal text-warning">(required)</span></label>
                <input
                  ref={longitudeInputRef}
                  type="number"
                  step="any"
                  placeholder="e.g. 120.722989"
                  id="property-longitude"
                  value={lng}
                  onChange={(e) => handleCoordinateChange('lng', e.target.value)}
                  aria-invalid={Boolean(coordinateErrors.lng)}
                  aria-describedby={coordinateErrors.lng ? 'property-longitude-error' : undefined}
                  className={`admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30 ${coordinateErrors.lng ? 'border-[var(--color-danger)]' : ''}`}
                />
                {coordinateErrors.lng && <p id="property-longitude-error" className="mt-1 text-xs font-medium text-[var(--color-danger)]" role="alert">{coordinateErrors.lng}</p>}
              </div>
            </div>

            {/* Batangas preset quick-fills */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-[#d6c7b2] bg-[#eef3ea] text-xs">
              <span className="text-[#5d503f] font-semibold flex items-center gap-1 text-[11px]">
                <Compass className="w-3.5 h-3.5 text-neutral" />
                Batangas Presets:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyBatangasPreset(BATANGAS_PRESETS[0])}
                  className="admin-button-secondary px-2 py-1 rounded-lg cursor-pointer transition-all text-[#5d503f] font-semibold text-[10px]"
                >
                  Balayan Capstone
                </button>
                <button
                  type="button"
                  onClick={() => applyBatangasPreset(BATANGAS_PRESETS[1])}
                  className="admin-button-secondary px-2 py-1 rounded-lg cursor-pointer transition-all text-[#5d503f] font-semibold text-[10px]"
                >
                  WalterMart
                </button>
                <button
                  type="button"
                  onClick={() => applyBatangasPreset(BATANGAS_PRESETS[2])}
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
                <span className="w-1 h-3.5 bg-[var(--color-brand)] rounded-full inline-block" />
                <ImageIcon className="w-3.5 h-3.5 text-neutral" />
                Property Images <span className="normal-case font-normal text-[#5d503f]">(optional)</span>
              </label>
              <span className="text-[10px] text-[#7c6a57]">{retainedExistingImages.length + selectedImages.length}/{MAX_IMAGES}</span>
            </div>
            <div className="flex rounded-lg border border-[#d6c7b2] overflow-hidden w-fit" role="tablist" aria-label="Property image input method">
              <button type="button" role="tab" aria-selected={imageMode === 'url'} onClick={() => handleImageModeChange('url')} className={`px-3 py-1.5 text-xs font-semibold ${imageMode === 'url' ? 'bg-[var(--color-brand)] text-white' : 'bg-[#fcfaf5] text-[#5d503f]'}`}>Image URL</button>
              <button type="button" role="tab" aria-selected={imageMode === 'upload'} onClick={() => handleImageModeChange('upload')} className={`px-3 py-1.5 text-xs font-semibold ${imageMode === 'upload' ? 'bg-[var(--color-brand)] text-white' : 'bg-[#fcfaf5] text-[#5d503f]'}`}>Upload Images</button>
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
                      ? 'border-[var(--color-brand)] bg-[#e3eee0]'
                      : 'border-[#9eaf9e] bg-[#eef3ea]/70 hover:border-[var(--color-brand)] hover:bg-[#eef3ea]'
                  }`}
                >
                  <UploadCloud aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-neutral" />
                  <h5 className="text-sm font-bold text-[#2f2417]">Drag and drop your images here</h5>
                  <p className="mt-1 text-xs text-[#7c6a57]">or</p>
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    disabled={retainedExistingImages.length + selectedImages.length >= MAX_IMAGES || isSaving}
                    className="mt-2 inline-flex items-center rounded-lg bg-[var(--color-brand)] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--color-brand-dark)] focus-visible:outline-2 focus-visible:outline-[var(--color-brand)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <div key={selected.id} className="relative overflow-hidden rounded-lg border border-[var(--color-brand)] bg-[#f0ece4]">
                    <div className="h-24">
                      <img src={selected.previewUrl} alt={`Selected property image ${selected.file.name}`} className="w-full h-full object-cover" />
                    </div>
                    <p className="truncate px-2 py-1 text-[10px] text-[#5d503f]" title={selected.file.name}>{selected.file.name}</p>
                    <button type="button" onClick={() => removeSelectedImage(selected.id)} aria-label={`Remove ${selected.file.name}`} className="absolute top-1 right-1 rounded-full bg-black/65 text-white p-1 text-xs focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2">×</button>
                  </div>
                ))}
              </div>
            )}
            {removedExistingImages.size > 0 && <p className="text-[10px] text-warning">{removedExistingImages.size} existing image{removedExistingImages.size === 1 ? '' : 's'} marked for removal. Save to apply.</p>}
            {imageError && <p className="text-xs text-warning" role="alert" aria-live="polite">{imageError}</p>}
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
              <span className="w-1 h-3.5 bg-[var(--color-brand)] rounded-full inline-block" />
              Listing Status
            </label>
            {status === 'Available' ? (
              <select
                id="property-status"
                value="Available"
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="admin-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
              >
                <option value="Available">Available</option>
              </select>
            ) : (
              <div id="property-status" className="py-2 text-sm font-semibold text-neutral-700">
                <span>{status}</span>
                <p className="mt-1 text-xs font-normal text-neutral-500">
                  Managed by transactions. Cancel or complete the transaction to change this.
                </p>
              </div>
            )}
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
