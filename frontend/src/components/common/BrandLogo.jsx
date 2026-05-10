import React from 'react';
import styles from './BrandLogo.module.css';

const BrandLogo = ({ size = 44, hideText = false, subtitle = '', className = '' }) => {
    return (
        <div className={`${styles.wrapper} ${className}`} style={{ '--logo-size': `${size}px` }}>
            <div className={styles.mark}>
                <svg viewBox="0 0 68 79" className={styles.svg}>
                    <defs>
                        <linearGradient id="brandLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#EB4D00" />
                            <stop offset="100%" stopColor="#A83800" />
                        </linearGradient>
                    </defs>
                    <polygon points="34,0 68,19.6 68,58.8 34,78.4 0,58.8 0,19.6" fill="url(#brandLogoGrad)" />
                    <circle cx="34" cy="39.2" r="17" fill="none" stroke="white" strokeWidth="1.5" opacity="0.35" />
                    <line x1="34" y1="22.2" x2="34" y2="30" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                    <line x1="34" y1="48.4" x2="34" y2="56.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                    <line x1="17" y1="39.2" x2="24.8" y2="39.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                    <line x1="43.2" y1="39.2" x2="51" y2="39.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                    <circle cx="34" cy="39.2" r="3.5" fill="white" />
                </svg>
            </div>
            {!hideText && (
                <div className={styles.textColumn}>
                    <div className={styles.textBlock}>
                        <span className={styles.orange}>Orange</span>
                        <span className={styles.white}>Intel</span>
                    </div>
                    {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
                </div>
            )}
        </div>
    );
};

export default BrandLogo;
