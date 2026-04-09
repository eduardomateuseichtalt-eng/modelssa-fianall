import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function Modelos() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [detectedCity, setDetectedCity] = useState("");
  const [usedNearbyFallback, setUsedNearbyFallback] = useState(false);
  const [usedDeviceLocation, setUsedDeviceLocation] = useState(false);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(50);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let canceled = false;

    const applyItems = (data) => {
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];
      if (!canceled) {
        setModels(items);
      }
    };

    const fetchDefaultModels = () =>
      apiFetch("/api/models?page=1&limit=24")
        .then((data) => {
          applyItems(data);
          if (!canceled) {
            setDetectedCity("");
            setUsedNearbyFallback(false);
            setUsedDeviceLocation(false);
          }
        })
        .catch(() => {
          if (!canceled) {
            setModels([]);
            setDetectedCity("");
            setUsedNearbyFallback(false);
            setUsedDeviceLocation(false);
          }
        });

    const getCurrentPosition = () =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5 * 60 * 1000,
        });
      });

    const params = new URLSearchParams(location.search);
    const cityParam = (params.get("cidade") || params.get("city") || "").trim();
    const attendanceParam = (params.get("atendimento") || "").trim().toLowerCase();
    const serviceParam = attendanceParam === "online" ? "webcam" : attendanceParam;
    setCityFilter(cityParam);
    setAttendanceFilter(attendanceParam);
    setLoading(true);

    if (cityParam || serviceParam) {
      const query = new URLSearchParams();
      query.set("page", "1");
      query.set("limit", "24");
      if (cityParam) {
        query.set("city", cityParam);
      }
      if (serviceParam) {
        query.set("service", serviceParam);
      }

      apiFetch(`/api/models?${query.toString()}`)
        .then((data) => {
          applyItems(data);
          if (!canceled) {
            setDetectedCity(cityParam);
            setUsedNearbyFallback(false);
            setUsedDeviceLocation(false);
          }
        })
        .catch(() => {
          if (!canceled) {
            setModels([]);
            setDetectedCity(cityParam);
            setUsedNearbyFallback(false);
            setUsedDeviceLocation(false);
          }
        })
        .finally(() => {
          if (!canceled) {
            setLoading(false);
          }
        });
      return () => {
        canceled = true;
      };
    }

    if (!navigator.geolocation) {
      fetchDefaultModels().finally(() => {
        if (!canceled) {
          setLoading(false);
        }
      });
      return () => {
        canceled = true;
      };
    }

    (async () => {
      try {
        const position = await getCurrentPosition();
        if (canceled) {
          return;
        }

        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          await fetchDefaultModels();
          return;
        }

        const query = new URLSearchParams();
        query.set("lat", String(latitude));
        query.set("lon", String(longitude));
        query.set("radiusKm", "50");
        query.set("page", "1");
        query.set("limit", "24");

        const data = await apiFetch(`/api/models/auto-nearby?${query.toString()}`);
        if (canceled) {
          return;
        }
        applyItems(data);
        setDetectedCity(String(data?.detectedCity || ""));
        setUsedNearbyFallback(Boolean(data?.fallbackUsed));
        setUsedDeviceLocation(Boolean(data?.usedDeviceLocation));
        setNearbyRadiusKm(Number(data?.radiusKm || 50));
      } catch {
        if (canceled) {
          return;
        }
        await fetchDefaultModels();
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [location.search]);

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const targetId = location.hash.replace("#", "");
    const target = document.getElementById(targetId);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  return (
    <div className="page">
      <h1 className="section-title">
        Acompanhantes <span>disponiveis</span>
      </h1>
      <p className="muted" style={{ marginTop: 10 }}>
        Perfis verificados e organizados por cidade.
      </p>
      <div className="home-gender-filter" style={{ marginTop: 12 }}>
        <span className="home-gender-filter-label">Ver por atendimento:</span>
        <div className="home-gender-filter-actions">
          <button
            type="button"
            className={`home-gender-filter-btn ${
              !attendanceFilter ? "active" : ""
            }`}
            onClick={() => {
              const query = new URLSearchParams();
              if (cityFilter) {
                query.set("cidade", cityFilter);
              }
              navigate(`/modelos${query.toString() ? `?${query.toString()}` : ""}`);
            }}
          >
            Todos
          </button>
          <button
            type="button"
            className={`home-gender-filter-btn ${
              attendanceFilter === "online" ? "active" : ""
            }`}
            onClick={() => {
              const query = new URLSearchParams();
              if (cityFilter) {
                query.set("cidade", cityFilter);
              }
              query.set("atendimento", "online");
              navigate(`/modelos?${query.toString()}`);
            }}
          >
            Webcam
          </button>
        </div>
      </div>
      {!cityFilter && usedDeviceLocation && detectedCity ? (
        <p className="muted" style={{ marginTop: 8 }}>
          {usedNearbyFallback
            ? `Nao encontramos acompanhantes em ${detectedCity}. Mostrando cidades proximas em ate ${nearbyRadiusKm} km.`
            : `Mostrando acompanhantes em ${detectedCity} com base na localizacao do seu aparelho.`}
        </p>
      ) : null}

      {loading ? (
        <p style={{ marginTop: 24 }}>Carregando acompanhantes...</p>
      ) : models.length === 0 && !cityFilter ? (
        <div style={{ marginTop: 24 }}>
          {usedDeviceLocation && detectedCity ? (
            <p className="muted">
              Nao encontramos acompanhantes em {detectedCity} nem em cidades proximas ({nearbyRadiusKm} km).
            </p>
          ) : null}
          <div className="models-grid public-models-grid">
            <Link to="/seja-modelo" className="model-card public-model-card">
              <img
                className="model-photo public-model-photo"
                src="/foto/ChatGPT Image 9 de jan. de 2026, 15_38_16.png"
                alt="Acompanhante em destaque"
                loading="lazy"
              />
              <div className="model-info">
                <h3>Acompanhante em destaque</h3>
                <p>Seu perfil pode aparecer aqui</p>
              </div>
            </Link>
          </div>
        </div>
      ) : models.length === 0 && cityFilter ? (
        <div style={{ marginTop: 24 }}>
          <p className="muted">
            Nao encontramos acompanhantes em {cityFilter}. Tente outra cidade.
          </p>
          <Link to="/modelos" className="btn btn-outline" style={{ marginTop: 16 }}>
            Ver todas as acompanhantes
          </Link>
        </div>
      ) : (
        <div className="models-grid public-models-grid">
          {models.map((model) => (
            <Link
              to={`/modelos/${model.id}`}
              key={model.id}
              className="model-card public-model-card"
            >
              <div className="model-photo-frame">
                <img
                  className="model-photo public-model-photo"
                  src={model.coverUrl || model.avatarUrl || "/model-placeholder.svg"}
                  alt={model.name}
                  loading="lazy"
                />
                {Array.isArray(model.offeredServices) &&
                model.offeredServices.some((service) =>
                  String(service || "").toLowerCase().includes("webcam")
                ) ? (
                  <span className="model-badge model-badge-webcam">Webcam</span>
                ) : null}
              </div>
              <div className="model-info">
                <h3>{model.name}</h3>
                <p>{model.city || "Brasil"}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
