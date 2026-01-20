let flights = JSON.parse(localStorage.getItem("flights")) || [];
let drones = JSON.parse(localStorage.getItem("drones")) || [];
let sarpasList = JSON.parse(localStorage.getItem("sarpasList")) || [];
let locations = JSON.parse(localStorage.getItem("locations")) || [];

function addFlight() {
  const date = document.getElementById("date").value;
  const duration = parseInt(document.getElementById("duration").value);
  const flightsCount = parseInt(document.getElementById("flightsCount").value) || 1;

  const selectedDrone = document.getElementById("drone").value;
  const newDrone = document.getElementById("newDrone").value.trim();
  const drone = newDrone || selectedDrone;

  const selectedSarpas = document.getElementById("sarpas").value;
  const newSarpas = document.getElementById("newSarpas").value.trim();
  const sarpas = newSarpas || selectedSarpas;

  const selectedLocation = document.getElementById("location").value;
  const newLocation = document.getElementById("newLocation").value.trim();
  const location = newLocation || selectedLocation;

  const notes = document.getElementById("notes").value;

  if (!date || !duration || !drone || !sarpas) {
    alert("Preencha data, duração, drone e SARPAS");
    return;
  }

  if (newDrone && !drones.includes(newDrone)) {
    drones.push(newDrone);
    localStorage.setItem("drones", JSON.stringify(drones));
  }

  if (newSarpas && !sarpasList.includes(newSarpas)) {
    sarpasList.push(newSarpas);
    localStorage.setItem("sarpasList", JSON.stringify(sarpasList));
  }

  if (newLocation && !locations.includes(newLocation)) {
    locations.push(newLocation);
    localStorage.setItem("locations", JSON.stringify(locations));
  }

  flights.push({
    date,
    duration,
    flightsCount,
    drone,
    sarpas,
    location,
    notes
  });

  localStorage.setItem("flights", JSON.stringify(flights));

  document.getElementById("newDrone").value = "";
  document.getElementById("newSarpas").value = "";
  document.getElementById("newLocation").value = "";

  render();
}

function render() {
  renderSelect("drone", drones, "Selecione o drone");
  renderSelect("sarpas", sarpasList, "Selecione o SARPAS");
  renderSelect("location", locations, "Selecione o local");
  renderFlights();
  renderSummary();
  renderSarpasManager();
}

function renderSelect(id, list, placeholder) {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  list.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

function renderFlights() {
  const list = document.getElementById("flightList");
  list.innerHTML = "";

  flights.forEach((f, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${f.drone}</strong><br>
      Data: ${f.date}<br>
      Duração: ${f.duration} min<br>
      Nº de Voos: ${f.flightsCount}<br>
      Local: ${f.location || "-"}<br>
      SARPAS: ${f.sarpas}<br>
      <button onclick="deleteFlight(${i})">Excluir</button>
    `;
    list.appendChild(li);
  });
}

function renderSummary() {
  const summary = document.getElementById("summary");

  let totalMinutes = 0;
  let totalFlights = 0;

  flights.forEach(f => {
    totalMinutes += f.duration;
    totalFlights += f.flightsCount;
  });

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  summary.innerText = `Total: ${h}h ${m}min | Nº de Voos: ${totalFlights}`;
}

function renderSarpasManager() {
  const container = document.getElementById("sarpasManager");
  if (!container) return;

  container.innerHTML = "<h3>SARPAS cadastrados</h3>";

  sarpasList.forEach((s, i) => {
    const div = document.createElement("div");
    div.innerHTML = `
      ${s}
      <button onclick="deleteSarpas(${i})">Excluir</button>
    `;
    container.appendChild(div);
  });
}

function deleteFlight(i) {
  flights.splice(i, 1);
  localStorage.setItem("flights", JSON.stringify(flights));
  render();
}

function deleteSarpas(i) {
  if (!confirm("Excluir este SARPAS?")) return;
  sarpasList.splice(i, 1);
  localStorage.setItem("sarpasList", JSON.stringify(sarpasList));
  render();
}

function exportCSV() {
  let csv = "Data,Drone,Duração(min),Nº de Voos,Local,SARPAS,Observações\n";
  flights.forEach(f => {
    csv += `${f.date},${f.drone},${f.duration},${f.flightsCount},${f.location || ""},${f.sarpas},${f.notes || ""}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "logbook-drone.csv";
  a.click();
}

render();
