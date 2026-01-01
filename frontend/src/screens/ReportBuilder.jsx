import React, { useEffect, useState } from 'react';
import { FileDown, FileText, Search, Filter } from 'lucide-react';
import Select from '../components/common/Select';
import styles from './ReportBuilder.module.css';

const ReportBuilder = () => {
    const [sources, setSources] = useState([]);
    const [reports, setReports] = useState([]);
    const [selectedSource, setSelectedSource] = useState('');
    const [config, setConfig] = useState({
        type: 'Executive Briefing',
        classification: 'TLP:AMBER',
        audience: 'Executive Leadership',
        format: 'DOCX'
    });
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        // Fetch available sources (Advisories + Assessments)
        // and Existing Reports
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [advRes, asmRes, repRes] = await Promise.all([
                fetch('/api/advisories'),
                fetch('/api/assessments'),
                fetch('/api/reports')
            ]);

            const advisories = await advRes.json();
            const assessments = await asmRes.json();
            const reportsData = await repRes.json();

            // Combine into selectable sources
            const advOptions = (advisories || []).map(a => ({
                id: a.id,
                title: a.title,
                type: 'Advisory'
            }));

            const asmOptions = (assessments || []).map(a => ({
                id: a.id,
                title: a.id + ' (Strategic Assessment)',
                type: 'Assessment'
            }));

            setSources([...advOptions, ...asmOptions]);
            setReports(reportsData || []);
        } catch (err) {
            console.error(err);
        }
    };

    const generateReport = async () => {
        if (!selectedSource) return alert('Please select a source');
        setGenerating(true);
        try {
            // POST /api/reports/create
            const response = await fetch('/api/reports/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    artifact_id: selectedSource,
                    type: sources.find(s => s.id === selectedSource)?.type || 'Advisory',
                    // other config params would be handled by backend logic or passed in
                })
            });
            if (!response.ok) throw new Error('Generation failed');
            const data = await response.json();
            alert('Report generated successfully: ' + data.id);
            fetchData(); // Refresh list
        } catch (err) {
            alert('Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = (reportId) => {
        window.location.href = `/api/reports/download?id=${reportId}`;
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Intelligence Reports</h1>
                <p className={styles.subtitle}>Exported and approved intelligence products</p>
            </header>

            {/* Generator Panel */}
            <section className={styles.generator}>
                <div className={styles.panelHeader}>
                    <div className={styles.panelIcon}><FileText size={20} /></div>
                    <h3>Report Generator</h3>
                </div>

                <div className={styles.grid}>
                    <div className={styles.field}>
                        <label>Select Source Material</label>
                        <Select
                            value={selectedSource}
                            onChange={e => setSelectedSource(e.target.value)}
                            options={sources.map(s => ({ value: s.id, label: `[${s.type}] ${s.title}` }))}
                            placeholder="Select a Threat Advisory or Assessment..."
                        />
                        <span className={styles.hint}>Select the core intelligence product this report will be based on.</span>
                    </div>

                    <div className={styles.field}>
                        <label>Report Type</label>
                        <Select
                            value={config.type}
                            onChange={e => setConfig({ ...config, type: e.target.value })}
                            options={[
                                { value: 'Executive Briefing', label: 'Executive Briefing' },
                                { value: 'Technical Deep Dive', label: 'Technical Deep Dive' },
                                { value: 'Situational Update', label: 'Situational Update' }
                            ]}
                        />
                    </div>

                    <div className={styles.field}>
                        <label>Classification</label>
                        <Select
                            value={config.classification}
                            onChange={e => setConfig({ ...config, classification: e.target.value })}
                            options={[
                                { value: 'TLP:RED', label: 'TLP:RED' },
                                { value: 'TLP:AMBER', label: 'TLP:AMBER' },
                                { value: 'TLP:GREEN', label: 'TLP:GREEN' },
                                { value: 'TLP:CLEAR', label: 'TLP:CLEAR' }
                            ]}
                        />
                    </div>

                    <div className={styles.field}>
                        <label>Output Format</label>
                        <div className={styles.formatToggle}>
                            <button className={config.format === 'PDF' ? styles.active : ''} onClick={() => setConfig({ ...config, format: 'PDF' })}>PDF</button>
                            <button className={config.format === 'DOCX' ? styles.active : ''} onClick={() => setConfig({ ...config, format: 'DOCX' })}>DOCX</button>
                        </div>
                    </div>
                </div>

                <div className={styles.generateAction}>
                    <button
                        className={styles.generateButton}
                        onClick={generateReport}
                        disabled={generating}
                    >
                        {generating ? 'Generating...' : 'Generate Report'}
                    </button>
                </div>
            </section>

            {/* Reports List */}
            <section className={styles.history}>
                <div className={styles.historyHeader}>
                    <h3>Report History</h3>
                    <div className={styles.search}>
                        <Search size={16} />
                        <input placeholder="Search ID..." />
                    </div>
                </div>

                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Report ID</th>
                            <th>Type</th>
                            <th>Classification</th>
                            <th>Generated By</th>
                            <th>Generated At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map(r => (
                            <tr key={r.id}>
                                <td className={styles.idCell}>{r.id}</td>
                                <td>{r.type}</td>
                                <td>
                                    <span className={`${styles.badge} ${styles[r.classification.replace(':', '')]}`}>
                                        {r.classification || 'TLP:AMBER'}
                                    </span>
                                </td>
                                <td>{r.analyst}</td>
                                <td>{new Date(r.generated_at).toLocaleString()}</td>
                                <td>
                                    <button
                                        className={styles.downloadButton}
                                        onClick={() => handleDownload(r.id)}
                                    >
                                        <FileDown size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {reports.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    No reports generated yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
};

export default ReportBuilder;
