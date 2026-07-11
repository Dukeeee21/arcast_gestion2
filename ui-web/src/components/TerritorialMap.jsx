import React, { useState } from 'react';

/**
 * Mapa de impacto territorial (Vista Jefe).
 *
 * Representa las reproducciones por departamento como "burbujas de calor" sobre
 * una silueta estilizada del Perú. El tamaño y la intensidad de cada burbuja son
 * proporcionales al volumen de visualizaciones de esa región. No pretende ser una
 * proyección cartográfica exacta: es una lectura rápida de dónde se consume el
 * archivo, alineada con el mockup del panel ministerial.
 */

// Posición real (x, y en un lienzo 0–100) de la capital de cada departamento,
// proyectada desde sus coordenadas geográficas reales (lat/lon) con la misma
// transformación que el contorno del país, para que las burbujas caigan en el
// lugar correcto sobre el mapa.
const COORDS = {
    'Tumbes': [22.77, 21.65], 'Piura': [21.86, 29.84], 'Lambayeque': [25.84, 37.77],
    'Cajamarca': [32.59, 39.75], 'La Libertad': [29.93, 44.51], 'Amazonas': [35.76, 35.05],
    'Loreto': [58.99, 22.54], 'San Martín': [40.28, 34.06], 'Áncash': [37.47, 51.64],
    'Huánuco': [43.94, 53.66], 'Ucayali': [52.44, 45.86], 'Pasco': [43.87, 57.46],
    'Junín': [49.16, 64.4], 'Lima': [39.92, 64.3], 'Callao': [39.54, 64.36],
    'Huancavelica': [50.31, 68.02], 'Ica': [46.53, 74.47], 'Ayacucho': [54.09, 69.9],
    'Apurímac': [60.85, 72.29], 'Cusco': [65.44, 71.78], 'Madre de Dios': [79.42, 67.05],
    'Puno': [75.23, 83.39], 'Arequipa': [67.61, 86.25], 'Moquegua': [70.64, 90.19],
    'Tacna': [74.06, 94.32],
};

// Contorno real del Perú (frontera nacional, 76 puntos), proyectado desde el
// límite geográfico oficial a un lienzo 0–100 preservando la proporción real
// del territorio (equirectangular, sin distorsionar ancho/alto).
const PERU_OUTLINE = '77.4,92.14 76.05,94.72 73.47,96.0 68.42,93.11 67.99,91.05 58.01,86.0 48.99,80.5 45.12,77.4 43.03,73.24 43.86,71.79 39.6,65.19 34.64,55.91 29.89,45.9 27.83,43.6 26.25,39.9 22.34,36.62 18.75,34.58 20.38,32.33 17.95,27.54 19.51,24.01 23.52,20.84 24.12,22.93 22.68,24.13 22.82,25.97 24.9,25.57 26.93,26.12 29.04,28.66 31.88,26.59 32.83,23.19 35.92,18.82 41.97,16.83 47.45,11.57 49.02,8.3 48.31,4.48 49.65,4.0 53.0,6.38 54.61,8.76 56.93,10.05 59.9,15.33 63.64,15.96 66.41,14.63 68.23,15.5 71.25,15.06 75.1,17.42 71.86,22.54 73.36,22.66 75.88,25.33 71.34,25.1 70.67,25.85 66.55,26.82 60.79,30.24 60.43,32.59 59.15,34.34 59.65,37.06 56.61,38.51 56.61,40.64 55.29,41.56 57.38,46.09 60.17,49.15 59.11,51.31 62.45,51.6 64.35,54.28 68.79,54.41 72.92,51.45 72.58,59.09 74.87,59.66 77.71,58.8 82.05,66.89 80.97,68.6 80.73,72.13 80.63,76.41 78.66,78.92 79.56,80.79 78.41,82.48 80.57,86.71 77.4,92.14';

const TerritorialMap = ({ data = [] }) => {
    const [hover, setHover] = useState(null);
    const maxPlays = Math.max(1, ...data.map((d) => d.plays || 0));

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="xMidYMid meet">
                <defs>
                    <radialGradient id="heatBubble" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(201,186,255,0.9)" />
                        <stop offset="55%" stopColor="rgba(122,92,255,0.45)" />
                        <stop offset="100%" stopColor="rgba(122,92,255,0)" />
                    </radialGradient>
                </defs>

                {/* Silueta del país */}
                <polygon
                    points={PERU_OUTLINE}
                    fill="rgba(255,255,255,0.02)"
                    stroke="rgba(148,163,184,0.25)"
                    strokeWidth="0.4"
                />

                {/* Burbujas de calor por región */}
                {data.map((d) => {
                    const coord = COORDS[d.region];
                    if (!coord) return null;
                    const [x, y] = coord;
                    const intensity = (d.plays || 0) / maxPlays;
                    const r = 3 + Math.sqrt(intensity) * 11;
                    return (
                        <g key={d.region}
                            onMouseEnter={() => setHover(d)}
                            onMouseLeave={() => setHover(null)}
                            style={{ cursor: 'pointer' }}>
                            <circle cx={x} cy={y} r={r} fill="url(#heatBubble)" />
                            <circle cx={x} cy={y} r="0.9" fill="#c9baff" />
                        </g>
                    );
                })}
            </svg>

            {/* Tooltip */}
            {hover && (
                <div style={{
                    position: 'absolute', top: 12, left: 12,
                    background: 'rgba(13,17,23,0.92)', border: '1px solid rgba(122,92,255,0.4)',
                    borderRadius: '10px', padding: '10px 14px', pointerEvents: 'none',
                }}>
                    <div style={{ color: '#d8ccff', fontWeight: 800, fontSize: '0.9rem' }}>{hover.region}</div>
                    <div style={{ color: '#b8a8ff', fontSize: '0.78rem' }}>{hover.plays} reproducciones · {hover.projects} proyectos</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 2 }}>{hover.estado}</div>
                </div>
            )}

            {data.length === 0 && (
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20,
                }}>
                    <span style={{ color: '#7a5cff', fontWeight: 700, fontSize: '0.9rem' }}>Sin datos territoriales aún</span>
                    <span style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 4 }}>
                        Las reproducciones se georreferencian por la región de cada usuario.
                    </span>
                </div>
            )}
        </div>
    );
};

export default TerritorialMap;
