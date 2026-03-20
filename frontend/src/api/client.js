import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "https://digitaldome-production.up.railway.app";

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,
});

export function imageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${cleanPath}`;
}

export function getImagePath(meme) {
  return meme.thumbnail_url || meme.filepath ||
    (meme.filename ? `/uploads/source/${meme.filename}` : null);
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

export async function deleteBatch(batchId) {
  const { data } = await api.delete(`/api/batches/${batchId}`);
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

export async function getSimilarMemes(memeId, threshold = 40) {
  const { data } = await api.get(`/api/similar/${memeId}?threshold=${threshold}`);
  return data;
}
