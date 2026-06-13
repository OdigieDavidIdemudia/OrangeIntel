import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, CheckCircle, Clock, Shield, Sparkles } from 'lucide-react';
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
            intro: "Evaluate organization exposure to this threat using the criteria below.",
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
            let res;
            try {
                res = await axios.get(`/api/advisories/${id}`);
            } catch (err) {
                if (err.response?.status === 404) {
                    res = await axios.get(`/api/advisories/draft/${id}`);
                } else {
                    throw err;
                }
            }

            const data = res.data;

            if (data.contentJson) {
                try {
                    const parsed = JSON.parse(data.contentJson);
                    if (parsed._schema === "GTBank Threat Advisory Report Template v1.0") {
                        setAdvisory(parsed);
                        setLoading(false);
                        return;
                    }
                } catch (e) { console.error("Failed to parse contentJson", e); }
            }

            // Fallback mapping
            setAdvisory(prev => ({
                ...prev,
                metadata: { ...prev.metadata, title: data.title || '' },
                executive_summary: { body: data.executiveSummary || '' },
                threat_analysis: { ...prev.threat_analysis, intro: data.technicalDetails || '' },
                iocs: { entries: (data.iocs || []).map(ioc => ({ type: 'Network', indicator: ioc, description: 'Observed IOC', defanged: true })) },
                assessment: { ...prev.assessment, risk_rating: { selected: data.severity === 0 ? 'Low' : data.severity === 1 ? 'Medium' : data.severity === 2 ? 'High' : 'Critical' } }
            }));
        } catch (error) {
            toast.error('Failed to load advisory details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchAdvisory();
    }, [fetchAdvisory]);

    const handleChange = (path, value) => {
        setAdvisory(prev => {
            const keys = path.split('.');
            if (keys.length === 1) return { ...prev, [keys[0]]: value };
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
            newArray[index] = field === null ? value : { ...newArray[index], [field]: value };
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

    const handleSave = async (isDraft = false) => {
        setSaving(true);
        try {
            const endpoint = isDraft ? '/api/advisories/draft' : '/api/advisories/update';
            const severityMap = { 'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3 };
            const payload = {
                id: id === 'new' ? null : id,
                title: advisory.metadata.title,
                classification: `TLP:${advisory.metadata.tlp}`,
                contentJson: JSON.stringify(advisory),
                status: isDraft ? 0 : 1
            };
            if (!isDraft) {
                payload.executiveSummary = advisory.executive_summary.body;
                payload.severity = severityMap[advisory.assessment.risk_rating.selected] || 1;
            }
            if (id === 'new') delete payload.id;

            const response = await axios.post(endpoint, payload);
            toast.success(isDraft ? 'Draft saved' : 'Advisory published');
            if (isDraft && id === 'new' && response.data.id) navigate(`/advisories/${response.data.id}`, { replace: true });
            else if (!isDraft) navigate('/advisories', { replace: true });
        } catch (e) { toast.error(e.message); }
        finally { setSaving(false); }
    };

    const handlePreview = async () => {
        try {
            // Map the frontend advisory to the format expected by the backend preview
            // Note: The backend expects a flat Advisory entity, but the frontend uses a nested template.
            // We should send a minimal version or the full one if the backend handles it.
            // Based on AdvisoriesController, it expects an Advisory entity.
            
            const payload = {
                title: advisory.metadata.title,
                executiveSummary: advisory.executive_summary.body,
                technicalDetails: advisory.threat_analysis.intro,
                severity: advisory.assessment.risk_rating.selected === 'Low' ? 0 : advisory.assessment.risk_rating.selected === 'Medium' ? 1 : advisory.assessment.risk_rating.selected === 'High' ? 2 : 3,
                attackVector: advisory.threat_analysis.attack_chain[0]?.label || ''
            };

            const res = await axios.post('/api/advisories/preview', payload, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            window.open(url, '_blank');
        } catch (error) {
            toast.error("Preview failed");
        }
    };

    const handleSmartFill = () => {
        const sourceText = `${advisory.executive_summary.body} ${advisory.threat_analysis.intro}`;
        if (!sourceText.trim()) return toast.error("Please provide some summary or analysis text first.");

        const iocList = [];
        const remediationList = [];

        // 1. Extract IOCs using Regex
        const ipv4Regex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
        const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
        const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        const sha256Regex = /\b[a-f0-9]{64}\b/gi;
        const md5Regex = /\b[a-f0-9]{32}\b/gi;
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const cveRegex = /\bCVE-\d{4}-\d{4,}\b/gi;

        const ips = [...new Set(sourceText.match(ipv4Regex) || [])];
        const domains = [...new Set(sourceText.match(domainRegex) || [])];
        const urls = [...new Set(sourceText.match(urlRegex) || [])];
        const sha256s = [...new Set(sourceText.match(sha256Regex) || [])];
        const md5s = [...new Set(sourceText.match(md5Regex) || [])];
        const emails = [...new Set(sourceText.match(emailRegex) || [])];
        const cves = [...new Set(sourceText.match(cveRegex) || [])];

        ips.forEach(ip => iocList.push({ type: 'Network', indicator: ip, description: 'Observed IP', defanged: true }));
        domains.forEach(d => iocList.push({ type: 'Network', indicator: d, description: 'Observed Domain', defanged: true }));
        urls.forEach(u => iocList.push({ type: 'Network', indicator: u, description: 'Observed URL', defanged: true }));
        sha256s.forEach(h => iocList.push({ type: 'File', indicator: h, description: 'SHA256 Hash', defanged: false }));
        md5s.forEach(h => iocList.push({ type: 'File', indicator: h, description: 'MD5 Hash', defanged: false }));
        emails.forEach(e => iocList.push({ type: 'Email', indicator: e, description: 'Phishing/Sender Email', defanged: true }));
        cves.forEach(c => iocList.push({ type: 'Host', indicator: c, description: 'Known Exploited Vulnerability', defanged: false }));

        // 2. Suggest Remediation (Expanded triggers)
        const sentences = sourceText.split(/[.!?\n]+/);
        const actionKeywords = [
            'block', 'update', 'patch', 'monitor', 'restrict', 'disable', 'enable', 'reset', 'audit',
            'mitigate', 'prevent', 'protect', 'defend', 'security', 'measure', 'recommend', 'ensure',
            'isolation', 'quarantine', 'investigate'
        ];
        
        sentences.forEach(s => {
            const trimmed = s.trim();
            if (actionKeywords.some(kw => trimmed.toLowerCase().includes(kw)) && trimmed.length > 20) {
                remediationList.push({ label: 'Recommended Action', description: trimmed });
            }
        });

        // 3. Update State
        setAdvisory(prev => ({
            ...prev,
            iocs: { entries: [...prev.iocs.entries, ...iocList] },
            remediation: { entries: [...prev.remediation.entries, ...remediationList] }
        }));

        toast.success(`Extracted ${iocList.length} IOCs and ${remediationList.length} actions!`);
    };

    const handleMetaConfirm = async (meta) => {
        setMetaModalOpen(false);
        setGenerating(true);
        const toastId = toast.loading('Generating GTBank Advisory...');
        try {
            const finalAdvisory = { ...advisory, metadata: { ...advisory.metadata, date: meta.date, prepared_by: meta.preparedBy, reviewed_by: meta.reviewedBy } };
            const response = await axios.post('/api/reports/advisory', finalAdvisory, { responseType: 'blob' });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url; a.download = `GTBank_Advisory_${advisory.metadata.title.replace(/\s+/g, '_')}.docx`;
            document.body.appendChild(a); a.click(); a.remove();
            toast.success('Advisory generated successfully', { id: toastId });
        } catch { toast.error('Failed to generate advisory', { id: toastId }); }
        finally { setGenerating(false); }
    };

    if (loading) return (
        <div className={styles.container}>
            {/* Header skeleton */}
            <header className={styles.header}>
                <div>
                    <div className="sk-bone sk-h-xs sk-pill" style={{ width:140, marginBottom:8 }}/>
                    <div className="sk-bone sk-h-lg" style={{ width:280, marginBottom:6 }}/>
                    <div className="sk-bone sk-h-sm" style={{ width:200 }}/>
                </div>
                <div className={styles.actions} style={{ display:'flex', gap:8 }}>
                    {[120, 80, 130, 100, 90].map((w, i) => (
                        <div key={i} className="sk-bone sk-h-xl sk-pill" style={{ width: w }}/>
                    ))}
                </div>
            </header>

            {/* Progress bar skeleton */}
            <div className={styles.progressContainer}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <div className="sk-bone sk-h-sm" style={{ width:140 }}/>
                    <div className="sk-bone sk-h-sm sk-pill" style={{ width:36 }}/>
                </div>
                <div className="sk-bone" style={{ height:6, width:'100%', borderRadius:3 }}/>
            </div>

            {/* Form sections skeleton */}
            <div className={styles.form}>
                {/* Section 1: Metadata */}
                <div className={styles.section}>
                    <div className="sk-bone sk-h-md" style={{ width:200, marginBottom:16 }}/>
                    <div style={{ display:'flex', gap:16 }}>
                        <div style={{ flex:3, display:'flex', flexDirection:'column', gap:6 }}>
                            <div className="sk-bone sk-h-sm" style={{ width:100 }}/>
                            <div className="sk-bone sk-h-xl sk-w-full" style={{ borderRadius:6 }}/>
                        </div>
                        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                            <div className="sk-bone sk-h-sm" style={{ width:70 }}/>
                            <div className="sk-bone sk-h-xl sk-w-full" style={{ borderRadius:6 }}/>
                        </div>
                    </div>
                </div>

                {/* Section 2: Executive Summary */}
                <div className={styles.section}>
                    <div className="sk-bone sk-h-md" style={{ width:240, marginBottom:16 }}/>
                    <div className="sk-bone" style={{ height:76, width:'100%', borderRadius:6 }}/>
                </div>

                {/* Section 3: Threat Analysis */}
                <div className={styles.section}>
                    <div className="sk-bone sk-h-md" style={{ width:200, marginBottom:16 }}/>
                    <div className="sk-bone sk-h-sm" style={{ width:130, marginBottom:8 }}/>
                    <div className="sk-bone" style={{ height:76, width:'100%', borderRadius:6, marginBottom:16 }}/>
                    <div className="sk-bone sk-h-sm" style={{ width:150, marginBottom:8 }}/>
                    {[1,2].map(i => (
                        <div key={i} style={{ display:'flex', gap:8, marginBottom:6 }}>
                            <div className="sk-bone sk-h-xl" style={{ width:50, borderRadius:6 }}/>
                            <div className="sk-bone sk-h-xl" style={{ flex:1, borderRadius:6 }}/>
                            <div className="sk-bone sk-h-xl" style={{ flex:2, borderRadius:6 }}/>
                            <div className="sk-bone sk-circle" style={{ width:32, height:32 }}/>
                        </div>
                    ))}
                </div>

                {/* Section 4: IOCs */}
                <div className={styles.section}>
                    <div className="sk-bone sk-h-md" style={{ width:260, marginBottom:16 }}/>
                    {[1,2,3].map(i => (
                        <div key={i} style={{ display:'flex', gap:8, marginBottom:6 }}>
                            <div className="sk-bone sk-h-xl" style={{ width:100, borderRadius:6 }}/>
                            <div className="sk-bone sk-h-xl" style={{ flex:1, borderRadius:6 }}/>
                            <div className="sk-bone sk-h-xl" style={{ flex:1, borderRadius:6 }}/>
                            <div className="sk-bone sk-circle" style={{ width:32, height:32 }}/>
                        </div>
                    ))}
                </div>

                {/* Section 5: Risk Assessment */}
                <div className={styles.section}>
                    <div className="sk-bone sk-h-md" style={{ width:200, marginBottom:16 }}/>
                    <div style={{ display:'flex', gap:16 }}>
                        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                            <div className="sk-bone sk-h-sm" style={{ width:120 }}/>
                            <div className="sk-bone sk-h-xl sk-w-full" style={{ borderRadius:6 }}/>
                        </div>
                        <div style={{ flex:2, display:'flex', flexDirection:'column', gap:6 }}>
                            <div className="sk-bone sk-h-sm" style={{ width:110 }}/>
                            <div className="sk-bone sk-h-xl sk-w-full" style={{ borderRadius:6 }}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const completion = Math.round((
        (advisory.metadata.title ? 1 : 0) + (advisory.executive_summary.body ? 1 : 0) +
        (advisory.threat_analysis.intro ? 1 : 0) + (advisory.iocs.entries.length > 0 ? 1 : 0) +
        (advisory.remediation.entries.length > 0 ? 1 : 0)
    ) / 5 * 100);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <div className={styles.breadcrumbs}>Advisories / {id}</div>
                    <h1 className={styles.pageTitle}>Threat Intelligence Advisory</h1>
                    <p className={styles.subtitle}>GTBank Threat Advisory Framework v1.0</p>
                </div>
                <div className={styles.actions}>
                    <button className={styles.smartButton} onClick={handleSmartFill} title="Auto-extract IOCs and Actions">
                        <Sparkles size={16} /> Smart Extract
                    </button>
                    <button className={styles.secondaryButton} onClick={handlePreview}>Preview</button>
                    <button className={styles.generateButton} onClick={() => setReportModalOpen(true)} disabled={generating}>
                        {generating ? 'Finalizing...' : 'Generate Report'}
                    </button>
                    <button className={styles.saveButton} onClick={() => handleSave(true)} disabled={saving}>
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button className={styles.finalizeButton} onClick={() => handleSave(false)}>
                        <CheckCircle size={16} /> Publish
                    </button>
                </div>
            </header>

            <div className={styles.progressContainer}>
                <div className={styles.progressLabel}>
                    <span>Advisory Completion</span>
                    <span className={styles.percentage}>{completion}%</span>
                </div>
                <div className={styles.progressBarBg}>
                    <div className={styles.progressBarFill} style={{ width: `${completion}%` }}></div>
                </div>
            </div>

            <div className={styles.form}>
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Metadata & Classification</h3>
                    <div className={styles.row}>
                        <div style={{ flex: 3 }}>
                            <label className={styles.label}>Advisory Title *</label>
                            <input className={styles.input} value={advisory.metadata.title} onChange={e => handleChange('metadata.title', e.target.value)} placeholder="e.g. Ransomware Campaign Targeting Finance" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className={styles.label}>TLP Level</label>
                            <Select value={advisory.metadata.tlp} onChange={e => handleChange('metadata.tlp', e.target.value)} options={['WHITE', 'GREEN', 'AMBER', 'RED'].map(o => ({ value: o, label: o }))} />
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 1: Executive Summary</h3>
                    <textarea className={styles.textarea} rows={3} value={advisory.executive_summary.body} onChange={e => handleChange('executive_summary.body', e.target.value)} placeholder="High-level threat summary..." />
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 2: Threat Analysis</h3>
                    <div>
                        <label className={styles.label}>Technical Overview</label>
                        <textarea className={styles.textarea} rows={3} value={advisory.threat_analysis.intro} onChange={e => handleChange('threat_analysis.intro', e.target.value)} placeholder="Detailed technical analysis..." />
                    </div>
                    
                    <div>
                        <label className={styles.label}>Attack Chain Steps</label>
                        {advisory.threat_analysis.attack_chain.map((step, i) => (
                            <div key={i} className={styles.arrayItem} style={{ marginBottom: '4px' }}>
                                <input style={{ width: '50px' }} className={styles.input} type="number" value={step.step} onChange={e => handleArrayChange('threat_analysis.attack_chain', i, 'step', parseInt(e.target.value))} />
                                <input style={{ flex: 1 }} className={styles.input} value={step.label} onChange={e => handleArrayChange('threat_analysis.attack_chain', i, 'label', e.target.value)} placeholder="Phase" />
                                <input style={{ flex: 2 }} className={styles.input} value={step.description} onChange={e => handleArrayChange('threat_analysis.attack_chain', i, 'description', e.target.value)} placeholder="Action..." />
                                <button className={styles.removeButton} onClick={() => removeArrayItem('threat_analysis.attack_chain', i)}>×</button>
                            </div>
                        ))}
                        <button className={styles.addButton} onClick={() => addArrayItem('threat_analysis.attack_chain', { step: advisory.threat_analysis.attack_chain.length + 1, label: '', description: '' })}>+ Phase</button>
                    </div>

                    <div>
                        <label className={styles.label}>MITRE ATT&CK Mapping</label>
                        {advisory.threat_analysis.mitre_attack.map((mapping, i) => (
                            <div key={i} className={styles.arrayItem} style={{ marginBottom: '4px' }}>
                                <input style={{ width: '80px' }} className={styles.input} value={mapping.technique_id} onChange={e => handleArrayChange('threat_analysis.mitre_attack', i, 'technique_id', e.target.value)} placeholder="T1234" />
                                <input style={{ flex: 1 }} className={styles.input} value={mapping.description} onChange={e => handleArrayChange('threat_analysis.mitre_attack', i, 'description', e.target.value)} placeholder="Description" />
                                <button className={styles.removeButton} onClick={() => removeArrayItem('threat_analysis.mitre_attack', i)}>×</button>
                            </div>
                        ))}
                        <button className={styles.addButton} onClick={() => addArrayItem('threat_analysis.mitre_attack', { technique_id: '', tactic: '', description: '' })}>+ Mapping</button>
                    </div>
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 3: Indicators of Compromise</h3>
                    {advisory.iocs.entries.map((ioc, i) => (
                        <div key={i} className={styles.arrayItem} style={{ marginBottom: '4px' }}>
                            <div style={{ width: '100px' }}>
                                <Select value={ioc.type} onChange={e => handleArrayChange('iocs.entries', i, 'type', e.target.value)} options={['Network', 'File', 'Email', 'Host'].map(o => ({ value: o, label: o }))} />
                            </div>
                            <input style={{ flex: 1 }} className={styles.input} value={ioc.indicator} onChange={e => handleArrayChange('iocs.entries', i, 'indicator', e.target.value)} placeholder="Indicator" />
                            <input style={{ flex: 1 }} className={styles.input} value={ioc.description} onChange={e => handleArrayChange('iocs.entries', i, 'description', e.target.value)} placeholder="Observed context" />
                            <button className={styles.removeButton} onClick={() => removeArrayItem('iocs.entries', i)}>×</button>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => addArrayItem('iocs.entries', { type: 'Network', indicator: '', description: '', defanged: true })}>+ Indicator</button>
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 4: Risk Assessment</h3>
                    <div className={styles.row}>
                        <div style={{ flex: 1 }}>
                            <label className={styles.label}>Current Risk Rating</label>
                            <Select value={advisory.assessment.risk_rating.selected} onChange={e => handleChange('assessment.risk_rating.selected', e.target.value)} options={['Low', 'Medium', 'High', 'Critical'].map(o => ({ value: o, label: o }))} />
                        </div>
                        <div style={{ flex: 2 }}>
                            <label className={styles.label}>Assessment Logic</label>
                            <input className={styles.input} value={advisory.assessment.assessment_notes} onChange={e => handleChange('assessment.assessment_notes', e.target.value)} placeholder="Rationale for risk level..." />
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Section 5: Remediation Actions</h3>
                    {advisory.remediation.entries.map((entry, i) => (
                        <div key={i} className={styles.arrayItem} style={{ marginBottom: '4px' }}>
                            <input style={{ width: '140px' }} className={styles.input} value={entry.label} onChange={e => handleArrayChange('remediation.entries', i, 'label', e.target.value)} placeholder="Action Type" />
                            <input style={{ flex: 1 }} className={styles.input} value={entry.description} onChange={e => handleArrayChange('remediation.entries', i, 'description', e.target.value)} placeholder="Recommendation..." />
                            <button className={styles.removeButton} onClick={() => removeArrayItem('remediation.entries', i)}>×</button>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => addArrayItem('remediation.entries', { label: 'Immediate Action', description: '' })}>+ Action</button>
                </section>
            </div>

            <ReportModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} onSelect={(t) => { setReportModalOpen(false); if(t==='advisory') setMetaModalOpen(true); }} />
            <AdvisoryMetaModal isOpen={metaModalOpen} onClose={() => setMetaModalOpen(false)} onConfirm={handleMetaConfirm} initialData={{ preparedBy: user?.email, title: advisory.metadata.title }} />
        </div>
    );
};

export default AdvisoryBuilder;
