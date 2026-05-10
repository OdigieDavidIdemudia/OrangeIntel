import React from 'react';
import { Shield, Clock } from 'lucide-react';
import styles from './RecentThreatTicker.module.css';

/**
 * RecentThreatTicker - Displays a static list of the top 5 latest threats.
 * Optimized for scannability and high-fidelity design.
 */
const RecentThreatTicker = ({ threats }) => {
    console.log("RecentThreatTicker V2 rendering with threats:", threats?.length);
    if (!threats || threats.length === 0) return (
        <div className={styles.emptyContainer}>
            <span className={styles.emptyText}>No recent intelligence feeds available</span>
        </div>
    );

    // Take top 5 latest threats from the feed
    const topThreats = threats.slice(0, 5);

    // Robust time formatter to prevent "Invalid Date" errors
    const safeFormatTime = (dateStr) => {
        try {
            if (!dateStr) return 'Recently';
            const date = new Date(dateStr);
            // Check if the date is actually valid
            if (isNaN(date.getTime())) {
                return 'Just now';
            }
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (err) {
            console.error("Date parsing error:", err);
            return 'Just now';
        }
    };

    return (
        <div className={styles.listContainer}>
            {topThreats.map((threat, idx) => {
                const score = Math.round(threat.confidence || 0);
                
                // Determine accent color based on confidence score
                const accentColor = score >= 90 ? 'var(--severity-critical-border)' : 
                                   (score >= 70 ? 'var(--severity-high-border)' : 
                                   (score >= 40 ? 'var(--severity-medium-border)' : 'var(--severity-low-border)'));

                return (
                    <div key={threat.id || `threat-${idx}`} className={styles.listCard}>
                        {/* Status Accent Bar */}
                        <div className={styles.accent} style={{ background: accentColor }} />
                        
                        <div className={styles.cardMain}>
                            <div className={styles.cardHeader}>
                                <h4 className={styles.threatTitle} title={threat.title}>
                                    {threat.title}
                                </h4>
                                <span className={styles.timeBadge}>
                                    <Clock size={10} style={{ marginRight: '4px' }}/>
                                    {safeFormatTime(threat.updatedAt || threat.createdAt || threat.ingestedAt)}
                                </span>
                            </div>

                            <div className={styles.cardMeta}>
                                <div className={styles.metaItem}>
                                    <Shield size={12} />
                                    <span>Score: {score}%</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <span>Source: {threat.source?.name || 'Unknown'}</span>
                                </div>
                                {threat.category && (
                                    <div className={styles.metaItem} style={{ marginLeft: 'auto' }}>
                                        <span className={styles.categoryTag}>{threat.category}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default RecentThreatTicker;
