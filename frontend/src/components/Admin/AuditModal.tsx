import React, { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  History,
  FileText,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import type { Property } from '../../types/types';
import {
  generateAudit,
  getAuditHistory,
  type Audit,
} from '../../services/AuditService';

interface AuditModalProps {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

/**
 * Intelligent Color Highlighter for variables in text
 */
const renderHighlightedText = (text: string) => {
  if (!text) return null;

  const parts = text.split(
    /(\b\d+%\b|\b\d+ of \d+\b|High|Medium|Low|Tax Declaration|Deed of Sale|Survey Plan)/g
  );

  return parts.map((part, index) => {
    // Highlight Percentages (e.g., 33%, 100%)
    if (/^\d+%$/.test(part)) {
      const val = parseInt(part, 10);
      const colorClass =
        val >= 80
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : val >= 50
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

      return (
        <span
          key={index}
          className={`inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-bold border ${colorClass}`}
        >
          {part}
        </span>
      );
    }

    // Highlight Missing Document Terms
    if (['Tax Declaration', 'Deed of Sale', 'Survey Plan'].includes(part)) {
      return (
        <span
          key={index}
          className="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20"
        >
          {part}
        </span>
      );
    }

    // Highlight Document Ratio (e.g., 1 of 3)
    if (/^\d+ of \d+$/.test(part)) {
      return (
        <span
          key={index}
          className="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
        >
          {part}
        </span>
      );
    }

    return part;
  });
};

export const AuditModal: React.FC<AuditModalProps> = ({
  isOpen,
  property,
  onClose,
}) => {
  const [history, setHistory] = useState<Audit[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen || !property) return;

    let isCancelled = false;
    setErrorMsg('');

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const audits = await getAuditHistory(property.id);
        if (!isCancelled) setHistory(audits);
      } catch (error) {
        if (!isCancelled) setHistory([]);
      } finally {
        if (!isCancelled) setIsLoadingHistory(false);
      }
    };

    fetchHistory();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, property]);

  if (!isOpen || !property) return null;

  const latestAudit = history.length > 0 ? history[0] : null;
  const previous = history.slice(1);

  // Derived fallbacks for older legacy database records
  const complianceScore = latestAudit?.complianceScore ?? 0;
  const estimatedSuccessRate =
    latestAudit?.estimatedSuccessRate ??
    Math.round(35 + complianceScore * 0.55);
  const potentialSuccessRate = latestAudit?.potentialSuccessRate ?? 90;
  const riskLevel =
    latestAudit?.riskLevel ??
    (complianceScore >= 70 ? 'Low' : complianceScore >= 40 ? 'Medium' : 'High');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    try {
      const newAudit = await generateAudit(property.id);
      setHistory((prev) => [newAudit, ...prev]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to generate audit.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                AI Compliance Auditor
                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 tracking-wider">
                  BI Engine
                </span>
              </h3>
              <p className="text-xs text-gray-400">{property.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-200">{errorMsg}</p>
            </div>
          )}

          {isLoadingHistory ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Loading audit facts & history...
            </div>
          ) : !latestAudit ? (
            <div className="py-12 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-emerald-400/60 mx-auto" />
              <p className="text-sm text-gray-300 font-medium">
                No compliance audit generated yet for this property.
              </p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Click below to calculate risk benchmarks, success estimates, and
                AI-driven recommendations.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION 1: HARD FACTS DASHBOARD */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center justify-between">
                  <span>Fact Matrix</span>
                  <span className="text-[10px] text-gray-500 font-normal">
                    Generated: {formatDate(latestAudit.generatedAt)}
                  </span>
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  {/* Compliance Score */}
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                    <span className="text-xs text-gray-400 font-medium">
                      Compliance Score
                    </span>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span
                        className={`text-3xl font-black ${
                          complianceScore >= 80
                            ? 'text-emerald-400'
                            : complianceScore >= 40
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {complianceScore}%
                      </span>
                    </div>
                  </div>

                  {/* Estimated Success Rate */}
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                    <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                      Success Rate
                    </span>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-sky-300">
                        {estimatedSuccessRate}%
                      </span>
                    </div>
                  </div>

                  {/* Risk Level Badge */}
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                    <span className="text-xs text-gray-400 font-medium">
                      Risk Assessment
                    </span>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                          riskLevel === 'Low'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : riskLevel === 'Medium'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {riskLevel === 'Low' ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        )}
                        {riskLevel} Risk
                      </span>
                    </div>
                  </div>
                </div>

                {/* Document Verification Ratio Bar */}
                <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="font-semibold text-white">
                      Verified Documents:
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                      {latestAudit.verifiedDocuments} / {latestAudit.totalDocuments}
                    </span>
                  </div>
                  {latestAudit.missingItems && latestAudit.missingItems.length > 0 && (
                    <div className="text-rose-300/90 text-right truncate max-w-[280px]">
                      <span className="text-gray-400">Missing: </span>
                      {latestAudit.missingItems.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: ESTIMATED IMPROVEMENT IMPACT PREVIEW */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 to-indigo-950/30 border border-emerald-500/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Estimated Improvement Potential
                </h4>
                <div className="flex items-center justify-around text-center py-1">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">
                      Compliance Score
                    </span>
                    <div className="flex items-center justify-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-gray-400">
                        {complianceScore}%
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-base font-black text-emerald-400">
                        100%
                      </span>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase">
                      Estimated Success Rate
                    </span>
                    <div className="flex items-center justify-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-gray-400">
                        {estimatedSuccessRate}%
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-base font-black text-sky-300">
                        {potentialSuccessRate}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: AI ANALYSIS */}
              <div className="space-y-4">
                {/* AI Audit Findings */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    AI Audit Findings
                  </h4>
                  <p className="text-sm text-gray-200 leading-relaxed">
                    {renderHighlightedText(latestAudit.summary)}
                  </p>
                </div>

                {/* Predictive Recommendation */}
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Predictive Recommendation
                  </h4>
                  <p className="text-sm text-emerald-100/90 leading-relaxed font-medium">
                    {renderHighlightedText(latestAudit.recommendation)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Audit History Dropdown */}
          {previous.length > 0 && (
            <details className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400">
              <summary className="font-semibold text-gray-300 cursor-pointer flex items-center gap-1.5">
                <History className="w-4 h-4 text-gray-400" />
                Audit History ({previous.length})
              </summary>
              <ul className="mt-3 space-y-2 pl-4">
                {previous.map((audit) => (
                  <li key={audit.id} className="list-disc text-gray-300">
                    {formatDate(audit.generatedAt)} —{' '}
                    <span className="font-bold text-emerald-400">
                      {audit.complianceScore}% Score
                    </span>{' '}
                    | Risk: {audit.riskLevel || (audit.complianceScore >= 70 ? 'Low' : audit.complianceScore >= 40 ? 'Medium' : 'High')}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10 bg-white/5">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-xs font-bold text-gray-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-60 transition-all cursor-pointer border-none shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isGenerating
              ? 'Computing Audit...'
              : latestAudit
              ? 'Regenerate Audit'
              : 'Generate AI Compliance Audit'}
          </button>
        </div>
      </div>
    </div>
  );
};