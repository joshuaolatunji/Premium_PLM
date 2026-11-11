import { useEffect, useState } from "react";
import { Toaster } from "sileo";

import { TOAST_MS } from "../../utils/notify";

// The island's colour for each app theme: deep ink on the light theme, a
// raised slate on the dark one (the same surfaces as the tooltip), so it
// stands off the page without glaring.
const FILL = { light: "#1b1e24", dark: "#2b3038" } as const;

function htmlTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

// Every toast and notification prompt in the app goes through Sileo, via
// utils/notify.ts (notifySuccess / notifyError / notifyWarning / notifyInfo). This is its
// one Toaster, mounted at the root. It watches <html data-theme> so the
// island follows the light / dark switch the moment it flips.
function AppToaster() {
  const [theme, setTheme] = useState(htmlTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(htmlTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      position="top-center"
      offset={{ top: 18 }}
      // Sileo's "light" styles are the ones for a dark island (light text).
      theme="light"
      options={{ fill: FILL[theme], duration: TOAST_MS }}
    />
  );
}

export default AppToaster;
