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
  type AuditFreshnessStatus,
} from '../../services/AuditService';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

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

const AUDIT_DOCUMENTS = [
  ['deed', 'Deed of Sale'],
  ['tax', 'Tax Declaration'],
  ['survey', 'Survey Plan'],
] as const;

const FRESHNESS_COPY: Record<AuditFreshnessStatus, { label: string; description: string; className: string }> = {
  CURRENT: {
    label: 'Current',
    description: "Current assessment: The tracked property information has not changed since this audit was generated.",
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  STALE: {
    label: 'Outdated',
    description: "Historical assessment — property information has changed since this audit was generated. The narrative below reflects the property's information at the time of that audit and should not be treated as its current readiness assessment.",
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  UNKNOWN: {
    label: 'Cannot Verify',
    description: "Historical assessment — the system cannot confirm whether the property's tracked information has changed since this audit was generated. Do not treat this narrative as a confirmed assessment of current property readiness.",
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

const getFreshnessStatus = (audit: Audit): AuditFreshnessStatus =>
  audit.freshnessStatus === 'CURRENT' || audit.freshnessStatus === 'STALE'
    ? audit.freshnessStatus
    : 'UNKNOWN';

const formatFreshnessValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Not available';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'None';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'Not available';
};

const FINDING_CODE_LABELS: Record<string, string> = {
  REQUIRED_DOCUMENT_PENDING: 'Required document pending',
  REQUIRED_DOCUMENT_MISSING: 'Required document missing',
  REQUIRED_DOCUMENT_STATUS_UNKNOWN: 'Document status unavailable',
  MISSING_PROPERTY_DESCRIPTION: 'Missing property description',
  MISSING_PROPERTY_PRICE: 'Missing property price',
  ZERO_PROPERTY_PRICE: 'Property price is zero',
  NEGATIVE_PROPERTY_PRICE: 'Property price is negative',
  MISSING_PROPERTY_NAME: 'Missing property name',
  MISSING_PROPERTY_TYPE: 'Missing property type',
  INVALID_PROPERTY_TYPE: 'Invalid property type',
  MISSING_PROPERTY_LOCATION: 'Missing property location',
  INVALID_LISTING_STATUS: 'Invalid listing status',
  MISSING_PROPERTY_SIZE: 'Missing property size',
  MISSING_PROPERTY_LOT_SIZE: 'Missing property lot size',
  MISSING_SUITABLE_FOR: 'Missing suitable-use information',
  MISSING_PROPERTY_OWNER: 'Missing property owner information',
  MISSING_PROPERTY_IMAGES: 'Missing property images',
  INVALID_PROPERTY_PRICE: 'Invalid property price',
};

const humanizeFindingCode = (code: string) =>
  FINDING_CODE_LABELS[code] ??
  code
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');

const formatFallbackNarrative = (text: string) =>
  text.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, humanizeFindingCode);

const getNarrativeHeadings = (audit: Audit) => {
  if (audit.narrativeOrigin === 'AI_GENERATED') {
    return {
      findings: 'AI Audit Findings',
      recommendation: 'AI-Generated Administrative Recommendation',
    };
  }
  if (audit.narrativeOrigin === 'SYSTEM_FALLBACK') {
    return {
      findings: 'System-Generated Assessment',
      recommendation: 'System-Generated Administrative Recommendation',
    };
  }
  return {
    findings: 'Historical Audit Findings',
    recommendation: 'Historical Administrative Recommendation',
  };
};

const FreshnessIndicator: React.FC<{ audit: Audit; compact?: boolean }> = ({ audit, compact = false }) => {
  const status = getFreshnessStatus(audit);
  const copy = FRESHNESS_COPY[status];
  const staleReasons = (audit.staleReasons ?? []).filter((reason) => reason && typeof reason.label === 'string' && reason.label.trim());

  return (
    <div className={`rounded-xl border ${copy.className} ${compact ? 'px-2.5 py-1.5' : 'p-3'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold">Audit freshness: {copy.label}</span>
        {!compact && <span className="text-[11px] leading-relaxed">{copy.description}</span>}
      </div>
      {!compact && status === 'STALE' && (
        <div className="mt-2 space-y-2 text-[11px]">
          {staleReasons.length > 0 ? (
            staleReasons.map((reason, index) => (
              <div key={`${reason.label}-${index}`} className="rounded-lg bg-white/60 p-2">
                <p className="font-semibold">{reason.label}</p>
                <p className="break-words">Previous: {formatFreshnessValue(reason.previousValue)}</p>
                <p className="break-words">Current: {formatFreshnessValue(reason.currentValue)}</p>
              </div>
            ))
          ) : (
            <p>Tracked property information changed, but no individual change details were returned.</p>
          )}
        </div>
      )}
    </div>
  );
};

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
  const modalRef = useModalAccessibility({ isOpen, onClose });
  const [history, setHistory] = useState<Audit[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [historyRetryToken, setHistoryRetryToken] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!isOpen || !property) return;

    let isCancelled = false;
    setErrorMsg('');
    setHistoryError('');

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const audits = await getAuditHistory(property.id);
        if (!isCancelled) setHistory(audits);
      } catch (error) {
        if (!isCancelled) {
          setHistory([]);
          setHistoryError(error instanceof Error ? error.message : 'Could not load audit history.');
        }
      } finally {
        if (!isCancelled) setIsLoadingHistory(false);
      }
    };

    fetchHistory();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, property, historyRetryToken]);

  if (!isOpen || !property) return null;

  const latestAudit = history.length > 0 ? history[0] : null;
  const narrativeHeadings = latestAudit ? getNarrativeHeadings(latestAudit) : null;
  const previous = history.slice(1);

  // Derived fallbacks for older legacy database records
  const complianceScore = latestAudit?.documentCompleteness ?? latestAudit?.complianceScore ?? 0;
  const estimatedSuccessRate = latestAudit?.methodologyVersion
    ? complianceScore
    : latestAudit?.estimatedSuccessRate ?? complianceScore;
  const statusSnapshot = latestAudit?.documentStatuses;
  const hasCompleteStatusSnapshot = AUDIT_DOCUMENTS.every(
    ([key]) => ['verified', 'pending', 'missing'].includes(statusSnapshot?.[key] ?? '')
  );
  const verifiedDocumentCount = hasCompleteStatusSnapshot
    ? AUDIT_DOCUMENTS.filter(([key]) => statusSnapshot?.[key] === 'verified').length
    : latestAudit?.verifiedDocuments ?? 0;
  const pendingDocumentNames = hasCompleteStatusSnapshot
    ? AUDIT_DOCUMENTS.filter(([key]) => statusSnapshot?.[key] === 'pending').map(([, label]) => label)
    : latestAudit?.pendingItems ?? [];
  const missingDocumentNames = hasCompleteStatusSnapshot
    ? AUDIT_DOCUMENTS.filter(([key]) => statusSnapshot?.[key] === 'missing').map(([, label]) => label)
    : latestAudit?.missingItems ?? [];
  const unknownStatusDocuments = hasCompleteStatusSnapshot
    ? []
    : latestAudit?.unknownStatuses?.map(({ document }) => document) ?? ['document status snapshot'];
  const allDocumentsVerified = hasCompleteStatusSnapshot &&
    AUDIT_DOCUMENTS.every(([key]) => statusSnapshot?.[key] === 'verified');
  const riskLevel =
    latestAudit?.riskLevel ??
    (complianceScore >= 70 ? 'Low' : complianceScore >= 40 ? 'Medium' : 'High');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    try {
      await generateAudit(property.id);
      try {
        const refreshedHistory = await getAuditHistory(property.id);
        setHistory(refreshedHistory);
      } catch (refreshError) {
        setErrorMsg(
          refreshError instanceof Error
            ? `Audit generated, but the history could not be refreshed: ${refreshError.message}`
            : 'Audit generated, but the history could not be refreshed.'
        );
      }
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
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="audit-modal-title" tabIndex={-1} className="w-full max-w-2xl bg-[#f7f4ed] border border-[#d6c7b2] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#d6c7b2] bg-white/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl border border-emerald-200">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 id="audit-modal-title" className="text-base font-bold text-[#2f2417] flex items-center gap-2">
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
          ) : historyError ? (
            <div className="py-12 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-sm text-rose-700">Could not load audit history: {historyError}</p>
              <button
                type="button"
                onClick={() => setHistoryRetryToken((value) => value + 1)}
                className="px-4 py-2 text-xs font-bold text-rose-800 border border-rose-300 rounded-xl hover:bg-rose-50"
              >
                Retry
              </button>
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
                      {latestAudit.methodologyVersion ? 'Document Completeness' : 'Legacy Compliance Score'}
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
                      {latestAudit.methodologyVersion ? 'Estimated Listing Success Rate' : 'Legacy Success Rate'}
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

                {latestAudit.methodologyVersion === 'weighted-readiness-v1' && (
                  <div className="mt-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-[#2f2417]">
                    <p className="font-semibold mb-2">Weighted document-readiness basis</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ['deed', 'Deed of Sale', '40%'],
                        ['tax', 'Tax Declaration', '30%'],
                        ['survey', 'Survey Plan', '30%'],
                      ].map(([key, label, weight]) => (
                        <div key={key} className="rounded-lg bg-white/70 p-2">
                          <p className="font-semibold">{label}</p>
                          <p className="text-[#7c6a57]">{weight} · {latestAudit.documentStatuses?.[key as 'deed' | 'tax' | 'survey'] ?? 'unknown'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Document Verification Ratio Bar */}
                <div className="mt-3 p-3 rounded-xl bg-white/70 border border-[#d6c7b2] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[#5d503f]">
                      <span className="font-semibold text-[#2f2417]">
                      Verified Documents:
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold">
                      {verifiedDocumentCount} / {latestAudit.totalDocuments}
                    </span>
                  </div>
                  {pendingDocumentNames.length > 0 && (
                    <div className="text-amber-700 text-right truncate max-w-[280px]">
                      <span className="text-[#7c6a57]">Pending: </span>
                      {pendingDocumentNames.join(', ')}
                    </div>
                  )}
                  {missingDocumentNames.length > 0 && (
                    <div className="text-rose-600 text-right truncate max-w-[280px] flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[#7c6a57]">Missing: </span>
                      {missingDocumentNames.join(', ')}
                    </div>
                  )}
                  {unknownStatusDocuments.length > 0 && (
                    <div className="text-rose-700 text-right truncate max-w-[280px]">
                      Unknown status: {unknownStatusDocuments.join(', ')}
                    </div>
                  )}
                  {allDocumentsVerified && (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>All documents verified</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: READINESS METRIC EXPLANATION */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-indigo-50 border border-emerald-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Readiness-Based Estimate
                </h4>
                <div className="flex items-center justify-around text-center">
                  <div className="flex-1">
                    <span className="text-[10px] text-[#7c6a57] block uppercase font-medium">
                      Document Completeness
                    </span>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm font-bold text-[#7c6a57]">
                        {complianceScore}%
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-base font-black text-emerald-600">
                        {complianceScore}%
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
                      Estimated Listing Success Rate
                    </span>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm font-bold text-[#7c6a57]">
                        {estimatedSuccessRate}%
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
                      <span className="text-base font-black text-sky-600">
                        {estimatedSuccessRate}%
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
                <p className="mt-4 text-[11px] leading-relaxed text-[#5d503f] text-center">
                  Both values use the same weighted document-verification calculation. This is a readiness-based estimate, not a statistically validated probability of sale or a guarantee of transaction success.
                </p>
              </div>

              {/* SECTION 3: AI ANALYSIS */}
              <div className="space-y-4">
                <FreshnessIndicator audit={latestAudit} />
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-semibold text-[#5d503f]">Narrative origin:</span>
                  <span className="px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold">
                    {latestAudit.narrativeOrigin === 'AI_GENERATED'
                      ? 'AI-generated narrative'
                      : latestAudit.narrativeOrigin === 'SYSTEM_FALLBACK'
                      ? 'System-generated fallback'
                      : 'Historical narrative — origin not recorded'}
                  </span>
                  {latestAudit.narrativeOrigin === 'SYSTEM_FALLBACK' && (
                    <span className="text-[#7c6a57]">
                      AI analysis was unavailable or rejected; the deterministic assessment was retained.
                    </span>
                  )}
                </div>
                {/* AI Audit Findings */}
                <div className="p-4 rounded-xl bg-white/70 border border-[#d6c7b2] space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#5d503f] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    {narrativeHeadings?.findings}
                  </h4>
                  <div className="text-sm text-[#2f2417] leading-relaxed">
                    {renderHighlightedText(
                      latestAudit.narrativeOrigin === 'SYSTEM_FALLBACK'
                        ? formatFallbackNarrative(latestAudit.summary)
                        : latestAudit.summary
                    )}
                  </div>
                </div>

                {/* Administrative Recommendation */}
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    {narrativeHeadings?.recommendation}
                  </h4>
                  <div className="text-sm text-[#2f2417] leading-relaxed font-medium">
                    {renderHighlightedText(
                      latestAudit.narrativeOrigin === 'SYSTEM_FALLBACK'
                        ? formatFallbackNarrative(latestAudit.recommendation)
                        : latestAudit.recommendation
                    )}
                  </div>
                </div>
              </div>
              {!latestAudit.methodologyVersion && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  This is a legacy audit generated with the previous calculation method. Its historical values are preserved and are not reinterpreted as weighted results.
                </div>
              )}
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
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${FRESHNESS_COPY[getFreshnessStatus(audit)].className}`}>
                            {FRESHNESS_COPY[getFreshnessStatus(audit)].label}
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
