import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const PsiuFlashContext = createContext();

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
};

export function PsiuFlashProvider({ children, serverUrl }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  const peersRef = useRef({});
  const localStreamRef = useRef(null);

  useEffect(() => {
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    newSocket.on('user-connected', async (userId) => {
      const peer = createPeer(userId, newSocket, true);
      peersRef.current[userId] = peer;
    });

    newSocket.on('offer', async (userId, offer) => {
      const peer = createPeer(userId, newSocket, false);
      peersRef.current[userId] = peer;
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      newSocket.emit('answer', userId, answer);
    });

    newSocket.on('answer', async (userId, answer) => {
      const peer = peersRef.current[userId];
      if (peer) await peer.setRemoteDescription(new RTCSessionDescription(answer));
    });

    newSocket.on('ice-candidate', (userId, candidate) => {
      const peer = peersRef.current[userId];
      if (peer) peer.addIceCandidate(new RTCIceCandidate(candidate));
    });

    newSocket.on('user-disconnected', (userId) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setRemoteStreams(prev => prev.filter(stream => stream.userId !== userId));
    });

    return () => newSocket.disconnect();
  }, [serverUrl]);

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  const createPeer = (userId, socketInstance, isInitiator) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current));
    }

    peer.ontrack = (event) => {
      setRemoteStreams(prev => {
        if (prev.find(s => s.userId === userId)) return prev;
        return [...prev, { userId, stream: event.streams[0] }];
      });
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) socketInstance.emit('ice-candidate', userId, event.candidate);
    };

    if (isInitiator) {
      peer.onnegotiationneeded = async () => {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socketInstance.emit('offer', userId, offer);
      };
    }

    return peer;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
    } catch (error) { alert("Erro ao acessar câmera: " + error.message); }
  };

  const joinRoom = (roomId, userId) => { if (socket) socket.emit('join-room', { roomId, userId }); };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = !isMicOn;
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCam = () => {
    if (localStream) {
      localStream.getVideoTracks()[0].enabled = !isCamOn;
      setIsCamOn(!isCamOn);
    }
  };

  return (
    <PsiuFlashContext.Provider value={{ localStream, remoteStreams, startCamera, joinRoom, toggleMic, toggleCam, isMicOn, isCamOn }}>
      {children}
    </PsiuFlashContext.Provider>
  );
}

export const usePsiuFlash = () => useContext(PsiuFlashContext);