import React, { useState } from 'react';
import Modal from '../common/Modal';
import styles from './AdvisoryMetaModal.module.css';

const AdvisoryMetaModal = ({ isOpen, onClose, onConfirm, initialData = {} }) => {
    const [formData, setFormData] = useState({
        preparedBy: initialData.preparedBy || '',
        reviewedBy: initialData.reviewedBy || '',
        date: new Date().toISOString().split('T')[0]
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleConfirm = () => {
        onConfirm(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Report Metadata">
            <div className={styles.container}>
                <p className={styles.hint}>Please provide the following details for the GTBank Threat Advisory document.</p>
                
                <div className={styles.field}>
                    <label>Prepared By</label>
                    <input 
                        type="text" 
                        name="preparedBy" 
                        value={formData.preparedBy} 
                        onChange={handleChange} 
                        placeholder="e.g. John Doe (SOC Analyst)"
                    />
                </div>

                <div className={styles.field}>
                    <label>Reviewed By</label>
                    <input 
                        type="text" 
                        name="reviewedBy" 
                        value={formData.reviewedBy} 
                        onChange={handleChange} 
                        placeholder="e.g. Jane Smith (CISO)"
                    />
                </div>

                <div className={styles.field}>
                    <label>Report Date</label>
                    <input 
                        type="date" 
                        name="date" 
                        value={formData.date} 
                        onChange={handleChange} 
                    />
                </div>

                <div className={styles.actions}>
                    <button className={styles.cancelButton} onClick={onClose}>Cancel</button>
                    <button 
                        className={styles.confirmButton} 
                        onClick={handleConfirm}
                        disabled={!formData.preparedBy || !formData.reviewedBy}
                    >
                        Generate Document
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AdvisoryMetaModal;
