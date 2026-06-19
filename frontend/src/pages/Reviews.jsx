import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

const formatStars = (value) => {
  const score = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return `${"★".repeat(score)}${"☆".repeat(5 - score)}`;
};

export default function Reviews() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/model-reviews/top-models?limit=40")
      .then((data) => {
        setModels(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((err) => {
        setError(err.message || "Erro ao carregar avaliacoes.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="page">
      <h1 className="section-title">
        Avaliacoes <span>dos clientes</span>
      </h1>

      {loading ? (
        <p style={{ marginTop: 24 }}>Carregando avaliacoes...</p>
      ) : error ? (
        <div className="notice" style={{ marginTop: 24 }}>{error}</div>
      ) : models.length === 0 ? (
        <div className="card" style={{ marginTop: 24 }}>
          <p className="muted">Ainda nao existem avaliacoes publicas.</p>
        </div>
      ) : (
        <div className="models-grid home-models-grid" style={{ marginTop: 18 }}>
          {models.map((model) => (
            <Link
              key={model.id}
              to={`/modelos/${model.id}`}
              className="model-card home-model-card"
            >
              <div className="home-model-photo-frame">
                <img
                  className="model-photo home-model-photo"
                  src={
                    (model.galleryPreviewPhotos && model.galleryPreviewPhotos[0]) ||
                    model.coverUrl ||
                    model.avatarUrl ||
                    "/model-placeholder.svg"
                  }
                  alt={model.name}
                  loading="lazy"
                />
              </div>
              <div className="model-info">
                <h3>{model.name}</h3>
                <p>{model.city || "Brasil"}</p>
                <p className="muted" style={{ marginTop: 6 }}>
                  {formatStars(model.averageRating)} {model.averageRating.toFixed(1)}/5
                </p>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {model.reviewCount} avaliacoes
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
