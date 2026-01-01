import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { createPortal } from 'react-dom';

const Select = ({ value, onChange, options, placeholder = "Select...", className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef(null);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(o => o.value === value);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOpen = () => {
        if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
        setIsOpen(!isOpen);
    };

    const handleSelect = (val) => {
        if (onChange) onChange({ target: { value: val } });
        setIsOpen(false);
    };

    return (
        <>
            <div
                ref={containerRef}
                className={className}
                onClick={toggleOpen}
                style={{
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    userSelect: 'none'
                }}
            >
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} color="var(--text-secondary)" />
            </div>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: position.top,
                        left: position.left,
                        width: position.width,
                        backgroundColor: 'var(--bg-panel)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        boxShadow: 'var(--shadow-md)',
                        zIndex: 9999,
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}
                >
                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            onClick={() => handleSelect(opt.value)}
                            style={{
                                padding: '0.75rem',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: opt.value === value ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                                borderLeft: opt.value === value ? '3px solid var(--color-brand)' : '3px solid transparent'
                            }}
                            onMouseEnter={(e) => {
                                if (opt.value !== value) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                            }}
                            onMouseLeave={(e) => {
                                if (opt.value !== value) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <span>{opt.label}</span>
                            {opt.value === value && <Check size={14} color="var(--color-brand)" />}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
};

export default Select;
