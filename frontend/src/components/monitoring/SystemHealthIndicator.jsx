import React from 'react';
import { Server, Database } from 'lucide-react';

const StatusDot = ({ status }) => (
    <span style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: status === 'Connected' || status === 'Active' || status === 'Healthy' ? '#10B981' : '#EF4444',
        marginRight: '6px'
    }} />
);

const SystemHealthIndicator = ({ health }) => {
    // health = { status: "Healthy", database: "Connected", ingestion: "Active" }

    return (
        <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: 'auto', // Push to bottom if flex container allows
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <Database size={14} style={{ marginRight: 6 }} />
                <StatusDot status={health?.database} /> DB: {health?.database || 'Unknown'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <Server size={14} style={{ marginRight: 6 }} />
                <StatusDot status={health?.ingestion} /> Ingest: {health?.ingestion || 'Unknown'}
            </div>
        </div>
    );
};

export default SystemHealthIndicator;
