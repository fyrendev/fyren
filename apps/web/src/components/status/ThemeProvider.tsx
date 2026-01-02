"use client";

import { createContext, useContext, ReactNode } from "react";

interface ThemeContextType {
  brandColor: string;
  accentColor: string;
}

const ThemeContext = createContext<ThemeContextType>({
  brandColor: "#f59e0b", // Default amber
  accentColor: "#3b82f6", // Default blue
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  brandColor?: string | null;
  accentColor?: string | null;
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
  customCss,
  children,
}: ThemeProviderProps) {
  // Use fallbacks for null values
  const effectiveBrandColor = brandColor || "#f59e0b";
  const effectiveAccentColor = accentColor || "#3b82f6";

  // Generate CSS variables
  const cssVariables = `
    :root {
      --brand-color: ${effectiveBrandColor};
      --accent-color: ${effectiveAccentColor};
      --brand-color-light: ${effectiveBrandColor}20;
      --accent-color-light: ${effectiveAccentColor}20;
    }
  `;

  return (
    <ThemeContext.Provider
      value={{
        brandColor: effectiveBrandColor,
        accentColor: effectiveAccentColor,
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
    customCss?: string | null;
  };
  children: ReactNode;
}

export function OrganizationTheme({ organization, children }: OrganizationThemeProps) {
  return (
    <ThemeProvider
      brandColor={organization.brandColor}
      accentColor={organization.accentColor}
      customCss={organization.customCss}
    >
      {children}
    </ThemeProvider>
  );
}
