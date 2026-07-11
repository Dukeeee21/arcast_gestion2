import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const fmtTC = (secs) => {
    const s = Math.max(0, Math.floor(secs || 0));
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${ss}`;
};

const Profile = () => {
    const { user } = useAuth();
    const [me, setMe] = useState(null);
    const [annotations, setAnnotations] = useState([]);
    const [citations, setCitations] = useState([]);

    useEffect(() => {
        if (!user) return;
        api.get('/users/me').then(r => setMe(r.data)).catch(() => setMe(null));
        api.get('/annotations').then(r => setAnnotations(r.data || [])).catch(() => setAnnotations([]));
        api.get('/citations').then(r => setCitations(r.data || [])).catch(() => setCitations([]));
    }, [user]);

    if (!user) return <div className="p-container-padding text-on-surface-variant">Acceso denegado.</div>;

    const region = me?.region || '—';
    const history = (me?.watchHistory || []).slice(-8).reverse();

    return (
        <div className="flex flex-col w-full">
            {/* Cabecera */}
            <div className="flex items-end justify-between px-container-padding py-stack-lg border-b border-outline-variant bg-surface-container-low/30 flex-wrap gap-4">
                <div className="flex flex-col gap-unit">
                    <div className="flex items-center gap-stack-sm text-primary">
                        <span className="material-symbols-outlined text-[18px]">terminal</span>
                        <span className="font-mono-data text-label-md tracking-widest uppercase">Workspace Context</span>
                    </div>
                    <h1 className="font-display-lg text-display-lg">Panel de Trabajo Personal</h1>
                </div>
                <button onClick={() => window.print()} className="flex items-center gap-stack-sm bg-primary-container text-on-primary-container px-stack-lg py-stack-md hover:brightness-110 transition-all">
                    <span className="material-symbols-outlined">picture_as_pdf</span>
                    <span className="font-label-md text-label-md uppercase tracking-widest">Descargar Resumen (PDF)</span>
                </button>
            </div>

            <div className="grid grid-cols-12 gap-gutter px-container-padding py-stack-lg">
                {/* Sidebar perfil */}
                <div className="col-span-12 lg:col-span-3 flex flex-col gap-stack-lg">
                    <div className="bg-surface-container border border-outline-variant p-stack-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-unit opacity-10"><span className="material-symbols-outlined text-[120px]">fingerprint</span></div>
                        <div className="flex flex-col gap-stack-md relative z-10">
                            <div className="w-16 h-16 bg-primary flex items-center justify-center text-on-primary">
                                <span className="font-display-lg text-display-lg">{user.username?.slice(0, 2).toUpperCase()}</span>
                            </div>
                            <div className="flex flex-col">
                                <h2 className="font-headline-sm text-headline-sm text-primary uppercase">{user.username}</h2>
                                <span className="font-label-md text-label-md text-on-surface-variant opacity-80 mt-unit uppercase">{user.role}</span>
                            </div>
                            <div className="flex flex-col gap-unit border-t border-outline-variant pt-stack-md mt-stack-sm">
                                <Row k="Correo" v={me?.email || user.email} />
                                <Row k="Región" v={region} />
                                <Row k="Legajo" v={`PER-${String(me?._id || user.id || '').slice(-4).toUpperCase()}`} />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-unit">
                        <Metric label="Anotaciones" value={annotations.length} border="border-primary" />
                        <Metric label="Citas Exportadas" value={citations.length} border="border-tertiary" />
                    </div>
                </div>

                {/* Contenido */}
                <div className="col-span-12 lg:col-span-9 flex flex-col gap-stack-lg">
                    {/* Historial */}
                    <Section icon="history" title="Historial de Vistas">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-surface-container-highest/50">
                                        <Th>Recurso</Th><Th>Última Vista</Th><Th>Progreso</Th>
                                    </tr>
                                </thead>
                                <tbody className="font-body-md text-body-md">
                                    {history.length === 0 ? (
                                        <tr><td colSpan={3} className="px-stack-md py-6 text-on-surface-variant opacity-60 border border-outline-variant">Sin reproducciones registradas aún.</td></tr>
                                    ) : history.map((h, i) => (
                                        <tr key={i} className="hover:bg-surface-container-high transition-colors">
                                            <Td mono={false}><Link className="text-primary hover:underline" to={`/item/${(h.contentType || 'Movie').toLowerCase() === 'movie' ? 'movie' : 'tvshow'}/${h.contentId}`}>{h.contentId}</Link></Td>
                                            <Td>{h.lastTimeWatched ? new Date(h.lastTimeWatched).toLocaleDateString('es-PE') : '—'}</Td>
                                            <Td>{h.percentWatched ? `${Math.round(h.percentWatched)}%` : '—'}</Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    {/* Anotaciones */}
                    <Section icon="sticky_note_2" title="Mis Anotaciones Técnicas">
                        {annotations.length === 0 ? (
                            <p className="font-body-md text-on-surface-variant opacity-70">Aún no tienes anotaciones. Abre un expediente y pulsa “Anotar Marca de Tiempo”.</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-unit">
                                {annotations.slice(0, 12).map((n) => (
                                    <div key={n._id} className="bg-surface-container-low border border-outline-variant p-stack-md hover:border-primary transition-colors flex flex-col gap-stack-sm">
                                        <div className="flex items-center gap-stack-md">
                                            <Link to={`/item/movie/${n.contentId}`} className="bg-primary text-on-primary px-stack-sm py-unit font-mono-data text-label-md">TC: {fmtTC(n.timestampSeconds)}</Link>
                                            <span className="font-label-md text-label-md uppercase text-on-surface-variant truncate">Ref: {n.contentId}</span>
                                        </div>
                                        <p className="font-body-md text-body-md text-on-surface leading-relaxed">{n.text}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>

                    {/* Citas */}
                    <Section icon="format_quote" title="Citas & Bibliografía Exportada">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-surface-container-highest/30">
                                        <Th>Fecha</Th><Th>Formato</Th><Th>Referencia</Th>
                                    </tr>
                                </thead>
                                <tbody className="font-body-md text-body-md">
                                    {citations.length === 0 ? (
                                        <tr><td colSpan={3} className="px-stack-md py-6 text-on-surface-variant opacity-60 border border-outline-variant">Aún no has exportado citas.</td></tr>
                                    ) : citations.map((c) => (
                                        <tr key={c._id} className="hover:bg-surface-container-high/50">
                                            <Td>{new Date(c.createdAt).toLocaleDateString('es-PE')}</Td>
                                            <Td mono={false}><span className="font-bold">{c.format}</span></Td>
                                            <Td mono={false}><span className="font-mono-data text-[12px] italic text-on-surface-variant">{c.reference}</span></Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
};

const Row = ({ k, v }) => (
    <div className="flex items-center justify-between gap-2">
        <span className="font-mono-data text-label-md text-on-tertiary-container uppercase shrink-0">{k}</span>
        <span className="font-body-md text-body-md text-on-surface truncate text-right">{v}</span>
    </div>
);
const Metric = ({ label, value, border }) => (
    <div className={`bg-surface-container-high p-stack-md border-l-4 ${border} flex justify-between items-center`}>
        <span className="font-label-md text-label-md uppercase opacity-60">{label}</span>
        <span className="font-mono-data text-headline-sm">{value}</span>
    </div>
);
const Section = ({ icon, title, children }) => (
    <div className="flex flex-col">
        <div className="flex items-center gap-stack-sm border-b border-outline-variant pb-stack-sm mb-stack-md">
            <span className="material-symbols-outlined text-on-tertiary-container">{icon}</span>
            <h3 className="font-headline-sm text-headline-sm uppercase tracking-tight">{title}</h3>
        </div>
        {children}
    </div>
);
const Th = ({ children }) => <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant uppercase border border-outline-variant">{children}</th>;
const Td = ({ children, mono = true }) => <td className={`px-stack-md py-stack-md border border-outline-variant ${mono ? 'font-mono-data' : ''}`}>{children}</td>;

export default Profile;
