const trailColors = [ 
    ["white", "White", "ffffffff"],
    ["red", "Red", "ff0000ff"],
    ["green", "Green", "ff008000"],
    ["lime", "Lime", "ff00ff00"],
    ["blue", "Blue", "ffff0000"],
    ["yellow", "Yellow", "ff00ffff"],
    ["cyan", "Cyan", "ffffff00"],
    ["magenta", "Magenta", "ffff00ff"],
    ["maroon", "Maroon", "ff000080"],
    ["olive", "Olive", "ff008080"],
    ["purple", "Purple", "ff800080"],
    ["teal", "Teal", "ff808000"],
    ["navy", "Navy", "ff800000"],
    ["orange", "Orange", "ff00a5ff"],
    ["skyblue", "Skyblue", "ffebce87"]
];

const kmPresets = [1, 2, 5, 10, 20];

let lineStrings = [];
let selectedLines = new Set();
let selectedIntervalKm = 1;
let placemarkPrefix = "";
let selectedTrailColor = "blue";
let lineWidthText = "2";

const elements = {
    fileInput: document.getElementById("fileInput"),
    openFileButton: document.getElementById('openFileButton'),
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
    exportButton: document.getElementById("exportButton"),
    viewMapButton: document.getElementById("viewMapButton")
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

    const shareRadio = document.querySelector('input[name="outputMode"][value="share"]');
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    shareRadio.disabled = !isMobile;

    /* if (!navigator.share || !navigator.canShare) {
        shareRadio.disabled = true;
    } */

    elements.viewMapButton.addEventListener("click", openMapPreview);

    elements.openFileButton.addEventListener('click', () => {
        elements.fileInput?.click();
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
    elements.viewMapButton.disabled = selectedCount !== 1;
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
                    return {
                        latitude: parts[1],
                        longitude: parts[0]
                    };
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

    exportPlacemarks(placemarks);

    sendTrailInfo(line);
}

function getSelectedExportFormat() {

    return document.querySelector('input[name="exportFormat"]:checked')?.value || "kml";
}

function getSelectedOutputMode() {

    return document.querySelector('input[name="outputMode"]:checked')?.value || "save";
}

async function exportPlacemarks(placemarks) {
    const format = getSelectedExportFormat();
    const outputMode = getSelectedOutputMode();

    let content;
    let filename;
    let mimeType;

    console.log("Formato:", getSelectedExportFormat());

    if (format === "gpx") {
        content = buildPlacemarksGPX(placemarks);
        filename = "placemarks.gpx";
        mimeType = "application/gpx+xml";
    } else {
        content = buildPlacemarksKML(placemarks);
        filename = "placemarks.kml";
        mimeType = "application/vnd.google-earth.kml+xml";
    }
    if (outputMode === "save") {
        downloadTextFile(content, filename, mimeType);
        return;
    }
    
    await shareTextFile(
        content,
        filename,
        mimeType
    );
}

function buildPlacemarksGPX(placemarks) {

    const GPX_NS = "http://www.topografix.com/GPX/1/1";
    const doc = document.implementation.createDocument(GPX_NS, "gpx", null);
    const gpx = doc.documentElement;

    gpx.setAttribute("version", "1.1");
    gpx.setAttribute("creator", "KML Trail Tools");

    placemarks.forEach(([name, coord]) => {

        const wpt = doc.createElementNS(GPX_NS, "wpt");

        wpt.setAttribute("lat", coord.latitude.toFixed(6));
        wpt.setAttribute("lon", coord.longitude.toFixed(6));

        const nameNode = doc.createElementNS(GPX_NS, "name");

        nameNode.textContent = name;
        wpt.appendChild(nameNode);
        gpx.appendChild(wpt);

        const descNode = doc.createElementNS(GPX_NS, "desc");

        descNode.textContent = name;
        wpt.appendChild(descNode);

    });

    return ('<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(doc));
}

function buildTracksKML(lines, width, color) {

    const doc = document.implementation.createDocument("http://www.opengis.net/kml/2.2", "kml", null);

    const documentNode = doc.createElement("Document");
    doc.documentElement.appendChild(documentNode);

    //
    // Style
    //

    const style = doc.createElement("Style");
    style.setAttribute("id", "exportLineStyle");

    const lineStyle = doc.createElement("LineStyle");

    const colorNode = doc.createElement("color");
    colorNode.textContent = color;

    const widthNode = doc.createElement("width");
    widthNode.textContent = width;

    lineStyle.appendChild(colorNode);
    lineStyle.appendChild(widthNode);

    style.appendChild(lineStyle);
    documentNode.appendChild(style);

    //
    // Trilhas
    //

    lines.forEach(line => {

        const placemark = doc.createElement("Placemark");

        const styleUrl = doc.createElement("styleUrl");
        styleUrl.textContent = "#exportLineStyle";

        const name = doc.createElement("name");
        name.textContent = line.name;

        const lineString = doc.createElement("LineString");

        const coordinates = doc.createElement("coordinates");

        coordinates.textContent = line.coordinates
            .map(coord => `${coord.longitude},${coord.latitude}`)
            .join(" ");

        lineString.appendChild(coordinates);

        placemark.appendChild(styleUrl);
        placemark.appendChild(name);
        placemark.appendChild(lineString);

        documentNode.appendChild(placemark);
    });

    const serializer = new XMLSerializer();

    return ('<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(doc));
}

function exportToKML() {

    const width = Number(lineWidthText);

    if (!Number.isFinite(width)) {
        return;
    }

    const selectedTracks =
        lineStrings.filter(
            line => selectedLines.has(line.id)
        );

    const kml = buildTracksKML(
        selectedTracks,
        width,
        getSelectedKMLColor()
    );

    downloadTextFile(
        kml,
        "export.kml",
        "application/vnd.google-earth.kml+xml"
    );
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

function buildPlacemarksKML(placemarks) {

    const doc = document.implementation.createDocument("http://www.opengis.net/kml/2.2", "kml", null);

    const documentNode = doc.createElement("Document");
    doc.documentElement.appendChild(documentNode);

    const folder = doc.createElement("Folder");
    documentNode.appendChild(folder);

    const folderName = doc.createElement("name");
    folderName.textContent = "Pontos";
    folder.appendChild(folderName);

    placemarks.forEach(([name, coord]) => {

        const placemark = doc.createElement("Placemark");

        const placemarkName = doc.createElement("name");
        placemarkName.textContent = name;
        placemark.appendChild(placemarkName);

        const point = doc.createElement("Point");

        const coordinates = doc.createElement("coordinates");
        coordinates.textContent =
            `${coord.longitude},${coord.latitude}`;

        point.appendChild(coordinates);
        placemark.appendChild(point);

        folder.appendChild(placemark);
    });

    const serializer = new XMLSerializer();

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        serializer.serializeToString(doc)
    );
}

function savePlacemarksToKML(placemarks) {

    const kml = buildPlacemarksKML(placemarks);

    downloadTextFile(
        kml,
        "placemarks.kml",
        "application/vnd.google-earth.kml+xml"
    );
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
    const blob = new Blob([text], {
        type
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function shareTextFile(content, filename, mimeType) {

    console.log("share", navigator.share);
    console.log("canShare", navigator.canShare);
    const file = new File([content], filename, {
        type: mimeType
    });
    console.log("canShareFile", navigator.canShare?.({
        files: [file]
    }));
    console.log("Tentando compartilhar");
    const testFile = new File([content], filename, {
        type: mimeType
    });
    alert("vou compartilhar");
    await navigator.share({
        title: filename,
        files: [testFile]
    });
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
            "https://formspree.io/f/xnjykdae", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );
    } catch (error) {
        console.error("Erro ao enviar:", error);
    }
}

function openMapPreview() {
    const selectedId =
        Array.from(selectedLines)[0];
    const line =
        lineStrings.find(
            l => l.id === selectedId
        );
    if (!line) {
        return;
    }
    sessionStorage.setItem(
        "previewTrack",
        JSON.stringify(line)
    );
    window.open(
        "mapa.html",
        "_blank"
    );
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
            lineWidthText
        };
    }
};

init();
