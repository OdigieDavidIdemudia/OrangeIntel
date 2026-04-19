import React from 'react';
import { Shield, AlertTriangle, Clock, MapPin, Tag, ArrowRight } from 'lucide-react';
import styles from './IntelligenceList.module.css';

const IntelligenceList = ({ threats, loading }) => {
    if (loading) {
        return (
            <div className={styles.loaderContainer}>
                <div className={styles.loader}></div>
                <p>Analyzing intelligence feeds...</p>
            </div>
        );
    }

    if (!threats || threats.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}><Shield size={48} opacity={0.2} /></div>
                <h3>No Intelligence Found</h3>
                <p>Adjust your filters or ingested new data to see latest threats.</p>
            </div>
        );
    }

    const getPriorityColor = (confidence) => {
        if (confidence >= 70) return '#EF4444'; // High
        if (confidence >= 40) return '#F59E0B'; // Medium
        return '#3B82F6'; // Low
    };

    const getPriorityLabel = (confidence) => {
        if (confidence >= 70) return 'HIGH';
        if (confidence >= 40) return 'MEDIUM';
        return 'LOW';
    };

    return (
        <div className={styles.listContainer}>
            {threats.map((threat) => (
                <div key={threat.id} className={styles.card}>
                    <div className={styles.cardSidebar} style={{ backgroundColor: getPriorityColor(threat.confidence) }} />
                    
                    <div className={styles.cardContent}>
                        <div className={styles.header}>
                            <div className={styles.titleGroup}>
                                <div className={styles.priorityBadge} style={{ color: getPriorityColor(threat.confidence), borderColor: getPriorityColor(threat.confidence) }}>
                                    {getPriorityLabel(threat.confidence)}
                                </div>
                                <h3 className={styles.title}>{threat.title}</h3>
                            </div>
                            <span className={styles.timestamp}>
                                <Clock size={12} style={{ marginRight: 4 }} />
                                {new Date(threat.ingestedAt).toLocaleDateString()} {new Date(threat.ingestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <p className={styles.summary}>{threat.summary}</p>

                        <div className={styles.metadata}>
                            <div className={styles.metaItem}>
                                <Tag size={14} />
                                <span>{threat.threatType || 'Unknown Type'}</span>
                            </div>
                            <div className={styles.metaItem}>
                                <MapPin size={14} />
                                <span>{threat.environmentRelevance || 'General'}</span>
                            </div>
                            <div className={styles.metaItem}>
                                <Shield size={14} />
                                <span>Confidence: {threat.confidence}%</span>
                            </div>
                            <div className={styles.metaItem} style={{ marginLeft: 'auto' }}>
                                <span className={styles.source}>Source: {threat.source?.name || 'Automated Feed'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <button className={styles.detailsBtn} title="View Detailed Intelligence">
                        <ArrowRight size={18} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default IntelligenceList;
