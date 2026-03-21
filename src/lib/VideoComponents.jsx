import { useEffect, useRef } from 'react';
import { usePsiuFlash } from './PsiuFlashContext';

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