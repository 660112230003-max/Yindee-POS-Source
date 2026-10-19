/**
 * Global Theme Management for Yindee Moo Krob POS & Restaurant OS
 * Dynamically synchronizes CSS custom properties with store branding settings.
 */

export function hexToRgb(hex: string): [number, number, number] {
  let c = (hex || "").replace("#", "").trim();
  if (c.length === 3) {
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  }
  const num = parseInt(c, 16);
  if (isNaN(num) || (c.length !== 6 && c.length !== 8)) {
    return [249, 115, 22]; // Default vibrant orange
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function darkenHex(hex: string, amount = 0.12): string {
  const [r, g, b] = hexToRgb(hex);
  const dr = Math.max(0, Math.round(r * (1 - amount)));
  const dg = Math.max(0, Math.round(g * (1 - amount)));
  const db = Math.max(0, Math.round(b * (1 - amount)));
  return `#${((1 << 24) + (dr << 16) + (dg << 8) + db).toString(16).slice(1)}`;
}

export function getContrastTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  // Perceived brightness formula (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 170 ? "#0f172a" : "#ffffff";
}

/**
 * Injects CSS custom properties into document.documentElement (:root)
 * to instantly re-theme all Tailwind CSS v4 variables and components.
 */
export function applyGlobalTheme(
  primaryColor?: string | null,
  secondaryColor?: string | null,
) {
  if (typeof document === "undefined") return;

  const primary = primaryColor?.trim() || "#F97316";
  const secondary = secondaryColor?.trim() || "#10B981";
  const primaryDark = darkenHex(primary, 0.14);
  const primaryFg = getContrastTextColor(primary);
  const secondaryFg = getContrastTextColor(secondary);

  const root = document.documentElement;

  // Primary color variables
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--primary-dark", primaryDark);
  root.style.setProperty("--color-primary-dark", primaryDark);
  root.style.setProperty("--primary-foreground", primaryFg);
  root.style.setProperty("--color-primary-foreground", primaryFg);

  // Sidebar theme synchronization
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--color-sidebar-primary", primary);
  root.style.setProperty("--sidebar-primary-foreground", primaryFg);
  root.style.setProperty("--color-sidebar-primary-foreground", primaryFg);
  root.style.setProperty("--sidebar-ring", primary);
  root.style.setProperty("--color-sidebar-ring", primary);

  // Focus ring & borders
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--color-ring", primary);

  // Secondary color variables
  root.style.setProperty("--secondary", secondary);
  root.style.setProperty("--color-secondary", secondary);
  root.style.setProperty("--secondary-foreground", secondaryFg);
  root.style.setProperty("--color-secondary-foreground", secondaryFg);

  // Dynamic glow and shadows matching the primary brand color
  const glowShadow = `0 10px 30px ${hexToRgba(primary, 0.35)}`;
  const glowVal = hexToRgba(primary, 0.35);
  root.style.setProperty("--shadow-glow", glowShadow);
  root.style.setProperty("--shadow-glow-val", glowShadow);
  root.style.setProperty("--shadow-glow-color", glowVal);
  root.style.setProperty(
    "--shadow-card-hover",
    `0 4px 8px ${hexToRgba(primary, 0.08)}, 0 20px 48px ${hexToRgba(primary, 0.16)}`,
  );
}
