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

// ✅ METAR (aba clima) - aeroportos salvos
let metarStations = JSON.parse(localStorage.getItem("metarStations")) || [];
let defaultMetarStation = localStorage.getItem("defaultMetarStation") || "";


function saveAll() {
  localStorage.setItem("flights", JSON.stringify(flights));
  localStorage.setItem("drones", JSON.stringify(drones));
  localStorage.setItem("locations", JSON.stringify(locations));
  localStorage.setItem("sarpas", JSON.stringify(sarpasList));
  localStorage.setItem("pilot", JSON.stringify(pilot));
  localStorage.setItem("defaultDrone", String(defaultDrone || ""));
  localStorage.setItem("defaultSarpas", String(defaultSarpas || ""));

  // METAR
  localStorage.setItem("metarStations", JSON.stringify(Array.isArray(metarStations) ? metarStations : []));
  localStorage.setItem("defaultMetarStation", String(defaultMetarStation || ""));
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
      defaultSarpas: String(defaultSarpas || ""),
      metarStations: Array.isArray(metarStations) ? metarStations : [],
      defaultMetarStation: String(defaultMetarStation || "")
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
      const bMetarStations = Array.isArray(data.metarStations) ? data.metarStations : [];
      const bDefaultMetarStation = normalizeStr(data.defaultMetarStation || "");

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
        localStorage.setItem("metarStations", JSON.stringify(bMetarStations));
        localStorage.setItem("defaultMetarStation", String(bDefaultMetarStation || ""));

        flights = bFlights;
        drones = bDrones;
        locations = bLocations;
        sarpasList = bSarpas;
        pilot = bPilot;
        defaultDrone = bDefaultDrone;
        defaultSarpas = bDefaultSarpas;
        metarStations = bMetarStations;
        defaultMetarStation = bDefaultMetarStation;

        if (defaultDrone && !drones.includes(defaultDrone)) drones.push(defaultDrone);
        if (defaultSarpas && !sarpasList.includes(defaultSarpas)) sarpasList.push(defaultSarpas);
        if (bDefaultMetarStation && !bMetarStations.includes(bDefaultMetarStation)) bMetarStations.push(bDefaultMetarStation);

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
      <button onclick="openEditModal(${i})">Editar</button>
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


/* =======================
   MODAL: Editar Voo (completo)
======================= */
let currentEditIndex = null;

function fillSelectWithOptions(selectEl, items, placeholder) {
  if (!selectEl) return;
  selectEl.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder || "Selecione";
  selectEl.appendChild(opt0);

  (Array.isArray(items) ? items : []).forEach(it => {
    const v = normalizeStr(it);
    if (!v) return;
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function bindEditModalOnce() {
  const overlay = document.getElementById("editModalOverlay");
  if (!overlay || overlay.dataset.bound) return;

  const closeBtn = document.getElementById("editModalClose");
  const cancelBtn = document.getElementById("editModalCancel");
  const saveBtn = document.getElementById("editModalSave");

  closeBtn?.addEventListener("click", closeEditModal);
  cancelBtn?.addEventListener("click", closeEditModal);
  saveBtn?.addEventListener("click", saveEditModal);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeEditModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.style.display === "flex") closeEditModal();
  });

  overlay.dataset.bound = "1";
}

function openEditModal(index) {
  const f = flights[index];
  if (!f) return;

  currentEditIndex = index;

  const overlay = document.getElementById("editModalOverlay");
  if (!overlay) {
    alert("Modal de edição não encontrado no HTML.");
    return;
  }

  fillSelectWithOptions(document.getElementById("editDrone"), drones, "Selecione o drone");
  fillSelectWithOptions(document.getElementById("editLocation"), locations, "Selecione o local");
  fillSelectWithOptions(document.getElementById("editSarpas"), sarpasList, "Selecione o SARPAS (opcional)");

  const fid = String(f?.flightId || "").trim();
  const sub = document.getElementById("editModalSub");
  if (sub) sub.textContent = fid ? `ID: ${fid}` : "Sem ID";

  document.getElementById("editDate").value = f.date || "";
  document.getElementById("editDuration").value = String(Number(f.duration) || 0);
  document.getElementById("editFlightsCount").value = String(getFlightsCount(f));
  document.getElementById("editNotes").value = f.notes || "";

  const dSel = document.getElementById("editDrone");
  const lSel = document.getElementById("editLocation");
  const sSel = document.getElementById("editSarpas");

  dSel.value = drones.includes(f.drone) ? f.drone : "";
  lSel.value = locations.includes(f.location) ? f.location : "";
  sSel.value = sarpasList.includes(f.sarpas) ? f.sarpas : "";

  document.getElementById("editNewDrone").value = (!drones.includes(f.drone) && normalizeStr(f.drone)) ? f.drone : "";
  document.getElementById("editNewLocation").value = (!locations.includes(f.location) && normalizeStr(f.location)) ? f.location : "";
  document.getElementById("editNewSarpas").value = (!sarpasList.includes(f.sarpas) && normalizeStr(f.sarpas)) ? f.sarpas : "";

  overlay.style.display = "flex";
}

function closeEditModal() {
  const overlay = document.getElementById("editModalOverlay");
  if (!overlay) return;
  overlay.style.display = "none";
  currentEditIndex = null;
}

function saveEditModal() {
  if (currentEditIndex === null) return;
  const f = flights[currentEditIndex];
  if (!f) {
    closeEditModal();
    return;
  }

  const date = document.getElementById("editDate")?.value || "";
  const duration = parseInt(document.getElementById("editDuration")?.value || "0", 10);
  const flightsNum = parseInt(document.getElementById("editFlightsCount")?.value || "1", 10);

  const typedDrone = normalizeStr(document.getElementById("editNewDrone")?.value);
  const selectedDrone = normalizeStr(document.getElementById("editDrone")?.value);
  const drone = typedDrone || selectedDrone;

  const typedLoc = normalizeStr(document.getElementById("editNewLocation")?.value);
  const selectedLoc = normalizeStr(document.getElementById("editLocation")?.value);
  const location = typedLoc || selectedLoc || "";

  const typedSar = normalizeStr(document.getElementById("editNewSarpas")?.value);
  const selectedSar = normalizeStr(document.getElementById("editSarpas")?.value);
  const sarpas = typedSar || selectedSar || "";

  const notes = document.getElementById("editNotes")?.value || "";

  if (!date || !drone || !Number.isFinite(duration) || duration <= 0) {
    alert("Preencha pelo menos: data, duração e drone.");
    return;
  }

  if (drone && !drones.includes(drone)) drones.push(drone);
  if (location && !locations.includes(location)) locations.push(location);
  if (sarpas && !sarpasList.includes(sarpas)) sarpasList.push(sarpas);

  f.date = date;
  f.duration = Math.max(1, duration);
  f.flightsCount = Math.max(1, Math.floor(Number.isFinite(flightsNum) ? flightsNum : 1));
  f.drone = drone;
  f.location = location;
  f.sarpas = sarpas;
  f.notes = notes;

  ensureFlightHasId(f);

  saveAll();
  render();
  closeEditModal();
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

function editFlight(index){
  openEditModal(index);
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


/* =======================
   METAR (aeroporto)
   Fonte: VATSIM METAR feed (texto cru) - https://metar.vatsim.net/metar.php?id=ICAO
======================= */

const metarState = {
  lastStation: "",
  lastText: "",
  lastFetchedAt: 0,
  didAutoFetch: false
};

function normalizeStationCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function metarMsg(text, isError = false) {
  const el = document.getElementById("metarMsg");
  if (!el) return;
  el.style.display = "block";
  el.textContent = text;
  el.style.borderColor = isError ? "rgba(185,28,28,0.45)" : "rgba(11,42,91,0.16)";
  setTimeout(() => { el.style.display = "none"; }, 4200);
}

function renderMetarControls() {
  const sel = document.getElementById("metarSaved");
  const input = document.getElementById("metarInput");
  if (!sel) return;

  // dedup + normalize
  metarStations = Array.from(new Set((Array.isArray(metarStations) ? metarStations : [])
    .map(normalizeStationCode)
    .filter(Boolean)));

  sel.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = metarStations.length ? "Selecione um aeroporto salvo" : "Nenhum aeroporto salvo ainda";
  sel.appendChild(opt0);

  metarStations.forEach(code => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = code === defaultMetarStation ? `${code} ⭐` : code;
    sel.appendChild(opt);
  });

  // pré-seleciona o padrão
  if (defaultMetarStation && metarStations.includes(defaultMetarStation)) {
    sel.value = defaultMetarStation;
  }

  if (input && !normalizeStationCode(input.value)) {
    input.value = defaultMetarStation || "";
  }
}

function getChosenStation() {
  const input = document.getElementById("metarInput");
  const sel = document.getElementById("metarSaved");
  const typed = normalizeStationCode(input?.value);
  const selected = normalizeStationCode(sel?.value);
  return typed || selected || "";
}

async function fetchMetar(force = false) {
  const station = getChosenStation();
  if (!station) {
    metarMsg("Digite ou selecione um aeroporto (ICAO/IATA).", true);
    return;
  }

  // cache curto (20s)
  const now = Date.now();
  if (!force && metarState.lastStation === station && (now - metarState.lastFetchedAt) < 20000 && metarState.lastText) {
    showMetarResult(station, metarState.lastText);
    return;
  }

  const resultEl = document.getElementById("metarResult");
  if (resultEl) resultEl.style.display = "none";

  try {
    metarMsg("Buscando METAR…");
    const url = `https://metar.vatsim.net/metar.php?id=${encodeURIComponent(station)}`;
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao obter METAR.");

    const text = String(await res.text() || "").trim();
    if (!text) throw new Error("METAR vazio ou indisponível.");

    metarState.lastStation = station;
    metarState.lastText = text;
    metarState.lastFetchedAt = Date.now();

    showMetarResult(station, text);
  } catch (err) {
    // CORS ou rede
    const msg = err?.message || "Não foi possível buscar o METAR.";
    metarMsg(
      msg.includes("Failed to fetch")
        ? "Não consegui buscar o METAR (bloqueio de rede/CORS). Se estiver abrindo o app como arquivo (file://), hospede em um servidor (ex.: GitHub Pages) ou use um proxy."
        : msg,
      true
    );
  }
}

function showMetarResult(station, text) {
  const el = document.getElementById("metarResult");
  if (el) {
    el.style.display = "block";
    el.textContent = `${station}
${text}`;
  }

  // Decodifica e mostra em cards + avaliação operacional
  try {
    const decoded = decodeMetarText(station, text);
    renderMetarDecoded(decoded);
    renderMetarOps(decoded);
  } catch (e) {
    // Se não conseguir decodificar, só não exibe as seções extras
    const decEl = document.getElementById("metarDecoded");
    const opsEl = document.getElementById("metarOps");
    if (decEl) decEl.style.display = "none";
    if (opsEl) opsEl.style.display = "none";
  }
}

/* =======================
   METAR: decodificação + tradução + avaliação (drone)
======================= */

function metarUnk(v) { return (v === null || v === undefined || v === "") ? "—" : v; }

function parseFractionToNumber(s) {
  const t = String(s || "").trim();
  if (!t) return null;
  if (t.includes("/")) {
    const [a,b] = t.split("/");
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb) && nb !== 0) return na/nb;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function knotsToMs(kt) {
  const v = Number(kt);
  return Number.isFinite(v) ? v * 0.514444 : null;
}

function metersToKm(m) {
  const v = Number(m);
  return Number.isFinite(v) ? v/1000 : null;
}

function inhgToHpa(inhg) {
  const v = Number(inhg);
  return Number.isFinite(v) ? v * 33.8638866667 : null;
}

function cloudAmountPt(code) {
  const map = {
    FEW: "Poucas (FEW)",
    SCT: "Dispersas (SCT)",
    BKN: "Fragmentadas (BKN)",
    OVC: "Encoberto (OVC)",
    VV: "Vertical visibility (VV)",
    NSC: "Sem nuvens significativas (NSC)",
    NCD: "Sem nuvens detectadas (NCD)",
    SKC: "Céu limpo (SKC)",
    CLR: "Céu limpo (CLR)"
  };
  return map[code] || code;
}

function weatherTokenPt(token) {
  const t = String(token || "").trim();
  if (!t) return "";

  // intensidade / proximidade
  let intensity = "";
  let rest = t;

  if (rest.startsWith("+")) { intensity = "Forte"; rest = rest.slice(1); }
  else if (rest.startsWith("-")) { intensity = "Fraca"; rest = rest.slice(1); }
  else if (rest.startsWith("VC")) { intensity = "Nas proximidades"; rest = rest.slice(2); }

  const dict = {
    // descritores
    MI:"Raso", PR:"Parcial", BC:"Bancos", DR:"Baixo arrastado", BL:"Soprando", SH:"Pancadas",
    TS:"Trovoada", FZ:"Congelante",
    // precipitação
    DZ:"Garoa", RA:"Chuva", SN:"Neve", SG:"Grãos de neve", IC:"Cristais de gelo", PL:"Pelotas de gelo",
    GR:"Granizo", GS:"Granizo pequeno", UP:"Precipitação desconhecida",
    // obscurecimento
    BR:"Névoa úmida (BR)", FG:"Nevoeiro (FG)", FU:"Fumaça", VA:"Cinzas vulcânicas", DU:"Poeira",
    SA:"Areia", HZ:"Névoa seca (HZ)", PY:"Spray",
    // outros
    PO:"Redemoinhos de poeira/areia", SQ:"Rajada súbita (SQ)", FC:"Funil/tromba", SS:"Tempestade de areia", DS:"Tempestade de poeira"
  };

  // Quebra em códigos de 2 letras (com alguns de 2 que funcionam como prefixo)
  // Ex.: TSRA -> TS + RA | SHRA -> SH + RA | FZFG -> FZ + FG
  const parts = [];
  for (let i = 0; i < rest.length; i += 2) {
    parts.push(rest.slice(i, i+2));
  }

  const translated = parts.map(p => dict[p] || p).filter(Boolean).join(" + ");
  if (!translated) return "";

  return intensity ? `${translated} (${intensity})` : translated;
}

function isWeatherToken(tok) {
  // começa com + - VC ou combinações típicas (TS, SH, FZ...) e letras
  const t = String(tok || "").trim();
  if (!t) return false;
  if (t === "NOSIG") return false;
  if (/^(RMK|BECMG|TEMPO)$/.test(t)) return false;
  if (/^(NSC|NCD|SKC|CLR)$/.test(t)) return false;
  if (/^(FEW|SCT|BKN|OVC|VV)\d{3}/.test(t)) return false;
  if (/^(A|Q)\d{4}$/.test(t)) return false;
  if (/^(M?\d{2})\/(M?\d{2})$/.test(t)) return false;
  if (/^\d{4}$/.test(t) || /^\d{1,2}SM$/.test(t) || /^\d\/\dSM$/.test(t) || /^\d \d\/\dSM$/.test(t) || t === "CAVOK") return false;
  // sinais e letras
  return /^[\+\-A-Z]{2,}$/.test(t);
}

function decodeMetarText(stationFallback, rawText) {
  const raw = String(rawText || "").trim();
  const tokens = raw.split(/\s+/).filter(Boolean);

  const out = {
    station: normalizeStationCode(stationFallback),
    type: "",
    timeUTC: "",
    windDir: null,
    windSpeedKt: null,
    windGustKt: null,
    windVar: null, // ex: 180V240
    visibilityM: null,
    visibilityRaw: "",
    rvr: [],
    weather: [],
    clouds: [],
    ceilingFt: null,
    tempC: null,
    dewC: null,
    altimeterHpa: null,
    altimeterInHg: null,
    cavok: false
  };

  let i = 0;
  if (tokens[i] === "METAR" || tokens[i] === "SPECI") {
    out.type = tokens[i];
    i++;
  }

  if (tokens[i] && /^[A-Z0-9]{4}$/.test(tokens[i])) {
    out.station = tokens[i];
    i++;
  }

  if (tokens[i] && /^\d{6}Z$/.test(tokens[i])) {
    // DDHHMMZ
    out.timeUTC = tokens[i];
    i++;
  }

  // vento
  if (tokens[i] && /^(VRB|\d{3})\d{2,3}(G\d{2,3})?(KT|MPS)$/.test(tokens[i])) {
    const w = tokens[i];
    const m = w.match(/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/);
    if (m) {
      out.windDir = m[1];
      out.windSpeedKt = Number(m[2]);
      out.windGustKt = m[4] ? Number(m[4]) : null;
      const unit = m[5];
      if (unit === "MPS") {
        // converte m/s -> kt
        out.windSpeedKt = Math.round(out.windSpeedKt / 0.514444);
        if (out.windGustKt !== null) out.windGustKt = Math.round(out.windGustKt / 0.514444);
      }
    }
    i++;
  }

  // variação do vento 180V240
  if (tokens[i] && /^\d{3}V\d{3}$/.test(tokens[i])) {
    out.windVar = tokens[i];
    i++;
  }

  // visibilidade / CAVOK
  if (tokens[i] === "CAVOK") {
    out.cavok = true;
    out.visibilityM = 10000;
    out.visibilityRaw = "CAVOK";
    i++;
  } else if (tokens[i]) {
    // 9999 (>=10km) ou 4000 etc
    if (/^\d{4}$/.test(tokens[i])) {
      const v = Number(tokens[i]);
      out.visibilityM = Number.isFinite(v) ? v : null;
      out.visibilityRaw = tokens[i];
      i++;
    } else if (/^\d{1,2}SM$/.test(tokens[i])) {
      const sm = Number(tokens[i].replace("SM",""));
      if (Number.isFinite(sm)) {
        out.visibilityM = Math.round(sm * 1609.344);
        out.visibilityRaw = tokens[i];
      }
      i++;
    } else if (/^\d\/\dSM$/.test(tokens[i])) {
      const frac = tokens[i].replace("SM","");
      const sm = parseFractionToNumber(frac);
      if (sm !== null) {
        out.visibilityM = Math.round(sm * 1609.344);
        out.visibilityRaw = tokens[i];
      }
      i++;
    } else if (i+1 < tokens.length && /^\d$/.test(tokens[i]) && /^\d\/\dSM$/.test(tokens[i+1])) {
      const whole = Number(tokens[i]);
      const frac = tokens[i+1].replace("SM","");
      const sm = (Number.isFinite(whole) ? whole : 0) + (parseFractionToNumber(frac) || 0);
      out.visibilityM = Math.round(sm * 1609.344);
      out.visibilityRaw = tokens[i] + " " + tokens[i+1];
      i += 2;
    }
  }

  // percorre o resto até RMK
  for (; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "RMK") break;

    // RVR: R23/1400FT ou R23L/0600V1200FT etc
    if (/^R\d{2}[LRC]?\/\d{4}(V\d{4})?FT$/.test(tok)) {
      out.rvr.push(tok);
      continue;
    }

    // nuvens
    if (/^(FEW|SCT|BKN|OVC|VV)\d{3}(CB|TCU)?$/.test(tok)) {
      const m = tok.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$/);
      const amount = m[1];
      const heightHundredsFt = Number(m[2]);
      const heightFt = Number.isFinite(heightHundredsFt) ? heightHundredsFt * 100 : null;
      const type = m[3] || "";
      out.clouds.push({ raw: tok, amount, heightFt, type });

      // ceiling: menor BKN/OVC/VV
      if (["BKN","OVC","VV"].includes(amount) && Number.isFinite(heightFt)) {
        if (out.ceilingFt === null || heightFt < out.ceilingFt) out.ceilingFt = heightFt;
      }
      continue;
    }

    if (/^(NSC|NCD|SKC|CLR)$/.test(tok)) {
      out.clouds.push({ raw: tok, amount: tok, heightFt: null, type: "" });
      continue;
    }

    // temp/dew
    if (/^(M?\d{2})\/(M?\d{2})$/.test(tok)) {
      const mm = tok.match(/^(M?\d{2})\/(M?\d{2})$/);
      const t = mm[1].startsWith("M") ? -Number(mm[1].slice(1)) : Number(mm[1]);
      const d = mm[2].startsWith("M") ? -Number(mm[2].slice(1)) : Number(mm[2]);
      out.tempC = Number.isFinite(t) ? t : null;
      out.dewC = Number.isFinite(d) ? d : null;
      continue;
    }

    // altímetro
    if (/^Q\d{4}$/.test(tok)) {
      out.altimeterHpa = Number(tok.slice(1));
      continue;
    }
    if (/^A\d{4}$/.test(tok)) {
      const inhg = Number(tok.slice(1)) / 100;
      out.altimeterInHg = Number.isFinite(inhg) ? inhg : null;
      out.altimeterHpa = out.altimeterInHg ? inhgToHpa(out.altimeterInHg) : out.altimeterHpa;
      continue;
    }

    // weather
    if (isWeatherToken(tok)) {
      out.weather.push(tok);
      continue;
    }

    // ignorar outras partes (NOSIG, etc.)
  }

  // Se CAVOK, simplifica nuvens/vis
  if (out.cavok) {
    if (out.ceilingFt === null) out.ceilingFt = null;
  }

  return out;
}

function formatWind(decoded) {
  if (!decoded) return "—";
  const dir = decoded.windDir;
  const spd = decoded.windSpeedKt;
  if (!dir || spd === null || spd === undefined) return "—";
  const gust = decoded.windGustKt;
  const base = `${dir} ${spd} kt`;
  return gust ? `${base} (G${gust})` : base;
}

function formatVisibility(decoded) {
  if (!decoded) return "—";
  if (decoded.visibilityRaw) {
    if (decoded.visibilityRaw === "9999") return "10 km+";
    if (decoded.visibilityRaw === "CAVOK") return "CAVOK (10 km+)";
  }
  const m = decoded.visibilityM;
  if (!Number.isFinite(m)) return "—";
  if (m >= 10000) return "10 km+";
  if (m >= 1000) return `${metersToKm(m).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function formatClouds(decoded) {
  if (!decoded || !Array.isArray(decoded.clouds) || !decoded.clouds.length) return "—";
  const parts = decoded.clouds.map(c => {
    if (!c) return null;
    if (["NSC","NCD","SKC","CLR"].includes(c.amount)) return cloudAmountPt(c.amount);
    const h = Number.isFinite(c.heightFt) ? `${Math.round(c.heightFt)} ft` : "";
    const typ = c.type ? ` ${c.type}` : "";
    return `${cloudAmountPt(c.amount)} ${h}${typ}`.trim();
  }).filter(Boolean);
  return parts.length ? parts.join(" • ") : "—";
}

function formatCeiling(decoded) {
  const ft = decoded?.ceilingFt;
  if (!Number.isFinite(ft)) return "—";
  return `${Math.round(ft)} ft`;
}

function formatTempDew(decoded) {
  const t = decoded?.tempC;
  const d = decoded?.dewC;
  if (!Number.isFinite(t) && !Number.isFinite(d)) return "—";
  if (Number.isFinite(t) && Number.isFinite(d)) return `${t}°C / ${d}°C`;
  if (Number.isFinite(t)) return `${t}°C`;
  return `Orvalho ${d}°C`;
}

function formatAltimeter(decoded) {
  const qnh = decoded?.altimeterHpa;
  const inhg = decoded?.altimeterInHg;
  const parts = [];
  if (Number.isFinite(qnh)) parts.push(`${Math.round(qnh)} hPa`);
  if (Number.isFinite(inhg)) parts.push(`${inhg.toFixed(2)} inHg`);
  return parts.length ? parts.join(" • ") : "—";
}

function translateWeatherList(decoded) {
  const w = Array.isArray(decoded?.weather) ? decoded.weather : [];
  if (!w.length) return "—";
  return w.map(weatherTokenPt).filter(Boolean).join(" • ") || "—";
}

function renderMetarDecoded(decoded) {
  const el = document.getElementById("metarDecoded");
  if (!el) return;

  // monta cards
  el.innerHTML = "";

  const items = [
    { label: "Estação / Hora (UTC)", value: `${metarUnk(decoded.station)} • ${metarUnk(decoded.timeUTC)}` , span2: true },
    { label: "Vento", value: formatWind(decoded) },
    { label: "Visibilidade", value: formatVisibility(decoded) },
    { label: "Fenômenos", value: translateWeatherList(decoded), span2: true },
    { label: "Nuvens", value: formatClouds(decoded), span2: true },
    { label: "Teto (ceiling)", value: formatCeiling(decoded) },
    { label: "Temp / Orvalho", value: formatTempDew(decoded) },
    { label: "QNH", value: formatAltimeter(decoded), span2: true }
  ];

  items.forEach(it => {
    const div = document.createElement("div");
    div.className = `metar-item${it.span2 ? " span-2" : ""}`;

    const lab = document.createElement("div");
    lab.className = "metar-label";
    lab.textContent = it.label;

    const val = document.createElement("div");
    val.className = "metar-value";
    val.textContent = it.value;

    div.appendChild(lab);
    div.appendChild(val);
    el.appendChild(div);
  });

  el.style.display = "grid";
}

function assessMetarForDrone(decoded) {
  const reasons = [];
  let level = "ok"; // ok | warn | nogo

  function bump(to) {
    const order = { ok: 0, warn: 1, nogo: 2 };
    if (order[to] > order[level]) level = to;
  }

  // vento
  const spd = Number(decoded?.windSpeedKt);
  const gust = Number(decoded?.windGustKt);

  if (Number.isFinite(spd)) {
    if (spd >= 30) { bump("nogo"); reasons.push(`Vento forte (${spd} kt).`); }
    else if (spd >= 20) { bump("warn"); reasons.push(`Vento moderado/alto (${spd} kt).`); }
  }
  if (Number.isFinite(gust)) {
    if (gust >= 35) { bump("nogo"); reasons.push(`Rajadas fortes (G${gust}).`); }
    else if (gust >= 25) { bump("warn"); reasons.push(`Rajadas consideráveis (G${gust}).`); }
  }

  // visibilidade
  const vis = Number(decoded?.visibilityM);
  if (Number.isFinite(vis)) {
    if (vis < 3000) { bump("nogo"); reasons.push(`Visibilidade baixa (${formatVisibility(decoded)}).`); }
    else if (vis < 5000) { bump("warn"); reasons.push(`Visibilidade reduzida (${formatVisibility(decoded)}).`); }
  }

  // teto
  const ceil = Number(decoded?.ceilingFt);
  if (Number.isFinite(ceil)) {
    if (ceil < 1000) { bump("nogo"); reasons.push(`Teto baixo (${Math.round(ceil)} ft).`); }
    else if (ceil < 2000) { bump("warn"); reasons.push(`Teto moderado (${Math.round(ceil)} ft).`); }
  }

  // fenômenos críticos
  const wxRaw = (Array.isArray(decoded?.weather) ? decoded.weather : []).join(" ");
  if (/(^|\s)(TS|TSRA|SQ|FC)(\s|$)/.test(wxRaw) || wxRaw.includes("TS")) {
    bump("nogo");
    reasons.push("Trovoada / atividade convectiva (TS).");
  }
  if (wxRaw.includes("FG") || wxRaw.includes("FZFG")) {
    bump("nogo");
    reasons.push("Nevoeiro (FG).");
  }
  if (wxRaw.includes("+RA") || wxRaw.includes("GR") || wxRaw.includes("GS")) {
    bump("warn");
    reasons.push("Precipitação intensa/impactante (ex.: +RA/GR).");
  }
  if (wxRaw.includes("SN")) {
    bump("warn");
    reasons.push("Neve (SN) — atenção à operação.");
  }

  if (!reasons.length) reasons.push("Condições aparentes dentro do normal para operação, considerando apenas METAR.");

  const title = (level === "ok") ? "OK para operação (com cautela)"
    : (level === "warn") ? "Atenção"
    : "Não recomendado";

  return { level, title, reasons };
}

function renderMetarOps(decoded) {
  const el = document.getElementById("metarOps");
  if (!el) return;

  const a = assessMetarForDrone(decoded);

  el.innerHTML = "";

  const badge = document.createElement("div");
  badge.className = `badge ${a.level}`;
  badge.textContent = a.title;

  const hint = document.createElement("div");
  hint.style.fontSize = "12px";
  hint.style.color = "var(--muted)";
  hint.style.fontWeight = "900";
  hint.style.marginTop = "2px";
  hint.textContent = "Heurística simples (vento/vis/teto/fenômenos). Sempre verifique limites do seu drone e NOTAM/regras locais.";

  const ul = document.createElement("ul");
  a.reasons.forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    ul.appendChild(li);
  });

  el.appendChild(badge);
  el.appendChild(ul);
  el.appendChild(hint);
  el.style.display = "block";
}



function saveMetarStation() {
  const station = getChosenStation();
  if (!station) {
    metarMsg("Digite ou selecione um aeroporto para salvar.", true);
    return;
  }

  if (!metarStations.includes(station)) metarStations.push(station);

  // se não existir padrão ainda, define automático
  if (!defaultMetarStation) defaultMetarStation = station;

  saveAll();
  renderMetarControls();
  metarMsg(`Salvo: ${station}`);
}

function deleteMetarStation() {
  const sel = document.getElementById("metarSaved");
  const station = normalizeStationCode(sel?.value) || getChosenStation();
  if (!station) {
    metarMsg("Selecione um aeroporto salvo para excluir.", true);
    return;
  }

  if (!metarStations.includes(station)) {
    metarMsg("Esse aeroporto não está na sua lista.", true);
    return;
  }

  const ok = confirm(`Excluir "${station}" da lista de aeroportos salvos?`);
  if (!ok) return;

  metarStations = metarStations.filter(x => x !== station);

  if (defaultMetarStation === station) {
    defaultMetarStation = metarStations[0] || "";
  }

  saveAll();
  renderMetarControls();

  const resEl = document.getElementById("metarResult");
  if (resEl && metarState.lastStation === station) {
    resEl.style.display = "none";
    metarState.lastStation = "";
    metarState.lastText = "";
    metarState.lastFetchedAt = 0;
  }

  metarMsg(`Excluído: ${station}`);
}

function setMetarAsDefault() {
  const station = getChosenStation();
  if (!station) {
    metarMsg("Digite ou selecione um aeroporto para definir como padrão.", true);
    return;
  }

  if (!metarStations.includes(station)) metarStations.push(station);
  defaultMetarStation = station;

  saveAll();
  renderMetarControls();
  metarMsg(`Padrão definido: ${station}`);
}

function autoFetchDefaultMetarOnce() {
  if (metarState.didAutoFetch) return;
  metarState.didAutoFetch = true;

  if (defaultMetarStation) {
    // puxa logo que abrir a aba
    fetchMetar(false);
  }
}

function onOpenWeatherTab() {
  // ao abrir, tenta atualizar uma vez
  refreshWeather(false);
  renderMetarControls();
  autoFetchDefaultMetarOnce();
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
  bindEditModalOnce();
  bindEditModalOnce();
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


/* =======================
   PWA: registra Service Worker
======================= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
