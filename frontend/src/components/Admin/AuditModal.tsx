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
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
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
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
          : val >= 50
          ? 'bg-amber-100 text-amber-700 border-amber-200'
          : 'bg-rose-100 text-rose-700 border-rose-200';

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
          className="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200"
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
          className="inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200"
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
  const [showHistory, setShowHistory] = useState(false);

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

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'bg-amber-50 border-amber-200';
    return 'bg-rose-50 border-rose-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#f7f4ed] border border-[#d6c7b2] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#d6c7b2] bg-white/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl border border-emerald-200">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2f2417] flex items-center gap-2">
                AI Compliance Auditor
                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200 tracking-wider">
                  BI Engine
                </span>
              </h3>
              <p className="text-xs text-[#7c6a57]">{property.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 text-[#7c6a57] hover:text-[#2f2417] hover:bg-[#e8e0d5] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#f7f4ed]">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700">{errorMsg}</p>
            </div>
          )}

          {isLoadingHistory ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[#7c6a57]">Loading audit facts & history...</p>
            </div>
          ) : !latestAudit ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-[#2f2417] font-semibold text-lg">
                  No Compliance Audit Yet
                </p>
                <p className="text-[#7c6a57] text-sm max-w-md mx-auto mt-1">
                  Generate an AI-powered audit to calculate risk benchmarks, 
                  success estimates, and actionable recommendations.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION 1: HARD FACTS DASHBOARD */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#7c6a57] flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                    Fact Matrix
                  </h4>
                  <span className="text-[10px] text-[#7c6a57] flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {formatDate(latestAudit.generatedAt)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Compliance Score */}
                  <div className={`p-4 rounded-xl border ${getScoreBg(complianceScore)}`}>
                    <span className="text-xs text-[#7c6a57] font-medium">
                      Compliance Score
                    </span>
                    <div className="mt-1.5">
                      <span className={`text-3xl font-black ${getScoreColor(complianceScore)}`}>
                        {complianceScore}%
                      </span>
                    </div>
                  </div>

                  {/* Estimated Success Rate */}
                  <div className="p-4 rounded-xl bg-sky-50 border border-sky-200">
                    <span className="text-xs text-[#7c6a57] font-medium flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
                      Success Rate
                    </span>
                    <div className="mt-1.5">
                      <span className="text-3xl font-black text-sky-600">
                        {estimatedSuccessRate}%
                      </span>
                    </div>
                  </div>

                  {/* Risk Level Badge */}
                  <div className={`p-4 rounded-xl border ${getRiskColor(riskLevel)}`}>
                    <span className="text-xs text-[#7c6a57] font-medium">
                      Risk Assessment
                    </span>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${getRiskColor(riskLevel)}`}>
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
                <div className="mt-3 p-3 rounded-xl bg-white/70 border border-[#d6c7b2] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[#5d503f]">
                    <span className="font-semibold text-[#2f2417]">
                      Verified Documents:
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold">
                      {latestAudit.verifiedDocuments} / {latestAudit.totalDocuments}
                    </span>
                  </div>
                  {latestAudit.missingItems && latestAudit.missingItems.length > 0 && (
                    <div className="text-rose-600 text-right truncate max-w-[280px] flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[#7c6a57]">Missing: </span>
                      {latestAudit.missingItems.join(', ')}
                    </div>
                  )}
                  {latestAudit.missingItems?.length === 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>All documents verified</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: ESTIMATED IMPROVEMENT IMPACT PREVIEW */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-indigo-50 border border-emerald-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Estimated Improvement Potential
                </h4>
                <div className="flex items-center justify-around text-center">
                  <div className="flex-1">
                    <span className="text-[10px] text-[#7c6a57] block uppercase font-medium">
                      Compliance Score
                    </span>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm font-bold text-[#7c6a57]">
                        {complianceScore}%
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-base font-black text-emerald-600">
                        100%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#e0d5c3] rounded-full mt-1.5 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${complianceScore}%` }}
                      />
                    </div>
                  </div>
                  <div className="h-10 w-px bg-[#d6c7b2]" />
                  <div className="flex-1">
                    <span className="text-[10px] text-[#7c6a57] block uppercase font-medium">
                      Success Rate
                    </span>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm font-bold text-[#7c6a57]">
                        {estimatedSuccessRate}%
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
                      <span className="text-base font-black text-sky-600">
                        {potentialSuccessRate}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#e0d5c3] rounded-full mt-1.5 overflow-hidden">
                      <div 
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${estimatedSuccessRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: AI ANALYSIS */}
              <div className="space-y-4">
                {/* AI Audit Findings */}
                <div className="p-4 rounded-xl bg-white/70 border border-[#d6c7b2] space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#5d503f] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    AI Audit Findings
                  </h4>
                  <div className="text-sm text-[#2f2417] leading-relaxed">
                    {renderHighlightedText(latestAudit.summary)}
                  </div>
                </div>

                {/* Predictive Recommendation */}
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    Predictive Recommendation
                  </h4>
                  <div className="text-sm text-[#2f2417] leading-relaxed font-medium">
                    {renderHighlightedText(latestAudit.recommendation)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audit History Dropdown */}
          {previous.length > 0 && (
            <div className="rounded-xl bg-white/70 border border-[#d6c7b2] overflow-hidden">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between p-3 text-xs font-semibold text-[#5d503f] hover:bg-[#e8e0d5] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#7c6a57]" />
                  Audit History ({previous.length})
                </span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHistory && (
                <ul className="p-3 pt-0 space-y-2 border-t border-[#d6c7b2]">
                  {previous.map((audit) => {
                    const auditRisk = audit.riskLevel || 
                      (audit.complianceScore >= 70 ? 'Low' : 
                       audit.complianceScore >= 40 ? 'Medium' : 'High');
                    return (
                      <li key={audit.id} className="flex items-center justify-between p-2 rounded-lg bg-white/50">
                        <span className="text-xs text-[#5d503f]">
                          {formatDate(audit.generatedAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${getScoreColor(audit.complianceScore)}`}>
                            {audit.complianceScore}%
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getRiskColor(auditRisk)}`}>
                            {auditRisk}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#d6c7b2] bg-white/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-xs font-bold text-[#5d503f] bg-white/50 border border-[#d6c7b2] rounded-xl hover:bg-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl disabled:opacity-60 transition-all cursor-pointer border-none shadow-md"
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
