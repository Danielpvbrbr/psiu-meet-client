import { usePsiuFlash } from './PsiuFlashContext';

export function SubTela({ mute, estilo }) {
  const { remoteStreams } = usePsiuFlash();
  
  // Se não tiver ninguém na sala ainda, mostra uma caixinha vazia
  if (remoteStreams.length === 0) {
    return <div style={{ ...estilo, background: '#333' }}>Aguardando aluno...</div>;
  }

  // Se o aluno entrou, mostra o vídeo dele
  return (
    <video 
      srcObject={remoteStreams[0].stream} 
      autoPlay 
      muted={mute} 
      style={estilo} 
    />
  );
}