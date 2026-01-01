import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, FileText, FileBarChart, Settings, Shield } from 'lucide-react';
import styles from './Sidebar.module.css';

const Sidebar = () => {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/logo.png" alt="OrangeIntel Logo" className={styles.logo} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className={styles.appName}>OrangeIntel</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '400' }}>Threat Intelligence Platform</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.sectionTitle}>Intelligence</div>

        <NavLink to="/topics" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <LayoutDashboard size={20} />
          <span>Topics</span>
        </NavLink>

        <NavLink to="/advisories" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <AlertTriangle size={20} />
          <span>Threat Advisories</span>
        </NavLink>

        <NavLink to="/assessments" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <Shield size={20} />
          <span>Threat Assessments</span>
        </NavLink>

        <NavLink to="/reports" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <FileText size={20} />
          <span>Reports</span>
        </NavLink>

        <div className={styles.sectionTitle} style={{ marginTop: '2rem' }}>System</div>

        <NavLink to="/admin" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
          <Settings size={20} />
          <span>Administration</span>
        </NavLink>
      </nav>

      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>JD</div>
          <div className={styles.userDetails}>
            <span className={styles.userName}>Jane Doe</span>
            <span className={styles.userRole}>Senior Analyst</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
