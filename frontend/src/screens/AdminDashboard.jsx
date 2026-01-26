import React, { useEffect, useState } from 'react';
import { Users, Shield, Activity, Plus, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'audit'
    const [users, setUsers] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    // Create User Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', role: 'analyst' });
    const [createLoading, setCreateLoading] = useState(false);

    const { token, user: currentUser } = useAuth(); // Use real auth context

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'users') {
                const res = await fetch('/api/admin/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) setUsers(await res.json());
            } else {
                const res = await fetch('/api/admin/audit-logs', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) setAuditLogs(await res.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newUser)
            });

            if (res.ok) {
                toast.success('User created successfully!');
                setShowCreateModal(false);
                setNewUser({ email: '', password: '', role: 'analyst' });
                fetchData();
            } else {
                const data = await res.json();
                const errorMsg = data.length > 0 ? data[0].description : 'Failed to create user';
                toast.error(errorMsg);
            }
        } catch (err) {
            toast.error('Error creating user');
        } finally {
            setCreateLoading(false);
        }
    };

    // Check if user has required roles (Admin or SuperAdmin)
    // backend sends roles as lowercase or snake_case usually
    const hasAdminAccess = currentUser?.roles?.some(r =>
        ['Admin', 'SuperAdmin', 'Super Admin', 'admin', 'super_admin'].includes(r)
    ) || currentUser?.role === 'Admin';

    if (!hasAdminAccess) {
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
                    <button className={styles.createButton} onClick={() => setShowCreateModal(true)}>
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
                                <th>Email</th>
                                <th>Role</th>
                                <th>MFA Status</th>
                                <th>Created At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u, index) => (
                                <tr key={u.id}>
                                    <td className={styles.mono} title={u.id}>{index + 1}</td>
                                    <td>{u.email}</td>
                                    <td>
                                        {u.roles && u.roles.length > 0 ? (
                                            u.roles.map(r => (
                                                <span key={r} className={styles.roleBadge} style={{ marginRight: '4px', textTransform: 'capitalize' }}>
                                                    {r.replace(/_/g, ' ')}
                                                </span>
                                            ))
                                        ) : (
                                            <span className={styles.roleBadge}>Analyst</span>
                                        )}
                                    </td>
                                    <td>{u.mfaEnabled ? 'Enabled' : 'Disabled'}</td>
                                    <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</td>
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

            {/* Create User Modal */}
            {showCreateModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h2 className={styles.modalTitle}>Create New User</h2>
                        <form onSubmit={handleCreateSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    required
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Password</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    required
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Role</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    className={styles.select}
                                >
                                    <option value="analyst">Analyst</option>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>
                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className={styles.cancelButton}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className={styles.submitButton}
                                >
                                    {createLoading ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
