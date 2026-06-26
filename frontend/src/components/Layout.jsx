import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AgeConsentModal from "./AgeConsentModal";
import ScrollToTop from "./ScrollToTop";
import { apiFetch } from "../lib/api";

const METRICS_TIMEZONE = "America/Sao_Paulo";

function getVisitDayKey() {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: METRICS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === "year")?.value || "0000";
    const month = parts.find((part) => part.type === "month")?.value || "01";
    const day = parts.find((part) => part.type === "day")?.value || "01";
    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function Layout() {
  useEffect(() => {
    const todayKey = getVisitDayKey();
    if (localStorage.getItem("siteVisitTrackedDay") === todayKey) {
      return;
    }

    const ua = navigator.userAgent || "";
    const deviceType = /android|iphone|ipad|mobile/i.test(ua)
      ? "mobile"
      : /tablet|ipad/i.test(ua)
        ? "tablet"
        : "desktop";

    const browser = /edg\//i.test(ua)
      ? "Edge"
      : /chrome\//i.test(ua)
        ? "Chrome"
        : /firefox\//i.test(ua)
          ? "Firefox"
          : /safari\//i.test(ua)
            ? "Safari"
            : "unknown";

    const os = /windows/i.test(ua)
      ? "Windows"
      : /mac os x/i.test(ua)
        ? "macOS"
        : /android/i.test(ua)
          ? "Android"
          : /iphone|ipad|ipod/i.test(ua)
            ? "iOS"
            : /linux/i.test(ua)
              ? "Linux"
              : "unknown";

    localStorage.setItem("siteVisitTrackedDay", todayKey);
    apiFetch("/api/metrics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer || "",
        language: navigator.language || "",
        screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
        browser,
        os,
        deviceType,
      }),
    }).catch(() => {});
  }, []);

  return (
    <div className="app">
      <ScrollToTop />
      <AgeConsentModal />
      <header className="topbar">
        <Navbar />
      </header>
      <main className="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
