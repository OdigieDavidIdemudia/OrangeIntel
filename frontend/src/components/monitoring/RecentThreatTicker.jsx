import React, { useEffect, useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

const RecentThreatTicker = ({ threats }) => {
    // threats = [{ title, severity, source, updated_at }]
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!threats || threats.length === 0) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % threats.length);
        }, 10000); // 10s rotation as per spec
        return () => clearInterval(interval);
    }, [threats]);

    if (!threats || threats.length === 0) return (
        <div style={{ padding: '1rem', color: '#6B7280', textAlign: 'center' }}>No recent threats</div>
    );

    const currentThreat = threats[currentIndex];

    return (
        <div style={{
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginTop: '1rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '4px',
                height: '100%',
                background: currentThreat.confidence >= 70 ? '#EF4444' : (currentThreat.confidence >= 40 ? '#F59E0B' : '#3B82F6')
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentThreat.title}
                </h3>
                <span style={{
                    fontSize: '0.8rem',
                    background: 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: '4px'
                }}>
                    {new Date(currentThreat.updatedAt || currentThreat.createdAt).toLocaleTimeString()}
                </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span><Shield size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} /> Score: {Math.round(currentThreat.confidence)}</span>
                <span>Source: {currentThreat.source?.name || 'Unknown'}</span>
            </div>

            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '4px' }}>
                {threats.map((_, idx) => (
                    <div key={idx} style={{
                        height: '4px',
                        flex: 1,
                        background: idx === currentIndex ? 'var(--primary-color)' : 'var(--border-color)',
                        borderRadius: '2px',
                        transition: 'background 0.3s ease'
                    }} />
                ))}
            </div>
        </div>
    );
};

export default RecentThreatTicker;
