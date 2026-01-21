let flights = JSON.parse(localStorage.getItem("flights")) || [];
let drones = JSON.parse(localStorage.getItem("drones")) || [];
let locations = JSON.parse(localStorage.getItem("locations")) || [];
let sarpasList = JSON.parse(localStorage.getItem("sarpas")) || [];

function saveAll() {
  localStorage.setItem("flights", JSON.stringify(flights));
  localStorage.setItem("drones", JSON.stringify(drones));
  localStorage.setItem("locations", JSON.stringify(locations));
  localStorage.setItem("sarpas", JSON.stringify(sarpasList));
}

function addFlight() {
  const date = document.getElementById("date").value;
  const flightsCount = parseInt(document.getElementById("flightsCount").value);
  const duration = parseInt(document.getElementById("duration").value);

  const drone =
    document.getElementById("newDrone").value.trim() ||
    document.getElementById("drone").value;

  const location =
    document.getElementById("newLocation").value.trim() ||
    document.getElementById("location").value;

  const sarpas =
    document.getElementById("newSarpas").value.trim() ||
    document.getElementById("sarpas").value;

  const notes = document.getElementById("notes").value;

  if (!date || !flightsCount || !duration || !drone) {
    alert("Preencha data, nº de voos, duração e drone");
    return;
  }

  if (document.getElementById("newDrone").value && !drones.includes(drone)) drones.push(drone);
  if (document.getElementById("newLocation").value && !locations.includes(location)) locations.push(location);
  if (document.getElementById("newSarpas").value && !sarpasList.includes(sarpas)) sarpasList.push(sarpas);

  flights.push({ date, flightsCount, duration, drone, location, sarpas, notes });

  saveAll();
  clearForm();
  render();
}

function deleteFlight(index) {
  flights.splice(index, 1);
  saveAll();
  render();
}

function deleteDroneHistory(droneName) {
  if (!confirm(`Excluir TODO o histórico do drone "${droneName}"?`)) return;
  flights = flights.filter(f => f.drone !== droneName);
  saveAll();
  render();
}

function renderSummary() {
  let totalMinutes = 0;
  let totalFlights = 0;

  flights.forEach(f => {
    totalMinutes += f.duration;
    totalFlights += f.flightsCount;
  });

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  document.getElementById("summary").innerText =
    `Total: ${h}h ${m}min | Nº de Voos: ${totalFlights}`;
}

function renderHoursByDrone() {
  const ul = document.getElementById("hoursByDrone");
  ul.innerHTML = "";

  const totals = {};

  flights.forEach(f => {
    totals[f.drone] = (totals[f.drone] || 0) + f.duration;
  });

  Object.keys(totals).forEach(drone => {
    const minutes = totals[drone];
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${drone}</strong> → ${h}h ${m}min
      <button class="small-btn" onclick="deleteDroneHistory('${drone}')">
        Excluir
      </button>
    `;
    ul.appendChild(li);
  });
}

function fillSelect(el, list) {
  el.innerHTML = "<option value=''>Selecione</option>";
  list.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    el.appendChild(opt);
  });
}

function renderLists() {
  renderManage("droneList", drones, "drone");
  renderManage("locationList", locations, "location");
  renderManage("sarpasList", sarpasList, "sarpas");
}

function renderManage(id, list, type) {
  const ul = document.getElementById(id);
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
  list.innerHTML = "";

  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${f.drone}</strong><br>
      Data: ${f.date}<br>
      Nº de Voos: ${f.flightsCount}<br>
      Duração: ${f.duration} min<br>
      Local: ${f.location || "-"}<br>
      SARPAS: ${f.sarpas || "-"}<br>
      ${f.notes || ""}
      <br>
      <button onclick="deleteFlight(${i})">Excluir voo</button>
    `;
    list.appendChild(li);
  }
}

function clearForm() {
  document.getElementById("duration").value = "";
  document.getElementById("notes").value = "";
  document.getElementById("newDrone").value = "";
  document.getElementById("newLocation").value = "";
  document.getElementById("newSarpas").value = "";
}

function exportCSV() {
  let csv = "Data,Drone,Nº de Voos,Duração,Local,SARPAS,Observações\n";
  flights.forEach(f => {
    csv += `${f.date},${f.drone},${f.flightsCount},${f.duration},${f.location || ""},${f.sarpas || ""},${f.notes || ""}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "logbook-drone.csv";
  a.click();
}

function render() {
  renderSummary();
  renderHoursByDrone();
  fillSelect(document.getElementById("drone"), drones);
  fillSelect(document.getElementById("location"), locations);
  fillSelect(document.getElementById("sarpas"), sarpasList);
  renderLists();
  renderFlights();
}

render();
