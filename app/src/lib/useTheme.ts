import { useEffect, useState } from "react";
import { safeLocalStorageSet } from "./localStorage";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    safeLocalStorageSet("bibleai-theme", theme);
  }, [theme]);
  return { theme, setTheme };
}
