import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

// --- Tarjeta de obra (póster institucional, esquinas rectas, hover grayscale) ---
const MovieCard = ({ item, onClick, featured }) => (
    <div className="group cursor-pointer" onClick={onClick}>
        <div className={`aspect-[2/3] w-full ${featured ? 'border-2 border-primary' : 'border border-outline-variant'} bg-surface-container-high relative overflow-hidden mb-stack-sm`}>
            {item.posterUrl ? (
                <img className="object-cover w-full h-full grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" src={item.posterUrl} alt={item.title} loading="lazy" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-outline-variant">
                    <span className="material-symbols-outlined text-5xl">movie</span>
                </div>
            )}
            {featured && <div className="absolute top-3 left-3 bg-primary text-on-primary px-2 py-0.5 font-mono-data text-[10px]">DESTACADO</div>}
            {item.estadoPublicacion && item.estadoPublicacion !== 'Aprobado' && (
                <div className="absolute top-3 right-3 bg-surface-container-highest text-on-surface-variant px-2 py-0.5 font-mono-data text-[10px] uppercase">{item.estadoPublicacion}</div>
            )}
        </div>
        <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
                <h3 className="font-title-lg text-title-lg text-on-surface uppercase truncate">{item.title}</h3>
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider truncate">
                    {[item.region, item.lengua].filter(Boolean).join(' · ') || 'Sin clasificar'}
                </p>
            </div>
            <span className="font-mono-data text-mono-data text-on-surface-variant shrink-0">{item.anio || (item.releaseDate || '').slice(0, 4) || '—'}</span>
        </div>
    </div>
);

const SkeletonCard = () => (
    <div>
        <div className="aspect-[2/3] w-full border border-outline-variant bg-surface-container-high relative overflow-hidden mb-stack-sm animate-pulse" />
        <div className="h-3 bg-surface-container-high w-3/4 mb-2 animate-pulse" />
        <div className="h-2 bg-surface-container-high w-1/2 animate-pulse" />
    </div>
);

// --- Grupo de checkboxes de filtro ---
const CheckGroup = ({ label, options, selected, onToggle }) => (
    <div className="flex flex-col gap-stack-sm">
        <span className="font-label-md text-label-md text-on-surface-variant uppercase">{label}</span>
        <div className="flex flex-col gap-unit pl-unit">
            {options.map((opt) => (
                <label key={opt} className="flex items-center gap-stack-sm group cursor-pointer">
                    <input
                        type="checkbox"
                        checked={selected.includes(opt)}
                        onChange={() => onToggle(opt)}
                        className="appearance-none w-4 h-4 border border-outline-variant bg-transparent checked:bg-primary checked:border-primary cursor-pointer relative after:content-[''] after:hidden checked:after:block after:absolute after:inset-0 after:m-auto after:w-2 after:h-2 after:bg-on-primary"
                    />
                    <span className={`font-body-md text-body-md ${selected.includes(opt) ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-on-surface'}`}>{opt}</span>
                </label>
            ))}
        </div>
    </div>
);

// --- Fila horizontal de tendencias (lo más visto, dato real de reproducciones) ---
const TrendingRow = ({ items, onClick }) => {
    if (!items || items.length === 0) return null;
    return (
        <section className="px-container-padding py-stack-lg border-b border-outline-variant bg-surface-container-lowest">
            <div className="flex items-center gap-stack-sm mb-stack-md">
                <span className="material-symbols-outlined text-primary">trending_up</span>
                <h2 className="font-headline-sm text-headline-sm uppercase tracking-tight">Tendencias</h2>
                <span className="font-label-md text-label-md text-on-surface-variant opacity-60">Lo más reproducido por la comunidad</span>
            </div>
            <div className="flex gap-gutter overflow-x-auto pb-2">
                {items.map((item, i) => (
                    <div key={`${item.mediaType}-${item._id}`} onClick={() => onClick(item)} className="group cursor-pointer w-36 shrink-0">
                        <div className="relative aspect-[2/3] w-full border border-outline-variant bg-surface-container-high overflow-hidden mb-stack-sm">
                            {item.posterUrl ? (
                                <img className="object-cover w-full h-full grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500" src={item.posterUrl} alt={item.title || item.name} loading="lazy" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-outline-variant"><span className="material-symbols-outlined text-3xl">movie</span></div>
                            )}
                            <div className="absolute top-0 left-0 bg-primary text-on-primary w-7 h-7 flex items-center justify-center font-mono-data text-mono-data">{i + 1}</div>
                        </div>
                        <h3 className="font-label-md text-label-md text-on-surface uppercase truncate">{item.title || item.name}</h3>
                        <span className="font-mono-data text-[10px] text-on-surface-variant opacity-70">{item.plays} vistas</span>
                    </div>
                ))}
            </div>
        </section>
    );
};

const Home = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [catalogs, setCatalogs] = useState({});
    const [trending, setTrending] = useState([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [filtersOpen, setFiltersOpen] = useState(false);

    const parseList = (k) => (searchParams.get(k) ? searchParams.get(k).split(',').filter(Boolean) : []);
    const region = parseList('region');
    const lengua = parseList('lengua');
    const fondo = parseList('fondo');
    const anioMin = searchParams.get('anioMin') || '';
    const anioMax = searchParams.get('anioMax') || '';

    useEffect(() => {
        api.get('/system/catalogs').then(res => setCatalogs(res.data)).catch(() => {});
        api.get('/statistics/trending').then(res => setTrending(res.data || [])).catch(() => setTrending([]));
    }, []);

    useEffect(() => {
        setLoading(true);
        const params = { sort: 'newest' };
        if (region.length) params.region = region.join(',');
        if (lengua.length) params.lengua = lengua.join(',');
        if (fondo.length) params.fondo = fondo.join(',');
        if (anioMin) params.anioMin = anioMin;
        if (anioMax) params.anioMax = anioMax;
        api.get('/catalog/movies', { params })
            .then(res => setItems(res.data.results || res.data || []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams.get('region'), searchParams.get('lengua'), searchParams.get('fondo'), anioMin, anioMax]);

    const toggleFilter = (key, value) => {
        const params = new URLSearchParams(searchParams);
        const current = params.get(key) ? params.get(key).split(',').filter(Boolean) : [];
        const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
        if (next.length) params.set(key, next.join(',')); else params.delete(key);
        setSearchParams(params);
    };
    const setYear = (key, value) => {
        const params = new URLSearchParams(searchParams);
        if (value) params.set(key, value); else params.delete(key);
        setSearchParams(params);
    };
    const clearFilters = () => setSearchParams(new URLSearchParams());

    const goItem = (item) => navigate(`/item/${item.mediaType || 'movie'}/${item._id}`);
    const featured = items[0];
    const rest = items.slice(1);
    const activeFilters = region.length + lengua.length + fondo.length + (anioMin ? 1 : 0) + (anioMax ? 1 : 0);

    return (
        <div className="flex flex-col w-full">
            {/* HERO destacado */}
            {featured && !loading && (
                <section className="relative w-full overflow-hidden border-b border-outline-variant bg-surface-container-lowest">
                    <div className="absolute inset-0 opacity-40 mix-blend-luminosity bg-cover bg-center"
                        style={{ backgroundImage: `url(${featured.backdropUrl || featured.posterUrl || ''})` }} />
                    <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
                    <div className="relative z-10 px-container-padding py-24 flex flex-col items-start max-w-4xl">
                        <span className="font-label-md text-label-md tracking-[0.3em] text-primary uppercase mb-stack-sm">Documental Destacado</span>
                        <h1 className="font-display-lg text-[52px] leading-[1.05] text-on-surface mb-stack-md uppercase tracking-tighter">{featured.title}</h1>
                        <div className="flex items-center gap-stack-md mb-stack-lg flex-wrap">
                            {featured.anio && <span className="font-mono-data text-mono-data text-on-surface-variant bg-surface-container-high px-2 py-1 border border-outline-variant">{featured.anio}</span>}
                            {featured.director && <span className="font-label-md text-label-md text-on-surface uppercase">Director: {featured.director}</span>}
                            {featured.duration && <><span className="text-outline-variant">|</span><span className="font-label-md text-label-md text-on-surface uppercase">{featured.duration} min</span></>}
                        </div>
                        <button onClick={() => goItem(featured)} className="group flex items-center gap-gutter bg-primary px-stack-lg py-4 hover:bg-on-primary-container transition-colors">
                            <span className="font-label-md text-label-md text-on-primary group-hover:text-primary-container tracking-widest uppercase">Ver expediente completo</span>
                            <span className="material-symbols-outlined text-on-primary group-hover:text-primary-container">arrow_forward</span>
                        </button>
                    </div>
                </section>
            )}

            <TrendingRow items={trending} onClick={goItem} />

            {/* Botón de filtros — solo visible en celular/tablet (el sidebar de al lado ya cubre desktop) */}
            <div className="lg:hidden px-container-padding pt-stack-md">
                <button
                    onClick={() => setFiltersOpen(v => !v)}
                    className="w-full flex items-center justify-between gap-stack-sm border border-outline-variant px-stack-md py-stack-sm text-on-surface font-label-md text-label-md uppercase tracking-widest"
                >
                    <span className="flex items-center gap-stack-sm">
                        <span className="material-symbols-outlined text-[18px]">tune</span>
                        Filtros Avanzados
                        {activeFilters > 0 && <span className="font-mono-data text-[10px] bg-primary text-on-primary px-2 normal-case">{activeFilters}</span>}
                    </span>
                    <span className="material-symbols-outlined text-[18px]">{filtersOpen ? 'expand_less' : 'expand_more'}</span>
                </button>
            </div>

            {/* CUERPO: filtros + grilla */}
            <div className="flex flex-col lg:flex-row flex-1 min-w-0">
                <aside className={`${filtersOpen ? 'block' : 'hidden'} lg:block w-full lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-outline-variant bg-surface-container-low p-container-padding`}>
                    <div className="hidden lg:flex items-center justify-between mb-stack-lg border-b border-outline-variant pb-stack-sm">
                        <span className="font-label-md text-label-md text-on-surface uppercase tracking-widest">Filtros Avanzados</span>
                        {activeFilters > 0 && <span className="font-mono-data text-[10px] bg-primary text-on-primary px-2">{activeFilters}</span>}
                    </div>
                    <div className="flex flex-col gap-stack-lg">
                        <CheckGroup label="Región" options={catalogs.regionesNaturales || []} selected={region} onToggle={(v) => toggleFilter('region', v)} />
                        <CheckGroup label="Lengua Originaria" options={catalogs.lenguas || []} selected={lengua} onToggle={(v) => toggleFilter('lengua', v)} />
                        <CheckGroup label="Tipo de Fondo" options={catalogs.fondosEstatales || []} selected={fondo} onToggle={(v) => toggleFilter('fondo', v)} />
                        <div className="flex flex-col gap-stack-md">
                            <span className="font-label-md text-label-md text-on-surface-variant uppercase">Rango Temporal</span>
                            <div className="flex gap-stack-sm items-center">
                                <input value={anioMin} onChange={(e) => setYear('anioMin', e.target.value)} placeholder="1900" className="w-1/2 bg-surface-container-high border border-outline-variant p-2 font-mono-data text-mono-data text-center text-on-surface" />
                                <span className="text-outline">-</span>
                                <input value={anioMax} onChange={(e) => setYear('anioMax', e.target.value)} placeholder="2024" className="w-1/2 bg-surface-container-high border border-outline-variant p-2 font-mono-data text-mono-data text-center text-on-surface" />
                            </div>
                        </div>
                        {activeFilters > 0 && (
                            <button onClick={clearFilters} className="border border-outline-variant text-on-surface-variant py-2 font-label-md text-label-md uppercase tracking-widest hover:border-primary hover:text-primary transition-colors">Limpiar filtros</button>
                        )}
                    </div>
                </aside>

                <main className="flex-1 p-container-padding min-w-0">
                    <div className="flex items-baseline justify-between border-b border-outline-variant pb-stack-sm mb-stack-lg">
                        <h2 className="font-headline-sm text-headline-sm tracking-tight uppercase">Catálogo del Archivo</h2>
                        <span className="font-mono-data text-mono-data text-on-surface-variant">{loading ? '—' : items.length} REGISTROS</span>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-gutter">
                            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="border border-dashed border-outline-variant p-16 text-center">
                            <p className="font-body-lg text-body-lg text-on-surface-variant">No hay obras que coincidan con estos filtros.</p>
                            {activeFilters > 0 && <button onClick={clearFilters} className="mt-4 text-primary font-label-md uppercase tracking-widest">Quitar filtros</button>}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-gutter">
                            {rest.length > 0 && featured && <MovieCard item={featured} featured onClick={() => goItem(featured)} />}
                            {rest.map((item) => <MovieCard key={item._id} item={item} onClick={() => goItem(item)} />)}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Home;
