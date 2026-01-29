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

/* =======================
   MIGRAÇÃO: PADRONIZA flightsCount
   - converte registros antigos (flights / flightsNum) para flightsCount
======================= */
function migrateFlightsCount() {
  let changed = false;

  flights = flights.map(f => {
    if (!f || typeof f !== "object") return f;

    const legacy =
      f.flightsCount ??
      f.flights ??
      f.flightsNum ??
      1;

    const n = Number(legacy);
    const flightsCount = (Number.isFinite(n) && n > 0) ? n : 1;

    // se tinha campo antigo, migra
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
   OPERADOR
======================= */
function savePilot() {
  pilot.name = document.getElementById("pilotName").value;
  pilot.cpf = document.getElementById("pilotCPF").value;
  pilot.sarpas = document.getElementById("pilotSarpas").value;
  saveAll();
  alert("Dados do operador salvos");
}

function loadPilot() {
  document.getElementById("pilotName").value = pilot.name || "";
  document.getElementById("pilotCPF").value = pilot.cpf || "";
  document.getElementById("pilotSarpas").value = pilot.sarpas || "";
}

/* =======================
   ADICIONAR VOO
======================= */
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

/* =======================
   RESUMO
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

  // mês atual
  const now = new Date();
  const curY = now.getFullYear();
  const curM = String(now.getMonth() + 1).padStart(2, "0"); // 01..12

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

  // mantém o summary antigo (oculto, mas útil pra compatibilidade)
  const summary = document.getElementById("summary");
  if (summary) summary.innerText = `Total: ${toHM(totalMinutes)} | Nº de Voos: ${totalFlights}`;

  // atualiza os cards
  const elTotalHours = document.getElementById("dashTotalHours");
  const elTotalFlights = document.getElementById("dashTotalFlights");
  const elThisMonth = document.getElementById("dashThisMonth");

  if (elTotalHours) elTotalHours.textContent = toHM(totalMinutes);
  if (elTotalFlights) elTotalFlights.textContent = String(totalFlights);
  if (elThisMonth) elThisMonth.textContent = `${toHM(monthMinutes)} • ${monthFlights} voos`;

  // ===== Último voo (mais recente por data) =====
  const elLast = document.getElementById("dashLastFlight");
  if (elLast) {
    let last = null;

    flights.forEach(f => {
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

/* =======================
   HORAS POR DRONE
======================= */
function renderHoursByDrone() {
  const ul = document.getElementById("hoursByDrone");
  ul.innerHTML = "";

  const totals = {};
  flights.forEach(f => {
    totals[f.drone] = (totals[f.drone] || 0) + (Number(f.duration) || 0);
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
  if (!confirm(`Excluir TODOS


