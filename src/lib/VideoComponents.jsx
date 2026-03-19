import { useEffect, useRef } from 'react';
import { usePsiuFlash } from './PsiuFlashContext';

export function LocalVideo({ style }) {
  const { localStream } = usePsiuFlash();
  const videoRef = useRef();
  
  useEffect(() => { 
    if (videoRef.current && localStream) videoRef.current.srcObject = localStream; 
  }, [localStream]);

  return (
    <video ref={videoRef} autoPlay playsInline muted={true} style={{ objectFit: 'cover', ...style }} />
  );
}

export function RemoteVideo({ muted = false, style, fallbackText = "Aguardando..." }) {
  const { remoteStreams } = usePsiuFlash();
  const videoRef = useRef();

  useEffect(() => { 
    if (videoRef.current && remoteStreams.length > 0) videoRef.current.srcObject = remoteStreams[0].stream; 
  }, [remoteStreams]);

  if (remoteStreams.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', color: '#64748b', fontSize: '14px', ...style }}>
        {fallbackText}
      </div>
    );
  }

  return (
    <video ref={videoRef} autoPlay playsInline muted={muted} style={{ objectFit: 'cover', ...style }} />
  );
}