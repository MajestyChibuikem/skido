import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { analysisAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { FaVideo, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { FaCow } from 'react-icons/fa6';

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
    <div>
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-[28px] lg:text-[36px] font-extrabold mb-1" style={{ color: '#65E4CF' }}>
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>Here's an overview of your herd</p>
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
              className="rounded-xl p-6"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderLeft: `4px solid ${card.accent}`,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <Icon className="text-2xl" style={{ color: card.accent }} />
              </div>
              <div className="text-[32px] font-extrabold" style={{ color: '#e0e0e0' }}>
                {stats[card.key]}
              </div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{card.label}</div>
            </MotionDiv>
          );
        })}
      </div>
    </div>
  );
}

export default Dashboard;
