"use client";

import Link from "next/link";
import { getAccentColor } from "@/lib/timeTheme";

export type ActivePage = "home" | "wardrobe" | "wishlist" | "build" | "saved";

const TABS: { id: ActivePage; label: string; href: string }[] = [
  { id: "home",     label: "Home",         href: "/home" },
  { id: "wardrobe", label: "Wardrobe",      href: "/wardrobe" },
  { id: "wishlist", label: "Wishlist",      href: "/wardrobe" },
  { id: "build",    label: "Build",         href: "/outfits" },
  { id: "saved",    label: "Saved Outfits", href: "/outfits/saved" },
];

export function AppNav({
  activePage,
  onHomeClick,
  onWardrobeClick,
  onWishlistClick,
}: {
  activePage: ActivePage;
  onHomeClick?: () => void;
  onWardrobeClick?: () => void;
  onWishlistClick?: () => void;
}) {
  const accent = getAccentColor();

  const clickMap: Partial<Record<ActivePage, (() => void) | undefined>> = {
    home: onHomeClick,
    wardrobe: onWardrobeClick,
    wishlist: onWishlistClick,
  };

  return (
    <header
      className="sticky top-0 z-10 shrink-0 flex items-center px-6 sm:px-8 border-b border-black/[0.06] overflow-x-auto"
      style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
    >
      {/* Logo */}
      <Link
        href="/home"
        className="text-[#1a1a1a] text-[11px] uppercase shrink-0 py-4 mr-7"
        style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.15em" }}
      >
        My Drobe
      </Link>

      {/* Divider */}
      <div className="w-px h-3.5 bg-black/10 shrink-0 mr-7" />

      {/* Tabs */}
      <nav className="flex items-center gap-5 sm:gap-6">
        {TABS.map(({ id, label, href }) => {
          const isActive = activePage === id;
          const onClick = clickMap[id];

          const sharedClass =
            "py-[15px] text-[13px] relative shrink-0 whitespace-nowrap transition-colors";
          const color = isActive ? "#1a1a1a" : "#9CA3AF";

          const activeIndicator = isActive ? (
            <span
              className="absolute bottom-0 left-0 right-0 h-[1.5px] rounded-full"
              style={{ background: accent }}
            />
          ) : null;

          if (onClick) {
            return (
              <button
                key={id}
                onClick={onClick}
                className={sharedClass}
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontWeight: 400,
                  color,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {label}
                {activeIndicator}
              </button>
            );
          }

          return (
            <Link
              key={id}
              href={href}
              className={sharedClass}
              style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400, color }}
              onMouseEnter={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLElement).style.color = "#374151";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
              }}
            >
              {label}
              {activeIndicator}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
