/**
 * Cliente S3 compatible para Cloudflare R2 — almacena los videos pesados
 * (media/) fuera del disco del servidor, para que el backend se pueda
 * desplegar en un plan gratis (Render, etc.) sin cargar los 5+ GB de video.
 *
 * Si las variables R2_* no están configuradas (ej. en desarrollo local con
 * docker-compose), `isR2Configured()` devuelve false y el streaming cae de
 * vuelta al archivo local en `media/` como siempre.
 */
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const isR2Configured = () =>
    Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME);

let client = null;
function getClient() {
    if (!client) {
        client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });
    }
    return client;
}

// URL firmada temporal (1 hora) para que el navegador transmita el video
// directo desde R2 — el backend no reenvía los bytes, solo autoriza el acceso.
async function getSignedVideoUrl(key, expiresInSeconds = 3600) {
    const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key });
    return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

module.exports = { isR2Configured, getClient, getSignedVideoUrl };
