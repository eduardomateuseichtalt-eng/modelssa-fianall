import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";

const THUMBNAIL_MARKER = "/uploads/";
const THUMBNAIL_DIRECTORY = "/uploads/thumbnails/";

const escapeXml = (value) =>
  value.replace(/[<>&'"]/g, (character) => {
    const entities = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };
    return entities[character];
  });

const buildPlaceholderSvg = (label = "") => {
  const safeLabel = String(label || "").trim();
  const initials = escapeXml(
    safeLabel
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase()
  );

  const markup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1a1622" />
          <stop offset="100%" stop-color="#4b2e2e" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="12" fill="url(#g)" />
      <circle cx="16" cy="13" r="6" fill="rgba(255,255,255,0.16)" />
      <path d="M6 28c2.4-5 5.6-7 10-7s7.6 2 10 7" fill="rgba(255,255,255,0.16)" />
      ${initials ? `<text x="16" y="17.4" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="rgba(255,255,255,0.9)">${initials}</text>` : ""}
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
};

export function getProgressiveThumbnailSrc(src) {
  if (!src || typeof src !== "string" || src.startsWith("blob:") || src.startsWith("data:")) {
    return "";
  }

  try {
    const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(src);
    const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(src, baseUrl);
    const markerIndex = url.pathname.indexOf(THUMBNAIL_MARKER);

    if (markerIndex < 0 || url.pathname.includes(THUMBNAIL_DIRECTORY)) {
      return "";
    }

    const filePath = url.pathname.slice(markerIndex + THUMBNAIL_MARKER.length);
    url.pathname = `${url.pathname.slice(0, markerIndex)}${THUMBNAIL_DIRECTORY}${filePath}.webp`;
    url.search = "";
    url.hash = "";

    return isAbsolute ? url.toString() : `${url.pathname}`;
  } catch {
    return "";
  }
}

const ProgressiveImage = forwardRef(function ProgressiveImage({
  src,
  thumbnailSrc,
  alt,
  className = "",
  fallbackSrc = "/model-placeholder.svg",
  loading = "lazy",
  fetchPriority,
  style,
  ...props
}, forwardedRef) {
  const imageRef = useRef(null);
  const setImageRef = useCallback(
    (element) => {
      imageRef.current = element;
      if (typeof forwardedRef === "function") {
        forwardedRef(element);
      } else if (forwardedRef) {
        forwardedRef.current = element;
      }
    },
    [forwardedRef]
  );
  const placeholderSrc = useMemo(() => buildPlaceholderSvg(alt), [alt]);
  const previewSrc = useMemo(
    () => thumbnailSrc || getProgressiveThumbnailSrc(src),
    [src, thumbnailSrc]
  );
  const requestKey = `${src || ""}\u0000${previewSrc}\u0000${fallbackSrc}`;
  const [imageState, setImageState] = useState(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const shouldLoad = loading !== "lazy" || isNearViewport;

  useEffect(() => {
    if (loading !== "lazy") {
      return undefined;
    }

    const element = imageRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => setIsNearViewport(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    if (!shouldLoad || !src) {
      return undefined;
    }

    let canceled = false;
    let fullImage;
    let fullStarted = false;
    let fullLoaded = false;
    let previewImage;
    let fullFallbackTimer;

    const loadFullImage = () => {
      if (fullStarted || canceled) {
        return;
      }
      fullStarted = true;
      fullImage = new Image();
      if (fetchPriority) {
        fullImage.fetchPriority = fetchPriority;
      }
      fullImage.onload = () => {
        if (!canceled) {
          fullLoaded = true;
          setImageState({ requestKey, displaySrc: src, phase: "loaded" });
        }
      };
      fullImage.onerror = () => {
        if (!canceled) {
          setImageState({ requestKey, displaySrc: fallbackSrc, phase: "loaded" });
        }
      };
      fullImage.src = src;
    };

    if (previewSrc && previewSrc !== src) {
      previewImage = new Image();
      previewImage.onload = () => {
        if (!canceled && !fullLoaded) {
          setImageState({ requestKey, displaySrc: previewSrc, phase: "preview" });
          loadFullImage();
        }
      };
      previewImage.onerror = loadFullImage;
      previewImage.src = previewSrc;
      fullFallbackTimer = window.setTimeout(loadFullImage, 1500);
    } else {
      loadFullImage();
    }

    return () => {
      canceled = true;
      if (fullFallbackTimer) {
        window.clearTimeout(fullFallbackTimer);
      }
      if (previewImage) {
        previewImage.onload = null;
        previewImage.onerror = null;
      }
      if (fullImage) {
        fullImage.onload = null;
        fullImage.onerror = null;
      }
    };
  }, [src, previewSrc, fallbackSrc, requestKey, shouldLoad, fetchPriority]);

  const hasCurrentState = imageState?.requestKey === requestKey;
  const displaySrc = !src
    ? fallbackSrc
    : hasCurrentState
      ? imageState.displaySrc
      : placeholderSrc;
  const phase = !src ? "loaded" : hasCurrentState ? imageState.phase : "placeholder";

  return (
    <img
      {...props}
      ref={setImageRef}
      src={displaySrc}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      data-progressive-phase={phase}
      style={style}
      className={`progressive-image progressive-image--${phase} ${className}`.trim()}
    />
  );
});

export default ProgressiveImage;
