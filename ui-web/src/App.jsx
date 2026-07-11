import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import api from './services/api';

import ContinueWatching from './views/ContinueWatching';
import History from './views/History';
import Auth from './components/Auth';
import AppShell from './components/AppShell';
import Home from './views/Home';
import AdminPanel from './views/AdminPanel';
import MovieDetails from './views/MovieDetails';
import Profile from './views/Profile';
import SemanticSearch from './views/SemanticSearch';
import Supervision from './views/Supervision';
import './index.css';

const App = () => {
    const { isAuthenticated, user } = useAuth();

    useEffect(() => {
        api.get('/system/config')
            .then(res => {
                const config = Array.isArray(res.data) ? res.data[0] : res.data;
                const customCSS = config?.customCSS;
                if (customCSS) {
                    let styleTag = document.getElementById('arcast-custom-css');
                    if (!styleTag) {
                        styleTag = document.createElement('style');
                        styleTag.id = 'arcast-custom-css';
                        document.head.appendChild(styleTag);
                    }
                    styleTag.innerHTML = customCSS;
                }
            })
            .catch(err => console.error('Error:', err));
    }, []);

    if (!isAuthenticated) return <Auth />;

    const isStaff = user?.role === 'admin' || user?.role === 'tecnico';

    return (
        <AppShell>
            <Routes>
                <Route path="/" element={
                    isStaff ? <Navigate to="/admin" replace /> : <Home />
                } />
                <Route path="/profile" element={<Profile />} />
                <Route path="/item/:type/:id" element={<MovieDetails />} />
                <Route path="/admin" element={isStaff ? <AdminPanel /> : <Navigate to="/" replace />} />
                <Route path="/supervision" element={
                    user?.role === 'admin' ? <Supervision /> : <Navigate to="/" replace />
                } />
                <Route path="/semantic-search" element={<SemanticSearch />} />
                <Route path="/continue-watching" element={<ContinueWatching />} />
                <Route path="/history" element={<History />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AppShell>
    );
};

export default App;
