export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? 'ChatApp',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  description: 'A real-time Instagram-style chat application',
  version: '0.1.0',
} as const;

export const ROUTES = {
  // Auth
  login: '/login',
  register: '/register',
  // Main
  home: '/chat',
  chat: (id: string) => `/chat/${id}`,
  profile: (username: string) => `/profile/${username}`,
  search: '/search',
  settings: '/settings',
} as const;

export const QUERY_KEYS = {
  messages: 'messages',
  conversations: 'conversations',
  users: 'users',
  profile: 'profile',
  notifications: 'notifications',
} as const;
