import React, { useState, useRef } from 'react';
import { Search, Upload, Download, AlertTriangle, CheckCircle, Clock, Loader2, ChevronDown, ChevronUp, Trash2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import styles from './IocLookupScreen.module.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ── Helpers ──────────────────────────────────────────────────────────────────
const getRiskLabel = (score) => {
  if (score >= 80) return { label: 'Critical', cls: 'critical' };
  if (score >= 60) return { label: 'High', cls: 'high' };
  if (score >= 30) return { label: 'Medium', cls: 'medium' };
  if (score > 0)   return { label: 'Low', cls: 'low' };
  return { label: 'Clean', cls: 'clean' };
};

const getTypeIcon = (type) => {
  const icons = { IP: '🌐', Domain: '🔗', Hash: '#️⃣', URL: '📎', CVE: '🛡️', Unknown: '❓' };
  return icons[type] || '❓';
};

// ── Sub-components ────────────────────────────────────────────────────────────
const RiskBadge = ({ score }) => {
  const { label, cls } = getRiskLabel(score);
  return <span className={`${styles.riskBadge} ${styles[`risk_${cls}`]}`}>{label} — {score}</span>;
};

const ProviderCard = ({ provider }) => (
  <div className={`${styles.providerCard} ${provider.success ? styles.providerOk : styles.providerErr}`}>
    <div className={styles.providerHeader}>
      <span className={styles.providerName}>{provider.providerName}</span>
      {provider.success
        ? <CheckCircle size={14} className={styles.iconOk} />
        : <AlertTriangle size={14} className={styles.iconErr} />}
    </div>
    <p className={styles.providerMsg}>{provider.message || (provider.success ? 'No findings' : 'Query failed')}</p>
  </div>
);

const ResultRow = ({ result }) => {
  const [expanded, setExpanded] = useState(false);
  const { label, cls } = getRiskLabel(result.unifiedRiskScore);

  return (
    <div className={`${styles.resultRow} ${styles[`row_${cls}`]}`}>
      <div className={styles.resultMain} onClick={() => setExpanded(e => !e)}>
        <span className={styles.typeIcon}>{getTypeIcon(result.indicatorType)}</span>
        <div className={styles.resultMeta}>
          <span className={styles.indicatorValue}>{result.indicatorValue}</span>
          <span className={styles.indicatorType}>{result.indicatorType}</span>
        </div>
        <RiskBadge score={result.unifiedRiskScore} />
        {result.isCached && <span className={styles.cachedTag}><Clock size={12}/> Cached</span>}
        <button className={styles.expandBtn}>
          {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </button>
      </div>

      {expanded && (
        <div className={styles.resultDetails}>
          {result.message && <p className={styles.detailMsg}>{result.message}</p>}
          <div className={styles.providersGrid}>
            {(result.providerResults || []).map((p, i) => (
              <ProviderCard key={i} provider={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
const IocLookupScreen = () => {
  const { token } = useAuth();
  const [singleInput, setSingleInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(null); // { total, current, malicious, suspicious, clean, status, waitTime }
  const fileRef = useRef();

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const handleSingleLookup = async () => {
    const indicator = singleInput.trim();
    if (!indicator) return toast.error('Enter an indicator to look up.');
    setLoading(true);
    setResults([]);
    setProgress(null);
    try {
      const res = await fetch(`${API_BASE}/api/ioc/enrich`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ indicator }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults([data]);
    } catch (err) {
      toast.error(`Lookup failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkLookup = async () => {
    const raw = bulkInput.trim();
    if (!raw) return toast.error('Enter at least one indicator.');
    const indicators = raw.split('\n').map(s => s.trim()).filter(Boolean);
    if (indicators.length === 0) return toast.error('No valid indicators found.');

    setLoading(true);
    setResults([]);
    setProgress({ total: indicators.length, current: 0, malicious: 0, suspicious: 0, clean: 0, status: 'Processing', waitTime: 0 });

    try {
      const BATCH_SIZE = 4;
      let newResults = [];
      let counts = { malicious: 0, suspicious: 0, clean: 0 };

      for (let i = 0; i < indicators.length; i += BATCH_SIZE) {
        const batch = indicators.slice(i, i + BATCH_SIZE);
        
        setProgress(p => ({ ...p, status: 'Processing' }));
        
        const batchPromises = batch.map(ind => 
          fetch(`${API_BASE}/api/ioc/enrich`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ indicator: ind }),
          }).then(async r => {
            if (!r.ok) throw new Error('API Error');
            return r.json();
          }).catch(err => ({ 
            indicatorValue: ind, 
            indicatorType: 'Unknown', 
            unifiedRiskScore: 0, 
            success: false, 
            message: err.message 
          }))
        );

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(r => {
           if (r.unifiedRiskScore >= 60) counts.malicious++;
           else if (r.unifiedRiskScore >= 30) counts.suspicious++;
           else counts.clean++;
        });

        newResults = [...newResults, ...batchResults];
        setResults(newResults);
        
        setProgress(p => ({ 
          ...p, 
          current: Math.min(i + BATCH_SIZE, indicators.length), 
          ...counts 
        }));

        if (i + BATCH_SIZE < indicators.length) {
            // Rate limit wait - 60s for VirusTotal free tier
            for(let w = 60; w > 0; w--) {
               setProgress(p => ({ ...p, status: 'Waiting', waitTime: w }));
               await new Promise(r => setTimeout(r, 1000));
            }
        }
      }
      setProgress(p => ({ ...p, status: 'Done', waitTime: 0 }));
      toast.success('Bulk enrichment completed!');
    } catch (err) {
      toast.error(`Bulk lookup failed: ${err.message}`);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBulkInput(ev.target.result);
      setMode('bulk');
    };
    reader.readAsText(file);
  };

  const exportCsv = () => {
    if (results.length === 0) return;
    const rows = [['Indicator', 'Type', 'Risk Score', 'Risk Level', 'Cached', 'Queried At']];
    results.forEach(r => {
      rows.push([
        r.indicatorValue,
        r.indicatorType,
        r.unifiedRiskScore,
        getRiskLabel(r.unifiedRiskScore).label,
        r.isCached ? 'Yes' : 'No',
        new Date(r.queriedAt).toISOString(),
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ioc_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported.');
  };

  const clearResults = () => { setResults([]); setProgress(null); };

  const criticalCount = results.filter(r => r.unifiedRiskScore >= 80).length;
  const highCount = results.filter(r => r.unifiedRiskScore >= 60 && r.unifiedRiskScore < 80).length;
  const cleanCount = results.filter(r => r.unifiedRiskScore === 0).length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <ShieldAlert size={22} className={styles.titleIcon} />
          <div>
            <h1>IOC Enrichment Engine</h1>
            <p className={styles.subtitle}>Look up IPs, domains, hashes, URLs, and CVEs across VirusTotal, AbuseIPDB, and AlienVault OTX</p>
          </div>
        </div>

        {results.length > 0 && (
          <div className={styles.headerActions}>
            <button className={styles.btnSecondary} onClick={clearResults}>
              <Trash2 size={15}/> Clear
            </button>
            <button className={styles.btnPrimary} onClick={exportCsv}>
              <Download size={15}/> Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Mode Tabs */}
      <div className={styles.modeTabs}>
        <button className={`${styles.modeTab} ${mode === 'single' ? styles.modeTabActive : ''}`} onClick={() => setMode('single')}>
          Single Lookup
        </button>
        <button className={`${styles.modeTab} ${mode === 'bulk' ? styles.modeTabActive : ''}`} onClick={() => setMode('bulk')}>
          Bulk Lookup
        </button>
      </div>

      {/* Input Panel */}
      <div className={styles.inputPanel}>
        {mode === 'single' ? (
          <div className={styles.singleRow}>
            <input
              id="ioc-single-input"
              className={styles.searchInput}
              type="text"
              placeholder="Enter IP, domain, MD5/SHA1/SHA256 hash, URL, or CVE-ID…"
              value={singleInput}
              onChange={e => setSingleInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSingleLookup()}
            />
            <button className={styles.btnPrimary} onClick={handleSingleLookup} disabled={loading}>
              {loading ? <Loader2 size={16} className={styles.spin}/> : <Search size={16}/>}
              <span>{loading ? 'Looking up…' : 'Enrich'}</span>
            </button>
          </div>
        ) : (
          <div className={styles.bulkPanel}>
            <div className={styles.bulkToolbar}>
              <span className={styles.bulkHint}>One indicator per line · Max 50 · Rate-limited to 4/min for VirusTotal</span>
              <button className={styles.btnSecondary} onClick={() => fileRef.current?.click()}>
                <Upload size={14}/> Upload .txt / .csv
              </button>
              <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: 'none' }} onChange={handleFileUpload}/>
            </div>
            <textarea
              id="ioc-bulk-input"
              className={styles.bulkTextarea}
              placeholder={"8.8.8.8\nexample.com\n44d88612fea8a8f36de82e1278abb02f\nhttps://malware.example/payload.exe\nCVE-2021-44228"}
              value={bulkInput}
              onChange={e => setBulkInput(e.target.value)}
              rows={8}
            />
            <div className={styles.bulkFooter}>
              <span className={styles.lineCount}>
                {bulkInput.split('\n').filter(l => l.trim()).length} indicators
              </span>
              <button className={styles.btnPrimary} onClick={handleBulkLookup} disabled={loading}>
                {loading && progress?.status === 'Processing' ? <Loader2 size={16} className={styles.spin}/> : 
                 loading && progress?.status === 'Waiting' ? <Clock size={16} /> : <Search size={16}/>}
                <span>
                  {loading && progress?.status === 'Waiting' ? `Rate Limit: Wait ${progress.waitTime}s` :
                   loading ? 'Processing…' : 'Run Bulk Lookup'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar (Bulk) */}
      {progress && (
        <div className={styles.progressContainer}>
          <div className={styles.progressHeader}>
            <span className={styles.progressTitle}>
              {progress.status === 'Done' ? 'Analysis Complete' : 'Analyzing Indicators...'}
            </span>
            <span className={styles.progressCount}>{progress.current} / {progress.total} Processed</span>
          </div>
          
          <div className={styles.progressBarBg}>
            <div 
              className={`${styles.progressBarFill} ${progress.status === 'Waiting' ? styles.progressPulse : ''}`} 
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>

          <div className={styles.progressStats}>
            <div className={`${styles.pStat} ${styles.pMalicious}`}>
              <span className={styles.pStatNum}>{progress.malicious}</span>
              <span className={styles.pStatLabel}>Malicious</span>
            </div>
            <div className={`${styles.pStat} ${styles.pSuspicious}`}>
              <span className={styles.pStatNum}>{progress.suspicious}</span>
              <span className={styles.pStatLabel}>Suspicious</span>
            </div>
            <div className={`${styles.pStat} ${styles.pClean}`}>
              <span className={styles.pStatNum}>{progress.clean}</span>
              <span className={styles.pStatLabel}>Clean / Benign</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats (when results present) */}
      {results.length > 0 && (
        <div className={styles.summaryRow}>
          <div className={styles.statBox}>
            <span className={styles.statNum}>{results.length}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={`${styles.statBox} ${styles.statCritical}`}>
            <span className={styles.statNum}>{criticalCount}</span>
            <span className={styles.statLabel}>Critical</span>
          </div>
          <div className={`${styles.statBox} ${styles.statHigh}`}>
            <span className={styles.statNum}>{highCount}</span>
            <span className={styles.statLabel}>High Risk</span>
          </div>
          <div className={`${styles.statBox} ${styles.statClean}`}>
            <span className={styles.statNum}>{cleanCount}</span>
            <span className={styles.statLabel}>Clean</span>
          </div>
        </div>
      )}

      {/* Results List */}
      {results.length > 0 && (
        <div className={styles.resultsList}>
          <div className={styles.resultsHeader}>
            <span>Results</span>
            <span className={styles.resultsCount}>{results.length} indicator{results.length !== 1 ? 's' : ''}</span>
          </div>
          {results.map((r, i) => <ResultRow key={`${r.indicatorValue}-${i}`} result={r} />)}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <ShieldAlert size={48} className={styles.emptyIcon} />
          <h3>No results yet</h3>
          <p>Enter an indicator above and click <strong>Enrich</strong> to query threat intelligence providers.</p>
          <div className={styles.providerBadges}>
            <span className={styles.provBadge}>🟢 VirusTotal</span>
            <span className={styles.provBadge}>🟡 AbuseIPDB</span>
            <span className={styles.provBadge}>🔵 AlienVault OTX</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default IocLookupScreen;
