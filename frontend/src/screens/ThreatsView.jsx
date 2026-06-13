import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { ArrowRight, Trash2, Clock, AlertCircle, RotateCw, ArrowUp, CheckCheck, X, Layers, Zap, Database, Download, Filter, ChevronDown, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import EmptyState from '../components/common/EmptyState';
import IntelligenceFilterBar from '../components/intelligence/IntelligenceFilterBar';
import Select from '../components/common/Select';
import styles from './TopicsView.module.css';

const SOURCE_THEMES = {
    'alienvault otx': '#10B981', 'the hacker news': '#EF4444', 'cisa kev': '#3B82F6',
    'bleepingcomputer': '#0284C7', 'techpoint africa': '#F97316', 'it news africa': '#E11D48',
    'cert nigeria': '#16A34A', 'ngcert': '#16A34A',
};

const CATEGORY_COLORS = {
    'Browsers': '#6366F1', 'Network Infrastructure': '#0EA5E9', 'Operating Systems': '#8B5CF6',
    'Identity & Authentication': '#F59E0B', 'Email & Phishing': '#EF4444', 'Cloud Services': '#06B6D4',
    'Endpoints': '#84CC16', 'Web Applications': '#F97316', 'Mobile': '#EC4899',
    'Financial Systems': '#10B981', 'Vulnerability/CVE': '#DC2626', 'Malware': '#B91C1C',
    'Threat Actor Activity': '#7C3AED', 'Uncategorized': '#6B7280',
};

const getSourceColor = (name) => {
    if (!name) return '#6B7280';
    const key = Object.keys(SOURCE_THEMES).find(k => name.toLowerCase().includes(k));
    return key ? SOURCE_THEMES[key] : '#6B7280';
};

const getCategoryColor = (c) => CATEGORY_COLORS[c] || '#6B7280';

const getConfidenceLabel = (score) => {
    if (score >= 90) return 'Very High Confidence';
    if (score >= 70) return 'High Confidence';
    if (score >= 50) return 'Moderate Confidence';
    if (score >= 30) return 'Low Confidence';
    return 'Unverified';
};

const getFreshnessLabel = (ingestedAt) => {
    const hrs = (Date.now() - new Date(ingestedAt)) / 3600000;
    if (hrs < 1) return 'Just now';
    if (hrs < 6) return `${Math.floor(hrs)}h ago`;
    if (hrs < 24) return 'Today';
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
};

const isSlaBreached = (ingestedAt) => {
    const hrs = (Date.now() - new Date(ingestedAt)) / 3600000;
    return hrs > 48;
};

// ─── Acknowledge Modal ───────────────────────────────────────
const AcknowledgeModal = ({ threat, onConfirm, onClose }) => {
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    return (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
            <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border-color)', borderRadius:'12px', padding:'1.75rem', width:'460px', maxWidth:'95vw', boxShadow:'var(--shadow-md)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
                    <h2 style={{ margin:0, color:'var(--text-primary)', fontSize:'1rem', fontWeight:700 }}>Acknowledge Threat Topic</h2>
                    <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:'2px' }}><X size={18}/></button>
                </div>
                <p style={{ margin:'0 0 1rem', color:'var(--text-secondary)', fontSize:'0.82rem', lineHeight:1.6 }}>
                    This will log <strong style={{ color:'var(--text-primary)' }}>"{threat.title}"</strong> to the audit trail and remove it from the active queue without creating an advisory.
                </p>
                <label style={{ display:'block', fontSize:'0.7rem', fontWeight:600, color:'var(--text-muted)', marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>Analyst Note</label>
                <textarea
                    value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for acknowledging without promotion..."
                    rows={3}
                    style={{ width:'100%', background:'var(--bg-app)', border:'1px solid var(--border-color)', borderRadius:'6px', padding:'0.65rem', color:'var(--text-primary)', fontSize:'0.83rem', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', outline:'none' }}
                />
                <div style={{ display:'flex', gap:'0.6rem', marginTop:'1.25rem', justifyContent:'flex-end' }}>
                    <button onClick={onClose} style={{ padding:'0.45rem 1rem', borderRadius:'5px', border:'1px solid var(--border-color)', background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontSize:'0.8rem', fontFamily:'inherit' }}>Cancel</button>
                    <button onClick={async () => { setSubmitting(true); await onConfirm(threat.id, note); setSubmitting(false); }}
                        disabled={submitting}
                        style={{ padding:'0.45rem 1.1rem', borderRadius:'5px', border:'1px solid rgba(139,92,246,0.4)', background:'rgba(139,92,246,0.15)', color:'#a78bfa', cursor:'pointer', fontSize:'0.8rem', fontWeight:600, display:'flex', alignItems:'center', gap:'6px', opacity: submitting ? 0.6 : 1, fontFamily:'inherit' }}>
                        <CheckCheck size={14}/> {submitting ? 'Logging...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Threat Card ─────────────────────────────────────────────
const ThreatCard = ({ threat, safeFormatDate, handlePromote, handleDiscard, onAcknowledge }) => {
    const score = Math.round(threat.confidence);
    const category = threat.category && threat.category !== 'Uncategorized' ? threat.category : 'Needs Classification';
    const sla = isSlaBreached(threat.ingestedAt);
    const freshness = getFreshnessLabel(threat.ingestedAt);

    let priority = 'LOW', severityClass = styles.severityLow;
    if (score >= 90) { priority = 'CRITICAL'; severityClass = styles.severityCritical; }
    else if (score >= 70) { priority = 'HIGH'; severityClass = styles.severityHigh; }
    else if (score >= 40) { priority = 'MEDIUM'; severityClass = styles.severityMedium; }

    let sourceLink = null;
    try { if (threat.metadataJson) { const m = JSON.parse(threat.metadataJson); sourceLink = m.Link || m.link || m.url || m.Url; } } catch {}

    return (
        <div className={`${styles.card} ${severityClass}`}>
            <div className={styles.cardMain}>
                {/* 1. Top row: tags + timestamp + source chip */}
                <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderLeft}>
                        <span className={styles.categoryBadge}>{category}</span>
                        <span className={styles.classificationBadge}>TLP:AMBER</span>
                        <span className={styles.confidenceBadge}>{getConfidenceLabel(score)}</span>
                        <span className={styles.cardTimestamp}><Clock size={11}/> {safeFormatDate(threat.firstSeen || threat.ingestedAt)}</span>
                    </div>
                    {threat.source && (
                        <div className={styles.sourceChip} style={{ '--source-color': getSourceColor(threat.source.name) }}>
                            {threat.source.name}
                        </div>
                    )}
                </div>

                {/* 2. Title */}
                <h3 className={styles.cardTitle}>{threat.title}</h3>

                {/* 3. Body text */}
                <p className={styles.cardBody}>{threat.summary || 'No summary available.'}</p>

                {/* 4. Metadata row */}
                <div className={styles.cardMetadataRow}>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Confidence</span>
                        <span className={styles.metaValue}>{score}%</span>
                    </div>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Source</span>
                        <span className={styles.metaValue}>{threat.source?.name || '—'}</span>
                    </div>
                    <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Indicators</span>
                        <span className={styles.metaValue}>{(threat.indicators||[]).length} Found</span>
                    </div>
                    {sla && (
                        <div className={styles.slaBadge}><Zap size={10}/> SLA BREACH</div>
                    )}
                </div>

                <div className={styles.cardDivider}/>

                {/* 6. Action row */}
                <div className={styles.cardActionRow}>
                    <button className={styles.tertiaryAction} onClick={() => handleDiscard(threat.id)}>Discard</button>
                    {sourceLink && (
                        <a href={sourceLink} target="_blank" rel="noopener noreferrer" className={styles.linkAction}>
                            Read Source
                        </a>
                    )}
                    <button className={styles.secondaryAction} onClick={() => onAcknowledge(threat)}>Acknowledge</button>
                    <button className={styles.primaryAction} onClick={() => handlePromote(threat.id)}>Review</button>
                </div>
            </div>
        </div>
    );
};

// ─── Acknowledged Card ────────────────────────────────────────
const AcknowledgedCard = ({ threat, safeFormatDate }) => {
    const catColor = getCategoryColor(threat.category || 'Uncategorized');
    const category = threat.category && threat.category !== 'Uncategorized' ? threat.category : 'Needs Classification';

    return (
        <div className={styles.ackCard}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.6rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <span style={{ fontSize:'0.63rem', fontWeight:800, padding:'2px 7px', borderRadius:'3px', border:'1px solid rgba(139,92,246,0.3)', background:'rgba(139,92,246,0.1)', color:'#a78bfa', letterSpacing:'0.06em' }}>ACKNOWLEDGED</span>
                    <span style={{ fontSize:'0.63rem', fontWeight:700, padding:'2px 7px', borderRadius:'3px', background:`${catColor}22`, color:catColor, border:`1px solid ${catColor}44`, display:'flex', alignItems:'center', gap:'3px' }}>
                        <Layers size={9}/> {category}
                    </span>
                </div>
                <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'4px' }}>
                    <Clock size={11}/> {safeFormatDate(threat.acknowledgedAt)}
                </span>
            </div>
            <h3 style={{ margin:'0 0 0.5rem', fontSize:'0.95rem', fontWeight:600, color:'var(--text-primary)' }}>{threat.title}</h3>
            {threat.acknowledgementNote && (
                <div style={{ padding:'0.6rem 0.9rem', background:'rgba(139,92,246,0.06)', borderLeft:'2px solid rgba(139,92,246,0.4)', borderRadius:'0 6px 6px 0', marginBottom:'0.6rem' }}>
                    <p style={{ margin:0, fontSize:'0.8rem', color:'var(--text-secondary)', lineHeight:1.5 }}>
                        <strong style={{ color:'#a78bfa', fontSize:'0.65rem', display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Analyst Note</strong>
                        {threat.acknowledgementNote}
                    </p>
                </div>
            )}
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                By: <strong style={{ color:'var(--text-secondary)' }}>{threat.acknowledgedBy || 'Unknown'}</strong>
                &nbsp;·&nbsp; {threat.source?.name || 'Automated Feed'}
            </div>
        </div>
    );
};

// ─── Main View ────────────────────────────────────────────────
const ThreatsView = () => {
    const [threats, setThreats] = useState([]);
    const [acknowledgedThreats, setAcknowledgedThreats] = useState([]);
    const { user: currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [error, setError] = useState(null);
    const [sortOrder, setSortOrder] = useState('newest');
    const [activeTab, setActiveTab] = useState('PENDING');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [acknowledgeTarget, setAcknowledgeTarget] = useState(null);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [filters, setFilters] = useState({ priority: 'All', days: '7', sector: 'All', startDate: null, endDate: null });
    const [showFilters, setShowFilters] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const navigate = useNavigate();

    const safeFormatDate = (d) => { 
        try { 
            if (!d) return 'N/A'; 
            const date = new Date(d);
            // Use local formatting
            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch { 
            return 'Invalid'; 
        }
    };

    const fetchThreats = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const params = { priority: filters.priority, sector: filters.sector };
            if (filters.days === 'custom') { if (filters.startDate) params.startDate = filters.startDate; if (filters.endDate) params.endDate = filters.endDate; }
            else params.days = filters.days;
            if (isManual) params.t = Date.now();
            const res = await axios.get('/api/intelligence', { params });
            setThreats(Array.isArray(res.data) ? res.data : []);
            setLastUpdated(new Date());
            if (isManual) toast.success('Queue refreshed');
        } catch (e) { setError(e.message); if (isManual) toast.error('Failed to refresh'); }
        finally { setLoading(false); setRefreshing(false); }
    }, [filters.days, filters.endDate, filters.priority, filters.sector, filters.startDate]);

    const fetchAcknowledged = useCallback(async () => {
        try { const res = await axios.get('/api/threats/acknowledged'); setAcknowledgedThreats(Array.isArray(res.data) ? res.data : []); } catch {}
    }, []);

    useEffect(() => { fetchThreats(); fetchAcknowledged(); }, [fetchThreats, fetchAcknowledged]);
    useEffect(() => {
        const h = () => setShowBackToTop(window.scrollY > 300);
        window.addEventListener('scroll', h);
        return () => window.removeEventListener('scroll', h);
    }, []);

    const handlePromote = async (id) => {
        try { const res = await axios.post('/api/threats/promote', { ThreatId: id }); navigate(`/advisories/${res.data.advisory_id}`); toast.success('Assigned for review'); }
        catch { toast.error('Failed to assign'); }
    };

    const handleDiscard = async (id) => {
        const tid = toast.loading('Discarding...');
        try { await axios.post('/api/threats/discard', { ThreatId: id }); toast.success('Threat discarded', { id: tid }); setThreats(p => p.filter(t => t.id !== id)); }
        catch { toast.error('Failed to discard', { id: tid }); }
    };

    const handleAcknowledgeConfirm = async (id, note) => {
        const tid = toast.loading('Acknowledging...');
        try {
            const userName = currentUser?.userName || currentUser?.email || 'Analyst';
            await axios.post(`/api/threats/${id}/acknowledge`, { AcknowledgedBy: userName, Note: note });
            toast.success('Logged to audit trail', { id: tid });
            setThreats(p => p.filter(t => t.id !== id));
            setAcknowledgeTarget(null);
            fetchAcknowledged();
        } catch { toast.error('Failed to acknowledge', { id: tid }); setAcknowledgeTarget(null); }
    };

    const handleExportCSV = () => {
        if (!acknowledgedThreats || acknowledgedThreats.length === 0) {
            toast.error('No acknowledged threats to export');
            return;
        }

        const headers = ['Title', 'Category', 'Severity', 'Analyst', 'Date Acknowledged', 'Note', 'Source'];
        const rows = acknowledgedThreats.map(t => [
            `"${t.title.replace(/"/g, '""')}"`,
            `"${(t.category || 'Uncategorized').replace(/"/g, '""')}"`,
            t.confidence >= 70 ? 'High' : (t.confidence >= 40 ? 'Medium' : 'Low'),
            `"${(t.acknowledgedBy || 'Unknown').replace(/"/g, '""')}"`,
            `"${safeFormatDate(t.acknowledgedAt)}"`,
            `"${(t.acknowledgementNote || '').replace(/"/g, '""')}"`,
            `"${(t.source?.name || 'N/A').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `acknowledged_threats_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV export started');
    };

    const handleIngest = async () => {
        const tid = toast.loading('Ingesting live data...');
        try { const res = await axios.post('/api/threats/ingest'); toast.success(res.data.message || 'Done', { id: tid }); fetchThreats(); }
        catch { toast.error('Ingestion failed', { id: tid }); }
    };

    const handlePurge = async () => {
        const tid = toast.loading('Scanning...');
        try { const res = await axios.post('/api/threats/purge-irrelevant'); const n = res.data.count; toast.success(n === 0 ? 'Queue clean.' : `Removed ${n} items.`, { id: tid }); if (n > 0) fetchThreats(); }
        catch { toast.error('Purge failed', { id: tid }); }
    };

    if (loading) return (
        <div className={styles.container}>
            {/* Header skeleton */}
            <header className={styles.header}>
                <div className={styles.headerTitleRow}>
                    <div className={styles.titleBlock}>
                        <div className="sk-bone sk-h-lg" style={{ width: 260, marginBottom: 8 }}/>
                        <div className="sk-bone sk-h-sm" style={{ width: 380 }}/>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                        <div className="sk-bone sk-h-xl sk-circle" style={{ width:36, height:36 }}/>
                        <div className="sk-bone sk-h-xl sk-circle" style={{ width:36, height:36 }}/>
                        <div className="sk-bone sk-h-xl sk-pill" style={{ width:120 }}/>
                    </div>
                </div>

                {/* Metric cards */}
                <div className={styles.metricCardsRow}>
                    {[1,2,3].map(i => (
                        <div key={i} className={styles.metricCard} style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            <div className="sk-bone sk-h-2xl" style={{ width:48, borderRadius:8 }}/>
                            <div className="sk-bone sk-h-xs sk-pill" style={{ width:56 }}/>
                        </div>
                    ))}
                </div>

                {/* Tabs + filters */}
                <div className={styles.toolbarRow}>
                    <div className={styles.tabGroup}>
                        <div className="sk-bone sk-h-lg sk-pill" style={{ width:80 }}/>
                        <div className="sk-bone sk-h-lg sk-pill" style={{ width:110 }}/>
                    </div>
                    <div style={{ flex:1 }}/>
                    <div className="sk-bone sk-h-lg sk-pill" style={{ width:110 }}/>
                    <div className="sk-bone sk-h-lg sk-pill" style={{ width:90 }}/>
                </div>
            </header>

            {/* Threat card skeletons — mirrors ThreatCard structure */}
            <div className={styles.list}>
                {[1,2,3].map(i => (
                    <div key={i} className={styles.card} style={{ padding:'18px 20px' }}>
                        {/* Top row: badges + source chip */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                <div className="sk-bone sk-h-sm sk-pill" style={{ width:120 }}/>
                                <div className="sk-bone sk-h-sm sk-pill" style={{ width:70 }}/>
                                <div className="sk-bone sk-h-sm sk-pill" style={{ width:100 }}/>
                                <div className="sk-bone sk-h-sm sk-pill" style={{ width:60 }}/>
                            </div>
                            <div className="sk-bone sk-h-lg sk-pill" style={{ width:90 }}/>
                        </div>

                        {/* Title */}
                        <div className="sk-bone sk-h-md" style={{ width:'75%', marginBottom:10 }}/>

                        {/* Body text */}
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                            <div className="sk-bone sk-h-sm sk-w-full"/>
                            <div className="sk-bone sk-h-sm sk-w-80"/>
                        </div>

                        {/* Metadata row */}
                        <div style={{ display:'flex', gap:20, marginBottom:14 }}>
                            {[1,2,3].map(j => (
                                <div key={j} style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                    <div className="sk-bone sk-h-xs" style={{ width:60 }}/>
                                    <div className="sk-bone sk-h-sm" style={{ width:80 }}/>
                                </div>
                            ))}
                        </div>

                        <div style={{ height:1, background:'var(--border-color)', margin:'10px 0' }}/>

                        {/* Action buttons */}
                        <div style={{ display:'flex', gap:8 }}>
                            <div className="sk-bone sk-h-lg sk-pill" style={{ width:70 }}/>
                            <div className="sk-bone sk-h-lg sk-pill" style={{ width:100 }}/>
                            <div style={{ flex:1 }}/>
                            <div className="sk-bone sk-h-lg sk-pill" style={{ width:80 }}/>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    if (error) return <div className={styles.error}>Error: {error}</div>;

    const safeThreats = Array.isArray(threats) ? threats : [];
    const allCategories = ['All', ...new Set(safeThreats.map(t => t.category || 'Uncategorized'))];
    const processedThreats = safeThreats
        .filter(t => categoryFilter === 'All' || (t.category || 'Uncategorized') === categoryFilter)
        .sort((a, b) => {
            switch (sortOrder) {
                case 'newest': return new Date(b.ingestedAt||0) - new Date(a.ingestedAt||0);
                case 'oldest': return new Date(a.ingestedAt||0) - new Date(b.ingestedAt||0);
                case 'highest_score': return (b.confidence||0) - (a.confidence||0);
                case 'lowest_score': return (a.confidence||0) - (b.confidence||0);
                default: return 0;
            }
        });

    const pendingCount = safeThreats.length;
    const slaBreached = safeThreats.filter(t => isSlaBreached(t.ingestedAt)).length;
    const isAcknowledgedTab = activeTab === 'ACKNOWLEDGED';

    return (
        <div className={styles.container}>
            {acknowledgeTarget && <AcknowledgeModal threat={acknowledgeTarget} onConfirm={handleAcknowledgeConfirm} onClose={() => setAcknowledgeTarget(null)}/>}

            <header className={styles.header}>
                <div className={styles.headerTitleRow}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>Threat Intelligence Queue</h1>
                        <p className={styles.subtitle}>Untriaged intelligence requiring analyst assessment and disposition</p>
                    </div>
                    <div className={styles.headerActions}>
                        <button className={styles.headerActionButton} onClick={() => { fetchThreats(true); fetchAcknowledged(); }} disabled={refreshing} title="Refresh">
                            <RotateCw size={14} className={refreshing ? styles.animateSpin : ''}/>
                        </button>
                        {isAcknowledgedTab ? (
                            <button className={styles.headerActionButton} onClick={handleExportCSV} title="Export to CSV" style={{ color: 'var(--color-success)' }}>
                                <Download size={14}/>
                            </button>
                        ) : (
                            <>
                                <button className={styles.headerActionButton} onClick={handlePurge} title="Clean DB"><Database size={14}/></button>
                                <button className={styles.headerIngestButton} onClick={handleIngest}><Zap size={12}/> Ingest Live Data</button>
                            </>
                        )}
                    </div>
                </div>

                <div className={styles.metricCardsRow}>
                    <div className={styles.metricCard}>
                        <div className={styles.metricValue}>{pendingCount}</div>
                        <div className={styles.metricLabel}>Pending</div>
                    </div>
                    <div className={`${styles.metricCard} ${styles.metricSla}`}>
                        <div className={styles.metricValue}>{slaBreached}</div>
                        <div className={styles.metricLabel}>SLA Breach</div>
                        <div className={styles.slaPulse}/>
                    </div>
                    <div className={`${styles.metricCard} ${styles.metricAck}`}>
                        <div className={styles.metricValue}>{acknowledgedThreats.length}</div>
                        <div className={styles.metricLabel}>Acknowledged</div>
                    </div>
                </div>

                <div className={styles.toolbarRow}>
                    <div className={styles.tabGroup}>
                        <button className={`${styles.tab} ${activeTab === 'PENDING' ? styles.tabActive : ''}`} onClick={() => setActiveTab('PENDING')}>Pending</button>
                        <button className={`${styles.tab} ${activeTab === 'ACKNOWLEDGED' ? styles.tabActive : ''}`} onClick={() => setActiveTab('ACKNOWLEDGED')}>
                            Acknowledged {acknowledgedThreats.length > 0 && <span className={styles.tabBadge}>{acknowledgedThreats.length}</span>}
                        </button>
                    </div>

                    <div style={{ flex: 1 }} />

                    {!isAcknowledgedTab && (
                        <div className={styles.filterToolbar}>
                            <div className={styles.sortWrapper}>
                                <button 
                                    className={styles.sortButton}
                                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                                >
                                    <ArrowUpDown size={14}/>
                                    <span>{sortOrder === 'newest' ? 'Newest First' : sortOrder === 'oldest' ? 'Oldest First' : sortOrder === 'highest_score' ? 'Highest Score' : 'Lowest Score'}</span>
                                    <ChevronDown size={14} style={{ transform: showSortDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
                                </button>
                                {showSortDropdown && (
                                    <div className={styles.sortDropdown}>
                                        {[
                                            { value:'newest', label:'Newest First' },
                                            { value:'oldest', label:'Oldest First' },
                                            { value:'highest_score', label:'Highest Score' },
                                            { value:'lowest_score', label:'Lowest Score' }
                                        ].map(opt => (
                                            <div 
                                                key={opt.value} 
                                                className={`${styles.sortOption} ${sortOrder === opt.value ? styles.sortOptionActive : ''}`}
                                                onClick={() => { setSortOrder(opt.value); setShowSortDropdown(false); }}
                                            >
                                                {opt.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={styles.filterCollapseWrapper}>
                                <button 
                                    className={`${styles.filterToggleButton} ${showFilters ? styles.filterToggleActive : ''}`}
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <SlidersHorizontal size={14}/>
                                    <span>Filters</span>
                                    {Object.values(filters).filter(v => v !== 'All' && v !== '7' && v !== null).length > 0 && (
                                        <span className={styles.filterCountBadge}>
                                            {Object.values(filters).filter(v => v !== 'All' && v !== '7' && v !== null).length}
                                        </span>
                                    )}
                                </button>
                                {showFilters && (
                                    <div className={styles.filterDropdownPanel}>
                                        <div className={styles.filterPanelHeader}>Quick Filters</div>
                                        <div className={styles.filterPanelGrid}>
                                            <div className={styles.filterPanelItem}>
                                                <label>Category</label>
                                                <Select
                                                    value={categoryFilter}
                                                    onChange={e => setCategoryFilter(e.target.value)}
                                                    options={[{ value:'All', label:'All Categories' }, ...allCategories.filter(c => c !== 'All').map(c => ({ value: c, label: c }))]}
                                                />
                                            </div>
                                            <IntelligenceFilterBar filters={filters} setFilters={setFilters} compact={true}/>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* CONTENT */}
            {isAcknowledgedTab ? (
                acknowledgedThreats.length === 0
                    ? <EmptyState title="No acknowledged topics" message="Topics you acknowledge will appear here as an audit trail."/>
                    : <div className={styles.list}>{acknowledgedThreats.map(t => <AcknowledgedCard key={t.id} threat={t} safeFormatDate={safeFormatDate}/>)}</div>
            ) : (
                processedThreats.length === 0
                    ? <EmptyState title="No topics found" message="Try adjusting your filters or ingesting new data."
                        action={<button className={styles.refreshButton} onClick={() => { setFilters({ priority:'All', days:'7', sector:'All', startDate:null, endDate:null }); setCategoryFilter('All'); }}>Reset Filters</button>}/>
                    : <div className={styles.list}>{processedThreats.map(t =>
                        <ThreatCard key={t.id} threat={t} safeFormatDate={safeFormatDate}
                            handlePromote={handlePromote} handleDiscard={handleDiscard} onAcknowledge={setAcknowledgeTarget}/>
                    )}</div>
            )}

            {showBackToTop && (
                <button className={styles.backToTop} onClick={() => window.scrollTo({ top:0, behavior:'smooth' })} title="Back to top">
                    <ArrowRight size={16} style={{ transform:'rotate(-90deg)' }}/>
                </button>
            )}
        </div>
    );
};

export default ThreatsView;
