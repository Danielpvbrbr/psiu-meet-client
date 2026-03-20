import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const PsiuFlashContext = createContext();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function PsiuFlashProvider({ children, serverUrl }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  const socketRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  // Mantém o ref sincronizado com o state
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Toda a lógica de signaling em um único effect
  useEffect(() => {
    if (!serverUrl) return;

    const socket = io(serverUrl);
    socketRef.current = socket;

    socket.on('user-connected',  (userId) => {
      peersRef.current[userId] = createPeer(userId, socket, true);
    });

    socket.on('offer', async (userId, offer) => {
      const peer = createPeer(userId, socket, false);
      peersRef.current[userId] = peer;
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer', userId, answer);
    });

    socket.on('answer', async (userId, answer) => {
      await peersRef.current[userId]?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', (userId, candidate) => {
      peersRef.current[userId]?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('user-disconnected', (userId) => {
      peersRef.current[userId]?.close();
      delete peersRef.current[userId];
      setRemoteStreams(prev => prev.filter(s => s.userId !== userId));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl]);

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

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const joinRoom = (roomId, userId) => {
    socketRef.current?.emit('join-room', { roomId, userId });
  };

  const toggleMic = () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (track) { track.enabled = !isMicOn; setIsMicOn(v => !v); }
  };

  const toggleCam = () => {
    if (!localStream) return;
    const track = localStream.getVideoTracks()[0];
    if (track) { track.enabled = !isCamOn; setIsCamOn(v => !v); }
  };

  return (
    <PsiuFlashContext.Provider value={{ localStream, remoteStreams, startCamera, joinRoom, toggleMic, toggleCam, isMicOn, isCamOn }}>
      {children}
    </PsiuFlashContext.Provider>
  );
}

export const usePsiuFlash = () => useContext(PsiuFlashContext);

// ============================================================================
// COMPONENTES DE VÍDEO
// ============================================================================

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