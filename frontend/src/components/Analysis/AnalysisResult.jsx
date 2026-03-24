import React from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import './Analysis.css';

function AnalysisResultCard({ result }) {
  if (!result) return null;

  const getStatusIcon = () => {
    switch (result.status) {
      case 'normal':
        return <FaCheckCircle className="status-icon normal" />;
      case 'suspected':
        return <FaExclamationTriangle className="status-icon suspected" />;
      case 'confirmed':
        return <FaTimesCircle className="status-icon confirmed" />;
      default:
        return null;
    }
  };

  const getScoreColor = () => {
    if (result.lameness_score < 3) return '#28a745';
    if (result.lameness_score < 7) return '#e6a817';
    return '#c0392b';
  };

  return (
    <div className="analysis-result">
      <div className="result-header">
        {getStatusIcon()}
        <h3>Analysis Result</h3>
        <span className={`status-badge ${result.status}`}>{result.status}</span>
      </div>

      <div className="score-display">
        <div className="score-bar">
          <div
            className="score-fill"
            style={{
              width: `${(result.lameness_score / 10) * 100}%`,
              backgroundColor: getScoreColor(),
            }}
          />
        </div>
        <span className="score-value" style={{ color: getScoreColor() }}>
          {result.lameness_score}/10
        </span>
      </div>

      {result.analyzed_at && (
        <p className="analyzed-date">Analyzed: {new Date(result.analyzed_at).toLocaleString()}</p>
      )}

      {result.notes && <p className="result-notes">{result.notes}</p>}
    </div>
  );
}

export default AnalysisResultCard;
