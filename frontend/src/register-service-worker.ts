export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const isSecureOrigin =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isSecureOrigin) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration is best-effort. The app must remain usable in browser mode.
    });
  });
}
