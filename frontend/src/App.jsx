import { useEffect, useState } from 'react';
import AuthPanel from './components/AuthPanel.jsx';
import MeetingForm from './components/MeetingForm.jsx';
import MeetingCard from './components/MeetingCard.jsx';
import MeetingRoom from './components/MeetingRoom.jsx';
import { meetingApi } from './api/meetingApi.js';
import { apiBaseUrl } from './api/client.js';

const AUTH_STORAGE_KEY = 'meeting-demo-auth';

export default function App() {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [attendanceRows, setAttendanceRows] = useState([]);

  const canCreateMeeting = auth?.user && ['teacher', 'admin'].includes(auth.user.role);

  const activeMeetingLabel = activeMeeting?.title || '';

  const refreshMeetings = async () => {
    if (!auth?.token) {
      setMeetings([]);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const meetingList = await meetingApi.getMyMeetings(auth.token);
      setMeetings(meetingList);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
      refreshMeetings().catch((error) => setMessage(error.message));
      return;
    }

    localStorage.removeItem(AUTH_STORAGE_KEY);
    setMeetings([]);
  }, [auth?.token]);

  const handleCreateMeeting = async (payload) => {
    try {
      await meetingApi.createMeeting(payload, auth.token);
      setMessage('Meeting yaratildi.');
      await refreshMeetings();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleStartMeeting = async (meetingId) => {
    try {
      await meetingApi.startMeeting(meetingId, auth.token);
      setMessage('Meeting live holatga o‘tdi.');
      await refreshMeetings();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleEndMeeting = async (meetingId) => {
    try {
      await meetingApi.endMeeting(meetingId, auth.token);
      setMessage('Meeting yakunlandi.');
      if (activeMeeting?.id === meetingId) {
        setActiveMeeting(null);
      }
      await refreshMeetings();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleAttendance = async (meetingId) => {
    try {
      const rows = await meetingApi.getAttendance(meetingId, auth.token);
      setAttendanceRows(rows);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="app-shell">
      <div className="backdrop backdrop-one" />
      <div className="backdrop backdrop-two" />

      <main className="page-layout">
        <AuthPanel
          auth={auth}
          onLogin={setAuth}
          onLogout={() => {
            setAuth(null);
            setActiveMeeting(null);
            setAttendanceRows([]);
          }}
        />

        <section className="status-bar panel">
          <div>
            <p className="eyebrow">Environment</p>
            <strong>{apiBaseUrl}</strong>
          </div>
          <div>
            <p className="eyebrow">Meetings</p>
            <strong>{meetings.length}</strong>
          </div>
          <div>
            <p className="eyebrow">Active Room</p>
            <strong>{activeMeetingLabel || 'none'}</strong>
          </div>
        </section>

        {message && <div className="panel message-banner">{message}</div>}

        {canCreateMeeting && (
          <MeetingForm onSubmit={handleCreateMeeting} disabled={loading} />
        )}

        {activeMeeting ? (
          <MeetingRoom
            meeting={activeMeeting}
            auth={auth}
            onClose={() => {
              setActiveMeeting(null);
              refreshMeetings().catch((error) => setMessage(error.message));
            }}
          />
        ) : (
          <section className="panel list-panel">
            <div className="section-head">
              <p className="eyebrow">Schedule</p>
              <h2>Meetinglar</h2>
            </div>

            <div className="meeting-list">
              {meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  currentUser={auth?.user}
                  onStart={handleStartMeeting}
                  onEnd={handleEndMeeting}
                  onJoin={setActiveMeeting}
                  onAttendance={handleAttendance}
                />
              ))}

              {!loading && meetings.length === 0 && (
                <div className="empty-state">Siz uchun hozircha meeting yo‘q.</div>
              )}
            </div>
          </section>
        )}

        {attendanceRows.length > 0 && (
          <section className="panel attendance-panel">
            <div className="section-head">
              <p className="eyebrow">Attendance</p>
              <h2>Davomat jadvali</h2>
            </div>

            <div className="attendance-table">
              {attendanceRows.map((row) => (
                <div className="attendance-row" key={row.attendanceId || row.id}>
                  <div className="attendance-main">
                    <strong>{row.fullName}</strong>
                    <span>Kirdi: {row.firstJoinedAt ? new Date(row.firstJoinedAt).toLocaleString() : '—'}</span>
                    <span>Chiqdi: {row.lastLeftAt ? new Date(row.lastLeftAt).toLocaleString() : '—'}</span>
                  </div>
                  <div className="attendance-side">
                    <span>{row.totalDurationLabel || `${Math.ceil((row.totalSeconds || 0) / 60)} min`}</span>
                    <span>{row.sessionCount || 0} session</span>
                    <span>{row.syncedToMainBackend ? 'synced' : 'pending'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
