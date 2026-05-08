import React, { useState, useEffect } from 'react';
import { User, Brain, Network, Shield, Settings as SettingsIcon, Monitor } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './SettingsScreen.module.css';
import axios from 'axios';
import toast from 'react-hot-toast';

import Modal from '../components/common/Modal';

const SettingsScreen = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('personal');

    const tabs = [
        { id: 'personal', label: 'Personal', icon: User, hidden: false },
        { id: 'monitor', label: 'Monitor Config', icon: Monitor, hidden: false },
        { id: 'intelligence', label: 'Intelligence', icon: Brain, hidden: !user?.roles?.some(r => ['admin', 'super_admin'].includes(r)) },
        { id: 'integration', label: 'Integration', icon: Network, hidden: !user?.roles?.some(r => ['admin', 'super_admin'].includes(r)) },
        { id: 'security', label: 'Security & Access', icon: Shield, hidden: !user?.roles?.includes('super_admin') },
        { id: 'system', label: 'System Controls', icon: SettingsIcon, hidden: !user?.roles?.includes('super_admin') },
    ];

    return (
        <div className={styles.container}>
            <div className={styles.sidebar}>
                <h2 className={styles.title}>Settings</h2>
                <nav className={styles.nav}>
                    {tabs.filter(t => !t.hidden).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ''}`}
                        >
                            <tab.icon size={18} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>
            <div className={styles.content}>
                {activeTab === 'personal' && <PersonalSettings user={user} />}
                {activeTab === 'monitor' && <MonitorSettings />}
                {activeTab === 'intelligence' && <IntelligenceSettings />}
                {activeTab === 'integration' && <IntegrationSettings />}
                {activeTab === 'security' && <SecuritySettings />}
                {activeTab === 'system' && <SystemSettings />}
            </div>
        </div>
    );
};

const Toggle = ({ checked, onChange }) => (
    <button
        onClick={() => onChange({ target: { checked: !checked } })}
        className={`${styles.enableBtn} ${checked ? styles.btnStateOn : styles.btnStateOff}`}
    >
        {checked ? 'Disable' : 'Enable'}
    </button>
);

// --- Settings Logic Hook ---
const useSettings = (category) => {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await axios.get(`/api/settings?category=${category}`);
                const settingsMap = {};
                response.data.forEach(s => {
                    settingsMap[s.key] = s.value;
                });
                setSettings(settingsMap);
            } catch (error) {
                console.error("Failed to fetch settings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [category]);

    const updateSetting = async (key, value) => {
        // Optimistic update
        setSettings(prev => ({ ...prev, [key]: value }));

        try {
            // We send a list because the backend expects bulk updates but we can send one
            await axios.put('/api/settings', [{
                key,
                value: String(value), // Ensure string
                category
            }]);
            toast.success("Settings saved");
        } catch (error) {
            toast.error("Failed to save setting");
            console.error(error);
        }
    };

    return { settings, updateSetting, loading };
};

const PersonalSettings = ({ user }) => {
    const [userSettings, setUserSettings] = useState({ mfaEnabled: false });
    const [loading, setLoading] = useState(true);
    const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);

    // MFA Setup State
    const [mfaStep, setMfaStep] = useState('init'); // init, qr, verify, success
    const [mfaData, setMfaData] = useState({ secret: '', qrCodeUri: '' });
    const [mfaCode, setMfaCode] = useState('');

    useEffect(() => {
        const fetchUserSettings = async () => {
            try {
                const response = await axios.get('/api/settings/user');
                setUserSettings(response.data);
            } catch (error) {
                console.error("Failed to fetch user settings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUserSettings();
    }, []);

    const handleMfaToggle = async () => {
        if (!userSettings.mfaEnabled) {
            // Start Setup
            try {
                const res = await axios.post('/api/auth/mfa/setup');
                setMfaData(res.data);
                setMfaStep('qr');
                setIsMfaModalOpen(true);
            } catch {
                toast.error("Failed to start MFA setup");
            }
        } else {
            // Disable MFA
            if (window.confirm("Are you sure you want to disable MFA? This will reduce your account security.")) {
                try {
                    await axios.post('/api/auth/mfa/disable');
                    setUserSettings(prev => ({ ...prev, mfaEnabled: false }));
                    toast.success("MFA Disabled");
                } catch {
                    toast.error("Failed to disable MFA");
                }
            }
        }
    };

    const verifyMfa = async () => {
        try {
            await axios.post('/api/auth/mfa/verify', {
                secret: mfaData.secret,
                code: mfaCode
            });
            setUserSettings(prev => ({ ...prev, mfaEnabled: true }));
            setIsMfaModalOpen(false);
            setMfaStep('init');
            setMfaCode('');
            toast.success("MFA Enabled Successfully");
        } catch {
            toast.error("Invalid Code. Please try again.");
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className={styles.section}>
            <h3>Personal Settings</h3>

            <div className={styles.card}>
                <h4>Profile</h4>
                <div className={styles.formGroup}>
                    <label>Display Name</label>
                    <input type="text" className={styles.input} placeholder="Display Name" defaultValue={user?.userName || "User"} />
                </div>
                <div className={styles.formGroup}>
                    <label>Email</label>
                    <input type="email" className={styles.input} disabled defaultValue={user?.email || "user@example.com"} />
                </div>
                <div className={styles.formGroup}>
                    <label>Timezone</label>
                    <select className={styles.select}>
                        <option>UTC</option>
                        <option>America/New_York</option>
                        <option>Europe/London</option>
                    </select>
                </div>
            </div>

            <div className={styles.card}>
                <h4>Authentication</h4>
                <div className={styles.row}>
                    <label>Multi-Factor Authentication (MFA)</label>
                    <Toggle checked={userSettings.mfaEnabled} onChange={handleMfaToggle} />
                </div>
                <div className={styles.badgeList}>
                    <span className={styles.badge}>Status: {userSettings.mfaEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
            </div>

            <div className={styles.card}>
                <h4>Notifications</h4>
                <div className={styles.row}>
                    <label>In-App Notifications</label>
                    <Toggle checked={true} onChange={() => { }} />
                </div>
                <div className={styles.row}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label>Signal Integration</label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Get alerts on your phone</span>
                    </div>
                    <button className={styles.btnPrimary} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>Link Number</button>
                </div>
                <div className={styles.checkboxGroup}>
                    <label className={styles.checkboxLabel}>
                        <input type="checkbox" className={styles.checkbox} defaultChecked />
                        Notify on Topic Assigned
                    </label>
                    <label className={styles.checkboxLabel}>
                        <input type="checkbox" className={styles.checkbox} defaultChecked />
                        Notify on Advisory Approved
                    </label>
                </div>
            </div>

            <Modal isOpen={isMfaModalOpen} onClose={() => setIsMfaModalOpen(false)} title="Setup MFA">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', padding: '1rem' }}>
                    {mfaStep === 'qr' && (
                        <>
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy).
                            </p>
                            <div style={{ background: 'white', padding: '10px', borderRadius: '8px' }}>
                                {/* In a real app, use a QR code library. For now, we display the secret text fallback if no QR lib */}
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaData.qrCodeUri)}`} alt="QR Code" />
                            </div>
                            <div style={{ width: '100%' }}>
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Or enter manual key:</label>
                                <div style={{ background: 'var(--bg-app)', padding: '0.5rem', borderRadius: '4px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                    {mfaData.secret}
                                </div>
                            </div>
                            <div style={{ width: '100%', display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Enter 6-digit Code"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    maxLength={6}
                                />
                                <button className={styles.btnPrimary} onClick={verifyMfa}>Verify</button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};

const IntelligenceSettings = () => {
    const { settings, updateSetting, loading } = useSettings('intelligence');

    if (loading) return <div>Loading...</div>;

    return (
        <div className={styles.section}>
            <h3>Intelligence Settings</h3>
            <div className={styles.card}>
                <h4>Ingestion Control</h4>
                <div className={styles.row}>
                    <label>Max Topics Per Day</label>
                    <input
                        type="number"
                        className={styles.input}
                        value={settings['max_topics'] || 10}
                        onChange={(e) => updateSetting('max_topics', e.target.value)}
                        style={{ width: '80px' }}
                    />
                </div>
                <div className={styles.row}>
                    <label>Poll Interval (Minutes)</label>
                    <input
                        type="number"
                        className={styles.input}
                        value={settings['poll_interval'] || 30}
                        onChange={(e) => updateSetting('poll_interval', e.target.value)}
                        style={{ width: '80px' }}
                    />
                </div>

            </div>

            <div className={styles.card}>
                <h4>Severity Logic</h4>
                <div className={styles.row}>
                    <label>Enable Medium Threats</label>
                    <Toggle
                        checked={settings['enable_medium_threats'] === 'true'}
                        onChange={(e) => updateSetting('enable_medium_threats', e.target.checked)}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label>Promotion Conditions (Auto-promote to Advisory)</label>
                    <div className={styles.checkboxGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={settings['promo_multi_source'] === 'true'}
                                onChange={(e) => updateSetting('promo_multi_source', e.target.checked)}
                            />
                            Multi-Source Corroboration
                        </label>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={settings['promo_ioc_overlap'] === 'true'}
                                onChange={(e) => updateSetting('promo_ioc_overlap', e.target.checked)}
                            />
                            IoC Overlap
                        </label>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={settings['promo_ttp_match'] === 'true'}
                                onChange={(e) => updateSetting('promo_ttp_match', e.target.checked)}
                            />
                            TTP Match
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

const IntegrationSettings = () => {
    const { settings, updateSetting, loading } = useSettings('integration');

    if (loading) return <div>Loading...</div>;

    return (
        <div className={styles.section}>
            <h3>Integration Settings</h3>
            <div className={styles.card}>
                <h4>External APIs</h4>
                <div className={styles.checkboxGroup}>
                    {["CISA KEV", "NVD", "TAXII"].map(api => (
                        <div key={api} className={styles.row} style={{ marginBottom: '0.5rem' }}>
                            <label>{api}</label>
                            <span className={`${styles.statusIndicator} ${styles.statusHealthy}`}></span>
                        </div>
                    ))}
                    <div className={styles.formGroup} style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <label>VirusTotal API Key</label>
                        <input
                            type="password"
                            className={styles.input}
                            placeholder="••••••••••••••••"
                            value={settings['vt_api_key'] || ''}
                            onChange={(e) => updateSetting('vt_api_key', e.target.value)}
                        />
                    </div>
                </div>
            </div>
            <div className={styles.card}>
                <h4>Notifications Integration</h4>
                <div className={styles.row}>
                    <label>Signal CLI</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span className={`${styles.statusIndicator} ${styles.statusHealthy}`}></span>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Online</span>
                    </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Managed by Super Admin</p>
            </div>
        </div>
    );
};

const SecuritySettings = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newUserStart, setNewUserStart] = useState({ email: '', password: '', role: 'analyst' });

    // Edit State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/users');
            setUsers(res.data);
        } catch {
            toast.error("Failed to fetch users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async () => {
        try {
            await axios.post('/api/users', newUserStart);
            toast.success("User created successfully");
            setIsCreateModalOpen(false);
            setNewUserStart({ email: '', password: '', role: 'analyst' });
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data || "Failed to create user");
        }
    };

    const handleUpdateUser = async () => {
        if (!editUser) return;
        try {
            await axios.patch(`/api/users/${editUser.id}`, { role: editUser.role });
            toast.success("User updated successfully");
            setIsEditModalOpen(false);
            setEditUser(null);
            fetchUsers();
        } catch {
            toast.error("Failed to update user");
        }
    };

    const openEditModal = (user) => {
        // Find current role from list or default to User
        // Simplified: We assume single role for now or just take the first one
        const currentRole = user.roles && user.roles.length > 0 ? user.roles[0] : 'User';
        setEditUser({ id: user.id, email: user.email, role: currentRole });
        setIsEditModalOpen(true);
    };

    return (
        <div className={styles.section}>
            <h3>Security & Access</h3>
            <div className={styles.card}>
                <div className={styles.row}>
                    <h4>User Management (Verifying)</h4>
                    <button className={styles.btnPrimary} onClick={() => setIsCreateModalOpen(true)}>Create User</button>
                </div>
                {loading ? <div>Loading users...</div> : (
                    <table className={styles.userTable}>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>MFA</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>{u.email}</td>
                                    <td>{u.roles.join(', ') || 'User'}</td>
                                    <td>
                                        <span className={u.mfaEnabled ? styles.statusHealthy : styles.statusWarning}
                                            style={{ width: '10px', height: '10px', display: 'inline-block', borderRadius: '50%', marginRight: '5px' }}>
                                        </span>
                                        {u.mfaEnabled ? 'On' : 'Off'}
                                    </td>
                                    <td>
                                        <button
                                            style={{ background: 'none', border: 'none', color: 'var(--color-brand)', cursor: 'pointer' }}
                                            onClick={() => openEditModal(u)}
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className={styles.card}>
                <h4>Access Policies</h4>
                <div className={styles.row}>
                    <label>Enforce MFA Globally</label>
                    <Toggle checked={true} onChange={() => { }} />
                </div>
                <div className={styles.row}>
                    <label>Session Timeout (Minutes)</label>
                    <input type="number" className={styles.input} defaultValue={30} style={{ width: '80px' }} />
                </div>
            </div>

            <div className={styles.card}>
                <h4>Audit Logs</h4>
                <div className={styles.logs}>
                    <div>[2026-01-14 10:45:01] User 'admin' updated settings.</div>
                    <div>[2026-01-14 10:42:12] User 'analyst' logged in.</div>
                    <div>[2026-01-14 09:30:00] System backup completed.</div>
                </div>
            </div>

            {/* Create User Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New User">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                    <div className={styles.formGroup}>
                        <label>Email</label>
                        <input
                            type="email"
                            className={styles.input}
                            value={newUserStart.email}
                            onChange={(e) => setNewUserStart({ ...newUserStart, email: e.target.value })}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Password</label>
                        <input
                            type="password"
                            className={styles.input}
                            value={newUserStart.password}
                            onChange={(e) => setNewUserStart({ ...newUserStart, password: e.target.value })}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Role</label>
                        <select
                            className={styles.select}
                            value={newUserStart.role}
                            onChange={(e) => setNewUserStart({ ...newUserStart, role: e.target.value })}
                        >
                            <option value="analyst">Analyst</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                        </select>
                    </div>
                    <button className={styles.btnPrimary} onClick={handleCreateUser}>Create User</button>
                </div>
            </Modal>

            {/* Edit User Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit User">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                    {editUser && (
                        <>
                            <div className={styles.formGroup}>
                                <label>Email (Read-only)</label>
                                <input type="text" className={styles.input} value={editUser.email} disabled />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Role</label>
                                <select
                                    className={styles.select}
                                    value={editUser.role}
                                    onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                                >
                                    <option value="analyst">Analyst</option>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>
                            <button className={styles.btnPrimary} onClick={handleUpdateUser}>Save Changes</button>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};

const SystemSettings = () => {
    const handleReset = async () => {
        if (!window.confirm("Are you sure? This will delete ALL threat data. This cannot be undone.")) return;
        try {
            await axios.post('/api/settings/reset');
            toast.success("Database Reset Successfully");
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data || "Failed to reset database");
        }
    };

    return (
        <div className={styles.section}>
            <h3>System Controls</h3>

            <div className={styles.card}>
                <h4>API Health</h4>
                <div className={styles.row}>
                    <label>CISA KEV</label>
                    <button className={styles.btnPrimary} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>Test Fetch</button>
                </div>
                <div className={styles.row}>
                    <label>NVD</label>
                    <button className={styles.btnPrimary} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>Test Fetch</button>
                </div>
            </div>

            <div className={styles.card}>
                <h4>Emergency Mode</h4>
                <div className={styles.row}>
                    <label>Pause Ingestion</label>
                    <Toggle checked={false} onChange={() => { }} />
                </div>
                <div className={styles.row}>
                    <label>Disable Notifications</label>
                    <Toggle checked={false} onChange={() => { }} />
                </div>
            </div>

            <div className={`${styles.card} ${styles.dangerZone}`}>
                <h4 style={{ color: 'var(--color-danger)' }}>Danger Zone</h4>
                <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    These actions are destructive and cannot be undone.
                </p>
                <button className={styles.btnDanger} onClick={handleReset}>Reset Database</button>
            </div>
        </div>
    );
};

const MonitorSettings = () => {
    const [threatWindow, setThreatWindow] = useState(() => {
        return localStorage.getItem('monitor_threat_window') || '7';
    });
    const [refreshInterval, setRefreshInterval] = useState(() => {
        return localStorage.getItem('monitor_refresh_interval') || '60';
    });

    const windowOptions = [
        { value: '0.04', label: 'Last 1 Hour' },
        { value: '0.5', label: 'Last 12 Hours' },
        { value: '1', label: 'Last 24 Hours' },
        { value: '3', label: 'Last 3 Days' },
        { value: '7', label: 'Last 7 Days' },
        { value: '14', label: 'Last 14 Days' },
        { value: '30', label: 'Last 30 Days' },
        { value: '60', label: 'Last 60 Days' },
        { value: '0', label: 'All Time (No Filter)' },
    ];

    const refreshOptions = [
        { value: '30', label: '30 Seconds' },
        { value: '60', label: '1 Minute' },
        { value: '120', label: '2 Minutes' },
        { value: '300', label: '5 Minutes' },
        { value: '600', label: '10 Minutes' },
    ];

    const handleWindowChange = (value) => {
        setThreatWindow(value);
        localStorage.setItem('monitor_threat_window', value);
        toast.success(`Threat display window set to ${windowOptions.find(o => o.value === value)?.label}`);
    };

    const handleRefreshChange = (value) => {
        setRefreshInterval(value);
        localStorage.setItem('monitor_refresh_interval', value);
        toast.success(`Refresh interval set to ${refreshOptions.find(o => o.value === value)?.label}`);
    };

    return (
        <div className={styles.section}>
            <h3>Monitor Configuration</h3>

            <div className={styles.card}>
                <h4>Threat Display Window</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Controls how far back threats are shown on the Monitoring Screen. This affects the threat counts, intercept list, and critical spotlight.
                </p>
                <div className={styles.formGroup}>
                    <label>Show threats from</label>
                    <select
                        className={styles.select}
                        value={threatWindow}
                        onChange={(e) => handleWindowChange(e.target.value)}
                    >
                        {windowOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(249, 115, 22, 0.08)', borderRadius: '8px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                    <span style={{ fontSize: '0.8rem', color: '#F97316' }}>
                        ⚡ Changes take effect on the next Monitoring Screen refresh.
                    </span>
                </div>
            </div>

            <div className={styles.card}>
                <h4>Auto-Refresh Interval</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    How often the Monitoring Screen automatically fetches new data.
                </p>
                <div className={styles.formGroup}>
                    <label>Refresh every</label>
                    <select
                        className={styles.select}
                        value={refreshInterval}
                        onChange={(e) => handleRefreshChange(e.target.value)}
                    >
                        {refreshOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

export default SettingsScreen;
