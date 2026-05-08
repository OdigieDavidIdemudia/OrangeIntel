import React, { useEffect, useState, useCallback } from 'react';
import { FileDown, FileText, Search, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Select from '../components/common/Select';
import styles from './ReportBuilder.module.css';

const ReportBuilder = () => {
    const { token } = useAuth();
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

    const fetchData = useCallback(async () => {
        try {
            const headers = { 'Authorization': `Bearer ${token}` };

            // Fetch individually to prevent one failure crashing all
            let advisories = [];
            try {
                const res = await fetch('/api/advisories', { headers });
                if (res.ok) advisories = await res.json();
            } catch (error) {
                console.error("Failed to fetch advisories", error);
            }

            let reportsData = [];
            try {
                const res = await fetch('/api/reports', { headers });
                if (res.ok) reportsData = await res.json();
            } catch (error) {
                console.error("Failed to fetch reports", error);
            }

            // Combine into selectable sources
            const advOptions = Array.isArray(advisories) ? advisories.map(a => ({
                id: a.id,
                title: a.title,
                type: 'Advisory'
            })) : [];

            setSources([...advOptions]);
            setReports(Array.isArray(reportsData) ? reportsData : []);
        } catch (error) {
            console.error("Error in report builder fetch", error);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token, fetchData]);

    const generateReport = async () => {
        if (!selectedSource) return toast.error('Please select a source');
        setGenerating(true);
        try {
            const response = await fetch('/api/reports/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    artifact_id: selectedSource,
                    type: sources.find(s => s.id === selectedSource)?.type || 'Advisory',
                    format: config.format
                })
            });
            if (!response.ok) throw new Error('Generation failed');
            const data = await response.json();
            toast.success('Report generated successfully: ' + data.id);
            fetchData(); // Refresh list
        } catch {
            toast.error('Failed to generate report');
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
                </div>

                <div className={styles.generateAction}>
                    <button
                        className={styles.previewButton}
                        onClick={() => {
                            if (!selectedSource) return toast.error('Please select a source');
                            const type = sources.find(s => s.id === selectedSource)?.type || 'Advisory';
                            window.open(`/api/reports/preview?artifactId=${selectedSource}&type=${type}`, '_blank');
                        }}
                        disabled={generating}
                        style={{ marginRight: '1rem', backgroundColor: '#6c757d' }}
                    >
                        Preview Report
                    </button>
                    <button
                        className={styles.generateButton}
                        onClick={generateReport}
                        disabled={generating}
                    >
                        {generating ? 'Generating...' : 'Generate & Save Report'}
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
                            <th style={{ width: '50px' }}>#</th>
                            <th>Topic</th>
                            <th>Type</th>
                            <th>Classification</th>
                            <th>Generated At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((r, index) => (
                            <tr key={r.id}>
                                <td>{index + 1}</td>
                                <td className={styles.topicCell}>{r.title || 'Untitled Report'}</td>
                                <td>{r.reportType}</td>
                                <td>
                                    <span className={`${styles.badge} ${styles[(r.classification || 'TLP:AMBER').replace(':', '')]}`}>
                                        {r.classification || 'TLP:AMBER'}
                                    </span>
                                </td>
                                <td>{r.generatedAt ? new Date(r.generatedAt).toLocaleString() : 'N/A'}</td>
                                <td>
                                    <button
                                        className={styles.downloadButton}
                                        onClick={() => handleDownload(r.id)}
                                        title="Download Report"
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
