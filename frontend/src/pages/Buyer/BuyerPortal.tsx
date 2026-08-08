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
  Lock,
  X,
  Menu,
} from 'lucide-react';
import type { BuyerPreferences, Property } from '../../types/types';
import { WelcomeModal } from '../../components/Buyer/WelcomeModal';
import PropertyExplorer from '../../components/Shared/PropertyExplorerFixed';
import { PropertyDetails } from '../../components/Buyer/PropertyDetails';
import { BuyerSearch, BuyerSuggestions, BuyerPreferencesView } from './BuyerPages';
import {
  loadBuyerPreferences,
  removeBuyerPreferences,
  saveBuyerPreferences,
} from '../../services/buyerPrefs';
import { getProperties } from '../../services/PropertyService';
import {
  addInquiry,
  addSiteVisitRequest,
  getInquiriesForBuyer,
  getSiteVisitsForBuyer,
  INQUIRIES_STORAGE_KEY,
  SITE_VISITS_STORAGE_KEY,
} from '../../services/buyerActivityStorage';
import { notifyInquiry, notifySiteVisitRequest } from '../../services/notificationStorage';
import { getCurrentUser } from '../../services/AuthService';
import type { BuyerInquiry, SiteVisitRequest } from '../../types/types';

// ============================================================
// MATERIAL DESIGN COLOR PALETTE
// ============================================================
const COLORS = {
  // Primary colors
  primary: '#091413',      // Background - Darkest
  primaryVariant: '#0D1F1A', // Slightly lighter for cards
  primaryLight: '#285A48',  // Primary actions, buttons
  primaryMedium: '#408A71', // Hover states, accents
  primaryLightest: '#B0E4CC', // Highlights, badges, important elements
  
  // Surface colors (Material Design surfaces)
  surface: '#0D1F1A',
  surfaceVariant: '#122A20',
  surfaceElevated: '#1A3D2F',
  
  // Text colors (following Material Design contrast guidelines)
  textPrimary: '#FFFFFF',
  textSecondary: '#E8F5EF',
  textHint: '#B0E4CC',
  textDisabled: '#6A9F8A',
  
  // Status colors
  success: '#B0E4CC',
  warning: '#E4C7A0',
  error: '#E4A0A0',
  info: '#A0C4E4',
  
  // Elevation shadows (Material Design elevation levels)
  elevation1: '0 2px 4px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
  elevation2: '0 4px 8px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
  elevation4: '0 8px 16px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2)',
  elevation8: '0 16px 32px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.2)',
  elevation24: '0 32px 64px rgba(0,0,0,0.4), 0 16px 32px rgba(0,0,0,0.2)',
};

// ============================================================
// MATERIAL DESIGN COMPONENT STYLES
// ============================================================
const materialStyles = {
  // Surface styles
  surface: `
    background: ${COLORS.surface};
    border: 1px solid rgba(40, 90, 72, 0.2);
    box-shadow: ${COLORS.elevation1};
    border-radius: 12px;
  `,
  surfaceElevated: `
    background: ${COLORS.surfaceElevated};
    border: 1px solid rgba(40, 90, 72, 0.25);
    box-shadow: ${COLORS.elevation2};
    border-radius: 12px;
  `,
  
  // Button styles
  buttonPrimary: `
    background: ${COLORS.primaryLight};
    color: ${COLORS.textPrimary};
    border: none;
    border-radius: 8px;
    box-shadow: ${COLORS.elevation1};
    transition: all 0.2s ease;
    font-weight: 600;
    letter-spacing: 0.3px;
  `,
  buttonPrimaryHover: `
    background: ${COLORS.primaryMedium};
    box-shadow: ${COLORS.elevation4};
    transform: translateY(-1px);
  `,
  buttonSecondary: `
    background: transparent;
    color: ${COLORS.textSecondary};
    border: 1px solid rgba(40, 90, 72, 0.3);
    border-radius: 8px;
    transition: all 0.2s ease;
    font-weight: 500;
  `,
  buttonSecondaryHover: `
    background: rgba(40, 90, 72, 0.1);
    border-color: ${COLORS.primaryLight};
  `,
  
  // Input styles
  input: `
    background: ${COLORS.primary};
    color: ${COLORS.textPrimary};
    border: 1px solid rgba(40, 90, 72, 0.3);
    border-radius: 8px;
    transition: all 0.2s ease;
    padding: 10px 14px;
    font-size: 14px;
    width: 100%;
    outline: none;
  `,
  inputFocus: `
    border-color: ${COLORS.primaryLight};
    box-shadow: 0 0 0 3px rgba(40, 90, 72, 0.2);
  `,
  
  // Card styles
  card: `
    background: ${COLORS.surfaceVariant};
    border-radius: 12px;
    border: 1px solid rgba(40, 90, 72, 0.15);
    box-shadow: ${COLORS.elevation1};
    transition: all 0.3s ease;
  `,
  cardHover: `
    box-shadow: ${COLORS.elevation4};
    border-color: rgba(40, 90, 72, 0.3);
    transform: translateY(-2px);
  `,
  
  // Badge styles
  badge: `
    background: ${COLORS.primaryLight};
    color: ${COLORS.textPrimary};
    border-radius: 16px;
    padding: 2px 12px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  `,
  
  // Chip/Tag styles
  chip: `
    background: rgba(40, 90, 72, 0.15);
    color: ${COLORS.textSecondary};
    border-radius: 16px;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 500;
    border: 1px solid rgba(40, 90, 72, 0.15);
  `,
  
  // Divider
  divider: `
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(40, 90, 72, 0.3), transparent);
    margin: 16px 0;
  `,
};

//property card
// Property Card - LIGHT THEME VERSION
interface PropertyCardProps {
  property: Property;
  variant?: 'grid' | 'list' | 'compact' | 'featured';
  isSuggested?: boolean;
  onClick?: (property: Property) => void;
  className?: string;
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  variant = 'grid',
  isSuggested = false,
  onClick,
  className = '',
}) => {
  const variants = {
    grid: {
      containerClass: `bg-[#FFFFFF] rounded-xl overflow-hidden border border-[rgba(40,90,72,0.12)] shadow-sm transition-all duration-300 group cursor-pointer hover:shadow-md hover:border-[#285A48] hover:-translate-y-1`,
      image: 'h-48 w-full',
      content: 'p-4 flex-1 flex flex-col justify-between',
      price: 'text-sm font-bold text-[#1A2D24]',
      size: 'text-[11px] text-[#6A8A7A]',
      title: 'text-[#1A2D24]',
      location: 'text-[#5A7A6A]',
    },
    list: {
      containerClass: `bg-[#FFFFFF] rounded-xl overflow-hidden border border-[rgba(40,90,72,0.12)] shadow-sm transition-all duration-300 group cursor-pointer flex flex-row hover:shadow-md hover:border-[#285A48] hover:-translate-y-1`,
      image: 'h-48 w-48 shrink-0',
      content: 'p-4 flex-1 flex flex-col justify-between',
      price: 'text-base font-bold text-[#1A2D24]',
      size: 'text-xs text-[#6A8A7A]',
      title: 'text-[#1A2D24]',
      location: 'text-[#5A7A6A]',
    },
    compact: {
      containerClass: `bg-[#FFFFFF] rounded-lg overflow-hidden border border-[rgba(40,90,72,0.08)] shadow-sm transition-all duration-300 group cursor-pointer hover:shadow-md hover:border-[#285A48] hover:-translate-y-1`,
      image: 'h-32 w-full',
      content: 'p-3 flex-1 flex flex-col justify-between',
      price: 'text-xs font-bold text-[#1A2D24]',
      size: 'text-[10px] text-[#6A8A7A]',
      title: 'text-[#1A2D24]',
      location: 'text-[#5A7A6A]',
    },
    featured: {
      containerClass: `bg-[#FFFFFF] rounded-xl overflow-hidden border-2 border-[#285A48] shadow-md transition-all duration-300 group cursor-pointer hover:shadow-lg hover:-translate-y-1 relative`,
      image: 'h-56 w-full',
      content: 'p-5 flex-1 flex flex-col justify-between',
      price: 'text-lg font-bold text-[#1A2D24]',
      size: 'text-xs text-[#6A8A7A]',
      title: 'text-[#1A2D24]',
      location: 'text-[#5A7A6A]',
    },
  };

  const style = variants[variant] || variants.grid;

  return (
    <div 
      className={`${style.containerClass} ${className}`} 
      onClick={() => onClick?.(property)}
    >
      {variant === 'featured' && (
        <div className="absolute top-3 left-3 z-10 bg-[#285A48] text-[#FFFFFF] px-3 py-1 rounded-full text-[10px] font-bold shadow-md">
          ★ Featured
        </div>
      )}
      {isSuggested && (
        <div className="absolute top-3 left-3 z-10 bg-[#408A71] text-[#FFFFFF] px-3 py-1 rounded-full text-[10px] font-bold shadow-md">
          ✨ Suggested
        </div>
      )}

      <div className={`${style.image} bg-[#F5F2EF] overflow-hidden relative`}>
        {property.images?.[0] ? (
          <img
            src={property.images[0]}
            alt={property.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#A89884] text-xs">
            No Image
          </div>
        )}
        <div className="absolute top-3 right-3 bg-[#FFFFFF]/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] font-medium text-[#1A2D24] border border-[rgba(40,90,72,0.15)] shadow-sm">
          {property.type}
        </div>
      </div>

      <div className={style.content}>
        <div>
          <h3 className={`font-serif font-semibold text-base ${style.title} line-clamp-1 group-hover:text-[#285A48] transition-colors`}>
            {property.title ?? property.name}
          </h3>
          <p className={`text-xs ${style.location} mt-0.5 flex items-center gap-1`}>
            📍 {property.location}
          </p>
        </div>

        <div className={`mt-4 pt-3 border-t border-[rgba(40,90,72,0.1)] flex items-center justify-between ${variant === 'list' ? 'flex-wrap gap-2' : ''}`}>
          <span className={`${style.size} font-medium`}>
            📐 {property.size?.toLocaleString()} sqm
          </span>
          <span className={`${style.price}`}>
            ₱{property.price.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

type EmptyStateVariant = 'search' | 'filters' | 'recommendations' | 'inquiries' | 'sitevisits' | 'generic';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ElementType;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'generic',
  title,
  message,
  actionLabel,
  onAction,
  icon: CustomIcon,
  className = '',
}) => {
  const icons = {
    search: Search,
    filters: SlidersHorizontal,
    recommendations: Sparkles,
    inquiries: Mail,
    sitevisits: Calendar,
    generic: Search,
  };

  const defaultMessages = {
    search: { title: 'No listings match your search', message: 'Try adjusting your filters or search terms.' },
    filters: { title: 'No results with these filters', message: 'Try broadening your search criteria.' },
    recommendations: { title: 'No recommendations available', message: 'Set your preferences to get personalized matches.' },
    inquiries: { title: 'No inquiries yet', message: 'Send an inquiry about a property you\'re interested in.' },
    sitevisits: { title: 'No site visits scheduled', message: 'Request a site visit to view a property in person.' },
    generic: { title: 'Nothing to see here', message: 'Check back later for updates.' },
  };

  const Icon = CustomIcon || icons[variant] || icons.generic;
  const defaults = defaultMessages[variant] || defaultMessages.generic;

  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <div className="w-16 h-16 bg-[#0D1F1A] rounded-2xl flex items-center justify-center mb-4 border border-[rgba(40,90,72,0.15)] shadow-md">
        <Icon className="w-8 h-8 text-[#6A9F8A]" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-serif text-[#FFFFFF] font-semibold">
        {title || defaults.title}
      </h3>
      <p className="text-xs text-[#6A9F8A] mt-2 max-w-sm">
        {message || defaults.message}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-5 py-2.5 text-xs font-semibold text-[#FFFFFF] bg-[#285A48] rounded-lg hover:bg-[#408A71] transition-all shadow-md hover:shadow-lg border-none cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};


interface ViewRendererProps<T> {
  items: T[];
  viewType: 'grid' | 'list' | 'carousel';
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  className?: string;
  emptyState?: React.ReactNode;
  loading?: boolean;
  skeletonCount?: number;
}

function ViewRenderer<T>({
  items,
  viewType,
  renderItem,
  keyExtractor,
  className = '',
  emptyState,
  loading = false,
  skeletonCount = 6,
}: ViewRendererProps<T>) {
  const getGridClasses = () => {
    switch (viewType) {
      case 'grid':
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5';
      case 'list':
        return 'flex flex-col gap-4';
      case 'carousel':
        return 'flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[#285A48] scrollbar-track-transparent';
      default:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5';
    }
  };

  if (loading) {
    return (
      <div className={getGridClasses()}>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={i} className="bg-[#122A20] rounded-xl p-4 animate-pulse border border-[rgba(40,90,72,0.15)] shadow-md">
            <div className="h-48 bg-[#091413] rounded-lg mb-3" />
            <div className="h-4 bg-[#091413] rounded w-3/4 mb-2" />
            <div className="h-3 bg-[#091413] rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className={`${getGridClasses()} ${className}`}>
      {items.map((item, index) => (
        <div key={keyExtractor(item)} className={viewType === 'carousel' ? 'snap-start shrink-0 w-72' : ''}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}


const LoginRequiredModal: React.FC<{
  isOpen: boolean;
  featureName: string;
  onClose: () => void;
  onLogin: () => void;
}> = ({ isOpen, featureName, onClose, onLogin }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#091413]/90 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
      <div className="w-full max-w-md bg-[#0D1F1A] rounded-2xl p-6 relative border border-[rgba(40,90,72,0.2)] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-[#6A9F8A] hover:text-[#E8F5EF] transition-colors bg-transparent border-none cursor-pointer p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 bg-[#122A20] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[rgba(40,90,72,0.15)]">
          <Lock className="w-6 h-6 text-[#B0E4CC]" />
        </div>
        <h2 className="font-serif text-xl text-[#FFFFFF] text-center">Sign In Required</h2>
        <p className="text-sm text-[#6A9F8A] mt-2 text-center leading-relaxed">
          You need to log in or create an account to access {featureName.toLowerCase()}.
        </p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#E8F5EF] bg-transparent border border-[rgba(40,90,72,0.3)] hover:bg-[rgba(40,90,72,0.1)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold text-[#FFFFFF] bg-[#285A48] hover:bg-[#408A71] transition-colors shadow-md hover:shadow-lg border-none cursor-pointer"
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  );
};

const LogoutConfirmModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#091413]/90 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
      <div className="w-full max-w-md bg-[#0D1F1A] rounded-2xl p-6 relative border border-[rgba(40,90,72,0.2)] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-[#6A9F8A] hover:text-[#E8F5EF] transition-colors bg-transparent border-none cursor-pointer p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 bg-[#122A20] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[rgba(40,90,72,0.15)]">
          <LogOut className="w-6 h-6 text-[#B0E4CC]" />
        </div>
        <h2 className="font-serif text-xl text-[#FFFFFF] text-center">Log Out?</h2>
        <p className="text-sm text-[#6A9F8A] mt-2 text-center leading-relaxed">
          Are you sure you want to log out of your TerraGuide account?
        </p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#E8F5EF] bg-transparent border border-[rgba(40,90,72,0.3)] hover:bg-[rgba(40,90,72,0.1)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold text-[#FFFFFF] bg-[#A04040] hover:bg-[#C05050] transition-colors shadow-md hover:shadow-lg border-none cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

const SiteVisitModal: React.FC<{
  isOpen: boolean;
  propertyName: string;
  preferredDate: string;
  notes: string;
  onPreferredDateChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}> = ({
  isOpen,
  propertyName,
  preferredDate,
  notes,
  onPreferredDateChange,
  onNotesChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#091413]/90 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
      <div className="w-full max-w-md bg-[#0D1F1A] rounded-2xl p-6 relative border border-[rgba(40,90,72,0.2)] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-[#6A9F8A] hover:text-[#E8F5EF] transition-colors bg-transparent border-none cursor-pointer p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 bg-[#122A20] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[rgba(40,90,72,0.15)]">
          <Calendar className="w-6 h-6 text-[#B0E4CC]" />
        </div>
        <h2 className="font-serif text-xl text-[#FFFFFF] text-center">Request Site Visit</h2>
        <p className="text-sm text-[#6A9F8A] mt-2 text-center leading-relaxed">
          Schedule a visit for <span className="font-semibold text-[#E8F5EF]">{propertyName}</span>.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-[#6A9F8A] mb-1.5">
              Preferred Date
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => onPreferredDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-[#091413] text-[#E8F5EF] border border-[rgba(40,90,72,0.3)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#285A48] focus:shadow-[0_0_0_3px_rgba(40,90,72,0.2)] transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-[#6A9F8A] mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              placeholder="Any special requests or questions..."
              className="w-full bg-[#091413] text-[#E8F5EF] border border-[rgba(40,90,72,0.3)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#285A48] focus:shadow-[0_0_0_3px_rgba(40,90,72,0.2)] transition-all resize-none placeholder:text-[#6A9F8A]"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#E8F5EF] bg-transparent border border-[rgba(40,90,72,0.3)] hover:bg-[rgba(40,90,72,0.1)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!preferredDate}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold text-[#FFFFFF] bg-[#285A48] hover:bg-[#408A71] transition-colors shadow-md hover:shadow-lg border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
};

const InquiryModal: React.FC<{
  isOpen: boolean;
  propertyName: string;
  message: string;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}> = ({ isOpen, propertyName, message, onMessageChange, onClose, onSubmit }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#091413]/90 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
      <div className="w-full max-w-md bg-[#0D1F1A] rounded-2xl p-6 relative border border-[rgba(40,90,72,0.2)] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-[#6A9F8A] hover:text-[#E8F5EF] transition-colors bg-transparent border-none cursor-pointer p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 bg-[#122A20] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[rgba(40,90,72,0.15)]">
          <Mail className="w-6 h-6 text-[#B0E4CC]" />
        </div>
        <h2 className="font-serif text-xl text-[#FFFFFF] text-center">Send Inquiry</h2>
        <p className="text-sm text-[#6A9F8A] mt-2 text-center leading-relaxed">
          Ask about <span className="font-semibold text-[#E8F5EF]">{propertyName}</span>.
        </p>

        <div className="mt-5">
          <label className="block text-[10px] uppercase tracking-wider font-medium text-[#6A9F8A] mb-1.5">
            Your Message
          </label>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={4}
            placeholder="I'm interested in this property and would like to know more about..."
            className="w-full bg-[#091413] text-[#E8F5EF] border border-[rgba(40,90,72,0.3)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#285A48] focus:shadow-[0_0_0_3px_rgba(40,90,72,0.2)] transition-all resize-none placeholder:text-[#6A9F8A]"
          />
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#E8F5EF] bg-transparent border border-[rgba(40,90,72,0.3)] hover:bg-[rgba(40,90,72,0.1)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!message.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold text-[#FFFFFF] bg-[#285A48] hover:bg-[#408A71] transition-colors shadow-md hover:shadow-lg border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Inquiry
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN BUYER PORTAL COMPONENT
// ============================================================

const AUTH_REQUIRED_TABS = ['Suggested', 'Preferences', 'Inquiries', 'Site Visits'];
const RESTRICTED_TAB_LABELS: Record<string, string> = {
  Suggested: 'Suggested Properties',
  Preferences: 'Preferences',
  Inquiries: 'My Inquiries',
  'Site Visits': 'My Site Visits',
};

const mapHomeTypeToFilter = (propertyType: string) => {
  if (propertyType === 'All Types') return '';
  if (propertyType === 'Agricultural') return 'Agricultural';
  if (propertyType === 'Commercial') return 'Commercial';
  if (propertyType === 'Residential') return 'Residential';
  return '';
};

interface BuyerPortalProps {
  onGoToLogin?: () => void;
  onSignOut?: () => void;
  isAuthenticated?: boolean;
}

export const BuyerPortal: React.FC<BuyerPortalProps> = ({
  onGoToLogin,
  onSignOut,
  isAuthenticated = false,
}) => {
  const [activeTab, setActiveTab] = useState('Home');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [restrictedFeatureName, setRestrictedFeatureName] = useState('');
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
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [buyerPrefs, setBuyerPrefs] = useState<BuyerPreferences | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [visitPreferredDate, setVisitPreferredDate] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [buyerInquiries, setBuyerInquiries] = useState<BuyerInquiry[]>([]);
  const [buyerSiteVisits, setBuyerSiteVisits] = useState<SiteVisitRequest[]>([]);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const locationOptions = useMemo(
    () => [...new Set(properties.map((property) => property.location))].sort(),
    [properties],
  );

  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property);
    setIsMobileMenuOpen(false);
  };

  const handleClosePropertyDetails = () => {
    setSelectedProperty(null);
  };

  const handleRequestVisit = () => {
    if (!selectedProperty) return;
    if (!isAuthenticated) {
      setRestrictedFeatureName('Request Site Visit');
      setIsLoginModalOpen(true);
      return;
    }
    setVisitPreferredDate('');
    setVisitNotes('');
    setIsVisitModalOpen(true);
  };

  const handleSendInquiry = () => {
    if (!selectedProperty) return;
    if (!isAuthenticated) {
      setRestrictedFeatureName('Send Inquiry');
      setIsLoginModalOpen(true);
      return;
    }
    setInquiryMessage('');
    setIsInquiryModalOpen(true);
  };

  const handleSubmitSiteVisit = () => {
    if (!selectedProperty || !visitPreferredDate) return;

    const buyer = buyerUserId || buyerName || 'guest';
    const propertyName = selectedProperty.title ?? selectedProperty.name;
    const visit = addSiteVisitRequest({
      propertyId: selectedProperty.id,
      propertyName,
      buyer,
      preferredDate: visitPreferredDate,
      notes: visitNotes.trim(),
    });

    notifySiteVisitRequest(buyer, propertyName, visit.id);
    setBuyerSiteVisits(getSiteVisitsForBuyer(buyer));
    setIsVisitModalOpen(false);
    setActionFeedback('Site visit request submitted. An admin will contact you soon.');
  };

  const handleSubmitInquiry = () => {
    if (!selectedProperty || !inquiryMessage.trim()) return;

    const buyer = buyerUserId || buyerName || 'guest';
    const propertyName = selectedProperty.title ?? selectedProperty.name;
    const inquiry = addInquiry({
      propertyId: selectedProperty.id,
      propertyName,
      buyer,
      message: inquiryMessage.trim(),
    });

    notifyInquiry(buyer, propertyName, inquiry.id);
    setBuyerInquiries(getInquiriesForBuyer(buyer));
    setIsInquiryModalOpen(false);
    setActionFeedback('Inquiry sent successfully. Check My Inquiries for updates.');
  };

  const handleSearchApply = (query: string, loc: string, type: string, maxPrice: number) => {
    setSearchKeyword(query);
    setSearchLocation(loc);
    setSearchType(type);
    setSearchMaxPrice(maxPrice);
    setActiveTab('Search');
    setIsMobileMenuOpen(false);
  };

  const handleHeroSearch = () => {
    handleSearchApply(searchTerm, location, mapHomeTypeToFilter(propertyType), priceRange);
  };

  const handleQuickApply = () => {
    handleSearchApply('', location, mapHomeTypeToFilter(propertyType), priceRange);
  };

  const isTabLocked = (tabId: string) => !isAuthenticated && AUTH_REQUIRED_TABS.includes(tabId);

  const handleTabChange = (tabId: string) => {
    if (isTabLocked(tabId)) {
      setRestrictedFeatureName(RESTRICTED_TAB_LABELS[tabId] ?? tabId);
      setIsLoginModalOpen(true);
      return;
    }
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const handleLoginFromModal = () => {
    setIsLoginModalOpen(false);
    onGoToLogin?.();
  };

  const handleHeaderAuthClick = () => {
    if (isAuthenticated) {
      setIsLogoutConfirmOpen(true);
      return;
    }
    onGoToLogin?.();
  };

  const handleConfirmLogout = () => {
    setIsLogoutConfirmOpen(false);
    onSignOut?.();
  };

  const persistPreferences = async (
    prefsData: Omit<BuyerPreferences, 'userId' | 'timestamp'>
  ) => {
    if (!isAuthenticated) return;
    const userId = buyerUserId || buyerName || 'guest';

    try {
      const saved = await saveBuyerPreferences(userId, prefsData);
      setBuyerPrefs(saved);
    } catch (error) {
      setActionFeedback(
        error instanceof Error
          ? error.message
          : 'Could not save your preferences. Please try again.'
      );
      throw error;
    }
  };

  const handleResetPreferences = async () => {
    if (!isAuthenticated) return;
    const userId = buyerUserId || buyerName || 'guest';

    try {
      await removeBuyerPreferences(userId);
      setBuyerPrefs(null);
    } catch (error) {
      setActionFeedback(
        error instanceof Error
          ? error.message
          : 'Could not clear your preferences. Please try again.'
      );
    }
  };

  useEffect(() => {
    if (!actionFeedback) return;
    const timer = window.setTimeout(() => setActionFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  useEffect(() => {
    const syncBuyerActivity = () => {
      if (!isAuthenticated) {
        setBuyerInquiries([]);
        setBuyerSiteVisits([]);
        return;
      }
      const buyer = buyerUserId || buyerName || 'guest';
      setBuyerInquiries(getInquiriesForBuyer(buyer));
      setBuyerSiteVisits(getSiteVisitsForBuyer(buyer));
    };

    syncBuyerActivity();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === INQUIRIES_STORAGE_KEY ||
        event.key === SITE_VISITS_STORAGE_KEY ||
        event.key === null
      ) {
        syncBuyerActivity();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [isAuthenticated, buyerUserId, buyerName]);

  useEffect(() => {
    let isCancelled = false;

    const fetchProperties = async () => {
      setIsLoadingProperties(true);
      try {
        const fetched = await getProperties();
        if (isCancelled) return;
        setProperties(fetched);
      } catch (error) {
        if (isCancelled) return;
        setActionFeedback(
          error instanceof Error
            ? error.message
            : 'Could not load property listings. Please try again.'
        );
      } finally {
        if (!isCancelled) setIsLoadingProperties(false);
      }
    };

    fetchProperties();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsWelcomeModalOpen(false);
      setBuyerPrefs(null);
      setActiveTab((current) => (AUTH_REQUIRED_TABS.includes(current) ? 'Home' : current));
      return;
    }

    let isCancelled = false;

    const syncBuyerSession = async () => {
      let currentBuyerName = 'Valued Buyer';
      let currentUserId = 'guest';
      try {
        const currentUser = getCurrentUser();
        if (currentUser) {
          currentBuyerName = currentUser.username || currentUser.email || currentBuyerName;
          currentUserId = currentUser.username || currentUser.email || currentUserId;
        }
      } catch {
        currentBuyerName = 'Valued Buyer';
        currentUserId = 'guest';
      }

      if (isCancelled) return;
      setBuyerName(currentBuyerName);
      setBuyerUserId(currentUserId);

      try {
        const prefs = await loadBuyerPreferences(currentUserId);
        if (isCancelled) return;

        setBuyerPrefs(prefs);
        setIsWelcomeModalOpen(!prefs);
      } catch (error) {
        if (isCancelled) return;
        setBuyerPrefs(null);
        setActionFeedback(
          error instanceof Error
            ? error.message
            : 'Could not load your saved preferences.'
        );
      }
    };

    syncBuyerSession();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  if (selectedProperty) {
    const propertyName = selectedProperty.title ?? selectedProperty.name;
    return (
      <>
        <LoginRequiredModal
          isOpen={isLoginModalOpen}
          featureName={restrictedFeatureName}
          onClose={() => setIsLoginModalOpen(false)}
          onLogin={handleLoginFromModal}
        />
        <SiteVisitModal
          isOpen={isVisitModalOpen}
          propertyName={propertyName}
          preferredDate={visitPreferredDate}
          notes={visitNotes}
          onPreferredDateChange={setVisitPreferredDate}
          onNotesChange={setVisitNotes}
          onClose={() => setIsVisitModalOpen(false)}
          onSubmit={handleSubmitSiteVisit}
        />
        <InquiryModal
          isOpen={isInquiryModalOpen}
          propertyName={propertyName}
          message={inquiryMessage}
          onMessageChange={setInquiryMessage}
          onClose={() => setIsInquiryModalOpen(false)}
          onSubmit={handleSubmitInquiry}
        />
        {actionFeedback && (
          <div className="fixed bottom-6 right-6 z-[70] px-4 py-3 bg-[#0D1F1A] text-[#E8F5EF] text-sm font-medium rounded-xl shadow-2xl border border-[rgba(40,90,72,0.2)]">
            {actionFeedback}
          </div>
        )}
        <PropertyDetails
          property={selectedProperty}
          properties={properties}
          onBack={handleClosePropertyDetails}
          onRequestVisit={handleRequestVisit}
          onSendInquiry={handleSendInquiry}
        />
      </>
    );
  }

  const renderTabContent = () => {
    const effectiveTab = isTabLocked(activeTab) ? 'Home' : activeTab;

    switch (effectiveTab) {
      case 'Search':
        return (
          <BuyerSearch
            properties={properties}
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
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#0D1F1A] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[rgba(40,90,72,0.15)] shadow-md">
                <Mail className="w-8 h-8 text-[#6A9F8A]" />
              </div>
              <h2 className="font-serif text-2xl text-[#FFFFFF]">My Inquiries</h2>
            </div>
            {buyerInquiries.length === 0 ? (
              <EmptyState variant="inquiries" />
            ) : (
              <div className="space-y-3">
                {buyerInquiries.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    className="bg-[#0D1F1A] rounded-xl p-5 border border-[rgba(40,90,72,0.15)] shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif font-semibold text-[#FFFFFF]">{inquiry.propertyName}</h3>
                        <p className="text-xs text-[#6A9F8A] mt-1">
                          {new Date(inquiry.createdAt).toLocaleString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-[#285A48] text-[#FFFFFF]">
                        {inquiry.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#E8F5EF] mt-3">{inquiry.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'Site Visits':
        return (
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#0D1F1A] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[rgba(40,90,72,0.15)] shadow-md">
                <Calendar className="w-8 h-8 text-[#6A9F8A]" />
              </div>
              <h2 className="font-serif text-2xl text-[#FFFFFF]">My Site Visits</h2>
            </div>
            {buyerSiteVisits.length === 0 ? (
              <EmptyState variant="sitevisits" />
            ) : (
              <div className="space-y-3">
                {buyerSiteVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="bg-[#0D1F1A] rounded-xl p-5 border border-[rgba(40,90,72,0.15)] shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif font-semibold text-[#FFFFFF]">{visit.propertyName}</h3>
                        <p className="text-xs text-[#6A9F8A] mt-1">
                          Requested{' '}
                          {new Date(visit.createdAt).toLocaleString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-[#285A48] text-[#FFFFFF]">
                        {visit.status}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-[#E8F5EF] space-y-1">
                      <p>
                        <span className="font-semibold text-[#FFFFFF]">Preferred date:</span>{' '}
                        {new Date(visit.preferredDate).toLocaleDateString('en-PH', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      {visit.notes && (
                        <p>
                          <span className="font-semibold text-[#FFFFFF]">Notes:</span> {visit.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return (
          <>
            {/* Hero Section */}
            <section className="px-4 sm:px-6 pt-4 pb-2">
              <div className="max-w-[1500px] mx-auto bg-[#0D1F1A] rounded-[24px] pt-16 sm:pt-24 pb-20 sm:pb-28 px-4 sm:px-6 text-center relative overflow-hidden border border-[rgba(40,90,72,0.15)] shadow-xl">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(circle_at_center,_#B0E4CC_0%,_transparent_70%)]" />
                
               <span className="text-[10px] font-medium tracking-[0.25em] text-[#6A9F8A] uppercase">
  Find Where Life Happens
</span>

                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight leading-tight max-w-3xl mx-auto relative z-10 text-[#B0E4CC]">
  Discover Your <span className="italic font-light text-[#E4B028]">Perfect</span> Property
</h1>

                <p className="text-[#6A9F8A] text-xs md:text-sm max-w-xl mx-auto mt-4 font-normal leading-relaxed relative z-10">
                  Browse premium residential lots, agriculture farmland, and industrial developments curated for
                  your preferences.
                </p>

                <div className="max-w-2xl mx-auto mt-10 p-1.5 rounded-xl flex items-center shadow-lg relative z-10 bg-[#091413] border border-[rgba(40,90,72,0.2)]">
                  <div className="pl-4 pr-2 text-[#6A9F8A]">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by location, keyword or zone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleHeroSearch()}
                    className="w-full bg-transparent border-none text-[#E8F5EF] placeholder:text-[#6A9F8A] text-xs md:text-sm focus:outline-none py-2"
                  />
                 <button
  type="button"
  onClick={handleHeroSearch}
  className="px-9 py-2.5 rounded-lg text-xs font-semibold text-[#FFFFFF] bg-[#285A48] hover:bg-[#408A71] transition-all shadow-md hover:shadow-lg cursor-pointer shrink-0 border-2 border-black hover:translate-x-[-0.05em] hover:translate-y-[-0.05em] active:translate-x-[0.05em] active:translate-y-[0.05em]"
>
  Search
</button>
                </div>
              </div>
            </section>



            {/* Quick Filters */}
<section className="px-4 sm:px-6 -mt-0 relative z-20">
  <div className="max-w-5xl mx-auto bg-[#FFFFFF] rounded-xl p-4 shadow-lg border border-[rgba(40,90,72,0.1)]">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase tracking-wider font-medium text-[#5A7A6A]">
          Location
        </label>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full bg-[#F5F2EF] text-[#1A2D24] border border-[rgba(40,90,72,0.15)] rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#285A48] focus:shadow-[0_0_0_3px_rgba(40,90,72,0.15)] transition-all"
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
        <label className="text-[10px] uppercase tracking-wider font-medium text-[#5A7A6A]">
          Property Type
        </label>
        <select
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
          className="w-full bg-[#F5F2EF] text-[#1A2D24] border border-[rgba(40,90,72,0.15)] rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#285A48] focus:shadow-[0_0_0_3px_rgba(40,90,72,0.15)] transition-all"
        >
          <option>All Types</option>
          <option>Residential</option>
          <option>Agricultural</option>
          <option>Commercial</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[10px] uppercase tracking-wider font-medium text-[#5A7A6A]">
          <span>Price Range</span>
          <span className="text-[#1A2D24] font-semibold">
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
          className="w-full accent-[#285A48] cursor-pointer mt-1"
          style={{
            background: `linear-gradient(to right, #285A48 0%, #285A48 ${(priceRange / 50000000) * 100}%, #D4C9B8 ${(priceRange / 50000000) * 100}%, #D4C9B8 100%)`,
            height: '4px',
            borderRadius: '4px',
          }}
        />
      </div>

      <button
        type="button"
        onClick={handleQuickApply}
        className="w-full py-2.5 rounded-lg text-xs font-semibold text-[#FFFFFF] bg-[#285A48] hover:bg-[#408A71] transition-all shadow-md hover:shadow-lg cursor-pointer h-[38px] border-none"
      >
        Apply Quick Filters
      </button>
    </div>
  </div>
</section>
            {/* Featured Properties */}
            <section className="max-w-[1500px] mx-auto px-4 sm:px-8 pt-12 sm:pt-16 pb-16 sm:pb-20">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-[rgba(40,90,72,0.2)]">
                <h2 className="font-serif text-2xl md:text-3xl font-normal text-[#1A2D24]">
                  Featured Properties
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('Search')}
                  className="text-xs font-semibold text-[#285A48] hover:text-[#408A71] flex items-center gap-1 transition-all group bg-transparent border-none cursor-pointer"
                >
                  View all listings
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              <ViewRenderer
                items={properties.slice(0, 4)}
                viewType="grid"
                renderItem={(property) => (
                  <PropertyCard
                    property={property}
                    variant="grid"
                    onClick={handleSelectProperty}
                  />
                )}
                keyExtractor={(property) => property.id}
                emptyState={<EmptyState variant="filters" />}
                loading={isLoadingProperties}
              />
            </section>

            {/* Map & Documents */}
            <section className="max-w-[1500px] mx-auto px-4 sm:px-8 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-4 border-b border-[rgba(40,90,72,0.2)]">
                  <div>
                    <h2 className="font-serif text-2xl font-normal text-[#1A2D24]">Interactive Map</h2>
                    <p className="text-xs text-[#5C7A6E] mt-1">
                      Explore property boundaries and nearby landmarks.
                    </p>
                  </div>
                </div>

                <div className="bg-[#0D1F1A] p-2 rounded-xl shadow-md border border-[rgba(40,90,72,0.15)] h-[500px] w-full relative z-10 overflow-hidden">
                  <div className="w-full h-full rounded-lg overflow-hidden">
                    <PropertyExplorer 
                      properties={properties} 
                      onSelectProperty={(id) => {
                        const p = properties.find((x) => x.id === id);
                        if (p) handleSelectProperty(p);
                      }} 
                      focusProperty={null} 
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-4 border-b border-[rgba(40,90,72,0.2)]">
                  <div>
                    <h2 className="font-serif text-2xl font-normal text-[#1A2D24]">Active Documents</h2>
                    <p className="text-xs text-[#5C7A6E] mt-1">Track your ongoing transactions.</p>
                  </div>
                </div>

                <div className="bg-[#0D1F1A] rounded-xl p-5 flex flex-col gap-3 shadow-md border border-[rgba(40,90,72,0.15)]">
                  {[
                    { id: 1, name: 'Letter of Intent - Balayan Plot', status: 'Approved', date: 'Today, 9:00 AM' },
                    { id: 2, name: 'Deed of Sale Draft', status: 'In Progress', date: 'Yesterday' },
                    { id: 3, name: 'Site Tripping Waiver', status: 'Pending Review', date: 'Oct 12, 2024' },
                  ].map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-[#091413] rounded-lg border border-[rgba(40,90,72,0.1)] flex flex-col gap-2 hover:border-[rgba(40,90,72,0.3)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-[#E8F5EF] leading-tight">{doc.name}</h4>
                        <span
                          className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                            doc.status === 'Approved'
                              ? 'bg-[#B0E4CC]/20 text-[#B0E4CC] border border-[#B0E4CC]/30'
                              : doc.status === 'In Progress'
                                ? 'bg-[#E4C7A0]/20 text-[#E4C7A0] border border-[#E4C7A0]/30'
                                : 'bg-[#6A9F8A]/20 text-[#6A9F8A] border border-[#6A9F8A]/30'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#6A9F8A] font-medium">Last updated: {doc.date}</p>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="mt-2 w-full py-2.5 rounded-lg border border-dashed border-[rgba(40,90,72,0.3)] text-xs font-medium text-[#6A9F8A] hover:text-[#E8F5EF] hover:border-[#408A71] hover:bg-[rgba(40,90,72,0.05)] transition-all cursor-pointer bg-transparent"
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
      <LoginRequiredModal
        isOpen={isLoginModalOpen}
        featureName={restrictedFeatureName}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLoginFromModal}
      />
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
      />

      <WelcomeModal
        isOpen={isWelcomeModalOpen}
        onClose={() => setIsWelcomeModalOpen(false)}
        buyerName={buyerName}
        onSavePreferences={persistPreferences}
      />

<div className="min-h-screen bg-[#F6F7F9] text-[#1A2D24] font-sans antialiased selection:bg-[#285A48] selection:text-[#FFFFFF]">        {/* Header */}
        <header className="sticky top-0 z-50 bg-[#0D1F1A]/95 backdrop-blur-sm border-b border-[rgba(40,90,72,0.15)] px-4 sm:px-8 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <div className="bg-[#B0E4CC] text-[#091413] w-8 h-8 rounded-lg flex items-center justify-center font-serif text-lg font-bold shadow-md">
              T
            </div>
            <span className="font-serif font-bold text-xl tracking-tight text-[#FFFFFF]">TerraGuide</span>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden text-[#E8F5EF] hover:text-[#B0E4CC] transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 p-1 bg-[#091413] rounded-xl border border-[rgba(40,90,72,0.15)] shadow-inner">
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
              const locked = isTabLocked(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id)}
                  title={locked ? 'Sign in to access this feature' : undefined}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 border-none ${
                    locked 
                      ? `opacity-60 text-[#6A9F8A] ${isActive ? 'bg-[#122A20]' : 'bg-transparent'}`
                      : isActive
                        ? 'bg-[#285A48] text-[#FFFFFF] shadow-md font-semibold'
                        : 'text-[#6A9F8A] hover:text-[#E8F5EF] hover:bg-[rgba(40,90,72,0.1)] bg-transparent'
                  }`}
                >
                  {locked ? <Lock className="w-3 h-3" /> : <Icon className="w-3.5 h-3.5" />}
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              className="text-xs font-medium text-[#6A9F8A] hover:text-[#E8F5EF] cursor-pointer underline decoration-dotted underline-offset-4 bg-transparent border-none"
            >
              Staff Portal
            </button>
            <button
              type="button"
              onClick={handleHeaderAuthClick}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold text-[#FFFFFF] bg-[#285A48] hover:bg-[#408A71] transition-all shadow-md hover:shadow-lg border-none cursor-pointer"
            >
              <LogOut className={`w-3.5 h-3.5 ${isAuthenticated ? '' : 'rotate-180'}`} />
              <span className="hidden xs:inline">{isAuthenticated ? 'Logout' : 'Sign In'}</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[#0D1F1A] border-b border-[rgba(40,90,72,0.15)] p-4 shadow-md">
            <div className="flex flex-col gap-1">
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
                const locked = isTabLocked(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabChange(item.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all w-full text-left ${
                      locked 
                        ? `opacity-60 text-[#6A9F8A]`
                        : isActive
                          ? 'bg-[#285A48] text-[#FFFFFF] shadow-md'
                          : 'text-[#6A9F8A] hover:text-[#E8F5EF] hover:bg-[rgba(40,90,72,0.1)]'
                    }`}
                  >
                    {locked ? <Lock className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isLoadingProperties && properties.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-[#5C7A6E]">
            Loading property listings...
          </div>
        ) : (
          renderTabContent()
        )}
      </div>
    </>
  );
};

export default BuyerPortal;