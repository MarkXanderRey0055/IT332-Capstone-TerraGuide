import React, { useState } from 'react';
import { MapPin, Square, Trees, Building2, Home, Landmark } from 'lucide-react';
import type { Property } from '../../types/types';

interface PropertyCardProps {
  property: Property;
  isSuggested?: boolean;
  matchScore?: number | null;
  onClick: (property: Property) => void;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  Agricultural: Trees,
  Commercial: Building2,
  Condominium: Building2,
  'House & Lot': Home,
  Residential: Home,
};
const getTypeIcon = (type: string) => TYPE_ICON[type] || Landmark;

const formatPrice = (num: number) => '₱' + num.toLocaleString();

const getLabel = (property: Property) => property.title?.trim() || property.name;

const getLotSize = (property: Property) => property.size ?? property.lotSize ?? 0;

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  isSuggested = false,
  matchScore = null,
  onClick,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = property.images?.[0];
  const TypeIcon = getTypeIcon(property.type);

  return (
    <div
      onClick={() => onClick(property)}
      className="relative flex flex-col overflow-hidden cursor-pointer rounded-2xl border border-neutral-200/50 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md group"
    >
      <div className="relative h-48 w-full overflow-hidden shrink-0 bg-neutral-100">
        {imageUrl && !imgFailed ? (
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100 text-neutral-400 gap-1.5">
            <TypeIcon className="w-10 h-10 text-emerald-800/40" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {property.type}
            </span>
          </div>
        )}
        {property.status && property.status !== 'Available' && (
          <div
            className={`absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md text-white ${
              property.status === 'Sold' ? 'bg-red-600' : 'bg-amber-600'
            }`}
          >
            {property.status}
          </div>
        )}
        {isSuggested && matchScore !== null && (
          <div className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-bold text-white bg-[#1C3A27] rounded-md shadow-md">
            {matchScore}% Match
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col grow">
        <span className="self-start inline-block text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 rounded px-2 py-0.5 mb-2">
          {property.type}
        </span>
        <h4 className="font-serif text-base text-[#1C3A27] font-bold mb-1 line-clamp-1">
          {getLabel(property)}
        </h4>
        <div className="text-sm font-black text-[#1C3A27] mb-2">{formatPrice(property.price)}</div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-auto pt-3 border-t border-neutral-100">
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <MapPin className="w-3 h-3 text-neutral-400" />
            {property.location}
          </span>
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <Square className="w-3 h-3 text-neutral-400" />
            {getLotSize(property).toLocaleString()} sqm
          </span>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;