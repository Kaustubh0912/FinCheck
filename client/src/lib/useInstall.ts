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

  // Fallback hardcoded version. Ideally the Android app passes ?apk_version=13 in the URL.
  const CURRENT_APP_VERSION = "build-13";

  // Capture dynamic version from Android app if passed in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const apkVersion = params.get("apk_version");
    if (apkVersion) {
      localStorage.setItem("fincheck_apk_version", apkVersion);
    }
  }, []);

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
        if (data.tag_name) {
          const storedVersion = localStorage.getItem("fincheck_apk_version");
          const versionToCompare = storedVersion ? `build-${storedVersion}` : CURRENT_APP_VERSION;
          const currentBuild = parseInt(versionToCompare.replace(/[^0-9]/g, ""), 10) || 0;
          const latestBuild = parseInt(data.tag_name.replace(/[^0-9]/g, ""), 10) || 0;
          
          if (latestBuild > currentBuild) {
            setUpdateAvailable(true);
            const apk = data.assets?.find((a: any) => a.name.endsWith(".apk"));
            setLatestDownloadUrl(apk?.browser_download_url ?? null);
          }
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
