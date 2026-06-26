import type { Request } from "express";
import { deleteFromBunny, uploadThumbnailToBunny, uploadToBunny } from "./bunny";

const THUMBNAIL_MAX_BYTES = 200 * 1024;

type MulterFileMap = Record<string, Express.Multer.File[]>;

function filesForField(req: Request, field: string) {
  const fileMap = (req.files || {}) as MulterFileMap;
  return Array.isArray(fileMap[field]) ? fileMap[field] : [];
}

function parseThumbnailIndexes(value: unknown) {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return values
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0);
}

export function getProgressiveUploadFiles(req: Request, field = "files") {
  return filesForField(req, field);
}

export function getProgressiveUploadThumbnails(req: Request) {
  const thumbnails = filesForField(req, "thumbnails");
  const indexes = parseThumbnailIndexes(req.body?.thumbnailIndexes);
  const byIndex = new Map<number, Express.Multer.File>();

  thumbnails.forEach((thumbnail, position) => {
    const index = indexes[position];
    if (index !== undefined && !byIndex.has(index)) {
      byIndex.set(index, thumbnail);
    }
  });

  return byIndex;
}

export async function uploadProgressiveFile(
  file: Express.Multer.File,
  thumbnail?: Express.Multer.File
) {
  const result = await uploadToBunny(file.buffer, file.originalname, file.mimetype);

  if (!file.mimetype.startsWith("image/") || !thumbnail) {
    return result;
  }

  if (thumbnail.mimetype !== "image/webp" || thumbnail.size > THUMBNAIL_MAX_BYTES) {
    await deleteFromBunny(result.path).catch(() => undefined);
    throw new Error("Miniatura de imagem invalida");
  }

  try {
    await uploadThumbnailToBunny(thumbnail.buffer, result.path);
    return result;
  } catch (error) {
    await deleteFromBunny(result.path).catch(() => undefined);
    throw error;
  }
}
