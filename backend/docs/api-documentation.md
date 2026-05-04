# API Documentation

Base URL: `http://localhost:4000`

All public endpoints require `Authorization: Bearer <access_token>`.

## Authentication

### Demo only

`GET /api/dev/users`

`POST /api/dev/token`

```json
{
  "userId": 1
}
```

## Meetings

### `POST /api/meetings`

Teacher yoki admin meeting yaratadi.

```json
{
  "title": "Matematika darsi",
  "description": "Algebra revision",
  "startTime": "2026-05-04T12:00:00.000Z",
  "endTime": "2026-05-04T13:00:00.000Z",
  "groupIds": [101, 102],
  "settings": {
    "allowCamera": true,
    "allowMicrophone": true,
    "allowScreenShare": false,
    "allowChat": true
  }
}
```

### `GET /api/meetings/my`

Teacher uchun o'zi yoki biriktirilgan guruhlardagi meetinglar.
Student uchun faqat o'z guruhidagi meetinglar.

### `GET /api/meetings/:id`

Meeting detail.

### `POST /api/meetings/:id/start`

Meeting status'ni `live` qiladi va `meeting.started` event yuboradi.

### `POST /api/meetings/:id/end`

Meetingni tugatadi, room'ni yopadi, attendance sync qiladi.

### `POST /api/meetings/:id/join-token`

5 minutlik join token qaytaradi.

Response:

```json
{
  "token": "jwt",
  "meeting": {
    "id": 1,
    "title": "Matematika darsi",
    "status": "live"
  },
  "permissions": {
    "allowCamera": true,
    "allowMicrophone": true,
    "allowScreenShare": false,
    "allowChat": true,
    "canManageMeeting": false
  },
  "expiresIn": "5m"
}
```

### `GET /api/meetings/:id/attendance`

Teacher/admin attendance summary oladi.

## Internal

### `POST /api/internal/attendance/sync`

Header:

`X-Internal-Service-Key: <MAIN_BACKEND_SERVICE_KEY>`

Body optional:

```json
{
  "meetingId": 12
}
```

`meetingId` bo'lmasa queue dagi pending sync itemlar ishlanadi.
