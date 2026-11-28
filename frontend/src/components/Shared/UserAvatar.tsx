import React, { useEffect, useState } from 'react';
import { User as UserIcon } from 'lucide-react';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 sm:h-24 sm:w-24 text-2xl',
};

const ICON_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-9 w-9',
};

function getInitials(name?: string | null): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  size = 'sm',
  className = '',
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const trimmedSrc = typeof src === 'string' ? src.trim() : '';
  const initials = getInitials(name);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#285A48] font-semibold text-[#E8F5EF] ring-1 ring-black/10 ${SIZE_CLASSES[size]} ${className}`}
    >
      {trimmedSrc && !imageFailed ? (
        <img
          src={trimmedSrc}
          alt={name ? `${name} profile picture` : 'Profile picture'}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <UserIcon className={ICON_CLASSES[size]} aria-hidden="true" />
      )}
    </span>
  );
};

export default UserAvatar;
