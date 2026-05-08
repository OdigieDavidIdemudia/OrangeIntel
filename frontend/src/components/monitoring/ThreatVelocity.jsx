import React from 'react';
import { Activity, ArrowUpRight } from 'lucide-react';

const ThreatVelocity = ({ velocity }) => {
    // velocity = { status: "Normal" | "SpikeDetected", baselineRate, currentRate }

    const isSpike = velocity?.status === 'SpikeDetected';
    const color = isSpike ? '#EF4444' : '#10B981';

    return (
        <div style={{
            background: isSpike ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface-color)',
            border: `1px solid ${color}`,
            borderRadius: '12px',
            padding: '1rem',
            marginTop: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    background: color,
                    padding: '8px',
                    borderRadius: '50%',
                    display: 'flex'
                }}>
                    <Activity size={20} color="#fff" />
                </div>
                <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>THREAT VELOCITY</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isSpike ? '#EF4444' : 'var(--text-primary)' }}>
                        {isSpike ? 'ABNORMAL ACTIVITY' : 'NORMAL'}
                    </div>
                </div>
            </div>

            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {velocity?.currentRate || 0} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>/hr</span>
                </div>
                {isSpike && (
                    <div style={{ color: '#EF4444', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <ArrowUpRight size={14} /> Spike Detected
                    </div>
                )}
            </div>
        </div>
    );
};

export default ThreatVelocity;
