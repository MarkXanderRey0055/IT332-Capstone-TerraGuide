import React from 'react';
import { Plus, Folder, FolderOpen, AlertCircle, Home, Edit2, Trash2, FolderPlus, Archive } from 'lucide-react';
import type { Cabinet } from '../../services/CabinetService';
import { CABINET_COLOR_STYLES } from './cabinetColors';

interface FilingCabinetPanelProps {
  cabinets: Cabinet[];
  unassignedCount: number;
  totalCount: number;
  selectedFilter: string; // 'all' | 'unassigned' | cabinetId
  onFilterChange: (filter: string) => void;
  onCreateCabinet: () => void;
  onEditCabinet: (cabinet: Cabinet) => void;
  onDeleteCabinet: (cabinet: Cabinet) => void;
  onAddProperties: (cabinet: Cabinet) => void;
}

// Small row of folder glyphs standing in for "N properties filed" — capped
// visually so a cabinet with 40 properties doesn't render 40 icons.
const FolderRow: React.FC<{ count: number; color: string }> = ({ count, color }) => {
  const visible = Math.min(count, 6);
  const overflow = count - visible;

  if (count === 0) {
    return <p className="text-[10px] italic" style={{ color: 'rgba(0,0,0,0.35)' }}>No folders filed yet</p>;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: visible }).map((_, i) => (
        <Folder key={i} className="w-4 h-4" style={{ color, fill: color, fillOpacity: 0.18 }} />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] font-bold" style={{ color }}>
          +{overflow}
        </span>
      )}
    </div>
  );
};

export const FilingCabinetPanel: React.FC<FilingCabinetPanelProps> = ({
  cabinets,
  unassignedCount,
  totalCount,
  selectedFilter,
  onFilterChange,
  onCreateCabinet,
  onEditCabinet,
  onDeleteCabinet,
  onAddProperties,
}) => {
  const selectedCabinet =
    selectedFilter !== 'all' && selectedFilter !== 'unassigned'
      ? cabinets.find((c) => c.id === selectedFilter) ?? null
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* All Listings */}
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedFilter === 'all'
              ? 'admin-panel border-emerald-700/50 ring-2 ring-emerald-700/20'
              : 'admin-panel-muted border-transparent hover:border-[#d6c7b2]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57]">All Listings</span>
            <Home className="w-4 h-4 text-emerald-700/70" />
          </div>
          <div className="text-2xl font-bold text-[#2f2417]">{totalCount}</div>
          <div className="text-[10px] text-[#9d8c76] mt-1">Every registered property record</div>
        </button>

        {/* Unassigned */}
        <button
          type="button"
          onClick={() => onFilterChange('unassigned')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedFilter === 'unassigned'
              ? 'admin-panel border-amber-600/50 ring-2 ring-amber-600/20'
              : 'admin-panel-muted border-transparent hover:border-[#d6c7b2]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Unassigned</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-[#2f2417]">{unassignedCount}</div>
          <div className="text-[10px] text-[#9d8c76] mt-1">
            Propert{unassignedCount === 1 ? 'y needs' : 'ies need'} filing
          </div>
        </button>

        {/* Dynamic cabinets — the "drawer" cards */}
        {cabinets.map((cabinet) => {
          const style = CABINET_COLOR_STYLES[cabinet.color];
          const isSelected = selectedFilter === cabinet.id;
          const isFull = cabinet.remainingCapacity === 0;

          return (
            <div
              key={cabinet.id}
              onClick={() => onFilterChange(cabinet.id)}
              className="relative rounded-2xl border overflow-hidden cursor-pointer transition-all group"
              style={{
                borderColor: isSelected ? style.border : 'rgba(0,0,0,0.08)',
                boxShadow: isSelected ? `0 0 0 2px ${style.badgeBg}` : 'none',
                background: '#fffdfa',
              }}
            >
              {/* "Drawer handle" accent bar */}
              <div className="h-1.5 w-full" style={{ background: style.handle }} />

              <div className="p-4" style={{ background: isSelected ? style.header : 'transparent' }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isSelected ? (
                      <FolderOpen className="w-4 h-4 shrink-0" style={{ color: style.text }} />
                    ) : (
                      <Archive className="w-4 h-4 shrink-0" style={{ color: style.text }} />
                    )}
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider truncate"
                      style={{ color: style.text }}
                      title={cabinet.name}
                    >
                      {cabinet.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCabinet(cabinet);
                      }}
                      className="p-1 rounded hover:bg-black/5 cursor-pointer"
                      title="Edit Cabinet"
                    >
                      <Edit2 className="w-3 h-3" style={{ color: style.text }} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCabinet(cabinet);
                      }}
                      className="p-1 rounded hover:bg-black/5 cursor-pointer"
                      title="Delete Cabinet"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                </div>

                {cabinet.description && (
                  <p className="text-[10px] text-[#9d8c76] mb-2 line-clamp-1" title={cabinet.description}>
                    {cabinet.description}
                  </p>
                )}

                <FolderRow count={cabinet.filedCount} color={style.text} />

                <div className="text-lg font-bold text-[#2f2417] mt-2">
                  {cabinet.filedCount} <span className="text-xs font-semibold text-[#9d8c76]">/ {cabinet.capacity} folders</span>
                </div>

                <div className="w-full h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'rgba(0,0,0,0.08)' }}>
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min((cabinet.filedCount / cabinet.capacity) * 100, 100)}%`,
                      background: isFull ? '#c04c4c' : style.handle,
                    }}
                  />
                </div>
                <div className="text-[9px] mt-1 font-bold" style={{ color: isFull ? '#c04c4c' : style.text }}>
                  {isFull ? 'Full capacity' : `${cabinet.remainingCapacity} slots remaining`}
                </div>
              </div>
            </div>
          );
        })}

        {/* + Create Cabinet */}
        <button
          type="button"
          onClick={onCreateCabinet}
          className="p-4 rounded-2xl border border-dashed border-[#d6c7b2] hover:border-emerald-700/50 bg-transparent hover:bg-[#faf6ef] text-left transition-all flex flex-col items-center justify-center py-8 cursor-pointer"
        >
          <Plus className="w-5 h-5 text-[#9d8c76] mb-2" />
          <span className="text-xs font-bold text-[#7c6a57]">Create Cabinet</span>
          <span className="text-[9px] text-[#9d8c76] mt-1 text-center">Add a new filing cabinet</span>
        </button>
      </div>

      {/* Selected cabinet action banner */}
      {selectedCabinet && (
        <div className="admin-panel rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4" style={{ color: CABINET_COLOR_STYLES[selectedCabinet.color].text }} />
              <h3 className="text-[#2f2417] font-serif text-lg font-bold">{selectedCabinet.name}</h3>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: CABINET_COLOR_STYLES[selectedCabinet.color].badgeBg,
                  color: CABINET_COLOR_STYLES[selectedCabinet.color].badgeText,
                }}
              >
                {selectedCabinet.filedCount} / {selectedCabinet.capacity} folders
              </span>
            </div>
            {selectedCabinet.description && (
              <p className="text-xs text-[#7c6a57] mt-1.5">{selectedCabinet.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEditCabinet(selectedCabinet)}
              className="admin-button-secondary flex items-center gap-1.5 px-3.5 py-2 text-[#5d503f] rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={() => onDeleteCabinet(selectedCabinet)}
              className="admin-button-secondary flex items-center gap-1.5 px-3.5 py-2 text-[#7c6a57] hover:text-red-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Cabinet
            </button>
            <button
              type="button"
              disabled={selectedCabinet.remainingCapacity === 0}
              onClick={() => onAddProperties(selectedCabinet)}
              className="admin-button flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-none hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FolderPlus className="w-3.5 h-3.5" /> {selectedCabinet.remainingCapacity === 0 ? 'Cabinet Full' : 'Add Properties'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilingCabinetPanel;
