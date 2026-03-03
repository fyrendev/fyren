"use client";

import { createContext, useContext, ReactNode } from "react";

interface ThemeContextType {
  brandColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

const ThemeContext = createContext<ThemeContextType>({
  brandColor: "#f59e0b", // Default amber
  accentColor: "#3b82f6", // Default blue
  backgroundColor: "#0a1628", // Default navy
  textColor: "#ffffff", // Default white
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  brandColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  customCss?: string | null;
  children: ReactNode;
}

/**
 * ThemeProvider component that applies organization branding
 *
 * Injects CSS variables for brand/accent colors and optional custom CSS.
 * The custom CSS is expected to be pre-sanitized on the server side.
 */
export function ThemeProvider({
  brandColor = "#f59e0b",
  accentColor = "#3b82f6",
  backgroundColor = "#0a1628",
  textColor = "#ffffff",
  customCss,
  children,
}: ThemeProviderProps) {
  // Use fallbacks for null values
  const effectiveBrandColor = brandColor || "#f59e0b";
  const effectiveAccentColor = accentColor || "#3b82f6";
  const effectiveBackgroundColor = backgroundColor || "#0a1628";
  const effectiveTextColor = textColor || "#ffffff";

  // Helper to adjust color brightness
  function adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  // Calculate card colors based on background
  const cardBg = adjustBrightness(effectiveBackgroundColor, 15);
  const cardBorder = adjustBrightness(effectiveBackgroundColor, 30);
  const inputBg = adjustBrightness(effectiveBackgroundColor, 25);
  const inputBorder = adjustBrightness(effectiveBackgroundColor, 40);
  const mutedText = effectiveTextColor + "99"; // 60% opacity

  // Generate CSS variables and utility classes
  const cssVariables = `
    :root {
      --brand-color: ${effectiveBrandColor};
      --accent-color: ${effectiveAccentColor};
      --background-color: ${effectiveBackgroundColor};
      --text-color: ${effectiveTextColor};
      --card-bg: ${cardBg};
      --card-border: ${cardBorder};
      --input-bg: ${inputBg};
      --input-border: ${inputBorder};
      --muted-text: ${mutedText};
      --brand-color-light: ${effectiveBrandColor}15;
      --brand-color-medium: ${effectiveBrandColor}30;
      --accent-color-light: ${effectiveAccentColor}20;
    }

    .status-page-bg {
      background: linear-gradient(180deg, ${effectiveBrandColor}08 0%, transparent 400px), ${effectiveBackgroundColor};
      color: ${effectiveTextColor};
    }

    .theme-card {
      background-color: ${cardBg};
      border: 1px solid ${cardBorder};
      border-radius: 0.5rem;
    }

    .theme-input {
      background-color: ${inputBg};
      border: 1px solid ${inputBorder};
      color: ${effectiveTextColor};
    }
    .theme-input::placeholder {
      color: ${mutedText};
    }
    .theme-input:focus {
      outline: none;
      border-color: ${cardBorder};
    }

    .theme-muted {
      color: ${mutedText};
    }

    .brand-link {
      color: ${effectiveBrandColor};
    }
    .brand-link:hover {
      color: ${effectiveBrandColor};
      opacity: 0.8;
    }

    .brand-button {
      background-color: ${effectiveBrandColor};
      color: white;
    }
    .brand-button:hover {
      background-color: ${effectiveBrandColor};
      opacity: 0.9;
    }

    .brand-border {
      border-color: ${effectiveBrandColor};
    }
  `;

  return (
    <ThemeContext.Provider
      value={{
        brandColor: effectiveBrandColor,
        accentColor: effectiveAccentColor,
        backgroundColor: effectiveBackgroundColor,
        textColor: effectiveTextColor,
      }}
    >
      {/* Inject CSS variables */}
      <style dangerouslySetInnerHTML={{ __html: cssVariables }} />

      {/* Inject custom CSS if provided (should be sanitized) */}
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}

      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Server component wrapper for applying theme from organization data
 */
interface OrganizationThemeProps {
  organization: {
    brandColor?: string | null;
    accentColor?: string | null;
    backgroundColor?: string | null;
    textColor?: string | null;
    customCss?: string | null;
  };
  children: ReactNode;
}

export function OrganizationTheme({ organization, children }: OrganizationThemeProps) {
  return (
    <ThemeProvider
      brandColor={organization.brandColor}
      accentColor={organization.accentColor}
      backgroundColor={organization.backgroundColor}
      textColor={organization.textColor}
      customCss={organization.customCss}
    >
      {children}
    </ThemeProvider>
  );
}
