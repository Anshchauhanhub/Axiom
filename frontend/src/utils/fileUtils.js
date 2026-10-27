/**
 * fileUtils.js — Robust client-side file reading, PDF text extraction, and sanitization.
 * Prevents non-printable binary control characters / NUL bytes from breaking API calls.
 */
import { extractFileText } from '../services/api';

/**
 * Strips NUL (0x00) bytes and unprintable control characters.
 */
export const sanitizeText = (text) => {
  if (!text) return '';
  let clean = Array.from(text).filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
  }).join('');
  // Remove Unicode replacement character sequences if corrupt
  clean = clean.replace(/\uFFFD/g, '');
  return clean.trim();
};

/**
 * Universal file content reader for images, PDFs, text, code, json, md, etc.
 * Uses high-fidelity backend PDF decompression with client-side fallback.
 */
export const readUploadedFile = async (file) => {
  if (!file) return null;

  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
  if (isImage) {
    return {
      name: file.name,
      type: 'image',
      content: `[Attached Image: ${file.name}]`,
      cleanName: file.name
    };
  }

  // Attempt high-fidelity server-side extraction (handles compressed PDF streams, spreadsheets, etc.)
  try {
    const serverResult = await extractFileText(file);
    if (serverResult && serverResult.text && serverResult.text.trim()) {
      const cleanContent = sanitizeText(serverResult.text);
      return {
        name: file.name,
        type: file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text',
        content: `[Attached Document: ${file.name}]\n--- Document Content ---\n${cleanContent}\n--- End Document Content ---`,
        cleanName: file.name,
        pageCount: serverResult.page_count || 1
      };
    }
    if (file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error(`No readable text was found in ${file.name}. It may be scanned or image-only.`);
    }
  } catch (err) {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error(`Could not read ${file.name}: ${err.message}`);
    }
    console.warn('Server-side document extraction unavailable, using fallback:', err);
  }

  // Fallback for text/code files
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawText = e.target.result || '';
      const cleanText = sanitizeText(rawText).slice(0, 15000);
      resolve({
        name: file.name,
        type: 'text',
        content: `[Attached Document: ${file.name}]\n--- Document Content ---\n${cleanText}\n--- End Document Content ---`,
        cleanName: file.name
      });
    };
    reader.onerror = () => {
      resolve({
        name: file.name,
        type: 'text',
        content: `[Attached Document: ${file.name}]`,
        cleanName: file.name
      });
    };
    reader.readAsText(file);
  });
};
