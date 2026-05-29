import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F4] flex flex-col">
      {/* Nav */}
      <nav className="px-10 py-8 flex items-center justify-between">
        <span
          className="text-[#1E1E1E] tracking-widest text-sm uppercase"
          style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.2em" }}
        >
          Seam
        </span>
        <Link
          href="/onboarding"
          className="text-sm text-[#8A847C] hover:text-[#1E1E1E] transition-colors"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center" style={{ paddingBottom: "12vh" }}>
        <h1
          className="text-[#1E1E1E] mb-6 leading-none tracking-tight"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "clamp(5rem, 14vw, 12rem)",
            fontWeight: 300,
            letterSpacing: "-0.02em",
          }}
        >
          Seam
        </h1>

        <p
          className="text-[#3A3530] mb-16"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "clamp(1.1rem, 2.5vw, 1.6rem)",
            fontWeight: 400,
            fontStyle: "italic",
            letterSpacing: "0.01em",
          }}
        >
          Your wardrobe, understood.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/onboarding"
            className="flex items-center justify-center gap-3 w-full py-3.5 px-6 bg-[#1E1E1E] text-[#FAF8F4] rounded-full transition-all hover:bg-[#3A3530]"
            style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", fontWeight: 400, letterSpacing: "0.01em" }}
          >
            <GoogleIcon />
            Continue with Google
          </Link>

          <Link
            href="/onboarding"
            className="flex items-center justify-center gap-3 w-full py-3.5 px-6 bg-[#FAF8F4] text-[#1E1E1E] rounded-full border border-[#E2DDD6] transition-all hover:bg-[#F0EBE3]"
            style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", fontWeight: 400, letterSpacing: "0.01em" }}
          >
            <AppleIcon />
            Continue with Apple
          </Link>
        </div>

        <p
          className="mt-8 text-[#8A847C] text-xs"
          style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.02em" }}
        >
          By continuing, you agree to our Terms &amp; Privacy Policy.
        </p>
      </div>

      {/* Footer accent */}
      <div className="px-10 pb-8 flex items-center justify-center">
        <div className="w-px h-8 bg-[#E2DDD6]" />
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.3a3.67 3.67 0 01-1.59 2.41v2h2.57c1.5-1.38 2.4-3.42 2.4-5.87z" fill="#4285F4"/>
      <path d="M8 16c2.16 0 3.97-.71 5.3-1.94l-2.57-2a4.8 4.8 0 01-7.14-2.52H.96v2.07A8 8 0 008 16z" fill="#34A853"/>
      <path d="M3.59 9.54A4.8 4.8 0 013.34 8c0-.54.09-1.06.25-1.54V4.39H.96A8 8 0 000 8c0 1.29.31 2.51.96 3.61l2.63-2.07z" fill="#FBBC05"/>
      <path d="M8 3.2c1.22 0 2.31.42 3.17 1.24l2.37-2.37A8 8 0 00.96 4.39L3.59 6.46A4.77 4.77 0 018 3.2z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.182 0c.07.764-.219 1.527-.682 2.082-.46.552-1.193.977-1.93.924-.085-.744.265-1.533.688-2.027C9.7.44 10.487.04 11.182 0zm2.278 5.71c-.13.084-2.14 1.23-2.118 3.67.025 2.9 2.54 3.87 2.567 3.883-.02.08-.4 1.376-1.323 2.7-.792 1.163-1.617 2.32-2.898 2.343-1.25.022-1.655-.74-3.087-.74-1.43 0-1.88.717-3.063.762-1.237.044-2.18-1.244-2.98-2.402C.822 13.9-.39 10.493.127 7.2c.248-1.59 1.038-3.057 2.113-4.025a5.254 5.254 0 013.494-1.226c1.276.024 2.47.858 3.252.858.783 0 2.253-1.062 3.792-.903.645.027 2.456.26 3.618 1.962l-.936.644z"/>
    </svg>
  );
}
