import React, { useState } from 'react';
import { ArrowLeft, Calendar, Mail, MapPin, Eye, Trees, Building2, Home, Landmark } from 'lucide-react';
import type { Property } from '../../types/types';
import { PropertyLocationModal } from './RealtimeLocationModal';

interface PropertyDetailsProps {
  property: Property | null;
  properties: Property[];
  onBack: () => void;
  onRequestVisit?: () => void;
  onSendInquiry?: () => void;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  Agricultural: Trees,
  Commercial: Building2,
  Condominium: Building2,
  'House & Lot': Home,
  Residential: Home,
};
const getTypeIcon = (type: string) => TYPE_ICON[type] || Landmark;

const formatPrice = (price: number) =>
  `₱${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const PropertyDetails: React.FC<PropertyDetailsProps> = ({
  property,
  properties,
  onBack,
  onRequestVisit,
  onSendInquiry,
}) => {
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  if (!property) {
    return null;
  }

  const imageUrl = property.images?.[0];
  const TypeIcon = getTypeIcon(property.type);
  const propertyLabel = property.title?.trim() || property.name;

  const lotSize = property.size ?? property.lotSize ?? 0;
  const pricePerSqm =
    property.pricePerSqm && property.pricePerSqm > 0
      ? property.pricePerSqm
      : lotSize > 0
        ? property.price / lotSize
        : 0;

  return (
    <div className="min-h-screen bg-[#F7F4ED] text-[#1E2E24] font-sans px-6 py-8">
      <PropertyLocationModal
        isOpen={isMapModalOpen}
        property={property}
        properties={properties}
        onClose={() => setIsMapModalOpen(false)}
      />
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1C3A27] hover:text-[#0f291b]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to listings
        </button>

        <div className="rounded-[32px] bg-white border border-neutral-200 shadow-xl overflow-hidden">
          <div className="relative bg-neutral-100 h-72 sm:h-96">
            {imageUrl && !imgFailed ? (
              <img
                src={imageUrl}
                alt=""
                aria-hidden="true"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#EAE8E2] flex flex-col items-center justify-center text-[#5A7A6A] gap-2">
                <TypeIcon className="w-16 h-16 text-[#5A7A6A]/60" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#5A7A6A]">
                  {property.type} Listing
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4">
              <div className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-700">
                {property.type}
              </div>
              <div className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-700">
                {formatPrice(property.price)}
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-[0.3em] text-emerald-500 font-bold">Property Details</div>
                <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#1C3A27]">
                  {propertyLabel}
                </h1>
                <p className="text-sm text-neutral-500 max-w-2xl">
                  {property.description?.trim() ? property.description : 'No property description provided.'}
                </p>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-[#F5F7F6] p-5 shadow-sm w-full max-w-sm">
                <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold mb-4">
                  Quick Specs
                </div>
                <div className="space-y-3 text-sm text-[#1E2E24]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Location</span>
                    <span className="text-neutral-500">{property.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Lot Size</span>
                    <span className="text-neutral-500">{lotSize.toLocaleString()} sqm</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Status</span>
                    <span className="text-neutral-500">{property.status}</span>
                  </div>
                  {pricePerSqm > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Price / sqm</span>
                      <span className="text-neutral-500">₱{Math.round(pricePerSqm).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-6 text-sm text-[#334032]">
                <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold mb-4">
                    Property Overview
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[#F4F9F6] p-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">Location</div>
                        <div className="mt-2 font-semibold text-[#1C3A27]">{property.location}</div>
                      </div>
                      <div className="rounded-2xl bg-[#F4F9F6] p-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">Lot Size</div>
                        <div className="mt-2 font-semibold text-[#1C3A27]">{lotSize.toLocaleString()} sqm</div>
                      </div>
                      <div className="rounded-2xl bg-[#F4F9F6] p-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">Status</div>
                        <div className="mt-2 font-semibold text-[#1C3A27]">{property.status}</div>
                      </div>
                      <div className="rounded-2xl bg-[#F4F9F6] p-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">Property Type</div>
                        <div className="mt-2 font-semibold text-[#1C3A27]">{property.type}</div>
                      </div>
                      {property.suitableFor && property.suitableFor.length > 0 && (
                        <div className="rounded-2xl bg-[#F4F9F6] p-4 sm:col-span-2">
                          <div className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">Suitable Uses</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {property.suitableFor.map((use) => (
                              <span key={use} className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200">
                                {use}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={onRequestVisit}
                    className="flex items-center justify-center gap-2 rounded-3xl bg-[#1C3A27] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143523]"
                  >
                    <Calendar className="w-4 h-4" />
                    Request Site Visit
                  </button>
                  <button
                    type="button"
                    onClick={onSendInquiry}
                    className="flex items-center justify-center gap-2 rounded-3xl border border-[#1C3A27] bg-white px-5 py-3 text-sm font-semibold text-[#1C3A27] transition hover:bg-[#F5F7F6]"
                  >
                    <Mail className="w-4 h-4" />
                    Send Inquiry
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-[#F5F7F6] p-6 shadow-sm">
                <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold mb-4">
                  Property Location
                </div>
                <div className="flex items-center gap-3 text-sm text-[#1C3A27]">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-semibold">{property.location}</div>
                    <div className="text-neutral-500">Latitude {property.lat.toFixed(4)}, Longitude {property.lng.toFixed(4)}</div>
                  </div>
                </div>

                <button
                  onClick={() => setIsMapModalOpen(true)}
                  className="w-full mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 text-sm font-bold transition-all active:translate-y-0.5 shadow-md"
                >
                  <Eye className="w-4 h-4" />
                  View on Map
                </button>

                <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold mb-3">
                    <span>Additional Details</span>
                    {property.updatedAt && (
                      <span className="text-neutral-400 normal-case text-[11px] tracking-normal">
                        Updated {new Date(property.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-3 text-sm text-[#334032]">
                    <div className="flex justify-between">
                      <span className="font-medium">Price</span>
                      <span className="font-semibold text-emerald-800">{formatPrice(property.price)}</span>
                    </div>
                    {pricePerSqm > 0 && (
                      <div className="flex justify-between">
                        <span className="font-medium">Price per sqm</span>
                        <span>₱{Math.round(pricePerSqm).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-medium">Status</span>
                      <span>{property.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Property Type</span>
                      <span>{property.type}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};