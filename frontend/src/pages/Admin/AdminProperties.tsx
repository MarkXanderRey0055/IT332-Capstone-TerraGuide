import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Sparkles,
  Eye,
  FolderMinus,
  Archive,
  MoreHorizontal,
} from 'lucide-react';
import type { Property } from '../../types/types';
import { PropertyFormModal } from '../../components/Admin/PropertyFormModal';
import { AuditModal } from '../../components/Admin/AuditModal';
import { CabinetFormModal } from '../../components/Admin/CabinetFormModal';
import { AddPropertiesToCabinetModal } from '../../components/Admin/AddPropertiesToCabinetModal';
import { ViewPropertyModal } from '../../components/Admin/ViewPropertyModal';
import { FilingCabinetPanel } from '../../components/Admin/FilingCabinetPanel';
import { getLotSize } from '../../services/buyerPrefs';
import { filterAndSortProperties, getPropertyFilterOptions } from '../../utils/propertyFilters';
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
  onDataChanged?: () => void;
  pendingEditPropertyId?: string | null;
  onPendingEditHandled?: () => void;
}

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

const getStatusBadge = (status: Property['status']) => {
  const badgeClass =
    'inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-md border';
  switch (status) {
    case 'Available':
      return (
        <span className={`${badgeClass} status-success`}>
          Available
        </span>
      );
    case 'Reserved':
      return (
        <span className={`${badgeClass} status-neutral`}>
          Reserved
        </span>
      );
    case 'Sold':
      return <span className={`${badgeClass} status-neutral`}>Sold</span>;
    default:
      return (
        <span className={`${badgeClass} status-success`}>
          Available
        </span>
      );
  }
};

const getTypeBadgeClass = (type: Property['type']) => {
  void type;
  return 'status-neutral';
};

export const AdminProperties: React.FC<AdminPropertiesProps> = ({
  properties,
  setProperties,
  onToast,
  isLoading,
  onDataChanged,
  pendingEditPropertyId,
  onPendingEditHandled,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [documentStatusFilter, setDocumentStatusFilter] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState<Property['status'] | ''>('');
  const [propertySort, setPropertySort] = useState<'latest' | 'priceAsc' | 'priceDesc'>('latest');
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [auditProperty, setAuditProperty] = useState<Property | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isViewPropertyModalOpen, setIsViewPropertyModalOpen] = useState(false);
  const [moreMenuPropertyId, setMoreMenuPropertyId] = useState<string | null>(null);
  const [moreMenuPosition, setMoreMenuPosition] = useState({ top: 0, left: 0 });
  const moreMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!pendingEditPropertyId || isLoading) return;

    const property = properties.find((item) => item.id === pendingEditPropertyId);
    if (!property) {
      onToast?.('That property could not be found. It may have been removed or is no longer available.');
      onPendingEditHandled?.();
      return;
    }

    setSelectedProperty(property);
    setIsPropertyModalOpen(true);
    onPendingEditHandled?.();
  }, [pendingEditPropertyId, isLoading, properties, onPendingEditHandled, onToast]);

  const handleAuditPropertyClick = (property: Property) => {
    setAuditProperty(property);
    setIsAuditModalOpen(true);
  };

  const handleViewPropertyClick = (property: Property) => {
    setSelectedProperty(property);
    setIsViewPropertyModalOpen(true);
  };

  const openMoreMenu = (property: Property, anchor: HTMLButtonElement) => {
    moreMenuAnchorRef.current = anchor;
    const rect = anchor.getBoundingClientRect();
    setMoreMenuPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 224) });
    setMoreMenuPropertyId(property.id);
  };

  const handleMoreMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(moreMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  };

  useEffect(() => {
    if (!moreMenuPropertyId || !moreMenuAnchorRef.current || !moreMenuRef.current) return;

    const updatePosition = () => {
      const anchorRect = moreMenuAnchorRef.current?.getBoundingClientRect();
      const menu = moreMenuRef.current;
      if (!anchorRect || !menu) return;
      const margin = 8;
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const left = Math.max(margin, Math.min(anchorRect.right - width, window.innerWidth - width - margin));
      const below = window.innerHeight - anchorRect.bottom - margin;
      const top = below >= height || anchorRect.top < height
        ? Math.min(anchorRect.bottom + 4, window.innerHeight - height - margin)
        : anchorRect.top - height - 4;
      setMoreMenuPosition({ top: Math.max(margin, top), left });
    };

    updatePosition();
    const focusTimer = window.setTimeout(() => {
      moreMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    }, 0);
    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!moreMenuRef.current?.contains(target) && !moreMenuAnchorRef.current?.contains(target)) {
        setMoreMenuPropertyId(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMoreMenuPropertyId(null);
        moreMenuAnchorRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [moreMenuPropertyId]);

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
      onDataChanged?.();
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

  const handleSaveProperty = async (formData: Omit<Property, 'id'>): Promise<Property> => {
    let savedProperty: Property;
    if (selectedProperty) {
      savedProperty = await updateProperty(selectedProperty.id, formData);
      showToast(`Updated listing "${formData.name}"`);
    } else {
      savedProperty = await createProperty(formData);
      showToast(`Added new listing "${formData.name}"`);
    }
    await refreshProperties();
    onDataChanged?.();
    return savedProperty;
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

  const handleAssignPropertyToCabinet = async (propertyId: string, cabinetId: string) => {
    const cabinet = cabinets.find((item) => item.id === cabinetId);
    if (!cabinet) return;
    await assignPropertiesToCabinet(cabinetId, [propertyId]);
    showToast(`Filed property into "${cabinet.name}"`);
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

  const filterOptions = getPropertyFilterOptions(properties);
  const filteredProperties = filterAndSortProperties(cabinetFilteredProperties, {
    search: searchQuery,
    type: typeFilter,
    location: locationFilter,
    documentStatus: documentStatusFilter as 'Verified' | 'Pending' | 'Missing' | '',
    status: listingStatusFilter,
    sort: propertySort,
  });
  const clearPropertyFilters = () => {
    setSearchQuery('');
    setTypeFilter('');
    setLocationFilter('');
    setDocumentStatusFilter('');
    setListingStatusFilter('');
    setPropertySort('latest');
    setSelectedFilter('all');
  };

  const toggleUnassignedQuickFilter = () => {
    setSelectedFilter((currentFilter) => currentFilter === 'unassigned' ? 'all' : 'unassigned');
  };

  const toggleDocumentQuickFilter = () => {
    setDocumentStatusFilter((currentStatus) => currentStatus === 'Missing' ? '' : 'Missing');
  };

  const toggleReservedQuickFilter = () => {
    setListingStatusFilter((currentStatus) => currentStatus === 'Reserved' ? '' : 'Reserved');
  };

  const selectedCabinetName =
    selectedFilter !== 'all' && selectedFilter !== 'unassigned'
      ? cabinets.find((c) => c.id === selectedFilter)?.name
      : null;

  return (
    <>
      {/* Digital Filing Cabinet */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
          <Archive className="w-4 h-4 text-neutral" />
          <h3 className="text-[#2f2417] font-serif text-lg font-bold">Filing Cabinet</h3>
          <span className="text-[10px] text-[#7c6a57]">Organize where each property record is filed</span>
          </div>
          <button
            type="button"
            onClick={handleCreateCabinetClick}
            className="admin-button flex items-center gap-1.5 px-3.5 py-2 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-none hover:brightness-105 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Cabinet
          </button>
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
            onEditCabinet={handleEditCabinetClick}
            onDeleteCabinet={handleDeleteCabinet}
            onAddProperties={handleOpenAddProperties}
          />
        )}
      </div>

      <div className="admin-properties-filter-section">
        <h3 className="text-[#2f2417] font-serif text-lg font-bold mb-2.5">Filter &amp; Sort Listings</h3>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="relative flex-[2_1_20rem] min-w-[14rem]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search listings"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-input admin-properties-search-input block w-full min-w-0 pl-10 pr-4 py-2.5 rounded-full text-xs focus:outline-none transition-all"
            />
          </div>
          <label className="admin-properties-filter-label flex-[1_1_8rem] min-w-[8rem] text-[10px] font-bold text-[#5d503f]">Property Type
            <select aria-label="Filter by property type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="admin-input admin-properties-filter-control block w-full mt-1 px-3 py-2 rounded-full text-xs">
              <option value="">All types</option>{filterOptions.types.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="admin-properties-filter-label flex-[1_1_8rem] min-w-[8rem] text-[10px] font-bold text-[#5d503f]">Location
            <select aria-label="Filter by location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="admin-input admin-properties-filter-control block w-full mt-1 px-3 py-2 rounded-full text-xs">
              <option value="">All locations</option>{filterOptions.locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
          <label className="admin-properties-filter-label flex-[1_1_11rem] min-w-[11rem] text-[10px] font-bold text-[#5d503f]">Document Status
            <select aria-label="Filter by document status" value={documentStatusFilter} onChange={(e) => setDocumentStatusFilter(e.target.value)} className="admin-input admin-properties-filter-control block w-full mt-1 px-3 py-2 rounded-full text-xs">
              <option value="">All document statuses</option><option>Verified</option><option>Pending</option><option>Missing</option>
            </select>
          </label>
          <label className="admin-properties-filter-label flex-[1_1_8rem] min-w-[8rem] text-[10px] font-bold text-[#5d503f]">Listing Status
            <select aria-label="Filter by listing status" value={listingStatusFilter} onChange={(e) => setListingStatusFilter(e.target.value as Property['status'] | '')} className="admin-input admin-properties-filter-control block w-full mt-1 px-3 py-2 rounded-full text-xs">
              <option value="">All listing statuses</option><option>Available</option><option>Reserved</option><option>Sold</option>
            </select>
          </label>
          <label className="admin-properties-filter-label flex-[1_1_8rem] min-w-[8rem] text-[10px] font-bold text-[#5d503f]">Sort By
            <select aria-label="Sort properties" value={propertySort} onChange={(e) => setPropertySort(e.target.value as 'latest' | 'priceAsc' | 'priceDesc')} className="admin-input admin-properties-filter-control block w-full mt-1 px-3 py-2 rounded-full text-xs">
              <option value="latest">Latest</option><option value="priceAsc">Price: Low to High</option><option value="priceDesc">Price: High to Low</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#d6c7b2]/70">
          <span className="admin-properties-quick-label text-[10px] font-bold uppercase tracking-wide text-[#7c6a57]">Quick</span>
          <button type="button" onClick={toggleUnassignedQuickFilter} aria-pressed={selectedFilter === 'unassigned'} className={`admin-properties-quick-chip ${selectedFilter === 'unassigned' ? 'admin-properties-quick-chip-active' : ''}`}>
            Unfiled{unassignedCount > 0 && <span className="admin-properties-chip-count">{unassignedCount}</span>}
          </button>
          <button type="button" onClick={toggleDocumentQuickFilter} aria-pressed={documentStatusFilter === 'Missing'} className={`admin-properties-quick-chip ${documentStatusFilter === 'Missing' ? 'admin-properties-quick-chip-active' : ''}`}>
            Missing documents
          </button>
          <button type="button" onClick={toggleReservedQuickFilter} aria-pressed={listingStatusFilter === 'Reserved'} className={`admin-properties-quick-chip ${listingStatusFilter === 'Reserved' ? 'admin-properties-quick-chip-active' : ''}`}>
            Reserved
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <span className="text-[10px] text-[#7c6a57]">Showing {filteredProperties.length} of {cabinetFilteredProperties.length} listings</span>
          <button type="button" onClick={clearPropertyFilters} className="text-xs font-bold text-brand underline underline-offset-2 rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--color-brand)] focus-visible:outline-offset-2">Clear all</button>
        </div>
      </div>

      <div className="admin-properties-listing-action flex justify-end">
        <button
          type="button"
          onClick={handleAddPropertyClick}
          className="admin-button flex items-center gap-1.5 px-4 py-2 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-none hover:brightness-105"
        >
          <Plus className="w-4 h-4" />
          Add Listing
        </button>
      </div>

      <div className="admin-panel admin-properties-listings rounded-2xl overflow-hidden">
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
            <table className="admin-table admin-properties-table w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#d6c7b2] text-[10px] font-bold uppercase tracking-wider text-[#4d5e4d]">
                  <th className="p-4 min-w-[13rem]">Property</th>
                  <th className="p-4 min-w-[6.5rem]">Type</th>
                  <th className="p-4 min-w-[7rem] text-right">Price</th>
                  <th className="p-4 min-w-[5.5rem]">Status</th>
                  <th className="p-4 min-w-[14rem] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ded2c0]">
                {filteredProperties.map((p) => {
                  return (
                    <tr key={p.id} className="transition-colors">
                      <td className="px-4">
                        <div className="font-bold text-[#223127] text-sm leading-snug whitespace-normal break-words">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-[#4d5e4d] mt-1 leading-snug break-words">
                          {p.location || 'Location not provided'} · {getLotSize(p).toLocaleString()} sqm
                        </div>
                      </td>
                      <td className="px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${getTypeBadgeClass(p.type)}`}
                        >
                          {p.type}
                        </span>
                      </td>
                      <td className="px-4 text-right font-bold text-neutral-dark font-mono text-sm whitespace-nowrap">
                        {formatPrice(p.price)}
                      </td>
                      <td className="px-4">{getStatusBadge(p.status)}</td>
                      <td className="px-4">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleViewPropertyClick(p)}
                            className="admin-icon-btn rounded-lg cursor-pointer"
                            title="View Property"
                            aria-label={`View ${p.name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditPropertyClick(p)}
                            className="admin-icon-btn rounded-lg cursor-pointer"
                            title="Edit Property"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (moreMenuPropertyId === p.id) setMoreMenuPropertyId(null);
                              else openMoreMenu(p, event.currentTarget);
                            }}
                            className="admin-icon-btn rounded-lg cursor-pointer"
                            title="More actions"
                            aria-label={`More actions for ${p.name}`}
                            aria-haspopup="menu"
                            aria-expanded={moreMenuPropertyId === p.id}
                            aria-controls={moreMenuPropertyId === p.id ? 'property-row-actions-menu' : undefined}
                          >
                            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
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

      {moreMenuPropertyId && createPortal((() => {
        const menuProperty = properties.find((property) => property.id === moreMenuPropertyId);
        if (!menuProperty) return null;
        const menuItemClass = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-[#3d4a3d] transition-colors hover:bg-[#f1f5f9] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--color-brand)]';
        return (
          <div
            ref={moreMenuRef}
            id="property-row-actions-menu"
            role="menu"
            aria-label={`Actions for ${menuProperty.name}`}
            onKeyDown={handleMoreMenuKeyDown}
            className="fixed z-[10001] w-56 rounded-xl border border-[#d6c7b2] bg-white p-1.5 shadow-xl"
            style={{ top: moreMenuPosition.top, left: moreMenuPosition.left }}
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={(event) => {
                event.stopPropagation();
                setMoreMenuPropertyId(null);
                handleAuditPropertyClick(menuProperty);
              }}
            >
              <Sparkles className="h-4 w-4 text-neutral" aria-hidden="true" /> AI Compliance Audit
            </button>
            {menuProperty.cabinetId && (
              <button
                type="button"
                role="menuitem"
                className={menuItemClass}
                onClick={(event) => {
                  event.stopPropagation();
                  setMoreMenuPropertyId(null);
                  void handleRemoveFromCabinet(menuProperty);
                }}
              >
                <FolderMinus className="h-4 w-4 text-neutral" aria-hidden="true" /> Remove from Filing Cabinet
              </button>
            )}
            <div className="my-1 border-t border-[#e8dfd3]" role="separator" />
            <button
              type="button"
              role="menuitem"
              disabled={deletingId === menuProperty.id}
              className={`${menuItemClass} text-danger hover:bg-[var(--color-danger-bg)] disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={(event) => {
                event.stopPropagation();
                setMoreMenuPropertyId(null);
                void handleDeleteProperty(menuProperty.id, menuProperty.name);
              }}
            >
              <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" /> Delete Property
            </button>
          </div>
        );
      })(), document.body)}

      <PropertyFormModal
        isOpen={isPropertyModalOpen}
        property={selectedProperty}
        onClose={() => setIsPropertyModalOpen(false)}
        onSave={handleSaveProperty}
      />

      <ViewPropertyModal
        isOpen={isViewPropertyModalOpen}
        property={selectedProperty}
        cabinets={cabinets}
        onClose={() => setIsViewPropertyModalOpen(false)}
        onAssignCabinet={handleAssignPropertyToCabinet}
        onEdit={(property) => {
          setIsViewPropertyModalOpen(false);
          handleEditPropertyClick(property);
        }}
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
