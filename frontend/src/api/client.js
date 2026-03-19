import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,
});

export function imageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

export async function injectMeme(formData) {
  const { data } = await api.post("/api/inject", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function injectBatch(formData) {
  const { data } = await api.post("/api/inject/batch", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getDatabase() {
  const { data } = await api.get("/api/database");
  return data;
}

export async function getBatches() {
  const { data } = await api.get("/api/batches");
  return data;
}

export async function deleteMeme(id) {
  const { data } = await api.delete(`/api/database/${id}`);
  return data;
}

export async function checkImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/api/check", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
