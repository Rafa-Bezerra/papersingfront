const isDev = process.env.NODE_ENV === 'development';

export const API_BASE = isDev
  ? 'http://localhost:5170'
  : (process.env.NEXT_PUBLIC_API_URL ?? 'https://papersign.grupowaybrasil.com.br:5062');

// export const API_BASE = isDev
//   ? 'http://localhost:5170'
//   : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5062');

export const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("authToken")}`,
})

export const headersExterno = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("authTokenExterno")}`,
})