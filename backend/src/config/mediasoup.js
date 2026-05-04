import { env } from './env.js';

const useAnnouncedIp = Boolean(env.mediasoupAnnouncedIp);

export const mediasoupConfig = {
  worker: {
    logLevel: 'warn',
    logTags: ['ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    rtcMinPort: env.mediasoupMinPort,
    rtcMaxPort: env.mediasoupMaxPort,
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  },
  transport: {
    listenIps: [
      {
        ip: useAnnouncedIp ? '0.0.0.0' : env.mediasoupListenIp,
        announcedIp: useAnnouncedIp ? env.mediasoupAnnouncedIp : undefined,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1_000_000,
  },
};
