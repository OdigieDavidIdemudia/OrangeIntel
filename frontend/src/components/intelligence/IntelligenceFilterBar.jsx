import React from 'react';
import { Filter } from 'lucide-react';
import Select from '../common/Select';

const IntelligenceFilterBar = ({ filters, setFilters, compact = true }) => {
    const priorityOptions = [
        { value: 'All', label: 'ALL PRIORITIES' },
        { value: 'High', label: 'HIGH' },
        { value: 'Medium', label: 'MEDIUM' },
        { value: 'Low', label: 'LOW' }
    ];

    const timeOptions = [
        { value: '0', label: 'ANY TIME' },
        { value: '3', label: 'LAST 3 DAYS' },
        { value: '7', label: 'LAST 7 DAYS' },
        { value: '30', label: 'LAST 30 DAYS' },
        { value: 'custom', label: 'CUSTOM RANGE' }
    ];

    const sectorOptions = [
        { value: 'All', label: 'ALL SECTORS' },
        { value: 'Financial', label: 'FINANCIAL' },
        { value: 'Technology', label: 'TECHNOLOGY' },
        { value: 'Agriculture', label: 'AGRICULTURE' },
        { value: 'Healthcare', label: 'HEALTHCARE' },
        { value: 'Telecom', label: 'TELECOM' },
        { value: 'Hospitality', label: 'HOSPITALITY' },
        { value: 'Government', label: 'GOVERNMENT' },
        { value: 'Energy', label: 'ENERGY' },
        { value: 'Education', label: 'EDUCATION' },
        { value: 'Logistics', label: 'LOGISTICS' }
    ];

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            padding: compact ? '0' : '1.25rem',
            background: compact ? 'transparent' : 'var(--bg-panel)',
            border: compact ? 'none' : '1px solid var(--border-color)',
            borderRadius: '16px',
        }}>
            {/* Priority Filter */}
            <div style={{ minWidth: '130px' }}>
                <Select 
                    value={filters.priority} 
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    options={priorityOptions}
                />
            </div>

            {/* Sector Filter */}
            <div style={{ minWidth: '130px' }}>
                <Select 
                    value={filters.sector} 
                    onChange={(e) => handleFilterChange('sector', e.target.value)}
                    options={sectorOptions}
                />
            </div>

            {/* Time Filter */}
            <div style={{ minWidth: '130px' }}>
                <Select 
                    value={filters.days} 
                    onChange={(e) => handleFilterChange('days', e.target.value)}
                    options={timeOptions}
                />
            </div>

            {/* Custom Range Date Pickers */}
            {filters.days === 'custom' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0 0.5rem' }}>
                    <input 
                        type="date" 
                        value={filters.startDate || ''} 
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                        style={{
                            padding: '0.45rem 0.6rem',
                            backgroundColor: 'var(--bg-panel)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            outline: 'none'
                        }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>to</span>
                    <input 
                        type="date" 
                        value={filters.endDate || ''} 
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        style={{
                            padding: '0.45rem 0.6rem',
                            backgroundColor: 'var(--bg-panel)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            outline: 'none'
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default IntelligenceFilterBar;
