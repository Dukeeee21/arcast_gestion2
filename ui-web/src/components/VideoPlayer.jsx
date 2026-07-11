import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

// Iconos SVG minimalistas para los controles del reproductor (sin emojis).
const Icon = ({ children, size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{children}</svg>
);
const IconPlay = () => <Icon><path d="M8 5v14l11-7z" /></Icon>;
const IconPause = () => <Icon><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></Icon>;
const IconVolume = () => <Icon><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z" /></Icon>;
const IconVolumeLow = () => <Icon><path d="M3 10v4h4l5 5V5L7 10H3zm11 .5a3 3 0 0 1 0 3v-3z" /></Icon>;
const IconVolumeMute = () => <Icon><path d="M3 10v4h4l5 5V5L7 10H3zm13.6 2 2.2-2.2-1.4-1.4L15.2 10.6 13 8.4 11.6 9.8 13.8 12l-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4z" /></Icon>;
const IconFullscreen = () => <Icon><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></Icon>;

const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoPlayer = forwardRef(({ src, title, onProgress, progressLoading, startTime }, ref) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const hideControlsTimer = useRef(null);

    // API imperativa para el padre (MovieDetails): leer el cronómetro exacto al
    // "Anotar" y saltar a la marca de tiempo de una nota guardada.
    useImperativeHandle(ref, () => ({
        getCurrentTime: () => videoRef.current?.currentTime || 0,
        seekTo: (seconds) => {
            const video = videoRef.current;
            if (!video) return;
            video.currentTime = seconds;
            setCurrentTime(seconds);
        },
    }));

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [buffered, setBuffered] = useState(0);
    const [error, setError] = useState(null);

    // --- Progreso de visualización: recuperación y reanudación ---
    const [metadataLoaded, setMetadataLoaded] = useState(false);
    const [resumeApplied, setResumeApplied] = useState(false);
    const [showResumeToast, setShowResumeToast] = useState(false);

    // Cuando cambia la fuente (película/episodio/pestaña distinta), reseteamos
    // todo el estado relacionado a metadata y reanudación de progreso.
    useEffect(() => {
        setMetadataLoaded(false);
        setResumeApplied(false);
        setShowResumeToast(false);
        setCurrentTime(0);
        setDuration(0);
        setPlaying(false);
        setError(null);
    }, [src]);

    // Una vez que los metadatos del video cargaron Y ya sabemos si hay progreso
    // guardado (progressLoading === false), aplicamos el salto a la posición
    // guardada y mostramos el feedback visual de "reanudando desde...".
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !metadataLoaded || progressLoading || resumeApplied) return;

        if (startTime && startTime > 1 && video.duration && startTime < video.duration - 1) {
            video.currentTime = startTime;
            setCurrentTime(startTime);
            setResumeApplied(true);
            setShowResumeToast(true);
            const timer = setTimeout(() => setShowResumeToast(false), 4500);
            return () => clearTimeout(timer);
        }
        setResumeApplied(true);
    }, [metadataLoaded, progressLoading, startTime, resumeApplied]);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch(() => setError('No se pudo reproducir el video.'));
            setPlaying(true);
        } else {
            video.pause();
            setPlaying(false);
        }
    };

    const handleSeek = (e) => {
        const video = videoRef.current;
        if (!video) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        video.currentTime = ratio * video.duration;
    };

    const handleVolume = (e) => {
        const val = parseFloat(e.target.value);
        videoRef.current.volume = val;
        setVolume(val);
        setMuted(val === 0);
    };

    const toggleMute = () => {
        const video = videoRef.current;
        video.muted = !video.muted;
        setMuted(video.muted);
    };

    const toggleFullscreen = () => {
        const el = containerRef.current;
        if (!document.fullscreenElement) {
            el.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const resetHideTimer = useCallback(() => {
        setShowControls(true);
        clearTimeout(hideControlsTimer.current);
        hideControlsTimer.current = setTimeout(() => {
            if (playing) setShowControls(false);
        }, 3000);
    }, [playing]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (onProgress && video.duration) {
                onProgress(video.currentTime, video.duration);
            }
            // Calcular buffer
            if (video.buffered.length > 0) {
                setBuffered(video.buffered.end(video.buffered.length - 1));
            }
        };
        const onLoadedMetadata = () => {
            setDuration(video.duration);
            setMetadataLoaded(true);
        };
        const onEnded = () => setPlaying(false);
        const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('ended', onEnded);
        document.addEventListener('fullscreenchange', onFullscreenChange);

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('ended', onEnded);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            clearTimeout(hideControlsTimer.current);
        };
    }, [onProgress]);

    if (!src) {
        return (
            <div style={{
                width: '100%', aspectRatio: '16/9', background: '#0a0a0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)'
            }}>
                <p style={{ color: '#64748b', fontWeight: 700 }}>Contenido local no disponible</p>
            </div>
        );
    }

    const progressPercent = duration ? (currentTime / duration) * 100 : 0;
    const bufferedPercent = duration ? (buffered / duration) * 100 : 0;

    return (
        <div
            ref={containerRef}
            onMouseMove={resetHideTimer}
            onMouseLeave={() => playing && setShowControls(false)}
            style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/9',
                background: '#000',
                borderRadius: isFullscreen ? '0' : '16px',
                overflow: 'hidden',
                cursor: showControls ? 'default' : 'none',
            }}
        >
            {/* VIDEO */}
            <video
                ref={videoRef}
                src={src}
                style={{ width: '100%', height: '100%', display: 'block' }}
                onClick={togglePlay}
                onError={() => setError('Error al cargar el video. Verifica el archivo.')}
            />

            {/* ESTADO DE CARGA: buscando progreso guardado y/o cargando metadata del video */}
            {!error && (progressLoading || !metadataLoaded) && (
                <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(5,8,15,0.78)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '14px', zIndex: 10
                }}>
                    <div style={{
                        width: '42px', height: '42px', borderRadius: '50%',
                        border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#7a5cff',
                        animation: 'arcast-player-spin 0.8s linear infinite'
                    }} />
                    <p style={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.02em' }}>
                        {progressLoading ? 'Buscando tu progreso guardado…' : 'Cargando video…'}
                    </p>
                </div>
            )}

            {/* TOAST: feedback de reanudación desde el último punto visualizado */}
            {showResumeToast && (
                <div style={{
                    position: 'absolute', top: title ? '60px' : '16px', left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(13,17,23,0.92)', border: '1px solid rgba(122, 92, 255,0.35)',
                    color: '#7a5cff', fontWeight: 700, fontSize: '0.82rem',
                    padding: '8px 16px', borderRadius: '999px',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
                    zIndex: 9, pointerEvents: 'none',
                    animation: 'arcast-player-fadein 0.3s ease-out'
                }}>
                    <span>Reanudando desde {formatTime(startTime)}</span>
                </div>
            )}

            <style>{`
                @keyframes arcast-player-spin { to { transform: rotate(360deg); } }
                @keyframes arcast-player-fadein {
                    from { opacity: 0; transform: translate(-50%, -6px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>

            {/* ERROR */}
            {error && (
                <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <p style={{ color: '#ef4444', fontWeight: 700 }}>{error}</p>
                </div>
            )}

            {/* TÍTULO */}
            {showControls && title && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    padding: '20px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
                    color: 'white', fontWeight: 700, fontSize: '1rem',
                    transition: 'opacity 0.3s'
                }}>
                    {title}
                </div>
            )}

            {/* CONTROLES */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '12px 16px 16px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                opacity: showControls ? 1 : 0,
                transition: 'opacity 0.3s',
                display: 'flex', flexDirection: 'column', gap: '10px'
            }}>
                {/* BARRA DE PROGRESO */}
                <div
                    onClick={handleSeek}
                    style={{
                        width: '100%', height: '5px', background: 'rgba(255,255,255,0.2)',
                        borderRadius: '5px', cursor: 'pointer', position: 'relative'
                    }}
                >
                    {/* Buffer */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, height: '100%',
                        width: `${bufferedPercent}%`,
                        background: 'rgba(255,255,255,0.35)', borderRadius: '5px'
                    }} />
                    {/* Progreso */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, height: '100%',
                        width: `${progressPercent}%`,
                        background: '#7a5cff', borderRadius: '5px',
                        transition: 'width 0.1s linear'
                    }} />
                    {/* Thumb */}
                    <div style={{
                        position: 'absolute', top: '50%',
                        left: `${progressPercent}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '13px', height: '13px',
                        background: 'white', borderRadius: '50%',
                        boxShadow: '0 0 6px rgba(122, 92, 255,0.8)'
                    }} />
                </div>

                {/* FILA DE BOTONES */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Play/Pause */}
                    <button onClick={togglePlay} style={btnStyle} aria-label={playing ? 'Pausar' : 'Reproducir'}>
                        {playing ? <IconPause /> : <IconPlay />}
                    </button>

                    {/* Volumen */}
                    <button onClick={toggleMute} style={btnStyle} aria-label="Volumen">
                        {muted || volume === 0 ? <IconVolumeMute /> : volume < 0.5 ? <IconVolumeLow /> : <IconVolume />}
                    </button>
                    <input
                        type="range" min="0" max="1" step="0.05"
                        value={muted ? 0 : volume}
                        onChange={handleVolume}
                        style={{ width: '80px', accentColor: '#7a5cff', cursor: 'pointer' }}
                    />

                    {/* Tiempo */}
                    <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600, marginLeft: '4px' }}>
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>

                    {/* Spacer */}
                    <div style={{ flex: 1 }} />

                    {/* Fullscreen */}
                    <button onClick={toggleFullscreen} style={btnStyle} aria-label="Pantalla completa">
                        <IconFullscreen />
                    </button>
                </div>
            </div>
        </div>
    );
});

VideoPlayer.displayName = 'VideoPlayer';

const btnStyle = {
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '4px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

export default VideoPlayer;