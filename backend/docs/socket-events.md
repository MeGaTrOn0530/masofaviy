# Socket.IO Events

Socket connection `joinToken` bilan ochiladi:

```js
io("http://localhost:4000", {
  path: "/socket.io",
  auth: {
    joinToken: "<jwt>"
  }
})
```

## Client -> Server

### `meeting:join`

Roomga kirish, attendance session ochish, participant list va chat olish.

### `meeting:leave`

Roomdan chiqish.

### `media:getRouterRtpCapabilities`

mediasoup `Device.load()` uchun router capability oladi.

### `media:createWebRtcTransport`

```json
{
  "direction": "send"
}
```

### `media:connectTransport`

```json
{
  "transportId": "abc",
  "dtlsParameters": {}
}
```

### `media:produce`

```json
{
  "transportId": "abc",
  "kind": "video",
  "rtpParameters": {},
  "appData": {
    "source": "camera"
  }
}
```

### `media:consume`

```json
{
  "transportId": "recv-transport-id",
  "producerId": "producer-id",
  "rtpCapabilities": {}
}
```

### `media:resumeConsumer`

### `media:closeProducer`

Frontend local producer to'xtaganda cleanup uchun ishlatiladi.

### `chat:send`

```json
{
  "message": "Salom"
}
```

### Teacher actions

- `teacher:muteUser`
- `teacher:removeUser`
- `teacher:allowScreenShare`
- `teacher:disableCamera`
- `teacher:disableMicrophone`

Payload odatda:

```json
{
  "userId": 1012
}
```

## Server -> Client

### `meeting:joined`

Meeting metadata, participantlar, producerlar va xabarlar.

### `meeting:left`

Current socket roomdan chiqdi.

### `participant:joined`

Yangi participant kirdi.

### `participant:left`

Participant chiqdi yoki chiqarildi.

### `media:newProducer`

Yangi producer paydo bo'ldi, client consume qiladi.

### `media:producerClosed`

Producer yopildi.

### `chat:newMessage`

Yangi chat xabari.

### `teacher:userMuted`

Teacher foydalanuvchining media imkonini to'xtatdi.

### `teacher:userRemoved`

Foydalanuvchi roomdan chiqarildi.

### `participant:permissionsUpdated`

Qo'shimcha event. Screen share / mic / camera permissionlari dinamik yangilanadi.

### `meeting:ended`

Meeting tugadi, client roomdan chiqishi kerak.

### `error`

Socket action xatolari.
