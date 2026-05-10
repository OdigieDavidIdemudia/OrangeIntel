import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { FileDown, FileText, Search, Clock, Shield } from 'lucide-react';
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
            // Fetch individually to prevent one failure crashing all
            let advisories = [];
            try {
                const res = await axios.get('/api/advisories');
                advisories = res.data;
            } catch (error) {
                console.error("Failed to fetch advisories", error);
            }

            let reportsData = [];
            try {
                const res = await axios.get('/api/reports');
                reportsData = res.data;
            } catch (error) {
                console.error("Failed to fetch reports", error);
            }

            // Combine into selectable sources and deduplicate by title to prevent UI clutter
            const uniqueAdvisories = [];
            const seenTitles = new Set();
            
            if (Array.isArray(advisories)) {
                advisories.forEach(a => {
                    if (!seenTitles.has(a.title)) {
                        uniqueAdvisories.push({
                            id: a.id,
                            title: a.title,
                            type: 'Advisory'
                        });
                        seenTitles.add(a.title);
                    }
                });
            }

            setSources(uniqueAdvisories);
            
            // Sort reports by date descending (newest first)
            const sortedReports = Array.isArray(reportsData) 
                ? [...reportsData].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
                : [];
                
            setReports(sortedReports);
        } catch (error) {
            console.error("Error in report builder fetch", error);
        }
    }, []);

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token, fetchData]);

    const generateReport = async () => {
        if (!selectedSource) return toast.error('Please select a source');
        setGenerating(true);
        try {
            await axios.post('/api/reports/create', {
                artifact_id: selectedSource,
                type: sources.find(s => s.id === selectedSource)?.type || 'Advisory',
                format: config.format
            });
            toast.success('Report generated and logged successfully');
            fetchData(); // Immediately refresh the history list
        } catch {
            toast.error('Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = async (reportId) => {
        try {
            const report = reports.find(r => r.id === reportId);
            const res = await axios.get(`/api/reports/download?id=${reportId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${report?.title || 'report'}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            toast.error("Download failed");
        }
    };

    const handlePreview = async () => {
        if (!selectedSource) return toast.error('Please select a source');
        const type = sources.find(s => s.id === selectedSource)?.type || 'Advisory';
        try {
            const res = await axios.get(`/api/reports/preview?artifactId=${selectedSource}&type=${type}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
            window.open(url, '_blank');
        } catch (error) {
            toast.error("Preview failed");
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Intelligence Reports</h1>
                <p className={styles.subtitle}>Production-ready intelligence products and executive briefings</p>
            </header>

            {/* Generator Panel */}
            <section className={styles.generator}>
                <div className={styles.panelHeader}>
                    <div className={styles.panelIcon}><FileText size={18} /></div>
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
                        <span className={styles.hint}>The source intelligence product this report will distill.</span>
                    </div>

                    <div className={styles.field}>
                        <label>Classification Level</label>
                        <Select
                            value={config.classification}
                            onChange={e => setConfig({ ...config, classification: e.target.value })}
                            options={[
                                { value: 'TLP:RED', label: 'TLP:RED (Highly Restricted)' },
                                { value: 'TLP:AMBER', label: 'TLP:AMBER (Internal Use)' },
                                { value: 'TLP:GREEN', label: 'TLP:GREEN (Community)' },
                                { value: 'TLP:CLEAR', label: 'TLP:CLEAR (Public)' }
                            ]}
                        />
                    </div>
                </div>

                <div className={styles.generateAction}>
                    <button
                        className={styles.previewButton}
                        onClick={handlePreview}
                        disabled={generating}
                    >
                        Live Preview
                    </button>
                    <button
                        className={styles.generateButton}
                        onClick={generateReport}
                        disabled={generating}
                    >
                        {generating ? 'Finalizing...' : 'Generate & Log Report'}
                    </button>
                </div>
            </section>

            {/* Reports List */}
            <section className={styles.history}>
                <div className={styles.historyHeader}>
                    <h3>Production History</h3>
                    <div className={styles.search}>
                        <Search size={14} />
                        <input placeholder="Filter report archives..." />
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>ID</th>
                                <th>Intelligence Product</th>
                                <th>Product Type</th>
                                <th>Classification</th>
                                <th><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={12}/> Generated</div></th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((r, index) => (
                                <tr key={r.id}>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{index + 1}</td>
                                    <td className={styles.topicCell}>{r.title || 'Untitled Intelligence Product'}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Shield size={12} style={{ opacity: 0.5 }} />
                                            {r.reportType}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${styles[(r.classification || 'TLP:AMBER').replace(':', '')]}`}>
                                            {r.classification || 'TLP:AMBER'}
                                        </span>
                                    </td>
                                    <td>{r.generatedAt ? new Date(r.generatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Pending'}</td>
                                    <td>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                className={styles.downloadButton}
                                                onClick={() => handleDownload(r.id)}
                                                title="Download PDF/DOCX"
                                            >
                                                <FileDown size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {reports.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        No intelligence products have been generated yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default ReportBuilder;
