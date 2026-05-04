export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Meeting Backend API',
    version: '1.0.0',
    description: `
Masofaviy ta'lim platformasi uchun meeting backend hujjati.

Bu Swagger ichida siz quyidagilarni topasiz:

1. Har bir endpoint nima vazifa bajarishi
2. Qanday token yoki header kerakligi
3. So'rov body qanday bo'lishi
4. Qaytadigan javob nimani anglatishi
5. Attendance ma'lumoti qayerdan kelishi va qanday o'qilishi

Eslatma:
- Ochiq endpointlar faqat \`/health\` va local demo uchun \`/api/dev/*\`
- Qolgan endpointlar JWT bilan himoyalangan
- Meeting ichiga realtime ulanish uchun avval \`join-token\` olish kerak
- Attendance response ichida talabaning ism-familiyasi, kirgan vaqti, chiqqan vaqti, umumiy o'tirgan vaqti va barcha sessionlari qaytadi
`,
  },
  servers: [
    {
      url: 'http://localhost:4001',
      description: 'Lokal server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Servis holatini tekshirish endpointlari' },
    { name: 'Meetings', description: 'Meeting yaratish, boshlash, tugatish va join-token olish endpointlari' },
    { name: 'Attendance', description: 'Davomat va session ma’lumotlari bilan ishlash endpointlari' },
    { name: 'Dev Auth', description: 'Local test uchun mock user va token endpointlari' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      internalServiceKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Internal-Service-Key',
      },
    },
    schemas: {
      MeetingSettings: {
        type: 'object',
        description: 'Meeting ichidagi media va chat ruxsatlari',
        properties: {
          allowCamera: { type: 'boolean' },
          allowMicrophone: { type: 'boolean' },
          allowScreenShare: { type: 'boolean' },
          allowChat: { type: 'boolean' },
        },
      },
      CreateMeetingRequest: {
        type: 'object',
        required: ['title', 'startTime', 'endTime', 'groupIds', 'settings'],
        properties: {
          title: { type: 'string', example: 'Matematika darsi' },
          description: { type: 'string', example: 'Algebra revision' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          groupIds: {
            type: 'array',
            items: { type: 'integer' },
            example: [101, 102],
          },
          settings: { $ref: '#/components/schemas/MeetingSettings' },
        },
      },
      Meeting: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 12 },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          createdByUserId: { type: 'integer' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          status: {
            type: 'string',
            enum: ['scheduled', 'live', 'ended', 'cancelled'],
          },
          groupIds: {
            type: 'array',
            items: { type: 'integer' },
          },
          settings: { $ref: '#/components/schemas/MeetingSettings' },
          permissions: {
            type: 'object',
            nullable: true,
            properties: {
              allowCamera: { type: 'boolean' },
              allowMicrophone: { type: 'boolean' },
              allowScreenShare: { type: 'boolean' },
              allowChat: { type: 'boolean' },
              canManageMeeting: { type: 'boolean' },
            },
          },
          canJoinNow: { type: 'boolean' },
        },
      },
      AttendanceSession: {
        type: 'object',
        description: 'Bitta foydalanuvchining meeting ichiga kirib-chiqqan bitta sessioni',
        properties: {
          sessionId: { type: 'integer', example: 41 },
          joinedAt: { type: 'string', format: 'date-time', nullable: true },
          leftAt: { type: 'string', format: 'date-time', nullable: true },
          totalSeconds: { type: 'integer', example: 1842 },
          totalMinutes: { type: 'integer', example: 31 },
          totalDurationLabel: { type: 'string', example: '00:30:42' },
          status: {
            type: 'string',
            example: 'left',
          },
        },
      },
      AttendanceSummary: {
        type: 'object',
        description: 'Teacher yoki admin ko‘radigan umumiy davomat satri',
        properties: {
          attendanceId: { type: 'integer', example: 7 },
          meetingId: { type: 'integer', example: 12 },
          userId: { type: 'integer', example: 1011 },
          groupId: { type: 'integer', nullable: true, example: 101 },
          fullName: { type: 'string', example: 'Ali Talaba' },
          firstJoinedAt: { type: 'string', format: 'date-time', nullable: true },
          lastLeftAt: { type: 'string', format: 'date-time', nullable: true },
          totalSeconds: { type: 'integer', example: 3600 },
          totalMinutes: { type: 'integer', example: 60 },
          totalDurationLabel: { type: 'string', example: '01:00:00' },
          sessionCount: { type: 'integer', example: 2 },
          currentlyInMeeting: { type: 'boolean' },
          isPresent: { type: 'boolean' },
          syncedToMainBackend: { type: 'boolean' },
          sessions: {
            type: 'array',
            items: { $ref: '#/components/schemas/AttendanceSession' },
          },
        },
      },
      JoinTokenResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          meeting: { $ref: '#/components/schemas/Meeting' },
          permissions: {
            type: 'object',
            properties: {
              allowCamera: { type: 'boolean' },
              allowMicrophone: { type: 'boolean' },
              allowScreenShare: { type: 'boolean' },
              allowChat: { type: 'boolean' },
              canManageMeeting: { type: 'boolean' },
            },
          },
          expiresIn: { type: 'string', example: '5m' },
        },
      },
      SuccessEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {},
        },
      },
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          details: { nullable: true },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Servis ishlayotganini tekshirish',
        description: `
Bu endpoint servis tirikligini tekshiradi.

Qachon ishlatiladi:
- Nginx yoki load balancer health check
- Deploydan keyin backend turibdimi yoki yo‘qmi tekshirish
`,
        responses: {
          200: {
            description: 'Servis ishlayapti',
          },
        },
      },
    },
    '/api/dev/users': {
      get: {
        tags: ['Dev Auth'],
        summary: 'Mock userlar ro‘yxatini olish',
        description: `
Faqat local demo rejim uchun.

Bu endpoint orqali frontend teacher, admin va student demo userlarni ro‘yxat qilib ko‘rsatadi.
`,
        responses: {
          200: {
            description: 'Mock userlar muvaffaqiyatli qaytdi',
          },
        },
      },
    },
    '/api/dev/token': {
      post: {
        tags: ['Dev Auth'],
        summary: 'Mock access token yaratish',
        description: `
Faqat local demo rejim uchun.

Qanday ishlatiladi:
1. \`userId\` yuborasiz
2. Backend o‘sha mock user uchun JWT qaytaradi
3. Shu token bilan protected endpointlarga kiriladi
`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'integer', example: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Token muvaffaqiyatli yaratildi',
          },
        },
      },
    },
    '/api/meetings': {
      post: {
        tags: ['Meetings'],
        summary: 'Yangi meeting yaratish',
        description: `
Teacher yoki admin meeting yaratadi.

Ishlash tartibi:
1. Sarlavha, vaqt oralig‘i va groupIds yuboriladi
2. Teacher bo‘lsa, faqat o‘ziga biriktirilgan guruhlar uchun create qila oladi
3. Meeting status boshlanishida \`scheduled\` bo‘ladi
`,
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateMeetingRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Meeting yaratildi',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessEnvelope' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/Meeting' },
                      },
                    },
                  ],
                },
              },
            },
          },
          403: {
            description: 'Teacher so‘ralgan guruhga biriktirilmagan',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              },
            },
          },
        },
      },
    },
    '/api/meetings/my': {
      get: {
        tags: ['Meetings'],
        summary: 'Joriy foydalanuvchi meetinglari',
        description: `
Role bo‘yicha turlicha ishlaydi:

- Teacher bo‘lsa: o‘zi yaratgan yoki o‘z guruhlariga tegishli meetinglar
- Student bo‘lsa: o‘z guruhiga tegishli meetinglar
- Admin bo‘lsa: hamma meetinglar
`,
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Meetinglar ro‘yxati qaytdi',
          },
        },
      },
    },
    '/api/meetings/{id}': {
      get: {
        tags: ['Meetings'],
        summary: 'Bitta meeting tafsilotini olish',
        description: `
Meetingning asosiy ma’lumotlari qaytadi.

Bu endpoint odatda:
- meeting detail sahifasi
- join tugmasi chiqishidan oldin tekshiruv
uchun ishlatiladi.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: { description: 'Meeting detail qaytdi' },
        },
      },
    },
    '/api/meetings/{id}/start': {
      post: {
        tags: ['Meetings'],
        summary: 'Meetingni boshlash',
        description: `
Teacher yoki admin meeting statusini \`live\` ga o‘tkazadi.

Bu endpointdan keyin:
- join-token olish mumkin bo‘ladi
- socket orqali meetingga kirish ochiladi
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: { description: 'Meeting live holatga o‘tdi' },
        },
      },
    },
    '/api/meetings/{id}/end': {
      post: {
        tags: ['Meetings'],
        summary: 'Meetingni yakunlash',
        description: `
Teacher yoki admin meetingni tugatadi.

Bu endpointdan keyin:
- room yopiladi
- foydalanuvchilar chiqariladi
- attendance sessionlar yakunlanadi
- main backendga event yuboriladi
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: { description: 'Meeting tugatildi' },
        },
      },
    },
    '/api/meetings/{id}/join-token': {
      post: {
        tags: ['Meetings'],
        summary: 'Realtime ulanish uchun join-token olish',
        description: `
Socket.IO orqali meetingga kirishdan oldin shu endpoint chaqiriladi.

Ishlash tartibi:
1. User bu endpointga JWT bilan kiradi
2. Backend userga meetingga ruxsat bor-yo‘qligini tekshiradi
3. 5 daqiqalik qisqa muddatli join-token yaratadi
4. Frontend shu tokenni socket \`auth.joinToken\` ga yuboradi
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: {
            description: 'Join-token yaratildi',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessEnvelope' },
                    {
                      properties: {
                        data: { $ref: '#/components/schemas/JoinTokenResponse' },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/meetings/{id}/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'Meeting davomatini olish',
        description: `
Teacher yoki admin uchun davomat jadvali.

Bu yerda quyidagilar qaytadi:
- talabaning ism-familiyasi
- birinchi kirgan vaqti
- oxirgi chiqqan vaqti
- umumiy qatnashgan vaqti
- nechta session bo‘lgani
- har bir sessionning joinedAt va leftAt qiymati

Agar \`search\` query bersangiz, ism-familiya bo‘yicha filter qiladi.
`,
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
          {
            name: 'search',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Ism-familiya bo‘yicha qidiruv',
          },
        ],
        responses: {
          200: {
            description: 'Davomat ro‘yxati qaytdi',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessEnvelope' },
                    {
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/AttendanceSummary' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/internal/attendance/sync': {
      post: {
        tags: ['Attendance'],
        summary: 'Attendance sync queue ni qayta yuborish',
        description: `
Ichki servis endpointi.

Qanday ishlatiladi:
- main backend yoki cron job bu endpointni chaqiradi
- agar \`meetingId\` berilsa, aynan o‘sha meeting attendance yozuvlari sync qilinadi
- agar \`meetingId\` bo‘lmasa, pending queue bo‘yicha retry ishlaydi
`,
        security: [{ internalServiceKey: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  meetingId: { type: 'integer', example: 12 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Sync yakunlandi' },
        },
      },
    },
  },
};
