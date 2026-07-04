import type { Property, Document, Analytics } from './types';

// Mock real estate listings centered around Balayan, Batangas / Calabarzon region
export const mockProperties: Property[] = [
  {
    id: 1,
    name: "Para sayo to Rene",
    type: "Agricultural",
    location: "Balayan, Batangas",
    price: 18500000,
    size: 15000, // in sqm
    pricePerSqm: 1233,
    lat: 13.9450,
    lng: 120.7300,
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"
    ]
  },
  {
    id: 2,
    name: "Bahay ni Xander",
    type: "Residential",
    location: "Calabarzon Sector 4",
    price: 6200000,
    size: 450, // in sqm
    pricePerSqm: 13777,
    lat: 13.9210,
    lng: 120.7120,
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
    ]
  },
  {
    id: 3,
    name: "Bahay ni Clyde",
    type: "Commercial",
    location: "Poblacion, Balayan",
    price: 45000000,
    size: 2500, // in sqm
    pricePerSqm: 18000,
    lat: 13.9415,
    lng: 120.7345,
    images: [
      "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80"
    ]
  },
  {
    id: 4,
    name: "Mat Rice Fields",
    type: "Agricultural",
    location: "Balayan Outskirts",
    price: 12000000,
    size: 10000, // in sqm
    pricePerSqm: 1200,
    lat: 13.9620,
    lng: 120.7450,
    images: [
      "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=800&q=80"
    ]
  }
];

// Document compliance tracking history for the transaction workspace
export const mockDocuments: Document[] = [
  {
    id: 1,
    name: "Letter of Intent - Balayan Plot",
    status: "Approved",
    updatedAt: "Today, 9:00 AM"
  },
  {
    id: 2,
    name: "Certified True Copy of Land Title (TCT)",
    status: "In Progress",
    updatedAt: "Yesterday"
  },
  {
    id: 3,
    name: "Tax Declaration Clearance Certificate",
    status: "Rejected",
    updatedAt: "Oct 12, 2024"
  }
];

// Context metrics calculation summaries
export const mockAnalytics: Analytics = {
  totalProperties: 24,
  avgPricePerSqm: 8575,
  activeDealsCount: 3
};