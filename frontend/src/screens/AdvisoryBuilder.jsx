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
        threat_description: '',
        affected_assets: [],
        attack_vector: '',
        severity: 'Medium',
        recommendations: [],
        references: [],
        ioc_list: [],
        confidence_statement: '',
        status: 'draft'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // If we have an ID, fetch the advisory (or the topic if promoting)
        // The previous view navigates to /advisories/:id.
        // If it's a new promotion, the backend already created a Draft Advisory with this ID.
        // So we just fetch by ID.
        fetchAdvisory();
    }, [id]);

    const fetchAdvisory = async () => {
        try {
            // Need an endpoint to get single advisory. The list endpoint returns all.
            // Assuming /api/advisories/:id or filter.
            // For now, let's filter from the list or add single-get endpoint later.
            // For MVP, filter from list is safer if backend doesn't support get-by-id yet.
            const response = await fetch('/api/advisories');
            const data = await response.json();
            const found = data.find(a => a.id === id);
            if (found) {
                setAdvisory({
                    ...found,
                    recommendations: found.recommendations || [], // Ensure array
                    affected_assets: found.affected_assets || [],
                    references: found.references || [],
                    ioc_list: found.ioc_list || [],
                    confidence_statement: found.confidence_statement || ''
                });
            }
        } catch (err) {
            console.error("Failed to load advisory", err);
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
            await fetch('/api/advisories/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(advisory)
            });
            // Feedback?
            toast.success('Advisory draft saved');
        } catch (err) {
            toast.error('Failed to save draft');
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

    const processApproval = async () => {
        setSaving(true);
        try {
            await fetch('/api/advisories/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...advisory, status: 'approved' })
            });
            toast.success('Advisory Approved');
            navigate('/advisories');
        } catch (err) {
            toast.error('Failed to approve');
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
                    <button className={styles.saveButton} onClick={saveDraft} disabled={saving}>
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button className={styles.approveButton} onClick={approveAdvisory}>
                        <CheckCircle size={18} />
                        Approve Advisory
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
                            (advisory.threat_description ? 1 : 0) +
                            (advisory.attack_vector ? 1 : 0) +
                            (advisory.affected_assets.length > 0 ? 1 : 0) +
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
                                (advisory.threat_description ? 1 : 0) +
                                (advisory.attack_vector ? 1 : 0) +
                                (advisory.affected_assets.length > 0 ? 1 : 0) +
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
                    <label className={styles.label}>Overview</label>
                    <textarea
                        className={styles.textarea}
                        rows={3}
                        value={advisory.overview}
                        onChange={e => handleChange('overview', e.target.value)}
                        placeholder="Brief executive summary..."
                    />
                </div>

                <div className={styles.section}>
                    <label className={styles.label}>Threat Description *</label>
                    <textarea
                        className={styles.textarea}
                        rows={6}
                        value={advisory.threat_description}
                        onChange={e => handleChange('threat_description', e.target.value)}
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
                            value={advisory.attack_vector}
                            onChange={e => handleChange('attack_vector', e.target.value)}
                            placeholder="e.g. Phishing, Exploit"
                        />
                    </div>
                </div>

                {/* Dynamic Arrays: Affected Assets */}
                <div className={styles.section}>
                    <label className={styles.label}>Affected Assets</label>
                    {advisory.affected_assets.map((asset, i) => (
                        <div key={i} className={styles.arrayItem}>
                            <input
                                className={styles.input}
                                value={asset}
                                onChange={e => handleArrayChange('affected_assets', i, e.target.value)}
                            />
                            <button className={styles.removeButton} onClick={() => removeArrayItem('affected_assets', i)}>×</button>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => addArrayItem('affected_assets')}>+ Add Asset</button>
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
                    {advisory.ioc_list.length > 0 ? advisory.ioc_list.map((ioc, i) => (
                        <div key={i} className={styles.arrayItem}>
                            <input
                                className={styles.input}
                                value={ioc}
                                onChange={e => handleArrayChange('ioc_list', i, e.target.value)}
                                placeholder="IP, Hash, Domain..."
                            />
                            <button className={styles.removeButton} onClick={() => removeArrayItem('ioc_list', i)}>×</button>
                        </div>
                    )) : null}
                    <button className={styles.addButton} onClick={() => addArrayItem('ioc_list')}>+ Add IOC</button>
                </div>

                <div className={styles.section}>
                    <label className={styles.label}>Confidence Statement</label>
                    <textarea
                        className={styles.textarea}
                        rows={3}
                        value={advisory.confidence_statement}
                        onChange={e => handleChange('confidence_statement', e.target.value)}
                        placeholder="Statement of analytical confidence..."
                    />
                </div>

            </div>
        </div>
    );
};

export default AdvisoryBuilder;
