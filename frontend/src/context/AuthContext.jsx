/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Configure Axios defaults
    const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    axios.defaults.baseURL = rawBaseUrl.replace(/^"|"$/g, '').replace(/^'|'$/g, '');

    const login = (accessToken, newRefreshToken) => {
        setToken(accessToken);
        localStorage.setItem('token', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    };

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        delete axios.defaults.headers.common['Authorization'];
    }, []);

    const fetchProfile = useCallback(async () => {
        try {
            const res = await axios.get('/api/users/profile');
            setUser(res.data);
        } catch (error) {
            console.error("Failed to fetch profile", error);
            if (error.response?.status === 401) {
                logout();
            }
        } finally {
            setLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchProfile();
        } else {
            delete axios.defaults.headers.common['Authorization'];
            setLoading(false);
        }
    }, [token, fetchProfile]);

    // Global Axios Interceptor for 401 (Unauthorized) handling
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    console.warn("Session expired or revoked. Logging out...");
                    toast.error("Session expired or revoked. Please log in again.");
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => axios.interceptors.response.eject(interceptor);
    }, [logout]);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading, fetchProfile }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
