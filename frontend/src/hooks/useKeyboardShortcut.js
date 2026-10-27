import { useEffect, useRef, useCallback } from 'react';

const MODIFIER_KEYS = ['ctrl', 'shift', 'alt', 'meta'];
const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Registers a keyboard shortcut that fires the callback when pressed.
 * Automatically ignores keypresses when the user is typing in form fields.
 *
 * @param {string} shortcut - Key combo like 'ctrl+k', 'escape', 'shift+n', 'ctrl+shift+p'
 * @param {Function} callback - Function to call when the shortcut is triggered
 * @param {Object} options - { enabled: true, ignoreInputs: true }
 *
 * @example
 *   useKeyboardShortcut('ctrl+k', () => setCommandPaletteOpen(true));
 *   useKeyboardShortcut('escape', () => closeModal(), { enabled: isModalOpen });
 */
export function useKeyboardShortcut(shortcut, callback, options = {}) {
  const { enabled = true, ignoreInputs = true } = options;
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const parsedShortcut = useRef(null);

  useEffect(() => {
    const parts = shortcut.toLowerCase().split('+').map(s => s.trim());
    parsedShortcut.current = {
      ctrl: parts.includes('ctrl'),
      shift: parts.includes('shift'),
      alt: parts.includes('alt'),
      meta: parts.includes('meta'),
      key: parts.find(p => !MODIFIER_KEYS.includes(p)) || '',
    };
  }, [shortcut]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const parsed = parsedShortcut.current;
      if (!parsed) return;

      // Ignore if user is typing in an input field
      if (ignoreInputs) {
        const target = e.target;
        if (INPUT_TAGS.has(target.tagName) || target.isContentEditable) return;
      }

      const key = e.key.toLowerCase();

      // Map common key names
      const normalizedKey = key === ' ' ? 'space' : key;

      if (
        normalizedKey === parsed.key &&
        e.ctrlKey === parsed.ctrl &&
        e.shiftKey === parsed.shift &&
        e.altKey === parsed.alt &&
        e.metaKey === parsed.meta
      ) {
        e.preventDefault();
        e.stopPropagation();
        callbackRef.current(e);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, ignoreInputs]);
}
