import React, { useEffect, useState } from 'react';
import { Search, Sliders, HelpCircle } from 'lucide-react';
import type { Property as PropertyListing, BuyerPreferences } from '../../types/types';
import { PropertyCard } from '../../components/Buyer/PropertyCard';
import { getLotSize } from '../../services/buyerPrefs';

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

const isAvailable = (property: PropertyListing) => property.status !== 'Sold';

const getUniqueLocations = (properties: PropertyListing[]) =>
  [...new Set(properties.map((property) => property.location))].sort();

const getUniqueTypes = (properties: PropertyListing[]) =>
  [...new Set(properties.map((property) => property.type))].sort();

interface BuyerSearchProps {
  properties: PropertyListing[];
  onSelectProperty: (property: PropertyListing) => void;
  initialKeyword: string;
  initialLocation: string;
  initialType: string;
  initialMaxPrice: number;
}

export const BuyerSearch: React.FC<BuyerSearchProps> = ({
  properties,
  onSelectProperty,
  initialKeyword,
  initialLocation,
  initialType,
  initialMaxPrice,
}) => {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [location, setLocation] = useState(initialLocation);
  const [type, setType] = useState(initialType);
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>(initialMaxPrice || '');
  const [minLotSize, setMinLotSize] = useState<number | ''>('');

  useEffect(() => {
    setKeyword(initialKeyword);
    setLocation(initialLocation);
    setType(initialType);
    if (initialMaxPrice) {
      setMaxPrice(initialMaxPrice);
    }
  }, [initialKeyword, initialLocation, initialType, initialMaxPrice]);

  const locationOptions = getUniqueLocations(properties);
  const typeOptions = getUniqueTypes(properties);

  const filtered = properties.filter(isAvailable).filter((property) => {
    if (keyword.trim()) {
      const query = keyword.toLowerCase();
      const haystack = [
        property.name,
        property.title ?? '',
        property.description ?? '',
        property.location,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (location && property.location !== location) return false;
    if (type && property.type !== type) return false;
    if (minPrice && property.price < minPrice) return false;
    if (maxPrice && property.price > maxPrice) return false;
    if (minLotSize && getLotSize(property) < minLotSize) return false;
    return true;
  });

  const handleClearFilters = () => {
    setKeyword('');
    setLocation('');
    setType('');
    setMinPrice('');
    setMaxPrice('');
    setMinLotSize('');
  };

  return (
    <div className="max-w-[1500px] mx-auto px-8 py-10 space-y-6">
      <div className="border-b border-neutral-200/60 pb-4">
        <h2 className="font-serif text-3xl font-normal text-[#1C3A27]">Search Properties</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Filter through verified residential, agricultural, and commercial developments.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        <aside className="p-6 rounded-2xl bg-white border border-neutral-200/60 shadow-xs space-y-4 md:col-span-1">
          <div className="flex justify-between items-center border-b border-neutral-100 pb-2">
            <strong className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-600" />
              Filters
            </strong>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-transparent border-none cursor-pointer"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Keyword</label>
            <input
              type="text"
              placeholder="Search name, location..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full p-2 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#1C3A27]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Location</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-2 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#1C3A27]"
            >
              <option value="">All Locations</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Property Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-2 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#1C3A27]"
            >
              <option value="">All Types</option>
              {typeOptions.map((propertyType) => (
                <option key={propertyType} value={propertyType}>
                  {propertyType}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Min Price</label>
              <input
                type="number"
                placeholder="0"
                value={minPrice || ''}
                onChange={(e) => setMinPrice(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full p-2 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-xs focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Max Price</label>
              <input
                type="number"
                placeholder="Any"
                value={maxPrice || ''}
                onChange={(e) => setMaxPrice(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full p-2 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Min Lot Size (sqm)
            </label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={minLotSize || ''}
              onChange={(e) => setMinLotSize(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-full p-2 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-xs focus:outline-none"
            />
          </div>
        </aside>

        <div className="md:col-span-3 space-y-4">
          <div className="text-xs text-neutral-500 font-bold uppercase tracking-wider">
            Showing {filtered.length} of {properties.filter(isAvailable).length} listings
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-neutral-200/50 rounded-2xl shadow-xs">
              <Search className="w-10 h-10 text-neutral-300 mb-2" />
              <strong className="text-sm font-serif text-[#1C3A27]">No listings match filters</strong>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                Adjust your pricing ranges, location settings, or keyword text to match properties.
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-4 px-4 py-2 text-xs font-bold text-white bg-[#1C3A27] rounded-xl shadow cursor-pointer hover:bg-[#254F35] border-none"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((property) => (
                <PropertyCard key={property.id} property={property} onClick={onSelectProperty} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface BuyerSuggestionsProps {
  properties: PropertyListing[];
  buyerPrefs: BuyerPreferences | null;
  onSelectProperty: (property: PropertyListing) => void;
}

export const BuyerSuggestions: React.FC<BuyerSuggestionsProps> = ({
  properties,
  buyerPrefs,
  onSelectProperty,
}) => {
  const [sortCriteria, setSortCriteria] = useState<'score' | 'price' | 'location'>('score');

  const scoreProperty = (property: PropertyListing) => {
    let score = 0;
    const lotSize = getLotSize(property);

    if (!buyerPrefs) {
      if (property.type === 'Residential' || property.type === 'House & Lot') score += 30;
      else if (property.type === 'Agricultural') score += 20;
      else score += 10;
      if (property.price <= 6000000) score += 30;
      if (lotSize >= 500) score += 10;
      return Math.min(score, 100);
    }

    const budgetMin = buyerPrefs.budgetMin || 0;
    const budgetMax = buyerPrefs.budgetMax || Infinity;
    const minLotSize = buyerPrefs.minLotSize || 0;

    if (property.price >= budgetMin && property.price <= budgetMax) score += 35;
    else if (property.price <= budgetMax * 1.1) score += 18;
    else if (property.price < budgetMin) score += 12;

    if (buyerPrefs.landType && property.type === buyerPrefs.landType) score += 25;
    else if (!buyerPrefs.landType) score += 10;

    if (buyerPrefs.location) {
      const pref = buyerPrefs.location.toLowerCase();
      const loc = property.location.toLowerCase();
      if (loc.includes(pref) || pref.includes(loc.split(',')[0])) score += 20;
      else score += 4;
    } else {
      score += 10;
    }

    if (lotSize >= minLotSize) score += 12;
    else if (minLotSize > 0 && lotSize >= minLotSize * 0.85) score += 6;

    return Math.min(score, 100);
  };

  const scoredList = properties
    .filter(isAvailable)
    .map((property) => ({
      ...property,
      matchScore: scoreProperty(property),
    }));

  const sorted = [...scoredList].sort((a, b) => {
    if (sortCriteria === 'price') return a.price - b.price;
    if (sortCriteria === 'location') return a.location.localeCompare(b.location);
    return b.matchScore - a.matchScore;
  });

  return (
    <div className="max-w-[1500px] mx-auto px-8 py-10 space-y-6">
      <div className="border-b border-neutral-200/60 pb-4">
        <h2 className="font-serif text-3xl font-normal text-[#1C3A27]">Suggested For You</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Properties matched to your preferences and budget.
          {!buyerPrefs && ' Set your preferences for better matches.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pb-2">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Sort by:</span>
        {(
          [
            ['score', 'Best Match'],
            ['price', 'Lowest Price'],
            ['location', 'Location A-Z'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortCriteria(key)}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all border cursor-pointer ${
              sortCriteria === key
                ? 'bg-[#1C3A27] text-white border-transparent shadow-sm'
                : 'bg-white text-neutral-500 border-neutral-200 hover:border-emerald-300 hover:text-[#1C3A27]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-20 bg-white border border-neutral-200/50 rounded-2xl">
          <HelpCircle className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <strong className="text-sm font-serif text-[#1C3A27]">No suggestions currently</strong>
          <p className="text-xs text-neutral-400 mt-1">Check back later for new active listings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sorted.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isSuggested
              matchScore={property.matchScore}
              onClick={onSelectProperty}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface BuyerPreferencesViewProps {
  buyerPrefs: BuyerPreferences | null;
  onSavePrefs: (prefs: Omit<BuyerPreferences, 'userId' | 'timestamp'>) => void;
  onResetPrefs: () => void;
}

export const BuyerPreferencesView: React.FC<BuyerPreferencesViewProps> = ({
  buyerPrefs,
  onSavePrefs,
  onResetPrefs,
}) => {
  const [budgetMin, setBudgetMin] = useState<number>(buyerPrefs?.budgetMin || 100000);
  const [budgetMax, setBudgetMax] = useState<number>(buyerPrefs?.budgetMax || 5000000);
  const [landType, setLandType] = useState<PropertyListing['type'] | ''>(buyerPrefs?.landType || '');
  const [intendedUse, setIntendedUse] = useState<BuyerPreferences['intendedUse']>(
    buyerPrefs?.intendedUse || '',
  );
  const [location, setLocation] = useState<string>(buyerPrefs?.location || '');
  const [minLotSize, setMinLotSize] = useState<number>(buyerPrefs?.minLotSize || 0);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (buyerPrefs) {
      setBudgetMin(buyerPrefs.budgetMin);
      setBudgetMax(buyerPrefs.budgetMax);
      setLandType(buyerPrefs.landType);
      setIntendedUse(buyerPrefs.intendedUse);
      setLocation(buyerPrefs.location);
      setMinLotSize(buyerPrefs.minLotSize);
    }
  }, [buyerPrefs]);

  const handleBudgetMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (val > budgetMax) setBudgetMax(val);
    setBudgetMin(val);
  };

  const handleBudgetMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (val < budgetMin) setBudgetMin(val);
    setBudgetMax(val);
  };

  const handleSave = () => {
    onSavePrefs({
      budgetMin,
      budgetMax,
      landType,
      intendedUse,
      location,
      minLotSize,
    });
    setSavedMessage('Preferences saved successfully.');
    window.setTimeout(() => setSavedMessage(''), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-6">
      <div className="border-b border-neutral-200/60 pb-4">
        <h2 className="font-serif text-3xl font-normal text-[#1C3A27]">My Preferences</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Configure parameters used to formulate your matching scores and suggestions.
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-white border border-neutral-200/60 shadow-xs space-y-5">
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Preferred Budget Range
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-400">Min: {formatPrice(budgetMin)}</span>
              <input
                type="range"
                min="100000"
                max="50000000"
                step="100000"
                value={budgetMin}
                onChange={handleBudgetMinChange}
                className="w-full accent-[#1C3A27]"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-400">Max: {formatPrice(budgetMax)}</span>
              <input
                type="range"
                min="100000"
                max="50000000"
                step="100000"
                value={budgetMax}
                onChange={handleBudgetMaxChange}
                className="w-full accent-[#1C3A27]"
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-xs text-neutral-500 bg-[#F5F7F6] p-2 rounded-lg border border-neutral-100 font-medium">
            <span>{formatPrice(budgetMin)}</span>
            <span className="text-neutral-400">to</span>
            <span>{formatPrice(budgetMax)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Land Type Preference
            </label>
            <select
              value={landType}
              onChange={(e) => setLandType(e.target.value as PropertyListing['type'] | '')}
              className="w-full p-2.5 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-sm text-neutral-800 focus:outline-none focus:border-[#1C3A27]"
            >
              <option value="">Any</option>
              <option value="Residential">Residential</option>
              <option value="Agricultural">Agricultural</option>
              <option value="Commercial">Commercial</option>
              <option value="Condominium">Condominium</option>
              <option value="House & Lot">House & Lot</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Intended Use
            </label>
            <select
              value={intendedUse}
              onChange={(e) => setIntendedUse(e.target.value as BuyerPreferences['intendedUse'])}
              className="w-full p-2.5 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-sm text-neutral-800 focus:outline-none focus:border-[#1C3A27]"
            >
              <option value="">Any</option>
              <option value="Primary Residence">Primary Residence</option>
              <option value="Investment">Investment</option>
              <option value="Business">Business / Commercial</option>
              <option value="Farming">Farming / Agriculture</option>
              <option value="Vacation Home">Vacation Home</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Preferred Location Setting
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-2.5 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-sm text-neutral-800 focus:outline-none focus:border-[#1C3A27]"
            >
              <option value="">Any</option>
              <option value="Residential Neighborhood">Residential Neighborhood</option>
              <option value="Suburban Community">Suburban Community</option>
              <option value="City Center">City Center</option>
              <option value="Quiet Outskirts">Quiet Outskirts</option>
              <option value="Rural or Farm Area">Rural or Farm Area</option>
              <option value="Commercial District">Commercial District</option>
              <option value="Near Schools or Workplace">Near Schools or Workplace</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Minimum Lot Size (sqm)
            </label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={minLotSize || ''}
              onChange={(e) => setMinLotSize(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full p-2.5 bg-[#F5F7F6] border border-neutral-200 rounded-xl text-sm text-neutral-800 focus:outline-none focus:border-[#1C3A27]"
            />
          </div>
        </div>

        {savedMessage && (
          <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            {savedMessage}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={onResetPrefs}
            className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all border border-red-100 cursor-pointer"
          >
            Clear Preferences
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 text-xs font-bold text-white bg-[#1C3A27] rounded-xl hover:bg-[#254F35] shadow-md cursor-pointer border-none"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
