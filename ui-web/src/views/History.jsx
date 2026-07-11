import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const DATE_RANGES = [
    { value: 'all',   label: 'Siempre' },
    { value: 'today', label: 'Hoy' },
    { value: 'week',  label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
];

const Th = ({ children }) => <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant uppercase border border-outline-variant">{children}</th>;
const Td = ({ children, mono = false }) => <td className={`px-stack-md py-stack-md border border-outline-variant ${mono ? 'font-mono-data' : ''}`}>{children}</td>;

const History = () => {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('all');
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;
        // Historial real de reproducciones (progreso por contenido), ya con la
        // ficha de la película resuelta. Solo películas: las series no tienen
        // recorrido de navegación completo en el catálogo por ahora.
        api.get(`/stream/history/${user.id}`)
            .then(res => {
                const list = res.data?.data?.list || [];
                setItems(list.filter(entry => entry.contentId?.type !== 'series'));
            })
            .catch(err => console.error('Error al cargar historial:', err))
            .finally(() => setLoading(false));
    }, [user]);

    const filtered = useMemo(() => {
        const now = new Date();
        return items.filter(entry => {
            if (dateRange === 'all') return true;
            const diffDays = (now - new Date(entry.lastWatched)) / (1000 * 60 * 60 * 24);
            if (dateRange === 'today' && diffDays > 1)  return false;
            if (dateRange === 'week'  && diffDays > 7)  return false;
            if (dateRange === 'month' && diffDays > 30) return false;
            return true;
        });
    }, [items, dateRange]);

    const formatDate = (iso) => new Date(iso).toLocaleDateString('es-PE', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (loading) return (
        <div className="p-container-padding text-on-surface-variant font-label-md uppercase tracking-widest animate-pulse">Cargando historial…</div>
    );

    return (
        <div className="flex flex-col w-full">
            <div className="px-container-padding py-stack-lg border-b border-outline-variant bg-surface-container-low flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-unit">
                    <span className="font-label-md text-label-md text-primary tracking-[0.2em] uppercase">Workspace Personal</span>
                    <h1 className="font-display-lg text-display-lg text-on-surface uppercase tracking-tighter">Mi Historial</h1>
                </div>
                <span className="font-mono-data text-mono-data text-on-surface-variant">{filtered.length} REGISTROS</span>
            </div>

            <div className="p-container-padding flex flex-col gap-stack-lg">
                <div className="flex items-center gap-stack-sm">
                    <span className="font-label-md text-label-md text-on-surface-variant uppercase mr-stack-sm">Periodo</span>
                    {DATE_RANGES.map(r => (
                        <button
                            key={r.value}
                            onClick={() => setDateRange(r.value)}
                            className={`px-stack-md py-2 font-label-md text-label-md uppercase tracking-widest border transition-colors ${dateRange === r.value ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant hover:text-on-surface'}`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div className="border border-dashed border-outline-variant p-16 flex flex-col items-center gap-stack-md text-center">
                        <span className="material-symbols-outlined text-4xl text-outline-variant">history</span>
                        <p className="font-body-lg text-body-lg text-on-surface-variant">No hay registros para el periodo seleccionado.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-outline-variant">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-surface-container-high">
                                    <Th>Obra</Th>
                                    <Th>Última Vista</Th>
                                    <Th>Progreso</Th>
                                </tr>
                            </thead>
                            <tbody className="font-body-md text-body-md">
                                {filtered.map((entry, idx) => {
                                    const content = entry.contentId;
                                    const title = content?.title || content?.name || 'Contenido no disponible';
                                    const percent = entry.duration ? Math.min(Math.round((entry.currentTime / entry.duration) * 100), 100) : 0;
                                    return (
                                        <tr
                                            key={entry._id || idx}
                                            onClick={() => content?._id && navigate(`/item/movie/${content._id}`)}
                                            className="hover:bg-surface-container-high transition-colors cursor-pointer"
                                        >
                                            <Td>
                                                <span className="text-on-surface font-medium uppercase">{title}</span>
                                            </Td>
                                            <Td mono>{formatDate(entry.lastWatched)}</Td>
                                            <Td mono>
                                                <span className="text-primary">{percent}%</span>
                                            </Td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;
