import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [form, setForm] = useState({ user: '', pass: '' });
    const [err, setErr] = useState('');
    const { login } = useAuth();

    const handle = async (e) => {
        e.preventDefault();
        setErr('');
        const res = await login(form.user, form.pass);
        if (!res.success) setErr(res.message);
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-[#1e293b] p-10 rounded-3xl border border-gray-800 shadow-2xl">
                <div className="text-center mb-10">
                    <h1 className="text-5xl font-black text-white italic mb-2">ARCAST</h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Plataforma Institucional</p>
                </div>
                {err && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6 text-xs font-bold text-center">{err}</div>}
                <form onSubmit={handle} className="space-y-6">
                    <input
                        type="text" placeholder="USUARIO" required
                        className="w-full bg-[#0f172a] border border-gray-700 text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-bold text-sm"
                        onChange={e => setForm({...form, user: e.target.value})}
                    />
                    <input
                        type="password" placeholder="CONTRASEÑA" required
                        className="w-full bg-[#0f172a] border border-gray-700 text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-bold text-sm"
                        onChange={e => setForm({...form, pass: e.target.value})}
                    />
                    <button className="w-full bg-cyan-600 hover:bg-cyan-500 text-[#0f172a] font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest">Ingresar</button>
                </form>
            </div>
        </div>
    );
};

export default Login;