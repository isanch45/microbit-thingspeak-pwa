/* Protecció de suspensió amb Screen Wake Lock (PWA/ChromeOS). */
(() => {
  "use strict";

  const PREFERENCE_KEY = "microbit-keep-screen-awake-v1";
  const checkbox = document.getElementById("keepAwake");
  const indicator = document.getElementById("wakeLockStatus");
  if (!checkbox || !indicator) return;

  let enabled = true;
  try {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    if (saved !== null) enabled = saved !== "false";
  } catch (_) {
    // El navegador pot prohibir el desament de preferències.
  }

  const supported = Boolean(navigator.wakeLock && typeof navigator.wakeLock.request === "function");
  let connected = false;
  let sentinel = null;
  let pending = null;
  let generation = 0;
  let errorMessage = "";

  checkbox.checked = enabled;
  checkbox.disabled = !supported;

  function visible() {
    return document.visibilityState === "visible";
  }

  function render() {
    const hasLock = Boolean(sentinel && !sentinel.released);
    indicator.className = "wake-status";
    if (!supported) {
      indicator.textContent = "No disponible en aquest navegador.";
      indicator.dataset.state = "unsupported";
    } else if (!enabled) {
      indicator.textContent = "Desactivat.";
      indicator.dataset.state = "off";
    } else if (!connected) {
      indicator.textContent = "S'activarà en connectar la micro:bit.";
      indicator.dataset.state = "standby";
    } else if (!visible()) {
      indicator.textContent = "Pausat: la pàgina no és visible.";
      indicator.dataset.state = "paused";
    } else if (hasLock) {
      indicator.textContent = "Actiu · pantalla encesa.";
      indicator.dataset.state = "active";
    } else if (pending) {
      indicator.textContent = "Activant…";
      indicator.dataset.state = "pending";
    } else {
      indicator.textContent = errorMessage || "Inactiu · no es pot garantir que eviti la suspensió.";
      indicator.dataset.state = "error";
    }
  }

  async function releaseLock() {
    const old = sentinel;
    sentinel = null;
    render();
    if (old && !old.released) {
      try {
        await old.release();
      } catch (_) {
        // Alliberar el bloqueig no pot interrompre la connexió sèrie.
      }
    }
  }

  function shouldHold() {
    return supported && enabled && connected && visible();
  }

  async function acquire() {
    if (!shouldHold() || sentinel || pending) {
      render();
      return;
    }
    const current = generation;
    errorMessage = "";
    // Una sola petició simultània: evita bloquejos duplicats.
    const request = navigator.wakeLock.request("screen");
    pending = request;
    render();
    try {
      const lock = await request;
      if (current !== generation || !shouldHold()) {
        try { await lock.release(); } catch (_) {}
        return;
      }
      sentinel = lock;
      lock.addEventListener("release", () => {
        if (sentinel === lock) {
          sentinel = null;
          errorMessage = "Protecció interrompuda per ChromeOS.";
          render();
        }
      }, { once: true });
    } catch (_) {
      if (current === generation) {
        errorMessage = "ChromeOS no ha concedit la protecció.";
      }
    } finally {
      if (pending === request) pending = null;
      render();
    }
  }

  function setConnected(value) {
    connected = Boolean(value);
    generation++;
    if (!connected) {
      errorMessage = "";
      void releaseLock();
    } else {
      void acquire();
    }
    render();
  }

  checkbox.addEventListener("change", () => {
    enabled = checkbox.checked;
    generation++;
    try { localStorage.setItem(PREFERENCE_KEY, String(enabled)); } catch (_) {}
    if (!enabled) {
      errorMessage = "";
      void releaseLock();
    } else {
      void acquire();
    }
    render();
  });

  document.addEventListener("visibilitychange", () => {
    generation++;
    if (visible()) void acquire();
    else void releaseLock();
    render();
  });

  window.addEventListener("pagehide", () => {
    connected = false;
    generation++;
    void releaseLock();
  });

  render();
  window.MicrobitWakeLock = Object.freeze({ setConnected });
})();
