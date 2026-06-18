const trailColors = [
  ["white", "White", "ffffffff"],
  ["red", "Red", "ff0000ff"],
  ["green", "Green", "ff008000"],
  ["lime", "Lime", "ff00ff00"],
  ["blue", "Blue", "ffff0000"],
  ["yellow", "Yellow", "ff00ffff"],
  ["cyan", "Cyan", "ffffff00"],
  ["magenta", "Magenta", "ffff00ff"],
  ["silver", "Silver", "ffc0c0c0"],
  ["gray", "Gray", "ff808080"],
  ["maroon", "Maroon", "ff000080"],
  ["olive", "Olive", "ff008080"],
  ["purple", "Purple", "ff800080"],
  ["teal", "Teal", "ff808000"],
  ["navy", "Navy", "ff800000"],
  ["orange", "Orange", "ff00a5ff"],
  ["skyblue", "Skyblue", "ffebce87"]
];

const kmPresets = [1, 2, 5, 10, 15, 20];

let lineStrings = [];
let selectedLines = new Set();
let selectedIntervalKm = 1;
let placemarkPrefix = "";
let selectedTrailColor = "blue";
let lineWidthText = "2";

const elements = {
  fileInput: document.getElementById("fileInput"),
  openFileButton:  document.getElementById('openFileButton'),
  statusText: document.getElementById("statusText"),
  intervalChips: document.getElementById("intervalChips"),
  placemarkPrefix: document.getElementById("placemarkPrefix"),
  trailColor: document.getElementById("trailColor"),
  lineWidth: document.getElementById("lineWidth"),
  lineList: document.getElementById("lineList"),
  selectionCount: document.getElementById("selectionCount"),
  generatePlacemarksButton: document.getElementById("generatePlacemarksButton"),
  reverseLineButton: document.getElementById("reverseLineButton"),
  concatenateButton: document.getElementById("concatenateButton"),
  exportButton: document.getElementById("exportButton")
};

function makeLineString(name, coordinates) {
  return {
    id: name,
    name,
    coordinates
  };
}

function init() {
  renderIntervalChips();
  renderColorPicker();
  renderLineList();
  updateActionStates();

  elements.openFileButton.addEventListener('click', () => {
    fileInput?.click();
  });
  
  elements.fileInput.addEventListener("change", event => {
    const file = event.target.files[0];
    if (file) {
      loadKML(file);
    }
  });

  elements.placemarkPrefix.addEventListener("input", event => {
    placemarkPrefix = event.target.value;
  });

  elements.trailColor.addEventListener("change", event => {
    selectedTrailColor = event.target.value;
  });

  elements.lineWidth.addEventListener("input", event => {
    lineWidthText = event.target.value;
  });

  elements.generatePlacemarksButton.addEventListener("click", () => {
    const firstID = selectedLines.values().next().value;
    const first = lineStrings.find(line => line.id === firstID);
    if (first) {
      generatePlacemarks(first);
    }
  });

  elements.reverseLineButton.addEventListener("click", () => {
    reverseSelectedLine();
  });

  elements.concatenateButton.addEventListener("click", () => {
    concatenateTrails();
  });

  elements.exportButton.addEventListener("click", () => {
    exportToKML();
  });
}

function renderIntervalChips() {
  elements.intervalChips.replaceChildren();

  kmPresets.forEach(km => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${selectedIntervalKm === km ? " selected" : ""}`;
    button.textContent = `${km} km`;
    button.addEventListener("click", () => {
      selectedIntervalKm = km;
      renderIntervalChips();
    });
    elements.intervalChips.append(button);
  });
}

function renderColorPicker() {
  elements.trailColor.replaceChildren();

  trailColors.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selectedTrailColor;
    elements.trailColor.append(option);
  });
}

function renderLineList() {
  elements.lineList.replaceChildren();
  elements.selectionCount.textContent = `${selectedLines.size} selecionada${selectedLines.size === 1 ? "" : "s"}`;

  if (lineStrings.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Abra um arquivo KML para listar as trilhas.";
    elements.lineList.append(empty);
    updateActionStates();
    return;
  }

  lineStrings.forEach(line => {
    const row = document.createElement("div");
    row.className = "line-item";

    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = `line-name${selectedLines.has(line.id) ? " selected" : ""}`;
    nameButton.textContent = line.name;
    nameButton.addEventListener("click", () => toggleSelection(line));

    const moveButtons = document.createElement("div");
    moveButtons.className = "move-buttons";

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.textContent = "↑";
    upButton.setAttribute("aria-label", `Mover ${line.name} para cima`);
    upButton.addEventListener("click", () => moveLineUp(line));

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.textContent = "↓";
    downButton.setAttribute("aria-label", `Mover ${line.name} para baixo`);
    downButton.addEventListener("click", () => moveLineDown(line));

    moveButtons.append(upButton, downButton);
    row.append(nameButton, moveButtons);
    elements.lineList.append(row);
  });

  updateActionStates();
}

function updateActionStates() {
  const selectedCount = selectedLines.size;

  elements.generatePlacemarksButton.disabled = selectedCount !== 1;
  elements.reverseLineButton.disabled = selectedCount !== 1;
  elements.concatenateButton.disabled = selectedCount < 2;
  elements.exportButton.disabled = selectedCount !== 1;
}

function loadKML(file) {
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    parseKML(String(reader.result || ""));
    elements.statusText.textContent = `${file.name}: ${lineStrings.length} trilha${lineStrings.length === 1 ? "" : "s"} carregada${lineStrings.length === 1 ? "" : "s"}.`;
  });

  reader.addEventListener("error", () => {
    elements.statusText.textContent = "Não foi possível abrir o arquivo.";
  });

  reader.readAsText(file);
}

function parseKML(kmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(kmlText, "text/xml");

  if (xml.querySelector("parsererror")) {
    elements.statusText.textContent = "O XML do arquivo KML não pôde ser lido.";
    return;
  }

  lineStrings = [];
  selectedLines.clear();

  const placemarks = xmlElements(xml, "Placemark");

  placemarks.forEach((placemark, index) => {
    const lineString = xmlElements(placemark, "LineString")[0];
    const coordinatesNode = lineString ? xmlElements(lineString, "coordinates")[0] : null;

    if (!coordinatesNode) {
      return;
    }

    const nameNode = xmlElements(placemark, "name")[0];
    const name = nameNode?.textContent?.trim() || `Linha ${index + 1}`;
    const coordString = coordinatesNode.textContent || "";

    const coordinates = coordString
      .replace(/\n/g, " ")
      .split(" ")
      .map(str => str.trim())
      .filter(Boolean)
      .map(str => {
        const parts = str.split(",").map(Number);
        if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          return { latitude: parts[1], longitude: parts[0] };
        }
        return null;
      })
      .filter(Boolean);

    lineStrings.push(makeLineString(name, coordinates));
  });

  renderLineList();
}

function toggleSelection(line) {
  if (selectedLines.has(line.id)) {
    selectedLines.delete(line.id);
  } else {
    selectedLines.add(line.id);
  }

  renderLineList();
}

function moveLineUp(line) {
  const i = lineStrings.findIndex(item => item.id === line.id);
  if (i > 0) {
    [lineStrings[i], lineStrings[i - 1]] = [lineStrings[i - 1], lineStrings[i]];
    renderLineList();
  }
}

function moveLineDown(line) {
  const i = lineStrings.findIndex(item => item.id === line.id);
  if (i >= 0 && i < lineStrings.length - 1) {
    [lineStrings[i], lineStrings[i + 1]] = [lineStrings[i + 1], lineStrings[i]];
    renderLineList();
  }
}

function firstSelectedLineForAction() {
  const firstID = selectedLines.values().next().value;
  return lineStrings.find(line => line.id === firstID);
}

function reverseSelectedLine() {
  const line = firstSelectedLineForAction();
  if (!line || selectedLines.size !== 1) return;

  const newName = uniqueTrailName(`${line.name} (invertida)`);
  const reversedCoordinates = line.coordinates.slice().reverse();

  lineStrings.push(
    makeLineString(newName, reversedCoordinates)
  );

  renderLineList();
}

function concatenateTrails() {
  const selectedTrails = lineStrings.filter(line => selectedLines.has(line.id));
  if (selectedTrails.length <= 1) return;

  const concatenated = [...selectedTrails[0].coordinates];

  for (let i = 1; i < selectedTrails.length; i += 1) {
    const previous = concatenated[concatenated.length - 1];
    const currentFirst = selectedTrails[i].coordinates[0];
    const currentLast = selectedTrails[i].coordinates[selectedTrails[i].coordinates.length - 1];

    if (distance(previous, currentFirst) < distance(previous, currentLast)) {
      concatenated.push(...selectedTrails[i].coordinates);
    } else {
      concatenated.push(...selectedTrails[i].coordinates.slice().reverse());
    }
  }

  const newName = uniqueConcatenatedName();

  lineStrings.push(
    makeLineString(newName, concatenated)
  );

  renderLineList();
}

function generatePlacemarks(line) {
  const intervalMeters = selectedIntervalKm * 1000;

  const placemarks = [];
  let distanceCovered = 0;
  let currentKm = 0;

  const firstPoint = line.coordinates[0];
  if (!firstPoint) return;

  placemarks.push([`${placemarkPrefix}000`, firstPoint]);
  let previousPoint = firstPoint;

  for (let i = 1; i < line.coordinates.length; i += 1) {
    const currentPoint = line.coordinates[i];
    let segmentDistance = distance(previousPoint, currentPoint);

    while (distanceCovered + segmentDistance >= intervalMeters) {
      const remaining = intervalMeters - distanceCovered;
      const fraction = remaining / segmentDistance;

      const newPoint = interpolate(previousPoint, currentPoint, fraction);

      currentKm += 1;
      placemarks.push([
        `${placemarkPrefix}${String(currentKm).padStart(3, "0")}`,
        newPoint
      ]);

      previousPoint = newPoint;
      segmentDistance -= remaining;
      distanceCovered = 0;
    }

    distanceCovered += segmentDistance;
    previousPoint = currentPoint;
  }

  const lastPoint = line.coordinates[line.coordinates.length - 1];
  if (lastPoint) {
    placemarks.push([`${placemarkPrefix}FIM`, lastPoint]);
  }

  savePlacemarksToKML(placemarks);
  
  sendTrailInfo(line);
}

function exportToKML() {
  const width = Number(lineWidthText);
  if (!Number.isFinite(width)) return;

  let kml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  kml += "<kml xmlns=\"http://www.opengis.net/kml/2.2\">\n";
  kml += "<Document>\n";

  kml += `
<Style id="exportLineStyle">
<LineStyle>
<color>${getSelectedKMLColor()}</color>
<width>${width}</width>
</LineStyle>
</Style>
`;

  lineStrings.filter(line => selectedLines.has(line.id)).forEach(line => {
    kml += "<Placemark>";
    kml += "<styleUrl>#exportLineStyle</styleUrl>";
    kml += `<name>${escapeXml(line.name)}</name>`;
    kml += "<LineString><coordinates>";

    line.coordinates.forEach(coord => {
      kml += `${coord.longitude},${coord.latitude} `;
    });

    kml += "</coordinates></LineString></Placemark>\n";
  });

  kml += "</Document></kml>";

  downloadTextFile(kml, "export.kml", "application/vnd.google-earth.kml+xml");
  
}

function uniqueConcatenatedName(base = "Trilha Concatenada") {
  return uniqueTrailName(base);
}

function uniqueTrailName(base) {
  const existingNames = new Set(lineStrings.map(line => line.name));

  if (!existingNames.has(base)) {
    return base;
  }

  let index = 1;
  while (existingNames.has(`${base} ${index}`)) {
    index += 1;
  }

  return `${base} ${index}`;
}

function savePlacemarksToKML(placemarks) {
  let kml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
  kml += "<kml xmlns=\"http://www.opengis.net/kml/2.2\">\n";
  kml += "<Document><Folder><name>Pontos</name>\n";

  placemarks.forEach(p => {
    kml += `
<Placemark>
<name>${escapeXml(p[0])}</name>
<Point><coordinates>${p[1].longitude},${p[1].latitude}</coordinates></Point>
</Placemark>
`;
  });

  kml += "</Folder></Document></kml>";

  downloadTextFile(kml, "placemarks.kml", "application/vnd.google-earth.kml+xml");
}

function distance(coordinateA, coordinateB) {
  const earthRadius = 6371000;
  const lat1 = toRadians(coordinateA.latitude);
  const lat2 = toRadians(coordinateB.latitude);
  const deltaLat = toRadians(coordinateB.latitude - coordinateA.latitude);
  const deltaLon = toRadians(coordinateB.longitude - coordinateA.longitude);

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function interpolate(coordinateA, coordinateB, fraction) {
  return {
    latitude: coordinateA.latitude + (coordinateB.latitude - coordinateA.latitude) * fraction,
    longitude: coordinateA.longitude + (coordinateB.longitude - coordinateA.longitude) * fraction
  };
}

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

function xmlElements(parent, tagName) {
  return Array.from(parent.getElementsByTagName(tagName));
}

function getSelectedKMLColor() {
  return trailColors.find(([value]) => value === selectedTrailColor)?.[2] || "ffff0000";
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function downloadTextFile(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function sendTrailInfo(line) {
    if (!line || !line.coordinates || line.coordinates.length < 2) {
        return;
    }
    const firstPoint = line.coordinates[0];
    const lastPoint = line.coordinates[line.coordinates.length - 1];
    const payload = {
        trilha: line.name,
        inicio_lat: firstPoint.latitude,
        inicio_lon: firstPoint.longitude,
        fim_lat: lastPoint.latitude,
        fim_lon: lastPoint.longitude
    };
    try {
        const response = await fetch(
            "https://formspree.io/f/xnjykdae",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(payload)
            }
        }
}

window.__kmlTrailTools = {
  parseKML,
  concatenateTrails,
  distance,
  interpolate,
  selectLine(id) {
    selectedLines.add(id);
    renderLineList();
  },
  state() {
    return {
      lineStrings: lineStrings.map(line => ({
        id: line.id,
        name: line.name,
        coordinates: line.coordinates
      })),
      selectedLines: Array.from(selectedLines),
      selectedIntervalKm,
      placemarkPrefix,
      selectedTrailColor,
      lineWidthText,
      lineWidthText
    };
  }
};

init();
