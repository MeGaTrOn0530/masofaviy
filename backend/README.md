# Meeting Backend Service

Node.js + Express + Socket.IO + mediasoup + Prisma asosidagi alohida meeting microservice.

## Texnologiyalar

- Node.js (ES Module)
- Express
- Socket.IO
- mediasoup
- Prisma + MySQL
- JWT auth
- Zod validation

## Folderlar

- `src/` asosiy backend kodi
- `prisma/schema.prisma` ma'lumotlar bazasi modeli
- `docs/` API, socket va mediasoup oqimi
- `deploy/` PM2 va Nginx namunalari

## Local ishga tushirish

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Server: `http://localhost:4000`

## Demo mode

Default `.env.example` ichida `MAIN_BACKEND_MODE=mock`.

Default holatda `DEV_FILE_STORE_FALLBACK=true`, shuning uchun MySQL credentials noto'g'ri bo'lsa ham backend local JSON store bilan ishlayveradi.
Fallback fayl: `backend/.data/dev-store.json`

Shunda:

- `GET /api/dev/users` demo userlar ro'yxatini beradi
- `POST /api/dev/token` frontend uchun demo access token beradi

## Muhim endpointlar

- `POST /api/meetings`
- `GET /api/meetings/my`
- `GET /api/meetings/:id`
- `POST /api/meetings/:id/start`
- `POST /api/meetings/:id/end`
- `POST /api/meetings/:id/join-token`
- `GET /api/meetings/:id/attendance`
- `POST /api/internal/attendance/sync`

## Swagger

- Swagger UI: `http://localhost:4001/api/docs`
- OpenAPI JSON: `http://localhost:4001/api/openapi.json`

## Attendance sync

- Student roomga kirganda `MeetingParticipant` session ochiladi
- Chiqganda `Attendance` summary yangilanadi
- `GET /api/meetings/:id/attendance` endpointi fullName, firstJoinedAt, lastLeftAt, totalDuration va sessionlar ro'yxatini qaytaradi
- Main backend ishlamasa `AttendanceSyncQueue` ga yoziladi
- Background scheduler pending queue'ni qayta yuboradi

## Production deploy

### PM2

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

### Nginx

`deploy/nginx-meeting.conf` faylidan foydalaning.

### Eslatma

mediasoup uchun UDP/TCP port range (`40000-49999`) ochiq bo'lishi kerak.

## Hujjatlar

- [API Documentation](./docs/api-documentation.md)
- [Socket.IO Events](./docs/socket-events.md)
- [mediasoup Flow](./docs/mediasoup-flow.md)
