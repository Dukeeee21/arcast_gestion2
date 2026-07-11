import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Etiqueta legible del rol para el encabezado.
const ROLE_LABEL = {
    user: 'Investigador Senior',
    tecnico: 'Técnico de Ingesta',
    admin: 'Supervisor',
};

const NavItem = ({ icon, label, path, active, onClick }) => (
    <a
        href="#"
        onClick={(e) => { e.preventDefault(); onClick(path); }}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center px-container-padding py-3 transition-all ${active
            ? 'bg-primary-container text-on-primary-container border-l-4 border-primary'
            : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border-l-4 border-transparent'}`}
    >
        <span className="material-symbols-outlined mr-gutter">{icon}</span>
        <span className="font-label-md text-label-md">{label}</span>
    </a>
);

// Búsqueda RÁPIDA por título (regex directo en BD, no IA) — deliberadamente
// separada del "Modo IA" (búsqueda semántica) y del filtrado del catálogo
// (género/orden). Vive en el header, visible desde cualquier pantalla.
const QuickSearch = () => {
    const navigate = useNavigate();
    const [term, setTerm] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (term.trim().length < 2) { setOpen(false); return; }
        let cancelled = false;
        const timer = setTimeout(() => {
            Promise.all([
                api.get('/catalog/movies', { params: { search: term } }),
                api.get('/catalog/tvshows', { params: { search: term } }),
            ]).then(([m, t]) => {
                if (cancelled) return;
                const combined = [
                    ...m.data.map((i) => ({ ...i, mediaType: 'movie' })),
                    ...t.data.map((i) => ({ ...i, mediaType: 'tvshow' })),
                ];
                setResults(combined.slice(0, 6));
                setOpen(true);
            }).catch(() => { if (!cancelled) setOpen(false); });
        }, 250);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [term]);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const goTo = (item) => {
        setOpen(false); setTerm('');
        navigate(`/item/${item.mediaType}/${item._id}`);
    };

    return (
        <div ref={wrapRef} className="relative w-full max-w-md">
            <div className="relative">
                <span className="material-symbols-outlined absolute left-stack-sm top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">search</span>
                <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder="Buscar por título…"
                    className="w-full h-11 pl-11 pr-stack-md bg-surface-container-high border border-outline-variant text-on-surface font-body-md focus:border-primary focus:outline-none transition-colors placeholder:text-outline/60"
                />
            </div>
            {open && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container border border-outline-variant shadow-xl z-50 max-h-96 overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="px-stack-md py-stack-md font-body-md text-on-surface-variant opacity-70">Sin resultados para "{term}"</div>
                    ) : results.map((item) => (
                        <button
                            key={`${item.mediaType}-${item._id}`}
                            onClick={() => goTo(item)}
                            className="w-full flex items-center gap-stack-md px-stack-md py-stack-sm hover:bg-surface-container-highest transition-colors text-left border-b border-outline-variant last:border-b-0"
                        >
                            <div className="w-9 h-12 bg-surface-container-highest flex-shrink-0 overflow-hidden">
                                {item.posterUrl && <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="min-w-0">
                                <div className="font-body-md text-on-surface truncate">{item.title || item.name}</div>
                                <div className="font-label-md text-[10px] text-on-surface-variant uppercase tracking-wider opacity-70">
                                    {(item.releaseDate || item.firstAirDate || '').slice(0, 4) || '—'} · {item.mediaType === 'movie' ? 'Película' : 'Serie'}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const AppShell = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const role = user?.role || 'user';

    const go = (path) => navigate(path);
    const isActive = (path) => {
        if (path === '/') return location.pathname === '/' || location.pathname === '/home';
        return location.pathname.startsWith(path);
    };

    // Navegación principal según el rol.
    const mainNav = [
        { icon: 'folder_zip', label: 'CATÁLOGO', path: '/', roles: ['user', 'tecnico', 'admin'] },
        { icon: 'auto_awesome', label: 'MODO IA', path: '/semantic-search', roles: ['user', 'tecnico', 'admin'] },
        { icon: 'play_circle', label: 'CONTINUAR VIENDO', path: '/continue-watching', roles: ['user', 'tecnico', 'admin'] },
        { icon: 'history', label: 'HISTORIAL', path: '/history', roles: ['user', 'tecnico', 'admin'] },
        { icon: 'workspaces', label: 'MI WORKSPACE', path: '/profile', roles: ['user', 'tecnico', 'admin'] },
    ].filter((i) => i.roles.includes(role));

    const systemNav = [
        { icon: 'admin_panel_settings', label: 'ADMINISTRACIÓN', path: '/admin', roles: ['tecnico', 'admin'] },
        { icon: 'policy', label: 'SUPERVISIÓN', path: '/supervision', roles: ['admin'] },
    ].filter((i) => i.roles.includes(role));

    const avatarInitials = (user?.username || 'US').slice(0, 2).toUpperCase();

    return (
        <div className="bg-background text-on-background min-h-screen">
            {/* SIDEBAR */}
            <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container border-r border-outline-variant z-50 flex flex-col">
                <div className="p-stack-lg border-b border-outline-variant flex items-center gap-stack-sm">
                    <img src="/logo-icon.png" alt="Arcast" className="w-9 h-9 object-contain" />
                    <span className="font-headline-sm text-headline-sm tracking-tight uppercase leading-tight">ARCAST<span className="text-primary">.</span></span>
                </div>
                <nav className="flex-1 py-stack-md flex flex-col gap-unit">
                    {mainNav.map((i) => (
                        <NavItem key={i.path} {...i} active={isActive(i.path)} onClick={go} />
                    ))}
                </nav>
                {systemNav.length > 0 && (
                    <div className="mt-auto border-t border-outline-variant py-stack-md flex flex-col gap-unit">
                        <div className="px-container-padding py-unit text-on-tertiary-container font-label-md text-label-md opacity-60">SISTEMA</div>
                        {systemNav.map((i) => (
                            <NavItem key={i.path} {...i} active={isActive(i.path)} onClick={go} />
                        ))}
                    </div>
                )}
            </aside>

            {/* HEADER + CONTENIDO */}
            <div className="pl-72">
                <header className="fixed top-0 left-72 right-0 h-20 bg-surface/90 backdrop-blur-md border-b border-outline-variant z-40 flex items-center justify-between px-container-padding">
                    <div className="flex items-center gap-stack-md flex-shrink-0">
                        <div className="flex items-center gap-stack-sm border-l-2 border-primary pl-stack-sm">
                            <img src="/logo-icon.png" alt="Arcast" className="w-7 h-7 object-contain" />
                            <span className="font-headline-sm text-headline-sm">ARCAST<span className="text-primary">.</span></span>
                        </div>
                    </div>
                    <div className="flex-1 flex justify-center px-container-padding">
                        <QuickSearch />
                    </div>
                    <div className="flex items-center gap-stack-lg flex-shrink-0">
                        <div className="flex flex-col text-right">
                            <span className="font-label-md text-label-md text-on-surface uppercase">{ROLE_LABEL[role] || 'Usuario'}</span>
                            <span className="font-mono-data text-mono-data text-on-surface-variant opacity-70">{user?.username || '—'}</span>
                        </div>
                        <div className="w-10 h-10 bg-primary-container border border-outline flex items-center justify-center text-on-primary-container font-label-md text-label-md">
                            {avatarInitials}
                        </div>
                        <button
                            onClick={logout}
                            title="Cerrar sesión"
                            className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors"
                        >
                            logout
                        </button>
                    </div>
                </header>
                <main className="relative pt-20 min-h-screen bg-background">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AppShell;
