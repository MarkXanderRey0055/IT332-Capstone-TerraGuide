import PDFDocument from 'pdfkit';
import archiver from 'archiver';

import { getAllProperties } from './propertyService.js';
import { listCabinets } from './cabinetService.js';
import { listBuyers } from './adminBuyerService.js';
import { listTransactions } from './transactionService.js';
import {
  getDashboardSummary,
  getChartData,
  getAttentionProperties,
  getPropertyRankings,
  getBuyerIntelligence,
  getSalesPerformance,
} from './analyticsService.js';
import AppError from '../utils/errors.js';

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Readable date for CSV/PDF (Manila time). Empty string for missing dates. */
function formatDateReadable(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** YYYY-MM-DD for filenames (Manila time). */
function formatDateForFilename(date = new Date()) {
  const manila = new Date(date).toLocaleString('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA locale formats as YYYY-MM-DD already
  return manila;
}

/** Peso display for the PDF only. CSV keeps raw numeric values. */
function formatPeso(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '';
  return `₱${Math.round(num).toLocaleString('en-US')}`;
}

//excel implementation 
function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds an Excel-compatible CSV string from column definitions and rows.
 * @param {{header: string, key: string}[]} columns
 * @param {Record<string, any>[]} rows
 */
function toCSV(columns, rows) {
  const headerLine = columns.map((c) => escapeCsvValue(c.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(row[c.key])).join(',')
  );
  // Leading BOM helps Excel auto-detect UTF-8 (so peso signs etc. render correctly).
  return '\uFEFF' + [headerLine, ...lines].join('\r\n') + '\r\n';
}

// ── PDF layout constants ──────────────────────────────────────────────
const PDF_MARGIN = 40;
const HEADER_HEIGHT = 24; // minimum row height for table header
const MIN_ROW_HEIGHT = 20; // minimum row height for data rows
const CELL_PAD_V = 6;     // top/bottom padding inside each cell
const CELL_PAD_H = 5;     // left/right padding inside each cell
const FONT_SIZE = 8.5;
const SECTION_BAND_H = 18; // height of section-divider bands in analytics

/**
 * Resolves column pixel widths from the widthPct array on column defs.
 * Falls back to equal distribution when widthPct is absent.
 * widthPct values must sum to 1.0; if they don't, they're normalised.
 */
function resolveColWidths(columns, pageWidth) {
  const hasPct = columns.every((c) => typeof c.widthPct === 'number');
  if (!hasPct) {
    const w = pageWidth / columns.length;
    return columns.map(() => w);
  }
  const total = columns.reduce((s, c) => s + c.widthPct, 0);
  return columns.map((c) => (c.widthPct / total) * pageWidth);
}

/**
 * Measures how tall a row needs to be so every cell's text fits without
 * overflowing into an adjacent row.
 */
function measureRowHeight(doc, columns, colWidths, row) {
  doc.font('Helvetica').fontSize(FONT_SIZE);
  let maxH = MIN_ROW_HEIGHT;
  columns.forEach((col, i) => {
    const raw = row[col.key];
    const text = col.money
      ? formatPeso(raw)
      : raw === null || raw === undefined
      ? ''
      : String(raw);
    if (!text) return;
    const cellW = colWidths[i] - CELL_PAD_H * 2;
    const h = doc.heightOfString(text, { width: cellW }) + CELL_PAD_V * 2;
    if (h > maxH) maxH = h;
  });
  return maxH;
}

/**
 * Builds a professional paginated PDF report.
 * - Column widths come from per-column widthPct (proportional, not equal).
 * - Row heights expand to fit wrapped text — no clipping, no overlap.
 * - Analytics report gets section-divider bands between groups.
 * - Properties report uses landscape A4 orientation for its wide schema.
 * - Table headers repeat on every new page.
 * - Page numbers added as a final pass.
 */
function buildPDF({ title, columns, rows, res, filename, landscape = false }) {
  const pageSize = landscape ? [841.89, 595.28] : 'A4'; // A4 landscape vs portrait
  const doc = new PDFDocument({ size: pageSize, margin: PDF_MARGIN, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageWidth  = doc.page.width  - PDF_MARGIN * 2;
  const pageHeight = doc.page.height;
  const colWidths  = resolveColWidths(columns, pageWidth);

  // Resolved x-origin for each column
  const colX = colWidths.reduce((acc, w, i) => {
    acc.push(i === 0 ? PDF_MARGIN : acc[i - 1] + colWidths[i - 1]);
    return acc;
  }, []);

  const bottomLimit = pageHeight - PDF_MARGIN - 24; // leave room for page number

  // ── Report header (title block, drawn once on page 1) ────────────────
  function drawReportHeader() {
    const y0 = PDF_MARGIN;

    doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f766e')
       .text('TerraGuide', PDF_MARGIN, y0, { lineBreak: false });

    doc.fontSize(11).font('Helvetica').fillColor('#374151')
       .text(title, PDF_MARGIN, y0 + 26);

    doc.fontSize(8.5).fillColor('#6b7280')
       .text(`Generated: ${formatDateReadable(new Date())}`, PDF_MARGIN, y0 + 43);

    // Dividing rule between header and table
    const ruleY = y0 + 60;
    doc.moveTo(PDF_MARGIN, ruleY).lineTo(PDF_MARGIN + pageWidth, ruleY)
       .strokeColor('#d1fae5').lineWidth(1).stroke();

    return ruleY + 8; // top of first table header
  }

  // ── Table column-header row ──────────────────────────────────────────
  function drawTableHeaderRow(y) {
    doc.rect(PDF_MARGIN, y, pageWidth, HEADER_HEIGHT).fill('#0f766e');
    doc.font('Helvetica-Bold').fontSize(FONT_SIZE).fillColor('#ffffff');
    columns.forEach((col, i) => {
      doc.text(
        col.pdfHeader || col.header,
        colX[i] + CELL_PAD_H,
        y + CELL_PAD_V,
        { width: colWidths[i] - CELL_PAD_H * 2, lineBreak: false }
      );
    });
    return y + HEADER_HEIGHT;
  }

  // ── Section-divider band (analytics only) ────────────────────────────
  function drawSectionBand(y, label) {
    doc.rect(PDF_MARGIN, y, pageWidth, SECTION_BAND_H).fill('#1f2937');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#d1fae5')
       .text(label.toUpperCase(), PDF_MARGIN + CELL_PAD_H, y + 5,
             { width: pageWidth - CELL_PAD_H * 2, lineBreak: false });
    return y + SECTION_BAND_H;
  }

  // ── Render a single data row ─────────────────────────────────────────
  function drawDataRow(y, row, rowHeight, isEven) {
    if (isEven) {
      doc.rect(PDF_MARGIN, y, pageWidth, rowHeight).fill('#f8faf9');
    } else {
      doc.rect(PDF_MARGIN, y, pageWidth, rowHeight).fill('#ffffff');
    }

    // Subtle row border
    doc.rect(PDF_MARGIN, y, pageWidth, rowHeight)
       .strokeColor('#e5e7eb').lineWidth(0.3).stroke();

    doc.font('Helvetica').fontSize(FONT_SIZE).fillColor('#111827');
    columns.forEach((col, i) => {
      const raw = row[col.key];
      const text = col.money
        ? formatPeso(raw)
        : raw === null || raw === undefined
        ? ''
        : String(raw);
      doc.text(
        text,
        colX[i] + CELL_PAD_H,
        y + CELL_PAD_V,
        { width: colWidths[i] - CELL_PAD_H * 2, align: col.align || 'left' }
      );
    });
  }

  // ── Main render loop ─────────────────────────────────────────────────
  let y = drawReportHeader();
  y = drawTableHeaderRow(y);

  const isAnalytics = columns.some((c) => c.key === 'section');
  let lastSection = null;
  let evenRow = false; // tracks alternating stripe independent of index

  rows.forEach((row) => {
    // Section-divider bands for analytics report
    if (isAnalytics && row.section !== lastSection) {
      const bandH = SECTION_BAND_H + 2;
      if (y + bandH > bottomLimit) {
        doc.addPage();
        y = PDF_MARGIN;
        y = drawTableHeaderRow(y);
      }
      y = drawSectionBand(y, row.section);
      lastSection = row.section;
      evenRow = false; // reset stripe on new section
    }

    const rowH = measureRowHeight(doc, columns, colWidths, row);

    // Page break — ensure the full row fits, then repeat the header
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = PDF_MARGIN;
      y = drawTableHeaderRow(y);
      evenRow = false;
    }

    drawDataRow(y, row, rowH, evenRow);
    y += rowH;
    evenRow = !evenRow;
  });

  if (rows.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#6b7280')
       .text('No records found.', PDF_MARGIN, y + 12);
  }

  // ── Page numbers (final pass) ────────────────────────────────────────
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(pageRange.start + i);
    doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
       .text(
         `Page ${i + 1} of ${pageRange.count}`,
         PDF_MARGIN,
         pageHeight - PDF_MARGIN + 8,
         { width: pageWidth, align: 'center' }
       );
  }

  doc.end();
}

/* ------------------------------------------------------------------ */
/* Dataset row builders — reuse existing services, no new DB queries   */
/* beyond what's needed to fetch "all records" instead of a page.      */
/* ------------------------------------------------------------------ */

async function buildPropertyRows() {
  const { properties } = await getAllProperties({ limit: Number.MAX_SAFE_INTEGER, page: 1 });
  const { cabinets } = await listCabinets();
  const cabinetNameById = new Map(cabinets.map((c) => [c._id.toString(), c.name]));

  return properties.map((p) => ({
    name: p.name || '',
    owner: p.owner || '',
    location: p.location || '',
    type: p.type || '',
    price: p.price ?? '',
    lotSize: p.lotSize || p.size || 0,
    pricePerSqm: p.pricePerSqm || '',
    status: p.status || '',
    cabinet: p.cabinetId ? cabinetNameById.get(p.cabinetId.toString()) || 'Unassigned' : 'Unassigned',
    lat: p.lat ?? '',
    lng: p.lng ?? '',
    deedStatus: p.documents?.deed || '',
    taxStatus: p.documents?.tax || '',
    surveyStatus: p.documents?.survey || '',
    createdAt: formatDateReadable(p.createdAt),
    updatedAt: formatDateReadable(p.updatedAt),
  }));
}

async function buildBuyerRows() {
  const buyers = await listBuyers();

  return buyers.map((b) => ({
    fullName: b.fullName || '',
    username: b.username || '',
    email: b.email || '',
    address: b.address || '',
    registeredAt: formatDateReadable(b.registeredAt),
    budgetMin: b.preferences?.budgetMin ?? '',
    budgetMax: b.preferences?.budgetMax ?? '',
    landType: b.preferences?.landType || '',
    intendedUse: b.preferences?.intendedUse || '',
    preferredLocation: b.preferences?.location || '',
    minLotSize: b.preferences?.minLotSize ?? '',
  }));
}

async function buildTransactionRows() {
  const transactions = await listTransactions();

  return transactions.map((t) => ({
    reference: t.reference || '',
    buyer: t.buyerId?.fullName || t.buyerId?.username || 'Unknown buyer',
    property: t.propertyId?.name || 'Unknown property',
    amount: t.amount ?? '',
    status: t.status || '',
    notes: t.notes || '',
    createdBy: t.createdBy?.fullName || t.createdBy?.username || '',
    createdAt: formatDateReadable(t.createdAt),
    completedAt: formatDateReadable(t.completedAt),
  }));
}

async function buildAnalyticsRows() {
  const [
    summary,
    charts,
    attentionProperties,
    rankingsResult,
    buyerIntelligence,
    salesPerformance,
  ] = await Promise.all([
    getDashboardSummary(),
    getChartData(),
    getAttentionProperties(),
    getPropertyRankings(),
    getBuyerIntelligence(),
    getSalesPerformance(),
  ]);

  const rows = [
    {
      section: 'Executive Summary',
      metric: 'Total Portfolio Value',
      value: formatPeso(summary.estimatedPortfolioValue),
      details: 'Combined value of all properties.',
    },
    {
      section: 'Executive Summary',
      metric: 'Total Properties',
      value: String(summary.totalProperties),
      details: 'All property listings in the system.',
    },
    {
      section: 'Executive Summary',
      metric: 'Total Buyers',
      value: String(summary.totalBuyers),
      details: 'Registered buyer accounts.',
    },
    {
      section: 'Executive Summary',
      metric: 'Average Compliance Score',
      value: `${summary.averageComplianceScore}%`,
      details: 'Average across the latest audit per property.',
    },
    {
      section: 'Executive Summary',
      metric: 'Average Success Rate',
      value: `${summary.averageSuccessRate}%`,
      details: 'Share of audited properties at or above compliance-ready threshold.',
    },
    {
      section: 'Executive Summary',
      metric: 'High-Risk Listings',
      value: String(summary.highRiskListingsCount),
      details: 'Properties currently flagged as high risk.',
    },
    {
      section: 'Executive Summary',
      metric: 'Audited Properties',
      value: String(summary.auditedPropertiesCount),
      details: 'Listings with at least one AI compliance audit.',
    },
    {
      section: 'Business Performance',
      metric: 'Total Revenue',
      value: formatPeso(salesPerformance.totalRevenue),
      details: salesPerformance.note || '',
    },
    {
      section: 'Business Performance',
      metric: 'Monthly Average',
      value: formatPeso(salesPerformance.monthlyAverage),
      details: 'Average revenue across tracked months.',
    },
    {
      section: 'Business Performance',
      metric: 'Projected Next Month',
      value: formatPeso(salesPerformance.forecastNextMonth),
      details: 'Forecast based on the most recent trend.',
    },
    {
      section: 'Business Performance',
      metric: 'Revenue YTD',
      value: formatPeso(salesPerformance.revenueYTD),
      details: `Source: ${salesPerformance.revenueYTDSource}.`,
    },
    {
      section: 'Buyer Intelligence',
      metric: 'Average Buyer Budget',
      value: formatPeso(buyerIntelligence.averageBudget),
      details: 'Average midpoint budget from buyer preferences.',
    },
    {
      section: 'Buyer Intelligence',
      metric: 'Buyers With Preferences Set',
      value: String(buyerIntelligence.totalBuyersWithPreferences),
      details: 'Number of buyers who saved preference data.',
    },
    {
      section: 'Property Rankings',
      metric: 'Unaudited Properties',
      value: String(rankingsResult.unauditedCount),
      details: 'Listings not yet included in the rankings.',
    },
  ];

  charts.propertyStatusDistribution.forEach((item) => {
    rows.push({
      section: 'Property Status Distribution',
      metric: item.label,
      value: String(item.count),
      details: 'Number of properties in this status.',
    });
  });

  charts.propertyTypeDistribution.forEach((item) => {
    rows.push({
      section: 'Property Type Distribution',
      metric: item.label,
      value: String(item.count),
      details: 'Number of properties in this category.',
    });
  });

  charts.complianceScoreDistribution.forEach((item) => {
    rows.push({
      section: 'Compliance Score Distribution',
      metric: item.label,
      value: String(item.count),
      details: 'Number of properties within this compliance-score band.',
    });
  });

  buyerIntelligence.preferredTypes.forEach((item) => {
    rows.push({
      section: 'Buyer Preferred Types',
      metric: item.label,
      value: String(item.count),
      details: 'Buyer preference votes for this land type.',
    });
  });

  buyerIntelligence.preferredLocations.forEach((item) => {
    rows.push({
      section: 'Buyer Preferred Locations',
      metric: item.label,
      value: String(item.count),
      details: 'Buyer preference votes for this location.',
    });
  });

  salesPerformance.monthlyTrend.forEach((item) => {
    rows.push({
      section: 'Sales Trend',
      metric: item.month,
      value: formatPeso(item.total),
      details: 'Revenue recorded for this month.',
    });
  });

  rankingsResult.rankings.slice(0, 10).forEach((entry) => {
    rows.push({
      section: 'Top Ranked Properties',
      metric: `#${entry.rank} ${entry.name}`,
      value: `${entry.marketReadinessScore}%`,
      details: `Compliance ${entry.complianceScore}%, Success ${entry.successRate}%, Risk ${entry.riskLevel}.`,
    });
  });

  attentionProperties.slice(0, 10).forEach((entry) => {
    rows.push({
      section: 'Properties Requiring Attention',
      metric: entry.name,
      value: entry.complianceScore === null ? 'Not yet audited' : `${entry.complianceScore}%`,
      details: `${entry.riskLevel} risk. ${entry.reasons.join('; ')}`,
    });
  });

  return rows;
}

/* ------------------------------------------------------------------ */
/* Column definitions per dataset (shared by CSV + PDF)                */
/* ------------------------------------------------------------------ */

const PROPERTY_COLUMNS = [
  { header: 'Property Name',  pdfHeader: 'Property Name', key: 'name',        widthPct: 0.13 },
  { header: 'Owner',          pdfHeader: 'Owner',         key: 'owner',        widthPct: 0.09 },
  { header: 'Location',       pdfHeader: 'Location',      key: 'location',     widthPct: 0.12 },
  { header: 'Type',           pdfHeader: 'Type',          key: 'type',         widthPct: 0.08 },
  { header: 'Price',          pdfHeader: 'Price',         key: 'price',        widthPct: 0.08, money: true, align: 'right' },
  { header: 'Lot Size (sqm)', pdfHeader: 'Lot (sqm)',     key: 'lotSize',      widthPct: 0.06 },
  { header: 'Price per Sqm',  pdfHeader: 'Price/Sqm',     key: 'pricePerSqm',  widthPct: 0.07, money: true, align: 'right' },
  { header: 'Status',         pdfHeader: 'Status',        key: 'status',       widthPct: 0.06 },
  { header: 'Cabinet',        pdfHeader: 'Cabinet',       key: 'cabinet',      widthPct: 0.07 },
  { header: 'Latitude',       pdfHeader: 'Lat',           key: 'lat',          widthPct: 0.05 },
  { header: 'Longitude',      pdfHeader: 'Lng',           key: 'lng',          widthPct: 0.05 },
  { header: 'Deed Status',    pdfHeader: 'Deed',          key: 'deedStatus',   widthPct: 0.04 },
  { header: 'Tax Status',     pdfHeader: 'Tax',           key: 'taxStatus',    widthPct: 0.04 },
  { header: 'Survey Status',  pdfHeader: 'Survey',        key: 'surveyStatus', widthPct: 0.04 },
  { header: 'Created Date',   pdfHeader: 'Created',       key: 'createdAt',    widthPct: 0.07 },
  { header: 'Updated Date',   pdfHeader: 'Updated',       key: 'updatedAt',    widthPct: 0.05 },
];

const BUYER_COLUMNS = [
  { header: 'Full Name',          pdfHeader: 'Full Name',      key: 'fullName',          widthPct: 0.13 },
  { header: 'Username',           pdfHeader: 'Username',       key: 'username',          widthPct: 0.10 },
  { header: 'Email',              pdfHeader: 'Email',          key: 'email',             widthPct: 0.17 },
  { header: 'Address',            pdfHeader: 'Address',        key: 'address',           widthPct: 0.13 },
  { header: 'Registered Date',    pdfHeader: 'Registered',     key: 'registeredAt',      widthPct: 0.10 },
  { header: 'Budget Min',         pdfHeader: 'Budget Min',     key: 'budgetMin',         widthPct: 0.09, money: true, align: 'right' },
  { header: 'Budget Max',         pdfHeader: 'Budget Max',     key: 'budgetMax',         widthPct: 0.09, money: true, align: 'right' },
  { header: 'Land Type',          pdfHeader: 'Land Type',      key: 'landType',          widthPct: 0.07 },
  { header: 'Intended Use',       pdfHeader: 'Intended Use',   key: 'intendedUse',       widthPct: 0.07 },
  { header: 'Preferred Location', pdfHeader: 'Pref. Location', key: 'preferredLocation', widthPct: 0.09 },
  { header: 'Min Lot Size (sqm)', pdfHeader: 'Min Lot (sqm)',  key: 'minLotSize',        widthPct: 0.06 },
];

const TRANSACTION_COLUMNS = [
  { header: 'Reference',      key: 'reference',  widthPct: 0.10 },
  { header: 'Buyer',          key: 'buyer',       widthPct: 0.14 },
  { header: 'Property',       key: 'property',    widthPct: 0.18 },
  { header: 'Amount',         key: 'amount',      widthPct: 0.10, money: true, align: 'right' },
  { header: 'Status',         key: 'status',      widthPct: 0.08 },
  { header: 'Notes',          key: 'notes',       widthPct: 0.18 },
  { header: 'Created By',     key: 'createdBy',   widthPct: 0.09 },
  { header: 'Created Date',   key: 'createdAt',   widthPct: 0.08 },
  { header: 'Completed Date', key: 'completedAt', widthPct: 0.05 },
];

const ANALYTICS_COLUMNS = [
  { header: 'Section',  key: 'section', widthPct: 0.18 },
  { header: 'Metric',   key: 'metric',  widthPct: 0.28 },
  { header: 'Value',    key: 'value',   widthPct: 0.14, align: 'right' },
  { header: 'Details',  key: 'details', widthPct: 0.40 },
];

const DATASETS = {
  properties: {
    label: 'Properties',
    columns: PROPERTY_COLUMNS,
    buildRows: buildPropertyRows,
    pdfTitle: 'Property Listings Report',
    landscape: true,
  },
  buyers: {
    label: 'Buyers',
    columns: BUYER_COLUMNS,
    buildRows: buildBuyerRows,
    pdfTitle: 'Registered Buyers Report',
  },
  transactions: {
    label: 'Transactions',
    columns: TRANSACTION_COLUMNS,
    buildRows: buildTransactionRows,
    pdfTitle: 'Transactions Report',
  },
  analytics: {
    label: 'Analytics',
    columns: ANALYTICS_COLUMNS,
    buildRows: buildAnalyticsRows,
    pdfTitle: 'Analytics Report',
  },
};

/* ------------------------------------------------------------------ */
/* Public API used by ExportController                                 */
/* ------------------------------------------------------------------ */

/**
 * Streams a CSV export of a single dataset to `res`.
 * @param {'properties'|'buyers'|'transactions'} datasetKey
 */
export const exportDatasetCSV = async (datasetKey, res) => {
  const dataset = DATASETS[datasetKey];
  if (!dataset) throw new AppError('Unknown export dataset.', 400);

  const rows = await dataset.buildRows();
  const csv = toCSV(dataset.columns, rows);
  const filename = `TerraGuide_${dataset.label}_${formatDateForFilename()}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
};

/**
 * Streams a PDF export of a single dataset to `res`.
 * @param {'properties'|'buyers'|'transactions'} datasetKey
 */
export const exportDatasetPDF = async (datasetKey, res) => {
  const dataset = DATASETS[datasetKey];
  if (!dataset) throw new AppError('Unknown export dataset.', 400);

  const rows = await dataset.buildRows();
  const filename = `TerraGuide_${dataset.label}_${formatDateForFilename()}.pdf`;

  buildPDF({
    title: dataset.pdfTitle,
    columns: dataset.columns,
    rows,
    res,
    filename,
    landscape: dataset.landscape ?? false,
  });
};

/**
 * Streams a ZIP containing one CSV per dataset (Properties, Buyers,
 * Transactions) — the "All Data" backup option. CSV-only by design: the
 * purpose is straightforward Excel-restorable backup, not a report.
 */
export const exportAllDataZip = async (res) => {
  const filename = `TerraGuide_AllData_${formatDateForFilename()}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    throw err;
  });
  archive.pipe(res);

  for (const key of ['properties', 'buyers', 'transactions']) {
    const dataset = DATASETS[key];
    const rows = await dataset.buildRows();
    const csv = toCSV(dataset.columns, rows);
    archive.append(csv, { name: `TerraGuide_${dataset.label}_${formatDateForFilename()}.csv` });
  }

  await archive.finalize();
};

export const EXPORT_DATASET_KEYS = Object.keys(DATASETS);