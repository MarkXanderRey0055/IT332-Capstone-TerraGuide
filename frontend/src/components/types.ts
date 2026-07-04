export interface Property {
  id: number;
  name: string;
  type: 'Agricultural' | 'Residential' | 'Commercial';
  location: string;
  price: number;
  size: number;
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