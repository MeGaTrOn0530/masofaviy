export default function MeetingCard({
  meeting,
  currentUser,
  onStart,
  onEnd,
  onJoin,
  onAttendance,
}) {
  const canModerate = currentUser && ['teacher', 'admin'].includes(currentUser.role);

  return (
    <article className="meeting-card">
      <div className="meeting-card-top">
        <div>
          <p className="meeting-status">{meeting.status}</p>
          <h3>{meeting.title}</h3>
          <p className="muted">{meeting.description || 'Tavsif yo‘q'}</p>
        </div>
        <div className="meeting-groups">
          {meeting.groupIds.map((groupId) => (
            <span key={groupId}>Guruh {groupId}</span>
          ))}
        </div>
      </div>

      <div className="meeting-meta">
        <span>{new Date(meeting.startTime).toLocaleString()}</span>
        <span>{new Date(meeting.endTime).toLocaleString()}</span>
      </div>

      <div className="meeting-actions">
        {canModerate && meeting.status !== 'live' && meeting.status !== 'ended' && (
          <button className="primary-button" onClick={() => onStart(meeting.id)}>Start</button>
        )}

        {meeting.status === 'live' && (
          <button className="primary-button" onClick={() => onJoin(meeting)}>Join</button>
        )}

        {canModerate && meeting.status === 'live' && (
          <button className="danger-button" onClick={() => onEnd(meeting.id)}>End</button>
        )}

        {canModerate && (
          <button className="secondary-button" onClick={() => onAttendance(meeting.id)}>Attendance</button>
        )}
      </div>
    </article>
  );
}
