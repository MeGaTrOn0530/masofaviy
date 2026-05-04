import { useEffect, useState } from 'react';
import { meetingApi } from '../api/meetingApi.js';

export default function AuthPanel({ auth, onLogin, onLogout }) {
  const [demoUsers, setDemoUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    meetingApi.listDemoUsers()
      .then((users) => {
        setDemoUsers(users);
        if (users[0]) {
          setSelectedUserId(String(users[0].id));
        }
      })
      .catch((fetchError) => {
        setError(fetchError.message);
      });
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await meetingApi.createDemoToken(Number(selectedUserId));
      onLogin({
        token: response.token,
        user: response.user,
      });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel hero-panel">
      <div className="hero-copy">
        <p className="eyebrow">Demo Access</p>
        <h1>Meeting Backend Test Console</h1>
        <p className="muted">
          Mock auth orqali teacher, admin va student rollarida tizimni darhol tekshirishingiz mumkin.
        </p>
      </div>

      {auth ? (
        <div className="auth-status">
          <div>
            <strong>{auth.user.fullName}</strong>
            <p className="muted">{auth.user.role}</p>
          </div>
          <button className="secondary-button" onClick={onLogout}>Chiqish</button>
        </div>
      ) : (
        <div className="auth-form">
          <label>
            Demo user
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              {demoUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.role})
                </option>
              ))}
            </select>
          </label>

          <button className="primary-button" disabled={loading || !selectedUserId} onClick={handleLogin}>
            {loading ? 'Kirilmoqda...' : 'Demo Login'}
          </button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
