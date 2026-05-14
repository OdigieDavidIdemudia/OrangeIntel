import React, { useState, useEffect } from 'react';
import { User, Brain, Network, Shield, Settings as SettingsIcon, Monitor, CheckCircle, AlertTriangle, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './SettingsScreen.module.css';
import axios from 'axios';
import toast from 'react-hot-toast';
import Select from '../components/common/Select';
import Modal from '../components/common/Modal';

const SettingsScreen = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('personal');

    const tabs = [
        { id: 'personal', label: 'Account', icon: User, hidden: false },
        { id: 'monitor', label: 'Monitor', icon: Monitor, hidden: false },
        { id: 'intelligence', label: 'Intelligence', icon: Brain, hidden: !user?.roles?.some(r => ['admin', 'super_admin'].includes(r)) },
        { id: 'integration', label: 'Integrations', icon: Network, hidden: !user?.roles?.some(r => ['admin', 'super_admin'].includes(r)) },
        { id: 'security', label: 'Security', icon: Shield, hidden: !user?.roles?.includes('super_admin') },
        { id: 'system', label: 'System', icon: SettingsIcon, hidden: !user?.roles?.includes('super_admin') },
    ];

    return (
        <div className={styles.container}>
            <aside className={styles.sidebar}>
                <h2 className={styles.title}>Settings</h2>
                <nav className={styles.nav}>
                    {tabs.filter(t => !t.hidden).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ''}`}
                        >
                            <tab.icon size={16} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>
            <main className={styles.content}>
                {activeTab === 'personal' && <PersonalSettings user={user} />}
                {activeTab === 'monitor' && <MonitorSettings />}
                {activeTab === 'intelligence' && <IntelligenceSettings />}
                {activeTab === 'integration' && <IntegrationSettings />}
                {activeTab === 'security' && <SecuritySettings />}
                {activeTab === 'system' && <SystemSettings />}
            </main>
        </div>
    );
};

/* Unified High-Fidelity Toggle */
const Toggle = ({ label, checked, onChange }) => (
    <div className={styles.toggleWrapper}>
        <label>{label}</label>
        <label className={styles.switch}>
            <input 
                type="checkbox" 
                checked={checked} 
                onChange={e => onChange(e)} 
            />
            <span className={styles.slider}></span>
        </label>
    </div>
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
                response.data.forEach(s => { settingsMap[s.key] = s.value; });
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
        setSettings(prev => ({ ...prev, [key]: value }));
        try {
            await axios.put('/api/settings', [{ key, value: String(value), category }]);
            toast.success("Configuration updated");
        } catch (error) {
            toast.error("Failed to save changes");
        }
    };

    return { settings, updateSetting, loading };
};

const PersonalSettings = ({ user }) => {
    const [profile, setProfile] = useState({ fullName: '', userName: '', email: '', telegramChatId: '' });
    const [userSettings, setUserSettings] = useState({ mfaEnabled: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Change Password State
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [changingPassword, setChangingPassword] = useState(false);

    const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
    const [mfaData, setMfaData] = useState({ secret: '', qrCodeUri: '' });
    const [mfaCode, setMfaCode] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, settingsRes] = await Promise.all([
                    axios.get('/api/users/profile'),
                    axios.get('/api/settings/user')
                ]);
                setProfile(profileRes.data);
                setUserSettings(settingsRes.data);
            } catch (error) {
                console.error("Failed to fetch account data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleUpdateProfile = async () => {
        setSaving(true);
        try {
            await axios.put('/api/users/profile', {
                fullName: profile.fullName,
                userName: profile.userName,
                telegramChatId: profile.telegramChatId
            });
            toast.success("Profile updated successfully");
        } catch (error) {
            toast.error("Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            toast.error("Passwords do not match");
            return;
        }
        setChangingPassword(true);
        try {
            await axios.post('/api/users/change-password', {
                currentPassword: passwords.current,
                newPassword: passwords.new
            });
            toast.success("Password changed successfully");
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (error) {
            toast.error(error.response?.data?.[0]?.description || "Failed to change password");
        } finally {
            setChangingPassword(false);
        }
    };

    const handleMfaToggle = async () => {
        if (!userSettings.mfaEnabled) {
            try {
                const res = await axios.post('/api/auth/mfa/setup');
                setMfaData(res.data);
                setIsMfaModalOpen(true);
            } catch { toast.error("MFA setup failed"); }
        } else {
            if (window.confirm("Disable MFA? Your account will be less secure.")) {
                try {
                    await axios.post('/api/auth/mfa/disable');
                    setUserSettings(prev => ({ ...prev, mfaEnabled: false }));
                    toast.success("MFA Disabled");
                } catch { toast.error("Action failed"); }
            }
        }
    };

    if (loading) return <div className={styles.loading}>Accessing Profile...</div>;

    return (
        <div className={styles.section}>
            <h3>Account Settings</h3>

            <div className={styles.card}>
                <h4><User size={14} /> Profile Information</h4>
                <div className={styles.grid2}>
                    <div className={styles.formGroup}>
                        <label>Full Name</label>
                        <input 
                            type="text" 
                            className={styles.input} 
                            value={profile.fullName || ''} 
                            onChange={e => setProfile({...profile, fullName: e.target.value})}
                            placeholder="Analyst Name"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Analyst Username</label>
                        <input 
                            type="text" 
                            className={styles.input} 
                            value={profile.userName || ''} 
                            onChange={e => setProfile({...profile, userName: e.target.value})}
                        />
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <label>Registered Email</label>
                    <input type="email" className={styles.input} disabled value={profile.email || ''} />
                </div>
                <div className={styles.formGroup}>
                    <label>Telegram Chat ID</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            type="text" 
                            className={styles.input} 
                            style={{ flex: 1 }}
                            value={profile.telegramChatId || ''} 
                            onChange={e => setProfile({...profile, telegramChatId: e.target.value})}
                            placeholder="Telegram Chat ID"
                        />
                        <button 
                            className={styles.btnSecondary}
                            style={{ height: '38px', padding: '0 12px', whiteSpace: 'nowrap' }}
                            onClick={async () => {
                                try {
                                    await axios.post(`/api/users/profile/test-telegram?chatId=${profile.telegramChatId}`);
                                    toast.success("Test message sent!");
                                } catch (err) {
                                    toast.error(err.response?.data || "Test failed");
                                }
                            }}
                        >
                            Test Connection
                        </button>
                    </div>
                    <span className={styles.hint}>Used for personalized threat alerts via Telegram Bot</span>
                </div>
                <button 
                    className={styles.btnPrimary} 
                    onClick={handleUpdateProfile}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save Profile Changes'}
                </button>
            </div>

            <div className={styles.card}>
                <h4><Lock size={14} /> Password Management</h4>
                <form onSubmit={handleChangePassword}>
                    <div className={styles.formGroup}>
                        <label>Current Password</label>
                        <input 
                            type="password" 
                            className={styles.input} 
                            value={passwords.current}
                            onChange={e => setPasswords({...passwords, current: e.target.value})}
                            required
                        />
                    </div>
                    <div className={styles.grid2}>
                        <div className={styles.formGroup}>
                            <label>New Password</label>
                            <input 
                                type="password" 
                                className={styles.input} 
                                value={passwords.new}
                                onChange={e => setPasswords({...passwords, new: e.target.value})}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Confirm New Password</label>
                            <input 
                                type="password" 
                                className={styles.input} 
                                value={passwords.confirm}
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                required
                            />
                        </div>
                    </div>
                    <button 
                        type="submit"
                        className={styles.btnPrimary} 
                        disabled={changingPassword}
                    >
                        {changingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>

            <div className={styles.card}>
                <h4><Shield size={14} /> Multi-Factor Authentication</h4>
                <Toggle 
                    label="Enable MFA Security" 
                    checked={userSettings.mfaEnabled} 
                    onChange={handleMfaToggle} 
                />
                <div style={{ marginTop: '8px' }}>
                    {userSettings.mfaEnabled ? 
                        <span className={styles.statusHealthy}><CheckCircle size={14} /> Protected by MFA</span> : 
                        <span className={styles.statusWarning}><AlertTriangle size={14} /> MFA is highly recommended</span>
                    }
                </div>
            </div>

            <Modal isOpen={isMfaModalOpen} onClose={() => setIsMfaModalOpen(false)} title="Setup Multi-Factor Authentication">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', padding: '1rem' }}>
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Scan this QR code with your authenticator app to secure your account.
                    </p>
                    <div style={{ background: 'white', padding: '12px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mfaData.qrCodeUri)}`} alt="QR Code" />
                    </div>
                    <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="6-digit code"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                            maxLength={6}
                        />
                        <button className={styles.btnPrimary} onClick={async () => {
                            try {
                                await axios.post('/api/auth/mfa/verify', { secret: mfaData.secret, code: mfaCode });
                                setUserSettings(prev => ({ ...prev, mfaEnabled: true }));
                                setIsMfaModalOpen(false);
                                toast.success("Security verified");
                            } catch { toast.error("Verification failed"); }
                        }}>Verify</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const IntelligenceSettings = () => {
    const { settings, updateSetting, loading } = useSettings('intelligence');
    if (loading) return <div className={styles.loading}>Synchronizing Policies...</div>;

    return (
        <div className={styles.section}>
            <h3>Intelligence Governance</h3>
            <div className={styles.card}>
                <h4><Brain size={14} /> Ingestion Orchestration</h4>
                <div className={styles.formGroup}>
                    <label>Maximum Daily Ingestion Volume</label>
                    <input type="number" className={styles.input} value={settings['max_topics'] || 10} onChange={(e) => updateSetting('max_topics', e.target.value)} />
                </div>
                <Toggle 
                    label="Auto-Promote High Corroboration Threats" 
                    checked={settings['promo_multi_source'] === 'true'} 
                    onChange={e => updateSetting('promo_multi_source', e.target.checked)} 
                />
            </div>
        </div>
    );
};

const MonitorSettings = () => {
    const [threatWindow, setThreatWindow] = useState(() => localStorage.getItem('monitor_threat_window') || '7');
    const [refreshInterval, setRefreshInterval] = useState(() => localStorage.getItem('monitor_refresh_interval') || '60');

    return (
        <div className={styles.section}>
            <h3>Monitor Configuration</h3>
            <div className={styles.card}>
                <h4>Display Parameters</h4>
                <div className={styles.formGroup}>
                    <label>Historical Threat Window</label>
                    <Select
                        value={threatWindow}
                        onChange={e => { setThreatWindow(e.target.value); localStorage.setItem('monitor_threat_window', e.target.value); }}
                        options={[{ value: '1', label: 'Last 24 Hours' }, { value: '7', label: 'Last 7 Days' }, { value: '30', label: 'Last 30 Days' }]}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label>Real-time Refresh Frequency</label>
                    <Select
                        value={refreshInterval}
                        onChange={e => { setRefreshInterval(e.target.value); localStorage.setItem('monitor_refresh_interval', e.target.value); }}
                        options={[{ value: '30', label: '30 Seconds' }, { value: '60', label: '1 Minute' }, { value: '300', label: '5 Minutes' }]}
                    />
                </div>
            </div>
        </div>
    );
};

const IntegrationSettings = () => {
    const { settings, updateSetting, loading } = useSettings('integration');
    if (loading) return <div className={styles.loading}>Linking Nodes...</div>;

    return (
        <div className={styles.section}>
            <h3>Global Integrations</h3>
            <div className={styles.card}>
                <h4><Network size={14} /> Threat Intelligence Providers</h4>
                <div className={styles.formGroup}>
                    <label>VirusTotal API Gateway</label>
                    <input type="password" className={styles.input} placeholder="••••••••••••••••" value={settings['vt_api_key'] || ''} onChange={(e) => updateSetting('vt_api_key', e.target.value)} />
                </div>
                <div className={styles.statusHealthy}><CheckCircle size={14} /> CISA KEV Feed Active</div>
                <div className={styles.statusHealthy} style={{ marginTop: '8px' }}><CheckCircle size={14} /> NVD Database Synced</div>
            </div>

            <div className={styles.card}>
                <h4><Shield size={14} /> Notification Integration</h4>
                <div className={styles.formGroup}>
                    <label>Telegram Bot Token</label>
                    <input 
                        type="password" 
                        className={styles.input} 
                        placeholder="Telegram Bot Token" 
                        value={settings['telegram_bot_token'] || ''} 
                        onChange={(e) => updateSetting('telegram_bot_token', e.target.value)} 
                    />
                </div>
                <div className={styles.formGroup}>
                    <label>Default Telegram Chat ID</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            type="text" 
                            className={styles.input} 
                            style={{ flex: 1 }}
                            placeholder="Default Chat ID" 
                            value={settings['telegram_chat_id'] || ''} 
                            onChange={(e) => updateSetting('telegram_chat_id', e.target.value)} 
                        />
                        <button 
                            className={styles.btnSecondary}
                            style={{ height: '38px', padding: '0 12px', whiteSpace: 'nowrap' }}
                            onClick={async () => {
                                try {
                                    await axios.post(`/api/users/profile/test-telegram?chatId=${settings['telegram_chat_id']}`);
                                    toast.success("Global test message sent!");
                                } catch (err) {
                                    toast.error(err.response?.data || "Global test failed");
                                }
                            }}
                        >
                            Test Global
                        </button>
                    </div>
                </div>
                <div className={styles.statusHealthy}><CheckCircle size={14} /> Telegram Ingress Active</div>
            </div>

            <div className={styles.card}>
                <h4><SettingsIcon size={14} /> Notification Policy</h4>
                <div className={styles.grid3}>
                    <div className={styles.formGroup}>
                        <label>Min Severity (0-10)</label>
                        <input 
                            type="number" 
                            className={styles.input} 
                            value={settings['notify_min_severity'] || 7} 
                            onChange={(e) => updateSetting('notify_min_severity', e.target.value)} 
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Min Confidence (%)</label>
                        <input 
                            type="number" 
                            className={styles.input} 
                            value={settings['notify_min_confidence'] || 70} 
                            onChange={(e) => updateSetting('notify_min_confidence', e.target.value)} 
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Max Alerts / Day</label>
                        <input 
                            type="number" 
                            className={styles.input} 
                            value={settings['notify_max_per_day'] || 5} 
                            onChange={(e) => updateSetting('notify_max_per_day', e.target.value)} 
                        />
                    </div>
                </div>
                <span className={styles.hint}>Thresholds for automated Telegram and Signal alerts.</span>
            </div>
        </div>
    );
};

const SecuritySettings = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    
    // Create User State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', userName: '', password: '', role: 'analyst' });
    const [createLoading, setCreateLoading] = useState(false);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/admin/users');
            setUsers(res.data);
        } catch { toast.error("Access list unavailable"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateLoading(true);
        
        // Ensure userName is set (fallback to email)
        const payload = {
            ...newUser,
            userName: newUser.userName || newUser.email
        };

        try {
            await axios.post('/api/admin/users', payload);
            toast.success('User created successfully');
            setIsCreateModalOpen(false);
            setNewUser({ email: '', userName: '', password: '', role: 'analyst' });
            fetchUsers();
        } catch (error) {
            const msg = error.response?.data?.message 
                || error.response?.data?.errors?.[0]?.message
                || error.response?.data?.[0]?.description
                || 'Failed to create user';
            toast.error(msg);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm("Are you sure you want to delete this user? This action is irreversible.")) return;
        try {
            await axios.delete(`/api/admin/users/${id}`);
            toast.success("User deleted");
            fetchUsers();
        } catch { toast.error("Failed to delete user"); }
    };

    const handleResetMfa = async (id) => {
        if (!window.confirm("Reset MFA for this user?")) return;
        try {
            await axios.post(`/api/admin/users/${id}/mfa/reset`);
            toast.success("MFA Reset");
            fetchUsers();
        } catch { toast.error("Failed to reset MFA"); }
    };

    const handleResetPassword = async () => {
        try {
            await axios.post(`/api/admin/users/${selectedUser.id}/password/reset`, { newPassword });
            toast.success("Password reset successfully");
            setIsPasswordModalOpen(false);
            setNewPassword('');
        } catch { toast.error("Failed to reset password"); }
    };

    if (loading) return <div className={styles.loading}>Scanning Directories...</div>;

    return (
        <div className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Security & Access Control</h3>
                <button 
                    className={styles.btnPrimary} 
                    style={{ height: '32px', padding: '0 12px' }}
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    Add Analyst
                </button>
            </div>
            
            <div className={styles.card}>
                <h4><Shield size={14} /> Analyst Directory</h4>
                <div className={styles.tableWrapper}>
                    <table className={styles.userTable}>
                        <thead>
                            <tr><th>Analyst</th><th>Roles</th><th>Protection</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600 }}>{u.fullName || 'Unnamed Analyst'}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{u.email}</span>
                                        </div>
                                    </td>
                                    <td>{u.roles.join(', ')}</td>
                                    <td>
                                        <div className={u.mfaEnabled ? styles.statusHealthy : styles.statusWarning}>
                                            {u.mfaEnabled ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                                            <span style={{ marginLeft: '4px' }}>{u.mfaEnabled ? 'Secured' : 'No MFA'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.actionGroup}>
                                            <button 
                                                className={styles.actionBtn} 
                                                onClick={() => { setSelectedUser(u); setIsPasswordModalOpen(true); }}
                                                title="Reset Password"
                                            >
                                                <Lock size={14} />
                                            </button>
                                            <button 
                                                className={styles.actionBtn} 
                                                onClick={() => handleResetMfa(u.id)}
                                                title="Reset MFA"
                                            >
                                                <Shield size={14} />
                                            </button>
                                            <button 
                                                className={styles.actionBtnDanger} 
                                                onClick={() => handleDeleteUser(u.id)}
                                                title="Delete User"
                                            >
                                                <User size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create User Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Analyst Account">
                <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                    <div className={styles.formGroup}>
                        <label>Email Address</label>
                        <input 
                            type="email" 
                            className={styles.input} 
                            value={newUser.email}
                            onChange={e => setNewUser({...newUser, email: e.target.value})}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Analyst Username (Optional)</label>
                        <input 
                            type="text" 
                            className={styles.input} 
                            value={newUser.userName}
                            onChange={e => setNewUser({...newUser, userName: e.target.value})}
                            placeholder="Defaults to email"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Initial Password</label>
                        <input 
                            type="password" 
                            className={styles.input} 
                            value={newUser.password}
                            onChange={e => setNewUser({...newUser, password: e.target.value})}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Access Role</label>
                        <Select 
                            value={newUser.role}
                            onChange={e => setNewUser({...newUser, role: e.target.value})}
                            options={[
                                { value: 'analyst', label: 'Analyst' },
                                { value: 'admin', label: 'Admin' },
                                { value: 'super_admin', label: 'Super Admin' }
                            ]}
                        />
                    </div>
                    <button type="submit" className={styles.btnPrimary} disabled={createLoading}>
                        {createLoading ? 'Provisioning...' : 'Create Account'}
                    </button>
                </form>
            </Modal>

            {/* Reset Password Modal */}
            <Modal 
                isOpen={isPasswordModalOpen} 
                onClose={() => setIsPasswordModalOpen(false)} 
                title={`Reset Password for ${selectedUser?.fullName || selectedUser?.email}`}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                    <div className={styles.formGroup}>
                        <label>New Password</label>
                        <input 
                            type="password" 
                            className={styles.input} 
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                        />
                    </div>
                    <button className={styles.btnPrimary} onClick={handleResetPassword}>
                        Reset User Password
                    </button>
                </div>
            </Modal>
        </div>
    );
};

const SystemSettings = () => {
    const { settings, updateSetting, loading } = useSettings('system');
    if (loading) return <div className={styles.loading}>Accessing Core...</div>;

    return (
        <div className={styles.section}>
            <h3>System Controls</h3>
            
            <div className={styles.card}>
                <h4><Clock size={14} /> Response Governance</h4>
                <div className={styles.formGroup}>
                    <label>Threat Response SLA (Hours)</label>
                    <input 
                        type="number" 
                        className={styles.input} 
                        value={settings['sla_threshold_hours'] || 48} 
                        onChange={(e) => updateSetting('sla_threshold_hours', e.target.value)} 
                    />
                    <span className={styles.hint}>Threshold for the "SLA BREACH" warning on pending threat topics.</span>
                </div>
            </div>

            <div className={`${styles.card} ${styles.dangerZone}`}>
                <h4>Emergency Protocol</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Destructive actions. Use with extreme caution.
                </p>
                <button className={styles.btnDanger} onClick={async () => {
                    if (window.confirm("Purge all threat intelligence? This is irreversible.")) {
                        try { await axios.post('/api/settings/reset'); toast.success("System Reset"); }
                        catch { toast.error("Action denied"); }
                    }
                }}>Reset System Database</button>
            </div>
        </div>
    );
};

export default SettingsScreen;
