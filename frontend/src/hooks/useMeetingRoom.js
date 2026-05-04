import { useEffect, useRef, useState } from 'react';
import { Device } from 'mediasoup-client';
import { io } from 'socket.io-client';
import { meetingApi } from '../api/meetingApi.js';
import { apiBaseUrl } from '../api/client.js';

// Socket default holatda REST API bilan bir xil origin'dan foydalanadi.
const socketUrl = import.meta.env.VITE_SOCKET_URL || apiBaseUrl;
const socketPath = import.meta.env.VITE_SOCKET_PATH || '/socket.io';

const removeById = (list, id, key = 'id') => list.filter((item) => item[key] !== id);
const isMediaActive = (mediaList, source) => mediaList.some((item) => item.source === source);

const toFriendlyError = (message) => {
  if (!message) {
    return 'Noma‘lum xato yuz berdi.';
  }

  if (message === 'websocket error') {
    return 'Socket ulanishida xato. Backend porti, CORS va socket server holatini tekshiring.';
  }

  if (message.includes('Socket join token')) {
    return 'Meetingga kirish tokeni topilmadi yoki muddati tugagan.';
  }

  return message;
};

export const useMeetingRoom = ({ meeting, auth, onRoomClosed }) => {
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const pendingProducersRef = useRef([]);
  const producersRef = useRef({
    camera: null,
    microphone: null,
    screen: null,
  });
  const consumerEntriesRef = useRef(new Map());
  const localStreamsRef = useRef({
    camera: null,
    microphone: null,
    screen: null,
  });

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [permissions, setPermissions] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [localMedia, setLocalMedia] = useState([]);
  const [remoteMedia, setRemoteMedia] = useState([]);

  const emitAck = async (eventName, payload = {}) => {
    const socket = socketRef.current;
    if (!socket) {
      throw new Error('Socket is not connected.');
    }

    return new Promise((resolve, reject) => {
      socket.emit(eventName, payload, (response) => {
        if (response?.success) {
          resolve(response.data);
          return;
        }

        reject(new Error(response?.error || `${eventName} failed.`));
      });
    });
  };

  const cleanupStream = (source) => {
    const stream = localStreamsRef.current[source];
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    localStreamsRef.current[source] = null;
    setLocalMedia((current) => current.filter((item) => item.source !== source));
  };

  const closeProducer = async (source, notifyServer = true) => {
    const producer = producersRef.current[source];
    if (!producer) {
      cleanupStream(source);
      return;
    }

    if (notifyServer && socketRef.current) {
      try {
        await emitAck('media:closeProducer', { producerId: producer.id });
      } catch (closeError) {
        console.warn(closeError.message);
      }
    }

    producer.close();
    producersRef.current[source] = null;
    cleanupStream(source);
  };

  const removeRemoteProducer = (producerId) => {
    for (const [consumerId, entry] of consumerEntriesRef.current.entries()) {
      if (entry.producerId === producerId) {
        entry.consumer.close();
        consumerEntriesRef.current.delete(consumerId);
      }
    }

    setRemoteMedia((current) => current.filter((item) => item.producerId !== producerId));
  };

  const teardownRoom = async (notifyLeave = false) => {
    const socket = socketRef.current;

    if (notifyLeave && socket) {
      try {
        await emitAck('meeting:leave');
      } catch (leaveError) {
        console.warn(leaveError.message);
      }
    }

    await Promise.all([
      closeProducer('camera', false),
      closeProducer('microphone', false),
      closeProducer('screen', false),
    ]);

    consumerEntriesRef.current.forEach((entry) => entry.consumer.close());
    consumerEntriesRef.current.clear();
    setRemoteMedia([]);
    setParticipants([]);
    setMessages([]);
    pendingProducersRef.current = [];

    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    deviceRef.current = null;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }

    setStatus('closed');
  };

  const createTransport = async (direction) => {
    const params = await emitAck('media:createWebRtcTransport', { direction });
    const device = deviceRef.current;
    const transport = direction === 'send'
      ? device.createSendTransport(params)
      : device.createRecvTransport(params);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitAck('media:connectTransport', {
        transportId: transport.id,
        dtlsParameters,
      }).then(() => callback()).catch(errback);
    });

    if (direction === 'send') {
      transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
        emitAck('media:produce', {
          transportId: transport.id,
          kind,
          rtpParameters,
          appData,
        }).then((result) => callback({ id: result.id })).catch(errback);
      });
    }

    transport.on('connectionstatechange', (state) => {
      if (state === 'failed' || state === 'closed') {
        setStatus('connection-issue');
      }
    });

    return transport;
  };

  const consumeProducer = async (producerInfo) => {
    if (!recvTransportRef.current || !deviceRef.current) {
      pendingProducersRef.current.push(producerInfo);
      return;
    }

    const duplicate = [...consumerEntriesRef.current.values()].some((entry) => entry.producerId === producerInfo.producerId);
    if (duplicate) {
      return;
    }

    const consumerData = await emitAck('media:consume', {
      transportId: recvTransportRef.current.id,
      producerId: producerInfo.producerId,
      rtpCapabilities: deviceRef.current.rtpCapabilities,
    });

    const consumer = await recvTransportRef.current.consume({
      id: consumerData.id,
      producerId: consumerData.producerId,
      kind: consumerData.kind,
      rtpParameters: consumerData.rtpParameters,
    });

    const stream = new MediaStream([consumer.track]);

    consumerEntriesRef.current.set(consumer.id, {
      consumer,
      producerId: producerInfo.producerId,
      userId: producerInfo.userId,
      source: producerInfo.source,
      stream,
    });

    setRemoteMedia((current) => [
      ...current,
      {
        id: consumer.id,
        producerId: producerInfo.producerId,
        userId: producerInfo.userId,
        fullName: producerInfo.fullName,
        source: producerInfo.source,
        kind: consumer.kind,
        stream,
      },
    ]);

    consumer.on('transportclose', () => {
      consumerEntriesRef.current.delete(consumer.id);
      setRemoteMedia((current) => removeById(current, consumer.id));
    });

    consumer.on('producerclose', () => {
      consumerEntriesRef.current.delete(consumer.id);
      setRemoteMedia((current) => removeById(current, consumer.id));
    });

    await emitAck('media:resumeConsumer', {
      consumerId: consumer.id,
    });
  };

  const startProducer = async (source) => {
    try {
      if (!permissions) {
        return;
      }

      const permissionMap = {
        camera: permissions.allowCamera,
        microphone: permissions.allowMicrophone,
        screen: permissions.allowScreenShare,
      };

      if (!permissionMap[source]) {
        throw new Error(`${source} uchun ruxsat yo'q.`);
      }

      if (!sendTransportRef.current) {
        throw new Error('Send transport tayyor emas.');
      }

      if (source === 'camera' && producersRef.current.camera) {
        await closeProducer('camera');
      }

      if (source === 'microphone' && producersRef.current.microphone) {
        await closeProducer('microphone');
      }

      if (source === 'screen' && producersRef.current.screen) {
        await closeProducer('screen');
      }

      const stream = source === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        : await navigator.mediaDevices.getUserMedia({
          video: source === 'camera',
          audio: source === 'microphone',
        });

      const track = source === 'microphone' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

      const producer = await sendTransportRef.current.produce({
        track,
        appData: {
          source,
        },
      });

      producer.on('trackended', () => {
        closeProducer(source).catch((closeError) => console.warn(closeError.message));
      });

      producer.on('transportclose', () => {
        producersRef.current[source] = null;
        cleanupStream(source);
      });

      producersRef.current[source] = producer;
      localStreamsRef.current[source] = stream;

      setLocalMedia((current) => [
        ...current.filter((item) => item.source !== source),
        {
          source,
          stream,
          kind: source === 'microphone' ? 'audio' : 'video',
          fullName: `${auth.user.fullName} (You)`,
        },
      ]);
      setError('');
    } catch (produceError) {
      setError(produceError.message);
    }
  };

  const sendMessage = async (message) => {
    try {
      if (!message.trim()) {
        return;
      }

      await emitAck('chat:send', { message });
      setError('');
    } catch (messageError) {
      setError(messageError.message);
    }
  };

  const teacherAction = async (eventName, payload) => {
    try {
      const result = await emitAck(eventName, payload);
      setError('');
      return result;
    } catch (actionError) {
      setError(actionError.message);
      return null;
    }
  };

  useEffect(() => {
    if (!meeting || !auth?.token) {
      return undefined;
    }

    let cancelled = false;

    const initializeRoom = async () => {
      setStatus('connecting');
      setError('');

      try {
        const joinTokenResponse = await meetingApi.createJoinToken(meeting.id, auth.token);
        if (cancelled) {
          return;
        }

        const socket = io(socketUrl, {
          path: socketPath,
          transports: ['websocket'],
          upgrade: false,
          forceNew: true,
          multiplex: false,
          auth: {
            joinToken: joinTokenResponse.token,
          },
          reconnectionAttempts: 3,
          timeout: 8000,
        });

        socketRef.current = socket;

        socket.on('connect_error', (connectError) => {
          setError(toFriendlyError(connectError.message));
          setStatus('error');
        });

        socket.on('error', (socketError) => {
          setError(toFriendlyError(socketError.message || 'Socket error'));
        });

        socket.on('disconnect', (reason) => {
          if (cancelled) {
            return;
          }

          if (reason !== 'io client disconnect') {
            setError(toFriendlyError(reason));
            setStatus('error');
          }
        });

        socket.on('participant:joined', (participant) => {
          setParticipants((current) => {
            const filtered = current.filter((item) => item.userId !== participant.userId);
            return [...filtered, participant];
          });
        });

        socket.on('participant:left', (participant) => {
          setParticipants((current) => current.filter((item) => item.userId !== participant.userId));
          setRemoteMedia((current) => current.filter((item) => item.userId !== participant.userId));
        });

        socket.on('chat:newMessage', (message) => {
          setMessages((current) => [...current, message]);
        });

        socket.on('media:newProducer', (producerInfo) => {
          consumeProducer(producerInfo).catch((consumeError) => {
            setError(consumeError.message);
          });
        });

        socket.on('media:producerClosed', (producerInfo) => {
          removeRemoteProducer(producerInfo.producerId);

          const currentProducers = producersRef.current;
          for (const [source, producer] of Object.entries(currentProducers)) {
            if (producer?.id === producerInfo.producerId) {
              closeProducer(source, false).catch((closeError) => console.warn(closeError.message));
            }
          }
        });

        socket.on('participant:permissionsUpdated', (payload) => {
          if (payload.userId === auth.user.id) {
            setPermissions(payload.permissions);
          }

          setParticipants((current) => current.map((item) => (
            item.userId === payload.userId
              ? { ...item, permissions: payload.permissions }
              : item
          )));
        });

        socket.on('teacher:userMuted', (payload) => {
          if (payload.userId !== auth.user.id) {
            return;
          }

          if (payload.kind === 'audio') {
            closeProducer('microphone', false).catch((closeError) => console.warn(closeError.message));
          }

          if (payload.kind === 'video') {
            closeProducer('camera', false).catch((closeError) => console.warn(closeError.message));
          }
        });

        socket.on('teacher:userRemoved', () => {
          setStatus('removed');
          teardownRoom(false).finally(() => {
            onRoomClosed?.('removed');
          });
        });

        socket.on('meeting:ended', () => {
          setStatus('ended');
          teardownRoom(false).finally(() => {
            onRoomClosed?.('ended');
          });
        });

        await new Promise((resolve, reject) => {
          socket.on('connect', resolve);
          socket.on('connect_error', reject);
        });

        const joinedRoom = await emitAck('meeting:join');
        setParticipants(joinedRoom.participants);
        setMessages(joinedRoom.messages);
        setPermissions(joinedRoom.permissions);

        const device = new Device();
        const routerRtpCapabilities = await emitAck('media:getRouterRtpCapabilities');
        await device.load({ routerRtpCapabilities });
        deviceRef.current = device;
        sendTransportRef.current = await createTransport('send');
        recvTransportRef.current = await createTransport('recv');

        for (const producer of joinedRoom.producers) {
          await consumeProducer(producer);
        }

        while (pendingProducersRef.current.length > 0) {
          const queuedProducer = pendingProducersRef.current.shift();
          await consumeProducer(queuedProducer);
        }

        setStatus('connected');
      } catch (roomError) {
        setError(toFriendlyError(roomError.message));
        setStatus('error');
      }
    };

    initializeRoom();

    return () => {
      cancelled = true;
      teardownRoom(false).catch((closeError) => console.warn(closeError.message));
    };
  }, [meeting?.id, auth?.token]);

  return {
    status,
    error,
    permissions,
    participants,
    messages,
    localMedia,
    remoteMedia,
    isCameraOn: isMediaActive(localMedia, 'camera'),
    isMicrophoneOn: isMediaActive(localMedia, 'microphone'),
    isScreenShareOn: isMediaActive(localMedia, 'screen'),
    startProducer,
    closeProducer,
    sendMessage,
    teacherAction,
    leaveRoom: async () => {
      try {
        await teardownRoom(true);
        onRoomClosed?.('left');
      } catch (leaveError) {
        setError(leaveError.message);
      }
    },
  };
};
