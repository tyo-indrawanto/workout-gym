/**
 * js/timer.js
 * Mengelola countdown Rest Timer antar set, getar HP, dan bunyi notifikasi selesai.
 */

const RestTimer = (() => {
  let durationSec = 90;
  let remainingSec = 90;
  let intervalId = null;
  let isRunning = false;
  let onTickCallback = null;
  let onCompleteCallback = null;

  function formatTime(sec) {
    const safeSec = Math.max(0, Math.floor(sec));
    const mins = Math.floor(safeSec / 60);
    const rem = safeSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }

  function playAlertSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const notes = [880, 1174.66]; // Nada A5 lalu D6 singkat
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;

        const startTime = ctx.currentTime + idx * 0.18;
        gain.gain.setValueAtTime(0.14, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.17);
      });
    } catch (_) {
      // Abaikan jika browser memblokir audio sebelum interaksi pengguna
    }
  }

  function triggerAlert() {
    if (navigator.vibrate) {
      navigator.vibrate([180, 90, 180]);
    }
    playAlertSound();
    if (typeof onCompleteCallback === "function") {
      onCompleteCallback();
    }
  }

  function emitTick() {
    if (typeof onTickCallback === "function") {
      onTickCallback({
        remainingSec,
        durationSec,
        formatted: formatTime(remainingSec),
        isRunning
      });
    }
  }

  function stopInterval() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isRunning = false;
  }

  function start() {
    if (isRunning) return;
    if (remainingSec <= 0) {
      remainingSec = durationSec;
    }

    isRunning = true;
    emitTick();

    intervalId = setInterval(() => {
      remainingSec -= 1;
      if (remainingSec <= 0) {
        remainingSec = 0;
        stopInterval();
        emitTick();
        triggerAlert();
      } else {
        emitTick();
      }
    }, 1000);
  }

  function pause() {
    stopInterval();
    emitTick();
  }

  function toggle() {
    if (isRunning) {
      pause();
    } else {
      start();
    }
  }

  function reset(newDurationSec = null) {
    stopInterval();
    if (typeof newDurationSec === "number" && newDurationSec > 0) {
      durationSec = newDurationSec;
    }
    remainingSec = durationSec;
    emitTick();
  }

  function setPresetAndStart(sec, autoStart = false) {
    durationSec = sec;
    remainingSec = sec;
    stopInterval();
    if (autoStart) {
      start();
    } else {
      emitTick();
    }
  }

  function init({ initialSec = 90, onTick, onComplete } = {}) {
    durationSec = initialSec;
    remainingSec = initialSec;
    onTickCallback = onTick;
    onCompleteCallback = onComplete;
    emitTick();
  }

  return {
    init,
    start,
    pause,
    toggle,
    reset,
    setPresetAndStart,
    formatTime
  };
})();
