import React from 'react';
import styles from './PrivacyPolicyScreen.module.css';
import { ShieldAlert } from 'lucide-react';

const PrivacyPolicyScreen = () => {
    const htmlContent = "\n      <spanbody_text\"><span><span><span><span><span><span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></li></ul><div><span><span><span></span></span></span></span></span></span></span></span></span></span></span></span></li></ul><div><span><span><span></span></span></span></div><ul><li><span><span><span><strong>To respond to user inquiries/offer support to users. </strong>We may process your information to respond to your inquiries and solve any potential issues you might have with the requested service.</span></span></span></li></ul><div><span></span></span></span></span></span></span></li></ul><div><span></span></span></span></span></span></span></span></span></span></li></ul><div><span></bd\n\n\n";

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.pageTitle}>
                    <ShieldAlert size={22} className={styles.titleIcon} />
                    <div>
                        <h1>Privacy Policy</h1>
                        <p className={styles.subtitle}>TealHunt Data Protection and Privacy Guidelines</p>
                    </div>
                </div>
            </div>
            <div className={styles.contentContainer}>
                <div 
                  className={styles.documentBody}
                  dangerouslySetInnerHTML={{ __html: htmlContent }} 
                />
            </div>
        </div>
    );
};

export default PrivacyPolicyScreen;
