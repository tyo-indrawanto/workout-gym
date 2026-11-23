/**
 * js/tracker.js
 * Logika pelacakan sesi latihan, perhitungan volume, Copy Last Session, PR & progres.
 */

const WorkoutTracker = (() => {
  let activeDraft = null;

  function createEmptyDraft(split = "Push (Chest, Shoulder, Triceps)", program = "bulking") {
    return {
      id: `draft_${Date.now()}`,
      date: new Date().toISOString(),
      split,
      program,
      notes: "",
      exercises: []
    };
  }

  function loadOrCreateDraft(defaultSplit, defaultProgram) {
    const saved = StorageManager.getDraft();
    if (saved && Array.isArray(saved.exercises)) {
      activeDraft = saved;
    } else {
      activeDraft = createEmptyDraft(defaultSplit, defaultProgram);
      StorageManager.saveDraft(activeDraft);
    }
    return activeDraft;
  }

  function getDraft() {
    return activeDraft;
  }

  function persistDraft() {
    if (activeDraft) {
      StorageManager.saveDraft(activeDraft);
    }
  }

  function setDraftSplit(split) {
    if (!activeDraft) return;
    activeDraft.split = split;
    persistDraft();
  }

  function setDraftNotes(notes) {
    if (!activeDraft) return;
    activeDraft.notes = notes;
    persistDraft();
  }

  // Mencari catatan terbaik sebelumnya untuk suatu nama gerakan dari riwayat
  function getExerciseHistoricalStats(exerciseName) {
    const cleanName = (exerciseName || "").trim().toLowerCase();
    const sessions = StorageManager.getSessions();

    let maxWeight = 0;
    let maxRepsAtMaxWeight = 0;
    let bestSessionVolume = 0;
    let lastLoggedSet = null;
    const historyPoints = [];

    // Iterasi dari sesi terlama ke terbaru agar tren kronologis rapi
    const chronological = [...sessions].reverse();

    chronological.forEach((session) => {
      const matchedEx = (session.exercises || []).find(
        (ex) => (ex.name || "").trim().toLowerCase() === cleanName
      );
      if (!matchedEx || !Array.isArray(matchedEx.sets)) return;

      let sessionExMaxWeight = 0;
      let sessionExVolume = 0;

      matchedEx.sets.forEach((set) => {
        const w = Number(set.weight) || 0;
        const r = Number(set.reps) || 0;
        const vol = w * r;

        sessionExVolume += vol;
        if (w > sessionExMaxWeight) sessionExMaxWeight = w;

        if (w > maxWeight || (w === maxWeight && r > maxRepsAtMaxWeight)) {
          maxWeight = w;
          maxRepsAtMaxWeight = r;
        }

        if (w > 0 || r > 0) {
          lastLoggedSet = { weight: w, reps: r, date: session.date };
        }
      });

      if (sessionExVolume > bestSessionVolume) {
        bestSessionVolume = sessionExVolume;
      }

      historyPoints.push({
        date: session.date,
        maxWeight: sessionExMaxWeight,
        volume: sessionExVolume,
        program: session.program || "bulking"
      });
    });

    return {
      maxWeight,
      maxRepsAtMaxWeight,
      bestSessionVolume,
      lastLoggedSet,
      historyPoints
    };
  }

  // Mengecek apakah satu set (weight, reps) mencetak rekor baru dibanding riwayat sebelumnya
  function checkIsPersonalRecord(exerciseName, weight, reps) {
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    if (w <= 0 || r <= 0) return false;

    const stats = getExerciseHistoricalStats(exerciseName);
    if (stats.maxWeight === 0) return true;

    if (w > stats.maxWeight) return true;
    if (w === stats.maxWeight && r > stats.maxRepsAtMaxWeight) return true;
    return false;
  }

  function addExercise(name, muscleGroup = "Chest") {
    const trimmed = (name || "").trim();
    if (!trimmed || !activeDraft) return null;

    const hist = getExerciseHistoricalStats(trimmed);
    const prefillWeight = hist.lastLoggedSet ? hist.lastLoggedSet.weight : "";
    const prefillReps = hist.lastLoggedSet ? hist.lastLoggedSet.reps : "";

    const newExercise = {
      id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      muscleGroup,
      sets: [
        {
          id: `set_${Date.now()}_1`,
          weight: prefillWeight,
          reps: prefillReps
        }
      ]
    };

    activeDraft.exercises.push(newExercise);
    persistDraft();
    return newExercise;
  }

  function removeExercise(exerciseId) {
    if (!activeDraft) return;
    activeDraft.exercises = activeDraft.exercises.filter((ex) => ex.id !== exerciseId);
    persistDraft();
  }

  function addSetToExercise(exerciseId) {
    if (!activeDraft) return;
    const ex = activeDraft.exercises.find((item) => item.id === exerciseId);
    if (!ex) return;

    const lastSet = ex.sets[ex.sets.length - 1];
    ex.sets.push({
      id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      weight: lastSet ? lastSet.weight : "",
      reps: lastSet ? lastSet.reps : ""
    });
    persistDraft();
  }

  function updateSetValue(exerciseId, setId, field, value) {
    if (!activeDraft) return;
    const ex = activeDraft.exercises.find((item) => item.id === exerciseId);
    if (!ex) return;

    const targetSet = ex.sets.find((s) => s.id === setId);
    if (!targetSet) return;

    targetSet[field] = value;
    persistDraft();
  }

  function removeSetFromExercise(exerciseId, setId) {
    if (!activeDraft) return;
    const ex = activeDraft.exercises.find((item) => item.id === exerciseId);
    if (!ex) return;

    ex.sets = ex.sets.filter((s) => s.id !== setId);
    if (ex.sets.length === 0) {
      ex.sets.push({
        id: `set_${Date.now()}_fallback`,
        weight: "",
        reps: ""
      });
    }
    persistDraft();
  }

  // Menyalin struktur gerakan & beban/repetisi dari sesi terakhir (sesuai split jika ada)
  function copyLastSession(preferredSplit = null) {
    if (!activeDraft) return { ok: false, reason: "Draft tidak aktif." };
    const sessions = StorageManager.getSessions();
    if (!sessions.length) {
      return { ok: false, reason: "Belum ada riwayat sesi latihan untuk disalin." };
    }

    const matchBySplit = preferredSplit
      ? sessions.find((s) => s.split === preferredSplit)
      : null;
    const sourceSession = matchBySplit || sessions[0];

    activeDraft.split = sourceSession.split || activeDraft.split;
    activeDraft.exercises = (sourceSession.exercises || []).map((ex, exIdx) => ({
      id: `ex_copy_${Date.now()}_${exIdx}`,
      name: ex.name,
      muscleGroup: ex.muscleGroup || "General",
      sets: (ex.sets || []).map((s, sIdx) => ({
        id: `set_copy_${Date.now()}_${exIdx}_${sIdx}`,
        weight: s.weight ?? "",
        reps: s.reps ?? ""
      }))
    }));

    persistDraft();
    return {
      ok: true,
      fromSplit: sourceSession.split,
      count: activeDraft.exercises.length
    };
  }

  function calculateDraftSummary() {
    if (!activeDraft) {
      return { exerciseCount: 0, totalSets: 0, totalVolume: 0 };
    }

    let totalSets = 0;
    let totalVolume = 0;

    activeDraft.exercises.forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        const w = Number(s.weight) || 0;
        const r = Number(s.reps) || 0;
        if (w > 0 || r > 0) {
          totalSets += 1;
          totalVolume += w * r;
        }
      });
    });

    return {
      exerciseCount: activeDraft.exercises.length,
      totalSets,
      totalVolume
    };
  }

  function finishAndSaveSession(currentProgram) {
    if (!activeDraft || activeDraft.exercises.length === 0) {
      return { ok: false, reason: "Tambahkan minimal satu gerakan sebelum menyimpan sesi." };
    }

    const summary = calculateDraftSummary();
    const completedSession = {
      id: `session_${Date.now()}`,
      date: new Date().toISOString(),
      split: activeDraft.split,
      program: currentProgram || activeDraft.program || "bulking",
      notes: (activeDraft.notes || "").trim(),
      totalSets: summary.totalSets,
      totalVolume: summary.totalVolume,
      exercises: activeDraft.exercises.map((ex) => ({
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: ex.sets
          .map((s) => ({
            weight: Number(s.weight) || 0,
            reps: Number(s.reps) || 0
          }))
          .filter((s) => s.weight > 0 || s.reps > 0)
      })).filter((ex) => ex.sets.length > 0)
    };

    if (completedSession.exercises.length === 0) {
      return { ok: false, reason: "Isi minimal satu set (beban atau repetisi) terlebih dahulu." };
    }

    StorageManager.addSession(completedSession);
    StorageManager.clearDraft();
    activeDraft = createEmptyDraft(completedSession.split, completedSession.program);
    StorageManager.saveDraft(activeDraft);

    return { ok: true, session: completedSession };
  }

  function getAllRecordedExerciseNames() {
    const namesSet = new Set();
    StorageManager.getSessions().forEach((session) => {
      (session.exercises || []).forEach((ex) => {
        if (ex.name && ex.name.trim()) {
          namesSet.add(ex.name.trim());
        }
      });
    });
    return Array.from(namesSet).sort((a, b) => a.localeCompare(b, "id"));
  }

  return {
    loadOrCreateDraft,
    getDraft,
    setDraftSplit,
    setDraftNotes,
    addExercise,
    removeExercise,
    addSetToExercise,
    updateSetValue,
    removeSetFromExercise,
    copyLastSession,
    checkIsPersonalRecord,
    getExerciseHistoricalStats,
    calculateDraftSummary,
    finishAndSaveSession,
    getAllRecordedExerciseNames
  };
})();
