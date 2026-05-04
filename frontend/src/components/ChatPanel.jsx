import { useState } from 'react';

export default function ChatPanel({ messages, onSend, disabled }) {
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSend(message);
    setMessage('');
  };

  return (
    <section className="panel chat-panel">
      <div className="section-head">
        <p className="eyebrow">Room Chat</p>
        <h2>Xabarlar</h2>
      </div>

      <div className="chat-list">
        {messages.map((item) => (
          <div key={item.id || `${item.userId}-${item.createdAt}`} className="chat-message">
            <strong>{item.fullName}</strong>
            <p>{item.message}</p>
          </div>
        ))}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Xabar yozing..." disabled={disabled} />
        <button className="primary-button" disabled={disabled}>Send</button>
      </form>
    </section>
  );
}
