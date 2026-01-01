import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Save, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from '../components/common/Select';
import styles from './AssessmentBuilder.module.css';

const SECTIONS = [
    {
        id: 'assessment_metadata', title: 'Metadata', hint: 'Classification and Sources', type: 'object', fields: [
            { key: 'classification', label: 'Classification', type: 'select', options: ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] },
            { key: 'promotion_justification', label: 'Promotion Justification', type: 'textarea' }
        ]
    },
    {
        id: 'executive_summary', title: '1. Executive Summary', hint: 'High-level overview.', type: 'object', fields: [
            { key: 'summary', label: 'Summary', type: 'textarea' },
            { key: 'confidence_level', label: 'Confidence Level', type: 'select', options: ['Low', 'Medium', 'High'] },
            { key: 'key_takeaway', label: 'Key Takeaway', type: 'text' }
        ]
    },
    {
        id: 'threat_overview', title: '2. Threat Overview', hint: 'Identity and Scope.', type: 'object', fields: [
            { key: 'threat_type', label: 'Threat Type', type: 'select', options: ['Malware', 'Campaign', 'Vulnerability', 'Actor', 'Technique'] },
            { key: 'threat_name', label: 'Threat Name', type: 'text' },
            { key: 'current_activity_status', label: 'Activity Status', type: 'select', options: ['Active', 'Dormant', 'Declining'] }
        ]
    },
    {
        id: 'technical_details', title: '3. Technical Details', hint: 'TTPs and Methods.', type: 'object', fields: [
            { key: 'attack_vector', label: 'Attack Vectors', type: 'array' },
            { key: 'command_and_control', label: 'C2 Infrastructure', type: 'array' }
        ]
    },
    {
        id: 'indicators_of_compromise', title: '4. IoCs', hint: 'Hashes, IPs, Domains.', type: 'object', fields: [
            { key: 'hashes', label: 'Hashes', type: 'array' },
            { key: 'ips', label: 'IP Addresses', type: 'array' },
            { key: 'domains', label: 'Domains', type: 'array' },
            { key: 'urls', label: 'URLs', type: 'array' }
        ]
    },
    {
        id: 'threat_actor_analysis', title: '5. Actor Analysis', hint: 'Attribution and Motivation.', type: 'object', fields: [
            { key: 'suspected_actor', label: 'Suspected Actor', type: 'text' },
            { key: 'attribution_confidence', label: 'Attribution Confidence', type: 'select', options: ['Low', 'Medium', 'High'] },
            { key: 'motivation', label: 'Motivation', type: 'select', options: ['Financial', 'Espionage', 'Disruption', 'Unknown'] }
        ]
    },
    {
        id: 'impact_assessment', title: '6. Impact Assessment', hint: 'Business Consequence.', type: 'object', fields: [
            { key: 'business_impact', label: 'Business Impact Type', type: 'select', options: ['Operational', 'Financial', 'Reputational'] },
            { key: 'potential_impact_description', label: 'Impact Description', type: 'textarea' },
            { key: 'overall_risk_rating', label: 'Overall Risk', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] }
        ]
    },
    {
        id: 'recommended_actions', title: '7. Recommended Actions', hint: 'Playbook.', type: 'object', fields: [
            { key: 'immediate_actions', label: 'Immediate Actions', type: 'array' },
            { key: 'short_term_actions', label: 'Short Term Actions', type: 'array' }
        ]
    },
    {
        id: 'defensive_guidance', title: '8. Defensive Guidance', hint: 'Detection & Mitigation.', type: 'object', fields: [
            { key: 'detection_recommendations', label: 'Detection Rules', type: 'array' },
            { key: 'mitigation_strategies', label: 'Mitigation Strategies', type: 'array' }
        ]
    },
    {
        id: 'assumptions_and_limitations', title: '9. Assumptions', hint: 'Constraints.', type: 'object', fields: [
            { key: 'intelligence_gaps', label: 'Intelligence Gaps', type: 'array' },
            { key: 'confidence_constraints', label: 'Confidence Constraints', type: 'array' }
        ]
    },
    {
        id: 'references', title: '10. References', hint: 'Sources.', type: 'object', fields: [
            { key: 'external_sources', label: 'External Sources', type: 'array' },
            { key: 'internal_sources', label: 'Internal Sources', type: 'array' }
        ]
    },
    {
        id: 'review_and_approval', title: 'Review', hint: 'Sign-off.', type: 'object', fields: [
            { key: 'analyst', label: 'Analyst Name', type: 'text' },
            { key: 'reviewer', label: 'Reviewer Name', type: 'text' }
        ]
    }
];

const AssessmentBuilder = () => {
    const { id } = useParams(); // Should be TIA ID or Advisory ID to link
    const navigate = useNavigate();
    const [assessment, setAssessment] = useState({
        status: 'draft',
        sections: {}
    });
    const [activeSection, setActiveSection] = useState('executive_summary');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Mock fetch or verify existence
        // ideally fetch /api/assessments/:id
        setLoading(false);
    }, [id]);

    const handleSectionChange = (sectionId, value) => {
        setAssessment(prev => ({
            ...prev,
            sections: { ...prev.sections, [sectionId]: value }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Simulate API
            await new Promise(r => setTimeout(r, 800));
            // In real implementation: POST /api/assessments
            toast.success('Draft saved successfully');
        } finally {
            setSaving(false);
        }
    };

    const handleFinalize = async () => {
        toast((t) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span>Finalize this assessment? It will become immutable.</span>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => { toast.dismiss(t.id); processFinalize(); }}
                        style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', background: 'var(--color-brand)', color: 'white', border: 'none' }}
                    >
                        Finalize
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

    const processFinalize = async () => {
        setSaving(true);
        // Simulate finalization
        setTimeout(() => {
            navigate('/reports');
        }, 1000);
    };

    // Helper to handle nested changes
    const handleNestedChange = (sectionId, fieldKey, value) => {
        setAssessment(prev => ({
            ...prev,
            [sectionId]: {
                ...prev[sectionId],
                [fieldKey]: value
            }
        }));
    };

    // Helper to handle array changes (add/remove/edit)
    const handleArrayChange = (sectionId, fieldKey, index, value, action) => {
        setAssessment(prev => {
            const currentArray = prev[sectionId]?.[fieldKey] || [];
            let newArray = [...currentArray];

            if (action === 'add') {
                newArray.push('');
            } else if (action === 'remove') {
                newArray.splice(index, 1);
            } else if (action === 'update') {
                newArray[index] = value;
            }

            return {
                ...prev,
                [sectionId]: {
                    ...prev[sectionId],
                    [fieldKey]: newArray
                }
            };
        });
    };

    const renderField = (section, field) => {
        const value = assessment[section.id]?.[field.key] || '';

        if (field.type === 'textarea') {
            return (
                <div key={field.key} className={styles.fieldGroup}>
                    <label className={styles.label}>{field.label}</label>
                    <textarea
                        className={styles.textarea}
                        rows={5}
                        value={value}
                        onChange={e => handleNestedChange(section.id, field.key, e.target.value)}
                        placeholder={`Enter ${field.label}...`}
                    />
                </div>
            );
        }

        if (field.type === 'select') {
            return (
                <div key={field.key} className={styles.fieldGroup}>
                    <label className={styles.label}>{field.label}</label>
                    <Select
                        value={value}
                        onChange={e => handleNestedChange(section.id, field.key, e.target.value)}
                        options={field.options.map(o => ({ value: o, label: o }))}
                        placeholder={`Select ${field.label}...`}
                    />
                </div>
            );
        }

        if (field.type === 'array') {
            const list = Array.isArray(value) ? value : [];
            return (
                <div key={field.key} className={styles.fieldGroup}>
                    <label className={styles.label}>{field.label}</label>
                    {list.map((item, idx) => (
                        <div key={idx} className={styles.arrayItem}>
                            <input
                                type="text"
                                className={styles.input}
                                value={item}
                                onChange={e => handleArrayChange(section.id, field.key, idx, e.target.value, 'update')}
                            />
                            <button className={styles.removeButton} onClick={() => handleArrayChange(section.id, field.key, idx, null, 'remove')}>
                                ×
                            </button>
                        </div>
                    ))}
                    <button className={styles.addButton} onClick={() => handleArrayChange(section.id, field.key, null, null, 'add')}>
                        + Add Item
                    </button>
                </div>
            );
        }

        // Default Text
        return (
            <div key={field.key} className={styles.fieldGroup}>
                <label className={styles.label}>{field.label}</label>
                <input
                    type="text"
                    className={styles.input}
                    value={value}
                    onChange={e => handleNestedChange(section.id, field.key, e.target.value)}
                    placeholder={`Enter ${field.label}...`}
                />
            </div>
        );
    };

    // Main Render Loop
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <div className={styles.breadcrumbs}>Threat Assessments / {id || 'New Assessment'}</div>
                    <h1 className={styles.pageTitle}>Threat Assessments</h1>
                    <p className={styles.subtitle} style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Strategic intelligence for decision-makers</p>
                </div>
                {/* Actions saved for next block */}
                <div className={styles.actions}>
                    <button className={styles.saveButton} onClick={handleSave} disabled={saving}>
                        <Save size={18} />
                        {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button className={styles.finalizeButton} onClick={handleFinalize}>
                        <CheckCircle size={18} />
                        Finalize Assessment
                    </button>
                </div>
            </header>

            <div className={styles.layout}>
                <aside className={styles.nav}>
                    {SECTIONS.map(s => (
                        <button
                            key={s.id}
                            className={`${styles.navItem} ${activeSection === s.id ? styles.active : ''}`}
                            onClick={() => setActiveSection(s.id)}
                        >
                            <div className={styles.navDot}></div>
                            {s.title}
                        </button>
                    ))}
                </aside>

                <main className={styles.editor}>
                    {SECTIONS.map(s => (
                        <div key={s.id} style={{ display: activeSection === s.id ? 'block' : 'none' }}>
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>{s.title}</h2>
                                <span className={styles.hint}>{s.hint}</span>
                            </div>

                            <div className={styles.fieldsContainer}>
                                {s.fields.map(field => renderField(s, field))}
                            </div>
                        </div>
                    ))}

                    <div className={styles.navigationFooter}>
                        <button className={styles.navButton} onClick={() => {
                            const idx = SECTIONS.findIndex(s => s.id === activeSection);
                            if (idx > 0) setActiveSection(SECTIONS[idx - 1].id);
                        }}>Previous Section</button>

                        <button className={styles.navButtonPrimary} onClick={() => {
                            const idx = SECTIONS.findIndex(s => s.id === activeSection);
                            if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].id);
                        }}>Next Section</button>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AssessmentBuilder;
