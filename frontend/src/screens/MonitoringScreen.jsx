import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { Activity, AlertTriangle, Shield, Bell, Zap, RefreshCw, ChevronLeft, ChevronRight, BarChart2, Database, Clock, Flag } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import styles from './MonitoringScreen.module.css';

import BrandLogo from '../components/common/BrandLogo';

const MonitoringScreen = () => {
    const { theme } = useTheme();
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Interactions
    const [manualSpotlightId, setManualSpotlightId] = useState(null);
    const [autoSpotlightIndex, setAutoSpotlightIndex] = useState(0);
    const [newCriticalAlert, setNewCriticalAlert] = useState(null);
    
    // Timers
    const [refreshInterval] = useState(2000); 
    const [nextRefreshIn, setNextRefreshIn] = useState(2);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const previousCriticalIds = useRef(new Set());
    const audioRef = useRef(null);
    const refreshTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);

    const refreshData = useCallback(async (isManual = false) => {
        if (isRefreshing && isManual) return;
        try {
            if (isManual) setIsRefreshing(true);
            const response = await axios.get('/api/metrics/dashboard');
            const data = response.data;

            if (data.recentThreats) {
                const criticalThreats = data.recentThreats.filter(t => t.confidence >= 70);
                const newCriticals = criticalThreats.filter(t => !previousCriticalIds.current.has(t.id));

                if (newCriticals.length > 0 && previousCriticalIds.current.size > 0) {
                    setNewCriticalAlert(newCriticals[0]);
                    if (audioRef.current) audioRef.current.play().catch(() => {});
                    setTimeout(() => setNewCriticalAlert(null), 5000);
                    setManualSpotlightId(newCriticals[0].id);
                }
                previousCriticalIds.current = new Set(criticalThreats.map(t => t.id));
            }

            setDashboard(data);
            setLoading(false);
            if (isManual) setIsRefreshing(false);
        } catch (error) {
            console.error("Dashboard fetch failed", error);
            setLoading(false);
            if (isManual) setIsRefreshing(false);
        }
    }, [isRefreshing]);

    useEffect(() => {
        refreshData();
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        refreshTimerRef.current = setInterval(() => {
            refreshData();
            setNextRefreshIn(refreshInterval / 1000);
        }, refreshInterval);

        countdownTimerRef.current = setInterval(() => {
            setNextRefreshIn(prev => {
                if (prev <= 1) return refreshInterval / 1000;
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(refreshTimerRef.current);
            clearInterval(countdownTimerRef.current);
        };
    }, [refreshInterval, refreshData]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!manualSpotlightId) {
                setAutoSpotlightIndex(p => p + 1);
            }
        }, 8000);
        return () => clearInterval(timer);
    }, [manualSpotlightId]);

    const formatTimeAgo = (iso) => {
        if (!iso) return 'N/A';
        const diffMs = Date.now() - new Date(iso);
        const mins = Math.floor(diffMs / 60000);
        const hours = Math.floor(mins / 60);
        if (hours > 0) return `${hours}h ${mins % 60}m ago`;
        return `${mins}m ago`;
    };

    const handleAction = async (threatId, action) => {
        try {
            if (action === 'promote') {
                await axios.post('/api/threats/promote', { threatId });
            } else if (action === 'acknowledge') {
                await axios.post(`/api/threats/${threatId}/acknowledge`, { acknowledgedBy: 'SOC Wallboard', note: 'Fast ack' });
            } else if (action === 'discard') {
                await axios.post('/api/threats/discard', { threatId });
            }
            if (manualSpotlightId === threatId) setManualSpotlightId(null);
            refreshData(true);
        } catch (error) {
            console.error(`Failed to ${action} threat`, error);
        }
    };

    if (loading || !dashboard) return (
        <div className={styles.container}>
            {/* Header skeleton */}
            <header className={styles.header}>
                <div className="sk-bone sk-h-xl sk-pill" style={{ width: 180 }}/>
                <div className={styles.headerActions} style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <div className="sk-bone sk-h-lg sk-pill" style={{ width:70 }}/>
                    <div className="sk-bone sk-h-lg sk-pill" style={{ width:110 }}/>
                    <div className="sk-bone sk-h-lg sk-pill" style={{ width:90 }}/>
                    <div className="sk-bone sk-h-xl sk-pill" style={{ width:90 }}/>
                </div>
            </header>

            {/* Metrics strip skeleton */}
            <div className={styles.metricsStrip}>
                {[1,2,3,4,5,6].map(i => (
                    <React.Fragment key={i}>
                        <div style={{ display:'flex', flexDirection:'column', gap:5, padding:'0 16px' }}>
                            <div className="sk-bone sk-h-xs sk-pill" style={{ width:70 }}/>
                            <div className="sk-bone sk-h-md sk-pill" style={{ width:50 }}/>
                        </div>
                        {i < 6 && <div className={styles.metricDivider}/>}
                    </React.Fragment>
                ))}
            </div>

            {/* Main 3-column grid skeleton */}
            <main className={styles.mainGrid}>
                {/* Col 1: Live Feed */}
                <section className={styles.liveFeedCol}>
                    <div className={styles.feedHeader}>
                        <div className="sk-bone sk-h-sm" style={{ width:70 }}/>
                        <div className="sk-bone sk-h-lg sk-circle" style={{ width:28, height:28 }}/>
                    </div>
                    <div className={styles.feedList}>
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className={styles.feedItem} style={{ borderLeftColor:'var(--border-color)' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                                    <div className="sk-bone sk-h-sm sk-pill" style={{ width:60 }}/>
                                    <div className="sk-bone sk-h-sm sk-pill" style={{ width:30 }}/>
                                </div>
                                <div className="sk-bone sk-h-sm" style={{ width:'90%', marginBottom:5 }}/>
                                <div className="sk-bone sk-h-xs" style={{ width:'60%' }}/>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Col 2: Hero / spotlight */}
                <section className={styles.mainCenterCol}>
                    {/* Spotlight card */}
                    <div className={styles.criticalSpotlight} style={{ marginBottom:16 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                            <div className="sk-bone sk-h-lg sk-pill" style={{ width:110 }}/>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                <div className="sk-bone sk-h-lg sk-pill" style={{ width:40 }}/>
                                <div className="sk-bone sk-h-lg sk-pill" style={{ width:50 }}/>
                            </div>
                        </div>
                        <div className="sk-bone sk-h-lg" style={{ width:'80%', marginBottom:10 }}/>
                        <div className="sk-bone sk-h-lg" style={{ width:'95%', marginBottom:6 }}/>
                        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
                            <div className="sk-bone sk-h-sm sk-w-full"/>
                            <div className="sk-bone sk-h-sm sk-w-70"/>
                        </div>
                        <div style={{ display:'flex', gap:10 }}>
                            <div className="sk-bone sk-h-xl sk-pill" style={{ width:100 }}/>
                            <div className="sk-bone sk-h-xl sk-pill" style={{ width:100 }}/>
                            <div className="sk-bone sk-h-xl sk-pill" style={{ width:70 }}/>
                        </div>
                    </div>

                    {/* Top threats list */}
                    <div className="sk-bone sk-h-sm" style={{ width:140, marginBottom:10 }}/>
                    <div className={styles.topThreatList}>
                        {[1,2,3,4].map(i => (
                            <div key={i} className={styles.topThreatRow}>
                                <div className="sk-bone sk-h-md sk-pill" style={{ width:36 }}/>
                                <div className="sk-bone sk-h-sm" style={{ flex:1 }}/>
                                <div className="sk-bone sk-h-sm" style={{ width:60 }}/>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Col 3: Stats sidebar */}
                <section className={styles.statsCol}>
                    <div className={styles.slaBreachCard}>
                        <div className="sk-bone sk-h-sm" style={{ width:80, marginBottom:8 }}/>
                        <div className="sk-bone sk-h-4xl" style={{ width:60, borderRadius:8 }}/>
                        <div className="sk-bone sk-h-xs" style={{ width:100, marginTop:6 }}/>
                    </div>
                    {[1,2,3].map(i => (
                        <div key={i} className={styles.statCard}>
                            <div className="sk-bone sk-h-xs" style={{ width:80, marginBottom:8 }}/>
                            <div className="sk-bone sk-h-md sk-pill" style={{ width:70 }}/>
                        </div>
                    ))}
                </section>
            </main>
        </div>
    );

    const activeThreats = dashboard.recentThreats || [];
    const criticalThreats = activeThreats.filter(t => t.confidence >= 70).sort((a,b) => new Date(b.ingestedAt) - new Date(a.ingestedAt));
    const slaBreaches = activeThreats.filter(t => (Date.now() - new Date(t.ingestedAt)) > 24 * 3600 * 1000);
    
    let currentSpotlight = null;
    let spotlightListIndex = 0;
    
    if (manualSpotlightId) {
        currentSpotlight = activeThreats.find(t => t.id === manualSpotlightId);
        spotlightListIndex = criticalThreats.findIndex(t => t.id === manualSpotlightId);
    } 
    
    if (!currentSpotlight && criticalThreats.length > 0) {
        spotlightListIndex = autoSpotlightIndex % criticalThreats.length;
        currentSpotlight = criticalThreats[spotlightListIndex];
    } else if (!currentSpotlight && activeThreats.length > 0) {
        currentSpotlight = activeThreats[0];
    }

    return (
        <div className={styles.container}>
            <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS56+OdTgwOUKXh8LRkHQU2jdXwzn0vBSh+zPLaizsKFF+16+uoVRQKRp/g8r5sIQUrgs/y2Ik2CBhkuevjnU4MDlCl4fC0ZB0FNo3V8M59LwUofszy2os7ChRftevr" />

            {/* TOP BAR */}
            <header className={styles.header}>
                <BrandLogo 
                    size={44} 
                    subtitle="Threat Intelligence Platform" 
                    className={styles.brandWrapper} 
                />

                <div className={styles.headerActions}>
                    <div className={styles.envChip}>
                        <div className={styles.envDot}></div>
                        STATUS
                    </div>
                    <div className={styles.modeChip}>SOC_WALLBOARD</div>
                    <div className={styles.refreshChip}>
                        <RefreshCw size={12} className={isRefreshing ? 'spinning' : ''} />
                        Auto · {Math.floor(nextRefreshIn).toString().padStart(2, '0')}s
                    </div>
                    <button className={styles.refreshButton} onClick={() => refreshData(true)} disabled={isRefreshing}>
                        <Zap size={12} fill="#FFFFFF" />
                        Sync Now
                    </button>
                </div>
            </header>

            {/* METRICS STRIP */}
            <div className={styles.metricsStrip}>
                <div className={`${styles.metricChip} ${styles.metricChipUrgent}`}>
                    <span className={styles.metricLabel}>SLA Breached</span>
                    <span className={styles.metricValue} style={{ color: '#E05252' }}>{slaBreaches.length}</span>
                </div>
                <div className={styles.metricDivider}></div>
                <div className={styles.metricChip}>
                    <span className={styles.metricLabel}>Critical Ops</span>
                    <span className={styles.metricValue} style={{ color: '#E05252' }}>{dashboard.threatCounts?.High?.count || 0}</span>
                </div>
                <div className={styles.metricDivider}></div>
                <div className={styles.metricChip}>
                    <span className={styles.metricLabel}>Elevated Risk</span>
                    <span className={styles.metricValue} style={{ color: '#F59732' }}>{dashboard.threatCounts?.Medium?.count || 0}</span>
                </div>
                <div className={styles.metricDivider}></div>
                <div className={styles.metricChip}>
                    <span className={styles.metricLabel}>Routine Intel</span>
                    <span className={styles.metricValue} style={{ color: '#378ADD' }}>{dashboard.threatCounts?.Low?.count || 0}</span>
                </div>
                <div className={styles.metricDivider}></div>
                <div className={styles.metricChip}>
                    <span className={styles.metricLabel}>Last Critical</span>
                    <span className={styles.metricValue}>{dashboard.lastCriticalThreatTime ? formatTimeAgo(dashboard.lastCriticalThreatTime) : 'CLEAN'}</span>
                </div>
                <div className={styles.metricDivider}></div>
                <div className={styles.metricChip}>
                    <span className={styles.metricLabel}>Velocity</span>
                    <span className={styles.metricValue} style={{ color: dashboard.velocity?.status === 'SpikeDetected' ? '#F59732' : '#4ADE80' }}>
                        {dashboard.velocity?.status === 'SpikeDetected' ? `${dashboard.velocity.currentRate} events/hr` : 'STABLE'}
                    </span>
                </div>
            </div>

            <main className={styles.mainGrid}>
                {/* COL 1: LIVE FEED */}
                <section className={styles.liveFeedCol}>
                    <div className={styles.feedHeader}>
                        <div className={styles.feedTitle}>Live feed</div>
                        <div className={styles.feedCountBadge}>{activeThreats.length}</div>
                    </div>
                    <div className={styles.feedList}>
                        {activeThreats.map((t) => {
                            const conf = t.confidence;
                            let badgeLabel = 'ROUTINE';
                            let borderCol = '#378ADD';
                            let badgeBg = '#0A1A2D';
                            let badgeText = '#378ADD';

                            if (conf >= 70) {
                                badgeLabel = 'CRITICAL';
                                borderCol = '#E05252';
                                badgeBg = '#2D0A0A';
                                badgeText = '#E05252';
                            } else if (conf >= 40) {
                                badgeLabel = 'ELEVATED';
                                borderCol = '#F59732';
                                badgeBg = '#2D1F0A';
                                badgeText = '#F59732';
                            }

                            return (
                                <div 
                                    key={t.id} 
                                    className={`${styles.feedItem} ${currentSpotlight?.id === t.id ? styles.feedItemActive : ''}`}
                                    style={{ borderLeftColor: borderCol }}
                                    onClick={() => setManualSpotlightId(t.id)}
                                >
                                    <div className={styles.feedItemTop}>
                                        <div className={styles.feedBadge} style={{ background: badgeBg, color: badgeText }}>{badgeLabel}</div>
                                        <div className={styles.feedScore}>{conf}%</div>
                                    </div>
                                    <div className={styles.feedItemTitle}>{t.title}</div>
                                    <div className={styles.feedItemSource}>{t.source?.name || 'Global'}</div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* COL 2: HERO ZONE */}
                <section className={styles.mainCenterCol}>
                    {currentSpotlight && (
                        <div className={styles.criticalSpotlight}>
                            <div className={styles.spotlightHeader}>
                                <div className={styles.spotlightLiveBadge}>
                                    <div className={styles.spotlightLiveDot}></div>
                                    CRITICAL · LIVE
                                </div>
                                <div className={styles.spotlightScoreBadge}>{currentSpotlight.confidence}%</div>
                                <div className={styles.spotlightNav}>
                                    {spotlightListIndex + 1} / {criticalThreats.length || 1}
                                    <button className={styles.spotNavBtn} onClick={() => setManualSpotlightId(criticalThreats[spotlightListIndex - 1]?.id)} disabled={spotlightListIndex === 0}><ChevronLeft size={10}/></button>
                                    <button className={styles.spotNavBtn} onClick={() => setManualSpotlightId(criticalThreats[spotlightListIndex + 1]?.id)} disabled={spotlightListIndex === criticalThreats.length - 1}><ChevronRight size={10}/></button>
                                </div>
                            </div>
                            <div className={styles.spotlightTitle}>{currentSpotlight.title}</div>
                            <div className={styles.spotlightBody}>{currentSpotlight.summary || currentSpotlight.content || 'Immediate analysis required for this critical threat vector. Investigate indicators of compromise.'}</div>
                            <div className={styles.spotlightMetadataRow}>
                                <div className={styles.spotMetaItem}><Database size={12}/> <span className={styles.spotMetaValue}>{currentSpotlight.source?.name || 'Global'}</span></div>
                                <div className={styles.spotMetaItem}><Clock size={12}/> <span className={styles.spotMetaValue}>{formatTimeAgo(currentSpotlight.ingestedAt)}</span></div>
                                <div className={styles.spotMetaItem}><Flag size={12}/> <span className={styles.spotMetaValue}>3 Indicators</span></div>
                            </div>
                            <div className={styles.spotlightActionRow}>
                                <button className={styles.btnReviewNow} onClick={() => handleAction(currentSpotlight.id, 'promote')}>Review Now</button>
                                <button className={styles.btnAcknowledge} onClick={() => handleAction(currentSpotlight.id, 'acknowledge')}>Acknowledge</button>
                                <button className={styles.btnDiscard} onClick={() => handleAction(currentSpotlight.id, 'discard')}>Discard</button>
                            </div>
                        </div>
                    )}

                    <div className={styles.topThreatsHeader}><AlertTriangle size={10}/> Top critical threats</div>
                    <div className={styles.topThreatList}>
                        {criticalThreats.slice(0, 4).map(t => (
                            <div key={t.id} className={styles.topThreatRow} onClick={() => setManualSpotlightId(t.id)}>
                                <div className={`${styles.topScore} ${t.confidence >= 95 ? styles.topScoreMax : styles.topScoreCritical}`}>
                                    {t.confidence}%
                                </div>
                                <div className={styles.topTitle}>{t.title}</div>
                                <div className={styles.topSource}>{t.source?.name || 'Global'}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* COL 3: STATS */}
                <section className={styles.statsCol}>
                    <div className={styles.slaBreachCard}>
                        <div className={styles.statLabel} style={{ color: '#6B2020' }}>SLA BREACHED</div>
                        <div className={styles.slaValue}>{slaBreaches.length}</div>
                        <div style={{ fontSize: '9px', color: '#6B2020' }}>URGENT ACTION REQ</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>DATABASE</div>
                        <div className={styles.statValue} style={{ color: '#4ADE80' }}>CONNECTED</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>INGESTION</div>
                        <div className={styles.statValue} style={{ color: '#4ADE80' }}>ACTIVE</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statLabel}>LATENCY</div>
                        <div className={styles.statValue}>124ms</div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default MonitoringScreen;
