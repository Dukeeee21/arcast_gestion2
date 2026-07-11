import React, { useEffect, useState } from 'react';
import api from '../services/api';
import TerritorialMap from '../components/TerritorialMap';

const PEN = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE')}`;
const ESTADO_CHIP = {
    Activo: 'bg-primary/10 text-primary border-primary/20',
    'En Proceso': 'bg-surface-container-highest text-on-surface-variant border-outline-variant',
    Finalizado: 'bg-on-tertiary-container/10 text-on-tertiary-container border-on-tertiary-container/20',
    'Sin actividad': 'bg-surface-container-highest text-on-surface-variant border-outline-variant',
};

const BossDashboard = () => {
    const [territorial, setTerritorial] = useState([]);
    const [stateReturn, setStateReturn] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/statistics/territorial').catch(() => ({ data: [] })),
            api.get('/statistics/state-return').catch(() => ({ data: null })),
            api.get('/users/stats').catch(() => ({ data: null })),
        ]).then(([t, s, st]) => {
            setTerritorial(Array.isArray(t.data) ? t.data : []);
            setStateReturn(s.data || null);
            setStats(st.data || null);
        }).finally(() => setLoading(false));
    }, []);

    const downloadReport = async (report) => {
        try {
            const res = await api.get(`/statistics/export?report=${report}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = report === 'state-return' ? 'retorno-estatal.csv' : 'impacto-territorial.csv';
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
        } catch { alert('No se pudo exportar el CSV.'); }
    };

    const totalBudget = stateReturn?.totalBudget || 0;
    const totalPlays = stateReturn?.totalPlays || 0;

    return (
        <div className="flex flex-col w-full min-h-screen">
            {/* Encabezado */}
            <div className="flex flex-col gap-gutter px-container-padding pb-stack-lg pt-stack-md">
                <div className="flex justify-between items-end flex-wrap gap-4">
                    <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-primary tracking-[0.2em] uppercase mb-unit">Inteligencia Gubernamental</span>
                        <h1 className="font-display-lg text-display-lg text-on-surface uppercase">Panel de Control Analítico</h1>
                    </div>
                    <div className="flex items-center gap-stack-md bg-surface-container-high p-stack-sm border border-outline-variant">
                        <div className="flex flex-col border-r border-outline-variant pr-stack-md">
                            <span className="font-label-md text-label-md opacity-60">ÚLTIMA ACTUALIZACIÓN</span>
                            <span className="font-mono-data text-mono-data">{new Date().toLocaleString('es-PE')}</span>
                        </div>
                        <div className="flex items-center gap-unit px-stack-sm">
                            <span className="w-2 h-2 bg-primary animate-pulse"></span>
                            <span className="font-label-md text-label-md text-primary">SERVIDOR ACTIVO</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-gutter px-container-padding pb-container-padding flex-1">
                {/* Columna izquierda: financiero + tabla */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
                    <div className="bg-surface-container border border-outline-variant p-stack-lg">
                        <h2 className="font-headline-sm text-headline-sm mb-stack-lg border-l-4 border-primary pl-stack-sm">Presupuesto vs. Impacto</h2>
                        <div className="grid grid-cols-3 gap-stack-sm">
                            <div className="flex flex-col p-stack-md bg-surface-container-high border border-outline-variant">
                                <span className="font-label-md text-[10px] opacity-60 uppercase">Presupuesto</span>
                                <span className="font-mono-data text-title-lg text-primary mt-1">{loading ? '…' : PEN(totalBudget)}</span>
                            </div>
                            <div className="flex flex-col p-stack-md bg-surface-container-high border border-outline-variant">
                                <span className="font-label-md text-[10px] opacity-60 uppercase">Vistas</span>
                                <span className="font-mono-data text-title-lg text-on-surface mt-1">{loading ? '…' : totalPlays.toLocaleString('es-PE')}</span>
                            </div>
                            <div className="flex flex-col p-stack-md bg-surface-container-high border border-outline-variant">
                                <span className="font-label-md text-[10px] opacity-60 uppercase">Costo/Vista</span>
                                <span className="font-mono-data text-title-lg text-on-tertiary-container mt-1">{loading ? '…' : PEN(stateReturn?.costPerView)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface-container border border-outline-variant flex-1 flex flex-col">
                        <div className="p-stack-lg border-b border-outline-variant bg-surface-container-high/50 flex justify-between items-center">
                            <h2 className="font-headline-sm text-headline-sm">Retorno Estatal</h2>
                            <span className="material-symbols-outlined text-on-surface-variant">filter_list</span>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-outline-variant bg-surface-container-lowest/30">
                                        <th className="p-stack-md font-label-md text-label-md opacity-60 uppercase">Región</th>
                                        <th className="p-stack-md font-label-md text-label-md opacity-60 uppercase text-center">Proy.</th>
                                        <th className="p-stack-md font-label-md text-label-md opacity-60 uppercase text-right">Retorno Est.</th>
                                        <th className="p-stack-md font-label-md text-label-md opacity-60 uppercase">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/30">
                                    {(!stateReturn?.perRegion || stateReturn.perRegion.length === 0) ? (
                                        <tr><td colSpan={4} className="p-stack-lg text-center text-on-surface-variant opacity-60 font-body-md">Sin reproducciones georreferenciadas aún.</td></tr>
                                    ) : stateReturn.perRegion.slice(0, 8).map((r, i) => (
                                        <tr key={i} className="hover:bg-surface-container-highest transition-colors">
                                            <td className="p-stack-md font-body-md text-on-surface">{r.region}</td>
                                            <td className="p-stack-md font-mono-data text-center">{String(r.projects).padStart(2, '0')}</td>
                                            <td className="p-stack-md font-mono-data text-right text-primary">{PEN(r.retornoEstimado)}</td>
                                            <td className="p-stack-md font-label-md">
                                                <span className={`px-stack-sm py-unit border text-[10px] uppercase ${ESTADO_CHIP[r.estado] || ESTADO_CHIP['Sin actividad']}`}>{r.estado}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-stack-md border-t border-outline-variant grid grid-cols-2 gap-stack-md">
                            <button onClick={() => downloadReport('state-return')} className="w-full h-12 flex items-center justify-center gap-unit border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all uppercase tracking-widest">
                                <span className="material-symbols-outlined text-[18px]">ios_share</span> Exportar Reporte
                            </button>
                            <button onClick={() => downloadReport('territorial')} className="w-full h-12 flex items-center justify-center gap-unit border border-outline text-on-surface font-label-md text-label-md hover:bg-white/5 transition-all uppercase tracking-widest">
                                <span className="material-symbols-outlined text-[18px]">download</span> Descargar CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Columna derecha: mapa + mini-charts */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-gutter">
                    <div className="flex-1 bg-surface-container border border-outline-variant relative overflow-hidden min-h-[500px]">
                        <div className="absolute top-stack-lg left-stack-lg z-20 bg-surface/80 backdrop-blur-md p-stack-md border border-outline-variant">
                            <span className="font-label-md text-label-md uppercase opacity-60 block">Visualización</span>
                            <span className="font-title-lg text-title-lg">Densidad de Impacto</span>
                        </div>
                        <div className="w-full h-full flex items-center justify-center p-8">
                            <div className="w-full max-w-md">
                                <TerritorialMap data={territorial} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                        <MiniStat value={loading ? '…' : PEN(totalBudget)} label="Inversión Cultural" icon="account_balance_wallet" />
                        <MiniStat value={loading ? '…' : (stats?.metrics?.totalMovies ?? territorial.reduce((a, r) => a + r.projects, 0))} label="Obras en Catálogo" icon="view_module" />
                        <MiniStat value={loading ? '…' : totalPlays.toLocaleString('es-PE')} label="Visualizaciones" icon="trending_up" tertiary />
                    </div>
                </div>
            </div>
        </div>
    );
};

const MiniStat = ({ value, label, icon, tertiary }) => (
    <div className="bg-surface-container border border-outline-variant p-stack-lg flex flex-col gap-stack-md">
        <div className="flex justify-between items-start">
            <div className="flex flex-col">
                <span className="font-display-lg text-display-lg">{value}</span>
                <span className="font-label-md text-label-md opacity-60 uppercase">{label}</span>
            </div>
            <span className={`material-symbols-outlined ${tertiary ? 'text-on-tertiary-container' : 'text-primary'}`}>{icon}</span>
        </div>
    </div>
);

export default BossDashboard;
