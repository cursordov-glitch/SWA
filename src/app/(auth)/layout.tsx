// ============================================================
// src/app/(auth)/layout.tsx
// ============================================================
// Wraps all auth pages (/login, /register) in a centred card.
// ============================================================

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-50 p-4">
      {/* Decorative background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-pink-200 to-purple-200 opacity-30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-tr from-purple-200 to-pink-200 opacity-30 blur-3xl" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 border border-gray-100 p-8">
          {children}
        </div>

        {/* Subtle brand watermark */}
        <p className="text-center text-xs text-gray-400 mt-6 font-medium tracking-wide">
          CHATAPP
        </p>
      </div>
    </div>
  );
}
