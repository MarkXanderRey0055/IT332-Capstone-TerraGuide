import React, { useEffect, useState } from 'react';
import { X, Archive } from 'lucide-react';
import type { Cabinet, CabinetColor, CabinetPayload } from '../../services/CabinetService';
import { CABINET_COLORS } from '../../services/CabinetService';
import { CABINET_COLOR_STYLES } from './cabinetColors';

interface CabinetFormModalProps {
  isOpen: boolean;
  cabinet: Cabinet | null; // null = create mode
  onClose: () => void;
  onSave: (payload: CabinetPayload) => Promise<void>;
}

export const CabinetFormModal: React.FC<CabinetFormModalProps> = ({
  isOpen,
  cabinet,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [color, setColor] = useState<CabinetColor>('green');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (cabinet) {
      setName(cabinet.name);
      setDescription(cabinet.description);
      setCapacity(cabinet.capacity.toString());
      setColor(cabinet.color);
    } else {
      setName('');
      setDescription('');
      setCapacity('');
      setColor('green');
    }
    setErrorMsg('');
  }, [cabinet, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const capacityNum = Number(capacity);
    if (!name.trim()) {
      setErrorMsg('Cabinet name is required.');
      return;
    }
    if (!Number.isFinite(capacityNum) || capacityNum < 1) {
      setErrorMsg('Capacity must be a number of at least 1.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), capacity: capacityNum, color });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save this cabinet. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="admin-panel w-full max-w-md rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2]">
          <h3 className="text-[#2f2417] font-serif text-lg font-bold flex items-center gap-2">
            <Archive className="w-4 h-4 text-emerald-700" />
            {cabinet ? 'Edit Filing Cabinet' : 'Create Filing Cabinet'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#8f7d69] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
              Cabinet Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Balayan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input w-full px-3 py-2 rounded-lg text-xs"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
              Description <span className="text-[#9d8c76] normal-case font-normal">(optional)</span>
            </label>
            <textarea
              placeholder="e.g. Property listings located in Balayan."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="admin-input w-full px-3 py-2 rounded-lg text-xs resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
              Capacity (number of slots) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              placeholder="e.g. 10"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="admin-input w-full px-3 py-2 rounded-lg text-xs"
            />
            {cabinet && cabinet.filedCount > 0 && (
              <p className="text-[10px] text-[#9d8c76] mt-1">
                This cabinet currently holds {cabinet.filedCount} propert{cabinet.filedCount === 1 ? 'y' : 'ies'} —
                capacity can't be set below that.
              </p>
            )}
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-2">
              Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {CABINET_COLORS.map((c) => {
                const style = CABINET_COLOR_STYLES[c];
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    title={style.label}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border-2"
                    style={{
                      background: style.handle,
                      borderColor: isSelected ? style.text : 'transparent',
                      boxShadow: isSelected ? `0 0 0 2px ${style.badgeBg}` : 'none',
                      outline: isSelected ? `1px solid ${style.text}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="admin-button px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer border-none hover:brightness-105 disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : cabinet ? 'Save Changes' : 'Create Cabinet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CabinetFormModal;
