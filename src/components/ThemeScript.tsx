"use client";

import * as React from "react";

export function useTheme() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const current = root.classList.contains("dark") ? "dark" : "light";
    setTheme(current); // eslint-disable-line react-hooks/set-state-in-effect

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const stored = localStorage.getItem("theme");
      if (!stored) {
        const sys = media.matches ? "dark" : "light";
        if (sys === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
        setTheme(sys);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setMode = (mode: "light" | "dark") => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", mode);
    setTheme(mode);
  };

  const toggle = () => {
    setMode(theme === "dark" ? "light" : "dark");
  };

  return { theme, setMode, toggle };
}
