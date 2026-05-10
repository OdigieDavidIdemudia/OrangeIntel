import React from 'react';
import Select from '../common/Select';

const IntelligenceFilterBar = ({ filters, setFilters, compact = true }) => {
    const priorityOptions = [
        { value: 'All', label: 'All Priorities' },
        { value: 'High', label: 'High' },
        { value: 'Medium', label: 'Medium' },
        { value: 'Low', label: 'Low' },
    ];

    const timeOptions = [
        { value: '0', label: 'Any Time' },
        { value: '3', label: 'Last 3 Days' },
        { value: '7', label: 'Last 7 Days' },
        { value: '30', label: 'Last 30 Days' },
        { value: 'custom', label: 'Custom Range' },
    ];

    const sectorOptions = [
        { value: 'All', label: 'All Sectors' },
        { value: 'Financial', label: 'Financial' },
        { value: 'Technology', label: 'Technology' },
        { value: 'Agriculture', label: 'Agriculture' },
        { value: 'Healthcare', label: 'Healthcare' },
        { value: 'Telecom', label: 'Telecom' },
        { value: 'Hospitality', label: 'Hospitality' },
        { value: 'Government', label: 'Government' },
        { value: 'Energy', label: 'Energy' },
        { value: 'Education', label: 'Education' },
        { value: 'Logistics', label: 'Logistics' },
    ];

    const set = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

    const dateInputStyle = {
        height: 'var(--ctrl-height)',
        fontSize: 'var(--ctrl-font-size)',
        fontWeight: 'var(--ctrl-font-weight)',
        padding: '0 var(--ctrl-padding-x)',
        borderRadius: 'var(--ctrl-border-radius)',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-panel)',
        color: 'var(--text-secondary)',
        fontFamily: 'inherit',
        outline: 'none',
        colorScheme: 'dark',
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Select value={filters.priority} onChange={e => set('priority', e.target.value)} options={priorityOptions} />
            <Select value={filters.sector}   onChange={e => set('sector', e.target.value)}   options={sectorOptions} />
            <Select value={filters.days}     onChange={e => set('days', e.target.value)}     options={timeOptions} />

            {filters.days === 'custom' && (
                <>
                    <input type="date" value={filters.startDate || ''} onChange={e => set('startDate', e.target.value)} style={dateInputStyle} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>to</span>
                    <input type="date" value={filters.endDate || ''}   onChange={e => set('endDate', e.target.value)}   style={dateInputStyle} />
                </>
            )}
        </div>
    );
};

export default IntelligenceFilterBar;
