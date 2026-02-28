import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function Modelos() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("");
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cityParam = (params.get("cidade") || params.get("city") || "").trim();
    setCityFilter(cityParam);

    const query = new URLSearchParams();
    query.set("page", "1");
    query.set("limit", "24");
    if (cityParam) {
      query.set("city", cityParam);
    }

    setLoading(true);
    apiFetch(`/api/models?${query.toString()}`)
      .then((data) => {
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setModels(items);
      })
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
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
        Modelos <span>disponiveis</span>
      </h1>
      <p className="muted" style={{ marginTop: 10 }}>
        Perfis verificados e organizados por cidade.
      </p>

      {loading ? (
        <p style={{ marginTop: 24 }}>Carregando modelos...</p>
      ) : models.length === 0 && !cityFilter ? (
        <div className="models-grid public-models-grid">
          <Link to="/seja-modelo" className="model-card public-model-card">
            <img
              className="model-photo public-model-photo"
              src="/foto/ChatGPT Image 9 de jan. de 2026, 15_38_16.png"
              alt="Modelo em destaque"
              loading="lazy"
            />
            <div className="model-info">
              <h3>Modelo em destaque</h3>
              <p>Seu perfil pode aparecer aqui</p>
            </div>
          </Link>
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
              <img
                className="model-photo public-model-photo"
                src={model.coverUrl || model.avatarUrl || "/model-placeholder.svg"}
                alt={model.name}
                loading="lazy"
              />
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
