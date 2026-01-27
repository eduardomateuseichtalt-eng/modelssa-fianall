import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    loadMedia();
  }, []);

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

  const pendingCount = currentMedia.filter((item) => item.status === "PENDING")
    .length;
  const approvedCount = currentMedia.filter((item) => item.status === "APPROVED")
    .length;

  return (
    <div className="page">
      <h1 className="section-title">
        Minha <span>midia</span>
      </h1>
      <p className="muted" style={{ marginTop: 10 }}>
        Envie ate {MAX_PHOTOS} fotos e {MAX_VIDEOS} videos. Itens enviados ficam pendentes de aprovacao.
      </p>

      {shotMessage && <div className="notice">{shotMessage}</div>}
      {shotError && <div className="notice">{shotError}</div>}
      {message && <div className="notice">{message}</div>}
      {mediaError && <div className="notice">{mediaError}</div>}

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
