import React, { useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import type { Property } from '../../types/types';
import { PropertyFormModal } from '../../components/Admin/PropertyFormModal';
import { getLotSize } from '../../services/buyerPrefs';

interface AdminPropertiesProps {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  onToast?: (message: string) => void;
}

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

const getDocIcon = (status: 'pending' | 'verified' | 'missing') => {
  switch (status) {
    case 'verified':
      return (
        <span title="Verified" className="inline-flex">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        </span>
      );
    case 'pending':
      return (
        <span title="Pending Review" className="inline-flex">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
        </span>
      );
    case 'missing':
      return (
        <span title="Missing Document" className="inline-flex">
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
        </span>
      );
  }
};

const getStatusBadge = (status: Property['status']) => {
  switch (status) {
    case 'Available':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-400">
          Available
        </span>
      );
    case 'Reserved':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-400">
          Reserved
        </span>
      );
    case 'Sold':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-neutral-500/15 text-neutral-400">
          Sold
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-400">
          Available
        </span>
      );
  }
};

const getTypeBadgeClass = (type: Property['type']) => {
  switch (type) {
    case 'Residential':
    case 'House & Lot':
      return 'bg-sage-500/10 text-sage-300';
    case 'Agricultural':
      return 'bg-amber-500/10 text-amber-300';
    case 'Commercial':
      return 'bg-teal-500/10 text-teal-300';
    default:
      return 'bg-white/10 text-gray-300';
  }
};

export const AdminProperties: React.FC<AdminPropertiesProps> = ({
  properties,
  setProperties,
  onToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const showToast = (message: string) => {
    onToast?.(message);
  };

  const handleAddPropertyClick = () => {
    setSelectedProperty(null);
    setIsPropertyModalOpen(true);
  };

  const handleEditPropertyClick = (property: Property) => {
    setSelectedProperty(property);
    setIsPropertyModalOpen(true);
  };

  const handleDeleteProperty = (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete listing "${name}"?`)) {
      setProperties((prev) => prev.filter((p) => p.id !== id));
      showToast(`Deleted property listing "${name}"`);
    }
  };

  const handleSaveProperty = (formData: Omit<Property, 'id'>) => {
    if (selectedProperty) {
      setProperties((prev) =>
        prev.map((p) => (p.id === selectedProperty.id ? { ...p, ...formData } : p)),
      );
      showToast(`Updated listing "${formData.name}"`);
    } else {
      const newProperty: Property = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        ...formData,
      };
      setProperties((prev) => [newProperty, ...prev]);
      showToast(`Added new listing "${formData.name}"`);
    }
    setIsPropertyModalOpen(false);
  };

  const filteredProperties = properties.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.owner ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-serif text-xl sm:text-2xl font-bold">Manage Land Listings</h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Create, modify, and audit real estate listings in Balayan and Batangas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/50 w-48 sm:w-64 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleAddPropertyClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2d6a4f] hover:bg-[#3d8a6f] text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer border-none"
          >
            <Plus className="w-4 h-4" />
            Add Listing
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        {filteredProperties.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'No listings match your search.' : 'No property listings yet. Add your first listing.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Property</th>
                  <th className="p-4">Owner</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Deed / Tax / Survey</th>
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredProperties.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        Size: {getLotSize(p).toLocaleString()} sqm · GPS: {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                      </div>
                    </td>
                    <td className="p-4 text-gray-300 font-medium">{p.owner || '—'}</td>
                    <td className="p-4 text-gray-400 font-semibold">{p.location}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getTypeBadgeClass(p.type)}`}
                      >
                        {p.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-400" title="Title Deed">
                          {getDocIcon(p.documents?.deed || 'pending')}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-400" title="Tax Declaration">
                          {getDocIcon(p.documents?.tax || 'pending')}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-400" title="Survey Plan">
                          {getDocIcon(p.documents?.survey || 'pending')}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-400 font-mono text-sm">
                      {formatPrice(p.price)}
                    </td>
                    <td className="p-4">{getStatusBadge(p.status)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditPropertyClick(p)}
                          className="p-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 rounded-lg border border-white/[0.08] hover:text-white transition-colors cursor-pointer"
                          title="Edit Listing"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProperty(p.id, p.name)}
                          className="p-1.5 bg-white/[0.04] hover:bg-red-950/20 text-gray-400 rounded-lg border border-white/[0.08] hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete Listing"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PropertyFormModal
        isOpen={isPropertyModalOpen}
        property={selectedProperty}
        onClose={() => setIsPropertyModalOpen(false)}
        onSave={handleSaveProperty}
      />
    </>
  );
};
