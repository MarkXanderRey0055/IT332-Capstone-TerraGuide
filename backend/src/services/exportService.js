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

//pdf implementation 
const PDF_MARGIN = 40;
const PDF_PAGE_SIZE = 'A4';

/**
 * Renders a paginated table report into a PDFDocument, streamed to `res`.
 * Monetary columns (marked `money: true`) are peso-formatted; everything
 * else is printed as-is.
 */
function buildPDF({ title, columns, rows, res, filename }) {
  const doc = new PDFDocument({ size: PDF_PAGE_SIZE, margin: PDF_MARGIN, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageWidth = doc.page.width - PDF_MARGIN * 2;
  const colWidth = pageWidth / columns.length;
  const rowHeight = 20;

  function drawHeader() {
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#1f2937').text('TerraGuide', PDF_MARGIN, PDF_MARGIN);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#374151')
      .text(title, PDF_MARGIN, PDF_MARGIN + 22);
    doc
      .fontSize(9)
      .fillColor('#6b7280')
      .text(`Generated: ${formatDateReadable(new Date())}`, PDF_MARGIN, PDF_MARGIN + 40);

    const tableTop = PDF_MARGIN + 62;
    drawTableHeaderRow(tableTop);
    return tableTop + rowHeight;
  }

  function drawTableHeaderRow(y) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    doc.rect(PDF_MARGIN, y, pageWidth, rowHeight).fill('#0f766e');
    doc.fillColor('#ffffff');
    columns.forEach((col, i) => {
      doc.text(col.header, PDF_MARGIN + i * colWidth + 4, y + 6, {
        width: colWidth - 8,
        ellipsis: true,
      });
    });
  }

  let y = drawHeader();
  const bottomLimit = doc.page.height - PDF_MARGIN - 20;

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = PDF_MARGIN;
      drawTableHeaderRow(y);
      y += rowHeight;
    }

    if (rowIndex % 2 === 0) {
      doc.rect(PDF_MARGIN, y, pageWidth, rowHeight).fill('#f3f4f6');
    }

    doc.font('Helvetica').fontSize(8).fillColor('#111827');
    columns.forEach((col, i) => {
      const raw = row[col.key];
      const text = col.money ? formatPeso(raw) : raw === null || raw === undefined ? '' : String(raw);
      doc.text(text, PDF_MARGIN + i * colWidth + 4, y + 6, {
        width: colWidth - 8,
        ellipsis: true,
      });
    });

    y += rowHeight;
  });

  if (rows.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#6b7280').text('No records found.', PDF_MARGIN, y + 10);
  }

  // Page numbers, added after content flows so we know the final page count.
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(pageRange.start + i);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#9ca3af')
      .text(`Page ${i + 1} of ${pageRange.count}`, PDF_MARGIN, doc.page.height - PDF_MARGIN, {
        width: pageWidth,
        align: 'center',
      });
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
  { header: 'Property Name', key: 'name' },
  { header: 'Owner', key: 'owner' },
  { header: 'Location', key: 'location' },
  { header: 'Type', key: 'type' },
  { header: 'Price', key: 'price', money: true },
  { header: 'Lot Size (sqm)', key: 'lotSize' },
  { header: 'Price per Sqm', key: 'pricePerSqm', money: true },
  { header: 'Status', key: 'status' },
  { header: 'Cabinet', key: 'cabinet' },
  { header: 'Latitude', key: 'lat' },
  { header: 'Longitude', key: 'lng' },
  { header: 'Deed Status', key: 'deedStatus' },
  { header: 'Tax Status', key: 'taxStatus' },
  { header: 'Survey Status', key: 'surveyStatus' },
  { header: 'Created Date', key: 'createdAt' },
  { header: 'Updated Date', key: 'updatedAt' },
];

const BUYER_COLUMNS = [
  { header: 'Full Name', key: 'fullName' },
  { header: 'Username', key: 'username' },
  { header: 'Email', key: 'email' },
  { header: 'Address', key: 'address' },
  { header: 'Registered Date', key: 'registeredAt' },
  { header: 'Budget Min', key: 'budgetMin', money: true },
  { header: 'Budget Max', key: 'budgetMax', money: true },
  { header: 'Land Type', key: 'landType' },
  { header: 'Intended Use', key: 'intendedUse' },
  { header: 'Preferred Location', key: 'preferredLocation' },
  { header: 'Min Lot Size (sqm)', key: 'minLotSize' },
];

const TRANSACTION_COLUMNS = [
  { header: 'Reference', key: 'reference' },
  { header: 'Buyer', key: 'buyer' },
  { header: 'Property', key: 'property' },
  { header: 'Amount', key: 'amount', money: true },
  { header: 'Status', key: 'status' },
  { header: 'Notes', key: 'notes' },
  { header: 'Created By', key: 'createdBy' },
  { header: 'Created Date', key: 'createdAt' },
  { header: 'Completed Date', key: 'completedAt' },
];

const ANALYTICS_COLUMNS = [
  { header: 'Section', key: 'section' },
  { header: 'Metric', key: 'metric' },
  { header: 'Value', key: 'value' },
  { header: 'Details', key: 'details' },
];

const DATASETS = {
  properties: {
    label: 'Properties',
    columns: PROPERTY_COLUMNS,
    buildRows: buildPropertyRows,
    pdfTitle: 'Property Listings Report',
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
