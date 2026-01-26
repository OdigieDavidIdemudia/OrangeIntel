import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from '../components/common/Select';
import styles from './AdvisoryBuilder.module.css';

const AdvisoryBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [advisory, setAdvisory] = useState({
        title: '',
        overview: '',
        technicalDetails: '',
        affectedAssets: [],
        attackVector: '',
        deliveryMechanism: '',
        initialAccess: '',
        persistence: '',
        defenseEvasion: '',
        commandAndControl: '',
        exfiltration: '',
        severity: 'Medium',
        recommendations: [],
        references: [],
        iocs: [],
        confidenceStatement: '',
        status: 'draft'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAdvisory();
    }, [id]);

    const fetchAdvisory = async () => {
        if (id === 'new') {
            setLoading(false);
            return;
        }
        try {
            const response = await fetch(`/api/advisories/${id}`);
            if (!response.ok) throw new Error('Advisory not found');
            const data = await response.json();

            // Map camelCase backend response to local state if needed, 
            // or better, just use the data as is if we update state keys.
            // For now, let's map manualy to preserve existing UI binding
            setAdvisory({
                id: data.id,
                title: data.title || '',
                overview: data.executiveSummary || '',
                technicalDetails: data.technicalDetails || '',
                affectedAssets: data.affectedAssets || [],
                attackVector: data.attackVector || '',
                deliveryMechanism: data.deliveryMechanism || '',
                initialAccess: data.initialAccess || '',
                persistence: data.persistence || '',
                defenseEvasion: data.defenseEvasion || '',
                commandAndControl: data.commandAndControl || '',
                exfiltration: data.exfiltration || '',
                severity: data.severity === 0 ? 'Low' : data.severity === 1 ? 'Medium' : data.severity === 2 ? 'High' : 'Critical',
                recommendations: data.recommendations || [],
                references: data.references || [],
                iocs: data.iocs || [],
                confidenceStatement: data.confidenceStatement || '',
                status: data.status === 1 ? 'approved' : 'draft'
            });
        } catch (err) {
            console.error("Failed to load advisory", err);
            toast.error('Failed to load advisory details');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setAdvisory(prev => ({ ...prev, [field]: value }));
    };

    const handleArrayChange = (field, index, value) => {
        const newArray = [...advisory[field]];
        newArray[index] = value;
        handleChange(field, newArray);
    };

    const addArrayItem = (field) => {
        handleChange(field, [...advisory[field], '']);
    };

    const removeArrayItem = (field, index) => {
        const newArray = advisory[field].filter((_, i) => i !== index);
        handleChange(field, newArray);
    };

    const saveDraft = async () => {
        setSaving(true);
        try {
            // Identify update endpoint
            const response = await fetch('/api/advisories/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...advisory,
                    // Specific Mappings for Backend Entity
                    Title: advisory.title,
                    ExecutiveSummary: advisory.overview,
                    TechnicalDetails: advisory.technicalDetails,
                    AttackVector: advisory.attackVector,
                    DeliveryMechanism: advisory.deliveryMechanism,
                    InitialAccess: advisory.initialAccess,
                    Persistence: advisory.persistence,
                    DefenseEvasion: advisory.defenseEvasion,
                    CommandAndControl: advisory.commandAndControl,
                    Exfiltration: advisory.exfiltration,

                    AffectedAssets: advisory.affectedAssets,
                    ImpactedSectors: advisory.affectedAssets, // Keep legacy populate

                    Recommendations: advisory.recommendations,
                    RecommendedActions: advisory.recommendations.join('; '), // Legacy fallback

                    References: advisory.references,
                    IOCs: advisory.iocs,
                    ConfidenceStatement: advisory.confidenceStatement,

                    // Map Severity Enum
                    Severity: advisory.severity === 'Low' ? 0 : advisory.severity === 'Medium' ? 1 : advisory.severity === 'High' ? 2 : 3,
                    Status: advisory.status === 'approved' ? 1 : 0
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Save failed:', response.status, errorText);
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }

            toast.success('Advisory draft saved');
        } catch (err) {
            console.error("Save error:", err);
            toast.error(err.message || 'Failed to save draft');
        } finally {
            setSaving(false);
        }
    };

    const approveAdvisory = async () => {
        toast((t) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span>Are you sure? Approved advisories are immuatable.</span>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => { toast.dismiss(t.id); processApproval(); }}
                        style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', background: 'var(--color-brand)', color: 'white', border: 'none' }}
                    >
                        Approve
                    </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: 5000 });
    };

    const handleSave = async (isDraft = false) => {
        setSaving(true);
        try {
            const endpoint = isDraft ? '/api/advisories/draft' : '/api/advisories/update';
            // Determine payload based on draft vs full update
            // For now sending full object, backend handles draft specific mapping if needed
            // Advisory endpoints expects different structures? 
            // AdvisoryController.SaveDraft expects AdvisoryDraft.
            // We need to construct AdvisoryDraft object on client or update controller to accept DTO.
            // Let's assume controller update to accept similar DTO or we start simple.
            // Actually, for Draft, we usually send the Form Data.
            // I'll update the payload construction.

            // NOTE: The backend SaveDraft expects AdvisoryDraft entity which is not ideal for frontend direct send.
            // It expects ContentJson.
            // I should update frontend to match backend expectation OR update backend.
            // For speed, let's wrap it here.

            let payload;
            if (isDraft) {
                payload = {
                    id: id === 'new' ? null : id, // Backend handles GUID generation if null/empty
                    contentJson: JSON.stringify(advisory), // Saving entire state
                    authorId: 'current-user-placeholder'
                };
            } else {
                payload = advisory;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to save');

            const data = await response.json();
            toast.success(isDraft ? 'Draft saved' : 'Advisory saved');

            if (isDraft && id === 'new' && data.id) {
                navigate(`/advisories/${data.id}`, { replace: true });
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        try {
            const payload = {
                ...advisory,
                // Specific Mappings for Backend Entity
                Title: advisory.title,
                ExecutiveSummary: advisory.overview,
                TechnicalDetails: advisory.technicalDetails,
                AttackVector: advisory.attackVector,
                DeliveryMechanism: advisory.deliveryMechanism,
                InitialAccess: advisory.initialAccess,
                Persistence: advisory.persistence,
                DefenseEvasion: advisory.defenseEvasion,
                CommandAndControl: advisory.commandAndControl,
                Exfiltration: advisory.exfiltration,

                AffectedAssets: advisory.affectedAssets,
                ImpactedSectors: advisory.affectedAssets, // Legacy

                Recommendations: advisory.recommendations,
                RecommendedActions: advisory.recommendations.join('; '), // Legacy

                References: advisory.references,
                IOCs: advisory.iocs,
                ConfidenceStatement: advisory.confidenceStatement,

                // Map Severity Enum
                Severity: advisory.severity === 'Low' ? 0 : advisory.severity === 'Medium' ? 1 : advisory.severity === 'High' ? 2 : 3,
                Status: advisory.status === 'approved' ? 1 : 0
            };

            const response = await fetch('/api/advisories/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('Preview generation failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            toast.error(e.message);
        }
    };

    if (loading) return <div className={styles.loading}>Loading Advisory...</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <div className={styles.breadcrumbs}>Threat Advisories / {id}</div>
                    <h1 className={styles.pageTitle}>Threat Advisories</h1>
                    <p className={styles.subtitle} style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Analyst-curated intelligence requiring attention</p>
                </div>
                <div className={styles.actions}>
                    <button className={styles.secondaryButton} onClick={handlePreview}>
                        Preview
                    </button>
                    <button className={styles.saveButton} onClick={() => handleSave(true)} disabled={saving}>
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button className={styles.finalizeButton} onClick={() => handleSave(false)}>
                        <CheckCircle size={18} />
                        Publish Advisory
                    </button>
                </div>
            </header>

            {/* Progress Bar */}
            <div className={styles.progressContainer}>
                <div className={styles.progressLabel}>
                    <span>Advisory Completion</span>
                    <span className={styles.percentage}>
                        {Math.round((
                            (advisory.title ? 1 : 0) +
                            (advisory.overview ? 1 : 0) +
                            (advisory.technicalDetails ? 1 : 0) +
                            (advisory.attackVector ? 1 : 0) +
                            (advisory.affectedAssets.length > 0 ? 1 : 0) +
                            (advisory.recommendations.length > 0 ? 1 : 0)
                        ) / 6 * 100)}%
                    </span>
                </div>
                <div className={styles.progressBarBg}>
                    <div
                        className={styles.progressBarFill}
                        style={{
                            width: `${(
                                (advisory.title ? 1 : 0) +
                                (advisory.overview ? 1 : 0) +
                                (advisory.technicalDetails ? 1 : 0) +
                                (advisory.attackVector ? 1 : 0) +
                                (advisory.affectedAssets.length > 0 ? 1 : 0) +
                                (advisory.recommendations.length > 0 ? 1 : 0)
                            ) / 6 * 100}%`
                        }}
                    ></div>
                </div>
            </div>

            <div className={styles.form}>
                <div className={styles.section}>
                    <label className={styles.label}>Advisory Title *</label>
                    <input
                        className={styles.input}
                        value={advisory.title}
                        onChange={e => handleChange('title', e.target.value)}
                        placeholder="e.g. Ransomware Campaign Targeting Finance"
                    />
                </div>

                <div className={styles.section}>
                    <label className={styles.label}>Executive Summary</label>
                    <textarea
                        className={styles.textarea}
                        rows={3}
                        value={advisory.overview}
                        onChange={e => handleChange('overview', e.target.value)}
                        placeholder="Brief executive summary..."
                    />
                </div>

                <div className={styles.section}>
                    <label className={styles.label}>Technical Analysis *</label>
                    <textarea
                        className={styles.textarea}
                        rows={6}
                        value={advisory.technicalDetails}
                        onChange={e => handleChange('technicalDetails', e.target.value)}
                        placeholder="Detailed technical analysis..."
                    />
                    <div className={styles.hint}>Markdown Supported</div>
                </div>

                <div className={styles.row}>
                    <div className={styles.section} style={{ flex: 1 }}>
                        <label className={styles.label}>Severity Level *</label>
                        <Select
                            value={advisory.severity}
                            onChange={e => handleChange('severity', e.target.value)}
                            options={['Low', 'Medium', 'High', 'Critical'].map(o => ({ value: o, label: o }))}
                        />
                    </div>

                    <div className={styles.section} style={{ flex: 2 }}>
                        <label className={styles.label}>Attack Vector</label>
                        <input
                            className={styles.input}
                            value={advisory.attackVector}
                            onChange={e => handleChange('attackVector', e.target.value)}
                            placeholder="e.g. Phishing, Exploit"
                        />
                    </div>
                </div>

                <div className={styles.section}>
                    <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Detailed Threat Chain</h3>
                    {/* Granular Fields */}
                    <div className={styles.grid2} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label className={styles.label}>Delivery Mechanism</label>
                            <input className={styles.input} value={advisory.deliveryMechanism} onChange={e => handleChange('deliveryMechanism', e.target.value)} placeholder="e.g. Email Attachment" />
                        </div>
                        <div>
                            <label className={styles.label}>Initial Access</label>
                            <input className={styles.input} value={advisory.initialAccess} onChange={e => handleChange('initialAccess', e.target.value)} placeholder="e.g. Valid Accounts" />
                        </div>
                    </div>
                    <div className={styles.grid2} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label className={styles.label}>Persistence</label>
                            <input className={styles.input} value={advisory.persistence} onChange={e => handleChange('persistence', e.target.value)} placeholder="e.g. Scheduled Task" />
                        </div>
                        <div>
                            <label className={styles.label}>Defense Evasion</label>
                            <input className={styles.input} value={advisory.defenseEvasion} onChange={e => handleChange('defenseEvasion', e.target.value)} placeholder="e.g. Masquerading" />
                        </div>
                    </div>
                    <div className={styles.grid2} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label className={styles.label}>Command & Control</label>
                            <input className={styles.input} value={advisory.commandAndControl} onChange={e => handleChange('commandAndControl', e.target.value)} placeholder="e.g. Web Service" />
                        </div>
                        <div>
                            <label className={styles.label}>Exfiltration</label>
                            <input className={styles.input} value={advisory.exfiltration} onChange={e => handleChange('exfiltration', e.target.value)} placeholder="e.g. Exfiltration Over C2 Channel" />
                        </div>
                    </div>
                </div>

                {/* Dynamic Arrays: Affected Assets */}
                <div className={styles.section}>
                    <label className={styles.label}>Affected Assets</label>
                    {advisory.affectedAssets.map((asset, i) => (
                        <div key={i} className={styles.arrayItem}>
                            <input
                                className={styles.input}
                                value={asset}
                                onChange={e => handleArrayChange('affectedAssets', i, e.target.value)}
                            />
                            <button className={styles.removeButton} onClick={() => removeArrayItem('affectedAssets', i)}>×</button>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => addArrayItem('affectedAssets')}>+ Add Asset</button>
                </div>

                {/* Dynamic Arrays: Recommendations */}
                <div className={styles.section}>
                    <label className={styles.label}>Recommendations *</label>
                    {advisory.recommendations.map((rec, i) => (
                        <div key={i} className={styles.arrayItem}>
                            <input
                                className={styles.input}
                                value={rec}
                                onChange={e => handleArrayChange('recommendations', i, e.target.value)}
                            />
                            <button className={styles.removeButton} onClick={() => removeArrayItem('recommendations', i)}>×</button>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => addArrayItem('recommendations')}>+ Add Recommendation</button>
                </div>

                {/* Dynamic Arrays: References */}
                <div className={styles.section}>
                    <label className={styles.label}>References</label>
                    {advisory.references.length > 0 ? advisory.references.map((ref, i) => (
                        <div key={i} className={styles.arrayItem}>
                            <input
                                className={styles.input}
                                value={ref}
                                onChange={e => handleArrayChange('references', i, e.target.value)}
                                placeholder="http://..."
                            />
                            <button className={styles.removeButton} onClick={() => removeArrayItem('references', i)}>×</button>
                        </div>
                    )) : null}
                    <button className={styles.addButton} onClick={() => addArrayItem('references')}>+ Add Reference</button>
                </div>

                {/* Dynamic Arrays: IOC List */}
                <div className={styles.section}>
                    <label className={styles.label}>Indicators of Compromise (IOCs)</label>
                    {advisory.iocs.length > 0 ? advisory.iocs.map((ioc, i) => (
                        <div key={i} className={styles.arrayItem}>
                            <input
                                className={styles.input}
                                value={ioc}
                                onChange={e => handleArrayChange('iocs', i, e.target.value)}
                                placeholder="IP, Hash, Domain..."
                            />
                            <button className={styles.removeButton} onClick={() => removeArrayItem('iocs', i)}>×</button>
                        </div>
                    )) : null}
                    <button className={styles.addButton} onClick={() => addArrayItem('iocs')}>+ Add IOC</button>
                </div>

                <div className={styles.section}>
                    <label className={styles.label}>Confidence Statement</label>
                    <textarea
                        className={styles.textarea}
                        rows={3}
                        value={advisory.confidenceStatement}
                        onChange={e => handleChange('confidenceStatement', e.target.value)}
                        placeholder="Statement of analytical confidence..."
                    />
                </div>

            </div>
        </div>
    );
};

export default AdvisoryBuilder;
