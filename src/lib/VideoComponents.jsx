import { useEffect, useRef } from 'react';
import { usePsiuFlash } from './PsiuFlashContext';

// ─────────────────────────────────────────────
// SHARPEN FILTER
// Renderizado uma única vez no DOM — LocalVideo e RemoteVideo
// referenciam o mesmo filtro pelo ID, sem duplicar.
// ─────────────────────────────────────────────
const SHARPEN_FILTER_ID = 'psiu-sharpen';

function SharpenFilter() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
      <defs>
        <filter
          id={SHARPEN_FILTER_ID}
          x="0" y="0" width="100%" height="100%"
          colorInterpolationFilters="sRGB"
        >
          {/*
            Unsharp mask 3x3 — realça bordas sem estourar cores.
            Kernel: centro 2.6, vizinhos -0.4 (soma = 1.0, sem shift de brilho).
            Suba o centro com cuidado: acima de 3.0 começa a aparecer halo.
          */}
          <feConvolveMatrix
            order="3"
            kernelMatrix="0 -0.4 0  -0.4 2.6 -0.4  0 -0.4 0"
            preserveAlpha="true"
          />
        </filter>
      </defs>
    </svg>
  );
}

// ─────────────────────────────────────────────
// ESTILOS BASE
// GPU layer dedicada via translateZ(0) elimina o blur de
// compositing que o browser aplica em vídeos sem camada própria.
// ─────────────────────────────────────────────
const BASE_VIDEO_STYLE = {
  objectFit: 'cover',
  transform: 'translateZ(0)',       // força camada GPU — não sobrescreva sem incluir isso
  willChange: 'transform',
  backfaceVisibility: 'hidden',
  filter: `url(#${SHARPEN_FILTER_ID}) contrast(1.04) saturate(1.08) brightness(1.03)`,
  transition: 'filter 0.3s ease',
};

// LocalVideo precisa do espelho — mas o transform não pode perder o translateZ(0)
const LOCAL_VIDEO_STYLE = {
  ...BASE_VIDEO_STYLE,
  transform: 'scaleX(-1) translateZ(0)',
};

// ─────────────────────────────────────────────
// LOCAL VIDEO
// ─────────────────────────────────────────────
export function LocalVideo({ style, className }) {
  const { localStream } = usePsiuFlash();
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && localStream) videoRef.current.srcObject = localStream;
  }, [localStream]);

  return (
    <>
      <SharpenFilter />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ ...LOCAL_VIDEO_STYLE, ...style }}
        className={className}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// REMOTE VIDEO
// ─────────────────────────────────────────────
export function RemoteVideo({ stream: streamProp, muted = false, style, className, fallbackText = 'Aguardando...' }) {
  const { remoteStreams } = usePsiuFlash();
  const videoRef = useRef();
  const activeStream = streamProp ?? remoteStreams[0]?.stream ?? null;

  useEffect(() => {
    if (videoRef.current && activeStream) videoRef.current.srcObject = activeStream;
  }, [activeStream]);

  if (!activeStream) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#64748b',
          fontSize: 14,
          width: '100%',
          height: '100%',
          ...style,
        }}
        className={className}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
          {fallbackText}
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      style={{ ...BASE_VIDEO_STYLE, ...style }}
      className={className}
    />
  );
}
