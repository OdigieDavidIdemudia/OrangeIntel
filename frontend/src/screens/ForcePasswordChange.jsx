import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import styles from './ForceMfaSetup.module.css'; // Reuse the same full-screen styles
import { KeyRound, LogOut, CheckCircle, Eye, EyeOff } from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo';

const ForcePasswordChange = () => {
    const { logout, fetchProfile } = useAuth();
    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [loading, setLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (form.newPassword !== form.confirmPassword) {
            toast.error('New passwords do not match.');
            return;
        }
        if (form.newPassword.length < 12) {
            toast.error('New password must be at least 12 characters.');
            return;
        }
        if (form.newPassword === form.currentPassword) {
            toast.error('New password must be different from your current password.');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/users/change-password', {
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
            });
            toast.success('Password updated successfully. Welcome to OrangeIntel!');
            // Re-fetch profile — RequiresPasswordChange is now false, gate will lift
            await fetchProfile();
        } catch (err) {
            const msg = err.response?.data?.[0]?.description
                || err.response?.data
                || 'Password change failed. Check your current password.';
            toast.error(typeof msg === 'string' ? msg : 'Password change failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <main className={styles.card}>
                <BrandLogo size={48} className={styles.cardLogo} hideText />

                <div className={styles.iconWrapper}>
                    <KeyRound size={48} className={styles.icon} />
                </div>

                <h1 className={styles.title}>Set Your Password</h1>
                <p className={styles.subtitle}>
                    Your account was provisioned with a temporary password. You must set a new personal password before accessing OrangeIntel.
                </p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Temporary / Current Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                className={styles.input}
                                placeholder="Enter the password you were given"
                                value={form.currentPassword}
                                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                                required
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent(v => !v)}
                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                className={styles.input}
                                placeholder="Minimum 12 characters"
                                value={form.newPassword}
                                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                                required
                                minLength={12}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(v => !v)}
                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                            Must be at least 12 characters · Use a mix of letters, numbers &amp; symbols
                        </span>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Confirm New Password</label>
                        <input
                            type="password"
                            className={styles.input}
                            placeholder="Re-enter your new password"
                            value={form.confirmPassword}
                            onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className={styles.verifyButton}
                        disabled={loading || !form.currentPassword || !form.newPassword || !form.confirmPassword}
                    >
                        {loading ? 'Updating...' : 'Set Password & Continue'}
                        {!loading && <CheckCircle size={18} />}
                    </button>
                </form>

                <div className={styles.footer}>
                    <button type="button" onClick={logout} className={styles.logoutButton}>
                        <LogOut size={16} /> Logout Instead
                    </button>
                </div>
            </main>
        </div>
    );
};

export default ForcePasswordChange;
