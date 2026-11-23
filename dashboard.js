/* Tauler local de lectures USB: no consulta ni modifica ThingSpeak. */
(() => {
  "use strict";

  const SETTINGS_KEY = "microbit-sensor-dashboard-settings-v1";
  const HISTORY_KEY = "microbit-sensor-dashboard-readings-v1";
  const MAX_HISTORY = 9000;
  const HISTORY_AGE_MS = 30 * 24 * 3600 * 1000;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SENSORS = Object.freeze({
    temperature: { name: "Temperatura", unit: "°C", symbol: "🌡️", color: "#dc524f", soft: "#fff1f0", decimals: 1 },
    humidity: { name: "Humitat", unit: "%", symbol: "💧", color: "#1786c8", soft: "#eaf5ff", decimals: 1 },
    pressure: { name: "Pressió baromètrica", unit: "hPa", symbol: "⏱️", color: "#8459d2", soft: "#f3eeff", decimals: 1 },
    light: { name: "Lluminositat", unit: "nivell", symbol: "☀️", color: "#c98716", soft: "#fff6df", decimals: 0 }
  });
  const SENSOR_IDS = Object.keys(SENSORS);
  const PERIODS = { "30m": 1800000, "2h": 7200000, "24h": 86400000, "7d": 604800000, all: Infinity };
  const DEFAULT_SETTINGS = {
    period: "24h",
    // Compatibilitat amb microbit_emissor_exemple.py: temp, llum, lectura analògica.
    mapping: ["temperature", "light", "", "", "", "", "", ""],
    chart: Object.fromEntries(SENSOR_IDS.map(id => [id, { yMin: "", yMax: "", validMin: "", validMax: "" }]))
  };

  const $ = id => document.getElementById(id);
  const state = {
    settings: loadSettings(),
    history: loadHistory(),
    demo: false,
    demoData: [],
    session: false,
    activeSensors: new Set()
  };

  function safeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  function loadSettings() {
    try {
      const old = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (!old || typeof old !== "object") return structuredClone(DEFAULT_SETTINGS);
      const chart = {};
      for (const id of SENSOR_IDS) {
        const stored = old.chart?.[id] || {};
        chart[id] = Object.fromEntries(
          ["yMin", "yMax", "validMin", "validMax"].map(k =>
            [k, typeof stored[k] === "string" && /^-?\d*\.?\d*$/.test(stored[k]) ? stored[k] : ""]
          )
        );
      }
      return {
        period: Object.hasOwn(PERIODS, old.period) ? old.period : "24h",
        mapping: Array.from({ length: 8 }, (_, i) =>
          SENSOR_IDS.includes(old.mapping?.[i]) ? old.mapping[i] : ""
        ),
        chart
      };
    } catch {
      return {
        period: "24h",
        mapping: [...DEFAULT_SETTINGS.mapping],
        chart: Object.fromEntries(SENSOR_IDS.map(id => [id, { yMin: "", yMax: "", validMin: "", validMax: "" }]))
      };
    }
  }

  function loadHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      if (!Array.isArray(stored)) return [];
      const cutoff = Date.now() - HISTORY_AGE_MS;
      return stored.filter(item =>
        typeof item?.t === "number" && item.t >= cutoff &&
        Array.isArray(item.values) && item.values.length <= 8 &&
        item.values.every(v => v === null || (typeof v === "number" && Number.isFinite(v)))
      ).slice(-MAX_HISTORY);
    } catch { return []; }
  }

  function format(value, decimals) {
    return Number.isFinite(value)
      ? new Intl.NumberFormat("ca-ES", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value)
      : "—";
  }

  function numberOrNull(value) {
    if (value === "" || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function readLine(line) {
    const bits = String(line).split(",").map(v => v.trim());
    if (bits.length && bits[0] !== "" && !Number.isFinite(Number(bits[0]))) {
      bits.shift(); // Etiqueta inicial com HORT o NODE.
    }
    const values = bits.slice(0, 8).map(v => v === "" ? null : numberOrNull(v));
    return values.length && values.some(v => v !== null) ? values : null;
  }

  function asSensorReading(point) {
    const result = {};
    for (let i = 0; i < point.values.length; i++) {
      const key = state.settings.mapping[i];
      if (key && point.values[i] !== null && Number.isFinite(point.values[i])) {
        result[key] = point.values[i];
      }
    }
    return result;
  }

  function validRangeFor(id) {
    const c = state.settings.chart[id];
    return { min: numberOrNull(c.validMin), max: numberOrNull(c.validMax) };
  }

  function isValidReading(id, value) {
    if (!Number.isFinite(value)) return false;
    const { min, max } = validRangeFor(id);
    return (min === null || value >= min) && (max === null || value <= max);
  }

  function svgEl(tag, attrs = {}, content = null) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    if (content !== null) el.textContent = content;
    return el;
  }

  function buildInterface() {
    const shell = $("sensorDashboard");
    if (!shell) return;
    shell.innerHTML = "";

    const intro = document.createElement("div");
    intro.className = "dash-intro";
    intro.innerHTML = '<div><h2>Observatori de sensors</h2><p>Gràfics en directe de la micro:bit · Cada gràfic apareix quan arriben lectures del sensor configurat.</p></div>';
    const actions = document.createElement("div");
    actions.className = "dash-actions";
    const periodLabel = document.createElement("label");
    periodLabel.textContent = "Període";
    const period = document.createElement("select");
    period.id = "dashPeriod";
    for (const [key, name] of Object.entries({ "30m": "30 minuts", "2h": "2 hores", "24h": "24 hores", "7d": "7 dies", all: "Tot el local" })) {
      const opt = document.createElement("option");
      opt.value = key; opt.textContent = name; period.append(opt);
    }
    period.value = state.settings.period;
    period.addEventListener("change", () => {
      state.settings.period = period.value;
      safeStore(SETTINGS_KEY, state.settings);
      render();
    });
    periodLabel.append(period);
    actions.append(periodLabel);

    const demoButton = document.createElement("button");
    demoButton.id = "dashDemo";
    demoButton.className = "dash-outlined";
    demoButton.textContent = "Veure demostració";
    demoButton.addEventListener("click", () => {
      state.demo = !state.demo;
      if (state.demo) {
        const now = Date.now();
        state.demoData = Array.from({ length: 61 }, (_, i) => {
          const a = i / 5;
          return { t: now - (60 - i) * 60000, values: [
            20 + 2.2 * Math.sin(a), 55 + 9 * Math.cos(a / 1.7),
            1012 + 3.1 * Math.sin(a / 2.1), 132 + 71 * Math.sin(a / 1.3)
          ] };
        });
      }
      demoButton.textContent = state.demo ? "Tancar demostració" : "Veure demostració";
      render();
    });
    actions.append(demoButton);
    intro.append(actions);
    shell.append(intro);

    const banner = document.createElement("p");
    banner.id = "dashBanner";
    banner.className = "dash-notice";
    shell.append(banner);

    const empty = document.createElement("div");
    empty.id = "dashEmpty";
    empty.className = "dash-empty";
    empty.innerHTML = "<strong>Encara no hi ha lectures d'aquests sensors</strong><span>Connecta una micro:bit o obre la demostració. Configura els camps si fas servir un programa diferent.</span>";
    shell.append(empty);

    const grid = document.createElement("div");
    grid.id = "dashGrid";
    grid.className = "dash-grid";
    for (const id of SENSOR_IDS) {
      const spec = SENSORS[id];
      const card = document.createElement("article");
      card.id = "sensor-" + id;
      card.className = "dash-sensor";
      card.hidden = true;
      card.style.setProperty("--sensor-color", spec.color);
      card.style.setProperty("--sensor-soft", spec.soft);
      card.innerHTML = '<div class="dash-head"><span class="dash-symbol" aria-hidden="true"></span><div class="dash-heading"><h3></h3><small>Lectures de la micro:bit</small></div><div class="dash-current" id="value-' + id + '"></div></div><svg class="dash-chart" id="chart-' + id + '" viewBox="0 0 640 250" role="img" aria-label="Evolució de ' + spec.name + '"></svg><div class="dash-metrics"><div class="dash-metric"><small>Mínim</small><strong id="min-' + id + '"></strong></div><div class="dash-metric"><small>Mitjana</small><strong id="avg-' + id + '"></strong></div><div class="dash-metric"><small>Màxim</small><strong id="max-' + id + '"></strong></div></div><div class="dash-time" id="time-' + id + '"></div>';
      card.querySelector(".dash-symbol").textContent = spec.symbol;
      card.querySelector("h3").textContent = spec.name;
      grid.append(card);
    }
    shell.append(grid);

    const settings = document.createElement("details");
    settings.className = "dash-settings";
    settings.innerHTML = '<summary>⚙️ Configurar sensors, escales i valors vàlids</summary><p><strong>Correspondència dels camps:</strong> el programa original envia temperatura al camp 1 i llum al camp 2. Per a nous programes, associa els camps segons l’ordre real dels sensors. Els camps sense sensor no generen gràfic.</p>';
    const map = document.createElement("div");
    map.className = "dash-map";
    for (let i = 0; i < 8; i++) {
      const label = document.createElement("label");
      label.textContent = "Camp " + (i + 1);
      const select = document.createElement("select");
      select.id = "map-field-" + (i + 1);
      const emptyOpt = document.createElement("option");
      emptyOpt.value = ""; emptyOpt.textContent = "Cap gràfic";
      select.append(emptyOpt);
      for (const id of SENSOR_IDS) {
        const opt = document.createElement("option");
        opt.value = id; opt.textContent = SENSORS[id].name;
        select.append(opt);
      }
      select.value = state.settings.mapping[i];
      select.addEventListener("change", () => {
        state.settings.mapping[i] = select.value;
        safeStore(SETTINGS_KEY, state.settings);
        // Reinterpretar automàticament l'historial local, sense tocar ThingSpeak.
        state.activeSensors = new Set();
        render();
      });
      label.append(select); map.append(label);
    }
    settings.append(map);
    const expl = document.createElement("p");
    expl.textContent = "Escala Y: en blanc = automàtica. Rang vàlid: opcional, filtra lectures anòmales només dels gràfics (mai dels enviaments a ThingSpeak). Les mesures ocultes per una escala manual no s'esborren.";
    settings.append(expl);
    const bounds = document.createElement("div");
    bounds.className = "dash-boundsets";
    for (const id of SENSOR_IDS) {
      const box = document.createElement("div");
      box.className = "dash-boundset";
      const h = document.createElement("h4"); h.textContent = SENSORS[id].symbol + " " + SENSORS[id].name + " (" + SENSORS[id].unit + ")"; box.append(h);
      const fields = document.createElement("div"); fields.className = "dash-bounds";
      for (const [property, labelText] of [
        ["yMin", "Escala mín."], ["yMax", "Escala màx."],
        ["validMin", "Dada vàlida mín."], ["validMax", "Dada vàlida màx."]
      ]) {
        const label = document.createElement("label");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = "number"; input.step = "any";
        input.placeholder = "Automàtic";
        input.value = state.settings.chart[id][property];
        input.addEventListener("change", () => {
          const value = input.value.trim();
          const proposed = { ...state.settings.chart[id], [property]: value };
          const lower = numberOrNull(proposed[property.includes("y") && property === "yMax" ? "yMin" : property === "validMax" ? "validMin" : property]);
          const upper = numberOrNull(proposed[property === "yMin" ? "yMax" : property === "validMin" ? "validMax" : property]);
          if (lower !== null && upper !== null && lower >= upper) {
            alert("El mínim ha de ser més petit que el màxim.");
            input.value = state.settings.chart[id][property];
            return;
          }
          state.settings.chart[id][property] = value;
          safeStore(SETTINGS_KEY, state.settings);
          render();
        });
        label.append(input); fields.append(label);
      }
      box.append(fields); bounds.append(box);
    }
    settings.append(bounds);
    const resetButton = document.createElement("button");
    resetButton.className = "dash-danger";
    resetButton.type = "button";
    resetButton.textContent = "Neteja només l'historial local";
    resetButton.addEventListener("click", () => {
      if (!confirm("Vols eliminar les lectures desades al navegador? No es tocaran les dades de ThingSpeak ni la Write API Key.")) return;
      state.history = [];
      try { localStorage.removeItem(HISTORY_KEY); } catch {}
      state.session = false;
      state.activeSensors.clear();
      render();
    });
    settings.append(resetButton);
    const hint = document.createElement("p");
    hint.className = "dash-note";
    hint.textContent = "Els gràfics representen les lectures rebudes per USB en aquest navegador, incloent lectures no enviades per la limitació de 15 s. L'historial local és limitat; l'històric anual continua a ThingSpeak.";
    settings.append(hint);
    shell.append(settings);

    const footnote = document.createElement("p");
    footnote.className = "dash-note";
    footnote.textContent = "Sense biblioteques externes. Les gràfiques es dibuixen localment. Per veure tot l'any, utilitza l'històric de ThingSpeak.";
    shell.append(footnote);
  }

  function getSource() {
    return state.demo ? state.demoData : state.history;
  }

  function getSeries(id) {
    const now = Date.now();
    const duration = PERIODS[state.settings.period] ?? PERIODS["24h"];
    const cutoff = Number.isFinite(duration) ? now - duration : 0;
    return getSource()
      .filter(point => point.t >= cutoff)
      .map(point => ({ t: point.t, value: state.demo ? point.values[SENSOR_IDS.indexOf(id)] : asSensorReading(point)[id] }))
      .filter(point => isValidReading(id, point.value))
      .sort((a, b) => a.t - b.t);
  }

  function sampleForChart(series, target = 550) {
    if (series.length <= target) return series;
    const output = [];
    const bucketSize = Math.ceil(series.length / (target / 2));
    for (let i = 0; i < series.length; i += bucketSize) {
      const part = series.slice(i, i + bucketSize);
      const candidates = [part[0], part[part.length - 1],
        part.reduce((a, b) => b.value < a.value ? b : a),
        part.reduce((a, b) => b.value > a.value ? b : a)];
      for (const p of candidates.sort((a, b) => a.t - b.t)) {
        if (!output.length || output[output.length - 1] !== p) output.push(p);
      }
    }
    return output;
  }

  function renderGraph(svg, id, series) {
    svg.replaceChildren();
    if (!series.length) return;
    const spec = SENSORS[id];
    const [W, H] = [640, 250];
    const plot = { left: 57, top: 16, right: 626, bottom: 205 };
    const values = series.map(p => p.value);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const c = state.settings.chart[id];
    const yMinConfigured = numberOrNull(c.yMin);
    const yMaxConfigured = numberOrNull(c.yMax);
    const naturalSpan = Math.max(0.0001, dataMax - dataMin);
    const pad = naturalSpan * 0.12 || 1;
    let low = yMinConfigured ?? dataMin - Math.max(pad, naturalSpan < .01 ? (id === "pressure" ? .5 : 1) : 0);
    let high = yMaxConfigured ?? dataMax + Math.max(pad, naturalSpan < .01 ? (id === "pressure" ? .5 : 1) : 0);
    if (low >= high) { low -= 1; high += 1; }
    const tMin = series[0].t;
    const tMax = series[series.length - 1].t;
    const x = t => plot.left + ((t - tMin) / Math.max(1, tMax - tMin)) * (plot.right - plot.left);
    const y = v => plot.bottom - ((v - low) / (high - low)) * (plot.bottom - plot.top);

    const defs = svgEl("defs");
    const grad = svgEl("linearGradient", { id: "gradient-" + id, x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.append(svgEl("stop", { offset: "0%", "stop-color": spec.color, "stop-opacity": ".17" }));
    grad.append(svgEl("stop", { offset: "100%", "stop-color": spec.color, "stop-opacity": "0" }));
    defs.append(grad);
    const clip = svgEl("clipPath", { id: "clip-" + id });
    clip.append(svgEl("rect", { x: plot.left, y: plot.top, width: plot.right - plot.left, height: plot.bottom - plot.top }));
    defs.append(clip); svg.append(defs);

    for (let i = 0; i <= 4; i++) {
      const yy = plot.top + (plot.bottom - plot.top) * i / 4;
      const val = high - (high - low) * i / 4;
      svg.append(svgEl("line", { x1: plot.left, y1: yy, x2: plot.right, y2: yy, stroke: "#e2eaf1", "stroke-width": 1 }));
      svg.append(svgEl("text", { x: plot.left - 10, y: yy + 4, "text-anchor": "end", class: "dash-svg-text" }, format(val, spec.decimals)));
    }
    const span = tMax - tMin;
    for (let i = 0; i <= 3; i++) {
      const time = tMin + (span * i / 3);
      const label = span >= 86400000
        ? new Date(time).toLocaleDateString("ca-ES", { day: "numeric", month: "short" })
        : new Date(time).toLocaleTimeString("ca-ES", { hour: "2-digit", minute: "2-digit" });
      svg.append(svgEl("text", { x: plot.left + i * (plot.right - plot.left) / 3, y: plot.bottom + 25, "text-anchor": i === 0 ? "start" : i === 3 ? "end" : "middle", class: "dash-svg-text" }, label));
    }
    const data = sampleForChart(series);
    const diffs = data.slice(1).map((point, i) => point.t - data[i].t).filter(d => d > 0).sort((a, b) => a - b);
    const median = diffs.length ? diffs[Math.floor(diffs.length / 2)] : 15000;
    // Never draw a misleading line across a long interruption.
    const gapMs = Math.min(30 * 60000, Math.max(2 * 60000, median * 5));
    const groups = [];
    let group = [];
    for (const point of data) {
      if (group.length && point.t - group[group.length - 1].t > gapMs) {
        groups.push(group); group = [];
      }
      group.push(point);
    }
    if (group.length) groups.push(group);

    const strokes = svgEl("g", { "clip-path": "url(#clip-" + id + ")" });
    for (const segment of groups) {
      const points = segment.map(p => [x(p.t), y(p.value)]);
      if (points.length >= 2) {
        const line = "M" + points.map(p => p.map(v => v.toFixed(2)).join(",")).join(" L");
        const area = line + " L" + x(segment[segment.length - 1].t).toFixed(2) + "," + plot.bottom +
          " L" + x(segment[0].t).toFixed(2) + "," + plot.bottom + " Z";
        strokes.append(svgEl("path", { d: area, fill: "url(#gradient-" + id + ")" }));
        strokes.append(svgEl("path", { d: line, fill: "none", stroke: spec.color, "stroke-width": 2.7, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      } else if (points.length === 1) {
        strokes.append(svgEl("circle", { cx: points[0][0], cy: points[0][1], r: 3.6, fill: spec.color }));
      }
    }
    if (data.length) {
      const last = data[data.length - 1];
      strokes.append(svgEl("circle", { cx: x(last.t), cy: y(last.value), r: 4.8, stroke: "#fff", "stroke-width": 2, fill: spec.color }));
    }
    svg.append(strokes);
  }

  function render() {
    const banner = $("dashBanner"), grid = $("dashGrid"), empty = $("dashEmpty");
    if (!banner || !grid || !empty) return;
    banner.className = state.demo ? "dash-notice demo" : "dash-notice";
    banner.textContent = state.demo
      ? "DADES DE DEMOSTRACIÓ · fictícies, no s'envien a ThingSpeak ni queden guardades."
      : "DADES REALS DEL NAVEGADOR · no es comparteixen amb altres escoles. Els gràfics només mostren sensors disponibles.";
    const history = getSource();
    let visible = 0;
    for (const id of SENSOR_IDS) {
      const card = $("sensor-" + id);
      const series = getSeries(id);
      // During a USB session, show only sensors present in the incoming data.
      const active = !state.session || state.demo || state.activeSensors.has(id);
      card.hidden = !active || !series.length;
      if (card.hidden) continue;
      visible++;
      const spec = SENSORS[id];
      const vals = series.map(point => point.value);
      const latest = series[series.length - 1];
      const min = Math.min(...vals), max = Math.max(...vals);
      const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length;
      $("value-" + id).textContent = format(latest.value, spec.decimals) + " " + spec.unit;
      $("min-" + id).textContent = format(min, spec.decimals) + " " + spec.unit;
      $("max-" + id).textContent = format(max, spec.decimals) + " " + spec.unit;
      $("avg-" + id).textContent = format(avg, spec.decimals) + " " + spec.unit;
      $("time-" + id).textContent = series.length + " lectures · última: " +
        new Date(latest.t).toLocaleString("ca-ES", { dateStyle: "short", timeStyle: "medium" });
      renderGraph($("chart-" + id), id, series);
    }
    grid.hidden = visible === 0;
    empty.hidden = visible !== 0;
    if (!history.length && state.session) {
      empty.querySelector("strong").textContent = "Esperant dades de la micro:bit";
    } else if (!visible && history.length) {
      empty.querySelector("strong").textContent = "No hi ha lectures per als sensors i el període seleccionats";
    }
  }

  function ingest(line) {
    if (state.demo) {
      state.demo = false;
      state.demoData = [];
      const btn = $("dashDemo"); if (btn) btn.textContent = "Veure demostració";
    }
    const values = readLine(line);
    if (!values) return;
    const point = { t: Date.now(), values };
    const sensors = asSensorReading(point);
    state.activeSensors = new Set(Object.keys(sensors));
    state.session = true;
    state.history.push(point);
    if (state.history.length > MAX_HISTORY) state.history.splice(0, state.history.length - MAX_HISTORY);
    if (!safeStore(HISTORY_KEY, state.history)) {
      // Continue drawing live data even if browser storage is blocked or full.
      const banner = $("dashBanner");
      if (banner) banner.textContent = "No s'ha pogut guardar l'historial local; les lectures es veuen en directe.";
    }
    render();
  }

  function beginSession() {
    state.session = true;
    state.activeSensors.clear();
    if (state.demo) {
      state.demo = false;
      state.demoData = [];
      const btn = $("dashDemo"); if (btn) btn.textContent = "Veure demostració";
    }
    render();
  }

  buildInterface();
  render();
  window.SensorDashboard = Object.freeze({ ingest, beginSession });
})();