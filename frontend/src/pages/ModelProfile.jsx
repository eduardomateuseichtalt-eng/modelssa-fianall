import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function ModelProfile() {
  const { id } = useParams();
  const [model, setModel] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactText, setContactText] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("media");
  const contactSectionRef = useRef(null);

  useEffect(() => {
    apiFetch(`/api/models/${id}`)
      .then((data) => setModel(data))
      .catch(() => setModel(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    apiFetch(`/api/media/model/${id}`)
      .then((data) => setMedia(data))
      .catch(() => setMedia([]));
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <p>Carregando perfil...</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="page">
        <p>Modelo nao encontrada.</p>
        <div className="form-actions">
          <Link to="/modelos" className="btn btn-outline">
            Voltar para modelos
          </Link>
        </div>
      </div>
    );
  }

  const wa = String(model.whatsapp || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(
    `olá ${model.name}! vi seu perfil no models-club e gostaria de marcar um atendimento. quando você tem disponibilidade?`
  );
  const waWebUrl = wa ? `https://wa.me/${wa}?text=${waMsg}` : "";
  const waAppUrl = wa ? `whatsapp://send?phone=${wa}&text=${waMsg}` : "";

  const handleOpenWhatsApp = (event) => {
    event.preventDefault();

    if (!waAppUrl || !waWebUrl) {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      window.location.href = waWebUrl;
    }, 1200);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.clearTimeout(fallbackTimer);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange, {
      once: true,
    });

    window.location.href = waAppUrl;
  };

  const openContactSection = () => {
    setActiveTab("about");
    window.setTimeout(() => {
      contactSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const mediaPhotos = media.filter((item) => item.type !== "VIDEO");
  const mediaVideos = media.filter((item) => item.type === "VIDEO");
  const totalMediaCount = media.length;

  const profileDetails = [
    { label: "Altura", value: model.height ? `${model.height} cm` : "--" },
    { label: "Peso", value: model.weight ? `${model.weight} kg` : "--" },
    { label: "Busto", value: model.bust ? `${model.bust} cm` : "--" },
    { label: "Cintura", value: model.waist ? `${model.waist} cm` : "--" },
    { label: "Quadril", value: model.hips ? `${model.hips} cm` : "--" },
    { label: "Valor por hora", value: model.priceHour ? `R$ ${model.priceHour}` : "--" },
  ];

  return (
    <div className="page">
      <section className="profile-public-shell">
        <div className="profile-public-hero">
          <div className="profile-public-cover">
            <img
              className="model-photo"
              src={model.coverUrl || model.avatarUrl || "/model-placeholder.svg"}
              alt={model.name}
            />
          </div>

          <div className="profile-public-panel">
            <div className="profile-public-header">
              <img
                className="profile-public-avatar"
                src={model.avatarUrl || model.coverUrl || "/model-placeholder.svg"}
                alt={model.name}
              />

              <div className="profile-public-header-info">
                <div className="profile-public-title-row">
                  <h1>{model.name}</h1>
                  <span className="pill">Perfil verificado</span>
                </div>
                <p className="muted">{model.city || "Brasil"}</p>
                <p className="profile-public-bio">
                  {model.bio || "Perfil exclusivo. Entre em contato para mais detalhes."}
                </p>

                <div className="tag-list profile-public-tags">
                  <span className="pill">{model.instagram || "@instagram"}</span>
                  <span className="pill">{model.whatsapp || "WhatsApp"}</span>
                </div>
              </div>
            </div>

            <div className="profile-public-top-cards">
              <div className="profile-public-mini-card">
                <span>Valor por hora</span>
                <strong>{model.priceHour ? `R$ ${model.priceHour}` : "Consultar"}</strong>
              </div>
              <div className="profile-public-mini-card">
                <span>Localizacao</span>
                <strong>{model.city || "Nao informado"}</strong>
              </div>
              <div className="profile-public-mini-card">
                <span>Midias</span>
                <strong>{totalMediaCount}</strong>
              </div>
            </div>

            <div className="profile-public-cta">
              <button className="btn" type="button" onClick={openContactSection}>
                Entrar em contato
              </button>
              {wa && wa.length >= 10 ? (
                <a
                  className="btn profile-public-whatsapp"
                  href={waWebUrl}
                  onClick={handleOpenWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Chamar no WhatsApp
                </a>
              ) : (
                <button className="btn btn-outline" type="button" onClick={openContactSection}>
                  Enviar mensagem
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="profile-public-tabs" role="tablist" aria-label="Abas do perfil">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "media"}
            className={`profile-public-tab ${activeTab === "media" ? "active" : ""}`}
            onClick={() => setActiveTab("media")}
          >
            Fotos e videos ({totalMediaCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "about"}
            className={`profile-public-tab ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            Sobre mim
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reviews"}
            className={`profile-public-tab ${activeTab === "reviews" ? "active" : ""}`}
            onClick={() => setActiveTab("reviews")}
          >
            Avaliacoes
          </button>
        </div>

        <div className="profile-public-content">
          {activeTab === "media" ? (
            <section className="profile-public-section">
              <div className="profile-public-section-head">
                <h2>Galeria de fotos e videos</h2>
                <div className="profile-public-counters">
                  <span className="pill">{mediaPhotos.length} fotos</span>
                  <span className="pill">{mediaVideos.length} videos</span>
                </div>
              </div>

              {totalMediaCount > 0 ? (
                <div className="profile-public-media-grid">
                  {media.map((item) =>
                    item.type === "VIDEO" ? (
                      <div key={item.id} className="profile-public-media-card is-video">
                        <video src={item.url} controls preload="metadata" />
                      </div>
                    ) : (
                      <div key={item.id} className="profile-public-media-card">
                        <img src={item.url} alt="Midia da modelo" loading="lazy" />
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="card">
                  <h4>Sem midias publicadas</h4>
                  <p className="muted">
                    A modelo ainda nao publicou fotos ou videos aprovados.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "about" ? (
            <section className="profile-public-section">
              <div className="profile-public-split">
                <div className="card profile-public-block">
                  <h4>Descricao</h4>
                  <p className="muted profile-public-paragraph">
                    {model.bio || "Perfil exclusivo. Entre em contato para mais detalhes."}
                  </p>

                  <div className="divider" />
                  <h4>Contato e redes</h4>
                  <div className="tag-list" style={{ marginTop: 12 }}>
                    <span className="pill">{model.instagram || "@instagram"}</span>
                    <span className="pill">{model.whatsapp || "WhatsApp"}</span>
                    <span className="pill">{model.city || "Brasil"}</span>
                  </div>

                  <div className="form-actions" style={{ marginTop: 16 }}>
                    <Link to="/faq" className="btn btn-outline">
                      Denunciar perfil
                    </Link>
                  </div>
                </div>

                <div className="card profile-public-block">
                  <h4>Caracteristicas fisicas</h4>
                  <div className="profile-public-details-grid">
                    {profileDetails.map((item) => (
                      <div key={item.label} className="profile-public-detail-row">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="section profile-public-contact" ref={contactSectionRef}>
                <h2 className="section-title">Entrar em contato direto</h2>
                <p className="muted" style={{ marginTop: 10 }}>
                  Envie uma mensagem para a modelo. As mensagens nao ficam salvas.
                </p>

                {contactMessage && <div className="notice">{contactMessage}</div>}
                {contactError && <div className="notice">{contactError}</div>}

                <div className="form-grid" style={{ marginTop: 16 }}>
                  <input
                    className="input"
                    placeholder="Seu nome (opcional)"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="WhatsApp (opcional)"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                  />
                  <textarea
                    className="textarea"
                    placeholder="Escreva sua mensagem"
                    value={contactText}
                    onChange={(event) => setContactText(event.target.value)}
                    rows={4}
                  />
                  <div className="form-actions">
                    <button
                      className="btn"
                      type="button"
                      disabled={contactLoading || contactText.trim().length === 0}
                      onClick={async () => {
                        setContactError("");
                        setContactMessage("");
                        const text = contactText.trim();
                        if (!text) {
                          setContactError("Digite uma mensagem para enviar.");
                          return;
                        }
                        setContactLoading(true);
                        try {
                          await apiFetch(`/api/messages/${id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              text,
                              fromName: contactName.trim(),
                              fromPhone: contactPhone.trim(),
                            }),
                          });
                          setContactMessage("Mensagem enviada com sucesso.");
                          setContactText("");
                        } catch (err) {
                          setContactError(err.message || "Erro ao enviar mensagem.");
                        } finally {
                          setContactLoading(false);
                        }
                      }}
                    >
                      {contactLoading ? "Enviando..." : "Enviar mensagem"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "reviews" ? (
            <section className="profile-public-section">
              <div className="profile-public-section-head">
                <h2>Avaliacoes de clientes</h2>
                <span className="pill">Em breve</span>
              </div>

              <p className="muted" style={{ marginTop: 10 }}>
                Depoimentos reais ajudam a escolher com mais seguranca. Assim que os
                clientes publicarem avaliacoes, elas vao aparecer aqui.
              </p>

              <div className="cards profile-public-reviews">
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
          ) : null}
        </div>
      </section>
    </div>
  );
}

