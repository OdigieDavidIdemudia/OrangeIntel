import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import styles from './ForceMfaSetup.module.css';
import { ShieldAlert, LogOut, CheckCircle } from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo';

const ForceMfaSetup = () => {
    const { logout, fetchProfile } = useAuth();
    const [mfaData, setMfaData] = useState({ secret: '', qrCodeUri: '' });
    const [mfaCode, setMfaCode] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchSetup = async () => {
            try {
                const res = await axios.post('/api/auth/mfa/setup');
                setMfaData(res.data);
            } catch (err) {
                console.error("Failed to fetch MFA setup details", err);
                toast.error("Failed to initiate secure setup. Please log in again.");
            }
        };
        fetchSetup();
    }, []);

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!mfaCode || mfaCode.length < 6) return;
        
        setLoading(true);
        try {
            await axios.post('/api/auth/mfa/verify', { secret: mfaData.secret, code: mfaCode });
            toast.success("Security enhanced! 2FA is now enabled.");
            // Fetch profile to update user state and unblock the app!
            await fetchProfile();
        } catch (err) {
            console.error("Verification failed", err);
            toast.error("Invalid verification code. Please try again.");
            setMfaCode('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <main className={styles.card}>
                <BrandLogo size={48} className={styles.cardLogo} hideText />
                
                <div className={styles.iconWrapper}>
                    <ShieldAlert size={48} className={styles.icon} />
                </div>
                
                <h1 className={styles.title}>Security Action Required</h1>
                <p className={styles.subtitle}>
                    Your administrator has mandated Two-Factor Authentication (2FA) for your account. You must set this up before accessing the platform.
                </p>

                {mfaData.qrCodeUri ? (
                    <div className={styles.setupSection}>
                        <ol className={styles.instructions}>
                            <li>Download an authenticator app (e.g., Google Authenticator, Authy).</li>
                            <li>Scan the QR code below:</li>
                        </ol>
                        
                        <div className={styles.qrContainer}>
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mfaData.qrCodeUri)}`} alt="MFA QR Code" />
                        </div>

                        <p className={styles.secretText}>
                            Or enter this code manually: <code>{mfaData.secret}</code>
                        </p>

                        <form onSubmit={handleVerify} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Verification Code</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Enter 6-digit code"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    maxLength={6}
                                    required
                                    autoFocus
                                />
                            </div>
                            <button type="submit" className={styles.verifyButton} disabled={loading || mfaCode.length < 6}>
                                {loading ? 'Verifying...' : 'Verify and Continue'}
                                {!loading && <CheckCircle size={18} />}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className={styles.loadingState}>
                        Generating secure tokens...
                    </div>
                )}

                <div className={styles.footer}>
                    <button type="button" onClick={logout} className={styles.logoutButton}>
                        <LogOut size={16} /> Logout Instead
                    </button>
                </div>
            </main>
        </div>
    );
};

export default ForceMfaSetup;
