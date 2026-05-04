const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4001';

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed.');
  }

  return payload.data ?? payload;
};

export const apiClient = {
  async get(path, token, headers = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    return parseResponse(response);
  },

  async post(path, body, token, headers = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });

    return parseResponse(response);
  },
};

export const apiBaseUrl = API_BASE_URL;
