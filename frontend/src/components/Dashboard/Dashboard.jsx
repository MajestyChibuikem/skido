import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { analysisAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { FaArrowRight, FaCheckCircle, FaExclamationTriangle, FaHeartbeat, FaVideo } from 'react-icons/fa';
import { FaCow } from 'react-icons/fa6';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const MotionDiv = motion.div;

const statCards = [
  { key: 'total_cattle', label: 'Total Cattle', icon: FaCow, accent: '#65E4CF' },
  { key: 'total_videos', label: 'Videos Uploaded', icon: FaVideo, accent: '#60a5fa' },
  { key: 'suspected_cases', label: 'Suspected Cases', icon: FaExclamationTriangle, accent: '#f0b429' },
  { key: 'normal_cases', label: 'Normal', icon: FaCheckCircle, accent: '#65E4CF' },
];

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analysisAPI
      .dashboardStats()
      .then((res) => setStats(res.data))
      .catch((err) => console.error('Failed to load stats:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg text-red-400">Failed to load dashboard data.</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-[28px] lg:text-[36px] font-extrabold mb-1" style={{ color: '#65E4CF' }}>
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Here is a clear overview of herd health and current lameness risk.
        </p>
      </MotionDiv>

      <MotionDiv
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="dashboard-priority-strip"
      >
        <div className="priority-left">
          <FaHeartbeat />
          <div>
            <strong>Priority Check</strong>
            <p>
              {stats.suspected_cases > 0
                ? `${stats.suspected_cases} suspected case(s) need follow-up today.`
                : 'No suspected cases right now. Keep routine monitoring active.'}
            </p>
          </div>
        </div>
        <Link to="/history" className="priority-link">
          Open Reports <FaArrowRight />
        </Link>
      </MotionDiv>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <MotionDiv
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * (i + 1) }}
              className="dashboard-stat-card"
              style={{
                borderLeft: `4px solid ${card.accent}`,
              }}
            >
              <div className="dashboard-stat-icon-row">
                <Icon className="text-2xl" style={{ color: card.accent }} />
              </div>
              <div className="text-[32px] font-extrabold" style={{ color: '#e0e0e0' }}>
                {stats[card.key]}
              </div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{card.label}</div>
            </MotionDiv>
          );
        })}
      </div>

      <div className="dashboard-action-grid">
        <Link to="/upload" className="dashboard-action-card">
          <FaVideo />
          <div>
            <strong>Upload New Recording</strong>
            <p>Analyze fresh herd movement and generate highlighted cow snapshots.</p>
          </div>
        </Link>
        <Link to="/history" className="dashboard-action-card">
          <FaExclamationTriangle />
          <div>
            <strong>Review Recommendations</strong>
            <p>Check per-cow feedback and action plans from recent detections.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default Dashboard;
