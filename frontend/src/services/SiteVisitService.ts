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
  notes: string;
  status: 'Pending' | 'Scheduled' | 'Completed';
  createdAt: string;
  updatedAt: string;
}

export async function submitSiteVisit(
  propertyId: string,
  preferredDate: string,
  notes: string
): Promise<SiteVisit> {
  const res = await apiRequest('/site-visits', {
    method: 'POST',
    body: JSON.stringify({ propertyId, preferredDate, notes }),
  });
  return res.data as SiteVisit;
}

export async function getMySiteVisits(): Promise<SiteVisit[]> {
  const res = await apiRequest('/site-visits');
  return (res.data ?? []) as SiteVisit[];
}

export async function getAllSiteVisits(): Promise<SiteVisit[]> {
  const res = await apiRequest('/site-visits/admin/all');
  return (res.data ?? []) as SiteVisit[];
}

export async function updateSiteVisitStatus(
  id: string,
  status: 'Pending' | 'Scheduled' | 'Completed'
): Promise<SiteVisit> {
  const res = await apiRequest(`/site-visits/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return res.data as SiteVisit;
}
