import { useEffect, useMemo, useState } from "react";

const buildPlaceholderSvg = (label = "") => {
  const safeLabel = String(label || "").trim();
  const initials = safeLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

export default function ProgressiveImage({
  src,
  alt,
  className = "",
  fallbackSrc = "/model-placeholder.svg",
  loading = "lazy",
  style,
  ...props
}) {
  const placeholderSrc = useMemo(() => buildPlaceholderSvg(alt), [alt]);
  const [displaySrc, setDisplaySrc] = useState(placeholderSrc);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!src) {
      setDisplaySrc(fallbackSrc);
      setIsLoaded(true);
      return undefined;
    }

    setDisplaySrc(placeholderSrc);
    setIsLoaded(false);

    let canceled = false;
    const image = new Image();
    image.src = src;

    image.onload = () => {
      if (!canceled) {
        setDisplaySrc(src);
        setIsLoaded(true);
      }
    };

    image.onerror = () => {
      if (!canceled) {
        setDisplaySrc(fallbackSrc);
        setIsLoaded(true);
      }
    };

    return () => {
      canceled = true;
    };
  }, [src, fallbackSrc, placeholderSrc]);

  return (
    <img
      {...props}
      src={displaySrc}
      alt={alt}
      loading={loading}
      style={style}
      className={`progressive-image ${isLoaded ? "progressive-image--loaded" : ""} ${className}`.trim()}
    />
  );
}
