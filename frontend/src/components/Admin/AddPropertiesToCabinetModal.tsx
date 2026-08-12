import React, { useState } from 'react';
import { X, Search, FolderPlus } from 'lucide-react';
import type { Property } from '../../types/types';
import type { Cabinet } from '../../services/CabinetService';

interface AddPropertiesToCabinetModalProps {
  isOpen: boolean;
  cabinet: Cabinet | null;
  properties: Property[];
  allCabinets: Cabinet[];
  onClose: () => void;
  onSave: (propertyIds: string[]) => Promise<void>;
}

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

export const AddPropertiesToCabinetModal: React.FC<AddPropertiesToCabinetModalProps> = ({
  isOpen,
  cabinet,
  properties,
  allCabinets,
  onClose,
  onSave,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !cabinet) return null;

  // Properties already in this exact cabinet are hidden — nothing to
  // "add" there. Properties filed elsewhere are shown but flagged, since
  // selecting them here is how a move to this cabinet happens.
  const candidateProperties = properties
    .filter((p) => p.cabinetId !== cabinet.id)
    .filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q);
    });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const exceedsCapacity = selectedIds.length > cabinet.remainingCapacity;

  const handleClose = () => {
    setSearch('');
    setSelectedIds([]);
    setErrorMsg('');
    onClose();
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0 || exceedsCapacity) return;
    setErrorMsg('');
    setIsSaving(true);
    try {
      await onSave(selectedIds);
      handleClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not file these properties. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="admin-panel w-full max-w-lg rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2]">
          <div>
            <h3 className="text-[#2f2417] font-serif text-lg font-bold flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-emerald-700" />
              Add Properties to {cabinet.name}
            </h3>
            <p className="text-[10px] text-[#7c6a57] mt-1">
              {cabinet.remainingCapacity} slot{cabinet.remainingCapacity === 1 ? '' : 's'} remaining
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="text-[#8f7d69] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-[#d6c7b2]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search properties by name or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-input w-full pl-9 pr-3 py-2 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {candidateProperties.length === 0 ? (
            <p className="text-xs text-[#7c6a57] text-center py-8">
              No properties available to file{search ? ' matching your search' : ''}.
            </p>
          ) : (
            candidateProperties.map((p) => {
              const isChecked = selectedIds.includes(p.id);
              const currentCabinet = p.cabinetId
                ? allCabinets.find((c) => c.id === p.cabinetId)
                : null;

              return (
                <label
                  key={p.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                    isChecked ? 'bg-emerald-500/10 border-emerald-600/40' : 'admin-panel-muted border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(p.id)}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-[#2f2417] flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{p.name}</span>
                        {currentCabinet && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 uppercase tracking-wide shrink-0">
                            Move from {currentCabinet.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#7c6a57] mt-0.5 truncate">
                        {p.location} · {p.type}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-[#2f2417] shrink-0">{formatPrice(p.price)}</span>
                </label>
              );
            })
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#d6c7b2] space-y-3">
          {exceedsCapacity && (
            <p className="text-[10px] font-bold text-red-600 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-center">
              This cabinet only has {cabinet.remainingCapacity} slot{cabinet.remainingCapacity === 1 ? '' : 's'}{' '}
              remaining, but {selectedIds.length} properties are selected.
            </p>
          )}
          {errorMsg && <p className="text-red-500 text-xs text-center">{errorMsg}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0 || exceedsCapacity || isSaving}
              onClick={handleSubmit}
              className="admin-button px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer border-none hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Filing...' : `Add Selected (${selectedIds.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPropertiesToCabinetModal;
