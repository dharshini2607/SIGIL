import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

axios.defaults.withCredentials = true;

const API_URL = 'http://localhost:8000/api/v1';

export const AuthContext = createContext();
export const useAuth = () => React.useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const resInterceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && error.response.status === 401) {
                    setUser(null);
                    navigate('/login');
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(resInterceptor);
    }, [navigate]);

    useEffect(() => {
        axios.get(`${API_URL}/auth/me`)
            .then(res => {
                setUser(res.data);
                setLoading(false);
            })
            .catch(err => {
                setUser(null);
                setLoading(false);
            });
    }, []);

    const login = async (username, password) => {
        try {
            const res = await axios.post(`${API_URL}/auth/login`, { username, password });
            if (res.data.access_token) {
                const me = await axios.get(`${API_URL}/auth/me`);
                setUser(me.data);
                navigate('/');
                return { success: true };
            }
        } catch (err) {
            return { success: false, error: err.response?.data?.detail || 'Authentication failed' };
        }
    };

    const logout = async () => {
        try {
            await axios.post(`${API_URL}/auth/logout`);
        } catch (e) { }
        setUser(null);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
