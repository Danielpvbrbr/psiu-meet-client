import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const PsiuFlashContext = createContext();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ─────────────────────────────────────────────
// PRESETS DE QUALIDADE
// ─────────────────────────────────────────────
export const VIDEO_QUALITY_PRESETS = {
  '480p': { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
};

export const VIDEO_QUALITY_BITRATE = {
  '480p': 1_000_000,
  '720p': 2_500_000,
  '1080p': 5_000_000,
};

// ─────────────────────────────────────────────
// VIBES
// ─────────────────────────────────────────────
function playTone({ frequency = 440, type = 'sine', duration = 0.3, volume = 0.3 } = {}) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => ctx.close();
  } catch { }
}

const vibesSounds = {
  joined: () => { playTone({ frequency: 440, duration: 0.15, volume: 0.2 }); setTimeout(() => playTone({ frequency: 554, duration: 0.15, volume: 0.2 }), 120); setTimeout(() => playTone({ frequency: 659, duration: 0.25, volume: 0.25 }), 240); },
  userConnected: () => { playTone({ frequency: 880, duration: 0.2, volume: 0.15 }); setTimeout(() => playTone({ frequency: 1100, duration: 0.2, volume: 0.15 }), 150); },
  userDisconnected: () => { playTone({ frequency: 660, duration: 0.15, volume: 0.15 }); setTimeout(() => playTone({ frequency: 440, duration: 0.25, volume: 0.15 }), 130); },
  timerWarning: () => { playTone({ frequency: 1000, duration: 0.08, volume: 0.1, type: 'square' }); },
  expired: () => { playTone({ frequency: 523, duration: 0.2, volume: 0.2 }); setTimeout(() => playTone({ frequency: 415, duration: 0.2, volume: 0.2 }), 180); setTimeout(() => playTone({ frequency: 330, duration: 0.4, volume: 0.2 }), 360); },
};

// ─────────────────────────────────────────────
// SPEAKING DETECTION
// ─────────────────────────────────────────────
function startSpeakingDetection(stream, onSpeaking) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const interval = setInterval(() => {
      analyser.getByteFrequencyData(data);
      onSpeaking(data.reduce((a, b) => a + b, 0) / data.length > 10);
    }, 100);
    return () => { clearInterval(interval); ctx.close(); };
  } catch { return () => { }; }
}

// ─────────────────────────────────────────────
// CONNECTION QUALITY
// ─────────────────────────────────────────────
function getQualityFromStats({ rtt, packetsLost, jitter }) {
  if (rtt === null) return 'unknown';
  if (rtt < 100 && packetsLost < 2 && jitter < 20) return 'good';
  if (rtt < 250 && packetsLost < 8 && jitter < 50) return 'fair';
  return 'poor';
}

async function measureConnectionQuality(peer, onQuality) {
  try {
    const stats = await peer.getStats();
    let rtt = null, packetsLost = 0, jitter = 0;
    stats.forEach(r => {
      if (r.type === 'remote-inbound-rtp') {
        rtt = r.roundTripTime ? r.roundTripTime * 1000 : null;
        packetsLost = r.packetsLost ?? 0;
        jitter = r.jitter ? r.jitter * 1000 : 0;
      }
    });
    onQuality(getQualityFromStats({ rtt, packetsLost, jitter }));
  } catch { }
}

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────
export function PsiuFlashProvider({ children, serverUrl, vibes = false }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [remainingMs, setRemainingMs] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  const [videoQuality, setVideoQualityState] = useState('720p');

  const socketRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const sessionRef = useRef(null);
  const remainingMsRef = useRef(null);
  const onExpiredRef = useRef(null);
  const vibesWarningFiredRef = useRef(false);
  const localSpeakingCleanupRef = useRef(null);
  const remoteSpeakingCleanupRef = useRef(null);
  const qualityIntervalRef = useRef(null);
  const videoQualityRef = useRef('720p');

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { videoQualityRef.current = videoQuality; }, [videoQuality]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (remainingMsRef.current === null || remainingMsRef.current <= 0) return;
      remainingMsRef.current -= 1000;
      setRemainingMs(remainingMsRef.current);
      if (vibes && remainingMsRef.current <= 300000 && remainingMsRef.current > 299000 && !vibesWarningFiredRef.current) {
        vibesWarningFiredRef.current = true;
        vibesSounds.timerWarning();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [vibes]);

  const syncTimer = useCallback((ms) => {
    remainingMsRef.current = ms;
    setRemainingMs(ms);
  }, []);

  // ─────────────────────────────────────────────
  // TROCA DE QUALIDADE EM TEMPO REAL
  // ─────────────────────────────────────────────
  const setVideoQuality = useCallback(async (preset) => {
    if (!VIDEO_QUALITY_PRESETS[preset]) return;

    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      await videoTrack.applyConstraints(VIDEO_QUALITY_PRESETS[preset]);
      setVideoQualityState(preset);
      videoQualityRef.current = preset;

      // Atualiza o bitrate em todos os peers conectados
      Object.values(peersRef.current).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track?.kind === 'video');
        if (!sender) return;
        const params = sender.getParameters();
        if (!params.encodings?.length) params.encodings = [{}];
        params.encodings[0].maxBitrate = VIDEO_QUALITY_BITRATE[preset];
        sender.setParameters(params).catch(() => { });
      });
    } catch (err) {
      console.warn('[PsiuFlash] applyConstraints falhou:', err);
    }
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
        socket.emit('join-room', sessionRef.current);
      }
    });

    socket.on('room-joined', ({ remainingMs }) => {
      syncTimer(remainingMs);
      setStatus('connected');
      setError(null);
      if (vibes) vibesSounds.joined();
    });

    socket.on('user-connected', (userId) => {
      peersRef.current[userId] = createPeer(userId, socket, true);
      if (vibes) vibesSounds.userConnected();
    });

    socket.on('user-disconnected', (userId) => {
      peersRef.current[userId]?.close();
      delete peersRef.current[userId];
      setRemoteStreams(prev => prev.filter(s => s.userId !== userId));
      if (vibes) vibesSounds.userDisconnected();
    });

    socket.on('offer', async (userId, offer) => {
      const peer = createPeer(userId, socket, false);
      peersRef.current[userId] = peer;
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer', userId, answer);
    });

    socket.on('answer', async (userId, answer) => { await peersRef.current[userId]?.setRemoteDescription(new RTCSessionDescription(answer)); });
    socket.on('ice-candidate', (userId, candidate) => { peersRef.current[userId]?.addIceCandidate(new RTCIceCandidate(candidate)); });
    socket.on('timer-update', ({ remainingMs }) => syncTimer(remainingMs));
    socket.on('timer-paused', ({ remainingMs }) => syncTimer(remainingMs));

    socket.on('timer-expired', () => {
      syncTimer(0);
      setStatus('expired');
      if (vibes) vibesSounds.expired();
      onExpiredRef.current?.();
    });

    socket.on('error', (msg) => { setError(msg); setStatus('error'); });
    socket.on('disconnect', () => { if (sessionRef.current) setStatus('reconnecting'); });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [serverUrl, syncTimer, vibes]);

  // ─────────────────────────────────────────────
  // WEBRTC
  // ─────────────────────────────────────────────
  const createPeer = (userId, socket, isInitiator) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        const sender = peer.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          const params = sender.getParameters();
          if (!params.encodings?.length) params.encodings = [{}];
          params.encodings[0].maxBitrate = VIDEO_QUALITY_BITRATE[videoQualityRef.current] ?? 2_500_000;
          sender.setParameters(params).catch(() => { });
        }
        qualityIntervalRef.current = setInterval(() => measureConnectionQuality(peer, setConnectionQuality), 3000);
      }
      if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) {
        clearInterval(qualityIntervalRef.current);
        setConnectionQuality('unknown');
      }
    };

    peer.ontrack = ({ streams: [stream] }) => {
      setRemoteStreams(prev => prev.find(s => s.userId === userId) ? prev : [...prev, { userId, stream }]);
      remoteSpeakingCleanupRef.current?.();
      remoteSpeakingCleanupRef.current = startSpeakingDetection(stream, setRemoteSpeaking);
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

    localStreamRef.current?.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current));
    return peer;
  };

  // ─────────────────────────────────────────────
  // API PÚBLICA
  // ─────────────────────────────────────────────
  const waitForSocket = () => new Promise((resolve, reject) => {
    const socket = socketRef.current;
    if (!socket) return reject(new Error('Socket não inicializado'));
    if (socket.connected) return resolve(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', () => reject(new Error('Falha ao conectar no servidor')));
  });

  const connect = useCallback(async ({ papel, nome, id, chave, tempo, maxParticipants = 2 }) => {
    setStatus('connecting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      localSpeakingCleanupRef.current?.();
      localSpeakingCleanupRef.current = startSpeakingDetection(stream, setIsSpeaking);

      await waitForSocket();

      let roomId = chave;

      if (papel === 'professor') {
        const res = await fetch(`${serverUrl}/api/rooms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxParticipants, durationMinutes: tempo || 60, roomId: chave || undefined }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        roomId = data.roomId;
      }

      if (!roomId) throw new Error('Nenhuma chave de sala fornecida.');

      const userId = id || nome;
      sessionRef.current = { roomId, userId };
      socketRef.current.emit('join-room', { roomId, userId });

      return { roomId };
    } catch (err) {
      const msg = err.name === 'NotAllowedError' ? 'Permissão de câmera/microfone negada.' : err.message || 'Erro ao conectar.';
      setError(msg);
      setStatus('error');
      throw err;
    }
  }, [serverUrl]);

  const leaveRoom = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peersRef.current).forEach(p => p.close());

    peersRef.current = {};
    sessionRef.current = null;
    onExpiredRef.current = null;
    vibesWarningFiredRef.current = false;

    localSpeakingCleanupRef.current?.();
    remoteSpeakingCleanupRef.current?.();
    localSpeakingCleanupRef.current = null;
    remoteSpeakingCleanupRef.current = null;
    clearInterval(qualityIntervalRef.current);
    qualityIntervalRef.current = null;

    syncTimer(null);
    setLocalStream(null);
    setRemoteStreams([]);
    setStatus('idle');
    setError(null);
    setIsMicOn(true);
    setIsCamOn(true);
    setIsSpeaking(false);
    setRemoteSpeaking(false);
    setConnectionQuality('unknown');
    setVideoQualityState('720p');
    videoQualityRef.current = '720p';
  }, [syncTimer]);

  const onExpired = useCallback((fn) => { onExpiredRef.current = fn; }, []);
  const toggleMic = useCallback(() => { const t = localStream?.getAudioTracks()[0]; if (t) { t.enabled = !isMicOn; setIsMicOn(v => !v); } }, [localStream, isMicOn]);
  const toggleCam = useCallback(() => { const t = localStream?.getVideoTracks()[0]; if (t) { t.enabled = !isCamOn; setIsCamOn(v => !v); } }, [localStream, isCamOn]);

  return (
    <PsiuFlashContext.Provider value={{
      localStream, remoteStreams, isMicOn, isCamOn, status, error, remainingMs,
      isSpeaking, remoteSpeaking, connectionQuality,
      videoQuality, setVideoQuality,
      connect, leaveRoom, toggleMic, toggleCam, onExpired,
    }}>
      {children}
    </PsiuFlashContext.Provider>
  );
}

export const usePsiuFlash = () => useContext(PsiuFlashContext);

export const formatTime = (ms) => {
  if (ms === null) return '--:--';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
