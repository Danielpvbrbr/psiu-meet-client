import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const PsiuFlashContext = createContext();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function PsiuFlashProvider({ children, serverUrl }) {
  const [localStream,   setLocalStream]  = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMicOn,       setIsMicOn]      = useState(true);
  const [isCamOn,       setIsCamOn]      = useState(true);
  const [status,        setStatus]       = useState('idle'); // idle | connecting | connected | reconnecting | error
  const [error,         setError]        = useState(null);
  const [remainingMs,   setRemainingMs]  = useState(null);

  const socketRef      = useRef(null);
  const peersRef       = useRef({});
  const localStreamRef = useRef(null);
  const sessionRef     = useRef(null);
  const remainingMsRef = useRef(null);

  // Mantém o ref sincronizado com o state
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Countdown local — decrementa 1s por vez, servidor corrige o drift a cada 10s
  useEffect(() => {
    const interval = setInterval(() => {
      if (remainingMsRef.current === null || remainingMsRef.current <= 0) return;
      remainingMsRef.current -= 1000;
      setRemainingMs(remainingMsRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const syncTimer = useCallback((ms) => {
    remainingMsRef.current = ms;
    setRemainingMs(ms);
  }, []);

  // ─────────────────────────────────────────────
  // SOCKET + SIGNALING
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!serverUrl) return;

    const socket = io(serverUrl, { reconnection: true, reconnectionDelay: 1500, reconnectionAttempts: 5 });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (sessionRef.current) {
        setStatus('reconnecting');
        const { roomId, userId } = sessionRef.current;
        socket.emit('join-room', { roomId, userId });
      }
    });

    socket.on('room-joined', ({ remainingMs }) => {
      syncTimer(remainingMs);
      setStatus('connected');
      setError(null);
    });

    socket.on('user-connected',    (userId)           => { peersRef.current[userId] = createPeer(userId, socket, true); });
    socket.on('user-disconnected', (userId)           => {
      peersRef.current[userId]?.close();
      delete peersRef.current[userId];
      setRemoteStreams(prev => prev.filter(s => s.userId !== userId));
    });

    socket.on('offer', async (userId, offer) => {
      const peer = createPeer(userId, socket, false);
      peersRef.current[userId] = peer;
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer', userId, answer);
    });

    socket.on('answer',        async (userId, answer)    => { await peersRef.current[userId]?.setRemoteDescription(new RTCSessionDescription(answer)); });
    socket.on('ice-candidate',       (userId, candidate) => { peersRef.current[userId]?.addIceCandidate(new RTCIceCandidate(candidate)); });

    socket.on('timer-update',  ({ remainingMs }) => syncTimer(remainingMs));
    socket.on('timer-paused',  ({ remainingMs }) => syncTimer(remainingMs));
    socket.on('timer-expired', ()                => { syncTimer(0); setStatus('error'); setError('Tempo da sala esgotado.'); });

    socket.on('error',      (msg) => { setError(msg); setStatus('error'); });
    socket.on('disconnect', ()    => { if (sessionRef.current) setStatus('reconnecting'); });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [serverUrl, syncTimer]);

  // ─────────────────────────────────────────────
  // WEBRTC
  // ─────────────────────────────────────────────
  const createPeer = (userId, socket, isInitiator) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    peer.ontrack = ({ streams: [stream] }) => {
      setRemoteStreams(prev =>
        prev.find(s => s.userId === userId) ? prev : [...prev, { userId, stream }]
      );
    };

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('ice-candidate', userId, candidate);
    };

    if (isInitiator) {
      peer.onnegotiationneeded = async () => {
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit('offer', userId, offer);
        } catch (err) {
          console.error('[WebRTC] Falha ao criar offer:', err);
        }
      };
    }

    localStreamRef.current?.getTracks().forEach(track =>
      peer.addTrack(track, localStreamRef.current)
    );

    return peer;
  };

  // ─────────────────────────────────────────────
  // API PÚBLICA
  // ─────────────────────────────────────────────
  const waitForSocket = () => new Promise((resolve, reject) => {
    const socket = socketRef.current;
    if (!socket)          return reject(new Error('Socket não inicializado'));
    if (socket.connected) return resolve(socket);
    socket.once('connect',       () => resolve(socket));
    socket.once('connect_error', () => reject(new Error('Falha ao conectar no servidor')));
  });

  const startSession = useCallback(async (roomId, userId) => {
    setStatus('connecting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      await waitForSocket();
      sessionRef.current = { roomId, userId };
      socketRef.current.emit('join-room', { roomId, userId });
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Permissão de câmera/microfone negada.'
        : err.message || 'Erro ao iniciar sessão.';
      setError(msg);
      setStatus('error');
      throw err;
    }
  }, []);

  const leaveRoom = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peersRef.current).forEach(p => p.close());
    peersRef.current  = {};
    sessionRef.current = null;
    syncTimer(null);
    setLocalStream(null);
    setRemoteStreams([]);
    setStatus('idle');
    setError(null);
    setIsMicOn(true);
    setIsCamOn(true);
  }, [syncTimer]);

  const toggleMic = useCallback(() => {
    const track = localStream?.getAudioTracks()[0];
    if (track) { track.enabled = !isMicOn; setIsMicOn(v => !v); }
  }, [localStream, isMicOn]);

  const toggleCam = useCallback(() => {
    const track = localStream?.getVideoTracks()[0];
    if (track) { track.enabled = !isCamOn; setIsCamOn(v => !v); }
  }, [localStream, isCamOn]);

  return (
    <PsiuFlashContext.Provider value={{
      localStream, remoteStreams, isMicOn, isCamOn, status, error, remainingMs,
      startSession, leaveRoom, toggleMic, toggleCam,
    }}>
      {children}
    </PsiuFlashContext.Provider>
  );
}

export const usePsiuFlash = () => useContext(PsiuFlashContext);

// ─────────────────────────────────────────────
// COMPONENTES DE VÍDEO
// ─────────────────────────────────────────────

export function LocalVideo({ style, className }) {
  const { localStream } = usePsiuFlash();
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && localStream) videoRef.current.srcObject = localStream;
  }, [localStream]);

  return <video ref={videoRef} autoPlay playsInline muted style={{ objectFit: 'cover', ...style }} className={className} />;
}

export function RemoteVideo({ stream: streamProp, muted = false, style, className, fallbackText = 'Aguardando...' }) {
  const { remoteStreams } = usePsiuFlash();
  const videoRef = useRef();
  const activeStream = streamProp ?? remoteStreams[0]?.stream ?? null;

  useEffect(() => {
    if (videoRef.current && activeStream) videoRef.current.srcObject = activeStream;
  }, [activeStream]);

  if (!activeStream) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', color: '#64748b', fontSize: 14, width: '100%', height: '100%', ...style }} className={className}>
        {fallbackText}
      </div>
    );
  }

  return <video ref={videoRef} autoPlay playsInline muted={muted} style={{ objectFit: 'cover', ...style }} className={className} />;
}