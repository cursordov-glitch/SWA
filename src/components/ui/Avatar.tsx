'use client';

// ============================================================
// src/components/ui/Avatar.tsx
// ============================================================

import Image from 'next/image';

import { cn } from '@/lib/utils';
import { getInitials } from '@/features/chat/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type AvatarProps = {
  src?: string | null;
  name?: string | null;
  size?: AvatarSize;
  isOnline?: boolean;
  className?: string;
};

const sizeMap: Record<AvatarSize, { container: string; text: string; indicator: string }> = {
  xs: { container: 'w-7 h-7',   text: 'text-xs',   indicator: 'w-2 h-2 border' },
  sm: { container: 'w-9 h-9',   text: 'text-sm',   indicator: 'w-2.5 h-2.5 border' },
  md: { container: 'w-11 h-11', text: 'text-base',  indicator: 'w-3 h-3 border-2' },
  lg: { container: 'w-14 h-14', text: 'text-lg',   indicator: 'w-3.5 h-3.5 border-2' },
  xl: { container: 'w-20 h-20', text: 'text-2xl',  indicator: 'w-4 h-4 border-2' },
};

// Deterministic background colour from name initials
const BG_COLORS = [
  'bg-pink-400',   'bg-purple-400', 'bg-blue-400',
  'bg-green-400',  'bg-yellow-400', 'bg-orange-400',
  'bg-red-400',    'bg-teal-400',   'bg-indigo-400',
  'bg-cyan-400',
];

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

export function Avatar({ src, name, size = 'md', isOnline, className }: AvatarProps) {
  const { container, text, indicator } = sizeMap[size];
  const initials = name ? getInitials(name) : '?';
  const bgColor = name ? getColorFromName(name) : 'bg-gray-300';

  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center font-semibold text-white select-none',
          container,
          !src && bgColor
        )}
      >
        {src ? (
          <Image
            src={src}
            alt={name ?? 'Avatar'}
            fill
            className="object-cover"
            sizes={container}
            onError={(e) => {
              // Hide broken image, show initials fallback
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className={text}>{initials}</span>
        )}
      </div>

      {/* Online indicator dot */}
      {isOnline !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white',
            indicator,
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          )}
          aria-label={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
