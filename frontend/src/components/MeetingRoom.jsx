import { useEffect, useRef, useState } from 'react';
import { useMeetingRoom } from '../hooks/useMeetingRoom.js';

function StreamSurface({ item, muted = false, className = '' }) {
  const elementRef = useRef(null);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.srcObject = item.stream;
    }
  }, [item.stream]);

  if (item.kind === 'video') {
    return <video ref={elementRef} className={className} autoPlay playsInline muted={muted} />;
  }

  return (
    <div className={`audio-surface ${className}`.trim()}>
      <audio ref={elementRef} autoPlay />
      <span>Audio only</span>
    </div>
  );
}

function SidebarChat({ messages, onSend, disabled }) {
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }

    await onSend(message);
    setMessage('');
  };

  return (
    <div className="sidebar-chat">
      <div className="sidebar-scroll">
        {messages.length === 0 && <div className="sidebar-empty">Xabarlar hali yo‘q.</div>}
        {messages.map((item) => (
          <div key={item.id || `${item.userId}-${item.createdAt}`} className="sidebar-message">
            <strong>{item.fullName}</strong>
            <p>{item.message}</p>
          </div>
        ))}
      </div>

      <form className="sidebar-compose" onSubmit={handleSubmit}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Xabar yozing..."
          disabled={disabled}
        />
        <button className="room-send-button" disabled={disabled}>Send</button>
      </form>
    </div>
  );
}

export default function MeetingRoom({ meeting, auth, onClose }) {
  const {
    status,
    error,
    permissions,
    participants,
    messages,
    localMedia,
    remoteMedia,
    isCameraOn,
    isMicrophoneOn,
    isScreenShareOn,
    startProducer,
    closeProducer,
    sendMessage,
    teacherAction,
    leaveRoom,
  } = useMeetingRoom({
    meeting,
    auth,
    onRoomClosed: onClose,
  });

  const isTeacher = auth?.user && ['teacher', 'admin'].includes(auth.user.role);
  const [sidebarTab, setSidebarTab] = useState('participants');
  const stageStream = remoteMedia.find((item) => item.kind === 'video')
    || localMedia.find((item) => item.kind === 'video');
  const filmstripStreams = [
    ...localMedia.filter((item) => item.kind === 'video'),
    ...remoteMedia.filter((item) => item.kind === 'video'),
  ].filter((item, index, list) => list.findIndex((entry) => entry.stream === item.stream) === index);
  const audioParticipants = [
    ...localMedia.filter((item) => item.kind === 'audio'),
    ...remoteMedia.filter((item) => item.kind === 'audio'),
  ];
  const statusLabel = {
    idle: 'Idle',
    connecting: 'Connecting',
    connected: 'Connected',
    error: 'Error',
    removed: 'Removed',
    ended: 'Ended',
    closed: 'Closed',
    'connection-issue': 'Connection issue',
  }[status] || status;

  return (
    <section className="room-shell conference-shell">
      <div className="conference-header">
        <div>
          <p className="room-kicker">Live Meeting</p>
          <h2>{meeting.title}</h2>
          <div className="room-meta">
            <span>{new Date(meeting.startTime).toLocaleString()}</span>
            <span>{participants.length} participants</span>
            <span className={`room-status-badge room-status-${status}`}>{statusLabel}</span>
          </div>
        </div>

        <div className="conference-user-chip">
          <div className="conference-user-avatar">{auth.user.fullName.slice(0, 1)}</div>
          <div>
            <strong>{auth.user.fullName}</strong>
            <p>{auth.user.role}</p>
          </div>
        </div>
      </div>

      <div className="conference-main">
        <section className="conference-stage">
          <div className="stage-surface">
            {stageStream ? (
              <>
                <StreamSurface
                  item={stageStream}
                  muted={stageStream.fullName?.includes('(You)')}
                  className="stage-video"
                />
                <div className="stage-overlay">
                  <div className="stage-pill">{stageStream.fullName}</div>
                  {audioParticipants.length > 0 && (
                    <div className="stage-audio-stack">
                      {audioParticipants.map((item) => (
                        <span key={`${item.fullName}-${item.source}`} className="audio-chip">
                          {item.fullName} · {item.source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="stage-empty">
                <div className="stage-empty-avatar">{auth.user.fullName.slice(0, 1)}</div>
                <strong>Kamera hali yoqilmagan</strong>
                <p>Camera on tugmasini bosing yoki boshqa participant video yuborishini kuting.</p>
              </div>
            )}

            <div className="stage-control-bar">
              <button
                className={`stage-control-button ${isMicrophoneOn ? 'active' : ''}`}
                onClick={() => (isMicrophoneOn ? closeProducer('microphone') : startProducer('microphone'))}
                disabled={!permissions?.allowMicrophone && !isMicrophoneOn}
              >
                {isMicrophoneOn ? 'Mic on' : 'Mic off'}
              </button>
              <button
                className={`stage-control-button ${isCameraOn ? 'active' : ''}`}
                onClick={() => (isCameraOn ? closeProducer('camera') : startProducer('camera'))}
                disabled={!permissions?.allowCamera && !isCameraOn}
              >
                {isCameraOn ? 'Camera on' : 'Camera off'}
              </button>
              <button
                className={`stage-control-button ${isScreenShareOn ? 'active' : ''}`}
                onClick={() => (isScreenShareOn ? closeProducer('screen') : startProducer('screen'))}
                disabled={!permissions?.allowScreenShare && !isScreenShareOn}
              >
                {isScreenShareOn ? 'Sharing' : 'Share'}
              </button>
              <button className="stage-control-button danger" onClick={leaveRoom}>Leave</button>
            </div>
          </div>

          <div className="filmstrip-row">
            {filmstripStreams.length === 0 && <div className="filmstrip-empty">Participant previewlar shu yerda chiqadi.</div>}
            {filmstripStreams.map((item) => (
              <div className="filmstrip-card" key={`${item.fullName}-${item.source}`}>
                <StreamSurface item={item} muted={item.fullName?.includes('(You)')} className="filmstrip-video" />
                <div className="filmstrip-caption">
                  <strong>{item.fullName}</strong>
                  <span>{item.source}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="conference-sidebar">
          <div className="sidebar-tabs">
            <button className={sidebarTab === 'chat' ? 'sidebar-tab active' : 'sidebar-tab'} onClick={() => setSidebarTab('chat')}>Chat</button>
            <button className={sidebarTab === 'participants' ? 'sidebar-tab active' : 'sidebar-tab'} onClick={() => setSidebarTab('participants')}>Participants</button>
          </div>

          {sidebarTab === 'chat' ? (
            <SidebarChat messages={messages} onSend={sendMessage} disabled={!permissions?.allowChat} />
          ) : (
            <div className="sidebar-people">
              <div className="sidebar-scroll">
                {participants.map((participant) => (
                  <div className="person-card" key={`${participant.userId}-${participant.socketId || participant.fullName}`}>
                    <div className="person-main">
                      <div className="person-avatar">{participant.fullName.slice(0, 1)}</div>
                      <div>
                        <strong>{participant.fullName}</strong>
                        <p>{participant.role}</p>
                      </div>
                    </div>

                    {isTeacher && participant.userId !== auth.user.id && (
                      <div className="person-actions">
                        <button className="person-action-button" onClick={() => teacherAction('teacher:muteUser', { userId: participant.userId })}>Mute</button>
                        <button className="person-action-button" onClick={() => teacherAction('teacher:disableMicrophone', { userId: participant.userId })}>Mic</button>
                        <button className="person-action-button" onClick={() => teacherAction('teacher:disableCamera', { userId: participant.userId })}>Cam</button>
                        <button className="person-action-button" onClick={() => teacherAction('teacher:allowScreenShare', { userId: participant.userId, allowed: true })}>Share</button>
                        <button className="person-action-button danger" onClick={() => teacherAction('teacher:removeUser', { userId: participant.userId })}>Out</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {error && (
        <div className="room-error-banner">
          <strong>Muammo:</strong> {error}
        </div>
      )}
    </section>
  );
}
