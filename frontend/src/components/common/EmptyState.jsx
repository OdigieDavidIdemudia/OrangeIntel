import React from 'react';
import { CheckCircle } from 'lucide-react';
import styles from './EmptyState.module.css';

const EmptyState = ({ title, message, action }) => {
    return (
        <div className={styles.container}>
            <div className={styles.iconWrapper}>
                <CheckCircle size={48} className={styles.icon} />
            </div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.message}>{message}</p>
            {action && <div className={styles.action}>{action}</div>}
        </div>
    );
};

export default EmptyState;
