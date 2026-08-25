import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Archive, Loader2, DatabaseBackup } from 'lucide-react';
import { exportDataset, exportAllDataZip, type ExportDataset, type ExportFormat } from '../../services/ExportService';

interface AdminSettingsProps {
  onToast?: (message: string) => void;
}

const DATASET_OPTIONS: { id: ExportDataset | 'all'; label: string; description: string }[] = [
  { id: 'properties', label: 'Properties', description: 'All property listings, pricing, status, and cabinet assignments.' },
  { id: 'buyers', label: 'Buyers', description: 'Registered buyer accounts and their saved preferences.' },
  { id: 'transactions', label: 'Transactions', description: 'Reservations, sales, and their current status.' },
  { id: 'all', label: 'All Data', description: 'Every dataset above, bundled as a ZIP of separate CSV files.' },
];

export const AdminSettings: React.FC<AdminSettingsProps> = ({ onToast }) => {
  const [selectedDataset, setSelectedDataset] = useState<ExportDataset | 'all'>('properties');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  const showToast = (message: string) => onToast?.(message);

  const handleDatasetChange = (id: ExportDataset | 'all') => {
    setSelectedDataset(id);
    // "All Data" is CSV/ZIP-only — force the format back to csv if PDF was selected.
    if (id === 'all') {
      setSelectedFormat('csv');
    }
  };

  const handleExport = async () => {
    setError('');
    setIsExporting(true);
    try {
      if (selectedDataset === 'all') {
        await exportAllDataZip();
        showToast('Backup ZIP downloaded.');
      } else {
        await exportDataset(selectedDataset, selectedFormat);
        showToast(`${selectedDataset[0].toUpperCase()}${selectedDataset.slice(1)} export downloaded.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="admin-panel rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="admin-button w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
            <DatabaseBackup className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-[#2f2417] font-serif text-xl font-bold">Export Data</h2>
            <p className="text-[#7c6a57] text-sm mt-1 max-w-xl">
              Download your TerraGuide records as a backup. CSV files open directly in Excel; PDF
              gives you a readable printed copy.
            </p>
          </div>
        </div>

        {/* Dataset picker */}
        <div className="mt-6">
          <span className="text-[#4d5e4d] text-xs font-bold uppercase tracking-wide">Dataset</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {DATASET_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleDatasetChange(option.id)}
                className={`text-left rounded-xl p-4 border cursor-pointer transition-colors ${
                  selectedDataset === option.id
                    ? 'admin-button text-white border-transparent'
                    : 'admin-input border-[rgba(78,96,73,0.22)] text-[#2f2417] hover:bg-[rgba(199,211,192,0.3)]'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {option.id === 'all' ? <Archive className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                  {option.label}
                </div>
                <p
                  className={`text-xs mt-1 ${
                    selectedDataset === option.id ? 'text-white/85' : 'text-[#7c6a57]'
                  }`}
                >
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Format picker */}
        <div className="mt-6">
          <span className="text-[#4d5e4d] text-xs font-bold uppercase tracking-wide">Format</span>
          <div className="flex flex-wrap gap-3 mt-2">
            {selectedDataset === 'all' ? (
              <div className="admin-button text-white rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-semibold">
                <Archive className="w-4 h-4" />
                ZIP / CSV Backup
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedFormat('csv')}
                  className={`rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-semibold border cursor-pointer transition-colors ${
                    selectedFormat === 'csv'
                      ? 'admin-button text-white border-transparent'
                      : 'admin-input border-[rgba(78,96,73,0.22)] text-[#2f2417]'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFormat('pdf')}
                  className={`rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-semibold border cursor-pointer transition-colors ${
                    selectedFormat === 'pdf'
                      ? 'admin-button text-white border-transparent'
                      : 'admin-input border-[rgba(78,96,73,0.22)] text-[#2f2417]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Action */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="admin-button text-white rounded-xl px-5 py-3 flex items-center gap-2 text-sm font-semibold border-none cursor-pointer transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Preparing export…' : 'Download Export'}
          </button>
        </div>
      </div>
    </div>
  );
};
