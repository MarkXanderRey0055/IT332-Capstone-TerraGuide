import React, { useEffect, useMemo, useState } from 'react';
import {
  Home,
  Search,
  Sparkles,
  SlidersHorizontal,
  Mail,
  Calendar,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { mockProperties } from './data';
import type { BuyerPreferences, Property } from './types';
import { WelcomeModal } from './WelcomeModal';
import { PropertyMap } from './PropertyMap';
import { PropertyDetails } from './PropertyDetails';
import { BuyerSearch, BuyerSuggestions, BuyerPreferencesView } from './BuyerPages';
import {
  loadBuyerPreferences,
  removeBuyerPreferences,
  saveBuyerPreferences,
} from './buyerPrefs';

type BuyerPortalProps = {
  onSignIn?: () => void;
  isAuthenticated?: boolean;
};

const mapHomeTypeToFilter = (propertyType: string) => {
  if (propertyType === 'All Types') return '';
  if (propertyType === 'Agricultural') return 'Agricultural';
  if (propertyType === 'Commercial') return 'Commercial';
  if (propertyType === 'Residential') return 'Residential';
  return '';
};

export const BuyerPortal: React.FC<BuyerPortalProps> = ({ onSignIn, isAuthenticated = false }) => {
  const [activeTab, setActiveTab] = useState('Home');
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState('All Types');
  const [priceRange, setPriceRange] = useState<number>(5000000);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [searchType, setSearchType] = useState('');
  const [searchMaxPrice, setSearchMaxPrice] = useState<number>(5000000);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('Valued Buyer');
  const [buyerUserId, setBuyerUserId] = useState('');
  const [welcomeCompletionKey, setWelcomeCompletionKey] = useState('terraguide_welcomeCompleted');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [buyerPrefs, setBuyerPrefs] = useState<BuyerPreferences | null>(null);

  const locationOptions = useMemo(
    () => [...new Set(mockProperties.map((property) => property.location))].sort(),
    [],
  );

  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property);
  };

  const handleClosePropertyDetails = () => {
    setSelectedProperty(null);
  };

  const handleRequestVisit = () => {
    if (selectedProperty) {
      console.log('Request site visit for', selectedProperty.name);
    }
  };

  const handleSendInquiry = () => {
    if (selectedProperty) {
      console.log('Send inquiry for', selectedProperty.name);
    }
  };

  const handleSearchApply = (query: string, loc: string, type: string, maxPrice: number) => {
    setSearchKeyword(query);
    setSearchLocation(loc);
    setSearchType(type);
    setSearchMaxPrice(maxPrice);
    setActiveTab('Search');
  };

  const handleHeroSearch = () => {
    handleSearchApply(searchTerm, location, mapHomeTypeToFilter(propertyType), priceRange);
  };

  const handleQuickApply = () => {
    handleSearchApply('', location, mapHomeTypeToFilter(propertyType), priceRange);
  };

  const persistPreferences = (prefsData: Omit<BuyerPreferences, 'userId' | 'timestamp'>) => {
    const userId = buyerUserId || buyerName || 'guest';
    const saved: BuyerPreferences = {
      userId,
      ...prefsData,
      timestamp: Date.now(),
    };
    saveBuyerPreferences(saved);
    setBuyerPrefs(saved);
  };

  const handleResetPreferences = () => {
    const userId = buyerUserId || buyerName || 'guest';
    removeBuyerPreferences(userId);
    setBuyerPrefs(null);
  };

  const mapProperties = mockProperties;

  useEffect(() => {
    if (!isAuthenticated) {
      setIsWelcomeModalOpen(false);
      setBuyerPrefs(null);
      return;
    }

    let currentBuyerName = 'Valued Buyer';
    let currentUserId = 'guest';
    try {
      const currentBuyer = window.localStorage.getItem('terraguide_currentBuyer');
      if (currentBuyer) {
        const parsedBuyer = JSON.parse(currentBuyer) as { username?: string; email?: string };
        currentBuyerName = parsedBuyer.username || parsedBuyer.email || currentBuyerName;
        currentUserId = parsedBuyer.username || parsedBuyer.email || currentUserId;
      }
    } catch {
      currentBuyerName = 'Valued Buyer';
      currentUserId = 'guest';
    }

    setBuyerName(currentBuyerName);
    setBuyerUserId(currentUserId);
    setBuyerPrefs(loadBuyerPreferences(currentUserId));

    const currentUserKey = currentBuyerName.trim()
      ? `terraguide_welcomeCompleted:${currentBuyerName}`
      : 'terraguide_welcomeCompleted';
    const hasCompletedWelcomeModal = window.localStorage.getItem(currentUserKey) === 'true';

    setWelcomeCompletionKey(currentUserKey);

    if (!hasCompletedWelcomeModal) {
      setIsWelcomeModalOpen(true);
    }
  }, [isAuthenticated]);

  if (selectedProperty) {
    return (
      <PropertyDetails
        property={selectedProperty}
        onBack={handleClosePropertyDetails}
        onRequestVisit={handleRequestVisit}
        onSendInquiry={handleSendInquiry}
      />
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Search':
        return (
          <BuyerSearch
            properties={mapProperties}
            onSelectProperty={handleSelectProperty}
            initialKeyword={searchKeyword}
            initialLocation={searchLocation}
            initialType={searchType}
            initialMaxPrice={searchMaxPrice}
          />
        );
      case 'Suggested':
        return (
          <BuyerSuggestions
            properties={mapProperties}
            buyerPrefs={buyerPrefs}
            onSelectProperty={handleSelectProperty}
          />
        );
      case 'Preferences':
        return (
          <BuyerPreferencesView
            buyerPrefs={buyerPrefs}
            onSavePrefs={persistPreferences}
            onResetPrefs={handleResetPreferences}
          />
        );
      case 'Inquiries':
        return (
          <div className="max-w-4xl mx-auto px-8 py-20 text-center">
            <Mail className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <h2 className="font-serif text-2xl text-[#1C3A27]">My Inquiries</h2>
            <p className="text-xs text-neutral-500 mt-2">No inquiries submitted yet.</p>
          </div>
        );
      case 'Site Visits':
        return (
          <div className="max-w-4xl mx-auto px-8 py-20 text-center">
            <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <h2 className="font-serif text-2xl text-[#1C3A27]">My Site Visits</h2>
            <p className="text-xs text-neutral-500 mt-2">No site visits requested yet.</p>
          </div>
        );
      default:
        return (
          <>
            <section className="px-6 pt-4 pb-2">
              <div className="max-w-[1500px] mx-auto bg-gradient-to-b from-[#0F291B] via-[#143523] to-[#1C462E] rounded-[32px] pt-24 pb-28 px-6 text-center text-white relative overflow-hidden shadow-lg">
                <span className="text-[10px] font-bold tracking-[0.25em] text-emerald-400/80 uppercase block mb-3">
                  Find Where Life Happens
                </span>

                <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight leading-tight max-w-3xl mx-auto">
                  Discover Your <span className="italic font-light text-emerald-300">Perfect</span> Property
                </h1>

                <p className="text-neutral-300/90 text-xs md:text-sm max-w-xl mx-auto mt-4 font-normal leading-relaxed">
                  Browse premium residential lots, agriculture farmland, and industrial developments curated for
                  your preferences.
                </p>

                <div className="max-w-2xl mx-auto mt-10 bg-white/10 backdrop-blur-md p-1.5 rounded-full border border-white/10 flex items-center shadow-2xl">
                  <div className="pl-4 pr-2 text-white/60">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by location, keyword or zone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                    className="w-full bg-transparent border-none text-white placeholder-white/50 text-xs md:text-sm focus:outline-hidden py-2"
                  />
                  <button
                    type="button"
                    onClick={handleHeroSearch}
                    className="bg-[#1C3A27] text-white hover:bg-[#254F35] font-semibold text-xs px-6 py-2.5 rounded-full transition-all shadow-md cursor-pointer shrink-0 border-none"
                  >
                    Search
                  </button>
                </div>
              </div>
            </section>

            <section className="px-6 -mt-14 relative z-20">
              <div className="max-w-5xl mx-auto bg-white border border-neutral-200/60 rounded-2xl p-4 shadow-xl shadow-neutral-900/5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">
                    Location
                  </label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-[#F5F7F6] border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1E2E24] focus:outline-hidden focus:border-[#1C3A27]"
                  >
                    <option value="">All Locations</option>
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">
                    Property Type
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full bg-[#F5F7F6] border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1E2E24] focus:outline-hidden focus:border-[#1C3A27]"
                  >
                    <option>All Types</option>
                    <option>Residential</option>
                    <option>Agricultural</option>
                    <option>Commercial</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 px-1">
                  <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-neutral-400">
                    <span>Price Range</span>
                    <span className="text-[#1C3A27] font-extrabold">
                      Up to ₱{(priceRange / 1000000).toFixed(1)}M
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000000}
                    max={50000000}
                    step={1000000}
                    value={priceRange}
                    onChange={(e) => setPriceRange(Number(e.target.value))}
                    className="w-full accent-[#1C3A27] cursor-pointer my-2"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleQuickApply}
                  className="w-full bg-[#1C3A27] hover:bg-[#254F35] text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs cursor-pointer h-[38px] border-none"
                >
                  Apply Quick Filters
                </button>
              </div>
            </section>

            <section className="max-w-[1500px] mx-auto px-8 pt-16 pb-20">
              <div className="flex items-center justify-between mb-8 border-b border-neutral-200/60 pb-4">
                <h2 className="font-serif text-2xl md:text-3xl font-normal text-[#1C3A27]">
                  Featured Properties
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('Search')}
                  className="text-xs font-bold text-[#1C3A27] flex items-center gap-1 hover:underline transition-all group bg-transparent border-none cursor-pointer"
                >
                  View all listings
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {mockProperties.slice(0, 4).map((property) => (
                  <div
                    key={property.id}
                    onClick={() => handleSelectProperty(property)}
                    className="bg-white rounded-2xl overflow-hidden border border-neutral-200/50 hover:shadow-md transition-all duration-300 flex flex-col group cursor-pointer"
                  >
                    <div className="h-48 w-full bg-neutral-100 overflow-hidden relative">
                      {property.images?.[0] ? (
                        <img
                          src={property.images[0]}
                          alt={property.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">
                          No Image
                        </div>
                      )}
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-bold text-[#1C3A27] shadow-xs">
                        {property.type}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-serif font-bold text-base text-[#1C3A27] line-clamp-1 group-hover:text-emerald-800 transition-colors">
                          {property.title ?? property.name}
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                          {property.location}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                        <span className="text-[11px] text-neutral-400 font-medium">
                          {property.size.toLocaleString()} sqm
                        </span>
                        <span className="text-sm font-black text-[#1C3A27]">
                          ₱{property.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="max-w-[1500px] mx-auto px-8 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-neutral-200/60 pb-4">
                  <div>
                    <h2 className="font-serif text-2xl font-normal text-[#1C3A27]">Interactive Map</h2>
                    <p className="text-xs text-neutral-500 mt-1">
                      Explore property boundaries and nearby landmarks.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-2 rounded-[24px] border border-neutral-200/60 shadow-xs h-[500px] w-full relative z-10 overflow-hidden">
                  <div className="w-full h-full rounded-[16px] overflow-hidden border border-neutral-200/60">
                    <PropertyMap properties={mapProperties} onSelectProperty={handleSelectProperty} />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-neutral-200/60 pb-4">
                  <div>
                    <h2 className="font-serif text-2xl font-normal text-[#1C3A27]">Active Documents</h2>
                    <p className="text-xs text-neutral-500 mt-1">Track your ongoing transactions.</p>
                  </div>
                </div>

                <div className="bg-white rounded-[24px] border border-neutral-200/60 shadow-xs p-5 flex flex-col gap-3">
                  {[
                    { id: 1, name: 'Letter of Intent - Balayan Plot', status: 'Approved', date: 'Today, 9:00 AM' },
                    { id: 2, name: 'Deed of Sale Draft', status: 'In Progress', date: 'Yesterday' },
                    { id: 3, name: 'Site Tripping Waiver', status: 'Pending Review', date: 'Oct 12, 2024' },
                  ].map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-[#F5F7F6] border border-neutral-100 rounded-xl flex flex-col gap-2 hover:border-[#1C3A27]/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-[#1E2E24] leading-tight">{doc.name}</h4>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            doc.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : doc.status === 'In Progress'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-medium">Last updated: {doc.date}</p>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="mt-2 w-full py-2.5 rounded-xl border border-dashed border-neutral-300 text-xs font-bold text-neutral-500 hover:text-[#1C3A27] hover:border-[#1C3A27] hover:bg-[#F5F7F6] transition-all cursor-pointer bg-transparent"
                  >
                    View All Documents
                  </button>
                </div>
              </div>
            </section>
          </>
        );
    }
  };

  return (
    <>
      <WelcomeModal
        isOpen={isWelcomeModalOpen}
        onClose={() => {
          window.localStorage.setItem(welcomeCompletionKey, 'true');
          setIsWelcomeModalOpen(false);
        }}
        buyerName={buyerName}
        onSavePreferences={persistPreferences}
      />

      <div className="min-h-screen bg-[#F4F9F6] text-[#1E2E24] font-sans antialiased selection:bg-[#1C3A27] selection:text-white">
        <header className="bg-white border-b border-neutral-100 px-8 py-3 flex items-center justify-between sticky top-0 z-50 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="bg-[#1C3A27] text-white w-8 h-8 rounded-lg flex items-center justify-center font-serif text-lg font-bold">
              T
            </div>
            <span className="font-serif font-black text-xl tracking-tight text-[#1C3A27]">TerraGuide</span>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-[#F5F7F6] p-1 rounded-full border border-neutral-200/60">
            {[
              { id: 'Home', label: 'Home', icon: Home },
              { id: 'Search', label: 'Search', icon: Search },
              { id: 'Suggested', label: 'Suggested', icon: Sparkles },
              { id: 'Preferences', label: 'Preferences', icon: SlidersHorizontal },
              { id: 'Inquiries', label: 'Inquiries', icon: Mail },
              { id: 'Site Visits', label: 'Site Visits', icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer border-none ${
                    isActive
                      ? 'bg-white text-[#1C3A27] shadow-sm font-semibold'
                      : 'text-neutral-500 hover:text-[#1C3A27] bg-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <button
              type="button"
              className="text-xs font-semibold text-neutral-500 hover:text-[#1C3A27] cursor-pointer underline decoration-dotted underline-offset-4 bg-transparent border-none"
            >
              Staff Portal
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-1.5 bg-[#1C3A27] text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-[#152C1E] transition-colors cursor-pointer shadow-xs border-none"
            >
              <LogOut className={`w-3.5 h-3.5 ${isAuthenticated ? '' : 'rotate-180'}`} />
              {isAuthenticated ? 'Logout' : 'Sign In'}
            </button>
          </div>
        </header>

        {renderTabContent()}
      </div>
    </>
  );
};

export default BuyerPortal;
