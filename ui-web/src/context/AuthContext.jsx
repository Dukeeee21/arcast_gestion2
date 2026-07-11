import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem('arcast_user');
        if (saved) {
            try { setUser(JSON.parse(saved)); } catch { localStorage.clear(); }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await api.post('/auth/login', { email, password });
            localStorage.setItem('arcast_token', data.token);
            localStorage.setItem('arcast_user', JSON.stringify(data.user));
            setUser(data.user);
            return { success: true };
        } catch (err) { return { success: false, message: err.message }; }
    };

    const loginWithGoogle = async (credential) => {
        try {
            const { data } = await api.post('/auth/google', { credential });
            localStorage.setItem('arcast_token', data.token);
            localStorage.setItem('arcast_user', JSON.stringify(data.user));
            setUser(data.user);
            return { success: true };
        } catch (err) { return { success: false, message: err.message }; }
    };

    const register = async (username, email, password, extra = {}) => {
        try {
            await api.post('/auth/register', { username, email, password, ...extra });
            return await login(email, password); // Auto-login tras registrarse
        } catch (err) { return { success: false, message: err.message }; }
    };

    const logout = () => {
        localStorage.clear();
        setUser(null);
        window.location.replace('/'); // Resetea la URL a / para que el próximo usuario empiece limpio
    };

    // FIX: Agregamos loading al value para que App.jsx lo detecte
    const value = useMemo(() => ({
        user, login, loginWithGoogle, register, logout,
        isAuthenticated: !!user,
        loading
    }), [user, loading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);