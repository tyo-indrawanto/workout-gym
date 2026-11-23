/**
 * js/app.js
 * Titik masuk utama aplikasi IronTrack PWA.
 */

(() => {
  let currentSettings = null;

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("./sw.js")
          .then(() => {
            UIManager.updateOfflineIndicator();
          })
          .catch((err) => {
            console.warn("Registrasi Service Worker gagal:", err);
          });
      });
    }
  }

  function bindHeaderEvents() {
    // Toggle Tema Gelap / Terang
    const themeBtn = document.getElementById("btn-theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const nextTheme = currentSettings.theme === "dark" ? "light" : "dark";
        currentSettings = StorageManager.saveSettings({ theme: nextTheme });
        UIManager.applyTheme(nextTheme);
        UIManager.showToast(
          nextTheme === "light" ? "Tema Terang aktif" : "Tema Gelap aktif"
        );
      });
    }

    // Switcher Mode Program: Bulking vs Diet
    document.querySelectorAll("[data-program-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const chosen = btn.dataset.programChoice;
        currentSettings = StorageManager.saveSettings({ program: chosen });
        UIManager.applyProgram(chosen);
        UIManager.showToast(
          chosen === "diet"
            ? "Mode Diet aktif: jaga kekuatan beban"
            : "Mode Bulking aktif: targetkan progressive overload"
        );
      });
    });
  }

  function bindNavigationEvents() {
    document.querySelectorAll(".nav-item").forEach((navBtn) => {
      navBtn.addEventListener("click", () => {
        const targetId = navBtn.dataset.target;
        if (targetId) {
          UIManager.switchTab(targetId);
        }
      });
    });
  }

  function openExerciseModal() {
    const modal = document.getElementById("modal-add-exercise");
    const input = document.getElementById("input-exercise-name");
    if (!modal) return;
    modal.classList.remove("hidden");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 60);
    }
  }

  function closeExerciseModal() {
    const modal = document.getElementById("modal-add-exercise");
    if (modal) modal.classList.add("hidden");
  }

  function bindWorkoutEvents() {
    const splitSelect = document.getElementById("session-split");
    if (splitSelect) {
      splitSelect.addEventListener("change", (e) => {
        WorkoutTracker.setDraftSplit(e.target.value);
      });
    }

    const notesInput = document.getElementById("session-notes");
    if (notesInput) {
      notesInput.addEventListener("input", (e) => {
        WorkoutTracker.setDraftNotes(e.target.value);
      });
    }

    // Buka & tutup modal tambah gerakan
    const openModalBtn = document.getElementById("btn-open-add-exercise");
    const closeModalBtn = document.getElementById("btn-close-modal");
    const modalBackdrop = document.getElementById("modal-add-exercise");
    const confirmAddBtn = document.getElementById("btn-confirm-add-exercise");
    const nameInput = document.getElementById("input-exercise-name");
    const muscleSelect = document.getElementById("select-muscle-group");

    if (openModalBtn) openModalBtn.addEventListener("click", openExerciseModal);
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeExerciseModal);

    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) closeExerciseModal();
      });
    }

    const handleConfirmAdd = () => {
      const name = nameInput ? nameInput.value : "";
      const muscle = muscleSelect ? muscleSelect.value : "Chest";
      if (!name.trim()) {
        UIManager.showToast("Masukkan nama gerakan terlebih dahulu.");
        if (nameInput) nameInput.focus();
        return;
      }
      WorkoutTracker.addExercise(name, muscle);
      closeExerciseModal();
      UIManager.renderWorkoutDraft();
      UIManager.showToast(`"${name.trim()}" ditambahkan ke sesi.`);
    };

    if (confirmAddBtn) confirmAddBtn.addEventListener("click", handleConfirmAdd);
    if (nameInput) {
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleConfirmAdd();
        }
      });
    }

    // Salin Sesi Terakhir (Copy Last Session)
    const copyLastBtn = document.getElementById("btn-copy-last");
    if (copyLastBtn) {
      copyLastBtn.addEventListener("click", () => {
        const currentSplit = splitSelect ? splitSelect.value : null;
        const result = WorkoutTracker.copyLastSession(currentSplit);
        if (!result.ok) {
          UIManager.showToast(result.reason);
          return;
        }
        UIManager.renderWorkoutDraft();
        UIManager.showToast(
          `Menyalin ${result.count} gerakan dari sesi "${result.fromSplit}".`
        );
      });
    }

    // Event delegation di dalam daftar gerakan aktif (tambah set, hapus set, hapus gerakan)
    const exercisesContainer = document.getElementById("active-exercises-container");
    if (exercisesContainer) {
      exercisesContainer.addEventListener("click", (e) => {
        const addSetBtn = e.target.closest(".btn-add-set");
        if (addSetBtn) {
          const exId = addSetBtn.dataset.exerciseId;
          WorkoutTracker.addSetToExercise(exId);
          UIManager.renderWorkoutDraft();
          return;
        }

        const removeSetBtn = e.target.closest(".btn-remove-set");
        if (removeSetBtn) {
          const exId = removeSetBtn.dataset.exerciseId;
          const setId = removeSetBtn.dataset.setId;
          WorkoutTracker.removeSetFromExercise(exId, setId);
          UIManager.renderWorkoutDraft();
          return;
        }

        const removeExBtn = e.target.closest(".btn-remove-exercise");
        if (removeExBtn) {
          const exId = removeExBtn.dataset.exerciseId;
          WorkoutTracker.removeExercise(exId);
          UIManager.renderWorkoutDraft();
          UIManager.showToast("Gerakan dihapus dari sesi.");
        }
      });

      // Update nilai beban & repetisi saat diketik
      exercisesContainer.addEventListener("input", (e) => {
        const weightInput = e.target.closest(".set-weight-input");
        const repsInput = e.target.closest(".set-reps-input");

        if (weightInput) {
          WorkoutTracker.updateSetValue(
            weightInput.dataset.exerciseId,
            weightInput.dataset.setId,
            "weight",
            weightInput.value
          );
          UIManager.renderLiveSummary();
        } else if (repsInput) {
          WorkoutTracker.updateSetValue(
            repsInput.dataset.exerciseId,
            repsInput.dataset.setId,
            "reps",
            repsInput.value
          );
          UIManager.renderLiveSummary();
        }
      });

      // Evaluasi badge PR & tawarkan Rest Timer saat fokus input set selesai (blur)
      exercisesContainer.addEventListener(
        "blur",
        (e) => {
          const isSetInput =
            e.target.classList.contains("set-weight-input") ||
            e.target.classList.contains("set-reps-input");
          if (isSetInput) {
            UIManager.renderWorkoutDraft();
          }
        },
        true
      );
    }

    // Selesaikan & Simpan Sesi ke Riwayat
    const finishBtn = document.getElementById("btn-finish-session");
    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        const result = WorkoutTracker.finishAndSaveSession(currentSettings.program);
        if (!result.ok) {
          UIManager.showToast(result.reason);
          return;
        }
        UIManager.renderWorkoutDraft();
        UIManager.renderHistory();
        UIManager.renderProgressView();
        UIManager.showToast("Sesi latihan berhasil disimpan ke riwayat!");
      });
    }
  }

  function bindTimerEvents() {
    RestTimer.init({
      initialSec: currentSettings.defaultRestSec || 90,
      onTick: (tickData) => UIManager.renderTimerTick(tickData),
      onComplete: () => {
        UIManager.showToast("Waktu istirahat selesai — siap lanjut set berikutnya!");
      }
    });

    document.querySelectorAll("[data-timer-set]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = Number(btn.dataset.timerSet);
        RestTimer.setPresetAndStart(sec, true);
      });
    });

    const toggleBtn = document.getElementById("btn-timer-start-pause");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => RestTimer.toggle());
    }

    const resetBtn = document.getElementById("btn-timer-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        RestTimer.reset(currentSettings.defaultRestSec || 90);
      });
    }
  }

  function bindHistoryAndProgressEvents() {
    const filterSelect = document.getElementById("history-filter-split");
    if (filterSelect) {
      filterSelect.addEventListener("change", () => UIManager.renderHistory());
    }

    const progressSelect = document.getElementById("progress-exercise-select");
    if (progressSelect) {
      progressSelect.addEventListener("change", () => UIManager.renderProgressView());
    }
  }

  function bindSettingsEvents() {
    // Preset durasi Rest Timer default
    document.querySelectorAll("[data-default-rest]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = Number(btn.dataset.defaultRest);
        currentSettings = StorageManager.saveSettings({ defaultRestSec: sec });
        UIManager.syncDefaultRestChips(sec);
        RestTimer.reset(sec);
        UIManager.showToast(`Durasi default Rest Timer diubah ke ${sec} detik.`);
      });
    });

    // Export JSON
    const exportBtn = document.getElementById("btn-export-json");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        StorageManager.exportDataAsJson();
        UIManager.showToast("File cadangan JSON berhasil diunduh.");
      });
    }

    // Import JSON
    const importInput = document.getElementById("input-import-json");
    if (importInput) {
      importInput.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        try {
          const result = await StorageManager.importDataFromJson(file, "merge");
          currentSettings = result.settings;
          UIManager.applyTheme(currentSettings.theme);
          UIManager.applyProgram(currentSettings.program);
          UIManager.syncDefaultRestChips(currentSettings.defaultRestSec);
          UIManager.renderWorkoutDraft();
          UIManager.renderHistory();
          UIManager.renderProgressView();
          UIManager.showToast(`Data dipulihkan (${result.totalSessions} sesi tersimpan).`);
        } catch (err) {
          UIManager.showToast(err.message || "Gagal mengimpor file JSON.");
        } finally {
          e.target.value = "";
        }
      });
    }

    // Hapus semua data lokal
    const clearBtn = document.getElementById("btn-clear-all-data");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        const confirmed = window.confirm(
          "Yakin ingin menghapus seluruh riwayat latihan dan draft di perangkat ini?"
        );
        if (!confirmed) return;

        StorageManager.clearAllData();
        WorkoutTracker.loadOrCreateDraft(
          document.getElementById("session-split")?.value || "Push (Chest, Shoulder, Triceps)",
          currentSettings.program
        );
        UIManager.renderWorkoutDraft();
        UIManager.renderHistory();
        UIManager.renderProgressView();
        UIManager.showToast("Semua riwayat latihan lokal telah dihapus.");
      });
    }
  }

  function init() {
    currentSettings = StorageManager.getSettings();

    UIManager.applyTheme(currentSettings.theme);
    UIManager.applyProgram(currentSettings.program);
    UIManager.syncDefaultRestChips(currentSettings.defaultRestSec);
    UIManager.updateOfflineIndicator();

    WorkoutTracker.loadOrCreateDraft(
      "Push (Chest, Shoulder, Triceps)",
      currentSettings.program
    );

    UIManager.renderWorkoutDraft();
    UIManager.renderHistory();
    UIManager.renderProgressView();

    bindHeaderEvents();
    bindNavigationEvents();
    bindWorkoutEvents();
    bindTimerEvents();
    bindHistoryAndProgressEvents();
    bindSettingsEvents();
    registerServiceWorker();

    window.addEventListener("online", () => UIManager.updateOfflineIndicator());
    window.addEventListener("offline", () => UIManager.updateOfflineIndicator());
  }

  document.addEventListener("DOMContentLoaded", init);
})();
