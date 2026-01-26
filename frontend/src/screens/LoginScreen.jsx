import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, Shield, ShieldCheck, Lock, Globe, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import styles from './LoginScreen.module.css';

const LoginScreen = () => {
    const { login, token } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // MFA State
    const [requiresMfa, setRequiresMfa] = useState(false);
    const [mfaCode, setMfaCode] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Redirect if already authenticated
    useEffect(() => {
        if (token) navigate('/', { replace: true });
    }, [token, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = {
                email,
                password,
                ...(requiresMfa && { mfaCode })
            };

            const res = await axios.post('/api/auth/login', payload);
            const { accessToken, refreshToken } = res.data;

            login(accessToken, refreshToken);
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });

        } catch (err) {
            console.error("Login failed:", err);
            // Handle MFA challenge specifically if API returns 403 Forbidden with specific flag
            // (Assumes backend structure supports this, otherwise standardized error)
            if (err.response?.status === 403 && err.response.data?.requiresMfa) {
                setRequiresMfa(true);
                setError('');
            } else {
                setError(err.response?.data?.message || 'Authentication failed. Please check credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Top Navigation / Header */}
            <nav className={styles.topNav}>
                <div className={styles.brand}>
                    <img src="/logo.png" alt="OrangeIntel" className={styles.brandLogo} />
                    <span><span className={styles.brandOrange}>Orange</span>Intel</span>
                </div>
                <div className={styles.navActions}>
                    <button
                        className={styles.themeToggle}
                        onClick={toggleTheme}
                        aria-label="Toggle Theme"
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button className={styles.navButton}>Support</button>
                    <button className={styles.primaryNavButton}>Contact Sales</button>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className={styles.main}>
                <div className={styles.loginCard}>
                    <img src="/logo.png" alt="Logo" className={styles.cardLogo} />

                    <h1 className={styles.title}>Secure Login</h1>
                    <p className={styles.subtitle}>Access your real-time threat intelligence platform</p>

                    {error && <div className={styles.error}>{error}</div>}

                    <form onSubmit={handleSubmit} className={styles.form}>
                        {!requiresMfa ? (
                            <>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Email Address</label>
                                    <div className={styles.inputWrapper}>
                                        <input
                                            type="email"
                                            className={styles.input}
                                            placeholder="analyst@orange-intel.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <div className={styles.labelRow}>
                                        <label className={styles.label}>Password</label>
                                        <a href="#" className={styles.forgotLink}>Forgot?</a>
                                    </div>
                                    <div className={styles.inputWrapper}>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className={styles.input}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className={styles.passwordToggle}
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className={styles.formGroup}>
                                <div className={styles.mfaBox}>
                                    <div className={styles.mfaLabel}>
                                        <ShieldCheck size={16} /> Multi-Factor Auth
                                    </div>
                                    <input
                                        type="text"
                                        className={styles.mfaInput}
                                        value={mfaCode}
                                        onChange={(e) => setMfaCode(e.target.value)}
                                        placeholder="000000"
                                        maxLength={6}
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <button type="submit" className={styles.submitButton} disabled={loading}>
                            {loading ? 'Authenticating...' : (requiresMfa ? 'Verify Code' : 'Sign In to Platform')}
                        </button>
                    </form>

                    <div className={styles.footerDetails}>
                        <div className={styles.line}></div>
                        <span>Secured Connection</span>
                        <div className={styles.line}></div>
                    </div>
                </div>
            </main>

            {/* Sticky Footer */}
            <footer className={styles.pageFooter}>
                <div className={styles.badges}>
                    <div className={styles.badge}><Lock size={14} /> AES-256 Protocol</div>
                    <div className={styles.badge}><Shield size={14} /> SOC2 Compliant</div>
                    <div className={styles.badge}><Globe size={14} /> Global Nodes</div>
                </div>
                <div className={styles.links}>
                    <a href="#" className={styles.footerLink}>Privacy Policy</a>
                    <a href="#" className={styles.footerLink}>Terms of Service</a>
                    <span>© 2026 OrangeIntel Inc.</span>
                </div>
            </footer>
        </div>
    );
};

export default LoginScreen;
