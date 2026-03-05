// ============================================================
// src/app/api/profile/update/route.ts
// ============================================================
// PATCH /api/profile/update
// Updates the authenticated user's profile fields.
//
// Accepted fields: username, full_name, bio, website
// Avatar is handled separately by /api/profile/avatar (multipart).
//
// Security:
//   - Session required (server-side cookie auth)
//   - Can only update own profile (UserService scopes to auth.uid())
//   - Username uniqueness checked before write
//   - All fields validated by Zod before touching DB
//
// Vercel: stateless, no file handling, typical response <50ms
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createUserService } from '@/services';

// ─── Validation schema ────────────────────────────────────────────────────────

const UpdateProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be 30 characters or fewer')
    .regex(/^[a-zA-Z0-9_.]+$/, 'Username can only contain letters, numbers, underscores, and dots')
    .optional(),
  full_name: z
    .string()
    .max(60, 'Name must be 60 characters or fewer')
    .optional()
    .nullable(),
  bio: z
    .string()
    .max(160, 'Bio must be 160 characters or fewer')
    .optional()
    .nullable(),
  website: z
    .string()
    .url('Website must be a valid URL')
    .max(200, 'URL is too long')
    .optional()
    .nullable()
    .or(z.literal('')),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    // 1. Parse + validate body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 422 }
      );
    }

    // Reject completely empty update
    const input = parsed.data;
    if (Object.keys(input).length === 0) {
      return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
    }

    // 2. Auth
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Normalise: empty string website → null
    const sanitised = {
      ...input,
      website: input.website === '' ? null : (input.website ?? undefined),
    };

    // 4. Update via service (handles uniqueness check internally)
    const userService = createUserService(supabase);
    const { data: updatedProfile, error } = await userService.updateProfile(sanitised);

    if (error) {
      const status = error.code === 'USERNAME_TAKEN' ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ data: updatedProfile }, { status: 200 });

  } catch (err) {
    console.error('[PATCH /api/profile/update]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
