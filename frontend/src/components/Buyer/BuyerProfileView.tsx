import React, { useRef, useState } from 'react';
import { Camera, CheckCircle2, AlertCircle, SlidersHorizontal, Pencil, X } from 'lucide-react';
import type { BuyerPreferences } from '../../types/types';
import type { User } from '../../services/AuthService';
import { uploadMyProfilePicture, updateMyProfile } from '../../services/AuthService';
import { ApiError } from '../../utils/api';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';
import { UserAvatar } from '../Shared/UserAvatar';

interface BuyerProfileViewProps {
  user: User | null;
  buyerPrefs: BuyerPreferences | null;
  isPreferencesLoading: boolean;
  onProfileUpdated: (user: User) => void;
  onEditPreferences: () => void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const CONTACT_NUMBER_PATTERN = /^[0-9+\-\s()]{7,20}$/;

type ProfileFieldErrors = Partial<Record<'fullName' | 'username' | 'contactNumber' | 'address', string>>;

const readable = (value: string | null | undefined, fallback = 'Not provided') => {
  if (!value || !value.trim()) return fallback;
  return value.trim();
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not provided';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not provided';
  return parsed.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatBudgetRange = (min?: number | null, max?: number | null) => {
  const hasMin = typeof min === 'number' && Number.isFinite(min) && min > 0;
  const hasMax = typeof max === 'number' && Number.isFinite(max) && max > 0;
  if (hasMin && hasMax) {
    return `₱${Math.round(min).toLocaleString()} – ₱${Math.round(max).toLocaleString()}`;
  }
  if (hasMin) return `From ₱${Math.round(min).toLocaleString()}`;
  if (hasMax) return `Up to ₱${Math.round(max).toLocaleString()}`;
  return 'Not specified';
};

const formatLotSize = (minLotSize?: number | null) => {
  if (typeof minLotSize !== 'number' || !Number.isFinite(minLotSize) || minLotSize <= 0) {
    return 'Not specified';
  }
  return `${Math.round(minLotSize).toLocaleString()} sqm`;
};

export const BuyerProfileView: React.FC<BuyerProfileViewProps> = ({
  user,
  buyerPrefs,
  isPreferencesLoading,
  onProfileUpdated,
  onEditPreferences,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [saveError, setSaveError] = useState('');
  const [profileSaveSuccess, setProfileSaveSuccess] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleCloseEditModal = () => {
    if (isSavingProfile) return;
    setIsEditModalOpen(false);
    setFieldErrors({});
    setSaveError('');
  };

  const editModalRef = useModalAccessibility({
    isOpen: isEditModalOpen,
    onClose: handleCloseEditModal,
  });

  const handleOpenEditModal = () => {
    setEditFullName(user?.fullName || '');
    setEditUsername(user?.username || '');
    setEditContactNumber(user?.contactNumber || '');
    setEditAddress(user?.address || '');
    setFieldErrors({});
    setSaveError('');
    setProfileSaveSuccess('');
    setIsEditModalOpen(true);
  };

  const validateProfileForm = (): ProfileFieldErrors => {
    const errors: ProfileFieldErrors = {};
    const trimmedName = editFullName.trim();
    const trimmedUsername = editUsername.trim().toLowerCase();
    const trimmedAddress = editAddress.trim();
    const trimmedContact = editContactNumber.trim();

    if (!trimmedName) {
      errors.fullName = 'Full name is required.';
    }
    if (!trimmedUsername) {
      errors.username = 'Username is required.';
    } else if (trimmedUsername.length < 3) {
      errors.username = 'Username must be at least 3 characters long.';
    } else if (!USERNAME_PATTERN.test(trimmedUsername)) {
      errors.username = 'Username can only contain letters, numbers, and underscores.';
    }
    if (!trimmedAddress) {
      errors.address = 'Address is required.';
    }
    if (trimmedContact && !CONTACT_NUMBER_PATTERN.test(trimmedContact)) {
      errors.contactNumber = 'Please enter a valid contact number (7–20 digits or standard phone characters).';
    }
    return errors;
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSavingProfile) return;

    const validationErrors = validateProfileForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setSaveError('Please fix the highlighted fields before saving.');
      return;
    }

    setFieldErrors({});
    setSaveError('');
    setIsSavingProfile(true);

    try {
      const updatedUser = await updateMyProfile({
        fullName: editFullName.trim(),
        username: editUsername.trim().toLowerCase(),
        contactNumber: editContactNumber.trim() || null,
        address: editAddress.trim(),
      });
      onProfileUpdated(updatedUser);
      setIsEditModalOpen(false);
      setProfileSaveSuccess('Profile information updated successfully.');
    } catch (error) {
      if (error instanceof ApiError && error.details) {
        const nextFieldErrors: ProfileFieldErrors = {};
        for (const key of ['fullName', 'username', 'contactNumber', 'address'] as const) {
          const val = error.details[key];
          if (typeof val === 'string' && val.trim()) {
            nextFieldErrors[key] = val;
          }
        }
        if (Object.keys(nextFieldErrors).length > 0) {
          setFieldErrors(nextFieldErrors);
        }
      }
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Could not update your profile information. Please try again.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const displayName = readable(user?.fullName, user?.username || 'Valued Buyer');

  const handleSelectFileClick = () => {
    setUploadError('');
    setUploadSuccess('');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError('');
    setUploadSuccess('');

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setUploadError('Only JPG, JPEG, and PNG images are supported.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError('Profile picture must be 5 MB or smaller.');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadMyProfilePicture(file);
      if (result.user) {
        onProfileUpdated(result.user);
      }
      setUploadSuccess('Profile picture updated successfully.');
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Could not upload profile picture. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const preferenceRows = [
    {
      label: 'Budget',
      value: buyerPrefs ? formatBudgetRange(buyerPrefs.budgetMin, buyerPrefs.budgetMax) : 'Not specified',
    },
    {
      label: 'Property Type',
      value: readable(buyerPrefs?.landType, 'Not specified'),
    },
    {
      label: 'Intended Use',
      value: readable(buyerPrefs?.intendedUse, 'Not specified'),
    },
    {
      label: 'Location',
      value: readable(buyerPrefs?.location, 'Not specified'),
    },
    {
      label: 'Minimum Lot Size',
      value: buyerPrefs ? formatLotSize(buyerPrefs.minLotSize) : 'Not specified',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
      <div className="border-b border-[#e8e0d5] pb-4">
        <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#1C3A27]">My Profile</h2>
        <p className="text-xs text-[#7c6a57] mt-1">
          View your buyer account details, profile picture, and saved property preferences.
        </p>
      </div>

      {/* Section A: Profile Header */}
      <section
        aria-labelledby="buyer-profile-header-heading"
        className="rounded-2xl bg-white border border-[#d6c7b2] p-5 sm:p-6 shadow-sm"
      >
        <h3 id="buyer-profile-header-heading" className="sr-only">Profile Header</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <UserAvatar
              src={user?.profilePictureUrl}
              name={displayName}
              size="xl"
              className="ring-2 ring-[#B0E4CC]/70 shadow-sm"
            />
            <div className="min-w-0">
              <p className="font-serif text-xl sm:text-2xl font-semibold text-[#1C3A27] break-words">
                {displayName}
              </p>
              <p className="text-xs text-[#5C7A6E] mt-0.5">Registered TerraGuide buyer</p>
              <p className="text-[11px] text-[#7c6a57] mt-1">JPG or PNG, up to 5 MB (optional)</p>
            </div>
          </div>

          <div className="shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Upload profile picture"
            />
            <button
              type="button"
              onClick={handleSelectFileClick}
              disabled={isUploading}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#285A48] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#408A71] transition-colors shadow-sm cursor-pointer border-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              {isUploading ? 'Uploading...' : 'Edit Profile Picture'}
            </button>
          </div>
        </div>

        {uploadSuccess && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {uploadError && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{uploadError}</span>
          </div>
        )}
      </section>

      {/* Section B: Personal Information */}
      <section
        aria-labelledby="buyer-personal-info-heading"
        className="rounded-2xl bg-white border border-[#d6c7b2] p-5 sm:p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e0d5] pb-3">
          <h3
            id="buyer-personal-info-heading"
            className="text-xs font-bold uppercase tracking-wider text-[#7c6a57]"
          >
            Personal Information
          </h3>
          <button
            type="button"
            onClick={handleOpenEditModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#285A48]/25 bg-[#F5F7F6] px-3.5 py-1.5 text-xs font-semibold text-[#1C3A27] hover:bg-[#E8F5EF] transition-colors cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit Profile Information
          </button>
        </div>

        {profileSaveSuccess && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>{profileSaveSuccess}</span>
          </div>
        )}
        <dl className="mt-2 divide-y divide-[#eee7dd] text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3">
            <dt className="text-xs font-medium text-[#7c6a57]">Full Name</dt>
            <dd className="font-semibold text-[#1C3A27] break-words sm:text-right">
              {readable(user?.fullName)}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3">
            <dt className="text-xs font-medium text-[#7c6a57]">Username</dt>
            <dd className="font-semibold text-[#1C3A27] break-words sm:text-right">
              {user?.username ? `@${user.username}` : 'Not provided'}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3">
            <dt className="text-xs font-medium text-[#7c6a57]">Email Address</dt>
            <dd className="font-semibold text-[#1C3A27] break-all sm:text-right">
              {readable(user?.email)}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3">
            <dt className="text-xs font-medium text-[#7c6a57]">Contact Number</dt>
            <dd className="font-semibold text-[#1C3A27] break-words sm:text-right">
              {readable(user?.contactNumber)}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3">
            <dt className="text-xs font-medium text-[#7c6a57]">Address</dt>
            <dd className="font-semibold text-[#1C3A27] break-words sm:max-w-[65%] sm:text-right">
              {readable(user?.address)}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3">
            <dt className="text-xs font-medium text-[#7c6a57]">Registration Date</dt>
            <dd className="font-semibold text-[#1C3A27] sm:text-right">
              {formatDate(user?.createdAt)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Section C: My Property Preferences */}
      <section
        aria-labelledby="buyer-saved-prefs-heading"
        className="rounded-2xl bg-white border border-[#d6c7b2] p-5 sm:p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e0d5] pb-3">
          <h3
            id="buyer-saved-prefs-heading"
            className="text-xs font-bold uppercase tracking-wider text-[#7c6a57]"
          >
            My Property Preferences
          </h3>
          <button
            type="button"
            onClick={onEditPreferences}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#285A48]/25 bg-[#F5F7F6] px-3.5 py-1.5 text-xs font-semibold text-[#1C3A27] hover:bg-[#E8F5EF] transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Edit Preferences
          </button>
        </div>

        {isPreferencesLoading ? (
          <p className="py-6 text-xs text-[#5C7A6E]" role="status">
            Loading your saved preferences...
          </p>
        ) : (
          <div className="mt-3">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#e8e0d5] text-left text-[11px] font-bold uppercase tracking-wider text-[#7c6a57]">
                  <th className="py-2 pr-4">Preference</th>
                  <th className="py-2">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee7dd]">
                {preferenceRows.map((row) => (
                  <tr key={row.label} className="align-top">
                    <td className="py-3 pr-4 text-xs font-medium text-[#7c6a57] w-2/5">
                      {row.label}
                    </td>
                    <td className="py-3 font-semibold text-[#1C3A27] break-words">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Profile Information Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <div
            ref={editModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-buyer-profile-title"
            tabIndex={-1}
            className="relative z-[10000] flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#d6c7b2] bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#e8e0d5] bg-white px-5 py-4">
              <div>
                <h3
                  id="edit-buyer-profile-title"
                  className="font-serif text-lg font-semibold text-[#1C3A27]"
                >
                  Edit Profile Information
                </h3>
                <p className="text-[11px] text-[#7c6a57] mt-0.5">
                  Update your buyer account details. Email address cannot be changed.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={isSavingProfile}
                aria-label="Close edit profile modal"
                className="rounded-lg p-1.5 text-[#7c6a57] hover:bg-[#F5F7F6] hover:text-[#1C3A27] transition-colors bg-transparent border-none cursor-pointer disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {saveError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                    <span>{saveError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="edit-profile-fullname"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#7c6a57]"
                  >
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-profile-fullname"
                    type="text"
                    value={editFullName}
                    onChange={(e) => {
                      setEditFullName(e.target.value);
                      if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                    }}
                    disabled={isSavingProfile}
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm text-[#1C3A27] bg-[#F5F7F6] focus:outline-none focus:border-[#285A48] ${
                      fieldErrors.fullName ? 'border-red-400' : 'border-[#d6c7b2]'
                    }`}
                  />
                  {fieldErrors.fullName && (
                    <p className="text-xs text-red-600">{fieldErrors.fullName}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-profile-username"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#7c6a57]"
                  >
                    Username <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-profile-username"
                    type="text"
                    value={editUsername}
                    onChange={(e) => {
                      setEditUsername(e.target.value);
                      if (fieldErrors.username) setFieldErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                    disabled={isSavingProfile}
                    aria-invalid={Boolean(fieldErrors.username)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm text-[#1C3A27] bg-[#F5F7F6] focus:outline-none focus:border-[#285A48] ${
                      fieldErrors.username ? 'border-red-400' : 'border-[#d6c7b2]'
                    }`}
                  />
                  {fieldErrors.username ? (
                    <p className="text-xs text-red-600">{fieldErrors.username}</p>
                  ) : (
                    <p className="text-[11px] text-[#7c6a57]">
                      At least 3 characters; letters, numbers, and underscores only.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-profile-email"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#7c6a57]"
                  >
                    Email Address
                  </label>
                  <input
                    id="edit-profile-email"
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    disabled
                    className="w-full rounded-xl border border-[#e8e0d5] bg-[#f3efe8] px-3 py-2.5 text-sm text-[#7c6a57] cursor-not-allowed"
                  />
                  <p className="text-[11px] text-[#7c6a57]">
                    Email address is read-only and cannot be edited here.
                  </p>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-profile-contact"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#7c6a57]"
                  >
                    Contact Number <span className="font-normal normal-case text-[#7c6a57]">(Optional)</span>
                  </label>
                  <input
                    id="edit-profile-contact"
                    type="tel"
                    placeholder="e.g. 0917 123 4567"
                    value={editContactNumber}
                    onChange={(e) => {
                      setEditContactNumber(e.target.value);
                      if (fieldErrors.contactNumber) setFieldErrors((prev) => ({ ...prev, contactNumber: undefined }));
                    }}
                    disabled={isSavingProfile}
                    aria-invalid={Boolean(fieldErrors.contactNumber)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm text-[#1C3A27] bg-[#F5F7F6] focus:outline-none focus:border-[#285A48] ${
                      fieldErrors.contactNumber ? 'border-red-400' : 'border-[#d6c7b2]'
                    }`}
                  />
                  {fieldErrors.contactNumber && (
                    <p className="text-xs text-red-600">{fieldErrors.contactNumber}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-profile-address"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#7c6a57]"
                  >
                    Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-profile-address"
                    type="text"
                    value={editAddress}
                    onChange={(e) => {
                      setEditAddress(e.target.value);
                      if (fieldErrors.address) setFieldErrors((prev) => ({ ...prev, address: undefined }));
                    }}
                    disabled={isSavingProfile}
                    aria-invalid={Boolean(fieldErrors.address)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm text-[#1C3A27] bg-[#F5F7F6] focus:outline-none focus:border-[#285A48] ${
                      fieldErrors.address ? 'border-red-400' : 'border-[#d6c7b2]'
                    }`}
                  />
                  {fieldErrors.address && (
                    <p className="text-xs text-red-600">{fieldErrors.address}</p>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 flex items-center justify-end gap-2.5 border-t border-[#e8e0d5] bg-white px-5 py-3.5">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  disabled={isSavingProfile}
                  className="rounded-xl border border-[#d6c7b2] bg-white px-4 py-2 text-xs font-semibold text-[#5d503f] hover:bg-[#F5F7F6] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-xl bg-[#285A48] px-4 py-2 text-xs font-semibold text-white hover:bg-[#408A71] transition-colors shadow-sm cursor-pointer border-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerProfileView;
