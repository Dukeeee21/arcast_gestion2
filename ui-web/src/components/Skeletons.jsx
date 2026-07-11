import React from 'react';

/**
 * Skeleton loaders (efecto shimmer) para la percepción de velocidad.
 * Reemplazan a los spinners: mientras llegan los datos mostramos la silueta
 * real de las tarjetas, no un círculo girando.
 */

export const SkeletonCard = () => (
    <div className="skeleton-card">
        <div className="skeleton skeleton-poster" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line sm" />
    </div>
);

// Rejilla de tarjetas fantasma, con la misma grilla que el catálogo real.
export const SkeletonGrid = ({ count = 12 }) => (
    <div className="catalog-grid">
        {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
);

// Silueta de la página de detalle (póster + líneas de ficha).
export const SkeletonDetail = () => (
    <div style={{ padding: '40px 5%', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        <div className="skeleton" style={{ width: '260px', aspectRatio: '2/3', borderRadius: '14px' }} />
        <div style={{ flex: 1, minWidth: '280px', maxWidth: '640px' }}>
            <div className="skeleton skeleton-line" style={{ width: '30%', height: '18px', margin: '6px 0' }} />
            <div className="skeleton skeleton-line" style={{ width: '70%', height: '34px', margin: '18px 0' }} />
            <div className="skeleton skeleton-line" style={{ width: '90%', margin: '10px 0' }} />
            <div className="skeleton skeleton-line" style={{ width: '85%', margin: '10px 0' }} />
            <div className="skeleton skeleton-line" style={{ width: '60%', margin: '10px 0' }} />
            <div className="skeleton" style={{ width: '100%', aspectRatio: '16/9', borderRadius: '14px', marginTop: '28px' }} />
        </div>
    </div>
);
