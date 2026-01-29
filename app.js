let flights = JSON.parse(localStorage.getItem("flights")) || [];
let drones = JSON.parse(localStorage.getItem("drones")) || [];
let locations = JSON.parse(localStorage.getItem("locations")) || [];
let sarpasList = JSON.parse(localStorage.getItem("sarpas")) || [];

let pilot = JSON.parse(localStorage.getItem("pilot")) || {
  name: "",
  cpf: "",
  sarpas: ""
};

function saveAll() {
  localStorage.setItem("flights", JSON.stringify(flights));
  localStorage.setItem("drones", JSON.stringify(drones));
  localStorage.setItem("locations", JSON.stringify(locations));
  localStorage.setItem("sarpas", JSON.stringify(sarpasList));
  localStorage.setItem("pilot", JSON.stringify(pilot));
}

/* MIGRAÇÃO flightsCount */
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

/* TOGGLE OPERADOR */
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

  const name = (pilot?.name || "").trim();
  const shortName = name ? ` (${name})` : "";

  btn.textContent = isOpen ? `✖ Fechar dados do operador${shortName}` : `👤 Dados do operador${shortName}`;
}

/* OPERADOR */
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

/* LOGBOOK */
function addFlight() {
  const date = document.getElementById("date").value;
  const flightsNum = Number(document.getElementById("flightsCount").value) || 1;
  const duration = parseInt(document.getElementById("duration").value, 10);

  const newDrone = document.getElementById("newDrone").value.trim();
  const newLocation = document.getElementById("newLocation").value.trim();
  const newSarpas = document.getElementById("newSarpas").value.trim();

  const drone = newDrone || document.getElementById("drone").value;
  const location = newLocation || document.getElementById("location").value;
  const sarpas = newSarpas || document.getElementById("sarpas").value;

  const notes = document.getElementById("notes").value;

  if (!date || !duration || !drone) {
    alert("Preencha data, duração e drone");
    return;
  }

  if (newDrone && !drones.includes(newDrone)) drones.push(newDrone);
  if (newLocation && !locations.includes(newLocation)) locations.push(newLocation);
  if (newSarpas && !sarpasList.includes(newSarpas)) sarpasList.push(newSarpas);

  flights.push({
    date,
    flightsCount: Math.max(1, Math.floor(flightsNum)),
    duration,
    drone,
    location,
    sarpas,
    notes
  });

  saveAll();
  clearForm();
  render();
}

/* OPERAÇÃO */
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
}

function renderOperationSarpasSelect() {
  const sel = document.getElementById("opSarpas");
  if (!sel) return;

  sel.innerHTML = "";

  if (!sarpasList.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhum SARPAS cadastrado (opcional)";
    sel.appendChild(opt);
    sel.disabled = true;
    return;
  }

  sel.disabled = false;

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Selecione o SARPAS (opcional)";
  sel.appendChild(opt0);

  sarpasList.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    sel.appendChild(opt);
  });
}

function showOpMessage(text) {
  const el = document.getElementById("opMsg");
  if (!el) return;
  el.style.display = "block";
  el.textContent = text;
  setTimeout(() => { el.style.display = "none"; }, 3500);
}

function startOperation() {
  const drone = document.getElementById("opDrone")?.value || "";
  if (!drone) {
    alert("Selecione um drone para iniciar o voo");
    return;
  }
  if (opInterval) return;

  opStartMs = Date.now();

  const idle = document.getElementById("opIdleBox");
  const run = document.getElementById("opRunningBox");
  if (idle) idle.style.display = "none";
  if (run) run.style.display = "block";

  const timerEl = document.getElementById("opTimer");
  if (timerEl) timerEl.textContent = "00:00:00";

  opInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - opStartMs) / 1000);
    if (timerEl) timerEl.textContent = formatHHMMSS(elapsedSec);
  }, 250);
}

function endOperation() {
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

  flights.push({
    date: todayISO(),
    flightsCount: 1,
    duration: minutes,
    drone,
    location: "",
    sarpas: sarpasSelected,
    notes: ""
  });

  if (!drones.includes(drone)) drones.push(drone);

  saveAll();
  render();

  resetOperationUI();
  showOpMessage(`Voo registrado: ${minutes} min • 1 voo${sarpasSelected ? " • SARPAS OK" : ""}`);
}

function resetOperationUI() {
  const idle = document.getElementById("opIdleBox");
  const run = document.getElementById("opRunningBox");
  if (idle) idle.style.display = "block";
  if (run) run.style.display = "none";

  const timerEl = document.getElementById("opTimer");
  if (timerEl) timerEl.textContent = "00:00:00";
}

/* DASHBOARD */
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

/* CADASTROS/RELATÓRIOS (iguais) */
function renderHoursByDrone() {
  const ul = document.getElementById("hoursByDrone");
  if (!ul) return;

  ul.innerHTML = "";
  const totals = {};

  flights.forEach(f => {
    const d = f?.drone || "-";
    totals[d] = (totals[d] || 0) + (Number(f.duration) || 0);
  });

  Object.keys(totals).forEach(drone => {
    const min = totals[drone];
    const h = Math.floor(min / 60);
    const m = min % 60;

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${drone}</strong> → ${h}h ${m}min
      <button class="small-btn" onclick="deleteDroneHistory('${drone}')">Excluir</button>
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
  if (type === "drone") drones.splice(index, 1);
  if (type === "location") locations.splice(index, 1);
  if (type === "sarpas") sarpasList.splice(index, 1);
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

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${f.drone || "-"}</strong><br>
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
  loadPilot();
  renderSummary();
  renderHoursByDrone();
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

  renderFlights();

  renderOperationDroneSelect();
  renderOperationSarpasSelect();

  togglePilotBox(false);
}

/* INIT */
migrateFlightsCount();
render();
showTab("logbook");



