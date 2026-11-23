/**
 * js/ui.js
 * Mengelola seluruh rendering antarmuka, tema gelap/terang, mode Bulking/Diet,
 * kartu latihan + badge PR, riwayat sesi, grafik progres, dan notifikasi toast.
 */

const UIManager = (() => {
  const PROGRAM_COPY = {
    bulking: {
      title: "Fokus Bulking: Progressive Overload",
      desc: "Targetkan kenaikan beban bertahap atau tambah 1–2 repetisi dari sesi sebelumnya."
    },
    diet: {
      title: "Fokus Diet: Pertahankan Kekuatan (Strength Retention)",
      desc: "Saat defisit kalori, jaga beban angkatan tetap stabil agar massa otot tidak menyusut."
    }
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDateId(isoString) {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "Tanggal tidak valid";
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatShortDate(isoString) {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short"
    });
  }

  function showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast-item";
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-6px)";
      toast.style.transition = "all 0.2s ease";
      setTimeout(() => toast.remove(), 220);
    }, 2400);
  }

  function applyTheme(theme) {
    const validTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", validTheme);

    const metaTheme = document.getElementById("meta-theme-color");
    if (metaTheme) {
      metaTheme.setAttribute("content", validTheme === "dark" ? "#0B1120" : "#FFFFFF");
    }
  }

  function applyProgram(program) {
    const validProgram = program === "diet" ? "diet" : "bulking";
    document.documentElement.setAttribute("data-program", validProgram);

    document.querySelectorAll(".program-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.programChoice === validProgram);
    });

    const copy = PROGRAM_COPY[validProgram];
    const titleEl = document.getElementById("banner-title");
    const descEl = document.getElementById("banner-desc");
    if (titleEl) titleEl.textContent = copy.title;
    if (descEl) descEl.textContent = copy.desc;
  }

  function switchTab(targetViewId) {
    document.querySelectorAll(".tab-view").forEach((sec) => {
      sec.classList.toggle("active", sec.id === targetViewId);
    });

    document.querySelectorAll(".nav-item").forEach((nav) => {
      nav.classList.toggle("active", nav.dataset.target === targetViewId);
    });

    if (targetViewId === "view-history") {
      renderHistory();
    } else if (targetViewId === "view-progress") {
      renderProgressView();
    }
  }

  function renderLiveSummary() {
    const summary = WorkoutTracker.calculateDraftSummary();
    const exEl = document.getElementById("live-total-exercises");
    const setsEl = document.getElementById("live-total-sets");
    const volEl = document.getElementById("live-total-volume");

    if (exEl) exEl.textContent = String(summary.exerciseCount);
    if (setsEl) setsEl.textContent = String(summary.totalSets);
    if (volEl) volEl.textContent = `${summary.totalVolume.toLocaleString("id-ID")} kg`;
  }

  function renderWorkoutDraft() {
    const draft = WorkoutTracker.getDraft();
    const container = document.getElementById("active-exercises-container");
    const finishBox = document.getElementById("finish-session-box");
    const splitSelect = document.getElementById("session-split");
    const notesInput = document.getElementById("session-notes");
    const dateLabel = document.getElementById("today-date-label");

    if (!draft || !container) return;

    if (splitSelect && draft.split) {
      splitSelect.value = draft.split;
    }
    if (notesInput) {
      notesInput.value = draft.notes || "";
    }
    if (dateLabel) {
      dateLabel.textContent = formatDateId(draft.date);
    }

    renderLiveSummary();

    if (!draft.exercises.length) {
      if (finishBox) finishBox.classList.add("hidden");
      container.innerHTML = `
        <div class="empty-state" id="workout-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6.5 6.5h11M6.5 17.5h11M3 10v4M21 10v4M6 8v8M18 8v8M9 12h6"/>
          </svg>
          <h3>Belum ada gerakan di sesi ini</h3>
          <p>Klik <strong>Tambah Gerakan</strong> atau <strong>Salin Sesi Terakhir</strong> untuk mulai mencatat beban dan repetisi.</p>
        </div>
      `;
      return;
    }

    if (finishBox) finishBox.classList.remove("hidden");

    container.innerHTML = draft.exercises
      .map((ex) => {
        const hist = WorkoutTracker.getExerciseHistoricalStats(ex.name);
        const hintText = hist.lastLoggedSet
          ? `Sesi lalu: <strong>${hist.lastLoggedSet.weight} kg × ${hist.lastLoggedSet.reps} reps</strong> · PR Beban: <strong>${hist.maxWeight} kg</strong>`
          : `Belum ada catatan riwayat sebelumnya — set pertama yang valid akan tercatat sebagai acuan awal.`;

        const setsHtml = ex.sets
          .map((set, idx) => {
            const isPr = WorkoutTracker.checkIsPersonalRecord(ex.name, set.weight, set.reps);
            return `
              <div class="set-row ${isPr ? "is-pr" : ""}" data-set-id="${escapeHtml(set.id)}">
                <span class="set-num">S${idx + 1}</span>

                <div class="set-input-box">
                  <input
                    type="number"
                    inputmode="decimal"
                    step="0.5"
                    min="0"
                    class="set-weight-input"
                    data-exercise-id="${escapeHtml(ex.id)}"
                    data-set-id="${escapeHtml(set.id)}"
                    value="${set.weight !== "" ? escapeHtml(set.weight) : ""}"
                    placeholder="0"
                    aria-label="Beban kg Set ${idx + 1}"
                  />
                  <span class="set-unit">kg</span>
                </div>

                <div class="set-input-box">
                  <input
                    type="number"
                    inputmode="numeric"
                    step="1"
                    min="0"
                    class="set-reps-input"
                    data-exercise-id="${escapeHtml(ex.id)}"
                    data-set-id="${escapeHtml(set.id)}"
                    value="${set.reps !== "" ? escapeHtml(set.reps) : ""}"
                    placeholder="0"
                    aria-label="Repetisi Set ${idx + 1}"
                  />
                  <span class="set-unit">reps</span>
                </div>

                <div class="set-actions">
                  ${isPr ? `<span class="pr-badge">PR</span>` : ""}
                  <button
                    type="button"
                    class="btn-icon-mini btn-remove-set"
                    data-exercise-id="${escapeHtml(ex.id)}"
                    data-set-id="${escapeHtml(set.id)}"
                    title="Hapus Set"
                    aria-label="Hapus Set ${idx + 1}"
                  >&times;</button>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <article class="exercise-card" data-exercise-id="${escapeHtml(ex.id)}">
            <div class="exercise-card-header">
              <div>
                <h3 class="exercise-name">${escapeHtml(ex.name)}</h3>
                <span class="muscle-tag">${escapeHtml(ex.muscleGroup || "General")}</span>
              </div>
              <button
                type="button"
                class="btn-icon-mini btn-remove-exercise"
                data-exercise-id="${escapeHtml(ex.id)}"
                title="Hapus Gerakan"
                aria-label="Hapus gerakan ${escapeHtml(ex.name)}"
              >&times;</button>
            </div>

            <div class="prev-best-hint">${hintText}</div>

            <div class="sets-list">
              ${setsHtml}
            </div>

            <button
              type="button"
              class="btn-add-set"
              data-exercise-id="${escapeHtml(ex.id)}"
            >+ Tambah Set</button>
          </article>
        `;
      })
      .join("");
  }

  function renderHistory() {
    const container = document.getElementById("history-list-container");
    const filterSelect = document.getElementById("history-filter-split");
    if (!container) return;

    const filterValue = filterSelect ? filterSelect.value : "ALL";
    const sessions = StorageManager.getSessions().filter((s) =>
      filterValue === "ALL" ? true : s.split === filterValue
    );

    if (!sessions.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Belum ada riwayat latihan</h3>
          <p>Selesaikan sesi latihan di tab <strong>Latihan</strong> untuk melihat catatan histori di sini.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sessions
      .map((session) => {
        const prog = session.program === "diet" ? "diet" : "bulking";
        const progLabel = prog === "diet" ? "Diet" : "Bulking";
        const exPreview = (session.exercises || [])
          .map((ex) => {
            const setText = (ex.sets || [])
              .map((s) => `${s.weight}kg×${s.reps}`)
              .join(", ");
            return `<div><strong>${escapeHtml(ex.name)}:</strong> ${escapeHtml(setText)}</div>`;
          })
          .join("");

        return `
          <article class="history-card" data-session-id="${escapeHtml(session.id)}">
            <div class="history-top">
              <span class="history-date">${formatDateId(session.date)}</span>
              <span class="program-pill ${prog}">${progLabel}</span>
            </div>
            <h3 class="history-title">${escapeHtml(session.split || "Sesi Latihan")}</h3>
            <div class="history-summary-line">
              <span><strong>${session.totalSets || 0}</strong> Set</span>
              <span>Volume: <strong>${Number(session.totalVolume || 0).toLocaleString("id-ID")} kg</strong></span>
              <span><strong>${(session.exercises || []).length}</strong> Gerakan</span>
            </div>
            <div class="history-exercises-preview">
              ${exPreview || "<span class='muted-text'>Tidak ada detail set</span>"}
              ${
                session.notes
                  ? `<div style="margin-top:6px;color:var(--text-secondary);font-style:italic;">Catatan: "${escapeHtml(session.notes)}"</div>`
                  : ""
              }
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderProgressView() {
    const selectEl = document.getElementById("progress-exercise-select");
    const maxWeightEl = document.getElementById("stat-max-weight");
    const maxVolEl = document.getElementById("stat-max-volume");
    const chartEl = document.getElementById("progress-bar-chart");

    if (!selectEl || !maxWeightEl || !maxVolEl || !chartEl) return;

    const names = WorkoutTracker.getAllRecordedExerciseNames();
    const prevSelected = selectEl.value;

    if (!names.length) {
      selectEl.innerHTML = `<option value="">-- Belum ada data gerakan --</option>`;
      maxWeightEl.textContent = "0 kg";
      maxVolEl.textContent = "0 kg";
      chartEl.innerHTML = `<p class="muted-text">Simpan minimal satu sesi latihan untuk melihat grafik progres.</p>`;
      return;
    }

    selectEl.innerHTML = names
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("");

    if (prevSelected && names.includes(prevSelected)) {
      selectEl.value = prevSelected;
    }

    const selectedExercise = selectEl.value;
    const stats = WorkoutTracker.getExerciseHistoricalStats(selectedExercise);

    maxWeightEl.textContent = `${stats.maxWeight} kg`;
    maxVolEl.textContent = `${Number(stats.bestSessionVolume || 0).toLocaleString("id-ID")} kg`;

    if (!stats.historyPoints.length) {
      chartEl.innerHTML = `<p class="muted-text">Belum ada titik data grafik untuk gerakan ini.</p>`;
      return;
    }

    const points = stats.historyPoints.slice(-8); // Tampilkan maksimal 8 sesi terakhir agar muat rapi
    const peakWeight = Math.max(...points.map((p) => p.maxWeight), 1);

    chartEl.innerHTML = points
      .map((pt) => {
        const pct = Math.max(10, Math.round((pt.maxWeight / peakWeight) * 100));
        return `
          <div class="bar-column" title="${formatDateId(pt.date)}: ${pt.maxWeight} kg">
            <span class="bar-val">${pt.maxWeight}</span>
            <div class="bar-fill" style="height: ${pct}%;"></div>
            <span class="bar-label">${formatShortDate(pt.date)}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderTimerTick({ formatted, isRunning }) {
    const clockEl = document.getElementById("timer-clock");
    const toggleBtn = document.getElementById("btn-timer-start-pause");
    const barEl = document.getElementById("rest-timer-bar");

    if (clockEl) clockEl.textContent = formatted;
    if (toggleBtn) toggleBtn.textContent = isRunning ? "Jeda" : "Mulai";
    if (barEl) barEl.classList.toggle("running", Boolean(isRunning));
  }

  function syncDefaultRestChips(activeSec) {
    document.querySelectorAll("[data-default-rest]").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.defaultRest) === Number(activeSec));
    });
  }

  function updateOfflineIndicator() {
    const badge = document.getElementById("offline-status");
    if (!badge) return;
    const isOnline = navigator.onLine;
    badge.innerHTML = isOnline
      ? `<span class="status-dot"></span> Siap Offline`
      : `<span class="status-dot"></span> Mode Offline Aktif`;
  }

  return {
    applyTheme,
    applyProgram,
    switchTab,
    renderLiveSummary,
    renderWorkoutDraft,
    renderHistory,
    renderProgressView,
    renderTimerTick,
    syncDefaultRestChips,
    updateOfflineIndicator,
    showToast
  };
})();
