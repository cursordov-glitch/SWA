'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { formatLastMessagePreview } from '../utils';
import type { ConversationListItem } from '../types';

type ConversationItemProps = {
  item: ConversationListItem;
  isActive: boolean;
  currentUserId: string;
};

export function ConversationItem({ item, isActive }: ConversationItemProps) {
  const isLastMessageMine = false;
  const preview = formatLastMessagePreview(item.last_message_preview, isLastMessageMine);

  return (
    <Link
      href={`/chat/${item.id}`}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl mx-2 transition-all duration-100',
        'hover:bg-gray-50 active:bg-gray-100',
        isActive && 'bg-gray-100 hover:bg-gray-100'
      )}
    >
      <Avatar
        src={item.display_avatar}
        name={item.display_name}
        size="md"
        isOnline={item.other_user?.is_online}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn('text-sm truncate', item.has_unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800')}>
            {item.display_name}
          </span>
          {item.formatted_time && (
            <span className={cn('text-xs shrink-0', item.has_unread ? 'text-pink-500 font-medium' : 'text-gray-400')}>
              {item.formatted_time}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn('text-xs truncate leading-snug', item.has_unread ? 'text-gray-700 font-medium' : 'text-gray-400')}>
            {preview}
          </p>
          {item.has_unread && item.unread_count > 0 && (
            <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-bold">
              {item.unread_count > 99 ? '99+' : item.unread_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
