"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

// Reads the theme the no-flash script already applied to <html data-theme>, lets the
// user flip it, and persists to localStorage. Lazy-initialised from the DOM so there is
// no state-syncing effect; the button suppresses the hydration warning since the server
// always assumes light.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined"
      ? ((document.documentElement.dataset.theme as Theme) || "light")
      : "light",
  );

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore storage failures (private mode etc.)
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      suppressHydrationWarning
      className="grid size-9 place-items-center rounded-lg border bg-surface text-text-muted transition-colors hover:border-[var(--primary)] hover:text-primary"
    >
      <span suppressHydrationWarning>
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </span>
    </button>
  );
}
