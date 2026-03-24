import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { cattleAPI, videoAPI, analysisAPI } from '../../api/client';
import VideoPlayer from '../Video/VideoPlayer';
import AnalysisResultCard from '../Analysis/AnalysisResult';
import { FaUpload, FaArrowLeft } from 'react-icons/fa';
import './Cattle.css';

function CattleDetail() {
  const { id } = useParams();
  const [cattle, setCattle] = useState(null);
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      cattleAPI.get(id).then((res) => setCattle(res.data)),
      videoAPI.listByCattle(id).then((res) => setVideos(res.data)),
    ])
      .catch((err) => console.error('Failed to load cattle details:', err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSelectVideo = (video) => {
    setSelectedVideo(video);
    setAnalysis(null);
    if (video.has_analysis) {
      analysisAPI
        .get(video.id)
        .then((res) => setAnalysis(res.data))
        .catch((err) => console.error('Failed to load analysis:', err));
    }
  };

  const handleAnalyze = () => {
    if (!selectedVideo) return;
    setAnalyzing(true);
    analysisAPI
      .trigger(selectedVideo.id)
      .then((res) => setAnalysis(res.data))
      .catch((err) => console.error('Analysis failed:', err))
      .finally(() => setAnalyzing(false));
  };

  if (loading) return <div className="loading">Loading cattle details...</div>;
  if (!cattle) return <div className="error">Cattle record not found.</div>;

  return (
    <div className="cattle-detail">
      <div className="list-header">
        <h1>{cattle.name}</h1>
        <Link to="/cattle" className="btn btn-sm">
          <FaArrowLeft /> Back
        </Link>
      </div>

      <div className="cattle-card" style={{ marginBottom: '1.5rem' }}>
        {cattle.tag && <p><strong style={{ color: 'rgba(255,255,255,0.6)' }}>Tag:</strong> #{cattle.tag}</p>}
        {cattle.breed && <p><strong style={{ color: 'rgba(255,255,255,0.6)' }}>Breed:</strong> {cattle.breed}</p>}
        {cattle.notes && <p><strong style={{ color: 'rgba(255,255,255,0.6)' }}>Notes:</strong> {cattle.notes}</p>}
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
          Added: {new Date(cattle.date_added).toLocaleDateString()}
        </p>
      </div>

      <div className="list-header">
        <h2 style={{ color: '#65E4CF', fontWeight: 800 }}>Videos ({videos.length})</h2>
        <Link to="/upload" className="btn btn-primary btn-sm">
          <FaUpload /> Upload Video
        </Link>
      </div>

      {videos.length === 0 ? (
        <div className="empty-state">
          <p>No videos yet. Upload a video to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            {videos.map((v) => (
              <div
                key={v.id}
                onClick={() => handleSelectVideo(v)}
                className="cattle-card"
                style={{
                  cursor: 'pointer',
                  marginBottom: '0.5rem',
                  borderColor: selectedVideo?.id === v.id ? '#65E4CF' : undefined,
                  borderWidth: selectedVideo?.id === v.id ? '1px' : undefined,
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: '#e0e0e0' }}>{v.original_filename}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>
                  {new Date(v.upload_date).toLocaleDateString()}
                  {v.has_analysis ? ' - Analyzed' : ' - Not analyzed'}
                </p>
              </div>
            ))}
          </div>

          <div>
            {selectedVideo ? (
              <>
                <VideoPlayer videoId={selectedVideo.id} />
                {analysis ? (
                  <div style={{ marginTop: '1rem' }}>
                    <AnalysisResultCard result={analysis} />
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '1rem' }}
                    onClick={handleAnalyze}
                    disabled={analyzing}
                  >
                    {analyzing ? 'Analyzing...' : 'Run Analysis'}
                  </button>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p>Select a video to view and analyze.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CattleDetail;
