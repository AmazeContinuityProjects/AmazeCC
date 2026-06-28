"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    const legacyDarkTheme = ["mid", "night"].join("");
    if (window.localStorage.getItem("theme") === legacyDarkTheme) {
      window.localStorage.setItem("theme", "dark");
    }
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
