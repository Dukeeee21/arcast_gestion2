import React from 'react';
import { useNavigate } from 'react-router-dom';

const AIResultCard = ({ item }) => {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => navigate(`/item/${item.mediaType || 'movie'}/${item._id}`)}
            className="bg-[#161b22] border border-white/10 rounded-2xl overflow-hidden hover:border-[#7a5cff]/50 transition-all cursor-pointer shadow-lg group"
        >
            <div className="flex flex-col sm:flex-row h-full">
                <div className="relative w-full sm:w-36 h-56 flex-shrink-0 overflow-hidden" style={{background:'linear-gradient(160deg,#181e2e,#0d1117)'}}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/20 text-xs text-center p-3 pointer-events-none">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{opacity:0.25}}><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                        <span>{(item.title || item.name)?.slice(0, 24)}</span>
                    </div>
                    <img
                        src={item.posterUrl || ''}
                        alt={item.title || item.name}
                        className="relative z-10 w-full h-full object-cover group-hover:brightness-110 transition-all"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.pointerEvents = 'none'; }}
                    />
                </div>
                <div className="p-5 flex flex-col justify-between flex-1">
                    <div>
                        <div className="flex justify-between items-start mb-2 gap-4">
                            <h3 className="font-bold text-white text-lg leading-tight">{item.title || item.name}</h3>
                            <span className="text-xs font-mono bg-[#7a5cff]/15 text-[#7a5cff] px-2 py-1 rounded whitespace-nowrap">
                                ★ {item.voteAverage?.toFixed(1) || 'N/A'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-4 font-medium uppercase tracking-wider">
                            {(item.releaseDate || item.firstAirDate)?.split('-')[0]} • {item.mediaType === 'movie' ? 'Película' : 'Serie'}
                        </p>

                        <div className="bg-[#7a5cff]/10 p-3 rounded-xl border border-[#7a5cff]/20">
                            <span className="block text-[10px] font-black uppercase tracking-wider text-[#7a5cff] mb-1">Sugerencia IA</span>
                            <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                                {item.aiExplanation}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIResultCard;