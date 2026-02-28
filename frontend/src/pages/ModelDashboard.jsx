import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

const MAX_PHOTOS = 12;
const MAX_VIDEOS = 3;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_SHOT_VIDEO_SECONDS = 10;
const MAX_SHOT_PHOTOS = 2;

const formatSize = (value) => {
  if (!value && value !== 0) {
    return "";
  }
  const mb = value / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = value / 1024;
  return `${Math.round(kb)} KB`;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);

const stripImageMetadata = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Nao foi possivel processar a imagem."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error("Nao foi possivel processar a imagem."));
            return;
          }
          resolve(
            new File([blob], file.name, {
              type: file.type || "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        file.type || "image/jpeg",
        0.92
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel ler a imagem."));
    };
    img.src = url;
  });

const getVideoDuration = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration || 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel ler o video."));
    };
    video.src = url;
  });

export default function ModelDashboard() {
  const navigate = useNavigate();
  const confirmMediaAccess = () =>
    window.confirm(
      "Voce autoriza o site a acessar a galeria ou a camera do seu dispositivo?"
    );
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [mediaError, setMediaError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentMedia, setCurrentMedia] = useState([]);
  const [shotFiles, setShotFiles] = useState([]);
  const [shotPreviews, setShotPreviews] = useState([]);
  const [shotError, setShotError] = useState("");
  const [shotMessage, setShotMessage] = useState("");
  const [shotLoading, setShotLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageError, setMessageError] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [supportPanelOpen, setSupportPanelOpen] = useState(false);
  const [supportCategory, setSupportCategory] = useState("DENUNCIA");
  const [supportContact, setSupportContact] = useState("");
  const [supportText, setSupportText] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [supportNotice, setSupportNotice] = useState("");
  const [supportReports, setSupportReports] = useState([]);
  const [supportReportsLoading, setSupportReportsLoading] = useState(false);
  const [supportReportsError, setSupportReportsError] = useState("");
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNext, setPasswordNext] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState("profile");
  const [profileName, setProfileName] = useState("");
  const [profileInstagram, setProfileInstagram] = useState("");
  const [profileWhatsapp, setProfileWhatsapp] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileHeight, setProfileHeight] = useState("");
  const [profileWeight, setProfileWeight] = useState("");
  const [profileBust, setProfileBust] = useState("");
  const [profileWaist, setProfileWaist] = useState("");
  const [profileHips, setProfileHips] = useState("");
  const [profilePriceHour, setProfilePriceHour] = useState("");
  const [profilePrice30Min, setProfilePrice30Min] = useState("");
  const [profilePrice15Min, setProfilePrice15Min] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [calcRate, setCalcRate] = useState(200);
  const [calcDailyCount, setCalcDailyCount] = useState(4);
  const [calcWeeklyDays, setCalcWeeklyDays] = useState(5);
  const [calcCity, setCalcCity] = useState("");
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const shotGalleryRef = useRef(null);
  const shotCameraRef = useRef(null);
  const shotVideoRef = useRef(null);

  const loadMedia = async () => {
    try {
      const data = await apiFetch("/api/media/self");
      setCurrentMedia(data);
    } catch (err) {
      setMediaError(err.message || "Erro ao carregar midias.");
    }
  };

  const loadMessages = async () => {
    setMessageError("");
    setMessageLoading(true);
    try {
      const data = await apiFetch("/api/messages/self");
      setMessages(data.messages || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setMessageError(err.message || "Erro ao carregar mensagens.");
    } finally {
      setMessageLoading(false);
    }
  };

  const loadSupportReports = async () => {
    setSupportReportsError("");
    setSupportReportsLoading(true);
    try {
      const data = await apiFetch("/api/faq-reports/self");
      setSupportReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setSupportReportsError(err.message || "Erro ao carregar relatos.");
    } finally {
      setSupportReportsLoading(false);
    }
  };

  const loadAccountProfile = async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const data = await apiFetch("/api/models/self/profile");
      setProfileName(data.name || "");
      setProfileInstagram(data.instagram || "");
      setProfileWhatsapp(data.whatsapp || "");
      setProfileCity(data.city || "");
      setProfileBio(data.bio || "");
      setProfileHeight(data.height ?? "");
      setProfileWeight(data.weight ?? "");
      setProfileBust(data.bust ?? "");
      setProfileWaist(data.waist ?? "");
      setProfileHips(data.hips ?? "");
      setProfilePriceHour(data.priceHour ?? "");
      setProfilePrice30Min(data.price30Min ?? "");
      setProfilePrice15Min(data.price15Min ?? "");
    } catch (err) {
      setProfileError(err.message || "Erro ao carregar cadastro.");
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
    loadMessages();
    loadSupportReports();
    loadAccountProfile();
  }, []);

  useEffect(() => {
    let intervalId = 0;
    const sendPresenceHeartbeat = () => {
      apiFetch("/api/models/presence/heartbeat", {
        method: "POST",
      }).catch(() => {
        // Sem impacto na tela; status online expira sozinho por TTL.
      });
    };

    sendPresenceHeartbeat();
    intervalId = window.setInterval(sendPresenceHeartbeat, 45 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      mediaPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
      shotPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [mediaPreviews, shotPreviews]);

  const existingPhotos = currentMedia.filter((item) => item.type === "IMAGE")
    .length;
  const existingVideos = currentMedia.filter((item) => item.type === "VIDEO")
    .length;

  const handlePickFiles = async (files) => {
    setMediaError("");
    const incoming = Array.from(files || []);
    if (incoming.length === 0) {
      return;
    }

    const nextFiles = [];
    const nextPreviews = [];
    const errors = [];

    for (const file of incoming) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} excede ${formatSize(MAX_FILE_SIZE)}.`);
        continue;
      }
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        errors.push(`${file.name} nao e um formato valido.`);
        continue;
      }

      let processedFile = file;
      let duration = null;

      try {
        if (file.type.startsWith("image/")) {
          processedFile = await stripImageMetadata(file);
        } else {
          duration = await getVideoDuration(file);
        }
      } catch (err) {
        errors.push(
          err instanceof Error ? err.message : "Falha ao processar arquivo."
        );
        continue;
      }

      const url = URL.createObjectURL(processedFile);
      nextFiles.push(processedFile);
      nextPreviews.push({
        id: `${processedFile.name}-${processedFile.size}-${processedFile.lastModified}`,
        url,
        name: processedFile.name,
        type: processedFile.type,
        size: processedFile.size,
        duration,
        file: processedFile,
      });
    }

    const selectedPhotos =
      mediaPreviews.filter((item) => item.type.startsWith("image/")).length +
      nextPreviews.filter((item) => item.type.startsWith("image/")).length;
    const selectedVideos =
      mediaPreviews.filter((item) => item.type.startsWith("video/")).length +
      nextPreviews.filter((item) => item.type.startsWith("video/")).length;

    if (existingPhotos + selectedPhotos > MAX_PHOTOS) {
      errors.push(`Limite de ${MAX_PHOTOS} fotos atingido.`);
    }

    if (existingVideos + selectedVideos > MAX_VIDEOS) {
      errors.push(`Limite de ${MAX_VIDEOS} videos atingido.`);
    }

    if (errors.length > 0) {
      setMediaError(errors.join(" "));
      return;
    }

    if (nextFiles.length > 0) {
      setMediaFiles((prev) => [...prev, ...nextFiles]);
      setMediaPreviews((prev) => [...prev, ...nextPreviews]);
    }
  };

  const handlePickShots = async (files) => {
    setShotError("");
    const incoming = Array.from(files || []);
    if (incoming.length === 0) {
      return;
    }

    const nextFiles = [];
    const nextPreviews = [];
    const errors = [];

    for (const file of incoming) {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} excede ${formatSize(MAX_FILE_SIZE)}.`);
        continue;
      }
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        errors.push(`${file.name} nao e um formato valido.`);
        continue;
      }

      let duration = null;
      if (file.type.startsWith("video/")) {
        try {
          duration = await getVideoDuration(file);
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : "Falha ao processar video."
          );
          continue;
        }
        if (duration > MAX_SHOT_VIDEO_SECONDS) {
          errors.push(
            `${file.name} excede ${MAX_SHOT_VIDEO_SECONDS}s.`
          );
          continue;
        }
      }

      const url = URL.createObjectURL(file);
      nextFiles.push(file);
      nextPreviews.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        url,
        name: file.name,
        type: file.type,
        size: file.size,
        duration,
        file,
      });
    }

    const selectedPhotos =
      nextPreviews.filter((item) => item.type.startsWith("image/")).length;
    const selectedVideos =
      nextPreviews.filter((item) => item.type.startsWith("video/")).length;

    if (selectedVideos > 1 || selectedPhotos > MAX_SHOT_PHOTOS || (selectedVideos > 0 && selectedPhotos > 0)) {
      errors.push("Envie 1 video ou ate 2 fotos por vez.");
    }

    if (errors.length > 0) {
      setShotError(errors.join(" "));
      return;
    }

    setShotFiles(nextFiles);
    setShotPreviews(nextPreviews);
  };

  const handleFileInput = (event) => {
    const { files } = event.target;
    handlePickFiles(files);
    event.target.value = "";
  };

  const handleShotInput = (event) => {
    const { files } = event.target;
    handlePickShots(files);
    event.target.value = "";
  };

  const handleRemoveMedia = (id) => {
    setMediaPreviews((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      const next = prev.filter((item) => item.id !== id);
      setMediaFiles(next.map((item) => item.file));
      return next;
    });
  };

  const handleRemoveShot = (id) => {
    setShotPreviews((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      const next = prev.filter((item) => item.id !== id);
      setShotFiles(next.map((item) => item.file));
      return next;
    });
  };

  const handleShotUpload = async () => {
    if (shotFiles.length === 0) {
      setShotError("Selecione arquivos para enviar.");
      return;
    }
    setShotLoading(true);
    setShotError("");
    setShotMessage("");
    try {
      const formData = new FormData();
      shotFiles.forEach((file) => formData.append("files", file));
      await apiFetch("/api/shots/upload", {
        method: "POST",
        body: formData,
      });
      setShotMessage("Shot enviado com sucesso.");
      setShotFiles([]);
      setShotPreviews([]);
    } catch (err) {
      setShotError(err.message || "Erro ao enviar shot.");
    } finally {
      setShotLoading(false);
    }
  };

  const handleUpload = async () => {
    if (mediaFiles.length === 0) {
      setMediaError("Selecione arquivos para enviar.");
      return;
    }
    setLoading(true);
    setMediaError("");
    setMessage("");
    try {
      const formData = new FormData();
      mediaFiles.forEach((file) => formData.append("files", file));
      await apiFetch("/api/media/upload-self", {
        method: "POST",
        body: formData,
      });
      setMessage("Midia enviada para aprovacao.");
      setMediaFiles([]);
      setMediaPreviews([]);
      await loadMedia();
    } catch (err) {
      setMediaError(err.message || "Erro ao enviar midia.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (mediaId) => {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir esta midia?"
    );
    if (!confirmed) {
      return;
    }
    setMediaError("");
    setMessage("");
    try {
      await apiFetch(`/api/media/${mediaId}`, { method: "DELETE" });
      setCurrentMedia((prev) => prev.filter((item) => item.id !== mediaId));
      setMessage("Midia excluida.");
    } catch (err) {
      setMediaError(err.message || "Erro ao excluir midia.");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordMessage("");

    if (!passwordCurrent || !passwordNext || !passwordConfirm) {
      setPasswordError("Preencha todos os campos para alterar a senha.");
      return;
    }

    if (passwordNext.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (passwordNext !== passwordConfirm) {
      setPasswordError("As senhas nao conferem.");
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await apiFetch("/api/models/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordCurrent,
          newPassword: passwordNext,
        }),
      });
      setPasswordMessage(response.message || "Senha atualizada com sucesso.");
      setPasswordCurrent("");
      setPasswordNext("");
      setPasswordConfirm("");
    } catch (err) {
      setPasswordError(err.message || "Erro ao atualizar senha.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError("");
    setProfileMessage("");

    if (!profileName.trim()) {
      setProfileError("Nome artistico obrigatorio.");
      return;
    }

    setProfileSaving(true);
    try {
      const data = await apiFetch("/api/models/self/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          instagram: profileInstagram,
          whatsapp: profileWhatsapp,
          city: profileCity,
          bio: profileBio,
          height: profileHeight,
          weight: profileWeight,
          bust: profileBust,
          waist: profileWaist,
          hips: profileHips,
          priceHour: profilePriceHour,
          price30Min: profilePrice30Min,
          price15Min: profilePrice15Min,
        }),
      });

      setProfileName(data.name || "");
      setProfileInstagram(data.instagram || "");
      setProfileWhatsapp(data.whatsapp || "");
      setProfileCity(data.city || "");
      setProfileBio(data.bio || "");
      setProfileHeight(data.height ?? "");
      setProfileWeight(data.weight ?? "");
      setProfileBust(data.bust ?? "");
      setProfileWaist(data.waist ?? "");
      setProfileHips(data.hips ?? "");
      setProfilePriceHour(data.priceHour ?? "");
      setProfilePrice30Min(data.price30Min ?? "");
      setProfilePrice15Min(data.price15Min ?? "");
      setProfileMessage("Cadastro atualizado com sucesso.");

      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          parsed.displayName = data.name || parsed.displayName;
          localStorage.setItem("user", JSON.stringify(parsed));
        } catch {
          // Ignora parse invalido de cache local
        }
      }
    } catch (err) {
      setProfileError(err.message || "Erro ao atualizar cadastro.");
    } finally {
      setProfileSaving(false);
    }
  };

  const pendingCount = currentMedia.filter((item) => item.status === "PENDING")
    .length;
  const approvedCount = currentMedia.filter((item) => item.status === "APPROVED")
    .length;
  const calcMonthlyTotal = useMemo(
    () => calcRate * calcDailyCount * calcWeeklyDays * 4,
    [calcRate, calcDailyCount, calcWeeklyDays]
  );

  return (
    <div className="page">
      <div className="model-area-head">
        <div>
          <h1 className="section-title">
            Minha <span>midia</span>
          </h1>
          <p className="muted" style={{ marginTop: 10 }}>
            Envie ate {MAX_PHOTOS} fotos e {MAX_VIDEOS} videos. Itens enviados ficam pendentes de aprovacao.
          </p>
        </div>
        <button
          type="button"
          className="model-hamburger"
          aria-label="Abrir menu da conta"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {messageError && <div className="notice">{messageError}</div>}
      {shotMessage && <div className="notice">{shotMessage}</div>}
      {shotError && <div className="notice">{shotError}</div>}
      {message && <div className="notice">{message}</div>}
      {mediaError && <div className="notice">{mediaError}</div>}

      {menuOpen ? (
        <div className="model-menu-overlay" onClick={() => setMenuOpen(false)}>
          <aside
            className="model-menu-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="model-menu-head">
              <div>
                <h3>Conta da modelo</h3>
                <p className="muted">Ajustes de cadastro e seguranca.</p>
              </div>
              <button
                type="button"
                className="model-menu-close"
                aria-label="Fechar menu"
                onClick={() => setMenuOpen(false)}
              >
                x
              </button>
            </div>

            <div className="model-menu-tabs">
              <button
                type="button"
                className={`model-menu-tab ${menuTab === "profile" ? "active" : ""}`}
                onClick={() => setMenuTab("profile")}
              >
                Atualização de perfil
              </button>
              <button
                type="button"
                className={`model-menu-tab ${menuTab === "security" ? "active" : ""}`}
                onClick={() => setMenuTab("security")}
              >
                Seguranca
              </button>
            </div>

            <div className="form-actions" style={{ marginTop: 10, marginBottom: 8 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/modelo/pagamento");
                }}
              >
                Ativar plano / Pagamento
              </button>
            </div>

            {menuTab === "profile" ? (
              <div className="form-grid">
                {profileLoading ? <p className="muted">Carregando cadastro...</p> : null}
                {profileMessage ? <div className="notice">{profileMessage}</div> : null}
                {profileError ? <div className="notice">{profileError}</div> : null}
                <input
                  className="input"
                  type="text"
                  placeholder="Nome artistico"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                />
                <input
                  className="input"
                  type="text"
                  placeholder="Instagram"
                  value={profileInstagram}
                  onChange={(event) => setProfileInstagram(event.target.value)}
                />
                <input
                  className="input"
                  type="tel"
                  placeholder="Telefone / WhatsApp"
                  value={profileWhatsapp}
                  onChange={(event) => setProfileWhatsapp(event.target.value)}
                />
                <input
                  className="input"
                  type="text"
                  placeholder="Cidade"
                  value={profileCity}
                  onChange={(event) => setProfileCity(event.target.value)}
                />
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder="Descricao do perfil"
                  value={profileBio}
                  onChange={(event) => setProfileBio(event.target.value)}
                />
                <div
                  className="form-grid"
                  style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
                >
                  <input
                    className="input"
                    type="number"
                    placeholder="Altura (cm)"
                    value={profileHeight}
                    onChange={(event) => setProfileHeight(event.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Peso (kg)"
                    value={profileWeight}
                    onChange={(event) => setProfileWeight(event.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Busto (cm)"
                    value={profileBust}
                    onChange={(event) => setProfileBust(event.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Cintura (cm)"
                    value={profileWaist}
                    onChange={(event) => setProfileWaist(event.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Quadril (cm)"
                    value={profileHips}
                    onChange={(event) => setProfileHips(event.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Valor por hora"
                    value={profilePriceHour}
                    onChange={(event) => setProfilePriceHour(event.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Valor 30 minutos"
                    value={profilePrice30Min}
                    onChange={(event) => setProfilePrice30Min(event.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Valor 15 minutos"
                    value={profilePrice15Min}
                    onChange={(event) => setProfilePrice15Min(event.target.value)}
                  />
                </div>
                <div className="form-actions" style={{ marginTop: 4 }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={profileSaving}
                    onClick={handleSaveProfile}
                  >
                    {profileSaving ? "Salvando..." : "Salvar cadastro"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="form-grid">
                {passwordMessage ? <div className="notice">{passwordMessage}</div> : null}
                {passwordError ? <div className="notice">{passwordError}</div> : null}
                <input
                  className="input"
                  type="password"
                  placeholder="Senha atual"
                  value={passwordCurrent}
                  onChange={(event) => setPasswordCurrent(event.target.value)}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="Nova senha"
                  value={passwordNext}
                  onChange={(event) => setPasswordNext(event.target.value)}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                />
                <div className="form-actions" style={{ marginTop: 4 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? "Atualizando..." : "Atualizar senha"}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      <div className="calc-shell" style={{ marginTop: 20 }}>
        <div className="calc-card">
          <h2>Calcule seus ganhos</h2>
          <p className="muted">Valor de cada atendimento</p>

          <div className="calc-rate">
            <button
              type="button"
              className="calc-step"
              onClick={() => setCalcRate((prev) => Math.max(50, prev - 50))}
            >
              -
            </button>
            <div className="calc-amount">
              <strong>{formatCurrency(calcRate)}</strong>
              <span>/h</span>
            </div>
            <button
              type="button"
              className="calc-step"
              onClick={() => setCalcRate((prev) => Math.min(2000, prev + 50))}
            >
              +
            </button>
          </div>

          <div className="calc-highlight">100% do valor de atendimento e seu</div>

          <div className="calc-range">
            <div className="calc-range-head">
              <span>{calcDailyCount} atendimentos por dia</span>
            </div>
            <input
              type="range"
              min="1"
              max="12"
              value={calcDailyCount}
              onChange={(event) => setCalcDailyCount(Number(event.target.value))}
            />
          </div>

          <div className="calc-range">
            <div className="calc-range-head">
              <span>{calcWeeklyDays} dias por semana</span>
            </div>
            <input
              type="range"
              min="1"
              max="7"
              value={calcWeeklyDays}
              onChange={(event) => setCalcWeeklyDays(Number(event.target.value))}
            />
          </div>

          <div className="calc-total">
            <p>Total de ganhos por mes</p>
            <h3>{formatCurrency(calcMonthlyTotal)}/mes</h3>
          </div>
        </div>

        <div className="calc-card calc-secondary">
          <h2>Dicas personalizadas</h2>
          <p className="muted">Insira sua cidade abaixo</p>
          <div className="calc-city">
            <input
              className="input"
              type="text"
              placeholder="Ex.: Sao Paulo - SP"
              value={calcCity}
              onChange={(event) => setCalcCity(event.target.value)}
            />
          </div>
          <p className="calc-note">
            {calcCity
              ? `Com a media de ${formatCurrency(calcRate)} por atendimento em ${calcCity},
              voce pode simular ate ${formatCurrency(calcMonthlyTotal)} por mes.`
              : "Digite sua cidade para comparar com a media local."}
          </p>
          <p className="muted" style={{ marginTop: 18 }}>
            Esta calculadora e uma simulacao. Os valores estimados nao representam garantia de faturamento.
          </p>
        </div>
      </div>

      <div className="media-uploader" style={{ marginTop: 20 }}>
        <div className="media-uploader-head">
          <div>
            <h4>Denuncia / sugestao / reclamacao</h4>
            <p className="muted">
              Envie um relato direto para a area admin e acompanhe a resposta.
            </p>
          </div>
          <span className="media-count">{supportReports.length}</span>
        </div>

        <div className="media-actions">
          <button
            className="btn"
            type="button"
            onClick={() => setSupportPanelOpen((prev) => !prev)}
          >
            {supportPanelOpen ? "Fechar formulario" : "Abrir formulario"}
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={loadSupportReports}
            disabled={supportReportsLoading}
          >
            {supportReportsLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {supportNotice ? <div className="notice">{supportNotice}</div> : null}
        {supportError ? <div className="notice">{supportError}</div> : null}
        {supportReportsError ? <div className="notice">{supportReportsError}</div> : null}

        {supportPanelOpen ? (
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setSupportError("");
              setSupportNotice("");
              const message = supportText.trim();
              if (!message) {
                setSupportError("Descreva o problema antes de enviar.");
                return;
              }

              setSupportLoading(true);
              try {
                await apiFetch("/api/faq-reports/self", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    category: supportCategory,
                    contact: supportContact.trim(),
                    message,
                  }),
                });
                setSupportNotice("Relato enviado para a administracao.");
                setSupportText("");
                setSupportContact("");
                await loadSupportReports();
              } catch (err) {
                setSupportError(err.message || "Erro ao enviar relato.");
              } finally {
                setSupportLoading(false);
              }
            }}
          >
            <select
              className="select"
              value={supportCategory}
              onChange={(event) => setSupportCategory(event.target.value)}
            >
              <option value="DENUNCIA">Denuncia</option>
              <option value="SUGESTAO">Sugestao</option>
              <option value="RECLAMACAO">Reclamacao</option>
            </select>
            <input
              className="input"
              type="text"
              placeholder="Contato (opcional)"
              value={supportContact}
              onChange={(event) => setSupportContact(event.target.value)}
              maxLength={255}
            />
            <textarea
              className="textarea"
              rows={5}
              placeholder="Escreva sua denuncia, sugestao ou reclamacao"
              value={supportText}
              onChange={(event) => setSupportText(event.target.value)}
              maxLength={2000}
            />
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button className="btn" type="submit" disabled={supportLoading}>
                {supportLoading ? "Enviando..." : "Enviar relato"}
              </button>
            </div>
          </form>
        ) : null}

        {supportReports.length > 0 ? (
          <div className="cards" style={{ marginTop: 16 }}>
            {supportReports.map((report) => (
              <div className="card" key={report.id}>
                <h4>{(report.category || "RELATO").replace(/_/g, " ")}</h4>
                <p className="muted" style={{ marginTop: 6 }}>
                  {new Date(report.createdAt).toLocaleString("pt-BR")}
                </p>
                <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{report.message}</p>
                <p className="muted" style={{ marginTop: 10 }}>
                  Status: {report.status === "ANSWERED" ? "Respondido" : "Pendente"}
                </p>
                {report.adminResponse ? (
                  <>
                    <div className="divider" style={{ margin: "14px 0" }} />
                    <p className="muted">Resposta da administracao</p>
                    <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                      {report.adminResponse}
                    </p>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            Nenhum relato enviado ainda.
          </p>
        )}
      </div>

      <div className="media-uploader" style={{ marginTop: 20 }}>
        <div className="media-uploader-head">
          <div>
            <h4>Mensagens de clientes</h4>
            <p className="muted">
              {unreadCount > 0
                ? `Voce tem ${unreadCount} nova(s) mensagem(ns).`
                : "Nenhuma nova mensagem no momento."}
            </p>
          </div>
          <span className="media-count" title="Notificacoes">
            {unreadCount}
          </span>
        </div>
        <div className="media-actions">
          <button
            className="btn btn-outline"
            type="button"
            onClick={loadMessages}
            disabled={messageLoading}
          >
            {messageLoading ? "Atualizando..." : "Atualizar"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={async () => {
              try {
                await apiFetch("/api/messages/self/read", { method: "POST" });
                setUnreadCount(0);
              } catch (err) {
                setMessageError(err.message || "Erro ao marcar como lidas.");
              }
            }}
          >
            Marcar como lidas
          </button>
        </div>

        {messages.length > 0 ? (
          <div className="cards" style={{ marginTop: 16 }}>
            {messages.map((item) => (
              <div className="card" key={item.id}>
                <h4>{item.fromName || "Cliente"}</h4>
                {item.fromPhone ? (
                  <p className="muted">{item.fromPhone}</p>
                ) : null}
                <p style={{ marginTop: 10 }}>{item.text}</p>
                <p className="muted" style={{ marginTop: 10 }}>
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 16 }}>
            Nenhuma mensagem recebida ainda.
          </p>
        )}
      </div>

      <div className="media-uploader" style={{ marginTop: 20 }}>
        <div className="media-uploader-head">
          <div>
            <h4>Models shot</h4>
            <p className="muted">
              Envie 1 video de ate {MAX_SHOT_VIDEO_SECONDS}s ou ate {MAX_SHOT_PHOTOS} fotos.
            </p>
          </div>
          <span className="media-count">{shotPreviews.length}</span>
        </div>

        <div className="media-actions">
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              if (!confirmMediaAccess()) {
                return;
              }
              shotGalleryRef.current?.click();
            }}
          >
            Escolher da galeria
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              if (!confirmMediaAccess()) {
                return;
              }
              shotCameraRef.current?.click();
            }}
          >
            Usar camera
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => shotVideoRef.current?.click()}
          >
            Gravar video
          </button>
        </div>

        <input
          ref={shotGalleryRef}
          className="media-input"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleShotInput}
        />
        <input
          ref={shotCameraRef}
          className="media-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleShotInput}
        />
        <input
          ref={shotVideoRef}
          className="media-input"
          type="file"
          accept="video/*"
          capture="environment"
          onChange={handleShotInput}
        />

        {shotPreviews.length > 0 ? (
          <div className="media-grid">
            {shotPreviews.map((item) => (
              <div key={item.id} className="media-card">
                {item.type.startsWith("video/") ? (
                  <video src={item.url} controls playsInline />
                ) : (
                  <img src={item.url} alt={item.name} />
                )}
                <div className="media-meta">
                  <div>
                    <strong>{item.type.startsWith("video/") ? "Video" : "Foto"}</strong>
                    <span>{formatSize(item.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleRemoveShot(item.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted media-empty">Nenhum shot selecionado.</p>
        )}

        <div className="form-actions">
          <button
            className="btn"
            type="button"
            onClick={handleShotUpload}
            disabled={shotLoading || shotFiles.length === 0}
          >
            {shotLoading ? "Enviando..." : "Enviar shot"}
          </button>
        </div>
      </div>

      <div className="media-uploader" style={{ marginTop: 20 }}>
        <div className="media-uploader-head">
          <div>
            <h4>Adicionar midias</h4>
            <p className="muted">
              Fotos: {existingPhotos}/{MAX_PHOTOS} | Videos: {existingVideos}/{MAX_VIDEOS}
            </p>
          </div>
          <span className="media-count">{mediaPreviews.length}</span>
        </div>

        <div className="media-actions">
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              if (!confirmMediaAccess()) {
                return;
              }
              galleryInputRef.current?.click();
            }}
          >
            Escolher da galeria
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              if (!confirmMediaAccess()) {
                return;
              }
              cameraInputRef.current?.click();
            }}
          >
            Usar camera
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => videoInputRef.current?.click()}
          >
            Gravar video
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Ao enviar midias, favor enviar midias tiradas ate 6 meses.
        </p>

        <input
          ref={galleryInputRef}
          className="media-input"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileInput}
        />
        <input
          ref={cameraInputRef}
          className="media-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInput}
        />
        <input
          ref={videoInputRef}
          className="media-input"
          type="file"
          accept="video/*"
          capture="environment"
          onChange={handleFileInput}
        />

        {mediaPreviews.length > 0 ? (
          <div className="media-grid">
            {mediaPreviews.map((item) => (
              <div key={item.id} className="media-card">
                {item.type.startsWith("video/") ? (
                  <video src={item.url} controls playsInline />
                ) : (
                  <img src={item.url} alt={item.name} />
                )}
                <div className="media-meta">
                  <div>
                    <strong>{item.type.startsWith("video/") ? "Video" : "Foto"}</strong>
                    <span>{formatSize(item.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleRemoveMedia(item.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted media-empty">
            Nenhuma midia selecionada.
          </p>
        )}

        <div className="form-actions">
          <button
            className="btn"
            type="button"
            onClick={handleUpload}
            disabled={loading || mediaFiles.length === 0}
          >
            {loading ? "Enviando..." : "Enviar midias"}
          </button>
        </div>
      </div>

      <div className="section" style={{ marginTop: 32 }}>
        <h2 className="section-title">
          Midias <span>enviadas</span>
        </h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Pendentes: {pendingCount} | Aprovadas: {approvedCount}
        </p>
        {currentMedia.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>
            Nenhuma midia enviada ainda.
          </p>
        ) : (
          <div className="cards" style={{ marginTop: 16 }}>
            {currentMedia.map((item) => (
              <div className="card" key={item.id}>
                <h4>{item.type === "VIDEO" ? "Video" : "Foto"}</h4>
                <p className="muted">Status: {item.status}</p>
                {item.type === "VIDEO" ? (
                  <video
                    src={item.url}
                    controls
                    style={{ width: "100%", marginTop: 12 }}
                  />
                ) : (
                  <img
                    src={item.url}
                    alt="Midia enviada"
                    style={{ width: "100%", marginTop: 12, borderRadius: 12 }}
                  />
                )}
                <button
                  className="btn btn-outline"
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => handleDelete(item.id)}
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
 
