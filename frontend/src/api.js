const API_BASE = "http://127.0.0.1:8000";

export async function getReports() {
  const response = await fetch(`${API_BASE}/api/reports`);

  if (!response.ok) {
    throw new Error(`Failed to load reports (${response.status})`);
  }

  const data = await response.json();
  return data.reports;
}

export async function createReport(report) {
  const response = await fetch(`${API_BASE}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    "http://127.0.0.1:8000/api/upload-image",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Image upload failed.");
  }

  return data;
}

export async function detectPothole(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    "http://127.0.0.1:8000/api/detect-pothole",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Pothole detection failed.");
  }

  return data;
}