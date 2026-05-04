# mediasoup Working Flow

1. Teacher yoki student REST orqali `join-token` oladi.
2. Frontend `Socket.IO` ga shu token bilan ulanadi.
3. `meeting:join` orqali roomga kiriladi va attendance session ochiladi.
4. Client `media:getRouterRtpCapabilities` oladi.
5. Frontend `mediasoup-client Device` ni `load()` qiladi.
6. Client `send` va `recv` uchun alohida WebRTC transport yaratadi.
7. Kamera, mikrofon va screen share alohida producer sifatida publish qilinadi.
8. Har yangi producer uchun roomdagi boshqa socketlarga `media:newProducer` broadcast qilinadi.
9. Qolgan clientlar `media:consume` bilan tracklarni oladi va `resumeConsumer` chaqiradi.
10. Participant chiqsa yoki disconnect bo'lsa producer/consumer/transportlar yopiladi.
11. Meeting tugaganda `meeting:ended` yuboriladi, room memory va socketlar tozalanadi.
