import { usePsiuFlash } from './PsiuFlashContext';

export function TelaVideo({ estilo }) {
  const { localStream } = usePsiuFlash();
  
  return (
    <video 
      srcObject={localStream} 
      autoPlay 
      muted={true} // O seu próprio vídeo sempre mutado pra não dar eco
      style={estilo} // O dev passa o CSS que quiser aqui
    />
  );
}