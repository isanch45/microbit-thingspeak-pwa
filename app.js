const BAUD_RATE = 115200;
const MIN_INTERVAL_MS = 15000;
const MICROBIT_VENDOR_ID = 0x0D28;

let port = null;
let reader = null;
let keepReading = false;
let lastSendAt = 0;

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const detailEl = $("detail");
const logEl = $("log");
const lastDataEl = $("lastData");
const apiKeyEl = $("apiKey");

function log(msg) {
  const stamp = new Date().toLocaleTimeString();
  logEl.textContent = `[${stamp}] ${msg}\n` + logEl.textContent;
}

function setStatus(title, detail = "", kind = "") {
  statusEl.textContent = title;
  detailEl.textContent = detail;
  statusEl.className = "status " + kind;
}

function describeSerialConnectionError(err) {
  // Chrome hides the operating system's exact cause, so a port can be
  // unavailable for several reasons. Don't incorrectly blame the API key.
  const name = err?.name || "";
  const message = String(err?.message || err || "");
  if (name === "NetworkError" || /failed to open serial port/i.test(message)) {
    return {
      title: "No es pot obrir el port de la micro:bit",
      detail: "És possible que una altra aplicació faci servir el port USB. Tanca el connector de Windows, MakeCode, Thonny i les altres pestanyes de connexió sèrie; desconnecta i reconnecta la micro:bit, i torna a prémer «Connecta micro:bit». Si continua fallant, prova un altre cable o port USB."
    };
  }
  if (name === "InvalidStateError") {
    return {
      title: "El port ja està obert",
      detail: "La micro:bit pot estar connectada en una altra pestanya. Tanca les altres connexions, desconnecta-la i torna-la a connectar."
    };
  }
  if (name === "SecurityError" || name === "NotAllowedError") {
    return {
      title: "Accés al port sèrie bloquejat",
      detail: "Comprova els permisos de Chrome. Si és un Chromebook gestionat pel centre, la política del dispositiu pot impedir la connexió Web Serial."
    };
  }
  return { title: "Error connectant", detail: message };
}

function loadApiKey() {
  const key = localStorage.getItem("thingspeakWriteKey") || "";
  apiKeyEl.value = key;
  return key;
}

function saveApiKey() {
  const key = apiKeyEl.value.trim();
  if (!key) {
    setStatus("Falta la Write API Key", "Enganxa la clau de ThingSpeak.", "warn");
    return false;
  }
  localStorage.setItem("thingspeakWriteKey", key);
  log("Write API Key desada en aquest dispositiu.");
  return true;
}

function isLikelyMicrobit(p) {
  try {
    const info = p.getInfo();
    return info && info.usbVendorId === MICROBIT_VENDOR_ID;
  } catch {
    return false;
  }
}

async function autoConnectGrantedPort() {
  if (!("serial" in navigator)) {
    setStatus(
      "Web Serial no disponible",
      "Obre aquesta app amb Chrome des d'una adreça HTTPS.",
      "err"
    );
    return;
  }

  try {
    const ports = await navigator.serial.getPorts();
    if (!ports.length) {
      setStatus(
        "Preparat",
        "Primera vegada: desa la clau i prem «Connecta micro:bit».",
        ""
      );
      return;
    }

    const preferred = ports.find(isLikelyMicrobit) || ports[0];
    log("S'ha trobat un port prèviament autoritzat. Intentant reconnectar…");
    await openPort(preferred);
  } catch (err) {
    const info = describeSerialConnectionError(err);
    setStatus(info.title, info.detail, "warn");
    log("Autoconnexió: " + err);
  }
}

async function requestAndConnect() {
  if (!("serial" in navigator)) {
    setStatus("Web Serial no disponible", "Cal Chrome compatible amb Web Serial i HTTPS.", "err");
    return;
  }

  if (!saveApiKey()) return;

  try {
    const selected = await navigator.serial.requestPort();
    await openPort(selected);
  } catch (err) {
    if (err && err.name === "NotFoundError") {
      log("Selecció de port cancel·lada.");
      return;
    }
    const info = describeSerialConnectionError(err);
    setStatus(info.title, info.detail, "err");
    log("Connexió: " + err);
  }
}

async function openPort(selectedPort) {
  await disconnect(false);
  port = selectedPort;

  try {
    await port.open({ baudRate: BAUD_RATE });
  } catch (err) {
    // Pot passar si ja estava obert per una altra pestanya/app.
    port = null;
    throw err;
  }

  keepReading = true;
  window.SensorDashboard?.beginSession();
  setStatus("✅ Micro:bit connectada", "Esperant dades per USB…", "ok");
  log("Port obert a 115200 baud.");

  readLoop().catch((err) => {
    setStatus("Connexió interrompuda", String(err), "warn");
    log("Lectura: " + err);
  });
}

async function disconnect(showStatus = true) {
  keepReading = false;

  try {
    if (reader) {
      await reader.cancel();
    }
  } catch {}

  try {
    if (reader) {
      reader.releaseLock();
    }
  } catch {}

  reader = null;

  try {
    if (port && port.readable) {
      await port.close();
    }
  } catch {}

  port = null;

  if (showStatus) {
    setStatus("Desconnectat", "Prem «Connecta micro:bit» per tornar-hi.", "");
    log("Port desconnectat.");
  }
}

async function readLoop() {
  const decoder = new TextDecoder();
  let buffer = "";

  while (port && port.readable && keepReading) {
    reader = port.readable.getReader();

    try {
      while (keepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).replace(/\r/g, "").trim();
          buffer = buffer.slice(idx + 1);

          if (line) {
            await handleLine(line);
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch {}
      reader = null;
    }
  }
}

function parseLine(line) {
  const parts = line.split(",").map(v => v.trim()).filter(Boolean);
  if (!parts.length) return [];

  // Permet NODE,23,157,623; ignora NODE.
  if (Number.isNaN(Number(parts[0]))) {
    parts.shift();
  }

  return parts.slice(0, 8);
}

async function handleLine(line) {
  // Visualitza totes les lectures rebudes, incloses les que no s'envien pel límit de 15 s.
  window.SensorDashboard?.ingest(line);
  lastDataEl.textContent = "Rebut: " + line;
  log("Rebut: " + line);

  const values = parseLine(line);
  if (!values.length) return;

  const now = Date.now();
  if (now - lastSendAt < MIN_INTERVAL_MS) {
    return;
  }

  const apiKey = localStorage.getItem("thingspeakWriteKey") || apiKeyEl.value.trim();
  if (!apiKey) {
    setStatus("Falta la Write API Key", "Desa la clau abans d'enviar.", "warn");
    return;
  }

  const params = new URLSearchParams({ api_key: apiKey });
  values.forEach((value, index) => params.set(`field${index + 1}`, value));

  const url = `https://api.thingspeak.com/update.json?${params.toString()}`;

  try {
    // ThingSpeak accepta actualització per GET.
    // no-cors permet fer la petició des d'una PWA encara que la resposta sigui opaca.
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store"
    });

    lastSendAt = Date.now();
    setStatus("✅ Enviant a ThingSpeak", line, "ok");
    lastDataEl.textContent = "Enviat: " + line;
    log("Petició enviada a ThingSpeak.");
  } catch (err) {
    setStatus("Error enviant a ThingSpeak", String(err), "err");
    log("ThingSpeak: " + err);
  }
}

$("saveKey").addEventListener("click", () => {
  if (saveApiKey()) {
    setStatus("Clau guardada", "Ja pots connectar la micro:bit.", "ok");
  }
});

$("connect").addEventListener("click", requestAndConnect);
$("disconnect").addEventListener("click", () => disconnect(true));

navigator.serial?.addEventListener("disconnect", (event) => {
  if (port && event.target === port) {
    setStatus("Micro:bit desconnectada", "Torna-la a connectar.", "warn");
    log("El dispositiu USB s'ha desconnectat.");
    port = null;
  }
});

window.addEventListener("load", async () => {
  loadApiKey();

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("service-worker.js");
    } catch (err) {
      log("Service worker no registrat: " + err);
    }
  }

  await autoConnectGrantedPort();
});