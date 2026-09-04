import React, { useEffect, useRef, useState } from 'react';
import { Search, Sliders, HelpCircle, X, Filter, RotateCcw } from 'lucide-react';
import type { Property as PropertyListing, BuyerPreferences } from '../../types/types';
import { PropertyCard } from '../../components/Buyer/PropertyCard';
import { getLotSize } from '../../services/buyerPrefs';
import { getRecommendations } from '../../services/RecommendationService';

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

const isAvailable = (property: PropertyListing) => property.status === 'Available';

const getUniqueLocations = (properties: PropertyListing[]) =>
  [...new Set(properties.map((property) => property.location))].sort();

const getUniqueTypes = (properties: PropertyListing[]) =>
  [...new Set(properties.map((property) => property.type))].sort();

interface BuyerSearchProps {
  properties: PropertyListing[];
  onSelectProperty: (property: PropertyListing) => void;
  keyword: string;
  location: string;
  type: string;
  minPrice: number | '';
  maxPrice: number | '';
  minLotSize: number | '';
  onKeywordChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onMinPriceChange: (value: number | '') => void;
  onMaxPriceChange: (value: number | '') => void;
  onMinLotSizeChange: (value: number | '') => void;
  onClearFilters: () => void;
}

export const BuyerSearch: React.FC<BuyerSearchProps> = ({
  properties,
  onSelectProperty,
  keyword,
  location,
  type,
  minPrice,
  maxPrice,
  minLotSize,
  onKeywordChange,
  onLocationChange,
  onTypeChange,
  onMinPriceChange,
  onMaxPriceChange,
  onMinLotSizeChange,
  onClearFilters,
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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

  const hasActiveFilters = keyword || location || type || minPrice || maxPrice || minLotSize;

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <div className="border-b border-[#e8e0d5] pb-4">
        <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#1C3A27]">Search Properties</h2>
        <p className="text-xs text-[#7c6a57] mt-1">
          Filter through verified residential, agricultural, and commercial developments.
        </p>
      </div>

      {/* Mobile Filter Toggle */}
      <button
        onClick={() => setIsFilterOpen(!isFilterOpen)}
        className="md:hidden flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-[#d6c7b2] text-sm font-medium text-[#1C3A27]"
      >
        <Filter className="w-4 h-4" />
        Filters
        {hasActiveFilters && (
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </button>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Filters - Desktop always visible, Mobile toggle */}
        <aside className={`
          p-5 rounded-2xl bg-white border border-[#d6c7b2] shadow-sm space-y-4 md:col-span-1
          ${isFilterOpen ? 'block' : 'hidden md:block'}
        `}>
          <div className="flex justify-between items-center border-b border-[#e8e0d5] pb-2">
            <strong className="text-xs font-bold uppercase tracking-wider text-[#7c6a57] flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-600" />
              Filters
            </strong>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-transparent border-none cursor-pointer flex items-center gap-1"
              >
                  <RotateCcw className="w-3 h-3" />
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsFilterOpen(false)}
                className="md:hidden text-[#7c6a57] hover:text-[#1C3A27] bg-transparent border-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57]">Keyword</label>
              <input
                type="text"
                placeholder="Search name, location..."
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors placeholder:text-[#a89884]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57]">Location</label>
              <select
                value={location}
                onChange={(e) => onLocationChange(e.target.value)}
                className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors"
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57]">Property Type</label>
              <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value)}
                className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors"
              >
                <option value="">All Types</option>
                {typeOptions.map((propertyType) => (
                  <option key={propertyType} value={propertyType}>
                    {propertyType}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#7c6a57]">Min Price</label>
                <input
                  type="number"
                  placeholder="0"
                  value={minPrice || ''}
                  onChange={(e) => onMinPriceChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors placeholder:text-[#a89884]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#7c6a57]">Max Price</label>
                <input
                  type="number"
                  placeholder="Any"
                  value={maxPrice || ''}
                  onChange={(e) => onMaxPriceChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors placeholder:text-[#a89884]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57]">
                Min Lot Size (sqm)
              </label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={minLotSize || ''}
                onChange={(e) => onMinLotSizeChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors placeholder:text-[#a89884]"
              />
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#7c6a57] font-medium">
              Showing <span className="font-bold text-[#1C3A27]">{filtered.length}</span> of{' '}
              {properties.filter(isAvailable).length} listings
            </span>
            {hasActiveFilters && (
              <span className="text-[10px] text-[#7c6a57] bg-[#f0ebe3] px-3 py-1 rounded-full">
                {Object.values({ keyword, location, type, minPrice, maxPrice, minLotSize }).filter(Boolean).length} filters active
              </span>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-[#d6c7b2] rounded-2xl shadow-sm">
              <div className="w-16 h-16 rounded-full bg-[#f0ebe3] flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-[#a89884]" />
              </div>
              <strong className="text-lg font-serif text-[#1C3A27]">No listings match your filters</strong>
              <p className="text-xs text-[#7c6a57] mt-2 max-w-xs">
                Adjust your pricing ranges, location settings, or keyword text to find more properties.
              </p>
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-5 px-5 py-2.5 text-xs font-bold text-white bg-[#1C3A27] rounded-xl shadow-sm hover:bg-[#254F35] transition-colors border-none cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
  buyerPrefs: BuyerPreferences | null;
  onSelectProperty: (property: PropertyListing) => void;
}

export const BuyerSuggestions: React.FC<BuyerSuggestionsProps> = ({
  buyerPrefs,
  onSelectProperty,
}) => {
  const [sortCriteria, setSortCriteria] = useState<'recommended' | 'price' | 'location'>('recommended');
  const [recommended, setRecommended] = useState<PropertyListing[]>([]);
  const [hasPreferences, setHasPreferences] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    const fetchRecommendations = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const result = await getRecommendations();
        if (isCancelled) return;
        setRecommended(result.properties);
        setHasPreferences(result.hasPreferences);
      } catch (error) {
        if (isCancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load your recommendations. Please try again.'
        );
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    fetchRecommendations();

    return () => {
      isCancelled = true;
    };
  }, [buyerPrefs]);

  const sorted = [...recommended].sort((a, b) => {
    if (sortCriteria === 'price') return a.price - b.price;
    if (sortCriteria === 'location') return a.location.localeCompare(b.location);
    return 0;
  });

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
      <div className="border-b border-[#e8e0d5] pb-4">
        <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#1C3A27]">Suggested For You</h2>
        <p className="text-xs text-[#7c6a57] mt-1">
          Properties matched to your preferences and budget.
          {!hasPreferences && ' Set your preferences for better matches.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-2">
        <span className="text-xs font-bold text-[#7c6a57] uppercase tracking-wider">Sort by:</span>
        {(
          [
            ['recommended', 'Recommended'],
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
                : 'bg-white text-[#7c6a57] border-[#d6c7b2] hover:border-[#1C3A27] hover:text-[#1C3A27]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 bg-white border border-[#d6c7b2] rounded-2xl">
          <div className="w-8 h-8 border-4 border-[#d6c7b2] border-t-[#1C3A27] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#7c6a57]">Loading your recommendations...</p>
        </div>
      ) : loadError ? (
        <div className="text-center py-16 bg-white border border-[#d6c7b2] rounded-2xl">
          <HelpCircle className="w-10 h-10 text-[#a89884] mx-auto mb-3" />
          <strong className="text-sm font-serif text-[#1C3A27]">Couldn't load recommendations</strong>
          <p className="text-xs text-[#7c6a57] mt-1">{loadError}</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#d6c7b2] rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-[#f0ebe3] flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-[#a89884]" />
          </div>
          <strong className="text-lg font-serif text-[#1C3A27]">
            {hasPreferences ? 'No suggestions available' : 'Set your preferences'}
          </strong>
          <p className="text-xs text-[#7c6a57] mt-2 max-w-sm mx-auto">
            {hasPreferences
              ? 'Check back later for new active listings matching your criteria.'
              : 'Set your preferences to start getting matched properties.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {sorted.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isSuggested
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
  onSavePrefs: (prefs: Omit<BuyerPreferences, 'userId' | 'timestamp'>) => Promise<void> | void;
  onResetPrefs: () => Promise<void> | void;
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
  const [isSaving, setIsSaving] = useState(false);
  
  const hasUserEditedRef = useRef(false);

  useEffect(() => {
    if (buyerPrefs && !hasUserEditedRef.current) {
      setBudgetMin(buyerPrefs.budgetMin);
      setBudgetMax(buyerPrefs.budgetMax);
      setLandType(buyerPrefs.landType);
      setIntendedUse(buyerPrefs.intendedUse);
      setLocation(buyerPrefs.location);
      setMinLotSize(buyerPrefs.minLotSize);
    }
  }, [buyerPrefs]);

  const markEdited = () => {
    hasUserEditedRef.current = true;
  };

  const handleBudgetMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    markEdited();
    const val = parseInt(e.target.value, 10);
    if (val > budgetMax) setBudgetMax(val);
    setBudgetMin(val);
  };

  const handleBudgetMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    markEdited();
    const val = parseInt(e.target.value, 10);
    if (val < budgetMin) setBudgetMin(val);
    setBudgetMax(val);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSavePrefs({
        budgetMin,
        budgetMax,
        landType,
        intendedUse,
        location,
        minLotSize,
      });
      hasUserEditedRef.current = false;
      setSavedMessage('Preferences saved successfully.');
      window.setTimeout(() => setSavedMessage(''), 2500);
    } catch {
      // Error feedback is already surfaced by the parent via actionFeedback.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
      <div className="border-b border-[#e8e0d5] pb-4">
        <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#1C3A27]">My Preferences</h2>
        <p className="text-xs text-[#7c6a57] mt-1">
          Configure parameters used to formulate your matching scores and suggestions.
        </p>
      </div>

      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#d6c7b2] shadow-sm space-y-5">
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#7c6a57]">
            Preferred Budget Range
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-[#7c6a57]">Min: {formatPrice(budgetMin)}</span>
              <input
                type="range"
                min="100000"
                max="50000000"
                step="100000"
                value={budgetMin}
                onChange={handleBudgetMinChange}
                className="w-full accent-[#1C3A27] cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[#7c6a57]">Max: {formatPrice(budgetMax)}</span>
              <input
                type="range"
                min="100000"
                max="50000000"
                step="100000"
                value={budgetMax}
                onChange={handleBudgetMaxChange}
                className="w-full accent-[#1C3A27] cursor-pointer"
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-xs text-[#7c6a57] bg-[#F5F7F6] p-2.5 rounded-xl border border-[#e8e0d5] font-medium">
            <span className="font-bold text-[#1C3A27]">{formatPrice(budgetMin)}</span>
            <span className="text-[#a89884]">to</span>
            <span className="font-bold text-[#1C3A27]">{formatPrice(budgetMax)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#7c6a57]">
              Land Type Preference
            </label>
            <select
              value={landType}
              onChange={(e) => {
                markEdited();
                setLandType(e.target.value as PropertyListing['type'] | '');
              }}
              className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-[#7c6a57]">
              Intended Use
            </label>
            <select
              value={intendedUse}
              onChange={(e) => {
                markEdited();
                setIntendedUse(e.target.value as BuyerPreferences['intendedUse']);
              }}
              className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-[#7c6a57]">
              Preferred Location Setting
            </label>
            <select
              value={location}
              onChange={(e) => {
                markEdited();
                setLocation(e.target.value);
              }}
              className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-[#7c6a57]">
              Minimum Lot Size (sqm)
            </label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={minLotSize || ''}
              onChange={(e) => {
                markEdited();
                setMinLotSize(Math.max(0, parseInt(e.target.value, 10) || 0));
              }}
              className="w-full p-2.5 bg-[#F5F7F6] border border-[#d6c7b2] rounded-xl text-sm text-[#1C3A27] focus:outline-none focus:border-[#1C3A27] transition-colors placeholder:text-[#a89884]"
            />
          </div>
        </div>

        {savedMessage && (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            {savedMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e8e0d5]">
          <button
            type="button"
            onClick={onResetPrefs}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors border border-rose-200 cursor-pointer"
          >
            Clear Preferences
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 text-xs font-bold text-white bg-[#1C3A27] rounded-xl hover:bg-[#254F35] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors border-none cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
};
