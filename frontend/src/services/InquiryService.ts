import { apiRequest } from '../utils/api';

export interface InquiryProperty {
  id?: string;
  _id?: string;
  name: string;
  location: string;
  type: string;
  status: string;
  price?: number;
}

export interface InquiryBuyer {
  id?: string;
  _id?: string;
  fullName: string;
  username: string;
  email: string;
}

export interface Inquiry {
  id: string;
  buyerId: InquiryBuyer;
  propertyId: InquiryProperty;
  message: string;
  adminResponse: string;
  status: 'Pending' | 'Responded' | 'Not interested' | 'Property unavailable' | 'Duplicate' | 'Converted';
  closeReason?: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function populatedReferenceId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const reference = value as { _id?: unknown; id?: unknown; toString?: () => string };
  const idValue = reference._id ?? reference.id ?? value;
  if (typeof idValue === 'string') return idValue;
  if (idValue && typeof idValue === 'object' && typeof (idValue as { toString?: unknown }).toString === 'function') {
    const stringId = (idValue as { toString: () => string }).toString();
    return stringId === '[object Object]' ? '' : stringId;
  }
  return '';
}

export const getInquiryBuyerId = (inquiry: Inquiry): string => populatedReferenceId(inquiry.buyerId);
export const getInquiryPropertyId = (inquiry: Inquiry): string => populatedReferenceId(inquiry.propertyId);

export async function submitInquiry(propertyId: string, message: string): Promise<Inquiry> {
  const res = await apiRequest('/inquiries', {
    method: 'POST',
    body: JSON.stringify({ propertyId, message }),
  });
  return res.data as Inquiry;
}

export async function getMyInquiries(): Promise<Inquiry[]> {
  const res = await apiRequest('/inquiries');
  return (res.data ?? []).map((inquiry: Inquiry) => ({
    ...inquiry,
    adminResponse: inquiry.adminResponse ?? '',
  }));
}

export async function getAllInquiries(): Promise<Inquiry[]> {
  const res = await apiRequest('/inquiries/admin/all');
  return (res.data ?? []).map((inquiry: Inquiry) => ({
    ...inquiry,
    adminResponse: inquiry.adminResponse ?? '',
  }));
}

export async function updateInquiryStatus(
  id: string,
  status: Inquiry['status'],
  adminResponse: string,
  closeReason?: string
): Promise<Inquiry> {
  const res = await apiRequest(`/inquiries/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status, adminResponse, closeReason }),
  });
  return { ...(res.data as Inquiry), adminResponse: res.data.adminResponse ?? '' };
}
