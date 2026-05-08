import React from 'react';
import Modal from '../common/Modal';
import { FileText, Database, ArrowRight } from 'lucide-react';
import styles from './ReportModal.module.css';

const ReportModal = ({ isOpen, onClose, onSelect }) => {
    const options = [
        {
            id: 'advisory',
            title: 'GTBank Advisory (Formatted)',
            description: 'Structured DOCX report following the official GTBank threat advisory template.',
            icon: <FileText className={styles.orangeIcon} />,
            primary: true
        },
        {
            id: 'raw',
            title: 'Raw Data Export',
            description: 'A basic data export containing all fields without custom GTBank formatting.',
            icon: <Database className={styles.grayIcon} />,
            primary: false
        }
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Report Type">
            <div className={styles.container}>
                <p className={styles.subtitle}>Choose how you want to generate this intelligence product.</p>
                
                <div className={styles.optionsList}>
                    {options.map(opt => (
                        <button 
                            key={opt.id} 
                            className={`${styles.optionCard} ${opt.primary ? styles.primaryCard : ''}`}
                            onClick={() => onSelect(opt.id)}
                        >
                            <div className={styles.optionIcon}>{opt.icon}</div>
                            <div className={styles.optionContent}>
                                <h4>{opt.title}</h4>
                                <p>{opt.description}</p>
                            </div>
                            <ArrowRight className={styles.arrow} size={18} />
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

export default ReportModal;
