import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import styles from './LoginScreen.module.css';
import BrandLogo from '../components/common/BrandLogo';

const LoginScreen = () => {
    const { login, token } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [mfaCode, setMfaCode] = useState('');
    const [requiresMfa, setRequiresMfa] = useState(false);
    const [trustDevice, setTrustDevice] = useState(false);
    const [pwnedWarning, setPwnedWarning] = useState('');

    // Redirect if already authenticated
    useEffect(() => {
        if (token) navigate('/', { replace: true });
    }, [token, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setPwnedWarning('');
        setLoading(true);

        try {
            const res = await axios.post('/api/auth/login', { 
                usernameOrEmail: identifier, 
                password,
                mfaCode: requiresMfa ? mfaCode : null,
                trustDevice 
            });
            
            const { token, accessToken, AccessToken, refreshToken, RefreshToken, isPasswordPwned, IsPasswordPwned, message, Message } = res.data;
            const finalAccessToken = token || accessToken || AccessToken;
            const finalRefreshToken = refreshToken || RefreshToken;
            const finalIsPwned = isPasswordPwned || IsPasswordPwned;
            const finalMessage = message || Message;
            
            if (finalIsPwned) {
                console.warn(finalMessage);
                toast.error(finalMessage, { duration: 6000 });
            }

            if (!finalAccessToken) {
                const keys = Object.keys(res.data).join(', ');
                throw new Error(`Server returned success but no access token was found. Available keys: ${keys}`);
            }

            login(finalAccessToken, finalRefreshToken);
            
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });

        } catch (err) {
            console.error("Login failed:", err);
            
            if (err.response?.status === 403 && err.response?.data?.requiresMfa) {
                setRequiresMfa(true);
                toast.success("MFA Required. Please enter your code.");
                if (err.response.data.isPasswordPwned) {
                    console.warn("Security Warning: Compromised password detected.");
                }
            } else {
                const message = err.response?.data?.message || err.message || "Invalid credentials. Please try again.";
                setError(`Error: ${message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Floating Theme Toggle */}
            <button
                className={styles.pageThemeToggle}
                onClick={toggleTheme}
                aria-label="Toggle Theme"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <main className={styles.loginCard}>
                <BrandLogo size={64} className={styles.cardLogo} hideText />

                <h1 className={styles.title}>Secure Login</h1>
                <p className={styles.subtitle}>Access your real-time threat intelligence platform</p>

                {error && <div className={styles.error}>{error}</div>}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Username or Email</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter username or email"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                disabled={requiresMfa}
                                autoFocus
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
                                disabled={requiresMfa}
                            />
                            <button
                                type="button"
                                className={styles.passwordToggle}
                                onClick={() => setShowPassword(!showPassword)}
                                disabled={requiresMfa}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {requiresMfa && (
                        <div className={styles.formGroup} style={{ animation: 'slideDown 0.3s ease-out' }}>
                            <label className={styles.label}>MFA Verification Code</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="000000"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    required
                                    autoFocus
                                    maxLength={6}
                                />
                            </div>
                        </div>
                    )}

                    <div className={styles.trustDeviceGroup}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={trustDevice}
                                onChange={(e) => setTrustDevice(e.target.checked)}
                            />
                            <span>Trust this device for 24 hours</span>
                        </label>
                    </div>

                    <button type="submit" className={styles.submitButton} disabled={loading}>
                        {loading ? 'Authenticating...' : requiresMfa ? 'Verify & Sign In' : 'Sign In to Platform'}
                    </button>
                </form>

                <div className={styles.footerDetails}>
                    <div className={styles.line}></div>
                    <span>Secured Connection</span>
                    <div className={styles.line}></div>
                </div>
            </main>
        </div>
    );
};

export default LoginScreen;
