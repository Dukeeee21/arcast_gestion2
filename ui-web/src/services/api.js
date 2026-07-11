import axios from 'axios';

/**
 * En desarrollo: Vite proxea /api → http://localhost:5001  (vite.config.js)
 * En producción: nginx proxea /api → http://api-core:5001  (nginx.conf)
 *
 * VITE_API_URL puede sobreescribirse con un .env local para apuntar
 * a un backend remoto (ej: VITE_API_URL=https://api.mi-dominio.com/api).
 */
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Exportado para los pocos lugares que arman URLs "crudas" fuera de axios
// (ej. src de <video>/<a> para streaming), que de otro modo resolverían la
// ruta relativa contra el dominio del FRONTEND en vez del backend real.
export const API_BASE_URL = BASE_URL;

const api = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('arcast_token');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err.response?.status;

        // Token expirado o inválido DURANTE una sesión activa: limpiamos todo y
        // volvemos al login. Un login fallido también responde 401, pero en ese
        // caso no hay token guardado, así que no entra aquí.
        if (status === 401 && localStorage.getItem('arcast_token')) {
            localStorage.removeItem('arcast_token');
            localStorage.removeItem('arcast_user');
            window.location.replace('/');
        }

        // Mensaje legible para el usuario: priorizamos el del backend (ya viene
        // en español) y si no hay, traducimos el error técnico de axios/red.
        let msg = err.response?.data?.message;
        if (!msg) {
            if (!err.response) msg = 'No hay conexión con el servidor. Inténtalo de nuevo en unos segundos.';
            else if (status >= 500) msg = 'El servidor no está disponible en este momento. Inténtalo más tarde.';
            else if (status === 404) msg = 'No se encontró el contenido solicitado.';
            else msg = 'Ocurrió un error inesperado. Inténtalo de nuevo.';
        }
        return Promise.reject({ message: String(msg), status });
    }
);

export default api;