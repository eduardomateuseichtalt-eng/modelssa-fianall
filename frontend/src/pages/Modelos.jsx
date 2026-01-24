import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function Modelos() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("");
  const location = useLocation();

  useEffect(() => {
    apiFetch("/api/models")
      .then((data) => setModels(data))
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cityParam = params.get("cidade") || "";
    setCityFilter(cityParam.trim());
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

  const normalizeText = (value) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const normalizedCity = normalizeText(cityFilter);
  const filteredModels = cityFilter
    ? models.filter((model) =>
        normalizeText(model.city || "").includes(normalizedCity)
      )
    : models;

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
      ) : models.length === 0 ? (
        <div className="models-grid">
          <Link to="/seja-modelo" className="model-card">
            <img
              className="model-photo"
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
      ) : filteredModels.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <p className="muted">
            Nao encontramos acompanhantes em {cityFilter}. Tente outra cidade.
          </p>
          <Link to="/modelos" className="btn btn-outline" style={{ marginTop: 16 }}>
            Ver todas as acompanhantes
          </Link>
        </div>
      ) : (
        <div className="models-grid">
          {filteredModels.map((model) => (
            <Link to={`/modelos/${model.id}`} key={model.id} className="model-card">
              <img
                className="model-photo"
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

      <section className="section" id="avaliacoes">
        <h2 className="section-title">
          Avaliacoes de <span>clientes</span>
        </h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Depoimentos reais ajudam a escolher com mais seguranca. Assim que os
          clientes publicarem avaliacoes, elas vao aparecer aqui.
        </p>
        <div className="cards">
          <div className="card">
            <h4>Atendimento impecavel</h4>
            <p className="muted">
              Experiencia segura, comunicacao clara e perfil fiel ao anunciado.
            </p>
          </div>
          <div className="card">
            <h4>Perfil verificado</h4>
            <p className="muted">
              Confirmacao de identidade e fotos atuais antes de liberar o anuncio.
            </p>
          </div>
          <div className="card">
            <h4>Ambiente discreto</h4>
            <p className="muted">
              Privacidade garantida para clientes e modelos durante o contato.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
