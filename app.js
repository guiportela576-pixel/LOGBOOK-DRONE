let flights = JSON.parse(localStorage.getItem("flights")) || [];
let drones = JSON.parse(localStorage.getItem("drones")) || [];
let locations = JSON.parse(localStorage.getItem("locations")) || [];
let sarpasList = JSON.parse(localStorage.getItem("sarpas")) || [];

let pilot = JSON.parse(localStorage.getItem("pilot")) || {
  name: "",
  cpf: "",
  sarpas: ""
};

// ✅ Padrões (salvos separados)
let defaultDrone = localStorage.getItem("defaultDrone") || "";
let defaultSarpas = localStorage.getItem("defaultSarpas") || "";

function saveAll() {
  localStorage.setItem("flights", JSON.stringify(flights));
  localStorage.setItem("drones", JSON.stringify(drones));
  localStorage.setItem("locations", JSON.stringify(locations));
  localStorage.setItem("sarpas", JSON.stringify(sarpasList));
  localStorage.setItem("pilot", JSON.stringify(pilot));
  localStorage.setItem("defaultDrone", String(defaultDrone || ""));
  localStorage.setItem("defaultSarpas", String(defaultSarpas || ""));
}

/* =======================
   MIGRAÇÃO flightsCount
======================= */
function migrateFlightsCount() {
  let changed = false;

  flights = flights.map(f => {
    if (!f || typeof f !== "object") return f;

    const legacy = f.flightsCount ?? f.flights ?? f.flightsNum ?? 1;
    const n = Number(legacy);
    const flightsCount = (Number.isFinite(n) && n > 0) ? n : 1;

    if (f.flightsCount !== flightsCount || ("flights" in f) || ("flightsNum" in f)) {
      changed = true;
      const nf = { ...f, flightsCount };
      delete nf.flights;
      delete nf.flightsNum;
      return nf;
    }
    return f;
  });

  if (changed) saveAll();
}

function getFlightsCount(f) {
  const n = Number(f?.flightsCount);
  return (Number.isFinite(n) && n > 0) ? n : 1;
}

/* =======================
   ID DO VOO (AAAAMMDDNNNN)
======================= */
function normalizeStr(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function dateToYYYYMMDD(isoDate) {
  const d = String(isoDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return d.replaceAll("-", "");
}

function parseSeqFromId(id) {
  const s = String(id || "").trim();
  if (!/^\d{12}$/.test(s)) return null;
  const seq = Number(s.slice(8, 12));
  return Number.isFinite(seq) ? seq : null;
}

function generateFlightId(dateISO) {
  const base = dateToYYYYMMDD(dateISO);
  if (!base) return "";

  let maxSeq = 0;
  flights.forEach(f => {
    const fid = String(f?.flightId || "").trim();
    if (fid.startsWith(base) && fid.length === 12) {
      const seq = parseSeqFromId(fid);
      if (seq && seq > maxSeq) maxSeq = seq;
    }
  });

  const next = maxSeq + 1;
  return `${base}${String(next).padStart(4, "0")}`;
}

function ensureFlightHasId(flightObj) {
  if (!flightObj || typeof flightObj !== "object") return false;
  const cur = String(flightObj.flightId || "").trim();
  if (/^\d{12}$/.test(cur)) return false;

  const id = generateFlightId(flightObj.date);
  if (!id) return false;

  flightObj.flightId = id;
  return true;
}

function migrateFlightIds() {
  let changed = false;
  flights.forEach(f => { if (ensureFlightHasId(f)) changed = true; });
  if (changed) saveAll();
}

/* =======================
   CONTROLE: fonte do "Novo Local"
======================= */
function setNewLocationSource(source) {
  const el = document.getElementById("newLocation");
  if (!el) return;
  el.dataset.source = source; // "gps" | "manual"
}

function getNewLocationSource() {
  const el = document.getElementById("newLocation");
  return el?.dataset?.source || "manual";
}

/* =======================
   BACKUP / IMPORT (.json)
======================= */
function buildBackupObject() {
  return {
    app: "logbook-drone",
    version: 1,
    createdAt: new Date().toISOString(),
    data: {
      flights: flights || [],
      drones: drones || [],
      locations: locations || [],
      sarpas: sarpasList || [],
      pilot: pilot || { name: "", cpf: "", sarpas: "" },
      defaultDrone: String(defaultDrone || ""),
      defaultSarpas: String(defaultSarpas || "")
    }
  };
}

function downloadBackup() {
  try {
    const backup = buildBackupObject();
    const json = JSON.stringify(backup, null, 2);

    const ymd = new Date().toISOString().slice(0, 10);
    const filename = `logbook-backup-${ymd}.json`;

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    alert("Não foi possível gerar o backup.");
  }
}

function triggerImport() {
  const input = document.getElementById("backupFile");
  if (!input) return;
  input.value = "";
  input.click();
}

/* Deduplicação no mesclar */
function flightKey(f) {
  const date = normalizeStr(f?.date);
  const drone = normalizeStr(f?.drone);
  const duration = String(Number(f?.duration) || 0);
  const flightsCount = String(getFlightsCount(f));
  const location = normalizeStr(f?.location);
  const sarpas = normalizeStr(f?.sarpas);
  const notes = normalizeStr(f?.notes);
  return [date, drone, duration, flightsCount, location, sarpas, notes].join("||");
}

function unionStrings(a, b) {
  const set = new Set();
  (Array.isArray(a) ? a : []).forEach(x => {
    const v = normalizeStr(x);
    if (v) set.add(v);
  });
  (Array.isArray(b) ? b : []).forEach(x => {
    const v = normalizeStr(x);
    if (v) set.add(v);
  });
  return Array.from(set);
}

function mergeFlightsKeepUnique(currentFlights, incomingFlights) {
  const base = Array.isArray(currentFlights) ? currentFlights : [];
  const inc = Array.isArray(incomingFlights) ? incomingFlights : [];

  const map = new Map();
  base.forEach(f => {
    if (!f || typeof f !== "object") return;
    const ff = { ...f, flightsCount: getFlightsCount(f) };
    map.set(flightKey(ff), ff);
  });

  inc.forEach(f => {
    if (!f || typeof f !== "object") return;
    const ff = { ...f, flightsCount: getFlightsCount(f) };
    const key = flightKey(ff);
    if (!map.has(key)) map.set(key, ff);
  });

  return Array.from(map.values());
}

function handleImportFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== "object") throw new Error("Arquivo inválido.");
      if (parsed.app !== "logbook-drone") throw new Error("Este backup não é do Logbook Drone.");
      if (Number(parsed.version) !== 1) throw new Error("Versão de backup não suportada.");

      const data = parsed.data || {};
      const bFlights = Array.isArray(data.flights) ? data.flights : [];
      const bDrones = Array.isArray(data.drones) ? data.drones : [];
      const bLocations = Array.isArray(data.locations) ? data.locations : [];
      const bSarpas = Array.isArray(data.sarpas) ? data.sarpas : [];
      const bPilot = (data.pilot && typeof data.pilot === "object")
        ? data.pilot
        : { name: "", cpf: "", sarpas: "" };
      const bDefaultDrone = normalizeStr(data.defaultDrone || "");
      const bDefaultSarpas = normalizeStr(data.defaultSarpas || "");

      const mode = prompt(
        "IMPORTAR BACKUP\n\nDigite:\n1 = SUBSTITUIR (apaga os dados atuais)\n2 = MESCLAR (mantém e junta sem duplicar voos)\n\n(Se cancelar, não faz nada)"
      );
      if (mode === null) return;

      if (mode !== "1" && mode !== "2") {
        alert("Opção inválida. Digite 1 ou 2.");
        return;
      }

      if (mode === "1") {
        const ok = confirm("SUBSTITUIR?\n\nIsso vai APAGAR os dados atuais e colocar os do backup.");
        if (!ok) return;

        localStorage.setItem("flights", JSON.stringify(bFlights));
        localStorage.setItem("drones", JSON.stringify(bDrones));
        localStorage.setItem("locations", JSON.stringify(bLocations));
        localStorage.setItem("sarpas", JSON.stringify(bSarpas));
        localStorage.setItem("pilot", JSON.stringify(bPilot));
        localStorage.setItem("defaultDrone", String(bDefaultDrone || ""));
        localStorage.setItem("defaultSarpas", String(bDefaultSarpas || ""));

        flights = bFlights;
        drones = bDrones;
        locations = bLocations;
        sarpasList = bSarpas;
        pilot = bPilot;
        defaultDrone = bDefaultDrone;
        defaultSarpas = bDefaultSarpas;

        if (defaultDrone && !drones.includes(defaultDrone)) drones.push(defaultDrone);
        if (defaultSarpas && !sarpasList.includes(defaultSarpas)) sarpasList.push(defaultSarpas);

        migrateFlightsCount();
        migrateFlightIds();
        render();
        showTab("settings");
        alert("Backup importado (SUBSTITUIR) com sucesso!");
        return;
      }

      const ok2 = confirm("MESCLAR?\n\nIsso vai JUNTAR o backup com seus dados atuais e NÃO duplicar voos iguais.");
      if (!ok2) return;

      const mergedDrones = unionStrings(drones, bDrones);
      const mergedLocations = unionStrings(locations, bLocations);
      const mergedSarpas = unionStrings(sarpasList, bSarpas);
      const mergedFlights = mergeFlightsKeepUnique(flights, bFlights);

      const curName = normalizeStr(pilot?.name);
      const curCpf = normalizeStr(pilot?.cpf);
      const curOpSarpas = normalizeStr(pilot?.sarpas);

      const backupName = normalizeStr(bPilot?.name);
      const backupCpf = normalizeStr(bPilot?.cpf);
      const backupOpSarpas = normalizeStr(bPilot?.sarpas);

      const mergedPilot = {
        name: curName || backupName || "",
        cpf: curCpf || backupCpf || "",
        sarpas: curOpSarpas || backupOpSarpas || ""
      };

      const mergedDefaultDrone = normalizeStr(defaultDrone) || bDefaultDrone || "";
      const mergedDefaultSarpas = normalizeStr(defaultSarpas) || bDefaultSarpas || "";

      if (mergedDefaultDrone && !mergedDrones.includes(mergedDefaultDrone)) mergedDrones.push(mergedDefaultDrone);
      if (mergedDefaultSarpas && !mergedSarpas.includes(mergedDefaultSarpas)) mergedSarpas.push(mergedDefaultSarpas);

      localStorage.setItem("flights", JSON.stringify(mergedFlights));
      localStorage.setItem("drones", JSON.stringify(mergedDrones));
      localStorage.setItem("locations", JSON.stringify(mergedLocations));
      localStorage.setItem("sarpas", JSON.stringify(mergedSarpas));
      localStorage.setItem("pilot", JSON.stringify(mergedPilot));
      localStorage.setItem("defaultDrone", String(mergedDefaultDrone || ""));
      localStorage.setItem("defaultSarpas", String(mergedDefaultSarpas || ""));

      flights = mergedFlights;
      drones = mergedDrones;
      locations = mergedLocations;
      sarpasList = mergedSarpas;
      pilot = mergedPilot;
      defaultDrone = mergedDefaultDrone;
      defaultSarpas = mergedDefaultSarpas;

      migrateFlightsCount();
      migrateFlightIds();
      render();
      showTab("settings");
      alert("Backup importado (MESCLAR) com sucesso!");
    } catch (err) {
      alert(err?.message || "Falha ao importar o backup.");
    }
  };

  reader.onerror = () => alert("Erro ao ler o arquivo.");
  reader.readAsText(file);
}

/* =======================
   GPS + ENDEREÇO (opção B)
======================= */
function getCurrentPositionAsync(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada neste aparelho/navegador."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15000,
      ...options
    });
  });
}

function buildAddressFromBDC(data, lat, lon) {
  const parts = [];
  const city =
    data?.city ||
    data?.locality ||
    data?.principalSubdivision ||
    data?.region ||
    "";

  const subdivision = data?.principalSubdivision || "";
  const country = data?.countryName || "";

  const neighborhood =
    data?.localityInfo?.administrative?.find(x => x?.adminLevel === 10)?.name ||
    data?.localityInfo?.administrative?.find(x => x?.adminLevel === 9)?.name ||
    "";

  if (neighborhood && neighborhood !== city) parts.push(neighborhood);
  if (city && !parts.includes(city)) parts.push(city);
  if (subdivision && subdivision !== city) parts.push(subdivision);
  if (country) parts.push(country);

  const address = parts.filter(Boolean).join(" - ");
  return address || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

async function reverseGeocodeToAddress(lat, lon) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=pt`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error("Falha ao obter endereço pela internet.");
  const data = await res.json();
  return buildAddressFromBDC(data, lat, lon);
}

async function getCurrentAddress() {
  const pos = await getCurrentPositionAsync();
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;

  try {
    const address = await reverseGeocodeToAddress(lat, lon);
    return address;
  } catch {
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }
}

function upsertLocationManual(location) {
  const loc = normalizeStr(location);
  if (!loc) return;
  if (!locations.includes(loc)) locations.push(loc);
}

async function useCurrentLocationLogbook() {
  try {
    const address = await getCurrentAddress();

    const selLoc = document.getElementById("location");
    const newLoc = document.getElementById("newLocation");

    if (selLoc) selLoc.value = "";
    if (newLoc) newLoc.value = address;

    setNewLocationSource("gps");
  } catch (err) {
    alert(err?.message || "Não foi possível obter sua localização.");
  }
}

async function useCurrentLocationOperation(force = false) {
  const opLoc = document.getElementById("opLocation");
  if (!opLoc) return;

  if (!force && normalizeStr(opLoc.value)) return;

  try {
    const address = await getCurrentAddress();
    opLoc.value = address;
  } catch {
    // não trava
  }
}

/* =======================
   PADRÕES (Cadastros)
======================= */
function renderDefaultDroneControls() {
  const sel = document.getElementById("defaultDroneSelect");
  const inputNew = document.getElementById("defaultDroneNew");
  if (!sel) return;

  sel.innerHTML = "";

  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "Sem drone padrão";
  sel.appendChild(optNone);

  drones.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    sel.appendChild(opt);
  });

  sel.value = defaultDrone && drones.includes(defaultDrone) ? defaultDrone : "";
  if (inputNew) inputNew.value = "";
}

function saveDefaultDrone() {
  const sel = document.getElementById("defaultDroneSelect");
  const inputNew = document.getElementById("defaultDroneNew");

  const typed = normalizeStr(inputNew?.value);
  const selected = normalizeStr(sel?.value);

  const chosen = typed || selected || "";
  if (!chosen) {
    alert("Selecione um drone ou digite um novo para salvar como padrão.");
    return;
  }

  if (!drones.includes(chosen)) drones.push(chosen);
  defaultDrone = chosen;

  saveAll();
  render();
  alert(`Drone padrão definido: ${defaultDrone}`);
}

function clearDefaultDrone() {
  const ok = confirm("Excluir drone padrão? (Isso não apaga o drone da lista, só remove o padrão.)");
  if (!ok) return;

  defaultDrone = "";
  saveAll();
  render();
}

function renderDefaultSarpasControls() {
  const sel = document.getElementById("defaultSarpasSelect");
  const inputNew = document.getElementById("defaultSarpasNew");
  if (!sel) return;

  sel.innerHTML = "";

  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "Sem SARPAS padrão";
  sel.appendChild(optNone);

  sarpasList.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });

  sel.value = defaultSarpas && sarpasList.includes(defaultSarpas) ? defaultSarpas : "";
  if (inputNew) inputNew.value = "";
}

function saveDefaultSarpas() {
  const sel = document.getElementById("defaultSarpasSelect");
  const inputNew = document.getElementById("defaultSarpasNew");

  const typed = normalizeStr(inputNew?.value);
  const selected = normalizeStr(sel?.value);

  const chosen = typed || selected || "";
  if (!chosen) {
    alert("Selecione um SARPAS ou digite um novo para salvar como padrão.");
    return;
  }

  if (!sarpasList.includes(chosen)) sarpasList.push(chosen);
  defaultSarpas = chosen;

  saveAll();
  render();
  alert(`SARPAS padrão definido: ${defaultSarpas}`);
}

function clearDefaultSarpas() {
  const ok = confirm("Excluir SARPAS padrão? (Isso não apaga da lista, só remove o padrão.)");
  if (!ok) return;

  defaultSarpas = "";
  saveAll();
  render();
}

/* =======================
   TOGGLE OPERADOR
======================= */
function togglePilotBox(forceOpen = null) {
  const box = document.getElementById("pilotBox");
  if (!box) return;

  const shouldOpen = (forceOpen === null) ? !box.classList.contains("open") : !!forceOpen;
  if (shouldOpen) box.classList.add("open");
  else box.classList.remove("open");

  updatePilotToggleLabel();
}

function updatePilotToggleLabel() {
  const btn = document.getElementById("pilotToggle");
  if (!btn) return;

  const box = document.getElementById("pilotBox");
  const isOpen = box?.classList.contains("open");

  const name = normalizeStr(pilot?.name);
  const shortName = name ? ` (${name})` : "";

  btn.textContent = isOpen ? `✖ Fechar dados do operador${shortName}` : `👤 Dados do operador${shortName}`;
}

/* =======================
   OPERADOR
======================= */
function savePilot() {
  pilot.name = document.getElementById("pilotName").value;
  pilot.cpf = document.getElementById("pilotCPF").value;
  pilot.sarpas = document.getElementById("pilotSarpas").value;
  saveAll();
  updatePilotToggleLabel();
  togglePilotBox(false);
  alert("Dados do operador salvos");
}

function loadPilot() {
  const n = document.getElementById("pilotName");
  const c = document.getElementById("pilotCPF");
  const s = document.getElementById("pilotSarpas");

  if (n) n.value = pilot.name || "";
  if (c) c.value = pilot.cpf || "";
  if (s) s.value = pilot.sarpas || "";

  updatePilotToggleLabel();
}

/* =======================
   LOGBOOK: adicionar voo
======================= */
function addFlight() {
  const date = document.getElementById("date").value;
  const flightsNum = Number(document.getElementById("flightsCount").value) || 1;
  const duration = parseInt(document.getElementById("duration").value, 10);

  const newDrone = normalizeStr(document.getElementById("newDrone").value);
  const newLocation = normalizeStr(document.getElementById("newLocation").value);
  const newSarpas = normalizeStr(document.getElementById("newSarpas").value);

  const drone = newDrone || document.getElementById("drone").value;

  const selectedLocation = document.getElementById("location").value || "";
  const location = newLocation || selectedLocation;

  const sarpas = newSarpas || document.getElementById("sarpas").value;
  const notes = document.getElementById("notes").value;

  if (!date || !duration || !drone) {
    alert("Preencha data, duração e drone");
    return;
  }

  if (newDrone && !drones.includes(newDrone)) drones.push(newDrone);
  if (newSarpas && !sarpasList.includes(newSarpas)) sarpasList.push(newSarpas);

  if (newLocation) {
    const source = getNewLocationSource();
    if (source === "manual") upsertLocationManual(newLocation);
  }

  const newFlight = {
    date,
    flightsCount: Math.max(1, Math.floor(flightsNum)),
    duration,
    drone,
    location: location || "",
    sarpas,
    notes,
    flightId: ""
  };

  flights.push(newFlight);
  ensureFlightHasId(newFlight);

  saveAll();
  clearForm();
  render();
}

/* =======================
   OPERAÇÃO (cronômetro)
======================= */
let opInterval = null;
let opStartMs = null;

function formatHHMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function renderOperationDroneSelect() {
  const sel = document.getElementById("opDrone");
  if (!sel) return;

  sel.innerHTML = "";

  if (!drones.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhum drone cadastrado ainda";
    sel.appendChild(opt);
    sel.disabled = true;
    return;
  }

  sel.disabled = false;

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Selecione o drone";
  sel.appendChild(opt0);

  drones.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    sel.appendChild(opt);
  });

  if (defaultDrone && drones.includes(defaultDrone)) {
    sel.value = defaultDrone;
  }
}

function renderOperationSarpasSelect() {
  const sel = document.getElementById("opSarpas");
  if (!sel) return;

  sel.innerHTML = "";

  // permite sem SARPAS
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Selecione o SARPAS (opcional)";
  sel.appendChild(opt0);

  if (!sarpasList.length) {
    sel.disabled = false; // deixa aberto, só com opção vazia
  } else {
    sel.disabled = false;
    sarpasList.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      sel.appendChild(opt);
    });
  }

  if (defaultSarpas && sarpasList.includes(defaultSarpas)) {
    sel.value = defaultSarpas;
  }
}

function showOpMessage(text) {
  const el = document.getElementById("opMsg");
  if (!el) return;
  el.style.display = "block";
  el.textContent = text;
  setTimeout(() => { el.style.display = "none"; }, 3500);
}

function onOpenOperationTab() {
  renderOperationDroneSelect();
  renderOperationSarpasSelect();
  useCurrentLocationOperation(false); // ✅ puxa automático ao entrar
}

async function startOperation() {
  const drone = document.getElementById("opDrone")?.value || "";
  if (!drone) {
    alert("Selecione um drone para iniciar o voo");
    return;
  }
  if (opInterval) return;

  opStartMs = Date.now();

  await useCurrentLocationOperation(false);

  document.getElementById("opIdleBox").style.display = "none";
  document.getElementById("opRunningBox").style.display = "block";

  const timerEl = document.getElementById("opTimer");
  if (timerEl) timerEl.textContent = "00:00:00";

  opInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - opStartMs) / 1000);
    if (timerEl) timerEl.textContent = formatHHMMSS(elapsedSec);
  }, 250);
}

async function endOperation() {
  if (!opInterval || !opStartMs) return;

  clearInterval(opInterval);
  opInterval = null;

  const elapsedSec = Math.max(0, Math.floor((Date.now() - opStartMs) / 1000));
  opStartMs = null;

  const drone = document.getElementById("opDrone")?.value || "";
  if (!drone) {
    alert("Drone inválido. Selecione o drone novamente.");
    resetOperationUI();
    return;
  }

  const sarpasSelected = document.getElementById("opSarpas")?.value || "";
  const minutes = Math.max(1, Math.ceil(elapsedSec / 60));

  let location = normalizeStr(document.getElementById("opLocation")?.value);
  if (!location) {
    try {
      location = await getCurrentAddress();
      const opLoc = document.getElementById("opLocation");
      if (opLoc) opLoc.value = location;
    } catch {
      location = "";
    }
  }

  const newFlight = {
    date: todayISO(),
    flightsCount: 1,
    duration: minutes,
    drone,
    location,
    sarpas: sarpasSelected,
    notes: "",
    flightId: ""
  };

  flights.push(newFlight);
  ensureFlightHasId(newFlight);

  if (!drones.includes(drone)) drones.push(drone);
  if (sarpasSelected && !sarpasList.includes(sarpasSelected)) sarpasList.push(sarpasSelected);

  saveAll();
  render();

  resetOperationUI();
  showOpMessage(`Voo registrado: ${minutes} min • 1 voo${location ? " • Local OK" : ""}`);
}

function resetOperationUI() {
  document.getElementById("opIdleBox").style.display = "block";
  document.getElementById("opRunningBox").style.display = "none";
  const timerEl = document.getElementById("opTimer");
  if (timerEl) timerEl.textContent = "00:00:00";
}

/* =======================
   RELATÓRIOS / LISTAS / UI
======================= */
function renderSummary() {
  const toHM = (minutes) => {
    const m = Math.max(0, Math.floor(Number(minutes) || 0));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}min`;
  };

  let totalMinutes = 0;
  let totalFlights = 0;

  const now = new Date();
  const curY = now.getFullYear();
  const curM = String(now.getMonth() + 1).padStart(2, "0");

  let monthMinutes = 0;
  let monthFlights = 0;

  flights.forEach(f => {
    const mins = Number(f?.duration) || 0;
    const flts = getFlightsCount(f);

    totalMinutes += mins;
    totalFlights += flts;

    if (typeof f?.date === "string" && f.date.length >= 7) {
      const y = Number(f.date.slice(0, 4));
      const m = f.date.slice(5, 7);
      if (y === curY && m === curM) {
        monthMinutes += mins;
        monthFlights += flts;
      }
    }
  });

  const elTotalHours = document.getElementById("dashTotalHours");
  const elTotalFlights = document.getElementById("dashTotalFlights");
  const elThisMonth = document.getElementById("dashThisMonth");

  if (elTotalHours) elTotalHours.textContent = toHM(totalMinutes);
  if (elTotalFlights) elTotalFlights.textContent = String(totalFlights);
  if (elThisMonth) elThisMonth.textContent = `${toHM(monthMinutes)} • ${monthFlights}`;

  const elLast = document.getElementById("dashLastFlight");
  if (elLast) {
    let last = null;
    flights.forEach(f => {
      if (!f || !f.date) return;
      if (!last || String(f.date) > String(last.date)) last = f;
    });

    if (!last) elLast.textContent = "—";
    else {
      const d = last.date || "";
      const drone = last.drone || "—";
      const mins = Number(last.duration) || 0;
      const flts = getFlightsCount(last);
      const h = Math.floor(mins / 60);
      const mm = mins % 60;
      elLast.textContent = `${d} • ${drone} • ${h}h${mm} • ${flts}`;
    }
  }
}

function renderHoursByDrone() {
  const ul = document.getElementById("hoursByDrone");
  if (!ul) return;

  ul.innerHTML = "";

  const totals = {};
  flights.forEach(f => {
    const d = f?.drone || "-";
    if (!totals[d]) totals[d] = { minutes: 0, flights: 0 };
    totals[d].minutes += Number(f.duration) || 0;
    totals[d].flights += getFlightsCount(f);
  });

  const sorted = Object.entries(totals)
    .map(([drone, data]) => ({ drone, minutes: data.minutes, flights: data.flights }))
    .sort((a, b) => b.minutes - a.minutes);

  sorted.forEach(item => {
    const h = Math.floor(item.minutes / 60);
    const m = item.minutes % 60;

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${item.drone}</strong> → ${h}h ${m}min • <strong>${item.flights}</strong> voos
      <button class="small-btn" onclick="deleteDroneHistory('${item.drone}')">Excluir</button>
    `;
    ul.appendChild(li);
  });
}

function deleteDroneHistory(droneName) {
  if (!confirm(`Excluir TODOS os voos do drone "${droneName}"?`)) return;
  flights = flights.filter(f => f.drone !== droneName);
  saveAll();
  render();
}

function renderManage(id, list, type) {
  const ul = document.getElementById(id);
  if (!ul) return;

  ul.innerHTML = "";
  list.forEach((item, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${item}
      <button class="small-btn" onclick="deleteItem('${type}', ${i})">Excluir</button>
    `;
    ul.appendChild(li);
  });
}

function deleteItem(type, index) {
  if (type === "drone") {
    const removed = drones[index];
    drones.splice(index, 1);
    if (normalizeStr(removed) && normalizeStr(removed) === normalizeStr(defaultDrone)) {
      defaultDrone = "";
    }
  }
  if (type === "location") locations.splice(index, 1);
  if (type === "sarpas") {
    const removed = sarpasList[index];
    sarpasList.splice(index, 1);
    if (normalizeStr(removed) && normalizeStr(removed) === normalizeStr(defaultSarpas)) {
      defaultSarpas = "";
    }
  }

  saveAll();
  render();
}

function renderFlights() {
  const list = document.getElementById("flightList");
  if (!list) return;

  list.innerHTML = "";

  const fDate = document.getElementById("filterDate")?.value || "";
  const fDrone = document.getElementById("filterDrone")?.value || "";
  const fLocation = document.getElementById("filterLocation")?.value || "";
  const fSarpas = document.getElementById("filterSarpas")?.value || "";

  const filtered = flights.filter(f =>
    (!fDate || f.date === fDate) &&
    (!fDrone || f.drone === fDrone) &&
    (!fLocation || (f.location || "") === fLocation) &&
    (!fSarpas || (f.sarpas || "") === fSarpas)
  );

  [...filtered].reverse().forEach(f => {
    const i = flights.indexOf(f);
    const fid = /^\d{12}$/.test(String(f?.flightId || "")) ? f.flightId : "";

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${f.drone || "-"}</strong><br>
      ${fid ? `ID: <strong>${fid}</strong><br>` : ""}
      Data: ${f.date || "-"}<br>
      Nº de Voos: ${getFlightsCount(f)}<br>
      Duração: ${Number(f.duration) || 0} min<br>
      Local: ${f.location || "-"}<br>
      SARPAS: ${f.sarpas || "-"}<br>
      ${f.notes || ""}
      <br>
      <button onclick="editFlight(${i})">Editar</button>
      <button onclick="deleteFlight(${i})">Excluir</button>
    `;
    list.appendChild(li);
  });
}

function deleteFlight(i) {
  flights.splice(i, 1);
  saveAll();
  render();
}

function clearForm() {
  document.getElementById("duration").value = "";
  document.getElementById("notes").value = "";
  document.getElementById("newDrone").value = "";
  document.getElementById("newLocation").value = "";
  document.getElementById("newSarpas").value = "";
  document.getElementById("flightsCount").value = "";
  setNewLocationSource("manual");
}

function exportCSV() {
  let csv = "Operador,CPF,SARPAS Operador\n";
  csv += `${pilot.name},${pilot.cpf},${pilot.sarpas}\n\n`;
  csv += "Data,Drone,Nº de Voos,Duração,Local,SARPAS,Observações\n";

  flights.forEach(f => {
    csv += `${f.date},${f.drone},${getFlightsCount(f)},${f.duration},${f.location || ""},${f.sarpas || ""},${f.notes || ""}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "logbook-drone.csv";
  a.click();
}

function toggleHistory() {
  const box = document.getElementById("historyContainer");
  if (!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
}

function clearFilters() {
  document.getElementById("filterDate").value = "";
  document.getElementById("filterDrone").value = "";
  document.getElementById("filterLocation").value = "";
  document.getElementById("filterSarpas").value = "";
  renderFlights();
}

function editFlight(index) {
  const f = flights[index];
  if (!f) return;

  const newFlights = prompt("Nº de voos:", String(getFlightsCount(f)));
  if (newFlights === null) return;

  const newDuration = prompt("Duração total em minutos:", String(f.duration || 0));
  if (newDuration === null) return;

  const flightsNum = parseInt(newFlights, 10);
  const durationNum = parseInt(newDuration, 10);

  if (isNaN(flightsNum) || isNaN(durationNum)) {
    alert("Valores inválidos");
    return;
  }

  f.flightsCount = Math.max(1, flightsNum);
  f.duration = Math.max(1, durationNum);

  saveAll();
  render();
}

function renderMonthlySummary() {
  const ul = document.getElementById("monthlySummary");
  if (!ul) return;

  ul.innerHTML = "";
  const byMonth = {};

  flights.forEach(f => {
    if (!f.date) return;
    const [year, month] = f.date.split("-");
    const key = `${month}/${year}`;
    if (!byMonth[key]) byMonth[key] = { minutes: 0, flights: 0 };
    byMonth[key].minutes += Number(f.duration) || 0;
    byMonth[key].flights += getFlightsCount(f);
  });

  Object.keys(byMonth)
    .sort((a, b) => {
      const [ma, ya] = a.split("/");
      const [mb, yb] = b.split("/");
      return new Date(yb, mb - 1) - new Date(ya, ma - 1);
    })
    .forEach(key => {
      const h = Math.floor(byMonth[key].minutes / 60);
      const m = byMonth[key].minutes % 60;
      const li = document.createElement("li");
      li.textContent = `${key} → ${h}h ${m}min | ${byMonth[key].flights} voos`;
      ul.appendChild(li);
    });
}

function toggleMonthly() {
  const box = document.getElementById("monthlyBox");
  const btn = document.getElementById("toggleMonthlyBtn");
  if (!box || !btn) return;

  if (box.style.display === "none") {
    box.style.display = "block";
    btn.textContent = "❌ Ocultar relatório mensal";
  } else {
    box.style.display = "none";
    btn.textContent = "📅 Ver relatório mensal";
  }
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");
  doc.text("PDF gerado pelo Logbook Drone", 10, 10);
  doc.save("logbook.pdf");
}

/* =======================
   CLIMA (aba)
   Fonte: Open-Meteo + NOAA/SWPC (Kp)
======================= */

// cache simples em memória
let weatherState = {
  lastFetchedAt: 0,
  lastCoords: null,
  lastAddress: ""
};

function knots(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function metersToFeet(m) {
  const v = Number(m);
  if (!Number.isFinite(v)) return null;
  return v * 3.280839895;
}

function degToCompass(deg) {
  const d = Number(deg);
  if (!Number.isFinite(d)) return "—";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const ix = Math.round(((d % 360) / 22.5)) % 16;
  return dirs[ix];
}

function fmtNumber(n, decimals = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(decimals);
}

function fmtVisibility(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m)) return "—";
  if (m >= 10000) return "10 km+";
  if (m >= 1000) return `${(m/1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function weatherCodeToPt(code) {
  const c = Number(code);
  if (!Number.isFinite(c)) return "—";

  const map = {
    0: "Céu limpo",
    1: "Pred. limpo",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Nevoeiro",
    48: "Nevoeiro com gelo",
    51: "Garoa fraca",
    53: "Garoa moderada",
    55: "Garoa forte",
    56: "Garoa congelante fraca",
    57: "Garoa congelante forte",
    61: "Chuva fraca",
    63: "Chuva moderada",
    65: "Chuva forte",
    66: "Chuva congelante fraca",
    67: "Chuva congelante forte",
    71: "Neve fraca",
    73: "Neve moderada",
    75: "Neve forte",
    77: "Grãos de neve",
    80: "Pancadas fracas",
    81: "Pancadas moderadas",
    82: "Pancadas fortes",
    85: "Pancadas de neve fracas",
    86: "Pancadas de neve fortes",
    95: "Tempestade (trovoadas)",
    96: "Trovoadas com granizo fraco",
    99: "Trovoadas com granizo forte"
  };

  return map[c] || `Condição (${c})`;
}

async function getCurrentCoordsAsync() {
  const pos = await getCurrentPositionAsync();
  return {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude
  };
}

async function reverseGeocodeToPlace(lat, lon) {
  try {
    const address = await reverseGeocodeToAddress(lat, lon);
    return address;
  } catch {
    return `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`;
  }
}

async function fetchOpenMeteo(lat, lon) {
  // windspeed_unit=kn já entrega vento em nós
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
    `&current=weather_code,wind_speed_10m,wind_direction_10m` +
    `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,cloud_base,weather_code` +
    `&windspeed_unit=kn&timezone=auto&forecast_days=1`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error("Falha ao obter o clima.");
  return res.json();
}

function pickNearestHourlyIndex(times, targetISO) {
  if (!Array.isArray(times) || !times.length) return -1;
  const t0 = new Date(targetISO).getTime();
  if (!Number.isFinite(t0)) return 0;

  let best = 0;
  let bestDiff = Infinity;

  times.forEach((t, i) => {
    const ms = new Date(t).getTime();
    const diff = Math.abs(ms - t0);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });

  return best;
}

async function fetchKpLatest() {
  // NOAA/SWPC: Planetary K-index (3h)
  const url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error("Falha ao obter Kp.");
  const data = await res.json();

  // Formato: [ ["time_tag","Kp",...], ["YYYY-mm-dd ...","3.33",...], ... ]
  if (!Array.isArray(data) || data.length < 2) return null;

  // pega a última linha válida (de trás pra frente)
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const kp = Number(row?.[1]);
    const time = String(row?.[0] || "");
    if (Number.isFinite(kp) && time) {
      return { kp, time };
    }
  }
  return null;
}

function setWeatherMsg(text, isError = false) {
  const el = document.getElementById("weatherMsg");
  if (!el) return;
  el.style.display = "block";
  el.textContent = text;
  el.style.borderColor = isError ? "rgba(239,68,68,0.45)" : "rgba(10,102,194,0.25)";
}

function clearWeatherMsg() {
  const el = document.getElementById("weatherMsg");
  if (!el) return;
  el.style.display = "none";
  el.textContent = "";
}

function renderWeatherUI(payload) {
  const placeEl = document.getElementById("weatherPlace");
  const condEl = document.getElementById("weatherCondition");
  const windEl = document.getElementById("weatherWind");
  const gustEl = document.getElementById("weatherGust");
  const dirEl = document.getElementById("weatherWindDir");
  const kpEl = document.getElementById("weatherKp");
  const visEl = document.getElementById("weatherVis");
  const layersEl = document.getElementById("weatherCloudLayers");
  const ceilingEl = document.getElementById("weatherCeiling");

  if (placeEl) placeEl.textContent = weatherState.lastAddress ? `📍 ${weatherState.lastAddress}` : "—";

  const conditionText = weatherCodeToPt(payload?.weather_code);
  if (condEl) condEl.textContent = conditionText;

  const windKn = knots(payload?.wind_speed_10m);
  if (windEl) windEl.textContent = windKn === null ? "—" : `${fmtNumber(windKn, 0)} kt`;

  const gustKn = knots(payload?.wind_gusts_10m);
  if (gustEl) gustEl.textContent = gustKn === null ? "—" : `${fmtNumber(gustKn, 0)} kt`;

  const deg = Number(payload?.wind_direction_10m);
  if (dirEl) dirEl.textContent = Number.isFinite(deg) ? `${Math.round(deg)}° (${degToCompass(deg)})` : "—";

  if (kpEl) {
    if (payload?.kp === null || payload?.kp === undefined) kpEl.textContent = "—";
    else kpEl.textContent = `${fmtNumber(payload.kp, 2)} (último 3h)`;
  }

  if (visEl) visEl.textContent = fmtVisibility(payload?.visibility);

  // Camadas de nuvem (%)
  const cc = Number(payload?.cloud_cover);
  const low = Number(payload?.cloud_cover_low);
  const mid = Number(payload?.cloud_cover_mid);
  const high = Number(payload?.cloud_cover_high);

  const parts = [];
  if (Number.isFinite(cc)) parts.push(`Total: ${Math.round(cc)}%`);
  if (Number.isFinite(low)) parts.push(`Baixa: ${Math.round(low)}%`);
  if (Number.isFinite(mid)) parts.push(`Média: ${Math.round(mid)}%`);
  if (Number.isFinite(high)) parts.push(`Alta: ${Math.round(high)}%`);

  if (layersEl) layersEl.textContent = parts.length ? parts.join(" • ") : "—";

  // Teto: cloud_base (m) -> pés
  const baseM = Number(payload?.cloud_base);
  const baseFt = metersToFeet(baseM);
  if (ceilingEl) {
    if (baseFt === null) ceilingEl.textContent = "—";
    else ceilingEl.textContent = `${Math.round(baseFt)} ft (base da nuvem)`;
  }
}

async function refreshWeather(force = false) {
  clearWeatherMsg();

  // evita spam (cache 45s)
  const now = Date.now();
  if (!force && weatherState.lastFetchedAt && (now - weatherState.lastFetchedAt) < 45000) {
    if (weatherState.lastPayload) renderWeatherUI(weatherState.lastPayload);
    return;
  }

  try {
    setWeatherMsg("Buscando sua localização…");
    const { lat, lon } = await getCurrentCoordsAsync();
    weatherState.lastCoords = { lat, lon };

    setWeatherMsg("Buscando clima…");
    const [meteo, kp] = await Promise.all([
      fetchOpenMeteo(lat, lon),
      fetchKpLatest().catch(() => null)
    ]);

    // Nome do lugar (endereço simples)
    weatherState.lastAddress = await reverseGeocodeToPlace(lat, lon);

    // Pega dados atuais (preferencial) e complementa com hourly
    const cur = meteo?.current || {};
    const hourly = meteo?.hourly || {};
    const times = hourly.time || [];
    const i = pickNearestHourlyIndex(times, cur?.time || new Date().toISOString());

    const payload = {
      weather_code: (cur.weather_code ?? hourly.weather_code?.[i]),
      wind_speed_10m: (cur.wind_speed_10m ?? hourly.wind_speed_10m?.[i]),
      wind_direction_10m: (cur.wind_direction_10m ?? hourly.wind_direction_10m?.[i]),
      wind_gusts_10m: (hourly.wind_gusts_10m?.[i]),
      visibility: (hourly.visibility?.[i]),
      cloud_cover: (hourly.cloud_cover?.[i]),
      cloud_cover_low: (hourly.cloud_cover_low?.[i]),
      cloud_cover_mid: (hourly.cloud_cover_mid?.[i]),
      cloud_cover_high: (hourly.cloud_cover_high?.[i]),
      cloud_base: (hourly.cloud_base?.[i]),
      kp: kp ? kp.kp : null
    };

    weatherState.lastFetchedAt = now;
    weatherState.lastPayload = payload;

    clearWeatherMsg();
    renderWeatherUI(payload);
  } catch (err) {
    setWeatherMsg(err?.message || "Não foi possível obter o clima. Verifique internet e permissão de localização.", true);
  }
}

function onOpenWeatherTab() {
  // ao abrir, tenta atualizar uma vez
  refreshWeather(false);
}

/* ABAS */
function showTab(tab) {
  document.querySelectorAll(".tab-content").forEach(div => {
    div.style.display = "none";
  });

  document.querySelectorAll(".tabs button").forEach(btn => {
    btn.classList.remove("active");
  });

  const content = document.getElementById(`tab-${tab}-content`);
  const button = document.getElementById(`tab-${tab}`);

  if (content) content.style.display = "block";
  if (button) button.classList.add("active");

  if (tab === "operation") onOpenOperationTab();
  if (tab === "weather") onOpenWeatherTab();
}

function fillSelect(el, list) {
  if (!el) return;
  el.innerHTML = "<option value=''>Selecione</option>";
  list.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    el.appendChild(opt);
  });
}

function render() {
  migrateFlightIds();

  if (defaultDrone && !drones.includes(defaultDrone)) drones.push(defaultDrone);
  if (defaultSarpas && !sarpasList.includes(defaultSarpas)) sarpasList.push(defaultSarpas);

  loadPilot();
  renderSummary();
  renderMonthlySummary();

  fillSelect(document.getElementById("drone"), drones);
  fillSelect(document.getElementById("location"), locations);
  fillSelect(document.getElementById("sarpas"), sarpasList);

  fillSelect(document.getElementById("filterDrone"), drones);
  fillSelect(document.getElementById("filterLocation"), locations);
  fillSelect(document.getElementById("filterSarpas"), sarpasList);

  renderManage("droneList", drones, "drone");
  renderManage("locationList", locations, "location");
  renderManage("sarpasList", sarpasList, "sarpas");

  renderHoursByDrone();
  renderFlights();

  renderOperationDroneSelect();
  renderOperationSarpasSelect();

  renderDefaultDroneControls();
  renderDefaultSarpasControls();

  togglePilotBox(false);

  setNewLocationSource("manual");
  const newLoc = document.getElementById("newLocation");
  if (newLoc && !newLoc.dataset._bound) {
    newLoc.addEventListener("input", () => setNewLocationSource("manual"));
    newLoc.dataset._bound = "1";
  }

  saveAll();
}

/* INIT */
migrateFlightsCount();
migrateFlightIds();
render();
showTab("logbook");
