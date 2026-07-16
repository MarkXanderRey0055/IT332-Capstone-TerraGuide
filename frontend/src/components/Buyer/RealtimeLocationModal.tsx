import { X, MapPin } from 'lucide-react';
import { mockProperties } from '../../utils/data';
import { PropertyMap } from './PropertyMap';
import type { Property } from '../../types/types';
import { loadProperties } from '../../services/propertyStorage';

interface RealtimeLocationModalProps {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
}

export const RealtimeLocationModal: React.FC<RealtimeLocationModalProps> = ({
  isOpen,
  property,
  onClose,
}) => {
  if (!isOpen || !property) {
    return null;
  }

  const properties = loadProperties(mockProperties);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col shadow-2xl relative border border-neutral-100">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-neutral-200 bg-white">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#1C3A27] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Realtime Proximity Map
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Displaying geographic coordinates and surrounding real estate comparisons for{' '}
              <span className="font-semibold text-[#1C3A27]">{property.title ?? property.name}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
            aria-label="Close realtime proximity map"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="flex-1 relative min-h-0 w-full h-full">
          <PropertyMap
            properties={properties}
            focusProperty={property}
            initialMapStyle="satellite"
            mapTitle="Google Satellite Feeds"
            mapSubtitle="Live coordinates & rooftop precision"
            recenterLabel={`Re-center on ${property.title ?? property.name}`}
            focusZoom={18}
            scrollWheelZoom
          />
        </div>
      </div>
    </div>
  );
};

export default RealtimeLocationModal;
