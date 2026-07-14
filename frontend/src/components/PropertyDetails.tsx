import React, { useState } from 'react';
import { ArrowLeft, Calendar, Mail, MapPin, Eye } from 'lucide-react';
import type { Property } from './types';
import { RealtimeLocationModal } from './RealtimeLocationModal';

interface PropertyDetailsProps {
  property: Property | null;
  onBack: () => void;
  onRequestVisit?: () => void;
  onSendInquiry?: () => void;
}

const formatPrice = (price: number) =>
  `₱${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const PropertyDetails: React.FC<PropertyDetailsProps> = ({
  property,
  onBack,
  onRequestVisit,
  onSendInquiry,
}) => {
  const [isRealtimeModalOpen, setIsRealtimeModalOpen] = useState(false);

  if (!property) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F4F9F6] text-[#1E2E24] font-sans px-6 py-8">
      <RealtimeLocationModal
        isOpen={isRealtimeModalOpen}
        property={property}
        onClose={() => setIsRealtimeModalOpen(false)}
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
            <img
              src={property.images?.[0] ?? 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80'}
              alt={property.name}
              className="w-full h-full object-cover"
            />
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
                  {property.title ?? property.name}
                </h1>
                <p className="text-sm text-neutral-500 max-w-2xl">
                  {property.description ?? `A premium listing located in ${property.location}, featuring an expansive lot size and strong investment potential.`}
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
                    <span className="text-neutral-500">{(property.size ?? property.lotSize ?? 0).toLocaleString()} sqm</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Price / sqm</span>
                    <span className="text-neutral-500">₱{(property.pricePerSqm ?? 0).toLocaleString()}</span>
                  </div>
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
                    <p>
                      This listing is ideal for buyers looking for a strategic estate in Batangas. The property combines accessible location data with modern acreage ready for residential or agricultural development.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[#F4F9F6] p-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">Location</div>
                        <div className="mt-2 font-semibold text-[#1C3A27]">{property.location}</div>
                      </div>
                      <div className="rounded-2xl bg-[#F4F9F6] p-4">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-neutral-500">Lot Size</div>
                        <div className="mt-2 font-semibold text-[#1C3A27]">{(property.size ?? property.lotSize ?? 0).toLocaleString()} sqm</div>
                      </div>
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
                  onClick={() => setIsRealtimeModalOpen(true)}
                  className="w-full mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 text-sm font-bold transition-all active:translate-y-0.5 shadow-md"
                >
                  <Eye className="w-4 h-4" />
                  View Realtime Location
                </button>

                <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold mb-3">
                    <span>Additional Stats</span>
                    <span className="text-neutral-400">Updated now</span>
                  </div>
                  <div className="space-y-3 text-sm text-[#334032]">
                    <div className="flex justify-between">
                      <span className="font-medium">Estimated value</span>
                      <span>{formatPrice(property.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Area type</span>
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

