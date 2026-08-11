import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  FolderMinus,
  Archive,
} from 'lucide-react';
import type { Property } from '../../types/types';
import { PropertyFormModal } from '../../components/Admin/PropertyFormModal';
import { AuditModal } from '../../components/Admin/AuditModal';
import { CabinetFormModal } from '../../components/Admin/CabinetFormModal';
import { AddPropertiesToCabinetModal } from '../../components/Admin/AddPropertiesToCabinetModal';
import { FilingCabinetPanel } from '../../components/Admin/FilingCabinetPanel';
import { CABINET_COLOR_STYLES } from '../../components/Admin/cabinetColors';
import { getLotSize } from '../../services/buyerPrefs';
import {
  createProperty,
  updateProperty,
  deleteProperty,
  getProperties,
} from '../../services/PropertyService';
import type { Cabinet, CabinetPayload } from '../../services/CabinetService';
import {
  getCabinets,
  createCabinet,
  updateCabinet,
  deleteCabinet,
  assignPropertiesToCabinet,
  removePropertyFromCabinet,
} from '../../services/CabinetService';

interface AdminPropertiesProps {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  onToast?: (message: string) => void;
  isLoading?: boolean;
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
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [auditProperty, setAuditProperty] = useState<Property | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // ---- Filing Cabinet state ----
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [isLoadingCabinets, setIsLoadingCabinets] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all'); // 'all' | 'unassigned' | cabinetId

  const [isCabinetFormOpen, setIsCabinetFormOpen] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);
  const [isAddPropertiesModalOpen, setIsAddPropertiesModalOpen] = useState(false);
  const [assignTargetCabinet, setAssignTargetCabinet] = useState<Cabinet | null>(null);

  const showToast = (message: string) => {
    onToast?.(message);
  };

  const refreshCabinets = async () => {
    try {
      const result = await getCabinets();
      setCabinets(result.cabinets);
      setUnassignedCount(result.unassignedCount);
    } catch (error) {
      showToast(
        error instanceof Error
          ? `Could not load filing cabinets: ${error.message}`
          : 'Could not load filing cabinets.'
      );
    }
  };

  useEffect(() => {
    setIsLoadingCabinets(true);
    refreshCabinets().finally(() => setIsLoadingCabinets(false));
  }, []);

  const handleAddPropertyClick = () => {
    setSelectedProperty(null);
    setIsPropertyModalOpen(true);
  };

  const handleEditPropertyClick = (property: Property) => {
    setSelectedProperty(property);
    setIsPropertyModalOpen(true);
  };

  const handleAuditPropertyClick = (property: Property) => {
    setAuditProperty(property);
    setIsAuditModalOpen(true);
  };

  const refreshProperties = async () => {
    try {
      const fresh = await getProperties();
      setProperties(fresh);
    } catch (error) {
      // The mutation itself already succeeded by the time we get here —
      // this is just the follow-up refetch failing, so don't let it look
      // like the save/delete itself failed.
      showToast(
        error instanceof Error
          ? `Saved, but couldn't refresh the list: ${error.message}`
          : 'Saved, but the property list could not be refreshed.'
      );
    }
  };

  const handleDeleteProperty = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete listing "${name}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteProperty(id);
      showToast(`Deleted property listing "${name}"`);
      await refreshProperties();
      await refreshCabinets();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : `Could not delete "${name}". Please try again.`
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveProperty = async (formData: Omit<Property, 'id'>) => {
    if (selectedProperty) {
      await updateProperty(selectedProperty.id, formData);
      showToast(`Updated listing "${formData.name}"`);
    } else {
      await createProperty(formData);
      showToast(`Added new listing "${formData.name}"`);
    }
    setIsPropertyModalOpen(false);
    await refreshProperties();
  };

  // ---- Filing Cabinet handlers ----

  const handleCreateCabinetClick = () => {
    setEditingCabinet(null);
    setIsCabinetFormOpen(true);
  };

  const handleEditCabinetClick = (cabinet: Cabinet) => {
    setEditingCabinet(cabinet);
    setIsCabinetFormOpen(true);
  };

  const handleSaveCabinet = async (payload: CabinetPayload) => {
    if (editingCabinet) {
      await updateCabinet(editingCabinet.id, payload);
      showToast(`Updated cabinet "${payload.name}"`);
    } else {
      await createCabinet(payload);
      showToast(`Created cabinet "${payload.name}"`);
    }
    setIsCabinetFormOpen(false);
    setEditingCabinet(null);
    await refreshCabinets();
  };

  const handleDeleteCabinet = async (cabinet: Cabinet) => {
    if (
      !confirm(
        `Delete filing cabinet "${cabinet.name}"?\n\nThis will NOT delete the properties inside it — they will become Unassigned.`
      )
    ) {
      return;
    }

    try {
      await deleteCabinet(cabinet.id);
      showToast(`Deleted cabinet "${cabinet.name}". Its properties are now Unassigned.`);
      if (selectedFilter === cabinet.id) {
        setSelectedFilter('all');
      }
      await refreshCabinets();
      await refreshProperties();
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Could not delete "${cabinet.name}".`);
    }
  };

  const handleOpenAddProperties = (cabinet: Cabinet) => {
    setAssignTargetCabinet(cabinet);
    setIsAddPropertiesModalOpen(true);
  };

  const handleAssignProperties = async (propertyIds: string[]) => {
    if (!assignTargetCabinet) return;
    const result = await assignPropertiesToCabinet(assignTargetCabinet.id, propertyIds);
    showToast(`Filed ${result.filedCount} propert${result.filedCount === 1 ? 'y' : 'ies'} into "${assignTargetCabinet.name}"`);
    await refreshCabinets();
    await refreshProperties();
  };

  const handleRemoveFromCabinet = async (property: Property) => {
    const cabinetName = cabinets.find((c) => c.id === property.cabinetId)?.name || 'its cabinet';
    if (
      !confirm(
        `Remove "${property.name}" from "${cabinetName}"?\n\nThis will NOT delete the property — it will just become Unassigned.`
      )
    ) {
      return;
    }

    try {
      await removePropertyFromCabinet(property.id);
      showToast(`Removed "${property.name}" from ${cabinetName}. It's now Unassigned.`);
      await refreshCabinets();
      await refreshProperties();
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Could not remove "${property.name}" from its cabinet.`);
    }
  };

  // ---- Filtering ----

  const cabinetFilteredProperties = useMemo(() => {
    if (selectedFilter === 'all') return properties;
    if (selectedFilter === 'unassigned') return properties.filter((p) => !p.cabinetId);
    return properties.filter((p) => p.cabinetId === selectedFilter);
  }, [properties, selectedFilter]);

  const filteredProperties = cabinetFilteredProperties.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.owner ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedCabinetName =
    selectedFilter !== 'all' && selectedFilter !== 'unassigned'
      ? cabinets.find((c) => c.id === selectedFilter)?.name
      : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[#2f2417] font-serif text-xl sm:text-2xl font-bold">Manage Land Listings</h2>
          <p className="text-[#7c6a57] text-xs sm:text-sm mt-1">
            Create, modify, and audit real estate listings.
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
              className="admin-input pl-10 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-700/50 w-48 sm:w-64 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleAddPropertyClick}
            className="admin-button flex items-center gap-1.5 px-4 py-2 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-none hover:brightness-105"
          >
            <Plus className="w-4 h-4" />
            Add Listing
          </button>
        </div>
      </div>

      {/* Digital Filing Cabinet */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-emerald-700" />
          <h3 className="text-[#2f2417] font-serif text-lg font-bold">Filing Cabinet</h3>
          <span className="text-[10px] text-[#9d8c76]">Organize where each property record is filed</span>
        </div>

        {isLoadingCabinets ? (
          <div className="admin-panel rounded-2xl p-8 text-center">
            <p className="text-[#7c6a57] text-sm">Loading filing cabinets...</p>
          </div>
        ) : (
          <FilingCabinetPanel
            cabinets={cabinets}
            unassignedCount={unassignedCount}
            totalCount={properties.length}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
            onCreateCabinet={handleCreateCabinetClick}
            onEditCabinet={handleEditCabinetClick}
            onDeleteCabinet={handleDeleteCabinet}
            onAddProperties={handleOpenAddProperties}
          />
        )}
      </div>

      <div className="admin-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#d6c7b2] bg-[#faf6ef]/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57]">
            {selectedFilter === 'all' && 'All registered land listings'}
            {selectedFilter === 'unassigned' && 'Unassigned records — needs filing'}
            {selectedCabinetName && `Listings filed in "${selectedCabinetName}"`}
          </p>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <p className="text-[#7c6a57] text-sm">Loading property listings...</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[#7c6a57] text-sm">
              {searchQuery
                ? 'No listings match your search.'
                : selectedFilter === 'unassigned'
                ? 'Every property is currently filed in a cabinet.'
                : selectedCabinetName
                ? 'No listings filed in this cabinet yet.'
                : 'No property listings yet. Add your first listing.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#d6c7b2] text-[10px] font-bold uppercase tracking-wider text-[#7c6a57]">
                  <th className="p-4">Property</th>
                  <th className="p-4">Owner</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Deed / Tax / Survey</th>
                  {selectedFilter === 'all' && <th className="p-4">Filing Cabinet</th>}
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ded2c0]">
                {filteredProperties.map((p) => {
                  const propCabinet = p.cabinetId ? cabinets.find((c) => c.id === p.cabinetId) : null;
                  return (
                    <tr key={p.id} className="transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-[#2f2417] text-sm">{p.name}</div>
                        <div className="text-[10px] text-[#7c6a57] font-mono mt-0.5">
                          Size: {getLotSize(p).toLocaleString()} sqm · GPS: {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                        </div>
                      </td>
                      <td className="p-4 text-[#5d503f] font-medium">{p.owner || '—'}</td>
                      <td className="p-4 text-[#6f604d] font-semibold">{p.location}</td>
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
                      {selectedFilter === 'all' && (
                        <td className="p-4">
                          {propCabinet ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                background: CABINET_COLOR_STYLES[propCabinet.color].badgeBg,
                                color: CABINET_COLOR_STYLES[propCabinet.color].badgeText,
                              }}
                            >
                              <Archive className="w-3 h-3" /> {propCabinet.name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-700">
                              Unassigned
                            </span>
                          )}
                        </td>
                      )}
                      <td className="p-4 text-right font-bold text-emerald-400 font-mono text-sm">
                        {formatPrice(p.price)}
                      </td>
                      <td className="p-4">{getStatusBadge(p.status)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditPropertyClick(p)}
                            className="admin-button-secondary p-1.5 text-[#5d503f] rounded-lg hover:text-[#2f2417] transition-colors cursor-pointer"
                            title="Edit Listing"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAuditPropertyClick(p)}
                            className="admin-button-secondary p-1.5 text-[#5d503f] rounded-lg hover:text-emerald-700 transition-colors cursor-pointer"
                            title="AI Compliance Audit"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          {p.cabinetId && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCabinet(p)}
                              className="admin-button-secondary p-1.5 text-amber-700 rounded-lg hover:text-amber-900 transition-colors cursor-pointer"
                              title="Remove from Filing Cabinet (does not delete the property)"
                            >
                              <FolderMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteProperty(p.id, p.name)}
                            disabled={deletingId === p.id}
                            className="admin-button-secondary p-1.5 text-[#7c6a57] rounded-lg hover:text-red-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Delete Listing"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      <AuditModal
        isOpen={isAuditModalOpen}
        property={auditProperty}
        onClose={() => setIsAuditModalOpen(false)}
      />

      <CabinetFormModal
        isOpen={isCabinetFormOpen}
        cabinet={editingCabinet}
        onClose={() => {
          setIsCabinetFormOpen(false);
          setEditingCabinet(null);
        }}
        onSave={handleSaveCabinet}
      />

      <AddPropertiesToCabinetModal
        isOpen={isAddPropertiesModalOpen}
        cabinet={assignTargetCabinet}
        properties={properties}
        allCabinets={cabinets}
        onClose={() => {
          setIsAddPropertiesModalOpen(false);
          setAssignTargetCabinet(null);
        }}
        onSave={handleAssignProperties}
      />
    </>
  );
};

export default AdminProperties;