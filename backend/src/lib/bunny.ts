import { v4 as uuidv4 } from "uuid";

type UploadResult = {
  url: string;
  path: string;
};

const UPLOAD_PREFIX = "uploads/";
const THUMBNAIL_PREFIX = "uploads/thumbnails/";

export function getThumbnailPath(sourcePath: string) {
  const normalizedPath = sourcePath.trim().replace(/^\/+/, "");
  if (!normalizedPath.startsWith(UPLOAD_PREFIX) || normalizedPath.startsWith(THUMBNAIL_PREFIX)) {
    throw new Error("Caminho de imagem invalido para miniatura");
  }
  return `${THUMBNAIL_PREFIX}${normalizedPath.slice(UPLOAD_PREFIX.length)}.webp`;
}

function getBunnyConfig() {
  const storageZone = process.env.BUNNY_STORAGE_ZONE || "";
  const apiKey = process.env.BUNNY_STORAGE_KEY || process.env.BUNNY_API_KEY || "";
  const cdnUrl = (process.env.BUNNY_CDN_URL || "").replace(/\/+$/, "");
  const storageHost = process.env.BUNNY_STORAGE_HOST || "storage.bunnycdn.com";

  return {
    storageZone,
    apiKey,
    cdnUrl,
    storageHost,
  };
}

function getAuthHeaders(contentType?: string) {
  const { apiKey } = getBunnyConfig();
  const headers: Record<string, string> = {
    AccessKey: apiKey,
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  return headers;
}

async function uploadBufferToPath(
  buffer: Buffer,
  path: string,
  contentType: string
): Promise<UploadResult> {
  const { storageZone, apiKey, cdnUrl, storageHost } = getBunnyConfig();

  if (!storageZone || !apiKey || !cdnUrl) {
    throw new Error("Bunny CDN configuration missing");
  }

  const normalizedPath = path.trim().replace(/^\/+/, "");
  if (!normalizedPath.startsWith(UPLOAD_PREFIX)) {
    throw new Error("Caminho invalido para upload");
  }

  const uploadUrl = `https://${storageHost}/${storageZone}/${normalizedPath}`;
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: getAuthHeaders(contentType),
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details ? `Upload failed: ${details}` : "Upload failed");
  }

  return {
    url: `${cdnUrl}/${normalizedPath}`,
    path: normalizedPath,
  };
}

export async function uploadToBunny(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<UploadResult> {
  const { storageZone, apiKey, cdnUrl, storageHost } = getBunnyConfig();

  if (process.env.BUNNY_DEBUG === "true") {
    console.log("Bunny config:", {
      zone: storageZone,
      host: storageHost,
      keyLength: apiKey.length,
      cdn: cdnUrl,
    });
  }

  if (!storageZone || !apiKey || !cdnUrl) {
    throw new Error("Bunny CDN configuration missing");
  }

  const safeName =
    fileName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(-180) || "arquivo";
  const uniqueName = `${uuidv4()}-${safeName}`;
  const path = `uploads/${uniqueName}`;
  return uploadBufferToPath(buffer, path, contentType);
}

export async function uploadThumbnailToBunny(buffer: Buffer, sourcePath: string) {
  return uploadBufferToPath(buffer, getThumbnailPath(sourcePath), "image/webp");
}

export async function deleteFromBunny(urlOrPath: string): Promise<void> {
  const { storageZone, apiKey, cdnUrl, storageHost } = getBunnyConfig();

  if (!storageZone || !apiKey || !cdnUrl) {
    throw new Error("Bunny CDN configuration missing");
  }

  let path = urlOrPath.trim();
  if (path.startsWith("http")) {
    try {
      const parsed = new URL(path);
      path = parsed.pathname.replace(/^\/+/, "");
    } catch {
      throw new Error("URL invalida para deletar");
    }
  }

  if (!path.startsWith("uploads/")) {
    throw new Error("Caminho invalido para deletar");
  }

  const deleteUrl = `https://${storageHost}/${storageZone}/${path}`;
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details ? `Delete failed: ${details}` : "Delete failed");
  }
}

export async function deleteThumbnailFromBunny(urlOrPath: string): Promise<void> {
  const { storageZone, apiKey, cdnUrl, storageHost } = getBunnyConfig();

  if (!storageZone || !apiKey || !cdnUrl) {
    throw new Error("Bunny CDN configuration missing");
  }

  let sourcePath = urlOrPath.trim();
  if (sourcePath.startsWith("http")) {
    try {
      sourcePath = new URL(sourcePath).pathname.replace(/^\/+/, "");
    } catch {
      throw new Error("URL invalida para deletar miniatura");
    }
  }

  const thumbnailPath = getThumbnailPath(sourcePath);
  const deleteUrl = `https://${storageHost}/${storageZone}/${thumbnailPath}`;
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok && response.status !== 404) {
    const details = await response.text().catch(() => "");
    throw new Error(details ? `Delete failed: ${details}` : "Delete failed");
  }
}

export async function validateBunnyConnection(): Promise<void> {
  const { storageZone, apiKey, cdnUrl, storageHost } = getBunnyConfig();

  if (!storageZone || !apiKey || !cdnUrl) {
    throw new Error("Bunny CDN configuration missing");
  }

  const path = `uploads/healthcheck-${uuidv4()}.txt`;
  const uploadUrl = `https://${storageHost}/${storageZone}/${path}`;

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: getAuthHeaders("text/plain"),
    body: new Uint8Array(Buffer.from("healthcheck")),
  });

  if (!putResponse.ok) {
    const details = await putResponse.text().catch(() => "");
    throw new Error(details ? `Upload failed: ${details}` : "Upload failed");
  }

  const deleteResponse = await fetch(uploadUrl, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!deleteResponse.ok) {
    const details = await deleteResponse.text().catch(() => "");
    throw new Error(details ? `Delete failed: ${details}` : "Delete failed");
  }
}
