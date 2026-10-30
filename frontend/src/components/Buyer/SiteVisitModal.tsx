import React from 'react';
import { Calendar, MapPin, X, Clock, Trees, Building2, Home, Landmark } from 'lucide-react';
import type { Property } from '../../types/types';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

// ── helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  Agricultural: Trees,
  Commercial: Building2,
  Condominium: Building2,
  'House & Lot': Home,
  Residential: Home,
};
const getTypeIcon = (type: string) => TYPE_ICON[type] || Landmark;

/** Match SiteVisit.preferredDate's existing UTC calendar-day validation. */
export const getSiteVisitDateError = (value: string): string => {
  if (!value) return 'Please select a preferred date.';
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return 'Please select a valid date.';
  }
  return value < new Date().toISOString().slice(0, 10)
    ? 'Please select today or a later date (UTC).'
    : '';
};

/** Build 30-minute time slots from 08:00 to 17:00. */
const TIME_SLOTS: { value: string; label: string }[] = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 8; h <= 17; h++) {
    for (const m of [0, 30]) {
      if (h === 17 && m === 30) continue; // stop at 17:00
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const value = `${hh}:${mm}`;
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      const label = `${hour12}:${mm} ${ampm}`;
      slots.push({ value, label });
    }
  }
  return slots;
})();

// ── component ────────────────────────────────────────────────────────────────

interface SiteVisitModalProps {
  isOpen: boolean;
  property: Property | null;
  preferredDate: string;
  preferredTime: string;
  notes: string;
  isSubmitting: boolean;
  error: string;
  onPreferredDateChange: (value: string) => void;
  onPreferredTimeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export const SiteVisitModal: React.FC<SiteVisitModalProps> = ({
  isOpen,
  property,
  preferredDate,
  preferredTime,
  notes,
  isSubmitting,
  error,
  onPreferredDateChange,
  onPreferredTimeChange,
  onNotesChange,
  onClose,
  onSubmit,
}) => {
  const modalRef = useModalAccessibility({ isOpen, onClose });
  if (!isOpen || !property) return null;

  const todayDateString = new Date().toISOString().slice(0, 10);
  const dateError = preferredDate ? getSiteVisitDateError(preferredDate) : '';
  const propertyLabel = property.title?.trim() || property.name;
  const imageUrl = property.images?.[0];
  const TypeIcon = getTypeIcon(property.type);

  const canSubmit = !!preferredDate && !dateError && !isSubmitting;

  return (
    <div className="fixed inset-0 bg-[#091413]/90 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-visit-modal-title"
        tabIndex={-1}
        className="w-full max-w-lg bg-[#0D1F1A] rounded-2xl relative border border-[rgba(40,90,72,0.2)] shadow-2xl overflow-hidden"
      >
        {/* ── close button ── */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 text-[#6A9F8A] hover:text-[#E8F5EF] transition-colors bg-transparent border-none cursor-pointer p-1"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── property info card ── */}
        <div className="flex items-center gap-4 bg-[#091413] border-b border-[rgba(40,90,72,0.15)] px-5 py-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#122A20] border border-[rgba(40,90,72,0.15)]">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) parent.classList.add('flex', 'items-center', 'justify-center');
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <TypeIcon className="w-8 h-8 text-[#6A9F8A]/60" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif font-semibold text-[#FFFFFF] text-sm leading-snug truncate">
              {propertyLabel}
            </h3>
            <p className="flex items-center gap-1 text-[11px] text-[#6A9F8A] mt-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {property.location}
            </p>
            <p className="text-xs font-bold text-[#B0E4CC] mt-1.5">
              ₱{property.price.toLocaleString()}
            </p>
          </div>
        </div>

        {/* ── form body ── */}
        <div className="px-5 pt-5 pb-6">
          {/* header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-[#122A20] rounded-xl flex items-center justify-center border border-[rgba(40,90,72,0.15)]">
              <Calendar className="w-5 h-5 text-[#B0E4CC]" />
            </div>
            <div>
              <h2 id="site-visit-modal-title" className="font-serif text-lg text-[#FFFFFF] leading-tight">
                Request Site Visit
              </h2>
              <p className="text-[11px] text-[#6A9F8A] mt-0.5">
                Choose your preferred schedule below
              </p>
            </div>
          </div>

          {/* date + time fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* date */}
              <div>
                <label
                  htmlFor="sv-preferred-date"
                  className="block text-[10px] uppercase tracking-wider font-medium text-[#6A9F8A] mb-1.5"
                >
                  Preferred Date <span className="text-red-400">*</span>
                </label>
                <input
                  id="sv-preferred-date"
                  type="date"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(dateError)}
                  aria-describedby={dateError ? 'sv-date-error' : undefined}
                  value={preferredDate}
                  onChange={(e) => onPreferredDateChange(e.target.value)}
                  min={todayDateString}
                  className={`w-full bg-[#091413] text-[#E8F5EF] border ${
                    preferredDate && dateError
                      ? 'border-red-500/50 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
                      : 'border-[rgba(40,90,72,0.3)] focus:border-[#285A48] focus:shadow-[0_0_0_3px_rgba(40,90,72,0.2)]'
                  } rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-all`}
                />
                {dateError && (
                  <p id="sv-date-error" role="alert" className="text-red-400 text-[11px] mt-1.5 font-medium">
                    {dateError}
                  </p>
                )}
              </div>

              {/* time */}
              <div>
                <label
                  htmlFor="sv-preferred-time"
                  className="block text-[10px] uppercase tracking-wider font-medium text-[#6A9F8A] mb-1.5"
                >
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Preferred Time
                  </span>
                </label>
                <select
                  id="sv-preferred-time"
                  disabled={isSubmitting}
                  value={preferredTime}
                  onChange={(e) => onPreferredTimeChange(e.target.value)}
                  className="w-full bg-[#091413] text-[#E8F5EF] border border-[rgba(40,90,72,0.3)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#285A48] focus:shadow-[0_0_0_3px_rgba(40,90,72,0.2)] transition-all cursor-pointer appearance-none"
                >
                  <option value="">No preference</option>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* notes */}
            <div>
              <label
                htmlFor="sv-notes"
                className="block text-[10px] uppercase tracking-wider font-medium text-[#6A9F8A] mb-1.5"
              >
                Notes (optional)
              </label>
              <textarea
                id="sv-notes"
                value={notes}
                disabled={isSubmitting}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={3}
                placeholder="Any special requests or questions..."
                className="w-full bg-[#091413] text-[#E8F5EF] border border-[rgba(40,90,72,0.3)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#285A48] focus:shadow-[0_0_0_3px_rgba(40,90,72,0.2)] transition-all resize-none placeholder:text-[#6A9F8A]"
              />
            </div>
          </div>

          {/* informational notice */}
          <p className="text-[11px] text-[#6A9F8A]/80 mt-4 leading-relaxed bg-[#091413] rounded-lg px-3 py-2.5 border border-[rgba(40,90,72,0.1)]">
            Submitting a request does not automatically confirm the visit. An administrator will
            review your request and contact you to schedule the visit.
          </p>

          {/* error */}
          {error && (
            <p role="alert" className="text-red-400 text-xs mt-3 font-medium">
              {error}
            </p>
          )}

          {/* buttons */}
          <div className="mt-5 flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#E8F5EF] bg-transparent border border-[rgba(40,90,72,0.3)] hover:bg-[rgba(40,90,72,0.1)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold text-[#FFFFFF] bg-[#285A48] hover:bg-[#408A71] transition-colors shadow-md hover:shadow-lg border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting…
                </span>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
