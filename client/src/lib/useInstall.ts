import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Drives a custom "Install app" affordance, since browsers don't always surface one
 *  (and iOS Safari never auto-prompts — it needs the manual Share → Add to Home Screen). */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIOS =
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;

  const isAndroid = /android/i.test(window.navigator.userAgent);

  async function install() {
    if (isAndroid) {
      window.location.href = "https://github.com/Kaustubh0912/FinCheck/releases/latest/download/app-release.apk";
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return { canInstall: !!deferred || isAndroid, install, installed, isIOS, isAndroid };
}
