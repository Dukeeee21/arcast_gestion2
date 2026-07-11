import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const normalizeType = (mediaType) => (mediaType === 'tv' || mediaType === 'tvshow' ? 'tvshow' : 'movie');

const SemanticSearch = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [interpretation, setInterpretation] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim() || isSearching) return;
        setIsSearching(true); setHasSearched(true); setError(null); setResults([]); setInterpretation(null);
        try {
            const res = await api.post('/search/semantic', { query });
            const data = res?.data?.data || {};
            setInterpretation(data.interpretation || {});
            setResults((data.results || []).map((item) => ({ ...item, mediaType: normalizeType(item.mediaType) })));
        } catch (err) {
            setError(err.message || 'No se pudo completar la búsqueda.');
        } finally {
            setIsSearching(false);
        }
    };

    const chips = interpretation ? [
        (interpretation.keywords || []).length ? interpretation.keywords.join(', ') : null,
        (interpretation.genres || []).length ? interpretation.genres.join(', ') : null,
        (interpretation.country || []).length ? interpretation.country.join(', ') : null,
    ].filter(Boolean) : [];

    return (
        <div className="flex flex-col w-full">
            {/* Cabecera + buscador */}
            <section className="px-container-padding py-stack-lg border-b border-outline-variant bg-surface">
                <div className="max-w-5xl">
                    <div className="flex items-end gap-stack-md mb-stack-lg">
                        <span className="material-symbols-outlined text-primary text-4xl mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                        <div className="flex flex-col">
                            <span className="font-label-md text-label-md text-primary tracking-[0.2em] uppercase">Módulo de Inteligencia Artificial</span>
                            <h1 className="font-display-lg text-display-lg text-on-surface">Motor de Búsqueda Semántica</h1>
                        </div>
                    </div>
                    <form onSubmit={handleSearch} className="relative">
                        <div className="absolute inset-y-0 left-gutter flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-outline">search</span>
                        </div>
                        <input
                            value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder="Describa el contenido audiovisual o cultural que busca…"
                            className="w-full bg-surface-container-high border border-outline-variant py-5 pl-14 pr-40 font-body-lg text-body-lg text-on-surface focus:outline-none focus:border-primary transition-colors placeholder:text-outline/50"
                        />
                        <div className="absolute inset-y-0 right-gutter flex items-center">
                            <button type="submit" disabled={isSearching} className="bg-primary text-on-primary px-stack-lg py-2 font-label-md text-label-md hover:bg-primary-container hover:text-on-primary-container transition-all uppercase tracking-widest disabled:opacity-50">
                                {isSearching ? 'Procesando…' : 'Procesar Consulta'}
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            <main className="flex-1 p-container-padding">
                {isSearching && (
                    <div className="flex flex-col items-center py-16 gap-4">
                        <div className="w-9 h-9 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-on-surface-variant font-label-md uppercase tracking-widest">Interpretando su descripción…</p>
                    </div>
                )}

                {!isSearching && error && (
                    <div className="max-w-2xl bg-error-container/20 border border-error text-error px-5 py-4 font-label-md uppercase tracking-widest">{error}</div>
                )}

                {!isSearching && !error && hasSearched && (
                    <>
                        <div className="flex justify-between items-center mb-stack-lg flex-wrap gap-3">
                            <div className="flex flex-col">
                                <h2 className="font-headline-sm text-headline-sm text-on-surface">Resultados de Búsqueda</h2>
                                <p className="font-body-md text-body-md text-on-surface-variant opacity-70">{results.length} entradas para su consulta semántica</p>
                            </div>
                            {chips.length > 0 && (
                                <div className="flex flex-wrap gap-stack-sm">
                                    {chips.map((c, i) => (
                                        <span key={i} className="font-mono-data text-mono-data border border-primary/40 text-primary px-3 py-1 uppercase">{c}</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {results.length === 0 ? (
                            <div className="text-center py-16 text-on-surface-variant">
                                <p className="font-title-lg text-title-lg text-on-surface mb-2">Sin coincidencias</p>
                                <p className="font-body-md">Prueba con otras palabras que describan la trama o el ambiente.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-gutter">
                                {results.map((item) => (
                                    <article key={`${item.mediaType}-${item._id}`} onClick={() => navigate(`/item/${item.mediaType}/${item._id}`)}
                                        className="group bg-surface-container border border-outline-variant hover:border-primary transition-all flex gap-gutter p-gutter cursor-pointer">
                                        <div className="w-48 h-32 flex-shrink-0 bg-surface-container-highest relative overflow-hidden">
                                            {item.posterUrl ? (
                                                <img className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" src={item.posterUrl} alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-outline-variant"><span className="material-symbols-outlined text-4xl">movie</span></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-unit gap-3">
                                                    <h3 className="font-title-lg text-title-lg text-on-surface truncate">{item.title || item.name}</h3>
                                                    <span className="font-label-md text-[10px] px-2 py-0.5 border border-primary text-primary tracking-widest uppercase shrink-0">{item.mediaType === 'tvshow' ? 'Serie' : 'Película'}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-x-gutter gap-y-unit text-on-surface-variant font-mono-data text-mono-data opacity-70 mb-stack-sm">
                                                    {item.anio && <span>AÑO: {item.anio}</span>}
                                                    {item.region && <span>REGIÓN: {item.region}</span>}
                                                    {item.lengua && <span>LENGUA: {item.lengua}</span>}
                                                    {item.fondoEstatal && <span>FONDO: {item.fondoEstatal}</span>}
                                                </div>
                                                <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">{item.overview || 'Sin descripción disponible.'}</p>
                                            </div>
                                            <div className="flex justify-end gap-stack-md mt-stack-md">
                                                <span className="font-label-md text-label-md text-on-primary bg-primary px-stack-lg py-2 uppercase tracking-widest">Ver Ficha</span>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {!hasSearched && !isSearching && (
                    <div className="text-center py-20 text-on-surface-variant opacity-60">
                        <span className="material-symbols-outlined text-5xl mb-3">manage_search</span>
                        <p className="font-body-lg text-body-lg">Describe la trama, el ambiente o el tipo de historia. No necesitas el título exacto.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default SemanticSearch;
