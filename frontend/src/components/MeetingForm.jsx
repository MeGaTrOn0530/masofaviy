import { useState } from 'react';

const initialState = {
  title: '',
  description: '',
  startTime: '',
  endTime: '',
  groupIds: '101',
  settings: {
    allowCamera: true,
    allowMicrophone: true,
    allowScreenShare: false,
    allowChat: true,
  },
};

export default function MeetingForm({ onSubmit, disabled }) {
  const [form, setForm] = useState(initialState);

  const updateField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateSetting = (key, value) => {
    setForm((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value,
      },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    await onSubmit({
      title: form.title,
      description: form.description,
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
      groupIds: form.groupIds.split(',').map((item) => Number(item.trim())).filter(Boolean),
      settings: form.settings,
    });

    setForm(initialState);
  };

  return (
    <form className="panel meeting-form" onSubmit={handleSubmit}>
      <div className="section-head">
        <p className="eyebrow">Teacher Panel</p>
        <h2>Meeting yaratish</h2>
      </div>

      <label>
        Sarlavha
        <input value={form.title} onChange={(event) => updateField('title', event.target.value)} required />
      </label>

      <label>
        Tavsif
        <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={3} />
      </label>

      <div className="two-column">
        <label>
          Boshlanish
          <input type="datetime-local" value={form.startTime} onChange={(event) => updateField('startTime', event.target.value)} required />
        </label>
        <label>
          Tugash
          <input type="datetime-local" value={form.endTime} onChange={(event) => updateField('endTime', event.target.value)} required />
        </label>
      </div>

      <label>
        Group IDs
        <input value={form.groupIds} onChange={(event) => updateField('groupIds', event.target.value)} placeholder="101,102" />
      </label>

      <div className="settings-grid">
        <label><input type="checkbox" checked={form.settings.allowCamera} onChange={(event) => updateSetting('allowCamera', event.target.checked)} /> Camera</label>
        <label><input type="checkbox" checked={form.settings.allowMicrophone} onChange={(event) => updateSetting('allowMicrophone', event.target.checked)} /> Microphone</label>
        <label><input type="checkbox" checked={form.settings.allowScreenShare} onChange={(event) => updateSetting('allowScreenShare', event.target.checked)} /> Screen share</label>
        <label><input type="checkbox" checked={form.settings.allowChat} onChange={(event) => updateSetting('allowChat', event.target.checked)} /> Chat</label>
      </div>

      <button className="primary-button" disabled={disabled}>Meeting yaratish</button>
    </form>
  );
}
