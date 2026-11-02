pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const jobTitleInput = document.getElementById("jobTitle");
const requiredSkillsInput = document.getElementById("requiredSkills");
const resumeFilesInput = document.getElementById("resumeFiles");
const fileList = document.getElementById("fileList");
const analyzeButton = document.getElementById("analyzeButton");
const clearButton = document.getElementById("clearButton");
const downloadButton = document.getElementById("downloadButton");
const messageBox = document.getElementById("message");
const jobSummary = document.getElementById("jobSummary");
const resultsTableBody = document.querySelector("#resultsTable tbody");

let selectedFiles = [];
let analysisResults = [];

resumeFilesInput.addEventListener("change", function () {
  selectedFiles = Array.from(this.files);
  showSelectedFiles();
});

analyzeButton.addEventListener("click", analyzeResumes);

clearButton.addEventListener("click", clearAll);

downloadButton.addEventListener("click", downloadCSV);

function showSelectedFiles() {
  fileList.innerHTML = "";

  selectedFiles.forEach(function (file) {
    const item = document.createElement("div");
    item.className = "file-item";
    item.textContent = "✔ " + file.name;
    fileList.appendChild(item);
  });
}

function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = "message";

  if (type) {
    messageBox.classList.add(type);
  }
}

function getRequiredSkills() {
  return requiredSkillsInput.value
    .split(",")
    .map(function (skill) {
      return skill.trim();
    })
    .filter(function (skill) {
      return skill.length > 0;
    });
}

function clearAll() {
  selectedFiles = [];
  analysisResults = [];
  resumeFilesInput.value = "";
  fileList.innerHTML = "";
  resultsTableBody.innerHTML = "";
  jobSummary.textContent = "";
  showMessage("", "");
}

async function analyzeResumes() {
  const requiredSkills = getRequiredSkills();

  if (requiredSkills.length === 0) {
    showMessage("Please enter at least one required skill.", "error");
    return;
  }

  if (selectedFiles.length === 0) {
    showMessage("Please upload at least one resume file.", "error");
    return;
  }

  analysisResults = [];
  resultsTableBody.innerHTML = "";
  showMessage("Analyzing resumes, please wait...", "success");

  for (const file of selectedFiles) {
    try {
      const text = await extractResumeText(file);
      const result = matchSkills(file.name, text, requiredSkills);
      analysisResults.push(result);
    } catch (error) {
      console.error(error);
      showMessage(
        "Could not read: " + file.name + ". Please check the file format.",
        "error"
      );
    }
  }

  if (analysisResults.length === 0) {
    showMessage("No resume could be analyzed. Please upload valid TXT, PDF, or DOCX files.", "error");
    return;
  }

  displayResults(requiredSkills);
}

async function extractResumeText(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".txt")) {
    return await file.text();
  }

  const arrayBuffer = await file.arrayBuffer();

  if (fileName.endsWith(".pdf")) {
    return await extractTextFromPDF(arrayBuffer);
  }

  if (fileName.endsWith(".docx")) {
    return await extractTextFromDOCX(arrayBuffer);
  }

  throw new Error("Unsupported file type");
}

async function extractTextFromPDF(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map(function (item) {
        return item.str;
      })
      .join(" ");

    fullText += pageText + "\n";
  }

  return fullText;
}

async function extractTextFromDOCX(arrayBuffer) {
  const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
  return result.value;
}

function matchSkills(fileName, resumeText, requiredSkills) {
  const lowerCaseResume = resumeText.toLowerCase();
  const matchedSkills = [];
  const missingSkills = [];

  requiredSkills.forEach(function (skill) {
    const skillText = skill.toLowerCase();

    if (lowerCaseResume.includes(skillText)) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  });

  const matchPercentage = Math.round(
    (matchedSkills.length / requiredSkills.length) * 100
  );

  return {
    fileName: fileName,
    matchedSkills: matchedSkills,
    missingSkills: missingSkills,
    matchPercentage: matchPercentage
  };
}

function displayResults(requiredSkills) {
  analysisResults.sort(function (a, b) {
    return b.matchPercentage - a.matchPercentage;
  });

  const jobTitle = jobTitleInput.value.trim() || "Not specified";

  jobSummary.textContent =
    "Job: " + jobTitle + " | Required skills: " + requiredSkills.join(", ");

  resultsTableBody.innerHTML = "";

  analysisResults.forEach(function (result, index) {
    const row = document.createElement("tr");

    const rankCell = document.createElement("td");
    rankCell.textContent = index + 1;

    const fileCell = document.createElement("td");
    fileCell.textContent = result.fileName;

    const matchedCell = document.createElement("td");
    matchedCell.textContent =
      result.matchedSkills.length > 0 ? result.matchedSkills.join(", ") : "None";

    const missingCell = document.createElement("td");
    missingCell.textContent =
      result.missingSkills.length > 0 ? result.missingSkills.join(", ") : "None";

    const percentageCell = document.createElement("td");
    percentageCell.textContent = result.matchPercentage + "%";

    if (result.matchPercentage >= 70) {
      percentageCell.className = "match-high";
    } else if (result.matchPercentage >= 40) {
      percentageCell.className = "match-medium";
    } else {
      percentageCell.className = "match-low";
    }

    row.appendChild(rankCell);
    row.appendChild(fileCell);
    row.appendChild(matchedCell);
    row.appendChild(missingCell);
    row.appendChild(percentageCell);

    resultsTableBody.appendChild(row);
  });

  showMessage(
    "Analysis complete. Candidates are ranked from highest to lowest skill match.",
    "success"
  );
}

function downloadCSV() {
  if (analysisResults.length === 0) {
    showMessage("Please analyze resumes before downloading the CSV.", "error");
    return;
  }

  let csv = "Rank,Resume File,Matched Skills,Missing Skills,Match Percentage\n";

  analysisResults.forEach(function (result, index) {
    const rank = index + 1;
    const fileName = result.fileName;
    const matched = result.matchedSkills.join("; ");
    const missing = result.missingSkills.join("; ");
    const percentage = result.matchPercentage + "%";

    csv +=
      rank + "," +
      '"' + fileName + '",' +
      '"' + matched + '",' +
      '"' + missing + '",' +
      percentage + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "candidate_shortlisting_results.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}