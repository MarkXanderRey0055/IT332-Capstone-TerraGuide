export interface Property {
  id: string;
  name: string;
  title?: string;
  owner?: string;
  description?: string;
  type: 'Residential' | 'Commercial' | 'Agricultural' | 'Condominium' | 'House & Lot' | string;
  // Uses this property is tagged as suitable for, compared against a buyer's
  // intendedUse preference during recommendation scoring. Optional.
  suitableFor?: ('Primary Residence' | 'Investment' | 'Business' | 'Farming' | 'Vacation Home')[];
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
  // Which Filing Cabinet this property is currently organized under.
  // null/undefined means the property is Unassigned.
  cabinetId?: string | null;
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

export interface BuyerInquiry {
  id: number;
  propertyId: string;
  propertyName: string;
  buyer: string;
  message: string;
  status: 'Pending' | 'Responded';
  createdAt: string;
}

export interface SiteVisitRequest {
  id: number;
  propertyId: string;
  propertyName: string;
  buyer: string;
  preferredDate: string;
  notes: string;
  status: 'Pending' | 'Scheduled' | 'Completed';
  createdAt: string;
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
 