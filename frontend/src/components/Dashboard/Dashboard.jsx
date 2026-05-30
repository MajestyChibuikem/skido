import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FaUpload, FaClipboardList, FaArrowRight, FaCheckCircle,
  FaExclamationTriangle, FaVideo, FaHeartbeat,
} from 'react-icons/fa';
import { FaCow } from 'react-icons/fa6';
import { analysisAPI } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

const Mv = motion.div;

/* ── Donut chart (pure SVG) ─────────────────────────────────────────────── */
function DonutChart({ normal = 0, suspected = 0, confirmed = 0 }) {
  const total = normal + suspected + confirmed;
  if (total === 0) {
    return (
      <div className="donut-empty">
        <FaCow style={{ fontSize: '2rem', color: 'var(--text-muted)' }} />
        <span>No data yet</span>
      </div>
    );
  }

  const R = 56, CX = 72, CY = 72, STROKE = 14;
  const circ = 2 * Math.PI * R;

  const slices = [
    { value: normal,    color: '#65E4CF', label: 'Normal' },
    { value: suspected, color: '#f5a623', label: 'Suspected' },
    { value: confirmed, color: '#e74c3c', label: 'Confirmed' },
  ].filter(s => s.value > 0);

  let offset = 0;
  const arcs = slices.map(s => {
    const pct = s.value / total;
    const dash = circ * pct;
    const gap  = circ - dash;
    const arc  = { ...s, dash, gap, offset, pct };
    offset += dash;
    return arc;
  });

  return (
    <div className="donut-wrap">
      <svg width={CX * 2} height={CY * 2} viewBox={`0 0 ${CX * 2} ${CY * 2}`}>
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border-sub)" strokeWidth={STROKE} />
        {/* Slices */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth={STROKE}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset + circ / 4}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        ))}
        {/* Centre label */}
        <text x={CX} y={CY - 6} textAnchor="middle" fill="var(--text-pri)" fontSize="22" fontWeight="800">
          {total}
        </text>
        <text x={CX} y={CY + 13} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="600">
          ANIMALS
        </text>
      </svg>

      <div className="donut-legend">
        {[
          { label: 'Normal',    val: normal,    color: '#65E4CF' },
          { label: 'Suspected', val: suspected, color: '#f5a623' },
          { label: 'Confirmed', val: confirmed, color: '#e74c3c' },
        ].map(({ label, val, color }) => (
          <div key={label} className="donut-legend-row">
            <span className="donut-dot" style={{ background: color }} />
            <span className="donut-legend-label">{label}</span>
            <span className="donut-legend-val">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stat card ──────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, accent, sub, delay }) {
  return (
    <Mv
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="db-stat-card"
      style={{ '--accent': accent }}
    >
      <div className="db-stat-icon" style={{ background: `${accent}18`, color: accent }}>
        <Icon />
      </div>
      <div className="db-stat-val">{value}</div>
      <div className="db-stat-label">{label}</div>
      {sub && <div className="db-stat-sub">{sub}</div>}
    </Mv>
  );
}

/* ── Quick action ───────────────────────────────────────────────────────── */
function ActionCard({ to, icon: Icon, title, desc, accent }) {
  return (
    <Link to={to} className="db-action-card">
      <div className="db-action-icon" style={{ background: `${accent}18`, color: accent }}>
        <Icon />
      </div>
      <div className="db-action-body">
        <strong>{title}</strong>
        <p>{desc}</p>
      </div>
      <FaArrowRight className="db-action-arrow" />
    </Link>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analysisAPI.dashboardStats()
      .then(r => setStats(r.data))
      .catch(err => console.error('Stats:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="db-loading">
      <div className="db-spinner" />
      <span>Loading dashboard…</span>
    </div>
  );

  const s = stats || { total_cattle: 0, total_videos: 0, suspected_cases: 0, normal_cases: 0 };
  const hasSuspected = s.suspected_cases > 0;
  const normal    = s.normal_cases    ?? 0;
  const suspected = s.suspected_cases ?? 0;
  const confirmed = s.confirmed_cases ?? 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="db-page">
      {/* Greeting */}
      <Mv initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="db-greeting">
          <div>
            <h1>{greeting()}{user?.name ? `, ${user.name}` : ''}</h1>
            <p>Your herd health overview for today.</p>
          </div>
          <Link to="/upload" className="btn btn-primary" style={{ gap: '0.5rem', fontSize: '0.85rem' }}>
            <FaUpload /> Upload Recording
          </Link>
        </div>
      </Mv>

      {/* Alert strip */}
      {hasSuspected && (
        <Mv initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="db-alert">
            <FaHeartbeat style={{ color: 'var(--red)', fontSize: '1.1rem', flexShrink: 0 }} />
            <div>
              <strong>{s.suspected_cases} suspected case{s.suspected_cases !== 1 ? 's' : ''}</strong>
              {' '}require follow-up. Review reports and inspect flagged animals today.
            </div>
            <Link to="/history" className="db-alert-link">View Reports <FaArrowRight /></Link>
          </div>
        </Mv>
      )}

      {/* Stat cards */}
      <div className="db-stat-grid">
        <StatCard label="Total Cattle"     value={s.total_cattle}    icon={FaCow}                 accent="#65E4CF" sub="registered"  delay={0.08} />
        <StatCard label="Videos Analysed"  value={s.total_videos}    icon={FaVideo}               accent="#60a5fa" sub="uploaded"    delay={0.13} />
        <StatCard label="Suspected Cases"  value={s.suspected_cases} icon={FaExclamationTriangle} accent="#f5a623" sub="need review" delay={0.18} />
        <StatCard label="Normal"           value={s.normal_cases}    icon={FaCheckCircle}          accent="#65E4CF" sub="cleared"     delay={0.23} />
      </div>

      {/* Two-column body */}
      <div className="db-body">
        {/* Health chart */}
        <Mv
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="db-panel"
        >
          <div className="db-panel-title">Herd Health Distribution</div>
          <DonutChart normal={normal} suspected={suspected} confirmed={confirmed} />
        </Mv>

        {/* Quick actions */}
        <Mv
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <div className="db-panel-title" style={{ marginBottom: 0 }}>Quick Actions</div>
          <ActionCard to="/upload"  icon={FaUpload}        title="Upload New Recording" desc="Analyse fresh herd movement and get per-cow results." accent="#65E4CF" />
          <ActionCard to="/history" icon={FaClipboardList} title="View Reports"         desc="Check snapshots, scores, and action plans."            accent="#60a5fa" />
          <ActionCard to="/cattle"  icon={FaCow}           title="Manage Cattle"        desc="Add or review individual cattle records."              accent="#a78bfa" />
        </Mv>
      </div>
    </div>
  );
}
