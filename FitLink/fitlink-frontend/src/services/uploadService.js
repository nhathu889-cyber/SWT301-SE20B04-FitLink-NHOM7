import axios from "axios";
import { backendUrl } from '@/utils/backendUrl';

const API_BASE = backendUrl(import.meta.env.VITE_API_URL, 'http://localhost:3000');

export async function uploadMaterialFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await axios.post(
    `${API_BASE}/api/pt/materials/upload`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,      // nếu backend dùng cookie
    }
  );

  return res.data;
}
