// export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5062';
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://papersign.grupowaybrasil.com.br:5062';

export const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("authToken")}`,
})