/**
 * @module mime-type-inference
 *
 * Infers MIME types from file paths and base64-encoded data.
 * Ported and adapted from oh-my-openagent's look-at tool.
 *
 * Used by read-file and image-reading tools to correctly tag
 * image/PDF content for LLM providers that support multimodal input.
 */

import { extname } from 'node:path';

/**
 * Infer MIME type from base64-encoded content by inspecting magic bytes.
 * Returns 'image/png' as a safe default for ambiguous data.
 */
export function inferMimeTypeFromBase64(base64Data: string): string {
  // data: URI prefix
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/^data:([^;]+);/);
    if (match) return match[1];
  }

  try {
    const cleanData = base64Data.replace(/^data:[^;]+;base64,/, '');
    const header = Buffer.from(cleanData.slice(0, 256), 'base64').toString('binary');

    if (header.startsWith('\x89PNG')) return 'image/png';
    if (header.startsWith('\xFF\xD8\xFF')) return 'image/jpeg';
    if (header.startsWith('GIF8')) return 'image/gif';
    if (header.startsWith('RIFF') && header.includes('WEBP')) return 'image/webp';
    if (
      header.includes('ftypheic') ||
      header.includes('ftypheix') ||
      header.includes('ftyphevc') ||
      header.includes('ftyphevx')
    ) {
      return 'image/heic';
    }
    if (header.includes('ftypheif') || header.includes('ftypmif1') || header.includes('ftypmsf1')) {
      return 'image/heif';
    }
    if (header.startsWith('%PDF')) return 'application/pdf';
  } catch {
    // invalid base64 - fall through
  }

  return 'image/png';
}

const EXTENSION_MIME_MAP: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  // RAW camera formats
  '.cr2': 'image/x-canon-cr2',
  '.crw': 'image/x-canon-crw',
  '.nef': 'image/x-nikon-nef',
  '.nrw': 'image/x-nikon-nrw',
  '.arw': 'image/x-sony-arw',
  '.sr2': 'image/x-sony-sr2',
  '.srf': 'image/x-sony-srf',
  // Documents
  '.pdf': 'application/pdf',
};

/**
 * Infer MIME type from a file path by looking at its extension.
 * Returns 'application/octet-stream' for unknown extensions.
 */
export function inferMimeTypeFromFilePath(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MIME_MAP[ext] ?? 'application/octet-stream';
}

/**
 * Returns true if the MIME type represents an image format.
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Returns true if the MIME type is something a multimodal LLM can likely handle
 * (images and PDFs supported by most vision models).
 */
export function isMultimodalMimeType(mimeType: string): boolean {
  return isImageMimeType(mimeType) || mimeType === 'application/pdf';
}
