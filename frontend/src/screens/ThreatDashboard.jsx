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
        return (
            <div className={styles.container}>
                {/* Header skeleton */}
                <header className={styles.dashboardHeader} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        <div className="sk-bone sk-h-lg sk-w-40" style={{ width:220 }}/>
                        <div className="sk-bone sk-h-sm sk-w-60" style={{ width:300 }}/>
                    </div>
                    <div className="sk-bone sk-h-lg sk-pill" style={{ width:140 }}/>
                </header>

                {/* Two-column grid skeleton */}
                <div className={styles.grid}>
                    {/* Main left col */}
                    <div className={styles.mainGroup}>
                        {/* Threat Counters section */}
                        <div>
                            <div className="sk-bone sk-h-sm" style={{ width:120, marginBottom:12 }}/>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                                {[1,2,3].map(i => (
                                    <div key={i} style={{ background:'var(--bg-panel)', border:'1px solid var(--border-color)', borderRadius:10, padding:16, display:'flex', flexDirection:'column', gap:8 }}>
                                        <div className="sk-bone sk-h-xs sk-pill" style={{ width:60 }}/>
                                        <div className="sk-bone sk-h-2xl" style={{ width:48, borderRadius:8 }}/>
                                        <div className="sk-bone sk-h-xs" style={{ width:80 }}/>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Intel ticker section */}
                        <div style={{ marginTop:24 }}>
                            <div className="sk-bone sk-h-sm" style={{ width:150, marginBottom:12 }}/>
                            <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border-color)', borderRadius:10, overflow:'hidden' }}>
                                {[1,2,3,4,5].map(i => (
                                    <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:'1px solid var(--border-color)' }}>
                                        <div className="sk-bone sk-circle" style={{ width:28, height:28, flexShrink:0 }}/>
                                        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                                            <div className="sk-bone sk-h-sm sk-w-70"/>
                                            <div className="sk-bone sk-h-xs sk-w-40"/>
                                        </div>
                                        <div className="sk-bone sk-h-sm sk-pill" style={{ width:50 }}/>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right side col */}
                    <div className={styles.sideGroup}>
                        {/* Navigation links skeleton */}
                        <div>
                            <div className="sk-bone sk-h-sm" style={{ width:90, marginBottom:12 }}/>
                            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                {[1,2,3].map(i => (
                                    <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-panel)', border:'1px solid var(--border-color)', borderRadius:8, padding:'10px 14px' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                            <div className="sk-bone sk-circle" style={{ width:32, height:32 }}/>
                                            <div className="sk-bone sk-h-sm" style={{ width:110 }}/>
                                        </div>
                                        <div className="sk-bone sk-h-sm" style={{ width:14 }}/>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* System Integrity card skeleton */}
                        <div className={styles.card} style={{ marginTop:24 }}>
                            <div className="sk-bone sk-h-sm" style={{ width:120, marginBottom:16 }}/>
                            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                                {[1,2,3].map(i => (
                                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                        <div className="sk-bone sk-h-sm" style={{ width:110 }}/>
                                        <div className="sk-bone sk-h-sm sk-pill" style={{ width:60 }}/>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer strip skeleton */}
                <div style={{ display:'flex', gap:20, marginTop:24 }}>
                    {[1,2,3].map(i => (
                        <div key={i} className="sk-bone sk-h-sm sk-pill" style={{ width:100 }}/>
                    ))}
                </div>
            </div>
        );
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
