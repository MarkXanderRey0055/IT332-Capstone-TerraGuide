import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  MapPin,
  RefreshCw,
  Trees,
  Building2,
  Home,
  Landmark,
  CheckCircle2,
  Tag,
  AlertCircle,
} from 'lucide-react';
import type { Property } from '../../types/types';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

const TYPE_ICON: Record<string, React.ElementType> = {
  Agricultural: Trees,
  Commercial: Building2,
  Condominium: Building2,
  'House & Lot': Home,
  Residential: Home,
};
const renderTypeIcon = (type?: string, className?: string) => {
  const IconComponent = (type && TYPE_ICON[type]) || Landmark;
  return <IconComponent className={className} />;
};

const INQUIRY_TOPICS = [
  'General Inquiry',
  'Pricing & Terms',
  'Documents & Title',
  'Site Visit & Availability',
  'Zoning & Permitted Use',
];

interface InquiryModalProps {
  isOpen: boolean;
  property: Property | null;
  propertyName?: string;
  message: string;
  isSubmitting: boolean;
  error: string;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (formattedMessage: string) => void;
}

export const InquiryModal: React.FC<InquiryModalProps> = ({
  isOpen,
  property,
  propertyName: fallbackPropertyName,
  message,
  isSubmitting,
  error,
  onMessageChange,
  onClose,
  onSubmit,
}) => {
  const modalRef = useModalAccessibility({ isOpen, onClose });
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [imgFailed, setImgFailed] = useState(false);
  const [clientValidation, setClientValidation] = useState('');

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTopic('');
      setImgFailed(false);
      setClientValidation('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const propertyLabel = property?.title?.trim() || property?.name || fallbackPropertyName || 'Selected Property';
  const imageUrl = property?.images?.[0];
  const lotSize = property?.size ?? property?.lotSize;

  const handleTopicClick = (topic: string) => {
    if (isSubmitting) return;
    if (selectedTopic === topic) {
      setSelectedTopic('');
    } else {
      setSelectedTopic(topic);
      // If user hasn't started typing or message is empty, offer a contextual starting sentence
      if (!message.trim()) {
        const topicStarters: Record<string, string> = {
          'General Inquiry': `Hello, I'm interested in ${propertyLabel} and would like to learn more about this property.`,
          'Pricing & Terms': `Hello, I would like to inquire about the pricing details, payment options, and possible financing terms for ${propertyLabel}.`,
          'Documents & Title': `Hello, I'd like to ask about the status of the land title, tax declarations, and legal documentation for ${propertyLabel}.`,
          'Site Visit & Availability': `Hello, is ${propertyLabel} currently available for an on-site visit or inspection?`,
          'Zoning & Permitted Use': `Hello, what is the zoning classification and allowed land usage for ${propertyLabel}?`,
        };
        onMessageChange(topicStarters[topic] || '');
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = message.trim();
    if (!trimmed) {
      setClientValidation('Please enter an inquiry message before sending.');
      return;
    }

    if (trimmed.length > 1000) {
      setClientValidation('Inquiry message cannot exceed 1,000 characters.');
      return;
    }

    setClientValidation('');

    // Prepend topic tag if selected and not already part of the message
    let finalMessage = trimmed;
    if (selectedTopic && !trimmed.startsWith(`[Topic:`)) {
      finalMessage = `[Topic: ${selectedTopic}]\n\n${trimmed}`;
    }

    onSubmit(finalMessage);
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > 1000;

  return (
    <div
      className="fixed inset-0 bg-[#091413]/85 backdrop-blur-md flex items-center justify-center z-[60] p-4 sm:p-6 overflow-y-auto"
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inquiry-modal-title"
        tabIndex={-1}
        className="w-full max-w-xl bg-[#0D1F1A] rounded-2xl p-5 sm:p-7 relative border border-[rgba(40,90,72,0.25)] shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-auto max-h-[92vh] flex flex-col focus:outline-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close inquiry dialog"
          className="absolute top-4 right-4 sm:top-5 sm:right-5 text-[#6A9F8A] hover:text-[#FFFFFF] transition-colors bg-transparent border-none cursor-pointer p-1.5 rounded-lg hover:bg-[rgba(40,90,72,0.2)] focus-visible:outline-2 focus-visible:outline-[#B0E4CC] disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-4 sm:mb-5">
          <div className="w-12 h-12 bg-[#122A20] rounded-xl flex items-center justify-center border border-[rgba(40,90,72,0.25)] shrink-0 shadow-inner">
            <Mail className="w-6 h-6 text-[#B0E4CC]" />
          </div>
          <div>
            <h2
              id="inquiry-modal-title"
              className="font-serif text-xl sm:text-2xl text-[#FFFFFF] tracking-tight font-medium"
            >
              Send Property Inquiry
            </h2>
            <p className="text-xs sm:text-sm text-[#6A9F8A] mt-0.5">
              Connect directly with our team regarding this listing.
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto pr-0.5 space-y-4">
          {/* Property Context Card */}
          <div className="bg-[#122A20] rounded-xl p-3 sm:p-3.5 border border-[rgba(40,90,72,0.2)] flex items-center gap-3.5 shadow-sm">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-[#091413] border border-[rgba(40,90,72,0.15)] relative">
              {imageUrl && !imgFailed ? (
                <img
                  src={imageUrl}
                  alt={propertyLabel}
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#6A9F8A] p-2 bg-[#091413]">
                  {renderTypeIcon(property?.type, 'w-7 h-7 text-[#285A48]')}
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-[#6A9F8A] mt-1 text-center line-clamp-1">
                    {property?.type || 'Property'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {property?.type && (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1A3D2F] text-[#B0E4CC] border border-[rgba(40,90,72,0.3)]">
                    {property.type}
                  </span>
                )}
                {lotSize && lotSize > 0 ? (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-[#091413] text-[#E8F5EF] border border-[rgba(40,90,72,0.2)]">
                    {lotSize.toLocaleString()} sqm
                  </span>
                ) : null}
              </div>

              <h3 className="font-serif text-sm sm:text-base font-semibold text-[#FFFFFF] truncate">
                {propertyLabel}
              </h3>

              {property?.location && (
                <p className="flex items-center gap-1 text-xs text-[#6A9F8A] mt-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-[#408A71] shrink-0" />
                  <span className="truncate">{property.location}</span>
                </p>
              )}

              {property?.price !== undefined && (
                <p className="text-sm sm:text-base font-bold text-[#B0E4CC] mt-1">
                  ₱{property.price.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Optional Topic Selection */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#B0E4CC] mb-2 flex items-center gap-1.5">
              <Tag className="w-3 h-3 text-[#408A71]" />
              Inquiry Topic <span className="text-[10px] lowercase font-normal text-[#6A9F8A]">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {INQUIRY_TOPICS.map((topic) => {
                const isSelected = selectedTopic === topic;
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => handleTopicClick(topic)}
                    disabled={isSubmitting}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-[#285A48] text-[#FFFFFF] border-[#408A71] shadow-sm'
                        : 'bg-[#091413] text-[#6A9F8A] border-[rgba(40,90,72,0.25)] hover:text-[#E8F5EF] hover:border-[rgba(40,90,72,0.4)]'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-[#B0E4CC]" />}
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inquiry Message Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="inquiry-message"
                className="text-[11px] uppercase tracking-wider font-semibold text-[#B0E4CC]"
              >
                Your Message <span className="text-red-400">*</span>
              </label>
              <span
                className={`text-[11px] ${
                  isOverLimit ? 'text-red-400 font-bold' : 'text-[#6A9F8A]'
                }`}
              >
                {characterCount} / 1,000
              </span>
            </div>
            <textarea
              id="inquiry-message"
              value={message}
              disabled={isSubmitting}
              onChange={(e) => {
                onMessageChange(e.target.value);
                if (clientValidation) setClientValidation('');
              }}
              rows={5}
              placeholder="Provide details about your interest, questions about financing, required documents, or preferred contact schedule..."
              className={`w-full bg-[#091413] text-[#E8F5EF] border ${
                clientValidation || isOverLimit
                  ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-[rgba(40,90,72,0.35)] focus:border-[#408A71] focus:ring-2 focus:ring-[rgba(40,90,72,0.3)]'
              } rounded-xl px-3.5 py-3 text-sm focus:outline-none transition-all resize-none placeholder:text-[#5A7A6A] leading-relaxed`}
            />
          </div>

          {/* Validation & Server Error Messages */}
          {(clientValidation || error) && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-red-300"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{clientValidation || error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#E8F5EF] bg-transparent border border-[rgba(40,90,72,0.35)] hover:bg-[rgba(40,90,72,0.15)] hover:text-[#FFFFFF] transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !message.trim() || isOverLimit}
              className="flex-1 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#FFFFFF] bg-[#285A48] hover:bg-[#34735c] active:scale-[0.99] transition-all shadow-md hover:shadow-lg border-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#285A48] disabled:active:scale-100"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#B0E4CC]" />
                  <span>Sending Inquiry...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Send Inquiry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InquiryModal;
