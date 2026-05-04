import { useEffect, useRef } from 'react';

function MediaTile({ item, muted = false, label }) {
  const elementRef = useRef(null);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.srcObject = item.stream;
    }
  }, [item.stream]);

  return (
    <div className="media-tile">
      <div className="media-label">
        <strong>{label}</strong>
        <span>{item.source}</span>
      </div>

      {item.kind === 'video' ? (
        <video ref={elementRef} autoPlay playsInline muted={muted} />
      ) : (
        <div className="audio-tile">
          <audio ref={elementRef} autoPlay />
          <span>Audio active</span>
        </div>
      )}
    </div>
  );
}

export default function ParticipantGrid({ localMedia, remoteMedia }) {
  return (
    <section className="panel media-panel">
      <div className="section-head">
        <p className="eyebrow">Live Media</p>
        <h2>Participant Streams</h2>
      </div>

      <div className="media-grid">
        {localMedia.map((item) => (
          <MediaTile key={`local-${item.source}`} item={item} muted label={item.fullName} />
        ))}

        {remoteMedia.map((item) => (
          <MediaTile key={item.id} item={item} label={item.fullName} />
        ))}

        {localMedia.length === 0 && remoteMedia.length === 0 && (
          <div className="media-placeholder">Media hali ulanmagan.</div>
        )}
      </div>
    </section>
  );
}
