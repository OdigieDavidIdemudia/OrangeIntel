import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Activity, AlertTriangle, Shield, Bell, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ThreatCounters from '../components/monitoring/ThreatCounters';

const MonitoringScreen = () => {
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [newCriticalAlert, setNewCriticalAlert] = useState(null);
    const [spotlightIndex, setSpotlightIndex] = useState(0); // For Critical Spotlight
    const [refreshInterval, setRefreshInterval] = useState(60000); // 1 minute default
    const [nextRefreshIn, setNextRefreshIn] = useState(60); // seconds
    const [isRefreshing, setIsRefreshing] = useState(false);
    const previousCriticalIds = useRef(new Set());
    const lastReminderRef = useRef(0);
    const audioRef = useRef(null);
    const refreshTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);
    const { theme, toggleTheme } = useTheme();

    const THREATS_PER_PAGE = 5;
    const ROTATION_INTERVAL = 10000; // 10 seconds

    // Force re-render every second for live timers
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);


    const refreshData = async (isManual = false) => {
        if (isRefreshing) return; // Prevent concurrent refreshes

        try {
            if (isManual) setIsRefreshing(true);

            const response = await axios.get('/api/metrics/dashboard');
            const data = response.data;

            // Critical Threat FIFO Queue Management (max 5, newest first)
            if (data.recentThreats) {
                const criticalThreats = data.recentThreats
                    .filter(t => t.confidence >= 70)
                    .sort((a, b) => new Date(b.ingestedAt) - new Date(a.ingestedAt))
                    .slice(0, 5); // Keep only top 5 newest

                const newCriticals = criticalThreats.filter(t => !previousCriticalIds.current.has(t.id));

                const now = Date.now();
                const REMINDER_INTERVAL = 600000; // 10 minutes

                const showAlert = (threat) => {
                    setNewCriticalAlert(threat);
                    lastReminderRef.current = now;
                    if (audioRef.current) {
                        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
                    }
                    setTimeout(() => setNewCriticalAlert(null), 10000);
                };

                if (newCriticals.length > 0) {
                    showAlert(newCriticals[0]);
                } else if (criticalThreats.length > 0 && (now - lastReminderRef.current > REMINDER_INTERVAL)) {
                    // Remind if critical threats persist
                    showAlert(criticalThreats[0]);
                }

                // Update tracked critical IDs
                previousCriticalIds.current = new Set(criticalThreats.map(t => t.id));
            }

            setDashboard(data);
            setLoading(false);
            if (isManual) setIsRefreshing(false);
        } catch (e) {
            console.error("Failed to fetch dashboard metrics", e);
            setLoading(false);
            if (isManual) setIsRefreshing(false);
        }
    };

    const handleManualRefresh = () => {
        refreshData(true);
        // Reset countdown timer
        setNextRefreshIn(refreshInterval / 1000);
    };

    // Load config and initialize refresh interval
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const configResponse = await axios.get('/config.json');
                const config = configResponse.data;
                if (config.monitoring?.auto_refresh_interval_ms) {
                    const interval = config.monitoring.auto_refresh_interval_ms;
                    setRefreshInterval(interval);
                    setNextRefreshIn(interval / 1000);
                }
            } catch (e) {
                console.log('Failed to load config, using defaults', e);
            }
        };
        loadConfig();
    }, []);

    // Auto-refresh with configurable interval
    useEffect(() => {
        refreshData();

        // Clear existing timers
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        // Set up auto-refresh
        refreshTimerRef.current = setInterval(() => {
            refreshData();
            setNextRefreshIn(refreshInterval / 1000);
        }, refreshInterval);

        // Set up countdown timer (updates every second)
        countdownTimerRef.current = setInterval(() => {
            setNextRefreshIn(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => {
            if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, [refreshInterval]);

    // Auto-rotation for threat carousel
    useEffect(() => {
        if (!dashboard?.recentThreats || dashboard.recentThreats.length <= THREATS_PER_PAGE) return;

        const maxPage = Math.ceil(dashboard.recentThreats.length / THREATS_PER_PAGE) - 1;
        const rotationTimer = setInterval(() => {
            setCurrentPage(prev => (prev >= maxPage ? 0 : prev + 1));
        }, ROTATION_INTERVAL);

        return () => clearInterval(rotationTimer);
    }, [dashboard]);

    // Critical Spotlight Rotation
    useEffect(() => {
        const timer = setInterval(() => {
            setSpotlightIndex(prev => prev + 1);
        }, 8000); // Rotate every 8s
        return () => clearInterval(timer);
    }, []);

    if (loading || !dashboard) {
        return (
            <div style={containerStyle}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <div style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>Loading Dashboard...</div>
                </div>
            </div>
        );
    }

    const getStateColor = (state) => {
        if (state === 'CRITICAL') return '#EF4444';
        if (state === 'ELEVATED') return '#F59E0B';
        return '#10B981';
    };

    const getStateIcon = (state) => {
        if (state === 'CRITICAL') return <AlertTriangle size={32} />;
        if (state === 'ELEVATED') return <Activity size={32} />;
        return <Shield size={32} />;
    };

    const formatTimestamp = (isoString) => {
        if (!isoString) return 'N/A';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Invalid Date';
        }
    };

    const formatTimeAgo = (isoString) => {
        if (!isoString) return 'Never';
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h ago`;
            if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m ago`;
            return `${diffMins}m ago`;
        } catch {
            return 'Unknown';
        }
    };

    const getSeverityBadge = (confidence) => {
        if (confidence >= 70) return { label: 'HIGH', color: '#EF4444' };
        if (confidence >= 40) return { label: 'MEDIUM', color: '#F59E0B' };
        return { label: 'LOW', color: '#3B82F6' };
    };

    const extractTopic = (threat) => {
        // Extract topic/campaign from metadata or threat type
        try {
            if (threat.metadataJson) {
                const metadata = JSON.parse(threat.metadataJson);
                if (metadata.campaign) return metadata.campaign;
                if (metadata.topic) return metadata.topic;
                if (metadata.tags && metadata.tags.length > 0) return metadata.tags[0];
            }
        } catch { }
        return threat.threatType || 'General';
    };

    // Paginate threats for carousel
    const visibleThreats = dashboard.recentThreats?.slice(
        currentPage * THREATS_PER_PAGE,
        (currentPage + 1) * THREATS_PER_PAGE
    ) || [];

    const totalPages = Math.ceil((dashboard.recentThreats?.length || 0) / THREATS_PER_PAGE);

    // Filter Top 5 Critical Threats for Spotlight
    // Sort by ingestion time (newest first), take top 5 - FIFO Queue
    const topCriticalThreats = (dashboard.recentThreats || [])
        .filter(t => t.confidence >= 70)
        .sort((a, b) => new Date(b.ingestedAt) - new Date(a.ingestedAt))
        .slice(0, 5);

    const currentSpotlightThreat = topCriticalThreats.length > 0
        ? topCriticalThreats[spotlightIndex % topCriticalThreats.length]
        : null;


    return (
        <div style={{
            ...containerStyle,
            '--bg-app': theme === 'dark' ? '#0B0F1A' : '#F3F4F6', // user: canvas.background
            '--surface-color': theme === 'dark' ? 'rgba(30, 41, 59, 0.7)' : '#FFFFFF', // user: surface.primary
            '--border-color': theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#E5E7EB', // user: borders.subtle
            '--text-primary': theme === 'dark' ? '#F3F4F6' : '#111827', // Darker text for better contrast on light
            '--text-secondary': theme === 'dark' ? '#94A3B8' : '#6B7280',
            '--bg-card': theme === 'dark' ? '#1E293B' : '#FFFFFF', // user: cards.default.background
            '--bg-tile': theme === 'dark' ? '#0F172A' : '#FAFAFA', // user: panels.threatPressure.background
            '--bg-tile-translucent': theme === 'dark' ? 'rgba(15, 23, 42, 0.4)' : '#FFFFFF', // Fallback, handled per tile
            '--bg-glass': theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.5)',
            '--bg-spotlight': theme === 'dark' ? 'rgba(239, 68, 68, 0.05)' : '#FFF1F2', // user: panels.criticalAction.background
            '--border-spotlight': theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#FCA5A5', // user: panels.criticalAction.border
            '--shadow-card': theme === 'dark' ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 1px 2px rgba(0,0,0,0.05)', // user: cards.default.shadow
        }}>
            {/* Hidden audio element for alerts */}
            <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS56+OdTgwOUKXh8LRkHQU2jdXwzn0vBSh+zPLaizsKFF+16+uoVRQKRp/g8r5sIQUrgs/y2Ik2CBhkuevjnU4MDlCl4fC0ZB0FNo3V8M59LwUofszy2os7ChRftevr" />

            {/* Critical Alert Banner */}
            {newCriticalAlert && (
                <div style={criticalAlertStyle}>
                    <Bell size={24} style={{ animation: 'pulse 1s infinite' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>CRITICAL THREAT DETECTED</div>
                        <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{newCriticalAlert.title}</div>
                    </div>
                    <button
                        onClick={() => setNewCriticalAlert(null)}
                        style={dismissButtonStyle}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Header with Overall State */}
            <div style={headerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <img
                        src="/logo.png"
                        alt="OrangeIntel Logo"
                        style={{
                            width: '52px',
                            height: '52px',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 0 10px rgba(249, 115, 22, 0.2))'
                        }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '800', letterSpacing: '-0.03em' }}>
                            <span style={{ color: '#F97316' }}>Orange</span><span style={{ color: 'var(--text-primary)' }}>Intel</span>
                        </h1>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: '400', letterSpacing: '0.5px' }}>
                            Threat Intelligence Platform
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{
                        ...overallStateStyle,
                        borderColor: getStateColor(dashboard.overallState),
                        color: getStateColor(dashboard.overallState)
                    }}>
                        {getStateIcon(dashboard.overallState)}
                        <div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>THREAT POSTURE</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{dashboard.overallState}</div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontWeight: 'bold' }}>SOC WALLBOARD 01</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                            REFRESH: {Math.floor(nextRefreshIn / 60)}m {nextRefreshIn % 60}s
                        </div>
                    </div>

                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        style={{
                            background: isRefreshing ? 'var(--border-color)' : '#F97316',
                            border: 'none',
                            color: '#FFF',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            cursor: isRefreshing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            transition: 'all 0.2s',
                            opacity: isRefreshing ? 0.6 : 1
                        }}
                    >
                        <Activity size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                        {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
                    </button>

                    <button
                        onClick={toggleTheme}
                        style={{
                            background: 'var(--surface-color)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </div>

            {/* Main Grid: Left (Intercepts) | Right (Metrics) */}
            <div style={mainGridStyle}>
                {/* LEFT: Latest Intercepts with Auto-Rotation */}
                <div style={interceptsColumnStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ ...sectionHeaderStyle, margin: 0 }}>Latest Intercepts</h2>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {dashboard.recentThreats?.length || 0} threats | Page {currentPage + 1}/{totalPages}
                        </div>
                    </div>

                    {visibleThreats.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                            {visibleThreats.map((threat, idx) => {
                                const severity = getSeverityBadge(threat.confidence);
                                const topic = extractTopic(threat);
                                return (
                                    <div
                                        key={threat.id || idx}
                                        style={{
                                            ...interceptCardStyle,
                                            animation: 'slideIn 0.5s ease-out'
                                        }}
                                    >
                                        <div style={{
                                            ...severityBadgeStyle,
                                            backgroundColor: severity.color + '20',
                                            color: severity.color,
                                            borderLeft: `4px solid ${severity.color}`
                                        }}>
                                            {severity.label}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                                <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>
                                                    {threat.title}
                                                </div>
                                                <div style={topicBadgeStyle}>
                                                    {topic}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                <span>Score: {threat.confidence}</span>
                                                <span>Source: {threat.source?.name || 'Unknown'}</span>
                                                <span>{formatTimestamp(threat.ingestedAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={emptyStateStyle}>No recent threats</div>
                    )}

                    {/* Pagination Dots */}
                    {totalPages > 1 && (
                        <div style={paginationDotsStyle}>
                            {Array.from({ length: totalPages }).map((_, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        ...dotStyle,
                                        backgroundColor: idx === currentPage ? '#F97316' : '#334155'
                                    }}
                                    onClick={() => setCurrentPage(idx)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* RIGHT: Metrics Clusters */}
                <div style={metricsColumnStyle}>
                    {/* Cluster 1: Threat Pressure */}
                    <div style={clusterStyle}>
                        <h3 style={clusterHeaderStyle}>Threat Pressure</h3>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={metricTileStyle}>
                                <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginBottom: '0.25rem', letterSpacing: '0.5px' }}>
                                    TIME SINCE LAST CONFIRMED CRITICAL
                                </div>
                                <div style={{ fontSize: '2.25rem', fontWeight: '800', lineHeight: 1 }}>
                                    {dashboard.lastCriticalThreatTime
                                        ? formatLiveTimeSpan(dashboard.lastCriticalThreatTime)
                                        : 'N/A'}
                                </div>
                            </div>
                            <div style={metricTileStyle}>
                                <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginBottom: '0.25rem', letterSpacing: '0.5px' }}>
                                    INCOMING VELOCITY
                                </div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: '800', lineHeight: 1, color: dashboard.velocity.status === 'SpikeDetected' ? '#EF4444' : '#10B981' }}>
                                        {dashboard.velocity.status === 'SpikeDetected' ? 'SPIKE' : 'NORMAL'}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                                        {dashboard.velocity.currentRate}/hr
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>
                                    Baseline: {dashboard.velocity.baselineRate || '1.2'}/hr
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Critical Threat Spotlight */}
                    {currentSpotlightThreat && (
                        <div style={spotlightSectionStyle}>
                            {/* Header Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <h3 style={{ ...clusterHeaderStyle, color: '#EF4444', margin: 0 }}>CRITICAL ACTION REQUIRED</h3>
                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Active Exploit</span>
                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>High Exposure</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{spotlightIndex % topCriticalThreats.length + 1} of {topCriticalThreats.length}</div>
                            </div>

                            <div style={spotlightCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '700', lineHeight: '1.3', flex: 1, marginRight: '1rem' }}>
                                        {currentSpotlightThreat.title}
                                    </div>
                                </div>

                                {/* Summary with Line Clamping */}
                                <div style={{
                                    fontSize: '0.9rem',
                                    color: '#94A3B8',
                                    marginBottom: '1rem',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 4,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    lineHeight: '1.5'
                                }}>
                                    {currentSpotlightThreat.summary || "No detailed summary available."}
                                </div>

                                {/* Footer Info */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748B' }}>
                                        Detected {formatTimeAgo(currentSpotlightThreat.ingestedAt)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cluster 2: Operational Load */}
                    <div style={clusterStyle}>
                        <h3 style={clusterHeaderStyle}>Operational Load</h3>
                        <ThreatCounters metrics={dashboard.threatCounts} />
                    </div>



                    {/* System Health */}
                    <div style={healthBarStyle}>
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>DB_CONN: </span>
                                    <span style={{ color: '#10B981', fontWeight: '700', fontFamily: 'monospace' }}>{dashboard.systemHealth.database?.toUpperCase()}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>INGEST: </span>
                                    <span style={{ color: '#10B981', fontWeight: '700', fontFamily: 'monospace' }}>{dashboard.systemHealth.ingestion?.toUpperCase()}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>LATENCY: </span>
                                    <span style={{ fontFamily: 'monospace', color: '#CBD5E1' }}>{dashboard.systemHealth.ingestLatencyMs}ms</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>ERR_24H: </span>
                                    <span style={{ fontFamily: 'monospace', color: dashboard.systemHealth.errorCount24h > 0 ? '#EF4444' : '#CBD5E1' }}>{dashboard.systemHealth.errorCount24h}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', borderLeft: '1px solid #334155', paddingLeft: '1.5rem' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>BACKLOG: </span>
                                    <span style={{ fontFamily: 'monospace', color: '#10B981' }}>0</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>FRESHNESS: </span>
                                    <span style={{ fontFamily: 'monospace', color: '#10B981' }}>&lt; 1m</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </div>
    );
};

// Helper to format live time span from a timestamp
const formatLiveTimeSpan = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        if (diffMs < 0) return '0m';

        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h ${diffMins % 60}m`;
        return `${diffHours}h ${diffMins % 60}m`;
    } catch {
        return 'N/A';
    }
};

// Helper to format TimeSpan from backend
const formatTimeSpan = (timeSpan) => {
    if (typeof timeSpan === 'string') {
        const parts = timeSpan.split(':');
        if (parts.length === 3) {
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            return `${hours}h ${minutes}m`;
        }
    }
    return 'N/A';
};

// Styles
const containerStyle = {
    height: '100vh',
    width: '100vw',
    backgroundColor: 'var(--bg-app)',
    color: 'var(--text-primary)',
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem',
    boxSizing: 'border-box',
    overflow: 'auto',
    fontFamily: "'Inter', system-ui, sans-serif",
    transition: 'background-color 0.3s, color 0.3s',
};

const criticalAlertStyle = {
    position: 'fixed',
    top: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#EF4444',
    color: '#FFF',
    padding: '1rem 2rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    zIndex: 1000,
    boxShadow: '0 10px 40px rgba(239, 68, 68, 0.5)',
    minWidth: '400px'
};

const dismissButtonStyle = {
    backgroundColor: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#FFF',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
};

const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid var(--border-color)',
    backdropFilter: 'blur(8px)',
};

const overallStateStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.875rem 1.5rem',
    border: '1px solid',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-glass)',
    backdropFilter: 'blur(4px)',
    transition: 'all 0.3s ease'
};

const mainGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '1.5rem',
    flex: 1,
    overflow: 'auto'
};

const interceptsColumnStyle = {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--surface-color)',
    backdropFilter: 'blur(12px)',
    borderRadius: '12px',
    padding: '1.5rem',
    border: '1px solid var(--border-color)',
    overflow: 'auto',
    boxShadow: 'var(--shadow-card)'
};

const metricsColumnStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    overflow: 'auto'
};

const sectionHeaderStyle = {
    fontSize: '1.2rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
};

const interceptCardStyle = {
    display: 'flex',
    gap: '1rem',
    padding: '1.25rem',
    backgroundColor: 'var(--bg-card)',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    transition: 'all 0.2s',
    minHeight: '110px'
};

const severityBadgeStyle = {
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '80px'
};

const topicBadgeStyle = {
    backgroundColor: '#334155',
    color: '#94A3B8',
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
};

const emptyStateStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: 'var(--text-secondary)',
    fontSize: '1.1rem'
};

const paginationDotsStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid var(--border-color)'
};

const dotStyle = {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'all 0.3s'
};

const clusterStyle = {
    backgroundColor: 'var(--surface-color)',
    backdropFilter: 'blur(12px)',
    borderRadius: '12px',
    padding: '1rem',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-card)'
};

const clusterHeaderStyle = {
    fontSize: '0.9rem',
    margin: '0 0 1rem 0',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1px'
};

const metricTileStyle = {
    flex: 1,
    padding: '1rem',
    backgroundColor: 'var(--bg-tile)',
    borderRadius: '6px',
    border: '1px solid var(--border-color)'
};

const priorityTileStyle = {
    padding: '1.25rem 1rem',
    backgroundColor: 'var(--bg-tile-translucent)',
    borderRadius: '10px',
    border: '1px solid',
    textAlign: 'center',
    transition: 'all 0.2s ease',
    cursor: 'default',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '0.25rem'
};

const healthBarStyle = {
    backgroundColor: 'var(--surface-color)',
    borderRadius: '8px',
    padding: '1rem 1.5rem',
    fontSize: '0.9rem'
};

const spotlightSectionStyle = {
    flex: 1, // Utilize remaining space
    display: 'flex',
    flexDirection: 'column',
    minHeight: '200px'
};

const spotlightCardStyle = {
    flex: 1,
    backgroundColor: 'var(--bg-spotlight)',
    border: '1px solid var(--border-spotlight)',
    borderRadius: '8px', // Tighter radius
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'none', // Removed shadow for flatter look
    animation: 'fadeIn 0.5s ease-in-out',
};

export default MonitoringScreen;
