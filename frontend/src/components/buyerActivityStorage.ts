import type { BuyerInquiry, SiteVisitRequest } from './types';

const INQUIRIES_STORAGE_KEY = 'terraguide_inquiries';
const SITE_VISITS_STORAGE_KEY = 'terraguide_site_visits';

export function loadInquiries(): BuyerInquiry[] {
  try {
    const raw = window.localStorage.getItem(INQUIRIES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BuyerInquiry[]) : [];
  } catch {
    return [];
  }
}

export function saveInquiries(inquiries: BuyerInquiry[]): void {
  window.localStorage.setItem(INQUIRIES_STORAGE_KEY, JSON.stringify(inquiries));
}

export function loadSiteVisits(): SiteVisitRequest[] {
  try {
    const raw = window.localStorage.getItem(SITE_VISITS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SiteVisitRequest[]) : [];
  } catch {
    return [];
  }
}

export function saveSiteVisits(visits: SiteVisitRequest[]): void {
  window.localStorage.setItem(SITE_VISITS_STORAGE_KEY, JSON.stringify(visits));
}

export function addInquiry(
  inquiry: Omit<BuyerInquiry, 'id' | 'status' | 'createdAt'>,
): BuyerInquiry {
  const newInquiry: BuyerInquiry = {
    ...inquiry,
    id: Date.now(),
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  saveInquiries([newInquiry, ...loadInquiries()]);
  return newInquiry;
}

export function addSiteVisitRequest(
  visit: Omit<SiteVisitRequest, 'id' | 'status' | 'createdAt'>,
): SiteVisitRequest {
  const newVisit: SiteVisitRequest = {
    ...visit,
    id: Date.now(),
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  saveSiteVisits([newVisit, ...loadSiteVisits()]);
  return newVisit;
}

export function getInquiriesForBuyer(buyer: string): BuyerInquiry[] {
  return loadInquiries().filter(
    (inquiry) => inquiry.buyer.toLowerCase() === buyer.toLowerCase(),
  );
}

export function getSiteVisitsForBuyer(buyer: string): SiteVisitRequest[] {
  return loadSiteVisits().filter(
    (visit) => visit.buyer.toLowerCase() === buyer.toLowerCase(),
  );
}

export { INQUIRIES_STORAGE_KEY, SITE_VISITS_STORAGE_KEY };
