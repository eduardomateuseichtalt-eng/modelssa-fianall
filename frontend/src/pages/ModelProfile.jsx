import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function ModelProfile() {
  const { id } = useParams();
  const [model, setModel] = useState(null);
  const [media, setMedia] = useState([]);
  const [comparisonMedia, setComparisonMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactText, setContactText] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("media");
  const [modelShots, setModelShots] = useState([]);
  const [shotsLoading, setShotsLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewLocal, setReviewLocal] = useState(0);
  const [reviewService, setReviewService] = useState(0);
  const [reviewBody, setReviewBody] = useState(0);
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewNotice, setReviewNotice] = useState("");
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [viewerMode, setViewerMode] = useState("");
  const [selectedPriceOption, setSelectedPriceOption] = useState("hour");
  const [priceOptionsOpen, setPriceOptionsOpen] = useState(false);
  const contactSectionRef = useRef(null);
  const priceCardRef = useRef(null);

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

  useEffect(() => {
    let active = true;
    apiFetch(`/api/media/model/${id}/comparison`)
      .then((data) => {
        if (active) {
          setComparisonMedia(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (active) {
          setComparisonMedia([]);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    setShotsLoading(true);
    apiFetch(`/api/shots?modelId=${encodeURIComponent(id)}`)
      .then((data) => {
        if (!active) return;
        const ownShots = Array.isArray(data)
          ? data.filter((shot) => String(shot?.model?.id || "") === String(id))
          : [];
        setModelShots(ownShots);
      })
      .catch(() => {
        if (active) setModelShots([]);
      })
      .finally(() => {
        if (active) setShotsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    setReviewsLoading(true);
    setReviewsError("");

    apiFetch(`/api/model-reviews/${id}`)
      .then((data) => {
        if (!active) {
          return;
        }
        setReviews(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setReviews([]);
        setReviewsError(err.message || "Nao foi possivel carregar as avaliacoes.");
      })
      .finally(() => {
        if (active) {
          setReviewsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!avatarMenuOpen && !viewerMode) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setAvatarMenuOpen(false);
        setViewerMode("");
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [avatarMenuOpen, viewerMode]);

  useEffect(() => {
    if (!priceOptionsOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (priceCardRef.current && !priceCardRef.current.contains(event.target)) {
        setPriceOptionsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setPriceOptionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [priceOptionsOpen]);

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
  const hasShots = modelShots.length > 0;
  const hasHalfHourPrice = Number(model.price30Min || 0) > 0;
  const priceOptions = [
    {
      id: "hour",
      optionLabel: "1 hora",
      cardLabel: "Valor por hora",
      value: model.priceHour ? `R$ ${model.priceHour}` : "Consultar",
    },
    ...(hasHalfHourPrice
      ? [
          {
            id: "half",
            optionLabel: "30 minutos",
            cardLabel: "Valor 30 min",
            value: `R$ ${model.price30Min}`,
          },
        ]
      : []),
  ];
  const activePriceOption =
    priceOptions.find((item) => item.id === selectedPriceOption) || priceOptions[0];
  const topPriceLabel = activePriceOption?.cardLabel || "Valor por hora";
  const topPriceValue = activePriceOption?.value || "Consultar";
  const profileImageUrl = model.avatarUrl || model.coverUrl || "/model-placeholder.svg";
  const comparisonVideo = comparisonMedia.find((item) => item.type === "VIDEO") || null;
  const comparisonMediaCandidate =
    comparisonVideo ||
    [...mediaVideos].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    })[0] ||
    null;

  const profileDetails = [
    { label: "15 minutos", value: model.price15Min ? `R$ ${model.price15Min}` : "--" },
    { label: "30 minutos", value: model.price30Min ? `R$ ${model.price30Min}` : "--" },
    { label: "Altura", value: model.height ? `${model.height} cm` : "--" },
    { label: "Peso", value: model.weight ? `${model.weight} kg` : "--" },
    { label: "Busto", value: model.bust ? `${model.bust} cm` : "--" },
    { label: "Cintura", value: model.waist ? `${model.waist} cm` : "--" },
    { label: "Quadril", value: model.hips ? `${model.hips} cm` : "--" },
    { label: "Valor por hora", value: model.priceHour ? `R$ ${model.priceHour}` : "--" },
  ];

  const openAvatarMenu = () => {
    if (!hasShots) {
      setViewerMode("avatar");
      return;
    }
    setAvatarMenuOpen(true);
  };

  const openProfilePhotoViewer = () => {
    setAvatarMenuOpen(false);
    setViewerMode("avatar");
  };

  const openShotsViewer = () => {
    setAvatarMenuOpen(false);
    setViewerMode("shots");
  };

  const closeOverlays = () => {
    setAvatarMenuOpen(false);
    setViewerMode("");
  };

  const ratingToStars = (value) => {
    const score = Math.max(0, Math.min(5, Number(value) || 0));
    return `${"★".repeat(score)}${"☆".repeat(5 - score)}`;
  };

  const averageScore = reviews.length
    ? (
        reviews.reduce((sum, item) => {
          const localScore = Number(item.ratingLocal || 0);
          const serviceScore = Number(item.ratingService || 0);
          const bodyScore = Number(item.ratingBody || 0);
          return sum + (localScore + serviceScore + bodyScore) / 3;
        }, 0) / reviews.length
      ).toFixed(1)
    : null;

  const RatingInput = ({ label, value, onChange }) => (
    <div className="profile-review-rating-row">
      <span>{label}</span>
      <div className="profile-review-stars-input" role="radiogroup" aria-label={label}>
        {[0, 1, 2, 3, 4, 5].map((score) => (
          <button
            key={`${label}-${score}`}
            type="button"
            className={`profile-review-star-btn ${value === score ? "active" : ""}`}
            onClick={() => onChange(score)}
            aria-label={`${score} estrelas`}
            aria-pressed={value === score}
          >
            {score === 0 ? "0" : "★".repeat(score)}
          </button>
        ))}
      </div>
    </div>
  );

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
              <button
                type="button"
                className={`profile-public-avatar-button ${hasShots ? "has-shots" : ""}`}
                onClick={openAvatarMenu}
                aria-label={hasShots ? "Abrir opcoes de foto e shots" : "Ver foto de perfil"}
              >
                <span className="profile-public-avatar-ring">
                  <img
                    className="profile-public-avatar"
                    src={profileImageUrl}
                    alt={model.name}
                  />
                </span>
                {hasShots ? <span className="profile-public-avatar-status">shots</span> : null}
              </button>

              <div className="profile-public-header-info">
                <div className="profile-public-title-row">
                  <h1>{model.name}</h1>
                  <span className="pill">Perfil verificado</span>
                  <span
                    className={`pill profile-public-online-pill ${
                      model.isOnline ? "online" : "offline"
                    }`}
                  >
                    {model.isOnline ? "Online" : "Offline"}
                  </span>
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
              <div className="profile-public-price-card-wrap" ref={priceCardRef}>
                {priceOptionsOpen && hasHalfHourPrice ? (
                  <div className="profile-public-price-options">
                    {priceOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`profile-public-price-option ${
                          selectedPriceOption === option.id ? "active" : ""
                        }`}
                        onClick={() => {
                          setSelectedPriceOption(option.id);
                          setPriceOptionsOpen(false);
                        }}
                      >
                        <span>{option.optionLabel}</span>
                        <strong>{option.value}</strong>
                      </button>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  className={`profile-public-mini-card profile-public-price-toggle ${
                    hasHalfHourPrice ? "is-clickable" : ""
                  }`}
                  onClick={() => {
                    if (!hasHalfHourPrice) return;
                    setPriceOptionsOpen((current) => !current);
                  }}
                  aria-expanded={priceOptionsOpen}
                  aria-label={
                    hasHalfHourPrice
                      ? "Abrir opcoes de preco por 30 minutos e 1 hora"
                      : "Valor por hora"
                  }
                  title={
                    hasHalfHourPrice
                      ? "Clique para ver opcoes de 30 minutos e 1 hora"
                      : "Valor por hora"
                  }
                >
                  <span>{topPriceLabel}</span>
                  <strong>{topPriceValue}</strong>
                </button>
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
                <>
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

                  <div className="profile-public-comparison">
                    <div className="profile-public-section-head">
                      <h2>Midia de comparacao</h2>
                      <span className="pill">Cadastro</span>
                    </div>
                    <p className="muted">
                      Este video ajuda o cliente a comparar as fotos publicadas com a
                      pessoa do cadastro.
                    </p>

                    {comparisonMediaCandidate ? (
                      <div className="profile-public-comparison-video">
                        <video
                          src={comparisonMediaCandidate.url}
                          controls
                          preload="metadata"
                          playsInline
                        />
                      </div>
                    ) : (
                      <div className="card">
                        <h4>Sem video de comparacao visivel</h4>
                        <p className="muted">
                          O video de comparacao ainda nao foi aprovado ou nao esta
                          disponivel no momento.
                        </p>
                      </div>
                    )}
                  </div>
                </>
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
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setReviewFormOpen((current) => !current);
                    setReviewNotice("");
                    setReviewSubmitError("");
                  }}
                >
                  {reviewFormOpen ? "Fechar avaliacao" : "Avaliar atendimento"}
                </button>
              </div>

              <p className="muted" style={{ marginTop: 10 }}>
                Relate em poucas palavras como foi o atendimento e avalie de 0 a 5
                estrelas para local, atendimento e avaliacao corporal.
              </p>

              {averageScore ? (
                <p className="muted" style={{ marginTop: 8 }}>
                  Media geral: <strong>{averageScore}/5</strong> em {reviews.length} avaliacao(oes).
                </p>
              ) : null}

              {reviewNotice ? <div className="notice">{reviewNotice}</div> : null}
              {reviewSubmitError ? <div className="notice">{reviewSubmitError}</div> : null}

              {reviewFormOpen ? (
                <div className="card profile-review-form-card">
                  <textarea
                    className="textarea"
                    rows={4}
                    maxLength={280}
                    placeholder="Relate em poucas palavras como foi seu atendimento."
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                  />
                  <p className="muted profile-review-char-count">
                    {reviewText.trim().length}/280 caracteres
                  </p>

                  <RatingInput label="Local" value={reviewLocal} onChange={setReviewLocal} />
                  <RatingInput
                    label="Atendimento"
                    value={reviewService}
                    onChange={setReviewService}
                  />
                  <RatingInput
                    label="Avaliacao corporal"
                    value={reviewBody}
                    onChange={setReviewBody}
                  />

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn"
                      disabled={
                        reviewSending ||
                        reviewText.trim().length < 8
                      }
                      onClick={async () => {
                        setReviewNotice("");
                        setReviewSubmitError("");
                        const payload = {
                          comment: reviewText.trim(),
                          ratingLocal: reviewLocal,
                          ratingService: reviewService,
                          ratingBody: reviewBody,
                        };
                        if (payload.comment.length < 8) {
                          setReviewSubmitError("Escreva pelo menos 8 caracteres no relato.");
                          return;
                        }
                        setReviewSending(true);
                        try {
                          const created = await apiFetch(`/api/model-reviews/${id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload),
                          });
                          setReviews((prev) => [created, ...prev]);
                          setReviewText("");
                          setReviewLocal(0);
                          setReviewService(0);
                          setReviewBody(0);
                          setReviewFormOpen(false);
                          setReviewNotice("Avaliacao enviada com sucesso.");
                        } catch (err) {
                          setReviewSubmitError(err.message || "Nao foi possivel enviar avaliacao.");
                        } finally {
                          setReviewSending(false);
                        }
                      }}
                    >
                      {reviewSending ? "Enviando..." : "Enviar avaliacao"}
                    </button>
                  </div>
                </div>
              ) : null}

              {reviewsError ? <div className="notice">{reviewsError}</div> : null}

              {reviewsLoading ? (
                <p className="muted" style={{ marginTop: 14 }}>
                  Carregando avaliacoes...
                </p>
              ) : reviews.length === 0 ? (
                <div className="card" style={{ marginTop: 14 }}>
                  <p className="muted">
                    Ainda nao existem avaliacoes para este perfil.
                  </p>
                </div>
              ) : (
                <div className="cards profile-public-reviews">
                  {reviews.map((item) => (
                    <div className="card profile-review-card" key={item.id}>
                      <p className="profile-review-comment">{item.comment}</p>
                      <div className="profile-review-metrics">
                        <span>Local: {ratingToStars(item.ratingLocal)}</span>
                        <span>Atendimento: {ratingToStars(item.ratingService)}</span>
                        <span>Avaliacao corporal: {ratingToStars(item.ratingBody)}</span>
                      </div>
                      <p className="muted profile-review-date">
                        {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </section>

      {avatarMenuOpen ? (
        <div className="profile-public-overlay" role="presentation" onClick={closeOverlays}>
          <div
            className="profile-public-choice-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Opcoes de visualizacao"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>O que deseja ver?</h3>
            <div className="profile-public-choice-actions">
              <button type="button" className="btn" onClick={openProfilePhotoViewer}>
                Ver foto de perfil
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={openShotsViewer}
                disabled={!hasShots || shotsLoading}
              >
                {shotsLoading ? "Carregando shots..." : "Ver shots"}
              </button>
            </div>
            {!hasShots && !shotsLoading ? (
              <p className="muted" style={{ marginTop: 12 }}>
                Essa modelo ainda nao publicou shots.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {viewerMode === "avatar" ? (
        <div className="profile-public-overlay" role="presentation" onClick={closeOverlays}>
          <div
            className="profile-public-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Foto de perfil"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-public-viewer-head">
              <h3>Foto de perfil</h3>
              <button type="button" className="btn btn-outline" onClick={closeOverlays}>
                Fechar
              </button>
            </div>
            <div className="profile-public-viewer-media">
              <img src={profileImageUrl} alt={model.name} />
            </div>
          </div>
        </div>
      ) : null}

      {viewerMode === "shots" ? (
        <div className="profile-public-overlay" role="presentation" onClick={closeOverlays}>
          <div
            className="profile-public-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Shots da modelo"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-public-viewer-head">
              <h3>Shots de {model.name}</h3>
              <button type="button" className="btn btn-outline" onClick={closeOverlays}>
                Fechar
              </button>
            </div>

            {modelShots.length > 0 ? (
              <div className="profile-public-shots-grid">
                {modelShots.map((shot) => (
                  <div key={shot.id} className="profile-public-shot-item">
                    {shot.type === "VIDEO" && shot.videoUrl ? (
                      <video
                        src={shot.videoUrl}
                        controls
                        preload="metadata"
                        poster={shot.posterUrl || undefined}
                      />
                    ) : shot.imageUrl ? (
                      <img src={shot.imageUrl} alt={`Shot de ${model.name}`} loading="lazy" />
                    ) : (
                      <div className="shot-placeholder">Shot indisponivel</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Essa modelo ainda nao publicou shots.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

