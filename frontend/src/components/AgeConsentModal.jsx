import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { saveVisitorLocation } from "../lib/visitorLocation";

const DETECTED_CITY_STORAGE_KEY = "modelsClubDetectedCity";
const DETECTED_CITY_UPDATED_AT_KEY = "modelsClubDetectedCityUpdatedAt";

export default function AgeConsentModal() {
  const [visible, setVisible] = useState(true);
  const [showLocationBar, setShowLocationBar] = useState(false);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [detectedCity, setDetectedCity] = useState("");

  useEffect(() => {
    const resetPromptState = () => {
      setVisible(true);
      setShowLocationBar(false);
      setLocationStatus("idle");
      setLocationMessage("");

      try {
        const storedCity = localStorage.getItem(DETECTED_CITY_STORAGE_KEY);
        if (storedCity) {
          setDetectedCity(storedCity);
        } else {
          setDetectedCity("");
        }
      } catch {
        setDetectedCity("");
      }
    };

    resetPromptState();
    window.addEventListener("pageshow", resetPromptState);

    return () => {
      window.removeEventListener("pageshow", resetPromptState);
    };
  }, []);

  async function requestLocation() {
    if (!navigator?.geolocation) {
      setLocationStatus("unsupported");
      setLocationMessage("Seu navegador não suporta geolocalização.");
      setShowLocationBar(false);
      return;
    }

    setLocationStatus("locating");
    setLocationMessage("Buscando sua localização...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = Number(position.coords.latitude);
          const lon = Number(position.coords.longitude);
          const params = new URLSearchParams({
            format: "jsonv2",
            lat: String(lat),
            lon: String(lon),
            zoom: "10",
            addressdetails: "1",
          });

          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?${params.toString()}`
          );

          if (!response.ok) {
            throw new Error("Não foi possível identificar a cidade.");
          }

          const data = await response.json();
          const address = data?.address || {};
          const city =
            address.city ||
            address.town ||
            address.municipality ||
            address.village ||
            address.county ||
            "";

          if (!city) {
            throw new Error("Cidade não identificada.");
          }

          const cityName = String(city);
          const region = String(
            address.state || address.region || address.state_district || ""
          ).trim();
          const countryCode = String(address.country_code || "")
            .trim()
            .slice(0, 2)
            .toUpperCase();
          setDetectedCity(cityName);
          setLocationStatus("ready");
          setLocationMessage(`Localização atualizada para ${cityName}.`);
          setShowLocationBar(false);

          try {
            localStorage.setItem(DETECTED_CITY_STORAGE_KEY, cityName);
            localStorage.setItem(DETECTED_CITY_UPDATED_AT_KEY, new Date().toISOString());
          } catch {
            // ignore storage issues
          }
          saveVisitorLocation({ city: cityName, region, countryCode });
        } catch (error) {
          setLocationStatus("error");
          setLocationMessage(error?.message || "Não foi possível detectar sua cidade.");
        }
      },
      (error) => {
        const message =
          error?.code === 1
            ? "Permissão de localização negada."
            : "Não foi possível obter sua localização.";
        setLocationStatus("denied");
        setLocationMessage(message);
        setShowLocationBar(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  function startLocationPrompt() {
    setLocationStatus("idle");
    setLocationMessage("Usaremos o GPS para descobrir a sua cidade e atualizar a busca automaticamente.");
    setShowLocationBar(true);
    void requestLocation();
  }

  function accept() {
    setVisible(false);
    startLocationPrompt();
  }

  function dismissLocationPrompt() {
    setShowLocationBar(false);
    setLocationStatus("idle");
    setLocationMessage("");
  }

  if (!visible && !showLocationBar) return null;

  return (
    <>
      {visible ? (
        <div className="age-modal">
          <div className="age-card">
            <div className="age-title">
              <span className="age-badge">18+</span>
              <div>
                <h2>CONTEUDO ADULTO</h2>
                <p className="age-lead">
                  Entendo que o site models-club apresenta conteudo explicito
                  destinado a adultos. {" "}
                  <Link to="/termos" className="age-link">
                    Termos de uso
                  </Link>
                </p>
              </div>
            </div>

            <div className="age-divider" />

            <h3>AVISO DE COOKIES</h3>
            <p className="age-text">
              Nos usamos cookies e outras tecnologias semelhantes para melhorar a
              sua experiencia em nosso site.
            </p>

            <div className="age-divider" />

            <p className="age-text">
              A profissao de acompanhante e legalizada no Brasil e deve ser
              respeitada. {" "}
              <Link to="/sobre" className="age-link">
                Saiba mais
              </Link>
            </p>

            <div className="age-actions">
              <Link to="/faq" className="age-button age-button-secondary" onClick={accept}>
                RELATAR DENÚNCIA
              </Link>
              <button className="age-button" onClick={accept}>
                Concordo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLocationBar ? (
        <div className="location-bar-float" role="dialog" aria-live="polite">
          <div className="location-bar-card">
            <span className="location-bar-pill">GPS</span>
            <h3 className="location-bar-title">Ative a localização para encontrar acompanhantes próximas</h3>
            <p className="location-bar-text">
              {locationMessage || "Usaremos o GPS para descobrir a sua cidade e atualizar a busca automaticamente."}
            </p>
            {detectedCity ? (
              <p className="location-bar-status">Cidade atual: {detectedCity}</p>
            ) : null}
            <div className="location-bar-actions">
              <button className="age-button age-button-secondary" onClick={dismissLocationPrompt}>
                Agora não
              </button>
              <button className="age-button" onClick={() => void requestLocation()}>
                {locationStatus === "locating" ? "Buscando..." : "Permitir localização"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
