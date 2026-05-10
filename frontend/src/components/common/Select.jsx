import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { createPortal } from 'react-dom';

const Select = ({ value, onChange, options, placeholder = 'Select...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(o => o.value === value);

    useEffect(() => {
        const handler = (e) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target)
            ) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const open = () => {
        if (!isOpen && triggerRef.current) {
            const r = triggerRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 160) });
        }
        setIsOpen(v => !v);
    };

    const select = (val) => {
        if (onChange) onChange({ target: { value: val } });
        setIsOpen(false);
    };

    return (
        <>
            {/* Trigger — matches global .oi-select-trigger spec */}
            <div
                ref={triggerRef}
                className="oi-select-trigger"
                onClick={open}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.4rem',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    minWidth: '120px',
                }}
            >
                <span>{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown size={12} style={{ opacity: 0.5, flexShrink: 0, transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: pos.top,
                        left: pos.left,
                        width: pos.width,
                        background: 'var(--bg-panel)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        zIndex: 9999,
                        overflow: 'hidden',
                        maxHeight: '280px',
                        overflowY: 'auto',
                    }}
                >
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            onClick={() => select(opt.value)}
                            style={{
                                padding: '0.55rem 0.75rem',
                                fontSize: '0.72rem',
                                fontWeight: opt.value === value ? 600 : 400,
                                color: opt.value === value ? 'var(--text-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: opt.value === value ? 'rgba(249,115,22,0.08)' : 'transparent',
                                borderLeft: opt.value === value ? '2px solid var(--color-brand)' : '2px solid transparent',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <span>{opt.label}</span>
                            {opt.value === value && <Check size={12} color="var(--color-brand)" />}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
};

export default Select;
