import React, { useState, useEffect } from 'react';
import { User, Brain, Network, Shield, Settings as SettingsIcon, Monitor, CheckCircle, AlertTriangle, Lock, Clock } from 'lucide-react';

const SkeletonLoader = () => (
    <div className={styles.skeletonContainer}>
        <div className={styles.skeletonCard}>
            <div className={styles.skeletonLine} style={{ width: '80%' }}></div>
            <div className={styles.skeletonLine} style={{ width: '60%' }}></div>
        </div>
        <div className={styles.skeletonCard}>
            <div className={styles.skeletonLine} style={{ width: '40%' }}></div>
            <div className={styles.skeletonLine} style={{ width: '70%' }}></div>
            <div className={styles.skeletonLine} style={{ width: '50%' }}></div>
        </div>
    </div>
);

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
        { id: 'mykeys', label: 'My API Keys', icon: Network, hidden: false },
        { id: 'monitor', label: 'Monitor', icon: Monitor, hidden: false },
        { id: 'intelligence', label: 'Intelligence', icon: Brain, hidden: !user?.roles?.some(r => ['admin', 'super_admin'].includes(r)) },
        { id: 'integration', label: 'Global Integrations', icon: Network, hidden: !user?.roles?.some(r => ['admin', 'super_admin'].includes(r)) },
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
                {activeTab === 'mykeys' && <MyApiKeysSettings />}
                {activeTab === 'monitor' && <MonitorSettings />}
                {activeTab === 'intelligence' && <IntelligenceSettings />}
                {activeTab === 'integration' && <IntegrationSettings />}
                {activeTab === 'security' && <SecuritySettings currentUser={user} />}
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

    if (loading) return <SkeletonLoader />;

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
    if (loading) return <SkeletonLoader />;

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

/* ── Per-User API Keys (all users) ── */
const MyApiKeysSettings = () => {
    const { token } = useAuth();
    const [draft, setDraft] = useState({ vt_api_key: '', abuseipdb_api_key: '', alienvault_api_key: '', nvd_api_key: '', github_api_key: '', telegram_bot_token: '' });
    const [savedKeys, setSavedKeys] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('/api/user/api-keys', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                setSavedKeys(res.data || []);
                // Pre-fill draft with masked values so user knows what's saved
                const init = {};
                (res.data || []).forEach(k => { init[k.keyName] = k.keyValue; });
                setDraft(prev => ({ ...prev, ...init }));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [token]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = [
                { keyName: 'vt_api_key', keyValue: draft.vt_api_key },
                { keyName: 'abuseipdb_api_key', keyValue: draft.abuseipdb_api_key },
                { keyName: 'alienvault_api_key', keyValue: draft.alienvault_api_key },
                { keyName: 'nvd_api_key', keyValue: draft.nvd_api_key },
                { keyName: 'github_api_key', keyValue: draft.github_api_key },
                { keyName: 'telegram_bot_token', keyValue: draft.telegram_bot_token },
            ].filter(k => k.keyValue && !k.keyValue.startsWith('••'));
            await axios.put('/api/user/api-keys', payload, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Your personal API keys have been saved!');
        } catch {
            toast.error('Failed to save your API keys.');
        } finally {
            setSaving(false);
        }
    };

    const isSaved = (keyName) => savedKeys.some(k => k.keyName === keyName);

    if (loading) return <SkeletonLoader />;

    return (
        <div className={styles.section}>
            <h3>My API Keys</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                Add your own free-tier API keys to enable IOC enrichment. Your personal keys take priority over any admin-configured global keys.
            </p>

            <div className={styles.card}>
                <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        VirusTotal API Key
                        {isSaved('vt_api_key') && <span style={{ fontSize: '11px', color: 'var(--color-success)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '10px' }}>✓ Saved</span>}
                    </label>
                    <input
                        id="my-vt-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your VirusTotal v3 API key…"
                        value={draft.vt_api_key}
                        onChange={e => setDraft(p => ({ ...p, vt_api_key: e.target.value }))}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Free tier: 4 lookups/min · 500/day · <a href="https://www.virustotal.com/gui/my-apikey" target="_blank" rel="noreferrer">Get free key ↗</a></span>
                </div>

                <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        AbuseIPDB API Key
                        {isSaved('abuseipdb_api_key') && <span style={{ fontSize: '11px', color: 'var(--color-success)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '10px' }}>✓ Saved</span>}
                    </label>
                    <input
                        id="my-abuseipdb-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your AbuseIPDB API key…"
                        value={draft.abuseipdb_api_key}
                        onChange={e => setDraft(p => ({ ...p, abuseipdb_api_key: e.target.value }))}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Free tier: 1,000 checks/day · <a href="https://www.abuseipdb.com/account/api" target="_blank" rel="noreferrer">Get free key ↗</a></span>
                </div>

                <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        AlienVault OTX API Key
                        {isSaved('alienvault_api_key') && <span style={{ fontSize: '11px', color: 'var(--color-success)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '10px' }}>✓ Saved</span>}
                    </label>
                    <input
                        id="my-otx-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your AlienVault OTX key…"
                        value={draft.alienvault_api_key}
                        onChange={e => setDraft(p => ({ ...p, alienvault_api_key: e.target.value }))}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Completely free · No rate limits · <a href="https://otx.alienvault.com/api" target="_blank" rel="noreferrer">Get free key ↗</a></span>
                </div>

                <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        NVD API Key
                        {isSaved('nvd_api_key') && <span style={{ fontSize: '11px', color: 'var(--color-success)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '10px' }}>✓ Saved</span>}
                    </label>
                    <input
                        id="my-nvd-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your NVD API key…"
                        value={draft.nvd_api_key}
                        onChange={e => setDraft(p => ({ ...p, nvd_api_key: e.target.value }))}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Increases limit from 5 to 50 requests/min · <a href="https://nvd.nist.gov/developers/request-an-api-key" target="_blank" rel="noreferrer">Get free key ↗</a></span>
                </div>

                <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        GitHub API Key (for WinGet)
                        {isSaved('github_api_key') && <span style={{ fontSize: '11px', color: 'var(--color-success)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '10px' }}>✓ Saved</span>}
                    </label>
                    <input
                        id="my-github-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your GitHub Personal Access Token…"
                        value={draft.github_api_key}
                        onChange={e => setDraft(p => ({ ...p, github_api_key: e.target.value }))}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Avoids rate limits for Application Hash Lookup · <a href="https://github.com/settings/tokens/new?description=TealHunt&scopes=" target="_blank" rel="noreferrer">Get free PAT ↗</a></span>
                </div>

                <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Telegram Bot Token
                        {isSaved('telegram_bot_token') && <span style={{ fontSize: '11px', color: 'var(--color-success)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '10px' }}>✓ Saved</span>}
                    </label>
                    <input
                        id="my-telegram-bot-token"
                        type="password"
                        className={styles.input}
                        placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                        value={draft.telegram_bot_token}
                        onChange={e => setDraft(p => ({ ...p, telegram_bot_token: e.target.value }))}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Create a bot via <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather ↗</a> · Send <strong>/start</strong> to your bot before testing</span>
                </div>

                <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save My API Keys'}
                </button>
            </div>

            <div className={styles.card} style={{ marginTop: '16px', background: 'rgba(251,191,36,0.05)', borderColor: 'rgba(251,191,36,0.2)' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    <strong style={{ color: 'var(--color-warning)' }}>How this works:</strong> When you run an IOC lookup, the system first checks if <em>you</em> have a key saved here. If not, it falls back to the organisation-wide key configured by your admin. If neither is set, that provider is skipped.
                </p>
            </div>
        </div>
    );
};

const IntegrationSettings = () => {

    const { settings, loading } = useSettings('integration');
    const { token } = useAuth();

    // Draft state — only persisted when the user clicks Save
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState(null);

    // Initialise draft from loaded settings
    useEffect(() => {
        if (!loading) {
            setDraft({
                vt_api_key: settings['vt_api_key'] || '',
                abuseipdb_api_key: settings['abuseipdb_api_key'] || '',
                alienvault_api_key: settings['alienvault_api_key'] || '',
                nvd_api_key: settings['nvd_api_key'] || '',
                github_api_key: settings['github_api_key'] || '',
                telegram_bot_token: settings['telegram_bot_token'] || '',
                telegram_chat_id: settings['telegram_chat_id'] || '',
                notify_min_severity: settings['notify_min_severity'] || '7',
                notify_min_confidence: settings['notify_min_confidence'] || '70',
                notify_max_per_day: settings['notify_max_per_day'] || '5',
            });
        }
    }, [loading]);

    const handleSaveApiKeys = async () => {
        setSaving(true);
        try {
            const payload = [
                { key: 'vt_api_key',         value: draft.vt_api_key,         category: 'integration' },
                { key: 'abuseipdb_api_key',  value: draft.abuseipdb_api_key,  category: 'integration' },
                { key: 'alienvault_api_key', value: draft.alienvault_api_key, category: 'integration' },
                { key: 'nvd_api_key',        value: draft.nvd_api_key,        category: 'integration' },
                { key: 'github_api_key',     value: draft.github_api_key,     category: 'integration' },
            ];
            await axios.put('/api/settings', payload);
            setSavedAt(new Date());
            toast.success('API keys saved — providers will use the new keys immediately.');
        } catch {
            toast.error('Failed to save API keys.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNotifications = async () => {
        setSaving(true);
        try {
            const payload = [
                { key: 'telegram_bot_token',    value: draft.telegram_bot_token,    category: 'integration' },
                { key: 'telegram_chat_id',       value: draft.telegram_chat_id,       category: 'integration' },
                { key: 'notify_min_severity',    value: draft.notify_min_severity,    category: 'integration' },
                { key: 'notify_min_confidence',  value: draft.notify_min_confidence,  category: 'integration' },
                { key: 'notify_max_per_day',     value: draft.notify_max_per_day,     category: 'integration' },
            ];
            await axios.put('/api/settings', payload);
            toast.success('Notification settings saved.');
        } catch {
            toast.error('Failed to save notification settings.');
        } finally {
            setSaving(false);
        }
    };

    const set = (key) => (e) => setDraft(prev => ({ ...prev, [key]: e.target.value }));

    if (loading) return <SkeletonLoader />;

    return (
        <div className={styles.section}>
            <h3>Global Integrations</h3>

            {/* ── IOC / Threat Intel API Keys ── */}
            <div className={styles.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0 }}><Network size={14} /> IOC Enrichment API Keys</h4>
                    {savedAt && (
                        <span style={{ fontSize: '12px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <CheckCircle size={13} /> Saved {savedAt.toLocaleTimeString()}
                        </span>
                    )}
                </div>

                <div className={styles.formGroup}>
                    <label>VirusTotal API Key</label>
                    <input
                        id="vt-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your VirusTotal v3 API key…"
                        value={draft.vt_api_key || ''}
                        onChange={set('vt_api_key')}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Free tier: 4 lookups/min · 500/day · <a href="https://www.virustotal.com/gui/my-apikey" target="_blank" rel="noreferrer">Get key ↗</a></span>
                </div>

                <div className={styles.formGroup}>
                    <label>AbuseIPDB API Key</label>
                    <input
                        id="abuseipdb-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your AbuseIPDB API key…"
                        value={draft.abuseipdb_api_key || ''}
                        onChange={set('abuseipdb_api_key')}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Free tier: 1,000 checks/day · <a href="https://www.abuseipdb.com/account/api" target="_blank" rel="noreferrer">Get key ↗</a></span>
                </div>

                <div className={styles.formGroup}>
                    <label>AlienVault OTX API Key</label>
                    <input
                        id="otx-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your OTX API key…"
                        value={draft.alienvault_api_key || ''}
                        onChange={set('alienvault_api_key')}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Free · No limits · <a href="https://otx.alienvault.com/api" target="_blank" rel="noreferrer">Get key ↗</a></span>
                </div>

                <div className={styles.formGroup}>
                    <label>NVD API Key</label>
                    <input
                        id="nvd-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your NVD API key…"
                        value={draft.nvd_api_key || ''}
                        onChange={set('nvd_api_key')}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Increases limit from 5 to 50 requests/min · <a href="https://nvd.nist.gov/developers/request-an-api-key" target="_blank" rel="noreferrer">Get key ↗</a></span>
                </div>

                <div className={styles.formGroup}>
                    <label>GitHub API Key (for WinGet)</label>
                    <input
                        id="github-api-key"
                        type="password"
                        className={styles.input}
                        placeholder="Enter your GitHub PAT…"
                        value={draft.github_api_key || ''}
                        onChange={set('github_api_key')}
                        autoComplete="off"
                    />
                    <span className={styles.hint}>Avoids rate limits for Application Hash Lookup · <a href="https://github.com/settings/tokens/new?description=TealHunt&scopes=" target="_blank" rel="noreferrer">Get key ↗</a></span>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                    <button
                        className={styles.btnPrimary}
                        onClick={handleSaveApiKeys}
                        disabled={saving}
                        id="save-api-keys-btn"
                    >
                        {saving ? 'Saving…' : 'Save API Keys'}
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keys are stored encrypted in the database.</span>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <div className={styles.statusHealthy}><CheckCircle size={14} /> CISA KEV Feed Active</div>
                    <div className={styles.statusHealthy} style={{ marginTop: '8px' }}><CheckCircle size={14} /> NVD Database Synced</div>
                </div>
            </div>

            {/* ── Telegram / Notifications ── */}
            <div className={styles.card}>
                <h4><Shield size={14} /> Notification Integration</h4>
                <div className={styles.formGroup}>
                    <label>Telegram Bot Token</label>
                    <input
                        type="password"
                        className={styles.input}
                        placeholder="Telegram Bot Token"
                        value={draft.telegram_bot_token || ''}
                        onChange={set('telegram_bot_token')}
                        autoComplete="off"
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
                            value={draft.telegram_chat_id || ''}
                            onChange={set('telegram_chat_id')}
                        />
                        <button
                            className={styles.btnSecondary}
                            style={{ height: '38px', padding: '0 12px', whiteSpace: 'nowrap' }}
                            onClick={async () => {
                                try {
                                    await axios.post(`/api/users/profile/test-telegram?chatId=${draft.telegram_chat_id}`);
                                    toast.success('Global test message sent!');
                                } catch (err) {
                                    toast.error(err.response?.data || 'Global test failed');
                                }
                            }}
                        >
                            Test
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
                        <input type="number" className={styles.input} value={draft.notify_min_severity || '7'} onChange={set('notify_min_severity')} />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Min Confidence (%)</label>
                        <input type="number" className={styles.input} value={draft.notify_min_confidence || '70'} onChange={set('notify_min_confidence')} />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Max Alerts / Day</label>
                        <input type="number" className={styles.input} value={draft.notify_max_per_day || '5'} onChange={set('notify_max_per_day')} />
                    </div>
                </div>
                <span className={styles.hint}>Thresholds for automated Telegram alerts.</span>
                <div style={{ marginTop: '12px' }}>
                    <button className={styles.btnPrimary} onClick={handleSaveNotifications} disabled={saving} id="save-notifications-btn">
                        {saving ? 'Saving…' : 'Save Notification Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SecuritySettings = ({ currentUser }) => {
    const isSuperAdmin = currentUser?.roles?.includes('super_admin');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    
    // Create User State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', userName: '', password: '', role: 'analyst' });
    const [createLoading, setCreateLoading] = useState(false);

    // Role options based on caller's privileges
    const roleOptions = isSuperAdmin
        ? [
            { value: 'analyst', label: 'Analyst' },
            { value: 'admin', label: 'Admin' },
            { value: 'super_admin', label: 'Super Admin' },
          ]
        : [
            { value: 'analyst', label: 'Analyst' },
          ];

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

    if (loading) return <SkeletonLoader />;

    return (
        <div className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Security & Access Control</h3>
                <button 
                    className={styles.btnPrimary} 
                    style={{ height: '32px', padding: '0 12px' }}
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    {isSuperAdmin ? 'Add User' : 'Add Analyst'}
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
                                                onClick={async () => {
                                                    if (window.confirm("Enforce MFA setup for this user?")) {
                                                        try {
                                                            await axios.post(`/api/admin/users/${u.id}/mfa/enforce`);
                                                            toast.success("MFA Enforced");
                                                            fetchUsers();
                                                        } catch { toast.error("Failed to enforce MFA"); }
                                                    }
                                                }}
                                                title="Enforce 2FA"
                                            >
                                                <Shield size={14} color="var(--warning)" />
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
                            options={roleOptions}
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
    const [slaHours, setSlaHours] = useState(48);
    const [health, setHealth] = useState(null);
    const [stats, setStats] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSavingSla, setIsSavingSla] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [healthRes, statsRes, slaRes, logsRes] = await Promise.all([
                    axios.get('/api/health').catch(() => ({ data: { status: 'Unknown' } })),
                    axios.get('/api/admin/users'),
                    axios.get('/api/settings/sla_threshold_hours').catch(() => ({ data: { value: '48' } })),
                    axios.get('/api/admin/audit-logs').catch(() => ({ data: [] }))
                ]);
                setHealth(healthRes.data?.status || 'Healthy');
                const users = statsRes.data || [];
                setStats({
                    total: users.length,
                    superAdmins: users.filter(u => u.roles?.includes('super_admin')).length,
                    admins: users.filter(u => u.roles?.includes('admin')).length,
                    analysts: users.filter(u => u.roles?.includes('analyst')).length,
                    mfaSecured: users.filter(u => u.mfaEnabled).length,
                    weakPasswords: users.filter(u => u.requiresPasswordChange || u.mfaEnforced).length,
                });
                setAuditLogs(logsRes.data || []);
                setSlaHours(parseInt(slaRes.data?.value || '48', 10));
            } catch { setHealth('Degraded'); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const saveSla = async () => {
        setIsSavingSla(true);
        try {
            await axios.put('/api/settings/sla_threshold_hours', { value: String(slaHours) });
            toast.success('Response SLA updated');
        } catch { toast.error('Failed to save SLA setting'); }
        finally { setIsSavingSla(false); }
    };

    if (loading) return <SkeletonLoader />;

    const healthColor = health === 'Healthy' ? 'var(--success)' : 'var(--warning)';

    return (
        <div className={styles.section}>
            <h3>System Administration</h3>

            {/* Platform Health */}
            <div className={styles.card}>
                <h4><Monitor size={14} /> Platform Health</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: healthColor, boxShadow: `0 0 8px ${healthColor}` }} />
                    <span style={{ fontWeight: 600, color: healthColor }}>{health}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>Backend API · Database · Ingestion Worker</span>
                </div>
                {stats && (
                    <div className={styles.grid3}>
                        <div className={styles.statBox}>
                            <span className={styles.statValue}>{stats.total}</span>
                            <span className={styles.statLabel}>Total Users</span>
                        </div>
                        <div className={styles.statBox}>
                            <span className={styles.statValue}>{stats.mfaSecured}</span>
                            <span className={styles.statLabel}>MFA Secured</span>
                        </div>
                        <div className={styles.statBox}>
                            <span className={styles.statValue}>{stats.total - stats.mfaSecured}</span>
                            <span className={styles.statLabel}>MFA Unprotected</span>
                        </div>
                        <div className={styles.statBox}>
                            <span className={styles.statValue}>{stats.superAdmins}</span>
                            <span className={styles.statLabel}>Super Admins</span>
                        </div>
                        <div className={styles.statBox}>
                            <span className={styles.statValue}>{stats.admins}</span>
                            <span className={styles.statLabel}>Admins</span>
                        </div>
                        <div className={styles.statBox}>
                            <span className={styles.statValue}>{stats.analysts}</span>
                            <span className={styles.statLabel}>Analysts</span>
                        </div>
                        <div className={styles.statBox}>
                            <span className={styles.statValue} style={{ color: stats.weakPasswords > 0 ? 'var(--color-danger)' : 'var(--success)' }}>{stats.weakPasswords}</span>
                            <span className={styles.statLabel}>Weak Security Setup</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Response Governance */}
            <div className={styles.card}>
                <h4><Clock size={14} /> Response Governance</h4>
                <div className={styles.formGroup}>
                    <label>Threat Response SLA (Hours)</label>
                    <input 
                        type="number" 
                        className={styles.input} 
                        value={slaHours} 
                        onChange={(e) => setSlaHours(parseInt(e.target.value, 10))} 
                    />
                    <span className={styles.hint}>Threshold for the "SLA BREACH" warning on pending threat cards.</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button className={styles.btnPrimary} onClick={saveSla} disabled={isSavingSla}>
                        {isSavingSla ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Audit Logs */}
            <div className={styles.card}>
                <h4><Lock size={14} /> System Audit Logs</h4>
                <div className={styles.tableWrapper} style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className={styles.userTable}>
                        <thead>
                            <tr><th>Time</th><th>Action</th><th>Details</th></tr>
                        </thead>
                        <tbody>
                            {auditLogs.length > 0 ? auditLogs.map(log => (
                                <tr key={log.id}>
                                    <td style={{ fontSize: '12px' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                    <td><span className={styles.badge}>{log.action}</span></td>
                                    <td style={{ fontSize: '13px' }}>{log.details}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan="3" style={{ textAlign: 'center' }}>No audit logs available.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Danger Zone */}
            <div className={`${styles.card} ${styles.dangerZone}`}>
                <h4>Emergency Protocol</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Destructive actions. Use with extreme caution. These cannot be undone.
                </p>
                <button className={styles.btnDanger} onClick={async () => {
                    if (window.confirm("Purge ALL threat intelligence from the database? This is irreversible.")) {
                        try { await axios.post('/api/settings/reset'); toast.success("System database reset successfully."); }
                        catch { toast.error("Reset denied — check permissions."); }
                    }
                }}>🗑️ Reset Threat Database</button>
            </div>
        </div>
    );
};

export default SettingsScreen;
