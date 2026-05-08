import React, { useState, useEffect } from 'react';

const ThreatHeartbeat = ({ lastThreatTime }) => {
    const [timeDiff, setTimeDiff] = useState(lastThreatTime ? '00:00:00' : '--:--:--');
    const [color, setColor] = useState(lastThreatTime ? '#10B981' : '#6B7280'); // Green or Grey

    useEffect(() => {
        if (!lastThreatTime) return;

        const updateHeartbeat = () => {
            const now = new Date();
            const last = new Date(lastThreatTime);
            const diffMs = now - last;
            const diffMins = Math.floor(diffMs / 60000);

            // Format HH:MM:SS
            const hours = Math.floor(diffMs / 3600000);
            const minutes = Math.floor((diffMs % 3600000) / 60000);
            const seconds = Math.floor((diffMs % 60000) / 1000);

            setTimeDiff(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );

            // Color Rules
            if (diffMins < 30) setColor('#10B981'); // Green
            else if (diffMins < 120) setColor('#F59E0B'); // Amber
            else setColor('#6B7280'); // Grey
        };

        updateHeartbeat(); // Run immediately when lastThreatTime changes
        const interval = setInterval(updateHeartbeat, 1000);

        return () => clearInterval(interval);
    }, [lastThreatTime]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2rem',
            background: 'var(--surface-color)',
            borderRadius: '16px',
            border: `2px solid ${color}`,
            boxShadow: `0 0 20px ${color}33`,
            transition: 'border-color 0.5s ease'
        }}>
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Time Since Last Threat
            </span>
            <span style={{
                fontSize: '4rem',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                color: color,
                marginTop: '1rem',
                textShadow: `0 0 10px ${color}66`
            }}>
                {timeDiff}
            </span>
        </div>
    );
};

export default ThreatHeartbeat;
