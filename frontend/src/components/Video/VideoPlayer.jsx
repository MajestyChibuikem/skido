import React from 'react';
import { videoAPI } from '../../api/client';
import './Video.css';

function VideoPlayer({ videoId }) {
  return (
    <div className="video-player">
      <video controls width="100%">
        <source src={videoAPI.streamUrl(videoId)} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

export default VideoPlayer;
