export interface Property {
  id: number;
  name: string;
  title?: string;
  description?: string;
  type: 'Agricultural' | 'Residential' | 'Commercial' | 'Condominium' | 'House & Lot';
  location: string;
  price: number;
  size: number;
  lotSize?: number;
  status?: 'Available' | 'Reserved' | 'Sold';
  pricePerSqm: number;
  lat: number;
  lng: number;
  images: string[];
}

export interface Document {
  id: number;
  name: string;
  status: 'Approved' | 'In Progress' | 'Rejected' | 'Pending Review';
  updatedAt: string;
}

export interface Analytics {
  totalProperties: number;
  avgPricePerSqm: number;
  activeDealsCount: number;
}