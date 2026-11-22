
// ==========================================
// DATAVIZ - CUSTOMIZABLE DATA VISUALIZATION
// ==========================================

let uploadedData = [];
let currentChart = null;
let totalChartsCreated = 0;

// HTML Elements
const fileInput = document.getElementById("fileInput");
const chartType = document.getElementById("chartType");
const chartCanvas = document.getElementById("myChart");
const generateBtn = document.getElementById("generateBtn");
const cleanBtn = document.getElementById("cleanBtn");

const dataTable = document.getElementById("dataTable");
const xColumn = document.getElementById("xColumn");
const yColumn = document.getElementById("yColumn");

const fileName = document.getElementById("fileName");
const uploadMessage = document.getElementById("uploadMessage");
const cleanMessage = document.getElementById("cleanMessage");
const chartStatus = document.getElementById("chartStatus");


// ==========================================
// 1. FILE UPLOAD
// ==========================================

fileInput.addEventListener("change", handleFileUpload);

async function handleFileUpload(event) {

    const file = event.target.files[0];

    if (!file) return;

    try {

        if (typeof XLSX === "undefined") {
            throw new Error("Excel processing library not loaded.");
        }

        const extension = file.name.split(".").pop().toLowerCase();

        if (!["csv", "xlsx", "xls"].includes(extension)) {
            throw new Error("Please upload CSV, XLSX or XLS files.");
        }

        const arrayBuffer = await file.arrayBuffer();

        const workbook = XLSX.read(arrayBuffer, {
            type: "array"
        });

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        uploadedData = XLSX.utils.sheet_to_json(firstSheet, {
            defval: ""
        });

        if (uploadedData.length === 0) {
            throw new Error("The uploaded file contains no data.");
        }

        const columns = Object.keys(uploadedData[0]);

        if (columns.length === 0) {
            throw new Error("No columns found in the dataset.");
        }

        // Destroy old chart
        if (currentChart) {
            currentChart.destroy();
            currentChart = null;
        }

        // Update filename
        fileName.textContent = "Selected file: " + file.name;

        uploadMessage.textContent =
            "File uploaded successfully!";

        // Show uploaded data
        displayData();

        // Update column dropdowns
        updateColumnOptions();

        // Update dashboard statistics
        updateStatistics();

        // Clear chart status
        chartStatus.textContent = "No chart generated";

        cleanMessage.textContent = "";

        console.log("Uploaded data:", uploadedData);

    } catch (error) {

        console.error(error);

        uploadedData = [];

        uploadMessage.textContent = error.message;

        uploadMessage.style.color = "red";

    }
}


// ==========================================
// 2. DISPLAY DATA PREVIEW
// ==========================================


function displayData() {

    if (!uploadedData.length) return;

    const columns = Object.keys(uploadedData[0]);

    let tableHTML = `
        <thead>
            <tr>
                <th>No.</th>
    `;

    columns.forEach(column => {
        tableHTML += `<th>${escapeHTML(column)}</th>`;
    });

    tableHTML += `</tr></thead><tbody>`;

    uploadedData.forEach((row, index) => {

        tableHTML += `<tr><td>${index + 1}</td>`;

        columns.forEach(column => {

            const value = row[column];

            const missing =
                value === "" ||
                value === null ||
                value === undefined ||
                (typeof value === "string" && value.trim() === "");

            if (missing) {

                tableHTML += `
                    <td class="missing-cell">
                        Missing Value
                    </td>
                `;

            } else {

                tableHTML += `
                    <td>${escapeHTML(value)}</td>
                `;

            }

        });

        tableHTML += `</tr>`;

    });

    tableHTML += `</tbody>`;

    dataTable.innerHTML = tableHTML;
}



// Prevent uploaded text from being interpreted as HTML
function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// 3. UPDATE COLUMN DROPDOWNS
// ==========================================

function updateColumnOptions() {

    const columns = Object.keys(uploadedData[0]);

    const numericColumns = columns.filter(column =>
        uploadedData.some(row =>
            row[column] !== "" &&
            row[column] !== null &&
            Number.isFinite(Number(row[column]))
        )
    );

    xColumn.innerHTML = "";
    yColumn.innerHTML = "";

    columns.forEach(column => {

        xColumn.add(new Option(column, column));

    });

    numericColumns.forEach(column => {

        yColumn.add(new Option(column, column));

    });

    // Select default columns
    const labelColumn =
        columns.find(column => !numericColumns.includes(column))
        || columns[0];

    xColumn.value = labelColumn;

    if (numericColumns.length > 0) {
        yColumn.value = numericColumns[0];
    }

}


// ==========================================
// 4. DASHBOARD STATISTICS
// ==========================================

function updateStatistics() {

    document.getElementById("totalRows").textContent =
        uploadedData.length;

    document.getElementById("totalColumns").textContent =
        Object.keys(uploadedData[0]).length;

    document.getElementById("cleanedRows").textContent =
        uploadedData.length;

    document.getElementById("totalCharts").textContent =
        totalChartsCreated;

}


// ==========================================
// 5. CLEAN DATA
// ==========================================


cleanBtn.addEventListener("click", function () {

    if (!uploadedData.length) {
        cleanMessage.textContent = "Please upload a dataset first.";
        return;
    }

    const columns = Object.keys(uploadedData[0]);

    let missingCount = 0;
    let missingDetails = [];

    uploadedData.forEach((row, index) => {

        columns.forEach(column => {

            const value = row[column];

            const missing =
                value === "" ||
                value === null ||
                value === undefined ||
                (typeof value === "string" && value.trim() === "");

            if (missing) {

                missingCount++;

                missingDetails.push(
                    `Row ${index + 1}: ${column}`
                );

            }

        });

    });

    // Remove completely empty rows
    const originalCount = uploadedData.length;

    uploadedData = uploadedData.filter(row =>
        Object.values(row).some(value =>
            value !== "" &&
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        )
    );

    // Remove duplicate rows
    const uniqueRows = [];
    const seen = new Set();

    uploadedData.forEach(row => {

        const key = JSON.stringify(row);

        if (!seen.has(key)) {
            seen.add(key);
            uniqueRows.push(row);
        }

    });

    uploadedData = uniqueRows;

    displayData();
    updateColumnOptions();
    updateStatistics();

    const removed = originalCount - uploadedData.length;

    if (missingCount > 0) {

        cleanMessage.innerHTML =
            `Found ${missingCount} missing values.<br>` +
            `Removed ${removed} empty/duplicate rows.<br>` +
            `Missing values: ${missingDetails.map(escapeHTML).join(", ")}`;

    } else {

        cleanMessage.textContent =
            `No missing values found! Removed ${removed} empty/duplicate rows.`;

    }

    cleanMessage.style.color = missingCount > 0 ? "red" : "green";

});


// ==========================================
// 6. GENERATE CHART
// ==========================================

// IMPORTANT: Chart generates ONLY when button is clicked.

generateBtn.addEventListener("click", generateChart);

function generateChart() {

    if (!uploadedData.length) {

        alert("Please upload a dataset first!");

        return;
    }

    const type = chartType.value;

    const x = xColumn.value;
    const y = yColumn.value;

    const color = document.getElementById("chartColor").value;

    if (!x || !y) {

        alert("Please select X and Y columns.");

        return;
    }

    // Validate Y-axis numeric data
    const values = uploadedData.map(row =>
        Number(row[y])
    );

    if (!values.every(Number.isFinite)) {

        alert("Please select a numeric column for Y-axis.");

        return;
    }

    const labels = uploadedData.map(row =>
        String(row[x])
    );

    let config;

    const isCircular = [
        "pie",
        "doughnut",
        "polarArea"
    ].includes(type);

    const colors = [
        "#6366f1",
        "#ec4899",
        "#14b8a6",
        "#f59e0b",
        "#8b5cf6",
        "#ef4444",
        "#06b6d4",
        "#84cc16",
        "#f97316",
        "#a855f7"
    ];

    // Scatter chart
    if (type === "scatter") {

        const points = uploadedData.map(row => ({
            x: Number(row[x]),
            y: Number(row[y])
        }));

        if (!points.every(point =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y)
        )) {
            alert("Scatter chart requires numeric X and Y columns.");
            return;
        }

        config = {
            type: "scatter",

            data: {
                datasets: [{
                    label: y,
                    data: points,
                    backgroundColor: color
                }]
            },

            options: chartOptions()
        };

    }

    // Bubble chart
    else if (type === "bubble") {

        const points = uploadedData.map((row, index) => ({
            x: Number(row[x]),
            y: Number(row[y]),
            r: 6 + (index % 8)
        }));

        if (!points.every(point =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y)
        )) {
            alert("Bubble chart requires numeric X and Y columns.");
            return;
        }

        config = {
            type: "bubble",

            data: {
                datasets: [{
                    label: y,
                    data: points,
                    backgroundColor: color
                }]
            },

            options: chartOptions()
        };

    }

    // Area chart
    else {

        let actualType = type;

        let indexAxis = "x";

        let fill = false;

        if (type === "area") {

            actualType = "line";

            fill = true;

        }

        if (type === "horizontalBar") {

            actualType = "bar";

            indexAxis = "y";

        }

        config = {

            type: actualType,

            data: {

                labels: labels,

                datasets: [{

                    label: y,

                    data: values,

                    backgroundColor: isCircular
                        ? colors
                        : fill
                            ? color + "55"
                            : color,

                    borderColor: isCircular
                        ? colors
                        : color,

                    borderWidth: 2,

                    fill: fill,

                    tension: 0.3

                }]

            },

            options: {
                ...chartOptions(),
                indexAxis: indexAxis
            }

        };

    }

    // Destroy old chart
    if (currentChart) {

        currentChart.destroy();

        currentChart = null;

    }

    // Create new chart
    const ctx = chartCanvas.getContext("2d");

    currentChart = new Chart(ctx, config);

    totalChartsCreated++;

    document.getElementById("totalCharts").textContent =
        totalChartsCreated;

    chartStatus.textContent =
        "Chart generated successfully!";

    console.log("Chart generated:", type);

}


// ==========================================
// 7. COMMON CHART OPTIONS
// ==========================================

function chartOptions() {

    return {

        responsive: true,

        maintainAspectRatio: false,

        plugins: {

            legend: {
                display: true,
                position: "top"
            }

        }

    };

}

// ==========================================
// 8. EXPORT DASHBOARD AS PNG
// ==========================================

async function exportDashboardPNG() {

    const button = document.getElementById("exportPNG");

    try {

        button.disabled = true;
        button.textContent = "Preparing PNG...";

        const dashboard = document.querySelector(".dashboard");

        if (!dashboard) {
            throw new Error("Dashboard not found!");
        }

        const canvas = await html2canvas(dashboard, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight
        });

        const link = document.createElement("a");

        link.download = "DataViz-Dashboard.png";

        link.href = canvas.toDataURL("image/png");

        link.click();

        alert("Dashboard PNG downloaded successfully!");

    } catch (error) {

        console.error("PNG Export Error:", error);

        alert("Unable to export PNG: " + error.message);

    } finally {

        button.disabled = false;
        button.textContent = "↓ Export as PNG";

    }
}


// ==========================================
// 9. EXPORT DASHBOARD AS PDF
// ==========================================

async function exportDashboardPDF() {

    const button = document.getElementById("exportPDF");

    try {

        button.disabled = true;
        button.textContent = "Preparing PDF...";

        const dashboard = document.querySelector(".dashboard");

        if (!dashboard) {
            throw new Error("Dashboard not found!");
        }

        const canvas = await html2canvas(dashboard, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight
        });

        const imageData = canvas.toDataURL("image/png");

        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF("p", "mm", "a4");

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imageWidth = pageWidth;

        const imageHeight =
            (canvas.height * imageWidth) / canvas.width;

        let position = 0;

        // First PDF page
        pdf.addImage(
            imageData,
            "PNG",
            0,
            position,
            imageWidth,
            imageHeight
        );

        // Add more pages if dashboard is taller than one page
        let remainingHeight = imageHeight - pageHeight;

        while (remainingHeight > 0) {

            position -= pageHeight;

            pdf.addPage();

            pdf.addImage(
                imageData,
                "PNG",
                0,
                position,
                imageWidth,
                imageHeight
            );

            remainingHeight -= pageHeight;

        }

        pdf.save("DataViz-Dashboard.pdf");

        alert("Dashboard PDF downloaded successfully!");

    } catch (error) {

        console.error("PDF Export Error:", error);

        alert("Unable to export PDF: " + error.message);

    } finally {

        button.disabled = false;
        button.textContent = "↓ Export as PDF";

    }
}


// ==========================================
// 10. EXPORT BUTTON EVENTS
// ==========================================

document.getElementById("exportPNG")
    .addEventListener("click", exportDashboardPNG);

document.getElementById("exportPDF")
    .addEventListener("click", exportDashboardPDF);
