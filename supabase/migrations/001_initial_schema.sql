-- ============================================================
-- ChatApp — Initial Schema Migration
-- 001_initial_schema.sql
-- ============================================================
-- Run order: execute this file once against your Supabase project
-- via the Supabase SQL editor or CLI: supabase db push
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- trigram indexes for search
CREATE EXTENSION IF NOT EXISTS "moddatetime";    -- auto-update updated_at

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE message_type AS ENUM (
  'text',
  'image',
  'video',
  'audio',
  'file',
  'system'          -- e.g. "Alice added Bob to the group"
);

CREATE TYPE message_status_type AS ENUM (
  'sending',        -- optimistic UI state
  'sent',           -- written to DB
  'delivered',      -- recipient device received it
  'seen'            -- recipient opened the conversation
);

CREATE TYPE participant_role AS ENUM (
  'member',
  'admin'
);

CREATE TYPE media_type AS ENUM (
  'image',
  'video',
  'audio',
  'document'
);

-- ─── 1. users ────────────────────────────────────────────────────────────────
-- Mirrors auth.users but stores public profile data.
-- Supabase auth.users is private; this table is the public-facing profile.

CREATE TABLE public.users (
  id                UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username          TEXT          NOT NULL UNIQUE,
  full_name         TEXT,
  avatar_url        TEXT,
  bio               TEXT          CHECK (char_length(bio) <= 200),
  website           TEXT,

  -- Presence
  is_online         BOOLEAN       NOT NULL DEFAULT FALSE,
  last_seen_at      TIMESTAMPTZ,

  -- Soft delete
  deleted_at        TIMESTAMPTZ,

  -- Timestamps
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT username_length     CHECK (char_length(username) >= 3),
  CONSTRAINT username_format     CHECK (username ~ '^[a-zA-Z0-9_\.]+$')
);

COMMENT ON TABLE public.users IS
  'Public user profiles. Linked 1-to-1 with auth.users.';

-- ─── 2. conversations ────────────────────────────────────────────────────────
-- Represents both DMs and group chats.
-- is_group = false  → exactly 2 participants (DM)
-- is_group = true   → 2..N participants (group)

CREATE TABLE public.conversations (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Group chat metadata (NULL for DMs)
  is_group          BOOLEAN       NOT NULL DEFAULT FALSE,
  group_name        TEXT          CHECK (char_length(group_name) <= 100),
  group_avatar_url  TEXT,
  created_by        UUID          REFERENCES public.users(id) ON DELETE SET NULL,

  -- Denormalised for fast sidebar queries
  last_message_id   UUID,         -- FK added below after messages table
  last_message_at   TIMESTAMPTZ,
  last_message_preview TEXT,      -- truncated text for sidebar

  -- Soft delete
  deleted_at        TIMESTAMPTZ,

  -- Timestamps
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.conversations IS
  'Conversation container. Works for 1-to-1 DMs and future group chats.';

-- ─── 3. conversation_participants ────────────────────────────────────────────

CREATE TABLE public.conversation_participants (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID          NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id           UUID          NOT NULL REFERENCES public.users(id)         ON DELETE CASCADE,
  role              participant_role NOT NULL DEFAULT 'member',

  -- Per-participant state
  last_read_at      TIMESTAMPTZ,  -- used to compute unread count
  is_muted          BOOLEAN       NOT NULL DEFAULT FALSE,
  is_pinned         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_archived       BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Soft delete (leave group without losing history)
  left_at           TIMESTAMPTZ,

  -- Timestamps
  joined_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- One row per user per conversation
  UNIQUE (conversation_id, user_id)
);

COMMENT ON TABLE public.conversation_participants IS
  'Junction table. Stores per-user state within a conversation.';

-- ─── 4. messages ─────────────────────────────────────────────────────────────

CREATE TABLE public.messages (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID          NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id         UUID          REFERENCES public.users(id) ON DELETE SET NULL,

  -- Content
  message_type      message_type  NOT NULL DEFAULT 'text',
  content           TEXT,         -- NULL for pure-media messages
  media_url         TEXT,         -- Supabase Storage public URL
  media_type        media_type,
  media_metadata    JSONB,        -- { width, height, duration, size, mime_type }

  -- Threading (future feature)
  reply_to_id       UUID          REFERENCES public.messages(id) ON DELETE SET NULL,

  -- Reactions (future feature — stored as JSONB for flexibility)
  reactions         JSONB         NOT NULL DEFAULT '{}',
  -- shape: { "❤️": ["user_id_1", "user_id_2"], "😂": ["user_id_3"] }

  -- Soft delete (sender can "unsend")
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID          REFERENCES public.users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT content_or_media CHECK (
    content IS NOT NULL OR media_url IS NOT NULL
  )
);

COMMENT ON TABLE public.messages IS
  'All messages across all conversations. Supports text, media, system messages.';

-- ─── 4b. Add FK from conversations → messages (circular, added after) ────────

ALTER TABLE public.conversations
  ADD CONSTRAINT fk_last_message
  FOREIGN KEY (last_message_id)
  REFERENCES public.messages(id)
  ON DELETE SET NULL;

-- ─── 5. message_status ───────────────────────────────────────────────────────
-- Per-recipient delivery + read tracking.
-- One row per (message, recipient). Sender is excluded.

CREATE TABLE public.message_status (
  id                UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id        UUID              NOT NULL REFERENCES public.messages(id)  ON DELETE CASCADE,
  user_id           UUID              NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  status            message_status_type NOT NULL DEFAULT 'sent',
  delivered_at      TIMESTAMPTZ,
  seen_at           TIMESTAMPTZ,

  -- One row per user per message
  UNIQUE (message_id, user_id)
);

COMMENT ON TABLE public.message_status IS
  'Delivery and read receipts per recipient per message.';

-- ─── 6. media_attachments ────────────────────────────────────────────────────
-- Optional separate table for rich media metadata and future CDN tracking.

CREATE TABLE public.media_attachments (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id        UUID          NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  uploader_id       UUID          REFERENCES public.users(id) ON DELETE SET NULL,

  storage_path      TEXT          NOT NULL,   -- path within Supabase Storage bucket
  public_url        TEXT          NOT NULL,
  media_type        media_type    NOT NULL,
  mime_type         TEXT          NOT NULL,
  file_name         TEXT,
  file_size_bytes   BIGINT,
  width             INT,
  height            INT,
  duration_seconds  FLOAT,        -- for audio/video
  blur_hash         TEXT,         -- for image placeholders

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.media_attachments IS
  'Rich media metadata for messages. Linked to Supabase Storage.';
