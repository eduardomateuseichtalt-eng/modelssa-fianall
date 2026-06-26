import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AgeConsentModal from "./AgeConsentModal";
import ScrollToTop from "./ScrollToTop";
import { apiFetch } from "../lib/api";
import {
  normalizeVisitorLocation,
  readVisitorLocation,
  VISITOR_LOCATION_EVENT,
} from "../lib/visitorLocation";

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
    const trackingKey = "siteVisitTrackedDay";

    const sendVisit = async (location, forceUpdate = false) => {
      let alreadyTracked = false;
      try {
        alreadyTracked = localStorage.getItem(trackingKey) === todayKey;
      } catch {
        alreadyTracked = false;
      }
      if (!forceUpdate && alreadyTracked) {
        return;
      }

      try {
        await apiFetch("/api/metrics/visit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: window.location.pathname,
            referrer: document.referrer || "",
            language: navigator.language || "",
            screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
            ...normalizeVisitorLocation(location),
          }),
        });
        try {
          localStorage.setItem(trackingKey, todayKey);
        } catch {
          // O servidor ainda faz a deduplicacao quando o storage esta bloqueado.
        }
      } catch {
        // Metricas nunca devem impedir a navegacao pelo site.
      }
    };

    const storedLocation = readVisitorLocation();
    const hasStoredLocation = Boolean(
      storedLocation.city || storedLocation.region || storedLocation.countryCode
    );
    void sendVisit(storedLocation, hasStoredLocation);

    const handleLocationUpdate = (event) => {
      void sendVisit(event.detail, true);
    };
    window.addEventListener(VISITOR_LOCATION_EVENT, handleLocationUpdate);

    return () => window.removeEventListener(VISITOR_LOCATION_EVENT, handleLocationUpdate);
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
