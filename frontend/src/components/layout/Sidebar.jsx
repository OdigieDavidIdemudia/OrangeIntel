import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, FileText, FileBarChart, Settings, Shield, LogOut, Monitor, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/logo.png" alt="OrangeIntel Logo" className={styles.logo} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className={styles.appName}><span className={styles.brandOrange}>Orange</span>Intel</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '400' }}>Threat Intelligence Platform</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.sectionTitle}>Intelligence</div>

        <NavLink to="/dashboard" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/threats" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <Activity size={20} />
          <span>Threat Queue</span>
        </NavLink>

        <NavLink to="/advisories" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <AlertTriangle size={20} />
          <span>Threat Advisories</span>
        </NavLink>

        <NavLink to="/reports" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <FileText size={20} />
          <span>Reports</span>
        </NavLink>

        <a
          href="/monitor"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.navItem}
          onClick={(e) => {
            e.preventDefault();
            window.open('/monitor', '_blank', 'noopener,noreferrer');
          }}
        >
          <Monitor size={20} />
          <span>SOC Wallboard</span>
        </a>

        <div className={styles.sectionTitle} style={{ marginTop: '2rem' }}>System</div>

        <NavLink to="/settings" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>

        {user?.roles?.includes('SuperAdmin') && (
          <>
            <div className={styles.sectionTitle} style={{ marginTop: '2rem' }}>Administration</div>
            <NavLink to="/admin" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
              <Shield size={20} />
              <span>Admin Dashboard</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {getInitials(user?.email)}
          </div>
          <div className={styles.userDetails}>
            <span className={styles.userName}>
              {user?.email?.split('@')[0] || 'User'}
            </span>
            <span className={styles.userRole} style={{ textTransform: 'capitalize' }}>
              {user?.roles?.map(r => r.replace(/_/g, ' ')).join(', ') || 'Analyst'}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className={styles.logoutButton}
          title="Sign Out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
