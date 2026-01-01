import React, { useEffect, useState } from 'react';
import { Users, Shield, Activity, Plus, Filter } from 'lucide-react';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'audit'
    const [users, setUsers] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    // Mock Auth for now until Auth Provider is integrated
    // In real flow, we'd check `useAuth().isAdmin`
    const [currentUser] = useState({ role: 'Admin' });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'users') {
                const res = await fetch('/api/admin/users', {
                    headers: { 'Authorization': 'Bearer placeholder-token' }
                });
                if (res.ok) setUsers(await res.json());
            } else {
                const res = await fetch('/api/admin/audit-logs', {
                    headers: { 'Authorization': 'Bearer placeholder-token' }
                });
                if (res.ok) setAuditLogs(await res.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        const username = prompt("Enter username:");
        const password = prompt("Enter password:");
        if (!username || !password) return;

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer placeholder-token'
                },
                body: JSON.stringify({ username, password, role: 'SOCTI_Analyst' })
            });
            if (res.ok) {
                alert('User created!');
                fetchData();
            } else {
                alert('Failed to create user');
            }
        } catch (err) {
            alert('Error creating user');
        }
    };

    if (currentUser.role !== 'Admin' && currentUser.role !== 'SuperAdmin') {
        return <div className={styles.unauthorized}>Access Denied. Admin privileges required.</div>;
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Intelligence Dashboard</h1>
                    <p className={styles.subtitle}>Live overview of active threat intelligence and analyst workload</p>
                </div>
                {activeTab === 'users' && (
                    <button className={styles.createButton} onClick={handleCreateUser}>
                        <Plus size={18} />
                        New User
                    </button>
                )}
            </header>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    <Users size={18} />
                    User Management
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'audit' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('audit')}
                >
                    <Activity size={18} />
                    Audit Logs
                </button>
            </div>

            <main className={styles.content}>
                {loading && <div className={styles.loading}>Loading...</div>}

                {!loading && activeTab === 'users' && (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>MFA Status</th>
                                <th>Created At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td className={styles.mono}>{u.id}</td>
                                    <td>{u.username}</td>
                                    <td>
                                        <span className={styles.roleBadge}>{u.role}</span>
                                    </td>
                                    <td>{u.mfa_enabled ? 'Enabled' : 'Disabled'}</td>
                                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                            {users.length === 0 && <tr><td colSpan={5} className={styles.empty}>No users found.</td></tr>}
                        </tbody>
                    </table>
                )}

                {!loading && activeTab === 'audit' && (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Actor (ID)</th>
                                <th>Action</th>
                                <th>Target Type</th>
                                <th>Target ID</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditLogs.map(log => (
                                <tr key={log.id}>
                                    <td className={styles.mono}>{new Date(log.timestamp).toLocaleString()}</td>
                                    <td>User:{log.user_id}</td>
                                    <td className={styles.action}>{log.action}</td>
                                    <td>{log.entity_type}</td>
                                    <td className={styles.mono}>{log.entity_id}</td>
                                    <td className={styles.details}>{log.details}</td>
                                </tr>
                            ))}
                            {auditLogs.length === 0 && <tr><td colSpan={6} className={styles.empty}>No audit logs found.</td></tr>}
                        </tbody>
                    </table>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
