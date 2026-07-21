import type { Property, Document, Analytics } from '../types/types';

// Mock real estate listings centered around Balayan, Batangas / Calabarzon region
export const mockProperties: Property[] = [
  {
    id: 1,
    name: "tindahan ng masayang alaala",
    owner: "Maria Santos",
    type: "Commercial",
    location: "Balayan, Batangas",
    price: 18500000,
    size: 15000,
    lotSize: 15000,
    status: "Available",
    pricePerSqm: 1233,
    lat: 13.929725,
    lng: 120.716338,
    images: [
      "https://i.pinimg.com/736x/72/54/3e/72543e695ad3f51e05acbb7be49bc90b.jpg"
    ],
    documents: { tax: 'verified', deed: 'pending', survey: 'verified' },
  },
  {
    id: 109,
    name: "Bahay ni Xander",
    title: "Bahay ni Xander",
    owner: "Xander Reyes",
    description: "Premium modern residential villa located in the heart of Balayan, Batangas. Designed with spacious interiors, high-contrast aesthetics, and state-of-the-art security features perfect for family living.",
    type: "Residential",
    location: "Balayan, Batangas",
    price: 850000,
    size: 1200,
    lotSize: 1200,
    status: "Available",
    pricePerSqm: 708,
    lat: 13.948324,
    lng: 120.722989,
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
    ],
    documents: { tax: 'verified', deed: 'verified', survey: 'pending' },
  },
  {
    id: 3,
    name: "Bahay ni Clyde",
    owner: "Clyde Mendoza",
    description: "A distinctive commercial property located in Poblacion, Balayan, ideal for adaptive reuse or mixed-use development.",
    type: "Commercial",
    location: "Sambat, Balayan",
    price: 45000000,
    size: 2500,
    lotSize: 2500,
    status: "Reserved",
    pricePerSqm: 18000,
    lat: 13.950902,
    lng: 120.6989117,
    images: [
      "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80"
    ],
    documents: { tax: 'pending', deed: 'verified', survey: 'missing' },
  },
  {
    id: 4,
    name: "Kapitan Toti Rice Fields",
    owner: "Antonio 'Toti' Garcia",
    type: "Agricultural",
    location: "Balayan Outskirts",
    price: 12000000,
    size: 10000,
    lotSize: 10000,
    status: "Available",
    pricePerSqm: 1200,
    lat: 13.9620,
    lng: 120.7450,
    images: [
      "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=800&q=80"
    ],
    documents: { tax: 'verified', deed: 'verified', survey: 'verified' },
  },
  {
    id: 5,
    name: "Avida Towers Prime Taft",
    owner: "Avida Land Corp.",
    type: "Condominium",
    location: "Taft Avenue, Manila",
    price: 6200000,
    size: 65,
    lotSize: 65,
    status: "Available",
    pricePerSqm: 95385,
    lat: 14.5637,
    lng: 120.9946,
    images: [
      "https://images.unsplash.com/photo-1560185127-6b9b670fbd95?auto=format&fit=crop&w=800&q=80"
    ],
    documents: { tax: 'verified', deed: 'verified', survey: 'verified' },
  },
  {
    id: 6,
    name: "Amaia Skies Cubao",
    owner: "Amaia Land",
    type: "Condominium",
    location: "Cubao, Quezon City",
    price: 5400000,
    size: 55,
    lotSize: 55,
    status: "Sold",
    pricePerSqm: 98182,
    lat: 14.6192,
    lng: 121.0523,
    images: [
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=800&q=80"
    ],
    documents: { tax: 'verified', deed: 'verified', survey: 'verified' },
  },
  {
    id: 7,
    name: "Camella Cerritos Bacoor",
    owner: "Vista Land",
    type: "House & Lot",
    location: "Bacoor, Cavite",
    price: 4200000,
    size: 100,
    lotSize: 100,
    status: "Available",
    pricePerSqm: 42000,
    lat: 14.4137,
    lng: 120.9725,
    images: [
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=800&q=80"
    ],
    documents: { tax: 'pending', deed: 'verified', survey: 'pending' },
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