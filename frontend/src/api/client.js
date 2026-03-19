import axios from "axios";

const api = axios.create({
  baseURL: "",
  timeout: 120000,
});

export async function injectMeme(formData) {
  const { data } = await api.post("/api/inject", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getDatabase() {
  const { data } = await api.get("/api/database");
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
