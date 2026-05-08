import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from '../components/common/Select';
import ReportModal from '../components/intelligence/ReportModal';
import AdvisoryMetaModal from '../components/intelligence/AdvisoryMetaModal';
import { useAuth } from '../context/AuthContext';
import styles from './AdvisoryBuilder.module.css';

const AdvisoryBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token, user } = useAuth();
    
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [metaModalOpen, setMetaModalOpen] = useState(false);
    const [generating, setGenerating] = useState(false);

    const [advisory, setAdvisory] = useState({
        _schema: "GTBank Threat Advisory Report Template v1.0",
        metadata: {
            title: '',
            date: new Date().toISOString().split('T')[0],
            prepared_by: user?.email || '',
            reviewed_by: '',
            organization_unit: "Security Monitoring and Threat Intelligence",
            tlp: "RED",
            classification: "CONFIDENTIAL"
        },
        executive_summary: {
            body: ''
        },
        threat_analysis: {
            intro: '',
            attack_chain: [],
            permissions_abuse: [],
            mitre_attack: []
        },
        iocs: {
            entries: []
        },
        detection_methods: {
            entries: []
        },
        assessment: {
            intro: "Use the checklist below to personally evaluate the organisation's exposure to this threat.",
            questions: [
                { id: 1, category: "Exposure", question: "Do we have assets matching the affected profile?" },
                { id: 2, category: "Detection", question: "Are we monitoring for the identified IOCs?" },
                { id: 3, category: "Blast Radius", question: "What is the potential impact if compromised?" }
            ],
            risk_rating: { selected: 'Medium' },
            assessment_notes: ''
        },
        remediation: {
            entries: []
        },
        references: {
            entries: []
        }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchAdvisory = useCallback(async () => {
        if (id === 'new') {
            setLoading(false);
            return;
        }
        try {
            // First try loading as a published advisory
            let response = await fetch(`/api/advisories/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            let data;
            if (response.ok) {
                data = await response.json();
            } else if (response.status === 404) {
                // If not found, try loading as a draft
                const draftResponse = await fetch(`/api/advisories/draft/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!draftResponse.ok) throw new Error('Advisory or Draft not found');
                data = await draftResponse.json();
            } else {
                throw new Error('Failed to fetch advisory');
            }

            // If it has contentJson, it's likely a draft or a published record with the new structure
            if (data.contentJson) {
                try {
                    const parsed = JSON.parse(data.contentJson);
                    if (parsed._schema === "GTBank Threat Advisory Report Template v1.0") {
                        setAdvisory(parsed);
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.error("Failed to parse contentJson", e);
                }
            }

            // Fallback: Map from backend entity (likely flat) to the new nested structure
            setAdvisory(prev => ({
                ...prev,
                metadata: {
                    ...prev.metadata,
                    title: data.title || '',
                },
                executive_summary: {
                    body: data.executiveSummary || '',
                },
                threat_analysis: {
                    ...prev.threat_analysis,
                    intro: data.technicalDetails || '',
                    attack_chain: [
                        { step: 1, label: "Initial Access", description: data.initialAccess || '' },
                        { step: 2, label: "Delivery", description: data.deliveryMechanism || '' },
                        { step: 3, label: "Persistence", description: data.persistence || '' },
                        { step: 4, label: "Defense Evasion", description: data.defenseEvasion || '' },
                        { step: 5, label: "Command & Control", description: data.commandAndControl || '' },
                        { step: 6, label: "Exfiltration", description: data.exfiltration || '' }
                    ]
                },
                iocs: {
                    entries: (data.iocs || []).map(ioc => ({ type: 'Network', indicator: ioc, description: 'Observed IOC', defanged: true }))
                },
                assessment: {
                    ...prev.assessment,
                    risk_rating: { selected: data.severity === 0 ? 'Low' : data.severity === 1 ? 'Medium' : data.severity === 2 ? 'High' : 'Critical' }
                },
                remediation: {
                    entries: (data.recommendations || []).map(rec => ({ label: 'Immediate Action', description: rec }))
                },
                references: {
                    entries: (data.references || []).map((ref, i) => ({ id: i + 1, title: 'Reference', url: ref }))
                }
            }));
        } catch (error) {
            console.error("Failed to load advisory", error);
            toast.error('Failed to load advisory details');
        } finally {
            setLoading(false);
        }
    }, [id, token]);

    useEffect(() => {
        fetchAdvisory();
    }, [fetchAdvisory]);

    const handleChange = (path, value) => {
        setAdvisory(prev => {
            const keys = path.split('.');
            if (keys.length === 1) {
                return { ...prev, [keys[0]]: value };
            }
            
            const newState = { ...prev };
            let current = newState;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = { ...current[keys[i]] };
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return newState;
        });
    };

    const handleArrayChange = (path, index, field, value) => {
        setAdvisory(prev => {
            const keys = path.split('.');
            const newState = { ...prev };
            let current = newState;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = { ...current[keys[i]] };
                current = current[keys[i]];
            }
            
            const arrayKey = keys[keys.length - 1];
            const newArray = [...current[arrayKey]];
            if (field === null) {
                newArray[index] = value;
            } else {
                newArray[index] = { ...newArray[index], [field]: value };
            }
            current[arrayKey] = newArray;
            return newState;
        });
    };

    const addArrayItem = (path, defaultValue = '') => {
        setAdvisory(prev => {
            const keys = path.split('.');
            const newState = { ...prev };
            let current = newState;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = { ...current[keys[i]] };
                current = current[keys[i]];
            }
            
            const arrayKey = keys[keys.length - 1];
            current[arrayKey] = [...current[arrayKey], defaultValue];
            return newState;
        });
    };

    const removeArrayItem = (path, index) => {
        setAdvisory(prev => {
            const keys = path.split('.');
            const newState = { ...prev };
            let current = newState;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = { ...current[keys[i]] };
                current = current[keys[i]];
            }
            
            const arrayKey = keys[keys.length - 1];
            current[arrayKey] = current[arrayKey].filter((_, i) => i !== index);
            return newState;
        });
    };

    const processApproval = async () => {
        await handleSave(false);
    };

    const approveAdvisory = () => {
        toast((t) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span>Are you sure? Approved advisories are immutable.</span>
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
            
            let payload;
            if (isDraft) {
                payload = {
                    contentJson: JSON.stringify(advisory), // Saving entire nested state
                    authorId: user?.id || 'current-user'
                };
                if (id !== 'new') {
                    payload.id = id;
                }
            } else {
                // For full update, map nested state to flat entity fields to prevent data loss
                const severityMap = { 'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3 };
                payload = {
                    id: id === 'new' ? null : id,
                    title: advisory.metadata.title,
                    classification: `TLP:${advisory.metadata.tlp}`,
                    executiveSummary: advisory.executive_summary.body,
                    technicalDetails: advisory.threat_analysis.intro,
                    confidenceStatement: advisory.assessment.assessment_notes,
                    severity: severityMap[advisory.assessment.risk_rating.selected] || 1,
                    iocs: advisory.iocs.entries.map(e => e.indicator),
                    recommendations: advisory.remediation.entries.map(e => e.description),
                    references: advisory.references.entries.map(e => e.url),
                    // Kill chain mapping
                    initialAccess: advisory.threat_analysis.attack_chain.find(s => s.label.toLowerCase().includes('initial'))?.description || '',
                    deliveryMechanism: advisory.threat_analysis.attack_chain.find(s => s.label.toLowerCase().includes('delivery'))?.description || '',
                    persistence: advisory.threat_analysis.attack_chain.find(s => s.label.toLowerCase().includes('persistence'))?.description || '',
                    defenseEvasion: advisory.threat_analysis.attack_chain.find(s => s.label.toLowerCase().includes('defense'))?.description || '',
                    commandAndControl: advisory.threat_analysis.attack_chain.find(s => s.label.toLowerCase().includes('control'))?.description || '',
                    exfiltration: advisory.threat_analysis.attack_chain.find(s => s.label.toLowerCase().includes('exfiltrat'))?.description || '',
                    contentJson: JSON.stringify(advisory),
                    status: 1 // Approved
                };

                // Remove null id to avoid deserialization error for new records
                if (id === 'new') delete payload.id;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to save (${response.status})`);
            }

            const data = await response.json();
            toast.success(isDraft ? 'Draft saved' : 'Advisory published');

            if (isDraft && id === 'new' && data.id) {
                navigate(`/advisories/${data.id}`, { replace: true });
            } else if (!isDraft) {
                // If published successfully, maybe navigate to list or show success
                navigate('/advisories', { replace: true });
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        try {
            // Map nested state to legacy preview model if needed
            const payload = {
                Title: advisory.metadata.title,
                ExecutiveSummary: advisory.executive_summary.body,
                TechnicalDetails: advisory.threat_analysis.intro,
                Severity: advisory.assessment.risk_rating.selected === 'Low' ? 0 : advisory.assessment.risk_rating.selected === 'Medium' ? 1 : advisory.assessment.risk_rating.selected === 'High' ? 2 : 3,
                IOCs: advisory.iocs.entries.map(e => e.indicator),
                Recommendations: advisory.remediation.entries.map(e => e.description),
                References: advisory.references.entries.map(e => e.url)
            };

            const response = await fetch('/api/advisories/preview', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
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

    const handleGenerateClick = () => {
        setReportModalOpen(true);
    };

    const handleTypeSelect = (type) => {
        setReportModalOpen(false);
        if (type === 'advisory') {
            setMetaModalOpen(true);
        } else {
            // Handle raw export
            handleRawExport();
        }
    };

    const handleMetaConfirm = async (meta) => {
        setMetaModalOpen(false);
        setGenerating(true);
        const toastId = toast.loading('Generating GTBank Advisory...');
        
        try {
            // Update state with meta from modal
            const finalAdvisory = {
                ...advisory,
                metadata: {
                    ...advisory.metadata,
                    date: meta.date,
                    prepared_by: meta.preparedBy,
                    reviewed_by: meta.reviewedBy
                }
            };

            const response = await fetch('/api/reports/advisory', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(finalAdvisory)
            });

            if (!response.ok) throw new Error('Generation failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `GTBank_Advisory_${advisory.metadata.title.replace(/\s+/g, '_')}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            
            toast.success('Advisory generated successfully', { id: toastId });
        } catch {
            toast.error('Failed to generate advisory', { id: toastId });
        } finally {
            setGenerating(false);
        }
    };

    const handleRawExport = async () => {
        // ... (can use existing /api/reports/create logic)
        toast.info('Raw export initiated');
    };

    if (loading) return <div className={styles.loading}>Loading Advisory...</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <div className={styles.breadcrumbs}>Threat Advisories / {id}</div>
                    <h1 className={styles.pageTitle}>Threat Advisories</h1>
                    <p className={styles.subtitle} style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>GTBank Threat Advisory Report Template v1.0</p>
                </div>
                <div className={styles.actions}>
                    <button className={styles.secondaryButton} onClick={handlePreview}>
                        Preview
                    </button>
                    <button className={styles.generateButton} onClick={handleGenerateClick} disabled={generating}>
                        {generating ? 'Generating...' : 'Generate Report'}
                    </button>
                    <button className={styles.saveButton} onClick={() => handleSave(true)} disabled={saving}>
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button className={styles.finalizeButton} onClick={approveAdvisory}>
                        <CheckCircle size={18} />
                        Publish Advisory
                    </button>
                </div>
            </header>

            <ReportModal 
                isOpen={reportModalOpen} 
                onClose={() => setReportModalOpen(false)} 
                onSelect={handleTypeSelect} 
            />

            <AdvisoryMetaModal 
                isOpen={metaModalOpen} 
                onClose={() => setMetaModalOpen(false)} 
                onConfirm={handleMetaConfirm}
                initialData={{ preparedBy: user?.email, title: advisory.metadata.title }}
            />

            {/* Progress Bar */}
            <div className={styles.progressContainer}>
                <div className={styles.progressLabel}>
                    <span>Advisory Completion</span>
                    <span className={styles.percentage}>
                        {Math.round((
                            (advisory.metadata.title ? 1 : 0) +
                            (advisory.executive_summary.body ? 1 : 0) +
                            (advisory.threat_analysis.intro ? 1 : 0) +
                            (advisory.iocs.entries.length > 0 ? 1 : 0) +
                            (advisory.remediation.entries.length > 0 ? 1 : 0)
                        ) / 5 * 100)}%
                    </span>
                </div>
                <div className={styles.progressBarBg}>
                    <div
                        className={styles.progressBarFill}
                        style={{
                            width: `${(
                                (advisory.metadata.title ? 1 : 0) +
                                (advisory.executive_summary.body ? 1 : 0) +
                                (advisory.threat_analysis.intro ? 1 : 0) +
                                (advisory.iocs.entries.length > 0 ? 1 : 0) +
                                (advisory.remediation.entries.length > 0 ? 1 : 0)
                            ) / 5 * 100}%`
                        }}
                    ></div>
                </div>
            </div>

            <div className={styles.form}>
                {/* METADATA SECTION */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Metadata & Classification</h3>
                    <div className={styles.row}>
                        <div style={{ flex: 2 }}>
                            <label className={styles.label}>Advisory Title *</label>
                            <input
                                className={styles.input}
                                value={advisory.metadata.title}
                                onChange={e => handleChange('metadata.title', e.target.value)}
                                placeholder="e.g. Ransomware Campaign Targeting Finance"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className={styles.label}>TLP Level</label>
                            <Select
                                value={advisory.metadata.tlp}
                                onChange={e => handleChange('metadata.tlp', e.target.value)}
                                options={['WHITE', 'GREEN', 'AMBER', 'RED'].map(o => ({ value: o, label: o }))}
                            />
                        </div>
                    </div>
                </div>

                {/* EXECUTIVE SUMMARY */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 1: Executive Summary</h3>
                    <textarea
                        className={styles.textarea}
                        rows={4}
                        value={advisory.executive_summary.body}
                        onChange={e => handleChange('executive_summary.body', e.target.value)}
                        placeholder="Provide a high-level summary of the threat..."
                    />
                </div>

                {/* THREAT ANALYSIS */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 2: Threat Analysis</h3>
                    <label className={styles.label}>Technical Introduction</label>
                    <textarea
                        className={styles.textarea}
                        rows={4}
                        value={advisory.threat_analysis.intro}
                        onChange={e => handleChange('threat_analysis.intro', e.target.value)}
                        placeholder="Detailed technical analysis intro..."
                    />
                    
                    <div style={{ marginTop: '1rem' }}>
                        <label className={styles.label}>Attack Chain Steps</label>
                        {advisory.threat_analysis.attack_chain.map((step, i) => (
                            <div key={i} className={styles.arrayItem} style={{ marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                                <div style={{ width: '40px' }}>
                                    <input className={styles.input} type="number" value={step.step} onChange={e => handleArrayChange('threat_analysis.attack_chain', i, 'step', parseInt(e.target.value))} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <input className={styles.input} value={step.label} onChange={e => handleArrayChange('threat_analysis.attack_chain', i, 'label', e.target.value)} placeholder="Label (e.g. Initial Access)" />
                                </div>
                                <div style={{ flex: 2 }}>
                                    <input className={styles.input} value={step.description} onChange={e => handleArrayChange('threat_analysis.attack_chain', i, 'description', e.target.value)} placeholder="Description..." />
                                </div>
                                <button className={styles.removeButton} onClick={() => removeArrayItem('threat_analysis.attack_chain', i)}>×</button>
                            </div>
                        ))}
                        <button className={styles.addButton} onClick={() => addArrayItem('threat_analysis.attack_chain', { step: advisory.threat_analysis.attack_chain.length + 1, label: '', description: '' })}>+ Add Step</button>
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                        <label className={styles.label}>MITRE ATT&CK Mapping</label>
                        {advisory.threat_analysis.mitre_attack.map((mapping, i) => (
                            <div key={i} className={styles.arrayItem} style={{ marginBottom: '0.5rem' }}>
                                <div style={{ width: '100px' }}>
                                    <input className={styles.input} value={mapping.technique_id} onChange={e => handleArrayChange('threat_analysis.mitre_attack', i, 'technique_id', e.target.value)} placeholder="T1234" />
                                </div>
                                <div style={{ width: '150px' }}>
                                    <input className={styles.input} value={mapping.tactic} onChange={e => handleArrayChange('threat_analysis.mitre_attack', i, 'tactic', e.target.value)} placeholder="Tactic" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <input className={styles.input} value={mapping.description} onChange={e => handleArrayChange('threat_analysis.mitre_attack', i, 'description', e.target.value)} placeholder="Description" />
                                </div>
                                <button className={styles.removeButton} onClick={() => removeArrayItem('threat_analysis.mitre_attack', i)}>×</button>
                            </div>
                        ))}
                        <button className={styles.addButton} onClick={() => addArrayItem('threat_analysis.mitre_attack', { technique_id: '', tactic: '', description: '' })}>+ Add Mapping</button>
                    </div>
                </div>

                {/* IOCs */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 3: Indicators of Compromise</h3>
                    {advisory.iocs.entries.map((ioc, i) => (
                        <div key={i} className={styles.arrayItem} style={{ marginBottom: '0.5rem' }}>
                            <div style={{ width: '120px' }}>
                                <Select
                                    value={ioc.type}
                                    onChange={e => handleArrayChange('iocs.entries', i, 'type', e.target.value)}
                                    options={['Network', 'File', 'Email', 'Host'].map(o => ({ value: o, label: o }))}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <input className={styles.input} value={ioc.indicator} onChange={e => handleArrayChange('iocs.entries', i, 'indicator', e.target.value)} placeholder="Indicator..." />
                            </div>
                            <div style={{ flex: 1 }}>
                                <input className={styles.input} value={ioc.description} onChange={e => handleArrayChange('iocs.entries', i, 'description', e.target.value)} placeholder="Description" />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                                <input type="checkbox" checked={ioc.defanged} onChange={e => handleArrayChange('iocs.entries', i, 'defanged', e.target.checked)} />
                                Defanged
                            </div>
                            <button className={styles.removeButton} onClick={() => removeArrayItem('iocs.entries', i)}>×</button>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => addArrayItem('iocs.entries', { type: 'Network', indicator: '', description: '', defanged: true })}>+ Add IOC</button>
                </div>

                {/* DETECTION METHODS */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 4: Detection Methods</h3>
                    {advisory.detection_methods.entries.map((entry, i) => (
                        <div key={i} style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', position: 'relative' }}>
                            <button className={styles.removeButton} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }} onClick={() => removeArrayItem('detection_methods.entries', i)}>×</button>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label className={styles.label}>Heading</label>
                                <input className={styles.input} value={entry.sub_heading} onChange={e => handleArrayChange('detection_methods.entries', i, 'sub_heading', e.target.value)} placeholder="e.g. SIEM Query" />
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label className={styles.label}>Logic Description</label>
                                <textarea className={styles.textarea} rows={2} value={entry.body} onChange={e => handleArrayChange('detection_methods.entries', i, 'body', e.target.value)} />
                            </div>
                            <div>
                                <label className={styles.label}>Commands / Queries (one per line)</label>
                                <textarea 
                                    className={styles.textarea} 
                                    rows={3} 
                                    value={entry.commands.join('\n')} 
                                    onChange={e => handleArrayChange('detection_methods.entries', i, 'commands', e.target.value.split('\n'))}
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => addArrayItem('detection_methods.entries', { sub_heading: '', body: '', commands: [], command_language: 'kql' })}>+ Add Detection Method</button>
                </div>

                {/* ASSESSMENT */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 5: Assessment & Risk Rating</h3>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className={styles.label}>Risk Rating</label>
                        <Select
                            value={advisory.assessment.risk_rating.selected}
                            onChange={e => handleChange('assessment.risk_rating.selected', e.target.value)}
                            options={['Low', 'Medium', 'High', 'Critical'].map(o => ({ value: o, label: o }))}
                        />
                    </div>
                    <div>
                        <label className={styles.label}>Assessment Notes</label>
                        <textarea
                            className={styles.textarea}
                            rows={3}
                            value={advisory.assessment.assessment_notes}
                            onChange={e => handleChange('assessment.assessment_notes', e.target.value)}
                            placeholder="Additional assessment notes..."
                        />
                    </div>
                </div>

                {/* REMEDIATION */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 6: Remediation Actions</h3>
                    {advisory.remediation.entries.map((entry, i) => (
                        <div key={i} className={styles.arrayItem} style={{ marginBottom: '0.5rem' }}>
                            <div style={{ width: '150px' }}>
                                <input className={styles.input} value={entry.label} onChange={e => handleArrayChange('remediation.entries', i, 'label', e.target.value)} placeholder="Action Type" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <input className={styles.input} value={entry.description} onChange={e => handleArrayChange('remediation.entries', i, 'description', e.target.value)} placeholder="Description..." />
                            </div>
                            <button className={styles.removeButton} onClick={() => removeArrayItem('remediation.entries', i)}>×</button>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => addArrayItem('remediation.entries', { label: 'Immediate Action', description: '' })}>+ Add Action</button>
                </div>

                {/* REFERENCES */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 7: References</h3>
                    {advisory.references.entries.map((ref, i) => (
                        <div key={i} className={styles.arrayItem} style={{ marginBottom: '0.5rem' }}>
                            <div style={{ width: '40px' }}>
                                <input className={styles.input} type="number" value={ref.id} readOnly />
                            </div>
                            <div style={{ flex: 1 }}>
                                <input className={styles.input} value={ref.title} onChange={e => handleArrayChange('references.entries', i, 'title', e.target.value)} placeholder="Source Title" />
                            </div>
                            <div style={{ flex: 2 }}>
                                <input className={styles.input} value={ref.url} onChange={e => handleArrayChange('references.entries', i, 'url', e.target.value)} placeholder="URL" />
                            </div>
                            <button className={styles.removeButton} onClick={() => removeArrayItem('references.entries', i)}>×</button>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => addArrayItem('references.entries', { id: advisory.references.entries.length + 1, title: '', url: '' })}>+ Add Reference</button>
                </div>

            </div>
        </div>
    );
};

export default AdvisoryBuilder;
