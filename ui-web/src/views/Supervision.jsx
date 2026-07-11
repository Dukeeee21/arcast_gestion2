import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// Vista de SUPERVISIÓN: flujo de aprobación (pendientes) + bitácora de auditoría
// con verificación de integridad de la cadena de hash. Diseño institucional.
const ESTADO_CHIP = {
    Pendiente: 'bg-tertiary-container text-on-tertiary-container border-on-tertiary-container/30',
    Aprobado: 'bg-surface-container-highest text-on-surface-variant border-outline',
    Rechazado: 'bg-error-container/30 text-error border-error/30',
};

const Supervision = () => {
    const { user } = useAuth();
    const isSupervisor = user?.role === 'admin';

    const [pending, setPending] = useState([]);
    const [logs, setLogs] = useState([]);
    const [integrity, setIntegrity] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchAll = () => {
        setLoading(true);
        Promise.all([
            api.get('/catalog/movies/manage?estado=Pendiente').catch(() => ({ data: [] })),
            api.get('/system/audit?limit=40').catch(() => ({ data: [] })),
        ]).then(([p, l]) => {
            setPending(Array.isArray(p.data) ? p.data : []);
            setLogs(Array.isArray(l.data) ? l.data : []);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { fetchAll(); }, []);

    const doAction = async (id, action) => {
        try {
            await api.patch(`/catalog/movies/${id}/${action}`);
            fetchAll();
        } catch (e) { alert(e.message || 'Error'); }
    };

    const verify = async () => {
        try { setIntegrity((await api.get('/system/audit/verify')).data); }
        catch { setIntegrity({ valid: false }); }
    };

    const fmt = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'medium' });

    return (
        <div className="flex flex-col w-full p-container-padding gap-stack-lg">
            {/* Encabezado */}
            <div className="flex justify-between items-end border-b border-outline-variant pb-stack-md">
                <div className="flex flex-col">
                    <div className="flex items-center gap-unit mb-unit">
                        <span className="w-2 h-2 bg-primary"></span>
                        <span className="font-label-md text-label-md text-primary tracking-[0.2em] uppercase">Módulo de Integridad Digital</span>
                    </div>
                    <h1 className="font-display-lg text-display-lg uppercase tracking-tighter">Flujo de Aprobación y Auditoría</h1>
                </div>
                <button onClick={verify} className="flex items-center gap-stack-sm bg-tertiary-container text-on-tertiary-container px-stack-lg py-stack-md hover:brightness-110 transition-all">
                    <span className="material-symbols-outlined">verified_user</span>
                    <span className="font-label-md text-label-md uppercase tracking-widest">Verificar Integridad</span>
                </button>
            </div>

            {integrity && (
                <div className={`p-stack-md border font-label-md text-label-md uppercase tracking-widest ${integrity.valid ? 'border-tertiary text-tertiary bg-tertiary-container/20' : 'border-error text-error bg-error-container/20'}`}>
                    {integrity.valid
                        ? `✓ Cadena de auditoría íntegra — ${integrity.count} registros verificados sin alteraciones`
                        : `⚠ Integridad comprometida — la cadena se rompe en ${integrity.brokenAt || 'un registro'}`}
                </div>
            )}

            <div className="grid grid-cols-12 gap-gutter items-start">
                {/* Cola de aprobación */}
                <div className="col-span-12 lg:col-span-8 flex flex-col bg-surface-container-low border border-outline-variant">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-surface-container-high border-b border-outline-variant">
                                <tr>
                                    <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Título del Activo</th>
                                    <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Técnico</th>
                                    <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase tracking-widest text-center">Estado</th>
                                    <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase tracking-widest text-right">Control</th>
                                </tr>
                            </thead>
                            <tbody className="font-body-md text-body-md">
                                {loading ? (
                                    <tr><td colSpan={4} className="px-gutter py-stack-lg text-center text-on-surface-variant">Cargando…</td></tr>
                                ) : pending.length === 0 ? (
                                    <tr><td colSpan={4} className="px-gutter py-stack-lg text-center text-on-surface-variant opacity-60">No hay activos pendientes de revisión.</td></tr>
                                ) : pending.map((m) => (
                                    <tr key={m._id} className="border-b border-outline-variant hover:bg-surface-container-highest/50 transition-colors">
                                        <td className="px-gutter py-stack-md font-title-lg text-title-lg">{m.title}</td>
                                        <td className="px-gutter py-stack-md text-on-surface-variant font-mono-data text-mono-data">{m.createdBy || '—'}</td>
                                        <td className="px-gutter py-stack-md text-center">
                                            <span className={`px-2 py-1 font-label-md text-[10px] uppercase border ${ESTADO_CHIP.Pendiente}`}>Pendiente</span>
                                        </td>
                                        <td className="px-gutter py-stack-md text-right">
                                            {isSupervisor && (
                                                <div className="flex justify-end gap-stack-sm">
                                                    <button onClick={() => doAction(m._id, 'approve')} className="px-stack-md py-1 bg-primary text-on-primary font-label-md text-[11px] uppercase hover:brightness-110 active:scale-95 transition-all">Aprobar</button>
                                                    <button onClick={() => doAction(m._id, 'reject')} className="px-stack-md py-1 border border-error text-error font-label-md text-[11px] uppercase hover:bg-error/10 transition-all">Rechazar</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-gutter bg-surface-container flex justify-between items-center border-t border-outline-variant">
                        <div className="flex flex-col">
                            <span className="font-label-md text-[10px] text-on-surface-variant opacity-60 uppercase">Pendientes en Cola</span>
                            <span className="font-mono-data text-title-lg text-on-surface">{pending.length}</span>
                        </div>
                    </div>
                </div>

                {/* Bitácora de auditoría */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
                    <div className="bg-surface-container-lowest border border-outline-variant flex flex-col h-[560px]">
                        <div className="p-stack-md border-b border-outline-variant flex items-center justify-between bg-surface-container">
                            <div className="flex items-center gap-stack-sm">
                                <span className="material-symbols-outlined text-primary text-[20px]">terminal</span>
                                <span className="font-label-md text-label-md uppercase tracking-widest">Log de Auditoría</span>
                            </div>
                            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-gutter font-mono-data text-[12px] leading-relaxed text-on-surface-variant space-y-3">
                            {logs.length === 0 ? (
                                <p className="opacity-50">Sin registros aún.</p>
                            ) : logs.map((log) => (
                                <div key={log._id} className="flex flex-col gap-0.5 border-l border-primary/30 pl-stack-sm py-1">
                                    <span className="opacity-40 whitespace-nowrap">{fmt(log.timestamp)}</span>
                                    <span>
                                        <span className="text-primary">{log.username || log.userId}</span>
                                        {' · '}{log.action}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="p-stack-sm bg-surface-container-high border-t border-outline-variant flex items-center gap-stack-sm">
                            <div className="w-2 h-2 bg-on-tertiary-container rounded-full"></div>
                            <span className="font-mono-data text-[10px] text-on-surface-variant uppercase">Bitácora inmutable (hash-chain)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Supervision;
