import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Shield, Activity } from 'lucide-react';
import styles from './ThreatCounters.module.css';

const ThreatCounters = ({ metrics }) => {
    // metrics = { High: { count, delta }, Medium: { count, delta }, Low: { count, delta } }
    
    const priorities = [
        { key: 'High', label: 'CRITICAL OPS', icon: AlertCircle, status: 'high' },
        { key: 'Medium', label: 'ELEVATED RISK', icon: Shield, status: 'medium' },
        { key: 'Low', label: 'ROUTINE INTEL', icon: Activity, status: 'low' }
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
                            <Icon size={16} opacity={0.6} />
                        </div>
                        
                        <div className={styles.value}>{data.count}</div>
                        
                        <div className={styles.delta} style={{ color: isPositive ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {isPositive ? <TrendingUp size={12} className={styles.deltaIcon} /> : <TrendingDown size={12} className={styles.deltaIcon} />}
                            <span>{Math.abs(data.deltaSinceOneHour)} item{Math.abs(data.deltaSinceOneHour) !== 1 ? 's' : ''} shift</span>
                        </div>

                        <div className={styles.progressContainer}>
                            <div className={styles.progressLabel}>
                                <span>Load Utilization</span>
                                <span>{Math.round(getProgress(data.count))}%</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div 
                                    className={styles.progressFill} 
                                    style={{ width: `${getProgress(data.count)}%` }} 
                                    title={`${Math.round(getProgress(data.count))}% Capacity`}
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
