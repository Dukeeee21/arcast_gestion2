import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api, { API_BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from '../components/VideoPlayer';

const fmtTime = (secs) => {
    const s = Math.max(0, Math.floor(secs || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const isYouTube = (url) => typeof url === 'string' && /(?:youtube\.com|youtu\.be)/i.test(url);
const isDirectVideo = (url) => typeof url === 'string' && (url.includes('archive.org') || /\.(mp4|mkv|webm|avi|mov|m3u8)(\?|$)/i.test(url));
const ytEmbed = (url) => url?.includes('watch?v=') ? url.replace('watch?v=', 'embed/') : url?.replace('youtu.be/', 'youtube.com/embed/');

const MovieDetails = () => {
    const { type, id } = useParams();
    const { user } = useAuth();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);

    const playerRef = useRef(null);
    const [annotations, setAnnotations] = useState([]);
    const [noteText, setNoteText] = useState('');
    const [noteTime, setNoteTime] = useState(0);
    const [showNoteBox, setShowNoteBox] = useState(false);
    const [studyTab, setStudyTab] = useState('ficha'); // ficha | docs | notas | resenas
    const [citation, setCitation] = useState(null);

    // --- Mi Lista (watchlist) ---
    const [inWatchlist, setInWatchlist] = useState(false);

    // --- Temporadas/episodios (series) ---
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [episodes, setEpisodes] = useState([]);
    const [currentEpisode, setCurrentEpisode] = useState(null);

    // --- Progreso de visualización (reanudar reproducción) ---
    const [resumeTime, setResumeTime] = useState(0);
    const [progressLoading, setProgressLoading] = useState(false);
    const lastSavedAtRef = useRef(0);

    // --- Reseñas de la comunidad ---
    const [reviews, setReviews] = useState([]);
    const [newReview, setNewReview] = useState({ rating: 5, text: '' });
    const [hoverRating, setHoverRating] = useState(0);
    const [editingReviewId, setEditingReviewId] = useState(null);

    useEffect(() => {
        setLoading(true);
        api.get(`/catalog/${type === 'movie' ? 'movies' : 'tvshows'}/${id}`)
            .then(res => {
                setItem(res.data);
                if (type === 'tvshow') {
                    const num = res.data.seasons || 1;
                    setSeasons(Array.from({ length: num }, (_, i) => i + 1));
                }
            })
            .catch(() => setItem(null))
            .finally(() => setLoading(false));
    }, [id, type]);

    useEffect(() => {
        if (!user || !id) { setAnnotations([]); return; }
        api.get(`/annotations/${id}`).then(res => setAnnotations(res.data || [])).catch(() => setAnnotations([]));
    }, [user, id]);

    // Comprobar si esta obra ya está en Mi Lista.
    useEffect(() => {
        if (!user || !id) { setInWatchlist(false); return; }
        api.get('/users/me').then(res => {
            const found = (res.data?.watchlist || []).some(w => (w.item?._id || w.item || w) === id);
            setInWatchlist(found);
        }).catch(() => setInWatchlist(false));
    }, [user, id]);

    const toggleWatchlist = async () => {
        if (!user) return;
        try {
            await api.post('/users/watchlist', { itemId: id, itemType: type });
            setInWatchlist(v => !v);
        } catch (err) {
            alert('No se pudo actualizar Mi Lista: ' + (err.message || ''));
        }
    };

    // Episodios de la temporada seleccionada.
    useEffect(() => {
        if (type !== 'tvshow' || !item) return;
        api.get(`/catalog/tvshows/${id}/episodes?season=${selectedSeason}`)
            .then(res => {
                setEpisodes(res.data || []);
                setCurrentEpisode(res.data?.[0] || null);
            })
            .catch(() => { setEpisodes([]); setCurrentEpisode(null); });
    }, [id, type, item, selectedSeason]);

    const streamToken = localStorage.getItem('arcast_token') || '';
    // Estas URLs cargan directo en un <video>/<iframe>, fuera de axios — por
    // eso arman la ruta ABSOLUTA contra el backend real (API_BASE_URL) y no
    // una ruta relativa, que resolvería contra el dominio del frontend.
    const localUrl = (type === 'movie' && item?.localPath) ? `${API_BASE_URL}/stream/movie/${item.tmdbId || id}?token=${streamToken}` : null;
    const trailerUrl = item?.trailerKey ? `https://www.youtube.com/embed/${item.trailerKey}` : null;

    // Fuente del episodio actual (serie): archivo remoto directo o streaming local con Range.
    const episodeUrl = (() => {
        if (type !== 'tvshow' || !currentEpisode?.localPath) return null;
        const lp = currentEpisode.localPath;
        if (/^https?:\/\//i.test(lp)) return lp;
        return `${API_BASE_URL}/stream/episode/${id}/${currentEpisode.season}/${currentEpisode.episode}?token=${streamToken}`;
    })();

    // Fuente activa: local → watchLink → tráiler (películas) | episodio actual (series)
    const source = (() => {
        if (type === 'tvshow') {
            if (episodeUrl) return { kind: isDirectVideo(episodeUrl) || episodeUrl.startsWith(API_BASE_URL) ? 'video' : 'iframe', url: episodeUrl };
            if (trailerUrl) return { kind: 'iframe', url: trailerUrl };
            return null;
        }
        if (localUrl) return { kind: 'video', url: localUrl };
        if (item?.watchLink && isDirectVideo(item.watchLink)) return { kind: 'video', url: item.watchLink };
        if (item?.watchLink && isYouTube(item.watchLink)) return { kind: 'iframe', url: ytEmbed(item.watchLink) };
        if (item?.watchLink) return { kind: 'iframe', url: item.watchLink };
        if (trailerUrl) return { kind: 'iframe', url: trailerUrl };
        return null;
    })();

    // Id de contenido para el sistema de progreso: la película, o el episodio activo.
    const progressContentId = type === 'tvshow' ? (currentEpisode?._id || null) : id;

    // Recuperar el progreso guardado para reanudar reproducción automáticamente.
    useEffect(() => {
        if (!user || !progressContentId) { setResumeTime(0); setProgressLoading(false); return; }
        let active = true;
        setProgressLoading(true);
        api.get(`/stream/progress/${progressContentId}`)
            .then(res => {
                if (!active) return;
                const p = res?.data?.data?.progress;
                if (p && p.duration > 0 && p.currentTime < p.duration * 0.95) setResumeTime(p.currentTime);
                else setResumeTime(0);
            })
            .catch(() => { if (active) setResumeTime(0); })
            .finally(() => { if (active) setProgressLoading(false); });
        return () => { active = false; };
    }, [user, progressContentId]);

    const handleProgress = async (currentTime, duration) => {
        if (!user || !duration) return;
        // Registro territorial (para el mapa de calor / estadísticas), throttled ~8s.
        const now = Date.now();
        if (!lastSavedAtRef.current || now - lastSavedAtRef.current > 8000) {
            lastSavedAtRef.current = now;
            api.post('/statistics/playback', {
                contentId: id, contentType: type === 'movie' ? 'Movie' : 'TVShow', durationMinutes: 1,
            }).catch(() => {});
            // Progreso real por-usuario (alimenta "Continuar viendo" e "Historial").
            if (progressContentId) {
                api.post('/stream/progress', {
                    contentId: progressContentId,
                    currentTime: Math.floor(currentTime),
                    duration: Math.floor(duration),
                }).catch(() => {});
            }
        }
    };

    const captureTimestamp = () => {
        setNoteTime(Math.floor(playerRef.current?.getCurrentTime?.() || 0));
        setShowNoteBox(true);
        setStudyTab('notas');
    };
    const saveAnnotation = async () => {
        if (!noteText.trim()) return;
        try {
            await api.post('/annotations', { contentId: id, contentType: type === 'movie' ? 'Movie' : 'TVShow', timestampSeconds: noteTime, text: noteText.trim() });
            setAnnotations((await api.get(`/annotations/${id}`)).data || []);
            setNoteText(''); setShowNoteBox(false);
        } catch (e) { alert('No se pudo guardar la nota: ' + (e.message || '')); }
    };
    const deleteAnnotation = async (nid) => {
        try { await api.delete(`/annotations/${nid}`); setAnnotations(annotations.filter(n => n._id !== nid)); } catch { /* noop */ }
    };
    const seekToNote = (s) => { playerRef.current?.seekTo?.(s); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const generateCitation = async (format = 'APA') => {
        try { setCitation((await api.post('/citations/generate', { contentId: id, format })).data); }
        catch (e) { alert('No se pudo generar la cita: ' + (e.message || '')); }
    };

    // --- Reseñas ---
    const fetchReviews = () => api.get(`/reviews/movie/${id}`).then(res => setReviews(res.data || [])).catch(() => setReviews([]));
    useEffect(() => { if (id) fetchReviews(); }, [id]);

    const submitReview = async (e) => {
        e.preventDefault();
        if (!newReview.text.trim()) return;
        try {
            if (editingReviewId) {
                await api.put(`/reviews/${editingReviewId}`, { rating: newReview.rating, text: newReview.text });
                setEditingReviewId(null);
            } else {
                await api.post('/reviews', { movieId: id, contentType: type, text: newReview.text, rating: newReview.rating });
            }
            await fetchReviews();
            setNewReview({ rating: 5, text: '' });
        } catch (err) {
            alert('No se pudo guardar la reseña: ' + (err.message || ''));
        }
    };
    const editReview = (rev) => {
        setEditingReviewId(rev._id);
        setNewReview({ rating: rev.rating, text: rev.text });
        setStudyTab('resenas');
    };
    const deleteReview = async (revId) => {
        if (!window.confirm('¿Borrar esta reseña?')) return;
        try { await api.delete(`/reviews/${revId}`); setReviews(reviews.filter(r => r._id !== revId)); }
        catch (err) { alert('No se pudo borrar: ' + (err.message || '')); }
    };

    if (loading) return <div className="p-container-padding text-on-surface-variant font-label-md uppercase tracking-widest animate-pulse">Cargando expediente…</div>;
    if (!item) return <div className="p-container-padding text-on-surface-variant">Contenido no encontrado.</div>;

    const fichaRows = [
        ['Título Original', item.title || item.name],
        ['Año de Producción', item.anio || (item.releaseDate || item.firstAirDate || '').slice(0, 4)],
        ['Dirección', item.director || '—'],
        ['Región', item.region || '—'],
        ['Lengua', item.lengua || '—'],
        ['Fondo Estatal', item.fondoEstatal || '—'],
        ['Duración', item.duration ? `${item.duration} min` : '—'],
        ['Producción', item.productionCompany || '—'],
    ];

    return (
        <div className="flex flex-col w-full">
            {/* Encabezado del expediente */}
            <div className="px-container-padding py-stack-lg border-b border-outline-variant flex flex-wrap items-end justify-between gap-4 bg-surface-container-low">
                <div className="flex flex-col gap-unit">
                    <span className="font-label-md text-label-md text-primary tracking-[0.2em] uppercase">Expediente Audiovisual</span>
                    <h1 className="font-display-lg text-display-lg text-on-surface uppercase tracking-tighter">{item.title || item.name} {item.anio ? `(${item.anio})` : ''}</h1>
                </div>
                <div className="flex items-center gap-gutter text-on-surface-variant font-mono-data text-mono-data">
                    <span className="bg-surface-container-high px-2 py-1">REF: ARC-{String(item._id).slice(-6).toUpperCase()}</span>
                    <span className={`px-2 py-1 uppercase ${item.estadoPublicacion === 'Aprobado' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container-high'}`}>{item.estadoPublicacion || 'N/D'}</span>
                </div>
            </div>

            {/* Reproductor + acciones ejecutivas */}
            <div className="grid grid-cols-12 gap-0 border-b border-outline-variant">
                <div className="col-span-12 lg:col-span-8 lg:border-r border-outline-variant p-container-padding bg-surface">
                    {source?.kind === 'video' ? (
                        <VideoPlayer ref={playerRef} src={source.url} title={item.title || item.name} onProgress={handleProgress} progressLoading={progressLoading} startTime={resumeTime} />
                    ) : source?.kind === 'iframe' ? (
                        <div className="relative w-full aspect-video bg-black">
                            <iframe src={source.url} title={item.title || item.name} className="w-full h-full" frameBorder="0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                        </div>
                    ) : (
                        <div className="w-full aspect-video bg-surface-container-lowest border border-outline-variant flex flex-col items-center justify-center gap-2 text-center p-6">
                            <span className="material-symbols-outlined text-4xl text-outline-variant">videocam_off</span>
                            <p className="font-body-md text-body-md text-on-surface-variant">Sin fuente de video configurada para este material.</p>
                        </div>
                    )}

                    {/* Selector de temporada/episodio (series) */}
                    {type === 'tvshow' && seasons.length > 0 && (
                        <div className="mt-stack-md flex flex-col gap-stack-sm">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <span className="font-label-md text-label-md uppercase tracking-widest text-on-surface-variant">Capítulos</span>
                                <select
                                    className="bg-surface-container-high border border-outline-variant text-on-surface px-stack-md py-2 font-label-md text-label-md uppercase focus:border-primary focus:outline-none"
                                    value={selectedSeason}
                                    onChange={(e) => setSelectedSeason(parseInt(e.target.value, 10))}
                                >
                                    {seasons.map(s => <option key={s} value={s}>Temporada {s}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col border border-outline-variant divide-y divide-outline-variant max-h-64 overflow-y-auto">
                                {episodes.length === 0 ? (
                                    <p className="px-stack-md py-stack-md font-body-md text-on-surface-variant opacity-70">Sin episodios cargados para esta temporada.</p>
                                ) : episodes.map(ep => (
                                    <button
                                        key={ep._id}
                                        onClick={() => setCurrentEpisode(ep)}
                                        className={`flex items-center gap-stack-md px-stack-md py-stack-sm text-left transition-colors ${currentEpisode?._id === ep._id ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-container-high text-on-surface'}`}
                                    >
                                        <span className="font-mono-data text-mono-data opacity-70 shrink-0">E{ep.episode}</span>
                                        <span className="font-body-md text-body-md truncate">{ep.title || `Episodio ${ep.episode}`}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata técnica */}
                    <div className="mt-stack-md flex flex-wrap justify-between items-center gap-4 py-stack-sm px-stack-md bg-surface-container-low border border-outline-variant">
                        <div className="flex gap-stack-lg">
                            <div className="flex flex-col"><span className="font-label-md text-[10px] text-on-surface-variant uppercase">Región</span><span className="font-mono-data text-mono-data">{item.region || '—'}</span></div>
                            <div className="flex flex-col"><span className="font-label-md text-[10px] text-on-surface-variant uppercase">Lengua</span><span className="font-mono-data text-mono-data">{item.lengua || '—'}</span></div>
                            <div className="flex flex-col"><span className="font-label-md text-[10px] text-on-surface-variant uppercase">Fondo</span><span className="font-mono-data text-mono-data">{item.fondoEstatal || '—'}</span></div>
                        </div>
                        <div className="flex items-center gap-stack-sm">
                            <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                            <span className="font-label-md text-label-md uppercase tracking-widest text-on-surface">Stream Institucional</span>
                        </div>
                    </div>
                </div>

                {/* Acciones ejecutivas */}
                <div className="col-span-12 lg:col-span-4 p-container-padding bg-surface-container-lowest flex flex-col gap-stack-lg">
                    <div className="flex flex-col border border-outline-variant bg-surface-container">
                        <div className="px-stack-md py-stack-sm border-b border-outline-variant bg-surface-container-high">
                            <span className="font-label-md text-label-md uppercase text-on-surface-variant tracking-widest">Acciones Ejecutivas</span>
                        </div>
                        <div className="p-stack-md flex flex-col gap-stack-sm">
                            <button onClick={toggleWatchlist} disabled={!user} className={`flex items-center justify-between px-stack-md py-4 transition-all disabled:opacity-40 ${inWatchlist ? 'bg-primary-container text-on-primary-container' : 'border border-outline-variant text-on-surface hover:bg-surface-container-highest'}`}>
                                <div className="flex items-center gap-stack-md"><span className="material-symbols-outlined">{inWatchlist ? 'bookmark' : 'bookmark_border'}</span><span className="font-label-md text-label-md uppercase">{inWatchlist ? 'En Mi Lista' : 'Añadir a Mi Lista'}</span></div>
                            </button>
                            <button onClick={captureTimestamp} disabled={!user} className="flex items-center justify-between px-stack-md py-4 bg-primary text-on-primary hover:opacity-90 transition-all disabled:opacity-40 group">
                                <div className="flex items-center gap-stack-md"><span className="material-symbols-outlined">history_toggle_off</span><span className="font-label-md text-label-md uppercase">Anotar Marca de Tiempo</span></div>
                                <span className="material-symbols-outlined opacity-60">add</span>
                            </button>
                            <button onClick={() => generateCitation('APA')} className="flex items-center justify-between px-stack-md py-4 border border-outline-variant text-on-surface hover:bg-surface-container-highest transition-all">
                                <div className="flex items-center gap-stack-md"><span className="material-symbols-outlined">format_quote</span><span className="font-label-md text-label-md uppercase">Generar Cita APA</span></div>
                            </button>
                            <button onClick={() => generateCitation('Chicago')} className="flex items-center justify-between px-stack-md py-4 border border-outline-variant text-on-surface hover:bg-surface-container-highest transition-all">
                                <div className="flex items-center gap-stack-md"><span className="material-symbols-outlined">menu_book</span><span className="font-label-md text-label-md uppercase">Generar Cita Chicago</span></div>
                            </button>
                        </div>
                    </div>
                    {item.overview && (
                        <div className="p-stack-md border-l-4 border-primary bg-primary-container/10 flex flex-col gap-unit">
                            <span className="font-label-md text-label-md text-primary uppercase">Nota del Archivero</span>
                            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{item.overview}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Pestañas inferiores: Ficha / Documentos / Anotaciones / Reseñas */}
            <div className="px-container-padding py-stack-lg">
                <div className="flex gap-0 border-b border-outline-variant mb-stack-lg">
                    {[['ficha', 'Ficha Técnica'], ['docs', `Documentos (${(item.attachments || []).length})`], ['notas', `Mis Anotaciones (${annotations.length})`], ['resenas', `Comunidad (${reviews.length})`]].map(([k, label]) => (
                        <button key={k} onClick={() => setStudyTab(k)} className={`px-stack-lg py-stack-md font-label-md text-label-md uppercase tracking-widest border-b-2 transition-colors ${studyTab === k ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>{label}</button>
                    ))}
                </div>

                {studyTab === 'ficha' && (
                    <table className="w-full text-left border-collapse font-body-md max-w-3xl">
                        <tbody className="divide-y divide-outline-variant border border-outline-variant">
                            {fichaRows.map(([k, v]) => (
                                <tr key={k} className="hover:bg-surface-container-low transition-colors">
                                    <td className="px-stack-md py-3 font-label-md text-label-md text-on-surface-variant uppercase w-1/3 border-r border-outline-variant">{k}</td>
                                    <td className="px-stack-md py-3 text-on-surface">{v || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {studyTab === 'docs' && (
                    (item.attachments || []).length === 0 ? (
                        <p className="text-on-surface-variant font-body-md">No hay documentos adjuntos (guiones, contratos, resoluciones) para este expediente.</p>
                    ) : (
                        <div className="flex flex-col border border-outline-variant max-w-3xl">
                            {(item.attachments || []).map((att) => (
                                <a key={att._id} href={`${API_BASE_URL}/catalog/movies/${id}/attachments/${att._id}/download`} target="_blank" rel="noopener noreferrer"
                                    className="px-stack-md py-5 border-b border-outline-variant hover:bg-surface-container transition-all group flex items-center justify-between">
                                    <div className="flex items-center gap-stack-md">
                                        <div className="w-11 h-11 flex items-center justify-center bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                                            <span className="material-symbols-outlined">picture_as_pdf</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-title-lg text-title-lg text-on-surface">{att.label}</span>
                                            <span className="font-label-md text-label-md text-on-surface-variant uppercase">{att.fileName}</span>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                                </a>
                            ))}
                        </div>
                    )
                )}

                {studyTab === 'notas' && (
                    <div className="max-w-3xl flex flex-col gap-stack-sm">
                        {showNoteBox && (
                            <div className="flex gap-stack-sm items-start bg-surface-container-low border border-outline-variant p-stack-md">
                                <span className="bg-primary text-on-primary px-stack-sm py-unit font-mono-data text-label-md shrink-0">TC: {fmtTime(noteTime)}</span>
                                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Observación de investigación en este minuto…" className="flex-1 bg-surface border border-outline-variant p-stack-sm text-on-surface font-body-md min-h-[60px] focus:border-primary focus:outline-none" />
                                <button onClick={saveAnnotation} className="bg-primary text-on-primary px-stack-md py-2 font-label-md text-label-md uppercase">Guardar</button>
                            </div>
                        )}
                        {!user ? (
                            <p className="text-on-surface-variant font-body-md">Inicia sesión para tomar notas ancladas al minuto.</p>
                        ) : annotations.length === 0 ? (
                            <p className="text-on-surface-variant font-body-md">Aún no tienes anotaciones. Pulsa "Anotar Marca de Tiempo".</p>
                        ) : annotations.map((n) => (
                            <div key={n._id} className="bg-surface-container-low border border-outline-variant p-stack-md hover:border-primary transition-colors flex flex-col gap-stack-sm">
                                <div className="flex justify-between items-start">
                                    <button onClick={() => seekToNote(n.timestampSeconds)} className="bg-primary text-on-primary px-stack-sm py-unit font-mono-data text-label-md">TC: {fmtTime(n.timestampSeconds)}</button>
                                    <button onClick={() => deleteAnnotation(n._id)} className="material-symbols-outlined text-[20px] text-error hover:brightness-125">delete</button>
                                </div>
                                <p className="font-body-md text-body-md text-on-surface leading-relaxed">{n.text}</p>
                            </div>
                        ))}
                    </div>
                )}

                {studyTab === 'resenas' && (
                    <div className="max-w-3xl flex flex-col gap-stack-lg">
                        {user ? (
                            <form onSubmit={submitReview} className="bg-surface-container-low border border-outline-variant p-stack-md flex flex-col gap-stack-sm">
                                <div className="flex items-center gap-unit">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            onClick={() => setNewReview({ ...newReview, rating: star })}
                                            className="material-symbols-outlined cursor-pointer text-[22px]"
                                            style={{ fontVariationSettings: "'FILL' 1", color: star <= (hoverRating || newReview.rating) ? 'var(--color-primary)' : 'var(--color-outline-variant)' }}
                                        >star</span>
                                    ))}
                                </div>
                                <textarea
                                    value={newReview.text}
                                    onChange={(e) => setNewReview({ ...newReview, text: e.target.value })}
                                    placeholder="¿Qué te pareció esta obra?"
                                    className="bg-surface border border-outline-variant p-stack-sm text-on-surface font-body-md min-h-[70px] focus:border-primary focus:outline-none"
                                    required
                                />
                                <div className="flex gap-stack-sm">
                                    <button type="submit" className="bg-primary text-on-primary px-stack-lg py-2 font-label-md text-label-md uppercase w-fit">{editingReviewId ? 'Actualizar' : 'Publicar'}</button>
                                    {editingReviewId && (
                                        <button type="button" onClick={() => { setEditingReviewId(null); setNewReview({ rating: 5, text: '' }); }} className="border border-outline-variant text-on-surface-variant px-stack-lg py-2 font-label-md text-label-md uppercase w-fit">Cancelar</button>
                                    )}
                                </div>
                            </form>
                        ) : (
                            <p className="text-on-surface-variant font-body-md">Inicia sesión para dejar tu opinión.</p>
                        )}

                        {reviews.length === 0 ? (
                            <p className="text-on-surface-variant font-body-md">Nadie ha comentado aún. Sé el primero.</p>
                        ) : reviews.map((rev) => {
                            const isOwner = user && (rev.username === user.username || rev.userId === user.id);
                            return (
                                <div key={rev._id} className="bg-surface-container-low border border-outline-variant p-stack-md flex flex-col gap-stack-sm">
                                    <div className="flex items-center justify-between gap-stack-md">
                                        <div className="flex items-center gap-stack-sm">
                                            <div className="w-8 h-8 bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md">{rev.username?.charAt(0)?.toUpperCase() || 'U'}</div>
                                            <div className="flex flex-col">
                                                <span className="font-body-md text-on-surface font-medium">{rev.username}</span>
                                                <span className="font-mono-data text-[11px] text-on-surface-variant opacity-70">{rev.date || rev.createdAt ? new Date(rev.date || rev.createdAt).toLocaleDateString('es-PE') : ''}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-stack-sm">
                                            <span className="font-mono-data text-mono-data text-primary">★ {rev.rating}</span>
                                            {isOwner && (
                                                <>
                                                    <button onClick={() => editReview(rev)} className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-primary">edit</button>
                                                    <button onClick={() => deleteReview(rev._id)} className="material-symbols-outlined text-[18px] text-error hover:brightness-125">delete</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <p className="font-body-md text-body-md text-on-surface leading-relaxed">{rev.text}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal de cita */}
            {citation && (
                <div onClick={() => setCitation(null)} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
                    <div onClick={(e) => e.stopPropagation()} className="bg-surface-container border border-outline max-w-2xl w-full p-stack-lg">
                        <h3 className="font-headline-sm text-headline-sm uppercase mb-unit">Cita {citation.format}</h3>
                        <p className="font-label-md text-label-md text-on-surface-variant mb-stack-md">Generada desde la ficha y guardada en tu workspace.</p>
                        <div className="bg-surface border border-outline-variant p-stack-md font-mono-data text-mono-data text-on-surface leading-relaxed">{citation.reference}</div>
                        <div className="flex justify-end gap-stack-sm mt-stack-md">
                            <button onClick={() => navigator.clipboard?.writeText(citation.reference)} className="bg-primary text-on-primary px-stack-lg py-2 font-label-md text-label-md uppercase">Copiar</button>
                            <button onClick={() => setCitation(null)} className="border border-outline-variant text-on-surface-variant px-stack-lg py-2 font-label-md text-label-md uppercase">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MovieDetails;
