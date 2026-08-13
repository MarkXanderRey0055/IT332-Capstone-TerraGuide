import React, { useEffect, useMemo, useState } from 'react';
import { X, Handshake, Search } from 'lucide-react';
import type { Property } from '../../types/types';
import type { AdminBuyerProfile } from '../../services/AdminBuyerService';
import { getBuyers } from '../../services/AdminBuyerService';
import { createTransaction } from '../../services/TransactionService';

interface TransactionFormModalProps {
  isOpen: boolean;
  properties: Property[];
  onClose: () => void;
  onCreated: () => void;
}

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  properties,
  onClose,
  onCreated,
}) => {
  const [buyers, setBuyers] = useState<AdminBuyerProfile[]>([]);
  const [isLoadingBuyers, setIsLoadingBuyers] = useState(false);

  const [buyerSearch, setBuyerSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setBuyerSearch('');
    setPropertySearch('');
    setSelectedBuyerId('');
    setSelectedPropertyId('');
    setAmount('');
    setNotes('');
    setErrorMsg('');

    setIsLoadingBuyers(true);
    getBuyers()
      .then(setBuyers)
      .catch(() => setBuyers([]))
      .finally(() => setIsLoadingBuyers(false));
  }, [isOpen]);

  const filteredBuyers = useMemo(() => {
    const q = buyerSearch.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(
      (b) => b.fullName.toLowerCase().includes(q) || b.email.toLowerCase().includes(q)
    );
  }, [buyers, buyerSearch]);

  // Properties already Sold can't take a new transaction (server enforces
  // this too) — hidden here just to keep the picker from being cluttered
  // with obviously-invalid choices.
  const filteredProperties = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    return properties
      .filter((p) => p.status !== 'Sold')
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q));
  }, [properties, propertySearch]);

  if (!isOpen) return null;

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedBuyerId) {
      setErrorMsg('Select a buyer for this transaction.');
      return;
    }
    if (!selectedPropertyId) {
      setErrorMsg('Select a property for this transaction.');
      return;
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setErrorMsg('Enter a valid transaction amount.');
      return;
    }

    setIsSaving(true);
    try {
      await createTransaction({
        buyerId: selectedBuyerId,
        propertyId: selectedPropertyId,
        amount: amountNum,
        notes: notes.trim(),
      });
      onCreated();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create this transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="admin-panel w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2]">
          <h3 className="text-[#2f2417] font-serif text-lg font-bold flex items-center gap-2">
            <Handshake className="w-4 h-4 text-emerald-700" />
            New Transaction
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
          {/* Buyer picker */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
              Buyer <span className="text-red-500">*</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search registered buyers..."
                value={buyerSearch}
                onChange={(e) => setBuyerSearch(e.target.value)}
                className="admin-input w-full pl-9 pr-3 py-2 rounded-lg text-xs"
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 admin-panel-muted rounded-lg p-1.5">
              {isLoadingBuyers ? (
                <p className="text-[10px] text-[#9d8c76] p-2">Loading buyers...</p>
              ) : filteredBuyers.length === 0 ? (
                <p className="text-[10px] text-[#9d8c76] p-2">No registered buyers match your search.</p>
              ) : (
                filteredBuyers.map((b) => (
                  <label
                    key={b.userId}
                    className={`flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer transition-colors ${
                      selectedBuyerId === b.userId ? 'bg-emerald-500/15' : 'hover:bg-black/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="buyer"
                      checked={selectedBuyerId === b.userId}
                      onChange={() => setSelectedBuyerId(b.userId)}
                      className="accent-emerald-600 cursor-pointer"
                    />
                    <span className="font-bold text-[#2f2417]">{b.fullName}</span>
                    <span className="text-[#9d8c76]">{b.email}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Property picker */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
              Property <span className="text-red-500">*</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search properties by name or location..."
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                className="admin-input w-full pl-9 pr-3 py-2 rounded-lg text-xs"
              />
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 admin-panel-muted rounded-lg p-1.5">
              {filteredProperties.length === 0 ? (
                <p className="text-[10px] text-[#9d8c76] p-2">No available properties match your search.</p>
              ) : (
                filteredProperties.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-md text-xs cursor-pointer transition-colors ${
                      selectedPropertyId === p.id ? 'bg-emerald-500/15' : 'hover:bg-black/5'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="radio"
                        name="property"
                        checked={selectedPropertyId === p.id}
                        onChange={() => setSelectedPropertyId(p.id)}
                        className="accent-emerald-600 cursor-pointer shrink-0"
                      />
                      <span className="font-bold text-[#2f2417] truncate">{p.name}</span>
                      <span className="text-[#9d8c76] truncate">{p.location}</span>
                    </span>
                    <span className="font-mono font-bold text-[#2f2417] shrink-0">{formatPrice(p.price)}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
              Transaction Amount (₱) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min={0}
              placeholder={selectedProperty ? String(selectedProperty.price) : 'e.g. 500000'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="admin-input w-full px-3 py-2 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
              Notes <span className="text-[#9d8c76] normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="admin-input w-full px-3 py-2 rounded-lg text-xs resize-none"
            />
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
              {isSaving ? 'Creating...' : 'Create Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionFormModal;
