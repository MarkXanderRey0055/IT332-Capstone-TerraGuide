import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { Transaction } from '../../services/TransactionService';
import { correctTransaction } from '../../services/TransactionService';
import { CurrencyInput } from './CurrencyInput';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

interface Props { isOpen: boolean; transaction: Transaction | null; onClose: () => void; onCorrected: () => void; }
const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;

export const TransactionCorrectionModal: React.FC<Props> = ({ isOpen, transaction, onClose, onCorrected }) => {
  const modalRef = useModalAccessibility({ isOpen, onClose });
  const [amount, setAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && transaction) {
      setAmount(transaction.amount);
      setNotes(transaction.notes || '');
      setReason('');
      setError('');
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;
  const unchanged = amount === transaction.amount && notes === (transaction.notes || '');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (amount === '' || amount <= 0) return setError('Enter an amount greater than zero.');
    if (!reason.trim()) return setError('Provide a reason for this correction.');
    if (unchanged) return setError('Change the amount or notes before saving.');
    if (!window.confirm(`Save this correction?\n\nOriginal amount: ${peso(transaction.amount)}\nRevised amount: ${peso(Number(amount))}\n\nReason: ${reason.trim()}`)) return;
    setSaving(true); setError('');
    try { await correctTransaction(transaction.id, { amount: Number(amount), notes, reason }); onCorrected(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save the correction.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[600] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="correction-title" tabIndex={-1} className="admin-panel w-full max-w-lg rounded-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2]"><h3 id="correction-title" className="font-serif font-bold text-[#2f2417] flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-700" /> Correct Completed Transaction</h3><button type="button" onClick={onClose} aria-label="Close" className="bg-transparent border-none cursor-pointer"><X className="w-4 h-4" /></button></div>
      <form onSubmit={submit} className="px-6 py-5 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">This creates an immutable correction history entry. The original and revised values, your identity, timestamp, and reason will be retained.</div>
        <div className="grid grid-cols-2 gap-3 text-xs"><div><span className="text-[#7c6a57] block">Original amount</span><strong>{peso(transaction.amount)}</strong></div><div><span className="text-[#7c6a57] block">Revised amount</span><CurrencyInput value={amount} onChange={setAmount} className="admin-input w-full px-3 py-2 rounded-lg text-xs" required /></div></div>
        <div><label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">Revised notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="admin-input w-full px-3 py-2 rounded-lg text-xs resize-none" /></div>
        <div><label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">Correction reason <span className="text-red-500">*</span></label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explain why the completed record must be corrected..." className="admin-input w-full px-3 py-2 rounded-lg text-xs resize-none" required /></div>
        {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold">Cancel</button><button type="submit" disabled={saving} className="admin-button px-4 py-2 rounded-xl text-xs font-bold text-white border-none disabled:opacity-60">{saving ? 'Saving...' : 'Save Correction'}</button></div>
      </form>
    </div>
  </div>;
};
