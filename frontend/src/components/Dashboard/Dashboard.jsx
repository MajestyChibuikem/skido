import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { analysisAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  FaArrowRight,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHeartbeat,
  FaVideo,
  FaClipboardList,
  FaUpload,
} from 'react-icons/fa';
import { FaCow } from 'react-icons/fa6';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const MotionDiv = motion.div;

const statCards = [
  { key: 'total_cattle',    label: 'Total Cattle',    icon: FaCow,              accent: '#65E4CF', sub: 'registered' },
  { key: 'total_videos',    label: 'Videos Uploaded', icon: FaVideo,            accent: '#60a5fa', sub: 'analysed' },
  { key: 'suspected_cases', label: 'Suspected Cases', icon: FaExclamationTriangle, accent: '#f0b429', sub: 'need review' },
  { key: 'normal_cases',    label: 'Normal',          icon: FaCheckCircle,      accent: '#65E4CF', sub: 'cleared' },
];

const quickActions = [
  {
    to: '/upload',
    icon: FaUpload,
    title: 'Upload New Recording',
    desc: 'Analyse fresh herd movement and generate highlighted cow snapshots.',
    accent: '#65E4CF',
  },
  {
    to: '/history',
    icon: FaClipboardList,
    title: 'View Reports',
    desc: 'Check per-cow feedback and action plans from recent detections.',
    accent: '#60a5fa',
  },
  {
    to: '/cattle',
    icon: FaCow,
    title: 'Manage Cattle',
    desc: 'Add, edit, or review individual cattle records and their video history.',
    accent: '#a78bfa',
  },
];

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats]   = useState(null);
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
      <div className="dashboard-loading">
        <div className="dashboard-loading-spinner" />
        <span>Loading dashboard…</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard-error">
        <FaExclamationTriangle />
        <span>Failed to load dashboard data. Please refresh the page.</span>
      </div>
    );
  }

  const hasSuspected = stats.suspected_cases > 0;

  return (
    <div className="dashboard-page">
      {/* Greeting */}
      <MotionDiv
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="dashboard-greeting"
      >
        <div>
          <h1 className="dashboard-greeting-title">
            Welcome back{user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="dashboard-greeting-sub">
            Here is a clear overview of herd health and current lameness risk.
          </p>
        </div>
      </MotionDiv>

      {/* Priority alert strip */}
      <MotionDiv
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className={`dashboard-priority-strip${hasSuspected ? ' alert' : ''}`}
      >
        <div className="priority-left">
          <FaHeartbeat className="priority-icon" />
          <div>
            <strong>Priority Check</strong>
            <p>
              {hasSuspected
                ? `${stats.suspected_cases} suspected case${stats.suspected_cases !== 1 ? 's' : ''} need follow-up today.`
                : 'No suspected cases right now. Keep routine monitoring active.'}
            </p>
          </div>
        </div>
        <Link to="/history" className="priority-link">
          Open Reports <FaArrowRight />
        </Link>
      </MotionDiv>

      {/* Stat cards */}
      <div className="dashboard-stat-grid">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <MotionDiv
              key={card.key}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 * (i + 1) }}
              className="dashboard-stat-card"
              style={{ borderTop: `3px solid ${card.accent}` }}
            >
              <div className="dashboard-stat-icon-row">
                <Icon style={{ color: card.accent, fontSize: '1.35rem' }} />
              </div>
              <div className="dashboard-stat-value">{stats[card.key]}</div>
              <div className="dashboard-stat-label">{card.label}</div>
              <div className="dashboard-stat-sub">{card.sub}</div>
            </MotionDiv>
          );
        })}
      </div>

      {/* Quick actions */}
      <MotionDiv
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.55 }}
      >
        <div className="dashboard-section-title">Quick Actions</div>
        <div className="dashboard-action-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.to} to={action.to} className="dashboard-action-card">
                <div className="dashboard-action-icon" style={{ background: `${action.accent}18`, color: action.accent }}>
                  <Icon />
                </div>
                <div className="dashboard-action-body">
                  <strong>{action.title}</strong>
                  <p>{action.desc}</p>
                </div>
                <FaArrowRight className="dashboard-action-arrow" />
              </Link>
            );
          })}
        </div>
      </MotionDiv>
    </div>
  );
}

export default Dashboard;
