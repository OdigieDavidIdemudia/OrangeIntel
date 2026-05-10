import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    Shield, Activity, TrendingUp, 
    ArrowRight, FileText, Monitor, 
    Clock, Database, Server 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ThreatCounters from '../components/monitoring/ThreatCounters';
import RecentThreatTicker from '../components/monitoring/RecentThreatTicker';
import styles from './ThreatDashboard.module.css';

const ThreatDashboard = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMetrics = async () => {
        try {
            const response = await axios.get('/api/metrics/dashboard');
            setMetrics(response.data);
        } catch (error) {
            console.error("Error fetching dashboard metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !metrics) {
        return <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '13px' }}>Initializing Platform Intelligence...</div>;
    }

    return (
        <div className={styles.container}>
            <header className={styles.dashboardHeader}>
                <div className={styles.titleBlock}>
                    <h1 className={styles.title}>Analyst Commander</h1>
                    <p className={styles.subtitle}>Unified threat intelligence and platform operations</p>
                </div>
                <div className={styles.velocityBadge}>
                    <TrendingUp size={14} style={{ color: metrics.velocity.status === 'SpikeDetected' ? 'var(--color-danger)' : 'var(--color-success)' }} />
                    <span>Rate: {metrics.velocity.currentRate} items/hr</span>
                </div>
            </header>

            <div className={styles.grid}>
                <div className={styles.mainGroup}>
                    <div>
                        <h3 className={styles.sectionTitle}><Activity size={12} /> Operational Load</h3>
                        <ThreatCounters metrics={metrics.threatCounts} />
                    </div>
                    
                    <div>
                        <h3 className={styles.sectionTitle}><Clock size={12} /> Recent Intelligence</h3>
                        <RecentThreatTicker threats={metrics.recentThreats} />
                    </div>
                </div>

                <div className={styles.sideGroup}>
                    <div>
                        <h3 className={styles.sectionTitle}><Monitor size={12} /> Navigation</h3>
                        <div className={styles.quickLinks}>
                            <Link to="/threats" className={styles.linkItem}>
                                <div className={styles.linkInfo}>
                                    <div className={styles.linkIcon}><Monitor size={18} /></div>
                                    <span className={styles.linkText}>Threats Queue</span>
                                </div>
                                <ArrowRight size={14} />
                            </Link>
                            <Link to="/advisories" className={styles.linkItem}>
                                <div className={styles.linkInfo}>
                                    <div className={styles.linkIcon}><Shield size={18} /></div>
                                    <span className={styles.linkText}>Advisory Builder</span>
                                </div>
                                <ArrowRight size={14} />
                            </Link>
                            <Link to="/reports" className={styles.linkItem}>
                                <div className={styles.linkInfo}>
                                    <div className={styles.linkIcon}><FileText size={18} /></div>
                                    <span className={styles.linkText}>Report Archive</span>
                                </div>
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h3 className={styles.sectionTitle} style={{ marginBottom: '12px' }}>System Integrity</h3>
                        <div className={styles.statusList}>
                            <div className={styles.statusRow}>
                                <span className={styles.statusLabel}>Database Cluster</span>
                                <span className={`${styles.statusValue} ${styles.valueSuccess}`}>{metrics.systemHealth.database}</span>
                            </div>
                            <div className={styles.statusRow}>
                                <span className={styles.statusLabel}>Ingestion Engine</span>
                                <span className={`${styles.statusValue} ${styles.valueSuccess}`}>{metrics.systemHealth.ingestion}</span>
                            </div>
                            <div className={styles.statusRow}>
                                <span className={styles.statusLabel}>Node Latency</span>
                                <span className={`${styles.statusValue} ${styles.valueNormal}`}>{metrics.systemHealth.ingestLatencyMs}ms</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <div className={styles.footerItem}>
                        <Database size={12} /> <span>DB_SECURE</span>
                    </div>
                    <div className={styles.footerItem}>
                        <Server size={12} /> <span>INGEST_READY</span>
                    </div>
                    <div className={styles.footerItem}>
                        <Activity size={12} /> <span>SYSTEM_HEALTHY</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ThreatDashboard;
