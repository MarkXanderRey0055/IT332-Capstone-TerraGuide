import { apiRequest } from '../utils/api';

export interface SiteVisitProperty {
  id: string;
  name: string;
  location: string;
  type: string;
  status: string;
}

export interface SiteVisitBuyer {
  id: string;
  fullName: string;
  username: string;
  email: string;
}

export interface SiteVisit {
  id: string;
  buyerId: SiteVisitBuyer;
  propertyId: SiteVisitProperty;
  preferredDate: string;
  preferredTime: string;
  confirmedDate?: string | null;
  confirmedTime?: string;
  notes: string;
  adminResponse: string;
  status: 'Pending' | 'Scheduled' | 'Completed' | 'Missed';
  createdAt: string;
  updatedAt: string;
}

export async function submitSiteVisit(
  propertyId: string,
  preferredDate: string,
  notes: string,
  preferredTime: string = ''
): Promise<SiteVisit> {
  const res = await apiRequest('/site-visits', {
    method: 'POST',
    body: JSON.stringify({ propertyId, preferredDate, preferredTime, notes }),
  });
  return res.data as SiteVisit;
}

export async function getMySiteVisits(): Promise<SiteVisit[]> {
  const res = await apiRequest('/site-visits');
  return (res.data ?? []).map((visit: SiteVisit) => ({
    ...visit,
    adminResponse: visit.adminResponse ?? '',
  }));
}

export async function getAllSiteVisits(): Promise<SiteVisit[]> {
  const res = await apiRequest('/site-visits/admin/all');
  return (res.data ?? []).map((visit: SiteVisit) => ({
    ...visit,
    adminResponse: visit.adminResponse ?? '',
  }));
}

export async function updateSiteVisitStatus(
  id: string,
  status: 'Pending' | 'Scheduled' | 'Completed' | 'Missed',
  adminResponse: string,
  schedule: { confirmedDate?: string; confirmedTime?: string } = {},
  missedReason?: string
): Promise<SiteVisit> {
  const payload: Record<string, unknown> = { status, adminResponse, ...schedule };
  if (status === 'Missed' && missedReason !== undefined) {
    payload.missedReason = missedReason.trim();
  }
  const res = await apiRequest(`/site-visits/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return { ...(res.data as SiteVisit), adminResponse: res.data.adminResponse ?? '' };
}
