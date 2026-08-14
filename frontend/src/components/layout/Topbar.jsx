import React from 'react';
import { Sun, Moon, Bell } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import styles from './Topbar.module.css';

const Topbar = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className={styles.topbar}>
            <div className={styles.left}>
                {/* Screen headers handle branding now */}
            </div>

            <div className={styles.right}>

                <button className={styles.iconButton} onClick={toggleTheme} aria-label="Toggle Theme">
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>
        </header>
    );
};

export default Topbar;
