import { useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";

const SERVICE_OPTIONS = [
  { name: "Acompanhante", featured: true },
  { name: "Beijo na boca", featured: true },
  { name: "Massagem tradicional", featured: true },
  { name: "Sexo vaginal com preservativo", featured: true },
  { name: "Masturbacao", featured: false },
  { name: "Sexo oral com preservativo", featured: false },
  { name: "Sexo oral sem preservativo", featured: false },
  { name: "Striptease", featured: false },
  { name: "Uso de roupas de fantasia/uniformes", featured: false },
  { name: "Penetracao com acessorios sexuais", featured: false },
  { name: "Utiliza acessorios eroticos", featured: false },
  { name: "Sexo com voyeurismo/ser voyeur", featured: false },
  { name: "Viagem", featured: false },
  { name: "Sexo anal com preservativo", featured: false },
  { name: "Massagem tantrica", featured: false },
  { name: "Sexo virtual", featured: false },
  { name: "Atendimento online (webcam)", featured: false },
  { name: "Dupla penetracao", featured: false },
  { name: "Tripla penetracao", featured: false },
  { name: "Dominacao", featured: false },
  { name: "Fetiches", featured: false },
  { name: "Penis/fingering", featured: false },
  { name: "Beijo grego", featured: false },
  { name: "Podolatria", featured: false },
  { name: "Bondage", featured: false },
  { name: "Sadomasoquismo", featured: false },
  { name: "Fisting", featured: false },
  { name: "Facef*ck", featured: false },
  { name: "Quirofilia", featured: false },
  { name: "Squirt", featured: false },
  { name: "Chuva dourada", featured: false },
  { name: "Chuva marrom", featured: false },
  { name: "Tapinhas", featured: false },
  { name: "Algemas", featured: false },
];
const SERVICE_LABELS = {
  Masturbacao: "Masturba\u00e7\u00e3o",
  "Penetracao com acessorios sexuais": "Penetra\u00e7\u00e3o com acess\u00f3rios sexuais",
  "Utiliza acessorios eroticos": "Utiliza acess\u00f3rios er\u00f3ticos",
  "Massagem tantrica": "Massagem t\u00e2ntrica",
  "Dupla penetracao": "Dupla penetra\u00e7\u00e3o",
  "Tripla penetracao": "Tripla penetra\u00e7\u00e3o",
  Dominacao: "Domina\u00e7\u00e3o",
  "Penis/fingering": "P\u00eanis/fingering",
};

const getServiceLabel = (serviceName) => SERVICE_LABELS[serviceName] || serviceName;

const PAYMENT_METHOD_LABELS = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  CREDITO: "Cr\u00e9dito",
  DEBITO: "D\u00e9bito",
};
const ATTENDANCE_DAY_LABELS = {
  MONDAY: "Segunda-feira",
  TUESDAY: "Ter\u00e7a-feira",
  WEDNESDAY: "Quarta-feira",
  THURSDAY: "Quinta-feira",
  FRIDAY: "Sexta-feira",
  SATURDAY: "S\u00e1bado",
  SUNDAY: "Domingo",
};
const ATTENDANCE_DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
const WEEKDAY_BY_JS_INDEX = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];
const AGE_TOKEN_STORAGE_KEY = "modelsClubAgeToken";
const AGE_TOKEN_EXP_STORAGE_KEY = "modelsClubAgeTokenExpiresAt";

const readAgeToken = () => {
  try {
    const token = String(localStorage.getItem(AGE_TOKEN_STORAGE_KEY) || "").trim();
    if (!token) return "";
    const expiresRaw = String(localStorage.getItem(AGE_TOKEN_EXP_STORAGE_KEY) || "");
    const expiresAt = expiresRaw ? new Date(expiresRaw).getTime() : 0;
    if (!expiresAt || Date.now() > expiresAt) {
      return "";
    }
    return token;
  } catch {
    return "";
  }
};

const formatPriceBr = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "N\u00e3o realiza";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function ModelProfile() {
  const { id } = useParams();
  const location = useLocation();
  const locationSearchParams = new URLSearchParams(location.search || "");
  const ageTokenFromQuery = String(locationSearchParams.get("ageToken") || "").trim();
  const ageTokenExpiresAtFromQuery = String(
    locationSearchParams.get("ageTokenExpiresAt") || ""
  ).trim();
  const [model, setModel] = useState(null);
  const [media, setMedia] = useState([]);
  const [mediaSummary, setMediaSummary] = useState({
    photos: 0,
    videos: 0,
    total: 0,
    safePhotos: 0,
    safeVideos: 0,
    safeTotal: 0,
  });
  const [loading, setLoading] = useState(true);
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
  const [mediaViewerItem, setMediaViewerItem] = useState(null);
  const [mediaZoom, setMediaZoom] = useState(1);
  const [mediaPan, setMediaPan] = useState({ x: 0, y: 0 });
  const [isMediaDragging, setIsMediaDragging] = useState(false);
  const [selectedPriceOption, setSelectedPriceOption] = useState("hour");
  const [priceOptionsOpen, setPriceOptionsOpen] = useState(false);
  const [ageToken, setAgeToken] = useState(readAgeToken());
  const effectiveAgeToken = ageToken || ageTokenFromQuery;
  const priceCardRef = useRef(null);
  const mediaImageRef = useRef(null);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartZoomRef = useRef(1);
  const didPinchRef = useRef(false);
  const didDragRef = useRef(false);
  const isMouseDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const touchPanStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    apiFetch(`/api/models/${id}`)
      .then((data) => setModel(data))
      .catch(() => setModel(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    apiFetch(`/api/models/${id}/profile-view`, { method: "POST" }).catch(() => {});
  }, [id]);

  useEffect(() => {
    const token = effectiveAgeToken ? encodeURIComponent(effectiveAgeToken) : "";
    const query = token ? `?ageToken=${token}` : "";
    apiFetch(`/api/media/model/${id}${query}`)
      .then((data) => setMedia(Array.isArray(data) ? data : []))
      .catch(() => setMedia([]));
  }, [id, effectiveAgeToken]);

  useEffect(() => {
    if (!ageTokenFromQuery) {
      return;
    }
    if (ageTokenExpiresAtFromQuery) {
      const expiresAtMs = new Date(ageTokenExpiresAtFromQuery).getTime();
      if (Number.isFinite(expiresAtMs) && expiresAtMs > 0 && Date.now() > expiresAtMs) {
        return;
      }
    }
    if (ageToken !== ageTokenFromQuery) {
      setAgeToken(ageTokenFromQuery);
    }
    try {
      localStorage.setItem(AGE_TOKEN_STORAGE_KEY, ageTokenFromQuery);
      if (ageTokenExpiresAtFromQuery) {
        localStorage.setItem(AGE_TOKEN_EXP_STORAGE_KEY, ageTokenExpiresAtFromQuery);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [ageToken, ageTokenFromQuery, ageTokenExpiresAtFromQuery]);

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
        setMediaViewerItem(null);
        setMediaPan({ x: 0, y: 0 });
        setIsMediaDragging(false);
        isMouseDraggingRef.current = false;
        didDragRef.current = false;
        setMediaZoom(1);
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

  useEffect(() => {
    const refreshAgeGate = () => {
      const token = readAgeToken();
      setAgeToken(token || ageTokenFromQuery);
    };
    refreshAgeGate();
    window.addEventListener("focus", refreshAgeGate);
    window.addEventListener("storage", refreshAgeGate);
    return () => {
      window.removeEventListener("focus", refreshAgeGate);
      window.removeEventListener("storage", refreshAgeGate);
    };
  }, [ageTokenFromQuery]);

  useEffect(() => {
    apiFetch(`/api/media/model/${id}/summary`)
      .then((data) => {
        setMediaSummary({
          photos: Number(data?.photos || 0),
          videos: Number(data?.videos || 0),
          total: Number(data?.total || 0),
          safePhotos: Number(data?.safePhotos || 0),
          safeVideos: Number(data?.safeVideos || 0),
          safeTotal: Number(data?.safeTotal || 0),
        });
      })
      .catch(() => {
        setMediaSummary({
          photos: 0,
          videos: 0,
          total: 0,
          safePhotos: 0,
          safeVideos: 0,
          safeTotal: 0,
        });
      });
  }, [id]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!isMouseDraggingRef.current || mediaZoom <= 1) {
        return;
      }

      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        didDragRef.current = true;
      }

      const next = clampMediaPan(
        panStartRef.current.x + dx,
        panStartRef.current.y + dy
      );
      setMediaPan(next);
    };

    const handleMouseUp = () => {
      if (!isMouseDraggingRef.current) {
        return;
      }
      isMouseDraggingRef.current = false;
      setIsMediaDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [mediaZoom]);

  useEffect(() => {
    if (mediaZoom <= 1) {
      setMediaPan({ x: 0, y: 0 });
      setIsMediaDragging(false);
      isMouseDraggingRef.current = false;
      return;
    }
    setMediaPan((current) => clampMediaPan(current.x, current.y));
  }, [mediaZoom]);

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
        <p>Acompanhante nao encontrada.</p>
        <div className="form-actions">
          <Link to="/modelos" className="btn btn-outline">
            Voltar para acompanhantes
          </Link>
        </div>
      </div>
    );
  }

  const wa = String(model.whatsapp || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(
    `ol\u00e1 ${model.name}! vi seu perfil no models-club e gostaria de marcar um atendimento. quando voc\u00ea tem disponibilidade?`
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

  const mediaPhotos = media.filter((item) => item.type !== "VIDEO");
  const mediaVideos = media.filter((item) => item.type === "VIDEO");
  const orderedGalleryMedia = [...mediaVideos, ...mediaPhotos];
  const totalMediaCount = media.length;
  const displayMediaCount = mediaSummary.total || totalMediaCount;
  const displayMediaPhotos = mediaSummary.photos || mediaPhotos.length;
  const displayMediaVideos = mediaSummary.videos || mediaVideos.length;
  const restrictedCount = Math.max(
    0,
    (mediaSummary.total || totalMediaCount) - totalMediaCount
  );
  const shouldShowAgeGate = restrictedCount > 0;
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
  const instagramDisplay = String(model.instagram || "").trim();
  const hasInstagramDisplay =
    instagramDisplay.length > 0 &&
    !["@instagram", "instagram", "@insta", "insta"].includes(
      instagramDisplay.toLowerCase()
    );
  const offeredServices = Array.isArray(model.offeredServices)
    ? model.offeredServices
    : [];
  const offeredServiceSet = new Set(offeredServices);
  const offeredServiceList = SERVICE_OPTIONS.filter((service) =>
    offeredServiceSet.has(service.name)
  );
  const notOfferedServiceList = SERVICE_OPTIONS.filter(
    (service) => !offeredServiceSet.has(service.name)
  );
  const valuesRows = [
    { label: "30 minutos", value: model.price30Min },
    { label: "1 hora", value: model.priceHour },
    { label: "2 horas", value: model.price2Hours },
    { label: "4 horas", value: model.price4Hours },
    { label: "Pernoite", value: model.priceOvernight },
    { label: "15 minutos", value: model.price15Min },
  ];
  const valuesLeftColumn = valuesRows.filter((_, index) => index % 2 === 0);
  const valuesRightColumn = valuesRows.filter((_, index) => index % 2 !== 0);
  const paymentMethods = Array.isArray(model.paymentMethods)
    ? model.paymentMethods
        .map((item) => String(item || "").trim().toUpperCase())
        .filter((item) => PAYMENT_METHOD_LABELS[item])
    : [];
  const attendanceByDay = new Map();
  if (Array.isArray(model.attendanceSchedule)) {
    model.attendanceSchedule.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }
      const day = String(item.day || "").trim().toUpperCase();
      if (!ATTENDANCE_DAY_LABELS[day]) {
        return;
      }
      attendanceByDay.set(day, {
        day,
        enabled: Boolean(item.enabled),
        start: String(item.start || "09:00"),
        end: String(item.end || "18:00"),
      });
    });
  }
  const attendanceRows = ATTENDANCE_DAY_ORDER.map((day) => {
    const item = attendanceByDay.get(day);
    return {
      day,
      label: ATTENDANCE_DAY_LABELS[day],
      enabled: Boolean(item?.enabled),
      start: item?.start || "09:00",
      end: item?.end || "18:00",
    };
  });
  const currentAttendanceDay = WEEKDAY_BY_JS_INDEX[new Date().getDay()];
  const returnPath = `${location.pathname}${location.search}${location.hash}`;
  const ageGateLink = `/verificacao-idade?return=${encodeURIComponent(returnPath)}`;

  const profileDetails = [
    { label: "Genero", value: model.genderIdentity || "--" },
    { label: "Genitalia", value: model.genitalia || "--" },
    { label: "Preferencia sexual", value: model.sexualPreference || "--" },
    { label: "Etnia", value: model.ethnicity || "--" },
    { label: "Cor dos olhos", value: model.eyeColor || "--" },
    { label: "Estilo de cabelo", value: model.hairStyle || "--" },
    { label: "Tamanho de cabelo", value: model.hairLength || "--" },
    { label: "Tamanho do pe", value: model.shoeSize || "--" },
    { label: "Silicone", value: model.silicone || "--" },
    { label: "Tatuagens", value: model.tattoos || "--" },
    { label: "Piercings", value: model.piercings || "--" },
    { label: "Fumante", value: model.smoker || "--" },
    { label: "Idiomas", value: model.languages || "--" },
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

  const openMediaViewer = (item) => {
    if (!item) {
      return;
    }
    pinchStartDistanceRef.current = 0;
    pinchStartZoomRef.current = 1;
    didPinchRef.current = false;
    didDragRef.current = false;
    isMouseDraggingRef.current = false;
    setIsMediaDragging(false);
    setMediaZoom(1);
    setMediaPan({ x: 0, y: 0 });
    setMediaViewerItem(item);
    setViewerMode("media");
  };

  const closeOverlays = () => {
    setAvatarMenuOpen(false);
    setViewerMode("");
    setMediaViewerItem(null);
    pinchStartDistanceRef.current = 0;
    pinchStartZoomRef.current = 1;
    didPinchRef.current = false;
    didDragRef.current = false;
    isMouseDraggingRef.current = false;
    setIsMediaDragging(false);
    setMediaZoom(1);
    setMediaPan({ x: 0, y: 0 });
  };

  const zoomOutMedia = () => {
    setMediaZoom((current) => Math.max(1, Number((current - 0.5).toFixed(1))));
  };

  const zoomInMedia = () => {
    setMediaZoom((current) => Math.min(4, Number((current + 0.5).toFixed(1))));
  };

  const toggleMediaZoom = () => {
    if (didPinchRef.current || didDragRef.current) {
      didPinchRef.current = false;
      didDragRef.current = false;
      return;
    }
    setMediaZoom((current) => (current > 1 ? 1 : 2));
  };

  const clampMediaPan = (x, y) => {
    const image = mediaImageRef.current;
    if (!image || mediaZoom <= 1) {
      return { x: 0, y: 0 };
    }

    const rect = image.getBoundingClientRect();
    const maxX = Math.max(0, ((rect.width * mediaZoom) - rect.width) / 2);
    const maxY = Math.max(0, ((rect.height * mediaZoom) - rect.height) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const getTouchDistance = (touchA, touchB) => {
    const dx = touchA.clientX - touchB.clientX;
    const dy = touchA.clientY - touchB.clientY;
    return Math.hypot(dx, dy);
  };

  const handleMediaMouseDown = (event) => {
    if (mediaZoom <= 1 || event.button !== 0) {
      return;
    }
    event.preventDefault();
    isMouseDraggingRef.current = true;
    setIsMediaDragging(true);
    didDragRef.current = false;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    panStartRef.current = { x: mediaPan.x, y: mediaPan.y };
  };

  const handleMediaTouchStart = (event) => {
    if (event.touches.length === 2) {
      const distance = getTouchDistance(event.touches[0], event.touches[1]);
      pinchStartDistanceRef.current = distance;
      pinchStartZoomRef.current = mediaZoom;
      didPinchRef.current = false;
      return;
    }

    if (event.touches.length !== 1 || mediaZoom <= 1) {
      return;
    }
    const touch = event.touches[0];
    didDragRef.current = false;
    touchPanStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      panX: mediaPan.x,
      panY: mediaPan.y,
    };
  };

  const handleMediaTouchMove = (event) => {
    if (event.touches.length === 2) {
      const startDistance = pinchStartDistanceRef.current;
      if (!startDistance) {
        return;
      }
      const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
      const ratio = currentDistance / startDistance;
      const nextZoom = Math.min(4, Math.max(1, pinchStartZoomRef.current * ratio));
      didPinchRef.current = true;
      setMediaZoom(Number(nextZoom.toFixed(2)));
      event.preventDefault();
      return;
    }

    if (event.touches.length !== 1 || mediaZoom <= 1) {
      return;
    }

    const touch = event.touches[0];
    const dx = touch.clientX - touchPanStartRef.current.x;
    const dy = touch.clientY - touchPanStartRef.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      didDragRef.current = true;
    }
    const next = clampMediaPan(
      touchPanStartRef.current.panX + dx,
      touchPanStartRef.current.panY + dy
    );
    setMediaPan(next);
    event.preventDefault();
  };

  const handleMediaTouchEnd = (event) => {
    if (event.touches.length === 1 && mediaZoom > 1) {
      const touch = event.touches[0];
      touchPanStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        panX: mediaPan.x,
        panY: mediaPan.y,
      };
      return;
    }

    pinchStartDistanceRef.current = 0;
    pinchStartZoomRef.current = mediaZoom;
  };

  const ratingToStars = (value) => {
    const score = Math.max(0, Math.min(5, Number(value) || 0));
    return `${"â˜…".repeat(score)}${"â˜†".repeat(5 - score)}`;
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
            {score === 0 ? "0" : "â˜…".repeat(score)}
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

                {hasInstagramDisplay ? (
                  <div className="tag-list profile-public-tags">
                    <span className="pill">{instagramDisplay}</span>
                  </div>
                ) : null}
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
                <strong>{displayMediaCount}</strong>
              </div>
            </div>

            <div className="profile-public-cta">
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
              ) : null}
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
            Fotos e videos ({displayMediaCount})
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
                  <span className="pill">{displayMediaPhotos} fotos</span>
                  <span className="pill">{displayMediaVideos} videos</span>
                </div>
              </div>

              {shouldShowAgeGate ? (
                <div className="profile-public-media-grid">
                  {orderedGalleryMedia.map((item) =>
                    item.type === "VIDEO" ? (
                      <button
                        key={item.id}
                        type="button"
                        className="profile-public-media-card is-video"
                        onClick={() => openMediaViewer(item)}
                      >
                        <video src={item.url} preload="metadata" playsInline />
                      </button>
                    ) : (
                      <button
                        key={item.id}
                        type="button"
                        className="profile-public-media-card"
                        onClick={() => openMediaViewer(item)}
                      >
                        <img src={item.url} alt="Midia da acompanhante" loading="lazy" />
                      </button>
                    )
                  )}
                  {Array.from({ length: Math.max(restrictedCount, 0) }).map((_, index) => (
                    <div
                      key={`locked-${index}`}
                      className="profile-public-media-card is-locked is-placeholder"
                    >
                      <Link to={ageGateLink} className="profile-public-media-lock">
                        <div className="profile-public-media-lock-text">
                          <span>CONTE&Uacute;DO</span>
                          <strong>+18</strong>
                          <span className="profile-public-media-lock-action">Visualizar</span>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : totalMediaCount > 0 ? (
                <div className="profile-public-media-grid">
                  {orderedGalleryMedia.map((item) =>
                    item.type === "VIDEO" ? (
                      <button
                        key={item.id}
                        type="button"
                        className="profile-public-media-card is-video"
                        onClick={() => openMediaViewer(item)}
                      >
                        <video src={item.url} preload="metadata" playsInline />
                      </button>
                    ) : (
                      <button
                        key={item.id}
                        type="button"
                        className="profile-public-media-card"
                        onClick={() => openMediaViewer(item)}
                      >
                        <img src={item.url} alt="Midia da acompanhante" loading="lazy" />
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div className="card">
                  <h4>Sem midias publicadas</h4>
                  <p className="muted">
                    A acompanhante ainda nao publicou fotos ou videos aprovados.
                  </p>
                </div>
              )}

              <div className="profile-public-services">
                <div className="profile-public-services-title">Servi&ccedil;os oferecidos</div>
                <div className="profile-public-services-grid">
                  <div className="profile-public-services-column">
                    <div className="profile-public-services-column-title">
                      Servi&ccedil;os oferecidos
                    </div>
                    {offeredServiceList.length > 0 ? (
                      offeredServiceList.map((service) => (
                        <div key={service.name} className="profile-public-service-row">
                          <span>{getServiceLabel(service.name)}</span>
                          <div className="profile-public-service-meta">
                            {service.featured ? (
                              <span className="profile-public-service-specialty">
                                Minha especialidade
                              </span>
                            ) : null}
                            <span className="profile-public-service-badge">Fa&ccedil;o</span>
                            <span className="profile-public-service-chevron">v</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="muted">Sem servi&ccedil;os marcados.</p>
                    )}
                  </div>
                  <div className="profile-public-services-column">
                    <div className="profile-public-services-column-title">
                      Servi&ccedil;os n&atilde;o oferecidos
                    </div>
                    {notOfferedServiceList.map((service) => (
                      <div key={service.name} className="profile-public-service-row is-disabled">
                        <span>{getServiceLabel(service.name)}</span>
                        <span className="profile-public-service-chevron">v</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="profile-public-values">
                <div className="profile-public-values-title">Valores</div>
                <div className="profile-public-values-grid">
                  <div className="profile-public-values-column">
                    {valuesLeftColumn.map((row) => (
                      <div key={row.label} className="profile-public-value-row">
                        <span>{row.label}</span>
                        <strong>{formatPriceBr(row.value)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="profile-public-values-column">
                    {valuesRightColumn.map((row) => (
                      <div key={row.label} className="profile-public-value-row">
                        <span>{row.label}</span>
                        <strong>{formatPriceBr(row.value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="profile-public-payment">
                  <span className="profile-public-payment-title">Formas de pagamento:</span>
                  <div className="profile-public-payment-tags">
                    {paymentMethods.length > 0 ? (
                      paymentMethods.map((method) => (
                        <span
                          key={method}
                          className={`profile-public-payment-tag method-${method.toLowerCase()}`}
                        >
                          {PAYMENT_METHOD_LABELS[method]}
                        </span>
                      ))
                    ) : (
                      <span className="muted">N&atilde;o informado</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="profile-public-attendance">
                <div className="profile-public-attendance-title">
                  Hor&aacute;rio de expediente
                </div>
                <div className="profile-public-attendance-list">
                  {attendanceRows.map((row) => (
                    <div
                      key={row.day}
                      className={`profile-public-attendance-row ${
                        row.day === currentAttendanceDay ? "is-today" : ""
                      }`}
                    >
                      <span className={row.enabled ? "" : "muted"}>{row.label}</span>
                      <strong className={row.enabled ? "" : "muted"}>
                        {row.enabled ? `${row.start} - ${row.end}` : "N\u00e3o atende"}
                      </strong>
                    </div>
                  ))}
                </div>
                <p className="muted profile-public-attendance-note">
                  A disponibilidade do anunciante n&atilde;o &eacute; garantida pelo seu
                  hor&aacute;rio de atendimento.
                </p>
              </div>
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
                    {hasInstagramDisplay ? (
                      <span className="pill">{instagramDisplay}</span>
                    ) : null}
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
                Essa acompanhante ainda nao publicou shots.
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
            aria-label="Shots da acompanhante"
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
              <p className="muted">Essa acompanhante ainda nao publicou shots.</p>
            )}
          </div>
        </div>
      ) : null}

      {viewerMode === "media" && mediaViewerItem ? (
        <div className="profile-public-overlay" role="presentation" onClick={closeOverlays}>
          <div
            className="profile-public-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Midia da acompanhante"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-public-viewer-head">
              <h3>Midia da acompanhante</h3>
              <div className="profile-public-viewer-actions">
                {mediaViewerItem.type !== "VIDEO" ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={zoomOutMedia}
                      disabled={mediaZoom <= 1}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={zoomInMedia}
                      disabled={mediaZoom >= 4}
                    >
                      +
                    </button>
                  </>
                ) : null}
                <button type="button" className="btn btn-outline" onClick={closeOverlays}>
                  Fechar
                </button>
              </div>
            </div>
            <div className="profile-public-viewer-media">
              {mediaViewerItem.type === "VIDEO" ? (
                <video src={mediaViewerItem.url} controls preload="metadata" playsInline />
              ) : (
                <img
                  ref={mediaImageRef}
                  src={mediaViewerItem.url}
                  alt="Midia da acompanhante"
                  className={`profile-public-viewer-zoomable ${
                    mediaZoom > 1 ? "is-zoomed" : ""
                  } ${isMediaDragging ? "is-dragging" : ""}`}
                  onMouseDown={handleMediaMouseDown}
                  onClick={toggleMediaZoom}
                  onTouchStart={handleMediaTouchStart}
                  onTouchMove={handleMediaTouchMove}
                  onTouchEnd={handleMediaTouchEnd}
                  onTouchCancel={handleMediaTouchEnd}
                  onDragStart={(event) => event.preventDefault()}
                  style={{
                    transform: `translate3d(${mediaPan.x}px, ${mediaPan.y}px, 0) scale(${mediaZoom})`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


