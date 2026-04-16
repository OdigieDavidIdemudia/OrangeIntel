import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
    AlertTriangle, Shield, Activity, TrendingUp, 
    ArrowRight, LayoutDashboard, FileText, Monitor, 
    Clock, Database, Server 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ThreatCounters from '../components/monitoring/ThreatCounters';
import RecentThreatTicker from '../components/monitoring/RecentThreatTicker';
import styles from './ThreatDashboard.module.css';

const ThreatDashboard = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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

        fetchMetrics();
        const interval = setInterval(fetchMetrics, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !metrics) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Initializing Intel Dashboard...</div>;
    }

    const getStateColor = (state) => {
        switch (state) {
            case 'CRITICAL': return styles.stateCritical;
            case 'ELEVATED': return styles.stateElevated;
            default: return styles.stateCalm;
        }
    };

    const getStateIcon = (state) => {
        switch (state) {
            case 'CRITICAL': return <AlertTriangle size={48} />;
            case 'ELEVATED': return <Shield size={48} />;
            default: return <Activity size={48} />;
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <header className={styles.dashboardHeader}>
                <div>
                    <h1 className={styles.title}>Analyst Commander</h1>
                    <p className={styles.subtitle}>Unified threat intelligence and platform operations</p>
                </div>
                <div className={styles.velocityBadge}>
                    <TrendingUp size={16} color={metrics.velocity.status === 'SpikeDetected' ? '#EF4444' : '#10B981'} />
                    <span>Velocity: {metrics.velocity.currentRate}/hr</span>
                </div>
            </header>

            <section className={styles.heroSection}>
                <div className={`${styles.overallStateCard} ${getStateColor(metrics.overallState)}`}>
                    <div className={styles.glow} style={{ '--accent-color': metrics.overallState === 'CRITICAL' ? '#EF4444' : (metrics.overallState === 'ELEVATED' ? '#F59E0B' : '#10B981') }} />
                    <div className={styles.stateIcon}>
                        {getStateIcon(metrics.overallState)}
                    </div>
                    <span className={styles.stateLabel}>CURRENT THREAT POSTURE</span>
                    <h2 className={`${styles.stateValue} ${getStateColor(metrics.overallState)}`}>
                        {metrics.overallState || 'STANDBY'}
                    </h2>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        System synchronized. Last update: {new Date().toLocaleTimeString()}
                    </div>
                </div>
            </section>

            <div className={styles.grid}>
                <div className={styles.mainGroup}>
                    <h3 className={styles.sectionTitle}><Activity size={18} /> Operational Load</h3>
                    <ThreatCounters metrics={metrics.threatCounts} />
                    
                    <h3 className={styles.sectionTitle} style={{ marginTop: '2.5rem' }}><Clock size={18} /> Recent Intelligence</h3>
                    <RecentThreatTicker threats={metrics.recentThreats} />
                </div>

                <div className={styles.sideGroup}>
                    <h3 className={styles.sectionTitle}><LayoutDashboard size={18} /> Navigation</h3>
                    <div className={styles.quickLinks}>
                        <Link to="/threats" className={styles.linkItem}>
                            <div className={styles.linkInfo}>
                                <div className={styles.linkIcon}><Monitor size={20} /></div>
                                <span className={styles.linkText}>Threats Queue</span>
                            </div>
                            <ArrowRight size={16} />
                        </Link>
                        <Link to="/advisories" className={styles.linkItem}>
                            <div className={styles.linkInfo}>
                                <div className={styles.linkIcon}><Shield size={20} /></div>
                                <span className={styles.linkText}>Advisories</span>
                            </div>
                            <ArrowRight size={16} />
                        </Link>
                        <Link to="/reports" className={styles.linkItem}>
                            <div className={styles.linkInfo}>
                                <div className={styles.linkIcon}><FileText size={20} /></div>
                                <span className={styles.linkText}>Reports</span>
                            </div>
                            <ArrowRight size={16} />
                        </Link>
                    </div>

                    <div className={styles.card} style={{ marginTop: '2rem' }}>
                        <h3 className={styles.sectionTitle} style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>System Status</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                               <span style={{ color: 'var(--text-secondary)' }}>Database</span>
                               <span style={{ color: '#10B981', fontWeight: 600 }}>{metrics.systemHealth.database}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                               <span style={{ color: 'var(--text-secondary)' }}>Ingestion</span>
                               <span style={{ color: '#10B981', fontWeight: 600 }}>{metrics.systemHealth.ingestion}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                               <span style={{ color: 'var(--text-secondary)' }}>Latency</span>
                               <span style={{ color: 'var(--text-primary)' }}>{metrics.systemHealth.ingestLatencyMs}ms</span>
                           </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer className={styles.footer} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Database size={14} /> <span>DB_SECURE</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Server size={14} /> <span>INGEST_READY</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={14} /> <span>PLATFORM_HEALTHY</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ThreatDashboard;
