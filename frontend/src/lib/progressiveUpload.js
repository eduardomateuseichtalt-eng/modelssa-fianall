const THUMBNAIL_MAX_DIMENSION = 72;
const THUMBNAIL_QUALITY = 0.35;
const FULL_IMAGE_MAX_DIMENSION = 2560;
const FULL_IMAGE_QUALITY = 0.88;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadLocalImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Nao foi possivel preparar a miniatura da imagem."));
    };
    image.src = objectUrl;
  });
}

function canvasToWebp(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}

function drawScaledImage(image, sourceWidth, sourceHeight, maxDimension) {
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function createImageVariants(file) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return { fullImage: file, thumbnail: null };
  }

  const { image, objectUrl } = await loadLocalImage(file);
  try {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
      return { fullImage: file, thumbnail: null };
    }

    const fullCanvas = drawScaledImage(
      image,
      sourceWidth,
      sourceHeight,
      FULL_IMAGE_MAX_DIMENSION
    );
    const thumbnailCanvas = drawScaledImage(
      image,
      sourceWidth,
      sourceHeight,
      THUMBNAIL_MAX_DIMENSION
    );
    if (!fullCanvas || !thumbnailCanvas) {
      return { fullImage: file, thumbnail: null };
    }

    const [fullBlob, thumbnailBlob] = await Promise.all([
      canvasToWebp(fullCanvas, FULL_IMAGE_QUALITY),
      canvasToWebp(thumbnailCanvas, THUMBNAIL_QUALITY),
    ]);

    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagem";
    const fullImage =
      fullBlob?.type === "image/webp"
        ? new File([fullBlob], `${baseName}.webp`, {
            type: "image/webp",
            lastModified: file.lastModified,
          })
        : file;
    const thumbnail =
      thumbnailBlob?.type === "image/webp"
        ? new File([thumbnailBlob], `${baseName}-thumb.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          })
        : null;

    return { fullImage, thumbnail };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function buildProgressiveUploadFormData(
  files,
  { fileField = "files" } = {}
) {
  const formData = new FormData();
  const uploadFiles = Array.from(files || []);

  for (const [index, file] of uploadFiles.entries()) {
    let fullImage = file;
    let thumbnail = null;

    try {
      const variants = await createImageVariants(file);
      fullImage = variants.fullImage;
      thumbnail = variants.thumbnail;
    } catch {
      // O upload principal continua funcionando caso o navegador nao consiga gerar WebP.
    }

    formData.append(fileField, fullImage);
    if (thumbnail) {
      formData.append("thumbnails", thumbnail);
      formData.append("thumbnailIndexes", String(index));
    }
  }

  return formData;
}
