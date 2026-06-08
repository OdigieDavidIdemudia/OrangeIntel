const fs = require('fs');
let html = fs.readFileSync('privacy_raw.html', 'utf8');

// Clean up prompt
html = html.replace(/<USER_REQUEST>[\s\S]*add it\n\"/, '');
html = html.replace(/<\/USER_REQUEST>[\s\S]*/, '');

// Clean termly tags
html = html.replace(/<style>[\s\S]*?<\/style>/, '');
html = html.replace(/<span style=\"display: block;[^>]*url\(data:image\/svg\+xml;base64,PHN2Zy[^>]*><\/span>/, '');
html = html.replace(/<bdt[^>]*>/g, '').replace(/<\/bdt>/g, '');
html = html.replace(/ style=\"[^\"]*\"/g, '');
html = html.replace(/ data-custom-class=\"[^\"]*\"/g, '');
html = html.replace(/ class=\"[^\"]*\"/g, '');
html = html.replace(/ target=\"_blank\"/g, ' target=\"_blank\" rel=\"noreferrer\"');

// Fix the truncation artifact at the end
html = html.replace(/<truncated[^>]*>/, '');
html = html.replace(/NOTE: The output was truncated.*/, '');

const jsx = `import React from 'react';
import styles from './PrivacyPolicyScreen.module.css';
import { ShieldAlert } from 'lucide-react';

const PrivacyPolicyScreen = () => {
    const htmlContent = ${JSON.stringify(html)};

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.pageTitle}>
                    <ShieldAlert size={22} className={styles.titleIcon} />
                    <div>
                        <h1>Privacy Policy</h1>
                        <p className={styles.subtitle}>OrangeIntel Data Protection and Privacy Guidelines</p>
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
`;

fs.writeFileSync('frontend/src/screens/PrivacyPolicyScreen.jsx', jsx);
console.log('Fixed PrivacyPolicyScreen.jsx');
