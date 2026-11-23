/**
 * js/storage.js
 * Mengelola seluruh data lokal di localStorage serta export/import cadangan JSON.
 */

const StorageManager = (() => {
  const KEYS = {
    SESSIONS: "irontrack_sessions_v1",
    SETTINGS: "irontrack_settings_v1",
    DRAFT: "irontrack_active_draft_v1"
  };

  const DEFAULT_SETTINGS = {
    theme: "dark",          // "dark" | "light"
    program: "bulking",     // "bulking" | "diet"
    defaultRestSec: 90      // 60 | 90 | 120 | 180
  };

  function safeParse(jsonStr, fallback) {
    try {
      return jsonStr ? JSON.parse(jsonStr) : fallback;
    } catch (err) {
      console.warn("Gagal membaca data lokal, memakai nilai default:", err);
      return fallback;
    }
  }
