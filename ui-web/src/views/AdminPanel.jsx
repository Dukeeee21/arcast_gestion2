import React, { useState, useEffect, Suspense, lazy } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const BossDashboard = lazy(() => import('./BossDashboard'));
const Loading = () => (
    <div className="py-20 text-center text-primary font-label-md text-label-md uppercase tracking-widest animate-pulse">
        Iniciando módulos…
    </div>
);

const EMPTY = {
    title: '', overview: '', releaseDate: '', posterUrl: '', trailerKey: '', watchLink: '', localPath: '',
    region: '', lengua: '', fondoEstatal: '', anio: '', presupuestoAprobado: '', fechaVencimientoDerechos: '',
    director: '', productionCompany: '', attachments: [],
};

const ESTADO_BADGE = {
    Borrador: 'bg-surface-container-highest text-on-surface-variant border-outline-variant',
    Pendiente: 'bg-tertiary-container text-on-tertiary-container border-on-tertiary-container/30',
    Aprobado: 'bg-primary/10 text-primary border-primary/20',
    Rechazado: 'bg-error-container/30 text-error border-error/30',
    Oculto: 'bg-surface-container-highest text-on-surface-variant border-outline',
};

// ---- Campos reutilizables (estilo institucional) ----
const Field = ({ label, children }) => (
    <div className="flex flex-col gap-unit">
        <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{label}</label>
        {children}
    </div>
);
const inputCls = "w-full h-12 px-stack-md bg-surface border border-outline-variant text-on-surface font-body-md focus:border-primary focus:outline-none transition-colors";

const AdminPanel = () => {
    const { user } = useAuth();
    const isSupervisor = user?.role === 'admin';
    const [tab, setTab] = useState('catalog');

    return (
        <div className="flex flex-col w-full">
            <div className="flex flex-col px-container-padding py-stack-lg border-b border-outline-variant bg-surface-container-low">
                <div className="flex items-center gap-stack-sm mb-stack-sm">
                    <span className="w-2 h-2 bg-primary"></span>
                    <span className="font-label-md text-label-md tracking-[0.2em] text-on-surface-variant uppercase">Módulo de Ingesta Institucional</span>
                </div>
                <div className="flex justify-between items-end flex-wrap gap-4">
                    <h1 className="font-display-lg text-display-lg text-on-surface uppercase tracking-tight">Administración del Archivo</h1>
                    <div className="flex flex-col text-right">
                        <span className="font-mono-data text-mono-data text-primary uppercase">Ref: SYS-772-X</span>
                        <span className="font-label-md text-label-md text-on-surface-variant">Protocolo de Seguridad Nivel 3</span>
                    </div>
                </div>
                <div className="flex gap-0 mt-stack-lg border-b border-outline-variant -mb-stack-lg">
                    {[['catalog', 'Catalogación'], ['users', 'Usuarios'], ...(isSupervisor ? [['analytics', 'Analítica Territorial']] : [])].map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)} className={`px-stack-lg py-stack-md font-label-md text-label-md uppercase tracking-widest border-b-2 transition-colors ${tab === k ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>{l}</button>
                    ))}
                </div>
            </div>

            <div className={tab === 'analytics' ? '' : 'p-container-padding'}>
                {tab === 'catalog' && <TabCatalog isSupervisor={isSupervisor} />}
                {tab === 'users' && <TabUsers />}
                {tab === 'analytics' && isSupervisor && (
                    <Suspense fallback={<Loading />}><BossDashboard /></Suspense>
                )}
            </div>
        </div>
    );
};

// ====================== CATALOGACIÓN ======================
const TabCatalog = ({ isSupervisor }) => {
    const [movies, setMovies] = useState([]);
    const [catalogs, setCatalogs] = useState({});
    const [form, setForm] = useState(EMPTY);
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [msg, setMsg] = useState(null);

    const fetchMovies = () => api.get('/catalog/movies/manage').then(r => setMovies(r.data)).catch(() => setMovies([]));
    useEffect(() => { fetchMovies(); api.get('/system/catalogs').then(r => setCatalogs(r.data)).catch(() => {}); }, []);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
    const notify = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

    const addAtt = () => setForm(p => ({ ...p, attachments: [...p.attachments, { label: '', storagePath: '' }] }));
    const setAtt = (i, k, v) => setForm(p => { const a = [...p.attachments]; a[i] = { ...a[i], [k]: v }; return { ...p, attachments: a }; });
    const rmAtt = (i) => setForm(p => ({ ...p, attachments: p.attachments.filter((_, idx) => idx !== i) }));

    const edit = (m) => {
        setForm({
            title: m.title || '', overview: m.overview || '', releaseDate: m.releaseDate || '', posterUrl: m.posterUrl || '',
            trailerKey: m.trailerKey || '', watchLink: m.watchLink || '', localPath: m.localPath || '',
            region: m.region || '', lengua: m.lengua || '', fondoEstatal: m.fondoEstatal || '', anio: m.anio || '',
            presupuestoAprobado: m.presupuestoAprobado ?? '', fechaVencimientoDerechos: m.fechaVencimientoDerechos ? String(m.fechaVencimientoDerechos).slice(0, 10) : '',
            director: m.director || '', productionCompany: m.productionCompany || '',
            attachments: (m.attachments || []).map(a => ({ label: a.label || '', storagePath: a.storagePath || '' })),
        });
        setEditingId(m._id); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.region || !form.lengua || !form.fondoEstatal || !form.anio) return notify('Región, lengua, fondo y año son obligatorios.', 'err');
        const payload = {
            ...form, anio: Number(form.anio) || undefined,
            presupuestoAprobado: form.presupuestoAprobado === '' ? 0 : Number(form.presupuestoAprobado),
            fechaVencimientoDerechos: form.fechaVencimientoDerechos || null,
            attachments: form.attachments.filter(a => a.label && a.storagePath).map(a => ({ label: a.label, storagePath: a.storagePath, fileName: a.storagePath.split('/').pop() })),
        };
        try {
            if (editingId) await api.put(`/catalog/movies/${editingId}`, payload);
            else await api.post('/catalog/movies', payload);
            notify(editingId ? 'Ficha actualizada.' : (isSupervisor ? 'Obra publicada.' : 'Borrador creado.'));
            setShowForm(false); setForm(EMPTY); setEditingId(null); fetchMovies();
        } catch (err) { notify(err.message || 'Error al guardar.', 'err'); }
    };

    const workflow = async (id, action, ok) => { try { await api.patch(`/catalog/movies/${id}/${action}`); notify(ok); fetchMovies(); } catch (e) { notify(e.message, 'err'); } };
    const archive = async (id, title) => { if (!window.confirm(`¿Archivar "${title}"? (borrado lógico)`)) return; try { await api.delete(`/catalog/movies/${id}`); notify('Archivada.'); fetchMovies(); } catch (e) { notify(e.message, 'err'); } };

    return (
        <div className="flex flex-col gap-stack-lg">
            {msg && <div className={`p-stack-md border font-label-md text-label-md uppercase tracking-widest ${msg.type === 'err' ? 'border-error text-error bg-error-container/20' : 'border-tertiary text-tertiary bg-tertiary-container/20'}`}>{msg.text}</div>}

            <div className="flex justify-between items-center">
                <h2 className="font-headline-sm text-headline-sm uppercase">Expedientes ({movies.length})</h2>
                <button onClick={() => { setForm(EMPTY); setEditingId(null); setShowForm(s => !s); }} className="bg-primary text-on-primary px-stack-lg py-3 font-label-md text-label-md uppercase tracking-widest hover:opacity-90">
                    {showForm ? 'Cerrar' : '+ Nueva Ficha'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={submit} className="grid grid-cols-12 gap-gutter">
                    {/* Metadatos y derechos */}
                    <section className="col-span-12 lg:col-span-7 bg-surface-container p-stack-lg border border-outline-variant flex flex-col gap-stack-md">
                        <span className="font-headline-sm text-headline-sm text-on-surface uppercase border-l-4 border-primary pl-stack-sm">Metadatos y Derechos</span>
                        <Field label="Título del Contenido"><input required className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej: Registro Histórico 1952" /></Field>
                        <div className="grid grid-cols-2 gap-stack-md">
                            <Field label="Región"><select required className={inputCls} value={form.region} onChange={e => set('region', e.target.value)}><option value="">—</option>{(catalogs.regionesNaturales || []).map(r => <option key={r} value={r}>{r}</option>)}</select></Field>
                            <Field label="Idioma / Lengua"><select required className={inputCls} value={form.lengua} onChange={e => set('lengua', e.target.value)}><option value="">—</option>{(catalogs.lenguas || []).map(l => <option key={l} value={l}>{l}</option>)}</select></Field>
                            <Field label="Tipo de Fondo"><select required className={inputCls} value={form.fondoEstatal} onChange={e => set('fondoEstatal', e.target.value)}><option value="">—</option>{(catalogs.fondosEstatales || []).map(f => <option key={f} value={f}>{f}</option>)}</select></Field>
                            <Field label="Año"><input required type="number" className={inputCls} value={form.anio} onChange={e => set('anio', e.target.value)} placeholder="2023" /></Field>
                            <Field label="Presupuesto Aprobado (PEN)"><input type="number" className={inputCls} value={form.presupuestoAprobado} onChange={e => set('presupuestoAprobado', e.target.value)} placeholder="00.00" /></Field>
                            <Field label="Vencimiento de Derechos"><input type="date" className={inputCls} value={form.fechaVencimientoDerechos} onChange={e => set('fechaVencimientoDerechos', e.target.value)} /></Field>
                            <Field label="Director"><input className={inputCls} value={form.director} onChange={e => set('director', e.target.value)} /></Field>
                            <Field label="Casa Productora"><input className={inputCls} value={form.productionCompany} onChange={e => set('productionCompany', e.target.value)} /></Field>
                        </div>
                        <Field label="Sinopsis"><textarea className={`${inputCls} h-auto py-3`} rows="3" value={form.overview} onChange={e => set('overview', e.target.value)} /></Field>
                    </section>

                    {/* Repositorio digital */}
                    <section className="col-span-12 lg:col-span-5 bg-surface-container p-stack-lg border border-outline-variant flex flex-col gap-stack-md">
                        <span className="font-title-lg text-title-lg text-on-surface uppercase">Repositorio Digital</span>
                        <Field label="Póster (URL)"><input className={inputCls} value={form.posterUrl} onChange={e => set('posterUrl', e.target.value)} placeholder="https://…" /></Field>
                        <Field label="Video local — archivo en media/"><input className={inputCls} value={form.localPath} onChange={e => set('localPath', e.target.value)} placeholder="/media/mi-pelicula.mp4" /></Field>
                        <Field label="Fuente externa (archive.org / YouTube)"><input className={inputCls} value={form.watchLink} onChange={e => set('watchLink', e.target.value)} placeholder="https://archive.org/…" /></Field>
                        <div className="border-t border-outline-variant pt-stack-md">
                            <div className="flex items-center justify-between mb-stack-sm">
                                <span className="font-label-md text-label-md text-primary uppercase tracking-widest">Documentación Legal (PDF en media/)</span>
                                <button type="button" onClick={addAtt} className="text-primary font-label-md text-label-md">+ Añadir</button>
                            </div>
                            {form.attachments.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant opacity-60">Contratos, licencias, guiones. Colócalos en media/ y referéncialos.</p>}
                            {form.attachments.map((a, i) => (
                                <div key={i} className="flex gap-2 mb-2">
                                    <input placeholder="Etiqueta" value={a.label} onChange={e => setAtt(i, 'label', e.target.value)} className={`${inputCls} h-10 w-1/3`} />
                                    <input placeholder="/media/attachments/doc.pdf" value={a.storagePath} onChange={e => setAtt(i, 'storagePath', e.target.value)} className={`${inputCls} h-10 flex-1`} />
                                    <button type="button" onClick={() => rmAtt(i)} className="text-error font-label-md px-2">✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-auto p-stack-md bg-surface-container-high border-l-2 border-primary">
                            <p className="font-body-md text-body-md text-on-surface-variant italic">"Todo contenido debe cumplir la normativa de propiedad intelectual del Estado."</p>
                        </div>
                    </section>

                    <div className="col-span-12 flex justify-end gap-stack-md">
                        <button type="button" onClick={() => setShowForm(false)} className="text-on-surface-variant font-label-md text-label-md uppercase tracking-widest px-stack-lg">Cancelar</button>
                        <button type="submit" className="flex items-center gap-stack-md bg-primary text-on-primary px-stack-lg h-14 hover:opacity-90 transition-all">
                            <span className="font-headline-sm text-headline-sm uppercase tracking-widest">{isSupervisor ? 'Publicar' : 'Guardar Borrador'}</span>
                            <span className="material-symbols-outlined">save</span>
                        </button>
                    </div>
                </form>
            )}

            {/* Tabla de expedientes */}
            <div className="border border-outline-variant overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-high border-b border-outline-variant">
                        <tr>
                            <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase">Obra</th>
                            <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase">Estado</th>
                            <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase">Año</th>
                            <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase text-right">Gestión</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movies.map(m => (
                            <tr key={m._id} className="border-b border-outline-variant hover:bg-surface-container-highest/40 transition-colors">
                                <td className="px-gutter py-stack-md flex items-center gap-stack-md">
                                    {m.posterUrl ? <img src={m.posterUrl} className="w-9 h-12 object-cover" alt="" /> : <div className="w-9 h-12 bg-surface-container-highest flex items-center justify-center"><span className="material-symbols-outlined text-outline-variant text-[18px]">movie</span></div>}
                                    <span className="font-body-md text-on-surface font-medium">{m.title}</span>
                                </td>
                                <td className="px-gutter py-stack-md"><span className={`px-2 py-1 font-label-md text-[10px] uppercase border ${ESTADO_BADGE[m.estadoPublicacion] || ''}`}>{m.estadoPublicacion || '—'}</span></td>
                                <td className="px-gutter py-stack-md font-mono-data text-mono-data opacity-60">{m.anio || (m.releaseDate || '').slice(0, 4)}</td>
                                <td className="px-gutter py-stack-md text-right whitespace-nowrap space-x-3">
                                    {(m.estadoPublicacion === 'Borrador' || m.estadoPublicacion === 'Rechazado') && <button onClick={() => workflow(m._id, 'submit', 'Enviada a revisión.')} className="text-on-tertiary-container font-label-md text-[11px] uppercase">Enviar a revisión</button>}
                                    {isSupervisor && m.estadoPublicacion === 'Pendiente' && <><button onClick={() => workflow(m._id, 'approve', 'Aprobada.')} className="text-primary font-label-md text-[11px] uppercase">Aprobar</button><button onClick={() => workflow(m._id, 'reject', 'Rechazada.')} className="text-error font-label-md text-[11px] uppercase">Rechazar</button></>}
                                    <button onClick={() => edit(m)} className="text-on-surface font-label-md text-[11px] uppercase">Editar</button>
                                    {isSupervisor && <button onClick={() => archive(m._id, m.title)} className="text-error font-label-md text-[11px] uppercase">Archivar</button>}
                                </td>
                            </tr>
                        ))}
                        {movies.length === 0 && <tr><td colSpan={4} className="px-gutter py-stack-lg text-center text-on-surface-variant opacity-60">Sin expedientes.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ====================== USUARIOS ======================
const TabUsers = () => {
    const [users, setUsers] = useState([]);
    const [q, setQ] = useState('');
    const fetchUsers = () => api.get('/users').then(r => setUsers(r.data)).catch(() => setUsers([]));
    useEffect(() => { fetchUsers(); }, []);

    const changeRole = async (id, username, role) => {
        if (!window.confirm(`¿Cambiar rol de ${username} a ${role.toUpperCase()}?`)) return;
        try { await api.put(`/users/${id}/role`, { role }); fetchUsers(); } catch (e) { alert(e.message); }
    };
    const filtered = users.filter(u => (u.username || '').toLowerCase().includes(q.toLowerCase()) || (u.email || '').toLowerCase().includes(q.toLowerCase()));

    return (
        <div className="flex flex-col gap-stack-lg">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="font-headline-sm text-headline-sm uppercase">Directorio de Usuarios</h2>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar por nombre o email…" className="h-11 px-stack-md bg-surface border border-outline-variant text-on-surface font-body-md focus:border-primary focus:outline-none w-72 max-w-full" />
            </div>
            <div className="border border-outline-variant overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-high border-b border-outline-variant">
                        <tr>
                            <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase">Usuario</th>
                            <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase">Email</th>
                            <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase">Región</th>
                            <th className="px-gutter py-stack-md font-label-md text-label-md text-on-surface-variant uppercase">Rol</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(u => (
                            <tr key={u._id} className="border-b border-outline-variant hover:bg-surface-container-highest/40">
                                <td className="px-gutter py-stack-md font-body-md text-on-surface font-medium">{u.username}</td>
                                <td className="px-gutter py-stack-md font-mono-data text-mono-data opacity-60">{u.email}</td>
                                <td className="px-gutter py-stack-md font-body-md text-on-surface-variant">{u.region || '—'}</td>
                                <td className="px-gutter py-stack-md">
                                    <select value={u.role} onChange={e => changeRole(u._id, u.username, e.target.value)} className="bg-surface border border-outline-variant text-[11px] font-label-md uppercase px-3 py-1 text-primary">
                                        <option value="user">USER</option>
                                        <option value="tecnico">TÉCNICO</option>
                                        <option value="admin">ADMIN</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && <tr><td colSpan={4} className="px-gutter py-stack-lg text-center text-on-surface-variant opacity-60">Sin usuarios.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminPanel;
