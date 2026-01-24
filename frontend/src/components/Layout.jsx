import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import AgeConsentModal from "./AgeConsentModal";
import { apiFetch } from "../lib/api";

export default function Layout() {
  useEffect(() => {
    if (sessionStorage.getItem("siteVisitTracked")) {
      return;
    }

    sessionStorage.setItem("siteVisitTracked", "true");
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
