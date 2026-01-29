// =======================
// STORAGE
// =======================
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

// =======================
// MIGRAÇÃO (PADRONIZA flightsCount)
// =======================
function migrateFlights() {
  let changed = false;

  flights = (flights || []).map((f) => {
    if (!f || typeof f !== "object") return f;

    // detecta campos antigos
    const legacy =
      f.flightsCount ??
      f.flights ??
      f.flightsNum ??
      1;

    const n = Number(legacy);
    const flightsCount = Number.isFinite(n) && n > 0 ? n : 1;

    // se já estava ok, mantém
    if (f.flightsCount !== flightsCount || "flights" in f || "flightsNum" in f) {
      changed = true;
      const nf = { ...f, flightsCount };
      // remove campos antigos pra evitar confusão
      delete nf.flights;
      delete nf.flightsNum;
      return nf;
    }

    return f;
  });

  if (changed) saveAll();
}

// =======================
// OPERADOR
// =======================
function savePilot() {
  pilot.name = document.getElementById("pilotName").value.trim();
  pilot.cpf = document.getElementById("pilotCPF").value.trim();
  pilot.sarpas = document.getElementById("pilotSarpas").value.trim();
  saveAll();
  alert("Dados do operador salvos");
}

function loadPilot() {
  document.getElementById("pilotName").value = pilot.name || "";
  document.getElementById("pilotCPF").value = pilot.cpf || "";
  document.getElementById("pilotSarpas").value = pilot.sarpas || "";
}

// =======================
// HELPERS
// =======================
function toHM(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}min`;
}

function getMinutes(f) {
  return Number(f?.duration) || 0;
}

function getFlightsCount(f) {
  const n = Number(f?.flightsCount);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// =======================
// RESUMO (DASHBOARD)
// =======================
function renderSummary() {
  let totalMinutes = 0;
  let totalFlights = 0;

  // mês atual
  const now = new Date();
  const curY = now.getFullYear();
  const curM = String(now.getMonth() + 1).padStart(2, "0");

  let monthMinutes = 0;
  let monthFlights = 0;

  flights.forEach((f) => {
    const mins = getMinutes(f);
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

  // summary oculto (compatibilidade)
  const summary = document.getElementById("summary");
  if (summary) summary.innerText = `Total: ${toHM(totalMinutes)} | Nº de Voos: ${totalFlights}`;

  // cards
  const elTotalHours = document.getElementById("dashTotalHours");
  const elTotalFlights = document.getElementById("dashTotalFlights");
  const elThisMonth = document.getElementById("dashThisMonth");

  if (elTotalHours) elTotalHours.textContent = toHM(totalMinutes);
  if (elTotalFlights) elTotalFlights.textContent = String(totalFlights);
  if (elThisMonth) elThisMonth.textContent = `${toHM(monthMinutes)} • ${monthFlights} voos`;

  // Último voo (mais recente por data)
  const elLast = document.getElementById("dashLastFlight");
  if (elLast) {
    let last = null;

    flights.forEach((f) => {
      if (!f || !f.date) return;
      if (!last || String(f.date) > String(last.date)) last = f;
    });

    if (!last) {
      elLast.textContent = "—";
    } else {
      const d = last.date || "";
      const drone = last.drone || "—";
      const mins = Number(last.duration) || 0;
      const flts = getFlightsCount(last);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      elLast.textContent = `${d} • ${drone} • ${h}h ${m}min • ${flts} voo(s)`;
    }
  }
}

// =======================
// ADICIONAR VOO
// =======================
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

  const notes = document.getElementById("notes").value.trim();

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
  alert("Voo salvo ✅");
}

function clearForm() {
  document.getElementById("duration").value = "";
  document.getElementById("notes").value = "";
  document.getElementById("newDrone").value = "";
  document.getElementById("newLocation").value = "";
  document.getElementById("newSarpas").value = "";
  document.getElementById("flightsCount").value = "";
}

// =======================
// HORAS POR DRONE
// =======================
function renderHoursByDrone() {
  const ul = document.getElementById("hoursByDrone");
  if (!ul) return;

  ul.innerHTML = "";

  const totals = {};
  flights.forEach((f) => {
    const d = f?.drone || "—";
    totals[d] = (totals[d] || 0) + (Number(f?.duration) || 0);
  });

  Object.keys(totals).forEach((drone) => {
    const min = totals[drone];
    const h = Math.floor(min / 60);
    const m = min % 60;

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${drone}</strong> → ${h}h ${m}min
      <button class="small-btn" onclick="deleteDroneHistory('${drone.replace(/'/g, "\\'")}')">Excluir</button>
    `;
    ul.appendChild(li);
  });
}

function deleteDroneHistory(droneName) {
  if (!confirm(`Excluir TODOS os voos do drone "${droneName}"?`)) return;
  flights = flights.filter((f) => f.drone !== droneName);
  saveAll();
  render();
}

// =======================
// GERENCIAR CADASTROS
// =======================
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

// =======================
// HISTÓRICO + FILTROS
// =======================
function renderFlights() {
  const list = document.getElementById("flightList");
  if (!list) return;

  list.innerHTML = "";

  const fDate = document.getElementById("filterDate")?.value || "";
  const fDrone = document.getElementById("filterDrone")?.value || "";
  const fLocation = document.getElementById("filterLocation")?.value || "";
  const fSarpas = document.getElementById("filterSarpas")?.value || "";

  const filtered = flights.filter((f) =>
    (!fDate || f.date === fDate) &&
    (!fDrone || f.drone === fDrone) &&
    (!fLocation || (f.location || "") === fLocation) &&
    (!fSarpas || (f.sarpas || "") === fSarpas)
  );

  [...filtered].reverse().forEach((f) => {
    const i = flights.indexOf(f);
    const li = document.createElement("li");

    li.innerHTML = `
      <strong>${f.drone || "-"}</strong><br>
      Data: ${f.date || "-"}<br>
      Nº de Voos: ${getFlightsCount(f)}<br>
      Duração: ${Number(f.duration) || 0} min<br>
      Local: ${f.location || "-"}<br>
      SARPAS: ${f.sarpas || "-"}<br>
      ${f.notes ? `${f.notes}<br>` : ""}
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

  const newDuration = prompt("Duração total em minutos:", String(Number(f.duration) || 0));
  if (newDuration === null) return;

  const flightsNum = parseInt(newFlights, 10);
  const durationNum = parseInt(newDuration, 10);

  if (isNaN(flightsNum) || flightsNum <= 0 || isNaN(durationNum) || durationNum <= 0) {
    alert("Valores inválidos");
    return;
  }

  f.flightsCount = flightsNum;
  f.duration = durationNum;

  saveAll();
  render();
}

// =======================
// RELATÓRIO MENSAL
// =======================
function renderMonthlySummary() {
  const ul = document.getElementById("monthlySummary");
  if (!ul) return;

  ul.innerHTML = "";

  const byMonth = {};

  flights.forEach((f) => {
    if (!f?.date) return;

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
    .forEach((key) => {
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

function toggleHistory() {
  const box = document.getElementById("historyContainer");
  if (!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
}

// =======================
// SELECTS
// =======================
function fillSelect(el, list) {
  if (!el) return;
  el.innerHTML = "<option value=''>Selecione</option>";
  list.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    el.appendChild(opt);
  });
}

// =======================
// EXPORTAR CSV
// =======================
function exportCSV() {
  let csv = "Operador,CPF,SARPAS Operador\n";
  csv += `${pilot.name},${pilot.cpf},${pilot.sarpas}\n\n`;
  csv += "Data,Drone,Nº de Voos,Duração,Local,SARPAS,Observações\n";

  flights.forEach((f) => {
    csv += `${f.date},${f.drone},${getFlightsCount(f)},${f.duration},${f.location || ""},${f.sarpas || ""},${(f.notes || "").replace(/\n/g, " ")}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "logbook-drone.csv";
  a.click();
}

// =======================
// EXPORTAR PDF
// =======================
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  const pageHeight = doc.internal.pageSize.height;
  let y = 15;

  function header() {
    doc.setFontSize(12);
    doc.text("LOGBOOK DE VOO – RPA / DRONE", 105, 10, { align: "center" });
    doc.setFontSize(9);
    doc.text(
      `Piloto: ${pilot.name} | CPF: ${pilot.cpf} | SARPAS: ${pilot.sarpas}`,
      105,
      16,
      { align: "center" }
    );
    doc.line(10, 18, 200, 18);
  }

  function footer(text) {
    doc.setFontSize(8);
    doc.text(text, 105, pageHeight - 10, { align: "center" });
  }

  header();
  y = 25;

  // resumo geral
  let totalMinutes = 0;
  let totalFlights = 0;

  flights.forEach((f) => {
    totalMinutes += Number(f.duration) || 0;
    totalFlights += getFlightsCount(f);
  });

  doc.setFontSize(10);
  doc.text(`Resumo Geral: ${toHM(totalMinutes)} | ${totalFlights} voos`, 10, y);
  y += 10;

  // tabela
  doc.setFontSize(9);
  const headers = ["Data", "Drone", "Local", "SARPAS", "Duração", "Voos"];
  const colX = [10, 35, 75, 115, 150, 170];

  headers.forEach((h, i) => doc.text(h, colX[i], y));
  y += 4;
  doc.line(10, y, 200, y);
  y += 5;

  let pageMinutes = 0;
  let pageFlights = 0;

  flights.forEach((f) => {
    if (y > pageHeight - 25) {
      footer(`Total da página: ${toHM(pageMinutes)} | ${pageFlights} voos`);
      doc.addPage();
      header();
      y = 25;
      pageMinutes = 0;
      pageFlights = 0;
    }

    doc.text(f.date || "-", colX[0], y);
    doc.text(f.drone || "-", colX[1], y);
    doc.text(f.location || "-", colX[2], y);
    doc.text(f.sarpas || "-", colX[3], y);
    doc.text(`${Number(f.duration) || 0} min`, colX[4], y);
    doc.text(String(getFlightsCount(f)), colX[5], y);

    pageMinutes += Number(f.duration) || 0;
    pageFlights += getFlightsCount(f);

    y += 6;
  });

  footer(`Total da página: ${toHM(pageMinutes)} | ${pageFlights} voos`);

  // relatório mensal
  doc.addPage();
  header();
  y = 30;

  doc.setFontSize(11);
  doc.text("RELATÓRIO MENSAL", 10, y);
  y += 8;

  const byMonth = {};
  flights.forEach((f) => {
    if (!f?.date) return;
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
    .forEach((key) => {
      doc.text(`${key} → ${toHM(byMonth[key].minutes)} | ${byMonth[key].flights} voos`, 10, y);
      y += 6;
    });

  // declaração + assinatura
  y += 15;
  doc.setFontSize(10);
  doc.text(
    "Declaro que as informações acima são verdadeiras e correspondem aos voos realizados conforme o RBAC-E 94.",
    10,
    y
  );
  y += 15;

  doc.line(10, y, 90, y);
  y += 6;
  doc.text(`Assinatura do Piloto – ${pilot.name} | CPF ${pilot.cpf} | SARPAS ${pilot.sarpas}`, 10, y);

  doc.save("logbook-drone-anac-completo.pdf");
}

// =======================
// ABAS
// =======================
function showTab(tab) {
  document.querySelectorAll(".tab-content").forEach((div) => {
    div.style.display = "none";
  });

  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.classList.remove("active");
  });

  const content = document.getElementById(`tab-${tab}-content`);
  const button = document.getElementById(`tab-${tab}`);

  if (content) content.style.display = "block";
  if (button) button.classList.add("active");
}

// =======================
// RENDER GERAL
// =======================
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
}

// =======================
// INIT
// =======================
migrateFlights();
render();
showTab("logbook");

