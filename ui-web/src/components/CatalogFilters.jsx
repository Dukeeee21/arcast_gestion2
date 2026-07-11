import React from 'react';

/**
 * Panel lateral de filtros de metadatos institucionales (Vista Investigador).
 * Lee los catálogos controlados del backend (/system/catalogs) y emite cambios
 * hacia arriba; el filtrado real lo hace el servidor.
 */
const CheckGroup = ({ label, options, selected, onToggle }) => (
    <div className="filter-group">
        <span className="filter-label">{label}</span>
        {options.map((opt) => (
            <label key={opt} className="filter-check">
                <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => onToggle(opt)}
                />
                {opt}
            </label>
        ))}
    </div>
);

const CatalogFilters = ({
    catalogs,
    region, lengua, fondo, anioMin, anioMax,
    onToggle, onYear, onClear, resultCount,
}) => {
    const activeCount = region.length + lengua.length + fondo.length + (anioMin ? 1 : 0) + (anioMax ? 1 : 0);

    return (
        <aside className="filter-panel">
            <h3>
                Filtros Avanzados
                {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 6px' }}>
                {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
            </p>

            <CheckGroup label="Región" options={catalogs.regionesNaturales || []} selected={region} onToggle={(v) => onToggle('region', v)} />
            <CheckGroup label="Idioma / Lengua" options={catalogs.lenguas || []} selected={lengua} onToggle={(v) => onToggle('lengua', v)} />
            <CheckGroup label="Tipo de Fondo" options={catalogs.fondosEstatales || []} selected={fondo} onToggle={(v) => onToggle('fondo', v)} />

            <div className="filter-group">
                <span className="filter-label">Año</span>
                <div className="filter-range">
                    <input
                        type="number" placeholder="1900" value={anioMin}
                        onChange={(e) => onYear('anioMin', e.target.value)}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                    <input
                        type="number" placeholder="2024" value={anioMax}
                        onChange={(e) => onYear('anioMax', e.target.value)}
                    />
                </div>
            </div>

            {activeCount > 0 && (
                <button className="filter-clear" onClick={onClear}>Limpiar filtros</button>
            )}
        </aside>
    );
};

export default CatalogFilters;
