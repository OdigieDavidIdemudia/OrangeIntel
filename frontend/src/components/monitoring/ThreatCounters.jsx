import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Activity } from 'lucide-react';
import styles from './ThreatCounters.module.css';

const ThreatCounters = ({ metrics }) => {
    // metrics = { High: { count, delta }, Medium: { count, delta }, Low: { count, delta } }
    
    const priorities = [
        { key: 'High', label: 'CRITICAL THREATS', icon: AlertTriangle, status: 'high' },
        { key: 'Medium', label: 'ELEVATED RISK', icon: Shield, status: 'medium' },
        { key: 'Low', label: 'ROUTINE MONITORING', icon: Activity, status: 'low' }
    ];

    const getProgress = (count) => {
        // Mock capacity logic: max 100 per category for visual progress
        return Math.min((count / 100) * 100, 100);
    };

    return (
        <div className={styles.container}>
            {priorities.map((priority) => {
                const { key, label, icon: Icon, status } = priority;
                const data = metrics?.[key] || { count: 0, deltaSinceOneHour: 0 };
                const isPositive = data.deltaSinceOneHour > 0;
                
                return (
                    <div key={key} className={`${styles.counterCard} ${styles[status]}`}>
                        <div className={styles.cardHeader}>
                            <div className={styles.labelGroup}>
                                <span className={styles.label}>{label}</span>
                                <span className={styles.priorityBadge}>{key} Priority</span>
                            </div>
                            <Icon size={20} opacity={0.5} />
                        </div>
                        
                        <div className={styles.value}>{data.count}</div>
                        
                        <div className={styles.delta} style={{ color: isPositive ? '#EF4444' : '#10B981' }}>
                            {isPositive ? <TrendingUp size={14} className={styles.deltaIcon} /> : <TrendingDown size={14} className={styles.deltaIcon} />}
                            <span>{Math.abs(data.deltaSinceOneHour)} since last hour</span>
                        </div>

                        <div className={styles.progressContainer}>
                            <div className={styles.progressLabel}>
                                <span>Utilization</span>
                                <span>{Math.round(getProgress(data.count))}%</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div 
                                    className={styles.progressFill} 
                                    style={{ width: `${getProgress(data.count)}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ThreatCounters;
