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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestDownloadUrl, setLatestDownloadUrl] = useState<string | null>(null);

  // Current hardcoded version (bump this when releasing a new APK)
  const CURRENT_APP_VERSION = "build-1";

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

  useEffect(() => {
    // Only check when running as installed Android app
    if (!isStandalone() || !isAndroid) return;
    
    fetch("https://api.github.com/repos/Kaustubh0912/FinCheck/releases/latest")
      .then(r => r.json())
      .then(data => {
        if (data.tag_name && data.tag_name !== CURRENT_APP_VERSION) {
          setUpdateAvailable(true);
          const apk = data.assets?.find((a: any) => a.name.endsWith(".apk"));
          setLatestDownloadUrl(apk?.browser_download_url ?? null);
        }
      })
      .catch(() => { /* silently fail — don't block the app */ });
  }, [isAndroid]);

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

  function update() {
    if (latestDownloadUrl) {
      window.location.href = latestDownloadUrl;
    }
  }

  return { canInstall: !!deferred || isAndroid, install, installed, isIOS, isAndroid, updateAvailable, update };
}
