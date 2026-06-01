import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { FiUpload, FiActivity, FiAlertTriangle, FiCheckCircle, FiChevronRight, FiClock } from 'react-icons/fi';
import { analysisAPI, recordingsAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

const ease = [0.25, 0.1, 0.25, 1];
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease, delay },
});

function StatCard({ icon: Icon, value, label, sub, color, delay }) {
  return (
    <motion.div className="dash-stat-card" {...fadeUp(delay)}>
      <div className="dash-stat-icon" style={{ background: color + '18', color }}>
        <Icon size={18} />
      </div>
      <div className="dash-stat-value">{value ?? '—'}</div>
      <div className="dash-stat-label">{label}</div>
      {sub && <div className="dash-stat-sub">{sub}</div>}
    </motion.div>
  );
}

function SnapshotCard({ animal, recording }) {
  const snapshotUrl = animal.snapshot_filename
    ? recordingsAPI.snapshotUrl(animal.snapshot_filename)
    : null;
  const conf = animal.snapshot_confidence != null
    ? `${Math.round(animal.snapshot_confidence * 100)}% conf`
    : null;
  const ts = animal.snapshot_frame_sec != null
    ? `${Math.floor(animal.snapshot_frame_sec / 60).toString().padStart(2,'0')}:${(animal.snapshot_frame_sec % 60).toFixed(1).padStart(4,'0')}s`
    : null;

  return (
    <Link to="/history" className="dash-snap-card">
      <div className="dash-snap-img-wrap">
        {snapshotUrl ? (
          <img src={snapshotUrl} alt={`Animal ${animal.animal_index}`} className="dash-snap-img" />
        ) : (
          <div className="dash-snap-placeholder">
            <FiActivity size={28} style={{ color: 'var(--text-3)' }} />
          </div>
        )}
        <span className={`status-pill ${animal.status} dash-snap-badge`}>
          {animal.status}
        </span>
      </div>
      <div className="dash-snap-meta">
        <div className="dash-snap-title">Animal {animal.animal_index}</div>
        <div className="dash-snap-detail">
          <span>Score {animal.lameness_score?.toFixed(1)}/10</span>
          {conf && <span>·</span>}
          {conf && <span>{conf}</span>}
        </div>
        {ts && <div className="dash-snap-ts"><FiClock size={10} /> {ts}</div>}
        <div className="dash-snap-date">{new Date(recording.upload_date).toLocaleDateString()}</div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentAnimals, setRecentAnimals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analysisAPI.dashboardStats(),
      recordingsAPI.list(),
    ]).then(([statsRes, recRes]) => {
      setStats(statsRes.data);
      const animals = [];
      for (const rec of recRes.data.slice(0, 10)) {
        for (const a of rec.animals) {
          animals.push({ animal: a, recording: rec });
        }
      }
      animals.sort((a, b) => b.animal.lameness_score - a.animal.lameness_score);
      setRecentAnimals(animals.slice(0, 6));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-spinner" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="dash-page">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="dash-header">
        <div>
          <h1 className="dash-greeting">{greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.</h1>
          <p className="dash-sub">AI-powered cattle lameness detection</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="btn btn-teal dash-upload-btn"
          onClick={() => navigate('/upload')}
        >
          <FiUpload size={15} /> Upload Recording
        </motion.button>
      </motion.div>

      {/* Stats */}
      <div className="dash-stat-grid">
        <StatCard icon={FiActivity}       value={stats?.total_analyses}  label="Analyses"   sub="total runs"          color="var(--teal-dark)"   delay={0.06} />
        <StatCard icon={FiAlertTriangle}  value={stats?.suspected_cases} label="Detected"   sub="suspected + confirmed" color="var(--orange-dark)" delay={0.10} />
        <StatCard icon={FiCheckCircle}    value={stats?.normal_cases}    label="Normal"     sub="no lameness found"   color="var(--teal-dark)"   delay={0.14} />
      </div>

      {/* Recent detections */}
      <motion.div {...fadeUp(0.18)}>
        <div className="dash-section-header">
          <span className="dash-section-title">Recent detections</span>
          <Link to="/history" className="dash-see-all">See all <FiChevronRight size={13} /></Link>
        </div>

        {recentAnimals.length === 0 ? (
          <div className="dash-empty">
            <FiActivity size={32} />
            <p>No analyses yet. Upload a herd recording to get started.</p>
            <Link to="/upload" className="btn btn-teal">Upload Recording</Link>
          </div>
        ) : (
          <div className="dash-snap-grid">
            {recentAnimals.map(({ animal, recording }, i) => (
              <motion.div key={animal.id} {...fadeUp(0.2 + i * 0.04)}>
                <SnapshotCard animal={animal} recording={recording} />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
