import React, { useEffect, useState } from 'react';
import { ArrowRight, Trash2, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import EmptyState from '../components/common/EmptyState';
import styles from './TopicsView.module.css';

const TopicsView = () => {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTopics();
    }, []);

    const fetchTopics = async () => {
        try {
            const response = await fetch('/api/topics');
            if (!response.ok) throw new Error('Failed to fetch topics');
            const data = await response.json();
            setTopics(data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePromote = async (topicId) => {
        try {
            const response = await fetch('/api/topics/promote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic_id: topicId }),
            });
            if (!response.ok) throw new Error('Failed to promote topic');
            const data = await response.json();
            // Navigate to the newly created advisory
            navigate(`/advisories/${data.advisory_id}`);
            toast.success('Topic promoted to Advisory', {
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

    const handleDiscard = async (topicId) => {
        // TODO: Implement discard API
        toast('Discarded topic', {
            icon: '🗑️',
            style: {
                background: '#333',
                color: '#fff',
            },
        });
        // filter out locally for now
        setTopics(prev => prev.filter(t => t.id !== topicId));
    };



    if (loading) return <div className={styles.loading}>Loading intelligence...</div>;
    if (error) return <div className={styles.error}>Error: {error}</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Threat Topics</h1>
                    <p className={styles.subtitle} style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Raw intelligence signals awaiting analyst evaluation</p>
                </div>
                <div className={styles.meta}>
                    <Clock size={14} />
                    <span>Last updated: Just now</span>
                    <button className={styles.refreshButton} onClick={fetchTopics}>Refresh List</button>
                </div>
            </header>

            {topics.length === 0 ? (
                <EmptyState
                    title="No topics require assessment"
                    message="Your intelligence queue is clear. New signals will appear here when analysis is required."
                    action={
                        <button className={styles.createButton}>+ Create Topic</button>
                    }
                />
            ) : (
                <div className={styles.list}>
                    {topics.map(topic => {
                        const priority = topic.relevance_score >= 90 ? 'HIGH' : topic.relevance_score >= 70 ? 'MEDIUM' : 'LOW';
                        const priorityColor = topic.relevance_score >= 90 ? 'var(--color-danger)' : topic.relevance_score >= 70 ? 'var(--color-warning)' : 'var(--text-secondary)';

                        return (
                            <div key={topic.id} className={styles.card} style={{ borderLeftColor: priorityColor }}>
                                <div className={styles.cardContent}>
                                    <div className={styles.cardHeader}>
                                        <span className={styles.priorityBadge} data-priority={priority}>{priority} PRIORITY</span>
                                        <span className={styles.detectedTime}>Detected: {new Date(topic.created_at).toISOString().replace('T', ' ').substring(0, 16)} UTC</span>
                                    </div>

                                    <h3 className={styles.cardTitle}>{topic.title}</h3>

                                    <div className={styles.metrics}>
                                        <div className={styles.metric}>
                                            <span className={styles.metricLabel}>RELEVANCE</span>
                                            <span className={styles.metricValueLarge}>{topic.relevance_score} <span className={styles.metricMax}>/100</span></span>
                                        </div>
                                        <div className={styles.metricDivider}></div>
                                        <div className={styles.metric}>
                                            <span className={styles.metricLabel}>CONFIDENCE</span>
                                            <span className={styles.metricValue}>{topic.confidence} ({topic.relevance_score}%)</span>
                                        </div>
                                        <div className={styles.metricDivider}></div>
                                        <div className={styles.metric}>
                                            <span className={styles.metricLabel}>SIGNALS</span>
                                            <span className={styles.metricValue}>
                                                <AlertCircle size={14} style={{ display: 'inline', marginRight: 4 }} />
                                                {(topic.signals || []).length}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.cardActions}>
                                    <button
                                        className={styles.acceptButton}
                                        onClick={() => handlePromote(topic.id)}
                                    >
                                        <span className={styles.checkIcon}>✓</span> Accept Topic
                                    </button>
                                    <button
                                        className={styles.discardButton}
                                        onClick={() => handleDiscard(topic.id)}
                                    >
                                        <Trash2 size={16} /> Discard
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TopicsView;
