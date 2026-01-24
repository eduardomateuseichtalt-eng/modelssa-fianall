import { useEffect, useRef, useState } from "react";
import { apiFetch, API_URL } from "../lib/api";

const initialForm = {
  name: "",
  email: "",
  password: "",
  age: "",
  city: "",
  bio: "",
  instagram: "",
  whatsapp: "",
  height: "",
  weight: "",
  bust: "",
  waist: "",
  hips: "",
  priceHour: "",
};

const MAX_FILES = 6;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;

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

export default function ModelRegister() {
  const storedPhone =
    typeof window !== "undefined"
      ? sessionStorage.getItem("model-register-phone") || ""
      : "";
  const [form, setForm] = useState({
    ...initialForm,
    whatsapp: storedPhone,
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [mediaError, setMediaError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState("");
  const [profileError, setProfileError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const profileGalleryRef = useRef(null);
  const profileCameraRef = useRef(null);
  const fieldRefs = useRef([]);
  const submitRef = useRef(null);

  useEffect(() => {
    return () => {
      mediaPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
      if (profilePreview) {
        URL.revokeObjectURL(profilePreview);
      }
    };
  }, [mediaPreviews, profilePreview]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  const handlePickFiles = async (files) => {
    setMediaError("");
    const incoming = Array.from(files || []);
    if (incoming.length === 0) {
      return;
    }

    const remainingSlots = Math.max(0, MAX_FILES - mediaFiles.length);
    if (remainingSlots === 0) {
      setMediaError(`Limite de ${MAX_FILES} arquivos atingido.`);
      return;
    }

    const sliced = incoming.slice(0, remainingSlots);
    const nextFiles = [];
    const nextPreviews = [];
    const errors = [];

    for (const file of sliced) {
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
          if (duration > MAX_VIDEO_SECONDS) {
            errors.push(
              `${file.name} excede ${MAX_VIDEO_SECONDS}s de duracao.`
            );
            continue;
          }
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

    if (errors.length > 0) {
      setMediaError(errors.join(" "));
    }

    if (nextFiles.length > 0) {
      setMediaFiles((prev) => [...prev, ...nextFiles]);
      setMediaPreviews((prev) => [...prev, ...nextPreviews]);
    }
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

  const handleFileInput = (event) => {
    const { files } = event.target;
    handlePickFiles(files);
    event.target.value = "";
  };

  const handleProfileInput = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    setProfileError("");
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setProfileError("Escolha apenas imagem para a foto de perfil.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setProfileError(`Arquivo excede ${formatSize(MAX_FILE_SIZE)}.`);
      return;
    }
    try {
      const processed = await stripImageMetadata(file);
      if (profilePreview) {
        URL.revokeObjectURL(profilePreview);
      }
      setProfileFile(processed);
      setProfilePreview(URL.createObjectURL(processed));
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Falha ao processar imagem."
      );
    }
  };

  const handleFieldKeyDown = (index, event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const next = fieldRefs.current[index + 1];
    if (next && typeof next.focus === "function") {
      next.focus();
      return;
    }
    submitRef.current?.focus();
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setMediaError("");
    setProfileError("");

    if (!profileFile) {
      setProfileError("A foto de perfil e obrigatoria.");
      return;
    }

    const hasVideo = mediaFiles.some((file) => file.type.startsWith("video/"));
    if (!hasVideo) {
      setMediaError("Envie pelo menos 1 video de verificacao.");
      return;
    }

    if (Number(form.age) < 18) {
      setMessage("Cadastro permitido apenas para maiores de 18 anos.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch("/api/models/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: Number(form.age),
          height: form.height ? Number(form.height) : null,
          weight: form.weight ? Number(form.weight) : null,
          bust: form.bust ? Number(form.bust) : null,
          waist: form.waist ? Number(form.waist) : null,
          hips: form.hips ? Number(form.hips) : null,
          priceHour: form.priceHour ? Number(form.priceHour) : null,
        }),
      });

      if (mediaFiles.length > 0 && data?.id) {
        const formData = new FormData();
        formData.append("modelId", data.id);
        if (profileFile) {
          formData.append("files", profileFile);
        }
        mediaFiles.forEach((file) => formData.append("files", file));

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${API_URL}/api/media/upload`);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
          xhr.onload = () => {
            setUploadProgress(0);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
              return;
            }
            reject(new Error("Erro ao enviar midia."));
          };
          xhr.onerror = () => {
            setUploadProgress(0);
            reject(new Error("Erro ao enviar midia."));
          };
          xhr.send(formData);
        });
      }

      setMessage(
        mediaFiles.length > 0
          ? "Cadastro enviado. Midia aguardando aprovacao."
          : "Cadastro enviado. Aguarde aprovacao."
      );
      setForm({
        ...initialForm,
        whatsapp: storedPhone,
      });
      setMediaFiles([]);
      setMediaPreviews([]);
      setProfileFile(null);
      setProfilePreview("");
    } catch (error) {
      setMessage(error.message || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-tight">
      <div className="form-shell">
        <h2>Seja modelo</h2>
        <p className="muted">
          Preencha seus dados para analise. Enviamos retorno por email.
        </p>

        {message && <div className="notice">{message}</div>}
        {mediaError && <div className="notice">{mediaError}</div>}
        {profileError && <div className="notice">{profileError}</div>}

        <form onSubmit={handleSubmit} className="form-grid">
          <input
            className="input"
            name="name"
            placeholder="Nome artistico"
            value={form.name}
            onChange={handleChange}
            onKeyDown={(event) => handleFieldKeyDown(0, event)}
            ref={(node) => {
              fieldRefs.current[0] = node;
            }}
            required
          />
          <input
            className="input"
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            onKeyDown={(event) => handleFieldKeyDown(1, event)}
            ref={(node) => {
              fieldRefs.current[1] = node;
            }}
            required
          />
          <div style={{ position: "relative" }}>
            <input
              className="input"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={form.password}
              onChange={handleChange}
              onKeyDown={(event) => handleFieldKeyDown(2, event)}
              ref={(node) => {
                fieldRefs.current[2] = node;
              }}
              required
            />
            <button
              type="button"
              className="pill"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
              }}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
          <input
            className="input"
            name="age"
            type="number"
            placeholder="Idade"
            value={form.age}
            onChange={handleChange}
            onKeyDown={(event) => handleFieldKeyDown(3, event)}
            ref={(node) => {
              fieldRefs.current[3] = node;
            }}
            required
          />
          <input
            className="input"
            name="city"
            placeholder="Cidade"
            value={form.city}
            onChange={handleChange}
            onKeyDown={(event) => handleFieldKeyDown(4, event)}
            ref={(node) => {
              fieldRefs.current[4] = node;
            }}
          />
          <textarea
            className="textarea"
            name="bio"
            placeholder="Descricao do perfil"
            value={form.bio}
            onChange={handleChange}
            onKeyDown={(event) => handleFieldKeyDown(5, event)}
            ref={(node) => {
              fieldRefs.current[5] = node;
            }}
          />
          <div className="profile-uploader">
            <div className="media-uploader-head">
              <div>
                <h4>Foto de perfil</h4>
                <p className="muted">
                  Use uma foto clara do rosto. Maximo {formatSize(MAX_FILE_SIZE)}.
                </p>
              </div>
              {profileFile ? <span className="media-count">1/1</span> : null}
            </div>
            <div className="media-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => profileGalleryRef.current?.click()}
              >
                Escolher da galeria
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => profileCameraRef.current?.click()}
              >
                Usar camera
              </button>
            </div>
            <input
              ref={profileGalleryRef}
              className="media-input"
              type="file"
              accept="image/*"
              onChange={handleProfileInput}
            />
            <input
              ref={profileCameraRef}
              className="media-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleProfileInput}
            />
            {profilePreview ? (
              <div className="profile-preview">
                <img src={profilePreview} alt="Foto de perfil" />
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(profilePreview);
                    setProfilePreview("");
                    setProfileFile(null);
                  }}
                >
                  Remover
                </button>
              </div>
            ) : (
              <p className="muted media-empty">
                Nenhuma foto selecionada.
              </p>
            )}
          </div>
          <div className="media-uploader">
            <div className="media-uploader-head">
              <div>
                <h4>Fotos e videos de comparacao</h4>
                <p className="muted">
                  Envie ate {MAX_FILES} arquivos. Maximo {formatSize(MAX_FILE_SIZE)} cada. Videos ate {MAX_VIDEO_SECONDS}s. Video de verificacao obrigatorio.
                </p>
              </div>
              <span className="media-count">{mediaPreviews.length}/{MAX_FILES}</span>
            </div>

            <div className="media-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => galleryInputRef.current?.click()}
              >
                Escolher da galeria
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => cameraInputRef.current?.click()}
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
                        {item.duration ? (
                          <span>{Math.round(item.duration)}s</span>
                        ) : null}
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
                Selecione fotos ou videos para enviar junto ao cadastro.
              </p>
            )}
          </div>
          <input
            className="input"
            name="instagram"
            placeholder="Instagram"
            value={form.instagram}
            onChange={handleChange}
            onKeyDown={(event) => handleFieldKeyDown(6, event)}
            ref={(node) => {
              fieldRefs.current[6] = node;
            }}
          />
          <input
            className="input"
            name="whatsapp"
            placeholder="WhatsApp"
            value={form.whatsapp}
            onChange={handleChange}
            onKeyDown={(event) => handleFieldKeyDown(7, event)}
            ref={(node) => {
              fieldRefs.current[7] = node;
            }}
          />
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <input
              className="input"
              name="height"
              placeholder="Altura (cm)"
              value={form.height}
              onChange={handleChange}
              onKeyDown={(event) => handleFieldKeyDown(8, event)}
              ref={(node) => {
                fieldRefs.current[8] = node;
              }}
            />
            <input
              className="input"
              name="weight"
              placeholder="Peso (kg)"
              value={form.weight}
              onChange={handleChange}
              onKeyDown={(event) => handleFieldKeyDown(9, event)}
              ref={(node) => {
                fieldRefs.current[9] = node;
              }}
            />
            <input
              className="input"
              name="bust"
              placeholder="Busto (cm)"
              value={form.bust}
              onChange={handleChange}
              onKeyDown={(event) => handleFieldKeyDown(10, event)}
              ref={(node) => {
                fieldRefs.current[10] = node;
              }}
            />
            <input
              className="input"
              name="waist"
              placeholder="Cintura (cm)"
              value={form.waist}
              onChange={handleChange}
              onKeyDown={(event) => handleFieldKeyDown(11, event)}
              ref={(node) => {
                fieldRefs.current[11] = node;
              }}
            />
            <input
              className="input"
              name="hips"
              placeholder="Quadril (cm)"
              value={form.hips}
              onChange={handleChange}
              onKeyDown={(event) => handleFieldKeyDown(12, event)}
              ref={(node) => {
                fieldRefs.current[12] = node;
              }}
            />
            <input
              className="input"
              name="priceHour"
              placeholder="Valor por hora"
              value={form.priceHour}
              onChange={handleChange}
              onKeyDown={(event) => handleFieldKeyDown(13, event)}
              ref={(node) => {
                fieldRefs.current[13] = node;
              }}
            />
          </div>
          <div className="form-actions">
            <button
              className="btn"
              type="submit"
              disabled={loading || !profileFile || !mediaFiles.some((file) => file.type.startsWith("video/"))}
              ref={submitRef}
            >
              {loading ? "Enviando..." : "Enviar cadastro"}
            </button>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => {
                setForm(initialForm);
                setMediaFiles([]);
                setMediaPreviews([]);
                setMediaError("");
                if (profilePreview) {
                  URL.revokeObjectURL(profilePreview);
                }
                setProfilePreview("");
                setProfileFile(null);
                setProfileError("");
              }}
            >
              Limpar
            </button>
          </div>
          {uploadProgress > 0 ? (
            <div className="upload-progress">
              <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
              <span>Enviando midia... {uploadProgress}%</span>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
