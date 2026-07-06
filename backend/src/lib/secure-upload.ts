import multer from "multer";
import type { Request } from "express";

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const THUMBNAIL_MAX_BYTES = 200 * 1024;

const requestBytesKey = Symbol("secureUploadRequestBytes");

type UploadRequest = Request & { [requestBytesKey]?: number };

type SecureMemoryStorageOptions = {
  maxTotalBytes: number;
};

export function createSecureMemoryStorage({
  maxTotalBytes,
}: SecureMemoryStorageOptions): multer.StorageEngine {
  return {
    _handleFile(req: Request, file, callback) {
      const uploadReq = req as UploadRequest;
      const chunks: Buffer[] = [];
      let fileBytes = 0;
      let uploadError: Error | null = null;
      let completed = false;

      file.stream.on("data", (chunk: Buffer) => {
        fileBytes += chunk.length;
        uploadReq[requestBytesKey] = (uploadReq[requestBytesKey] || 0) + chunk.length;

        const fileLimit = file.fieldname === "thumbnails"
          ? THUMBNAIL_MAX_BYTES
          : file.mimetype.startsWith("image/")
            ? IMAGE_MAX_BYTES
            : VIDEO_MAX_BYTES;

        if (!uploadError && fileBytes > fileLimit) {
          uploadError = new multer.MulterError("LIMIT_FILE_SIZE", file.fieldname);
          chunks.length = 0;
          return;
        }

        if (!uploadError && (uploadReq[requestBytesKey] || 0) > maxTotalBytes) {
          const error = new Error("O tamanho total dos arquivos excede o limite permitido.");
          (error as Error & { status?: number }).status = 413;
          uploadError = error;
          chunks.length = 0;
          return;
        }

        if (!uploadError) {
          chunks.push(chunk);
        }
      });

      file.stream.once("error", (error) => {
        if (completed) return;
        completed = true;
        callback(error);
      });
      file.stream.once("end", () => {
        if (completed) return;
        completed = true;
        if (uploadError) {
          callback(uploadError);
          return;
        }
        callback(null, {
          buffer: Buffer.concat(chunks),
          size: fileBytes,
        });
      });
    },
    _removeFile(_req, file, callback) {
      file.buffer = Buffer.alloc(0);
      callback(null);
    },
  };
}

function hasPrefix(buffer: Buffer, bytes: number[]) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

export function fileMatchesDeclaredType(file: Express.Multer.File) {
  const buffer = file.buffer;
  if (!buffer || buffer.length < 12) return false;

  if (file.mimetype === "image/jpeg") {
    return hasPrefix(buffer, [0xff, 0xd8, 0xff]);
  }
  if (file.mimetype === "image/png") {
    return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (file.mimetype === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (file.mimetype === "video/mp4" || file.mimetype === "video/quicktime") {
    return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  }
  return false;
}

export function getUploadedFileError(file: Express.Multer.File) {
  if (!fileMatchesDeclaredType(file)) {
    return "O conteudo do arquivo nao corresponde ao formato informado.";
  }
  if (file.mimetype.startsWith("image/") && file.size > IMAGE_MAX_BYTES) {
    return "A imagem excede o limite de 10 MB.";
  }
  if (file.mimetype.startsWith("video/") && file.size > VIDEO_MAX_BYTES) {
    return "O video excede o limite de 50 MB.";
  }
  return null;
}
