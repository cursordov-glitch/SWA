// ============================================================
// src/features/profile/index.ts
// ============================================================

// Components
export { AvatarUploader }  from './components/AvatarUploader';
export { ProfileHeader }   from './components/ProfileHeader';
export { ProfileEditor }   from './components/ProfileEditor';
export { SettingsForm }    from './components/SettingsForm';

// Hooks
export { useProfile } from './hooks/useProfile';

// Types
export type {
  ProfileFormValues,
  ProfileEditState,
  AvatarUploadState,
  ProfileViewModel,
} from './types';
