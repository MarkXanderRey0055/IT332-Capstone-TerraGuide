import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Image as ImageIcon,
  ImageOff,
  MapPin,
  Pencil,
  X,
  XCircle,
} from 'lucide-react';
import type { Property } from '../../types/types';
import type { Cabinet } from '../../services/CabinetService';
import { getLotSize } from '../../services/buyerPrefs';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

interface ViewPropertyModalProps {
  isOpen: boolean;
  property: Property | null;
  cabinets: Cabinet[];
  onClose: () => void;
  onEdit: (property: Property) => void;
  onAssignCabinet: (propertyId: string, cabinetId: string) => Promise<void>;
}

type DocumentKind = 'deed' | 'tax' | 'survey';
type DocumentStatus = 'pending' | 'verified' | 'missing';

const DOCUMENTS: Array<{ kind: DocumentKind; label: string }> = [
  { kind: 'deed', label: 'Title Deed' },
  { kind: 'tax', label: 'Tax Declaration' },
  { kind: 'survey', label: 'Survey Plan' },
];

const statusMeta: Record<DocumentStatus, { label: string; className: string; icon: React.ReactNode }> = {
  verified: {
    label: 'Verified',
    className: 'status-success',
    icon: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />,
  },
  pending: {
    label: 'Pending review',
    className: 'status-warning',
    icon: <Clock className="h-4 w-4 text-warning" aria-hidden="true" />,
  },
  missing: {
    label: 'Missing',
    className: 'status-warning',
    icon: <XCircle className="h-4 w-4 text-warning" aria-hidden="true" />,
  },
};

const readable = (value: string | number | null | undefined, fallback = 'Not provided') => {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  return String(value);
};

const formatNumber = (value: number | null | undefined, suffix = '') => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not provided';
  return `${value.toLocaleString()}${suffix}`;
};

const getStatus = (value: DocumentStatus | undefined): DocumentStatus =>
  value === 'verified' || value === 'missing' || value === 'pending' ? value : 'pending';

export const ViewPropertyModal: React.FC<ViewPropertyModalProps> = ({
  isOpen,
  property,
  cabinets,
  onClose,
  onEdit,
  onAssignCabinet,
}) => {
  const modalRef = useModalAccessibility({ isOpen, onClose });
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [selectedCabinetId, setSelectedCabinetId] = useState('');
  const [isAssigningCabinet, setIsAssigningCabinet] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [coordinatesCopied, setCoordinatesCopied] = useState(false);

  useEffect(() => {
    setBrokenImages(new Set());
    setSelectedCabinetId(property?.cabinetId ?? '');
    setAssignmentError('');
    setCoordinatesCopied(false);
  }, [property?.id, property?.cabinetId, isOpen]);

  const images = useMemo(() => property?.images?.filter((image) => image.trim()) ?? [], [property]);

  if (!isOpen || !property) return null;

  const lotSize = getLotSize(property);
  const hasCoordinates = Number.isFinite(property.lat) && Number.isFinite(property.lng);
  const formattedPrice = typeof property.price === 'number' && Number.isFinite(property.price)
    ? `₱${Math.round(property.price).toLocaleString()}`
    : 'Not provided';
  const listingStatus = property.status || 'Not provided';
  const listingStatusClass = property.status === 'Available' ? 'status-success' : 'status-neutral';
  const filingStateClass = selectedCabinetId ? 'status-success' : 'status-neutral';
  const coordinateText = hasCoordinates ? `${property.lat}, ${property.lng}` : '';
  const selectedCabinet = cabinets.find((cabinet) => cabinet.id === selectedCabinetId) ?? null;
  const handleEdit = () => {
    onClose();
    onEdit(property);
  };
  const handleCabinetChange = async (cabinetId: string) => {
    if (!cabinetId || cabinetId === property.cabinetId) return;
    setAssignmentError('');
    setIsAssigningCabinet(true);
    try {
      await onAssignCabinet(property.id, cabinetId);
      setSelectedCabinetId(cabinetId);
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'Could not assign this property to the cabinet.');
    } finally {
      setIsAssigningCabinet(false);
    }
  };
  const handleCopyCoordinates = async () => {
    if (!coordinateText) return;
    try {
      await navigator.clipboard.writeText(coordinateText);
      setCoordinatesCopied(true);
      window.setTimeout(() => setCoordinatesCopied(false), 1800);
    } catch {
      setCoordinatesCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="presentation">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-property-title"
        tabIndex={-1}
        className="admin-panel relative z-[10000] flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ background: '#ffffff' }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8dfd3] bg-white px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[9px] text-[#7c6a57]">Property details</p>
            <h2 id="view-property-title" className="mt-0.5 break-words font-serif text-base font-bold text-[#2f2417]">
              {readable(property.name)}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-neutral-dark">{formattedPrice}</span>
              <span className={`${listingStatusClass} rounded-full px-2 py-0.5 text-[9px] font-bold`}>{listingStatus}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="admin-icon-btn shrink-0 rounded-lg"
            aria-label="Close property details"
            title="Close property details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-3.5">
          <section aria-labelledby="property-images-heading" className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 id="property-images-heading" className="flex items-center gap-2 text-[11px] font-bold text-[#2f2417]"><ImageIcon className="h-3.5 w-3.5 text-neutral" aria-hidden="true" /> Property images</h3>
              <span className="text-[10px] text-[#7c6a57]">{images.length} image{images.length === 1 ? '' : 's'}</span>
            </div>
            {images.length === 0 ? <div className="rounded-xl border border-dashed border-[#cdbda6] bg-[#faf6ef]/60 p-8 text-center text-sm text-[#7c6a57]">No property images available.</div> : <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">{images.map((image, index) => brokenImages.has(image) ? <div key={`${image}-${index}`} className={`${index === 0 ? 'col-span-2 row-span-2' : ''} flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#cdbda6] bg-[#faf6ef]/60 p-3 text-center text-[10px] text-[#7c6a57]`}><ImageOff className="h-5 w-5" aria-hidden="true" />Image unavailable</div> : <img key={`${image}-${index}`} src={image} alt={`${readable(property.name)} image ${index + 1}`} className={`${index === 0 ? 'col-span-2 row-span-2' : ''} aspect-square w-full rounded-lg object-cover`} onError={() => setBrokenImages((current) => new Set(current).add(image))} />)}</div>}
          </section>

          <section aria-labelledby="property-cabinet-heading" className={`${filingStateClass} mt-3 rounded-xl px-3 py-2.5`}>
            <div className="flex items-center justify-between gap-3">
              <h3 id="property-cabinet-heading" className={`flex items-center gap-1.5 text-[10px] font-bold ${selectedCabinetId ? 'text-success' : 'filing-info'}`}><AlertCircle className={`h-3.5 w-3.5 ${selectedCabinetId ? 'text-success' : 'filing-info'}`} aria-hidden="true" /> Filing cabinet</h3>
              <span className={`text-[10px] font-semibold ${selectedCabinetId ? 'text-success' : 'filing-info'}`}>{selectedCabinetId ? 'Filed' : 'Needs filing'}</span>
            </div>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <label className="sr-only" htmlFor="property-cabinet-select">Filing cabinet</label>
              <select
                id="property-cabinet-select"
                aria-label="Filing cabinet"
                value={selectedCabinetId}
                disabled={isAssigningCabinet}
                onChange={(event) => void handleCabinetChange(event.target.value)}
                className="admin-input min-w-0 rounded-lg border-0 bg-white px-2 py-1.5 text-xs font-semibold text-[#3d4a3d]"
              >
                <option value="">Unassigned</option>
                {cabinets.map((cabinet) => <option key={cabinet.id} value={cabinet.id}>{cabinet.name}</option>)}
              </select>
              {selectedCabinetId ? (
                <>
                  <label className="sr-only" htmlFor="property-folder-select">Folder</label>
                  <select id="property-folder-select" aria-label="Folder" disabled className="admin-input min-w-0 rounded-lg border-0 bg-white px-2 py-1.5 text-xs text-[#7c6a57] disabled:cursor-not-allowed disabled:opacity-70">
                    <option>{selectedCabinet ? 'No folders configured' : 'Cabinet unavailable'}</option>
                  </select>
                </>
              ) : (
                <div className="flex items-center rounded-lg bg-white/70 px-2 py-1.5 text-xs text-[#7c6a57]" aria-hidden="true">
                  Select a cabinet to choose a folder
                </div>
              )}
            </div>
            {isAssigningCabinet && <p className="mt-1 text-[10px] text-[#7c6a57]">Saving cabinet assignment...</p>}
            {assignmentError && <p className="mt-1 text-[10px] font-semibold text-warning">{assignmentError}</p>}
          </section>

          <section aria-labelledby="property-facts-heading" className="mt-4">
            <h3 id="property-facts-heading" className="text-[11px] font-bold text-[#2f2417]">Key facts</h3>
            <dl className="mt-1 divide-y divide-[#eee7dd] text-[11px]">
              <div className="flex items-start justify-between gap-4 py-2"><dt className="text-[#7c6a57]">Type</dt><dd className="text-right font-semibold text-[#223127]">{readable(property.type)}</dd></div>
              <div className="flex items-start justify-between gap-4 py-2"><dt className="text-[#7c6a57]">Owner</dt><dd className="text-right font-semibold text-[#223127]">{readable(property.owner)}</dd></div>
              <div className="flex items-start justify-between gap-4 py-2"><dt className="text-[#7c6a57]">Location</dt><dd className="max-w-[70%] text-right font-semibold text-[#223127]">{readable(property.location)}</dd></div>
              <div className="flex items-start justify-between gap-4 py-2"><dt className="text-[#7c6a57]">Lot size</dt><dd className="text-right font-semibold text-[#223127]">{formatNumber(lotSize, ' sqm')}</dd></div>
              <div className="flex items-start justify-between gap-4 py-2"><dt className="text-[#7c6a57]">Suitable for</dt><dd className="max-w-[70%] text-right font-semibold text-[#223127]">{property.suitableFor?.length ? property.suitableFor.join(', ') : 'Not provided'}</dd></div>
              <div className="flex items-start justify-between gap-4 py-2"><dt className="text-[#7c6a57]">Description</dt><dd className="max-w-[70%] whitespace-pre-wrap break-words text-right font-semibold text-[#223127]">{readable(property.description)}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="property-documents-heading" className="mt-4">
            <h3 id="property-documents-heading" className="flex items-center gap-1.5 text-[11px] font-bold text-[#2f2417]"><FileText className="h-3.5 w-3.5 text-neutral" aria-hidden="true" /> Documents</h3>
            <div className="mt-1 divide-y divide-[#eee7dd]">
              {DOCUMENTS.map(({ kind, label }) => {
                const status = statusMeta[getStatus(property.documents?.[kind])];
                return <div key={kind} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[11px]"><span className="font-semibold text-[#223127]">{label}</span><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.className}`}>{status.icon}{status.label}</span></div>;
              })}
            </div>
          </section>

          <section aria-labelledby="property-coordinates-heading" className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 id="property-coordinates-heading" className="flex items-center gap-1.5 text-[11px] font-bold text-[#2f2417]"><MapPin className="h-3.5 w-3.5 text-neutral" aria-hidden="true" /> Coordinates</h3>
              <button type="button" onClick={() => void handleCopyCoordinates()} disabled={!coordinateText} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-40" aria-label="Copy coordinates" title="Copy coordinates">
                <Copy className="h-3 w-3" aria-hidden="true" /> {coordinatesCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-1.5 grid grid-cols-[7rem_1fr] items-center gap-3 rounded-xl border border-[#e8dfd3] bg-white p-2">
              <div className="relative h-16 overflow-hidden rounded-lg border border-[#d6c7b2] bg-[#dce7d8]" aria-label="Static map thumbnail" role="img">
                <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(28deg, transparent 46%, #b7c9b0 47%, #b7c9b0 50%, transparent 51%), linear-gradient(118deg, transparent 42%, #c5d4c1 43%, #c5d4c1 46%, transparent 47%), linear-gradient(90deg, transparent 48%, #e4d5b9 49%, #e4d5b9 52%, transparent 53%)' }} />
                <MapPin className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 fill-[var(--color-neutral)] text-[var(--color-neutral-dark)] drop-shadow" aria-hidden="true" />
              </div>
              <p className="break-all font-mono text-[10px] font-semibold text-[#3d4a3d]">{coordinateText || 'Coordinates not provided'}</p>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#e8dfd3] bg-white px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-xs font-semibold text-[#3d4a3d]">Close</button>
          <button type="button" onClick={handleEdit} className="admin-button flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit Listing</button>
        </div>
      </div>
    </div>
  );
};

export default ViewPropertyModal;
