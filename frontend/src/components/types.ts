export interface Property {
  id: number;
  name: string;
  title?: string;
  owner?: string;
  description?: string;
  type: 'Residential' | 'Commercial' | 'Agricultural' | 'Condominium' | 'House & Lot' | string;
  location: string;
  price: number;
  size?: number;
  lotSize?: number;
  status: 'Available' | 'Reserved' | 'Sold';
  pricePerSqm?: number;
  lat: number;
  lng: number;
  images?: string[];
  documents?: {
    tax: 'pending' | 'verified' | 'missing';
    deed: 'pending' | 'verified' | 'missing';
    survey: 'pending' | 'verified' | 'missing';
  };
}

export interface BuyerPreferences {
  userId: string;
  budgetMin: number;
  budgetMax: number;
  landType: string;
  intendedUse: string;
  location: string;
  minLotSize: number;
  timestamp: number;
}

export interface Document {
  id: number;
  name: string;
  status: string;
  updatedAt: string;
}

export interface Analytics {
  totalProperties: number;
  avgPricePerSqm: number;
  activeDealsCount: number;
}

export interface NotificationLog {
  id: number;
  type: 'visit' | 'inquiry' | 'signup';
  title: string;
  sub: string;
  time: string;
  read: boolean;
  inquiryId?: number;
  visitId?: number;
  buyer?: string;
  property?: string;
}
 