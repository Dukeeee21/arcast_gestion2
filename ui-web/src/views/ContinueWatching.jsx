import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ContinueWatching = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/stream/continue-watching')
            .then(res => {
                const list = res.data?.data?.list || [];
                // Solo películas: las series no tienen un recorrido de navegación
                // completo en el catálogo por ahora.
                setItems(list.filter(entry => entry.contentType !== 'TVShow'));
            })
            .catch(err => console.error('Error al cargar continuar viendo:', err))
            .finally(() => setLoading(false));
    }, []);

    const handleRemove = (entryId) => {
        setItems(prev => prev.filter(i => i._id !== entryId));
    };

    if (loading) return (
        <div className="p-container-padding text-on-surface-variant font-label-md uppercase tracking-widest animate-pulse">Cargando expedientes en curso…</div>
    );

    return (
        <div className="flex flex-col w-full">
            <div className="px-container-padding py-stack-lg border-b border-outline-variant bg-surface-container-low flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-unit">
                    <span className="font-label-md text-label-md text-primary tracking-[0.2em] uppercase">Workspace Personal</span>
                    <h1 className="font-display-lg text-display-lg text-on-surface uppercase tracking-tighter">Continuar Viendo</h1>
                </div>
                <span className="font-mono-data text-mono-data text-on-surface-variant">{items.length} EN CURSO</span>
            </div>

            <div className="p-container-padding">
                {items.length === 0 ? (
                    <div className="border border-dashed border-outline-variant p-16 flex flex-col items-center gap-stack-md text-center">
                        <span className="material-symbols-outlined text-4xl text-outline-variant">play_circle</span>
                        <p className="font-body-lg text-body-lg text-on-surface-variant">Aún no tienes ninguna película en progreso.</p>
                        <button onClick={() => navigate('/')} className="bg-primary text-on-primary px-stack-lg py-3 font-label-md text-label-md uppercase tracking-widest hover:opacity-90 transition-all">
                            Explorar catálogo
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-gutter">
                        {items.map(entry => {
                            const item = entry.item;
                            if (!item) return null;
                            const percent = Math.min(entry.percentWatched || 0, 100);

                            return (
                                <div key={entry._id} className="group cursor-pointer" onClick={() => navigate(`/item/movie/${entry.contentId}`)}>
                                    <div className="relative aspect-[2/3] w-full border border-outline-variant bg-surface-container-high overflow-hidden mb-stack-sm">
                                        {item.posterUrl ? (
                                            <img className="object-cover w-full h-full group-hover:scale-105 transition-all duration-500" src={item.posterUrl} alt={item.title || item.name} loading="lazy" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-outline-variant"><span className="material-symbols-outlined text-5xl">movie</span></div>
                                        )}

                                        {/* Botón quitar */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemove(entry._id); }}
                                            title="Quitar"
                                            className="absolute top-2 right-2 w-7 h-7 bg-surface/90 border border-outline-variant text-on-surface-variant items-center justify-center opacity-0 group-hover:opacity-100 hover:text-error hover:border-error transition-all hidden group-hover:flex"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>

                                        {/* Barra de progreso */}
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-container-highest/80">
                                            <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                            <h3 className="font-title-lg text-title-lg text-on-surface uppercase truncate">{item.title || item.name}</h3>
                                            <p className="font-label-md text-label-md text-primary uppercase tracking-wider">{percent}% visto</p>
                                        </div>
                                        <span className="font-mono-data text-mono-data text-on-surface-variant shrink-0">★ {item.voteAverage?.toFixed(1) || '—'}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContinueWatching;
