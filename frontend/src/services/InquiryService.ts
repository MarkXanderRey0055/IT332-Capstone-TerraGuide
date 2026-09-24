import { apiRequest } from '../utils/api';

export interface InquiryProperty {
  id: string;
  name: string;
  location: string;
  type: string;
  status: string;
}

export interface InquiryBuyer {
  id: string;
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
  status: 'Pending' | 'Responded';
  createdAt: string;
  updatedAt: string;
}

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
  status: 'Pending' | 'Responded',
  adminResponse: string
): Promise<Inquiry> {
  const res = await apiRequest(`/inquiries/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status, adminResponse }),
  });
  return { ...(res.data as Inquiry), adminResponse: res.data.adminResponse ?? '' };
}
