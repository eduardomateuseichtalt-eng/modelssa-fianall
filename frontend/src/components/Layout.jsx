import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AgeConsentModal from "./AgeConsentModal";
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

    localStorage.setItem("siteVisitTrackedDay", todayKey);
    apiFetch("/api/metrics/visit", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div className="app">
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
