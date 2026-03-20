import React, { useEffect, useRef } from 'react';
import { usePsiuFlash } from './PsiuFlashContext';

// ============================================================================
// AS PEÇAS DE LEGO: Componentes visuais prontos para o cliente usar
// ============================================================================

/**
 * COMPONENTE: LocalVideo
 * Mostra a câmera e o microfone do próprio usuário (Quem está usando o PC).
 */
export function LocalVideo({ style, className }) {
  // Puxa apenas a câmera local lá do nosso "cérebro" (Contexto)
  const { localStream } = usePsiuFlash();
  
  // No React, nós não podemos passar um "Stream de Vídeo" direto numa propriedade de tag <video>.
  // Precisamos dessa "referência" para pegar a tag âncora do HTML real na tela.
  const videoRef = useRef();
  
  // Toda vez que o localStream nascer ou mudar (ex: usuário autorizou a câmera),
  // nós injetamos esse fluxo de dados cru (srcObject) direto na tag HTML do vídeo.
  useEffect(() => { 
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream; 
    }
  }, [localStream]);

  return (
    <video 
      ref={videoRef} // Conecta a tag HTML à nossa referência do React
      autoPlay       // OBRIGATÓRIO: Faz o vídeo rodar assim que carregar
      playsInline    // OBRIGATÓRIO: No iPhone/Safari, impede que o vídeo abra em Tela Cheia sozinho
      muted={true}   // OBRIGATÓRIO SER TRUE: Impede que o seu microfone saia na sua própria caixa de som (evita eco infinito)
      style={{ objectFit: 'cover', ...style }} // cover: Faz o vídeo preencher a caixa sem achatar a cara da pessoa
      className={className} // Permite que o cliente use Tailwind se quiser
    />
  );
}

/**
 * COMPONENTE: RemoteVideo
 * Mostra a câmera de quem está do outro lado da linha (O Aluno / O Cliente).
 */
export function RemoteVideo({ 
  stream: streamProp, // Permite que o cliente passe exatamente qual aluno ele quer mostrar aqui
  muted = false,      // Por padrão é false, porque você QUER escutar o aluno.
  style, 
  className, 
  fallbackText = "Aguardando..." // Texto bonito enquanto o vídeo não chega da internet
}) {
  
  // Puxa a lista completa de todo mundo que está conectado na sala
  const { remoteStreams } = usePsiuFlash();
  const videoRef = useRef();

  // A INTELIGÊNCIA DO COMPONENTE:
  // Se o desenvolvedor que está usando a biblioteca passou a prop "stream", usa ela (Ideal para salas com várias pessoas).
  // Se ele não passou nada, a gente quebra um galho e tenta puxar a primeira pessoa da lista (remoteStreams[0]).
  const activeStream = streamProp || (remoteStreams.length > 0 ? remoteStreams[0].stream : null);

  // Assim que o sinal de vídeo do aluno atravessar a internet e chegar aqui, injeta na tag HTML
  useEffect(() => { 
    if (videoRef.current && activeStream) {
      videoRef.current.srcObject = activeStream; 
    }
  }, [activeStream]);

  // Se o aluno ainda não entrou na sala (ou a internet dele caiu), 
  // mostramos uma caixa bonitinha com o texto de "Aguardando" ao invés de um buraco negro na tela.
  if (!activeStream) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: '#1e293b', // Cor de fundo padrão (pode ser sobrescrita pelo style/className)
          color: '#64748b', 
          fontSize: '14px', 
          width: '100%', 
          height: '100%', 
          ...style 
        }} 
        className={className}
      >
        {fallbackText}
      </div>
    );
  }

  // O aluno chegou! Renderiza o vídeo dele.
  return (
    <video 
      ref={videoRef} 
      autoPlay 
      playsInline 
      muted={muted} // Aqui respeita a prop (se o prof quiser "mutar" o aluno na tela dele, ele passa muted={true})
      style={{ objectFit: 'cover', ...style }} 
      className={className}
    />
  );
}