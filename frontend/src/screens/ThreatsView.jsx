import React, { useEffect, useState } from 'react';
import { ArrowRight, Trash2, Clock, AlertCircle, RotateCw, ArrowUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import EmptyState from '../components/common/EmptyState';
import styles from './TopicsView.module.css';

const SOURCE_THEMES = {
    'alienvault otx': '#10B981', // Green
    'the hacker news': '#EF4444', // Red
    'cisa kev': '#3B82F6',       // Blue
    'vendor alerts': '#8B5CF6'   // Purple
};

const getSourceColor = (name) => {
    if (!name) return '#9CA3AF';
    const key = Object.keys(SOURCE_THEMES).find(k => name.toLowerCase().includes(k));
    return key ? SOURCE_THEMES[key] : '#9CA3AF'; // Default gray
};

const ThreatsView = () => {
    const [threats, setThreats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [error, setError] = useState(null);
    const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest, highest_score, lowest_score
    const [filterCategory, setFilterCategory] = useState('all');
    const [scopeFilter, setScopeFilter] = useState('ALL'); // Default scope
    const [showBackToTop, setShowBackToTop] = useState(false);
    const navigate = useNavigate();

    const safeFormatDate = (dateStr) => {
        try {
            if (!dateStr) return 'N/A';
            return new Date(dateStr).toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
        } catch (e) {
            console.error("Date parse error", dateStr, e);
            return 'Invalid Date';
        }
    };

    console.log("Rendering ThreatsView, threats count:", threats.length);

    const fetchThreats = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        try {
            // Add timestamp to prevent caching
            const url = isManualRefresh ? `/api/threats?t=${Date.now()}` : '/api/threats';
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch threats');
            const data = await response.json();
            setThreats(Array.isArray(data) ? data : []);
            setLastUpdated(new Date());
            if (isManualRefresh) toast.success('List refreshed');
        } catch (err) {
            setError(err.message);
            if (isManualRefresh) toast.error('Failed to refresh list');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchThreats();
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 300) {
                setShowBackToTop(true);
            } else {
                setShowBackToTop(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handlePromote = async (threatId) => {
        try {
            const response = await fetch('/api/threats/promote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ThreatId: threatId }),
            });
            if (!response.ok) throw new Error('Failed to promote threat');
            const data = await response.json();
            // Navigate to the newly created advisory
            navigate(`/advisories/${data.advisory_id}`);
            toast.success('Threat promoted to Advisory', {
                style: {
                    background: '#333',
                    color: '#fff',
                },
            });
        } catch (err) {
            console.error(err);
            toast.error('Failed to promote topic', {
                style: {
                    background: '#333',
                    color: '#fff',
                },
            });
        }
    };

    const handleDiscard = async (threatId) => {
        // TODO: Implement discard API
        toast('Discarded threat', {
            icon: '🗑️',
            style: {
                background: '#333',
                color: '#fff',
            },
        });
        // filter out locally for now
        setThreats(prev => prev.filter(t => t.id !== threatId));
    };

    if (loading) return <div className={styles.loading}>Loading intelligence...</div>;
    if (error) return <div className={styles.error}>Error: {error}</div>;

    const handleIngest = async () => {
        const toastId = toast.loading('Ingesting live threat data...');
        try {
            const res = await fetch('/api/threats/ingest', { method: 'POST' });
            const data = await res.json();
            toast.success(data.message || 'Ingestion complete', { id: toastId });
            fetchThreats();
        } catch (err) {
            toast.error('Ingestion failed', { id: toastId });
        }
    };

    // Verify threats is an array before mapping
    const safeThreats = Array.isArray(threats) ? threats : [];

    // Extract unique categories (ThreatTypes) from threats
    const categories = ['all', ...new Set(safeThreats.map(t => t?.threatType || 'Unknown'))];

    const getProcessedThreats = () => {
        try {
            let processed = [...safeThreats];

            // 1. Scope Filter (Mock Logic)
            if (scopeFilter === 'UNTRIAGED') {
                // In a real app, check status. Here, maybe just exclude hidden?
                // For now, pass through to verify UI.
            }

            // 2. Category Filter
            if (filterCategory !== 'all') {
                processed = processed.filter(t => (t?.threatType || 'Unknown') === filterCategory);
            }

            // 3. Sort
            processed.sort((a, b) => {
                if (!a || !b) return 0;
                // ... same sort logic ...
                const getDate = (item) => {
                    const d = new Date(item.firstSeen || item.ingestedAt || 0);
                    return isNaN(d.getTime()) ? 0 : d.getTime();
                };

                const dateA = getDate(a);
                const dateB = getDate(b);
                const scoreA = a.confidence || 0;
                const scoreB = b.confidence || 0;

                switch (sortOrder) {
                    case 'newest': return dateB - dateA;
                    case 'oldest': return dateA - dateB;
                    case 'highest_score': return scoreB - scoreA;
                    case 'lowest_score': return scoreA - scoreB;
                    default: return 0;
                }
            });

            return processed;
        } catch (err) {
            console.error("Error processing threats:", err);
            return safeThreats;
        }
    };

    const displayedThreats = getProcessedThreats();

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                {/* Top Row: Context Only */}
                <div className={styles.leftContext}>
                    <h1 className={styles.title}>Threat Intelligence Queue</h1>
                    <p className={styles.subtitle} style={{ color: 'var(--text-secondary)', marginTop: '0', fontSize: '0.9rem' }}>
                        Untriaged intelligence requiring analyst assessment and disposition
                    </p>
                </div>

                {/* Bottom Row: Unified Command Bar (Filters + Actions) */}
                <div className={styles.filterBar}>
                    {/* Left: Filters */}
                    <div className={styles.filterGroup}>
                        {/* Scope Segments */}
                        {['ALL'].map(scope => (
                            <button
                                key={scope}
                                className={`${styles.segmentButton} ${scopeFilter === scope ? styles.activeFilter : ''}`}
                                onClick={() => setScopeFilter(scope)}
                            >
                                {scope}
                            </button>
                        ))}

                        {/* Sort Filter */}
                        <select
                            className={styles.inlineToggle}
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option value="newest">NEWEST FIRST</option>
                            <option value="oldest">OLDEST FIRST</option>
                            <option value="highest_score">HIGHEST SCORE</option>
                            <option value="lowest_score">LOWEST SCORE</option>
                        </select>
                    </div>

                    {/* Right: Actions (Moved from Top Row) */}
                    <div className={styles.rightActions}>
                        <div className={styles.timestamp}>
                            <Clock size={14} />
                            <span>Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <button
                            className={styles.secondaryButton}
                            onClick={() => fetchThreats(true)}
                            disabled={refreshing}
                            title="Refresh List"
                        >
                            <RotateCw size={18} className={refreshing ? styles.animateSpin : ''} />
                        </button>

                        <button className={styles.primaryButton} onClick={handleIngest}>
                            Ingest Live Data
                        </button>
                    </div>
                </div>
            </header>

            {displayedThreats.length === 0 ? (
                <EmptyState
                    title="No topics found"
                    message="Try adjusting your filters or ingesting new data."
                    action={
                        <button className={styles.refreshButton} onClick={() => { setFilterCategory('all'); setSortOrder('newest'); }}>Reset Filters</button>
                    }
                />
            ) : (
                <div className={styles.list}>
                    {displayedThreats.map(threat => {
                        const score = Math.round(threat.confidence);

                        // New Logic: 
                        // Critical >= 90
                        // High >= 70
                        // Medium >= 40 (Amber)

                        let priority = 'LOW';
                        let priorityColor = 'var(--text-secondary)';
                        let badgeLabel = 'LOW PRIORITY';

                        if (score >= 90) {
                            priority = 'CRITICAL';
                            priorityColor = 'var(--color-danger)';
                            badgeLabel = 'CRITICAL';
                        } else if (score >= 70) {
                            priority = 'HIGH';
                            priorityColor = '#F97316'; // Orange
                            badgeLabel = 'HIGH PRIORITY';
                        } else if (score >= 40) {
                            priority = 'MEDIUM';
                            priorityColor = '#F59E0B'; // Amber - Correct visual treatment
                            badgeLabel = 'MONITORING'; // "Contextual" or "Monitoring" per spec
                        }

                        return (
                            <div key={threat.id} className={styles.card} style={{ borderLeftColor: priorityColor }}>
                                <div className={styles.cardContent}>
                                    <div className={styles.cardHeader}>
                                        <span
                                            className={styles.priorityBadge}
                                            data-priority={priority}
                                            style={priority === 'MEDIUM' ? {
                                                color: '#F59E0B',
                                                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                                borderColor: 'rgba(245, 158, 11, 0.2)'
                                            } : {}}
                                        >
                                            {badgeLabel}
                                        </span>
                                        <span className={styles.detectedTime}>Detected: {safeFormatDate(threat.firstSeen || threat.ingestedAt)}</span>
                                    </div>

                                    <h3 className={styles.cardTitle}>{threat.title}</h3>
                                    <p className={styles.cardSummary} style={{
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.85rem',
                                        margin: '0.5rem 0',
                                        lineHeight: '1.4',
                                        display: '-webkit-box',
                                        WebkitLineClamp: '3',
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {threat.summary || "No detailed summary available."}
                                    </p>

                                    <div className={styles.metrics}>
                                        <div className={styles.metric}>
                                            <span className={styles.metricLabel}>CONFIDENCE</span>
                                            <span className={styles.metricValueLarge}>{score} <span className={styles.metricMax}>/100</span></span>
                                        </div>
                                        <div className={styles.metricDivider}></div>
                                        <div className={styles.metric}>
                                            <span className={styles.metricLabel}>SOURCES</span>
                                            <span className={styles.metricValue}>{(threat.source ? 1 : 0)}</span>
                                        </div>
                                        <div className={styles.metricDivider}></div>
                                        <div className={styles.metric}>
                                            <span className={styles.metricLabel}>INDICATORS</span>
                                            <span className={styles.metricValue}>
                                                <AlertCircle size={14} style={{ display: 'inline', marginRight: 4 }} />
                                                {(threat.indicators || []).length}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.cardActions}>
                                    {threat.source && (
                                        <span
                                            className={styles.sourceTag}
                                            style={{ color: getSourceColor(threat.source.name) }}
                                        >
                                            {threat.source.name}
                                        </span>
                                    )}
                                    {(() => {
                                        let link = null;
                                        try {
                                            if (threat.metadataJson) {
                                                const meta = JSON.parse(threat.metadataJson);
                                                link = meta.Link || meta.link || meta.url || meta.Url;
                                            }
                                        } catch (e) { /* ignore parse error */ }

                                        if (link) {
                                            return (
                                                <a
                                                    href={link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.linkButton}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ArrowRight size={16} /> Read Source
                                                </a>
                                            );
                                        }
                                        return null;
                                    })()}

                                    <button
                                        className={styles.acceptButton}
                                        onClick={() => handlePromote(threat.id)}
                                    >
                                        <span className={styles.checkIcon}>✓</span> Accept Topic
                                    </button>
                                    <button
                                        className={styles.discardButton}
                                        onClick={() => handleDiscard(threat.id)}
                                    >
                                        <Trash2 size={16} /> Discard Topic
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showBackToTop && (
                <button
                    className={styles.backToTop}
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    title="Back to Top"
                >
                    <ArrowUp size={20} />
                </button>
            )}
        </div>
    );
};

export default ThreatsView;
