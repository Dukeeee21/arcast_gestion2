import React, { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ username: '', email: '', password: '', region: '', institution: '', consentPII: false });
    const [error, setError] = useState('');
    const [departamentos, setDepartamentos] = useState([]);
    const { login, loginWithGoogle, register } = useAuth();

    // Catálogo oficial de departamentos para el dato demográfico obligatorio.
    useEffect(() => {
        if (!isLogin && departamentos.length === 0) {
            api.get('/system/catalogs').then(res => setDepartamentos(res.data?.departamentos || [])).catch(() => {});
        }
    }, [isLogin, departamentos.length]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isLogin) {
            if (!form.region) return setError('Selecciona tu región (departamento).');
            if (!form.consentPII) return setError('Debes aceptar el tratamiento de datos personales (Ley N° 29733).');
        }

        const res = isLogin
            ? await login(form.email, form.password)
            : await register(form.username, form.email, form.password, {
                region: form.region, institution: form.institution, consentPII: form.consentPII,
            });

        if (!res.success) setError(res.message);
    };

    // Solo cambia el JSX de retorno para limpiar las clases de Tailwind que estorban
    return (
        <div className="auth-screen-wrapper">
            <div className="auth-main-container">
                <div className="auth-header-text">
                    <h1>{isLogin ? "Inicia sesión" : "Crea tu cuenta"}</h1>
                    <p>{isLogin ? "¡Bienvenido de nuevo!" : "Únete a la comunidad Arcast hoy"}</p>
                </div>

                {error && <div className="auth-error-msg">{error}</div>}

                <form onSubmit={handleSubmit} className="arcast-auth-card">
                    {!isLogin && (
                        <div className="auth-input-field">
                            <label>Nombre de usuario</label>
                            <input
                                type="text" required
                                className="arcast-auth-input"
                                value={form.username}
                                onChange={e => setForm({...form, username: e.target.value})}
                            />
                        </div>
                    )}

                    <div className="auth-input-field">
                        <label>Correo electrónico</label>
                        <input
                            type="email" required
                            className="arcast-auth-input"
                            value={form.email}
                            onChange={e => setForm({...form, email: e.target.value})}
                        />
                    </div>

                    <div className="auth-input-field">
                        <div className="label-with-link">
                            <label>Contraseña</label>
                        </div>
                        <input
                            type="password" required
                            className="arcast-auth-input"
                            value={form.password}
                            onChange={e => setForm({...form, password: e.target.value})}
                        />
                    </div>

                    {!isLogin && (
                        <>
                            <div className="auth-input-field">
                                <label>Región / Departamento</label>
                                <select
                                    required
                                    className="arcast-auth-input"
                                    value={form.region}
                                    onChange={e => setForm({ ...form, region: e.target.value })}
                                >
                                    <option value="">Selecciona tu departamento…</option>
                                    {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            <div className="auth-input-field">
                                <label>Institución (opcional)</label>
                                <input
                                    type="text"
                                    className="arcast-auth-input"
                                    placeholder="Ej: Ministerio de Cultura"
                                    value={form.institution}
                                    onChange={e => setForm({ ...form, institution: e.target.value })}
                                />
                            </div>

                            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={form.consentPII}
                                    onChange={e => setForm({ ...form, consentPII: e.target.checked })}
                                    style={{ marginTop: '3px' }}
                                />
                                <span>Autorizo el tratamiento de mis datos personales (región/institución) con fines estadísticos institucionales, conforme a la Ley N° 29733.</span>
                            </label>
                        </>
                    )}

                    <button type="submit" className="arcast-auth-btn">
                        {isLogin ? "Iniciar sesión" : "Registrarse"}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>o continúa con</span>
                </div>

                <div className="auth-google-btn">
                    <GoogleLogin
                        onSuccess={async ({ credential }) => {
                            const res = await loginWithGoogle(credential);
                            if (!res.success) setError(res.message);
                        }}
                        onError={() => setError('No se pudo iniciar sesión con Google.')}
                        width="100%"
                        theme="filled_black"
                        text={isLogin ? 'signin_with' : 'signup_with'}
                        shape="rectangular"
                        locale="es"
                    />
                </div>

                <div className="auth-footer-box">
                    <p>
                        {isLogin ? "¿No tienes una cuenta? " : "¿Ya tienes una cuenta? "}
                        <button
                            type="button"
                            onClick={() => { setIsLogin(!isLogin); setError(''); setForm({ username: '', email: '', password: '', region: '', institution: '', consentPII: false }); }}
                        >
                            {isLogin ? "Crea una cuenta" : "Inicia sesión"}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;