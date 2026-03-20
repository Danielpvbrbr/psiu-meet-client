import  { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

// ============================================================================
// 1. O CÉREBRO DA OPERAÇÃO (Contexto e WebRTC)
// ============================================================================

// Cria o contexto que vai espalhar as funções de vídeo para toda a aplicação
const PsiuFlashContext = createContext();

// Servidores STUN gratuitos do Google.
// Eles servem como um "Guia de Ruas" para descobrir o seu IP público e 
// permitir que o seu computador ache o computador do aluno através da internet.
const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
};

export function PsiuFlashProvider({ children, serverUrl }) {
  // --- ESTADOS (A Memória da Tela) ---
  const [localStream, setLocalStream] = useState(null); // Guarda a sua câmera e microfone
  const [remoteStreams, setRemoteStreams] = useState([]); // Guarda um array com as câmeras dos alunos: [{ userId, stream }]
  const [socket, setSocket] = useState(null); // Guarda a conexão com o servidor Node.js
  const [isMicOn, setIsMicOn] = useState(true); // Controla o visual do botão de Mute
  const [isCamOn, setIsCamOn] = useState(true); // Controla o visual do botão de Câmera

  // --- REFERÊNCIAS (Memória de Fundo que não recarrega a tela) ---
  const peersRef = useRef({}); // Um "caderninho" que anota todos os túneis WebRTC ativos (ex: { 'Gabriel': RTCPeerConnection })
  const localStreamRef = useRef(null); // Guarda a sua câmera atualizada para o WebRTC conseguir enxergar ela dentro das funções

  // ==========================================================================
  // A TELEFONISTA: Conexão com o Node.js via Socket.io
  // ==========================================================================
  useEffect(() => {
    if (!serverUrl) return; // Se não tem URL do backend, não faz nada
    
    // 1. Liga para o backend
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    // 2. Alguém entrou na sala!
    // O backend avisa que o aluno chegou. Você (Professor) começa a cavar o túnel até ele.
    newSocket.on('user-connected', async (userId) => {
      const peer = createPeer(userId, newSocket, true);
      peersRef.current[userId] = peer;
    });

    // 3. Recebendo uma chamada (Offer)
    // O outro lado enviou um convite de vídeo. Nós aceitamos e criamos uma resposta (Answer).
    newSocket.on('offer', async (userId, offer) => {
      const peer = createPeer(userId, newSocket, false); // false = Nós não iniciamos, só estamos respondendo
      peersRef.current[userId] = peer;
      
      await peer.setRemoteDescription(new RTCSessionDescription(offer)); // Aceita o formato de vídeo do outro
      const answer = await peer.createAnswer(); // Cria o nosso formato de vídeo
      await peer.setLocalDescription(answer); // Salva o nosso
      
      newSocket.emit('answer', userId, answer); // Manda a resposta de volta pro outro lado
    });

    // 4. Recebendo a resposta da chamada (Answer)
    // Se nós iniciamos a chamada (Passo 2), o outro lado vai responder aqui. O aperto de mão é concluído.
    newSocket.on('answer', async (userId, answer) => {
      const peer = peersRef.current[userId];
      if (peer) await peer.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // 5. Trocando pacotes de rede (Rotas de Internet)
    // Os computadores trocam seus IPs públicos para descobrirem o caminho mais curto entre eles.
    newSocket.on('ice-candidate', (userId, candidate) => {
      const peer = peersRef.current[userId];
      if (peer) peer.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // 6. Alguém saiu da sala
    newSocket.on('user-disconnected', (userId) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close(); // Fecha o túnel WebRTC com essa pessoa
        delete peersRef.current[userId]; // Apaga do caderninho
      }
      // Remove o vídeo da pessoa da tela
      setRemoteStreams(prev => prev.filter(stream => stream.userId !== userId));
    });

    // Quando o componente for destruído (fechar a aba), desconecta do servidor
    return () => newSocket.disconnect();
  }, [serverUrl]);

  // Mantém a referência da sua câmera sempre atualizada
  useEffect(() => { 
    localStreamRef.current = localStream; 
  }, [localStream]);

  // ==========================================================================
  // O ENGENHEIRO: Função que constrói o túnel de vídeo (WebRTC)
  // ==========================================================================
  const createPeer = (userId, socketInstance, isInitiator) => {
    // Cria a conexão base usando os servidores do Google
    const peer = new RTCPeerConnection(ICE_SERVERS);

    // Se você já ligou a sua câmera, joga ela dentro do túnel para enviar para o aluno
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current));
    }

    // Quando o vídeo do aluno chegar pelo túnel...
    peer.ontrack = (event) => {
      setRemoteStreams(prev => {
        // Evita duplicar o mesmo aluno na tela
        if (prev.find(s => s.userId === userId)) return prev;
        // Salva o vídeo novo no estado para o React desenhar na tela
        return [...prev, { userId, stream: event.streams[0] }];
      });
    };

    // Quando o servidor do Google descobrir o seu IP, manda ele pro aluno pelo Socket
    peer.onicecandidate = (event) => {
      if (event.candidate) socketInstance.emit('ice-candidate', userId, event.candidate);
    };

    // Se você for o primeiro a conectar (O Professor / isInitiator), 
    // cria o convite formal (Offer) e manda pro aluno.
    if (isInitiator) {
      peer.onnegotiationneeded = async () => {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socketInstance.emit('offer', userId, offer);
      };
    }

    return peer;
  };

  // ==========================================================================
  // AS FERRAMENTAS DO USUÁRIO (Ações exportadas para os botões)
  // ==========================================================================

  // Pede permissão e liga a webcam do usuário
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (error) { 
      console.error("Erro ao acessar câmera:", error);
      throw error;
    }
  };

  // Bate na porta do servidor Node.js para entrar em uma sala
  const joinRoom = (roomId, userId) => { 
    if (socket) {
      // Envia o objeto EXATAMENTE como o backend Node.js exige
      socket.emit('join-room', { roomId, userId }); 
      
      // Se a sala estiver lotada ou expirada, o backend devolve um erro aqui
      socket.on('error', (msg) => {
        console.error("Servidor recusou a entrada:", msg);
        alert("Erro na sala: " + msg);
      });
    }
  };

  // Corta fisicamente o áudio e troca o status do botão
  const toggleMic = () => {
    // A trava "length > 0" evita que o sistema trave se o PC não tiver microfone conectado
    if (localStream && localStream.getAudioTracks().length > 0) {
      localStream.getAudioTracks()[0].enabled = !isMicOn;
      setIsMicOn(!isMicOn);
    }
  };

  // Corta fisicamente a imagem (tela preta) e troca o status do botão
  const toggleCam = () => {
    // A trava "length > 0" evita que o sistema trave se o PC não tiver webcam conectada
    if (localStream && localStream.getVideoTracks().length > 0) {
      localStream.getVideoTracks()[0].enabled = !isCamOn;
      setIsCamOn(!isCamOn);
    }
  };

  return (
    // Embrulha as funções para que qualquer tela do sistema possa usá-las
    <PsiuFlashContext.Provider value={{ 
      localStream, remoteStreams, startCamera, joinRoom, toggleMic, toggleCam, isMicOn, isCamOn 
    }}>
      {children}
    </PsiuFlashContext.Provider>
  );
}

// Hook personalizado para o cliente importar facilmente as funções
export const usePsiuFlash = () => useContext(PsiuFlashContext);


// ============================================================================
// 2. AS PEÇAS DE LEGO (Componentes Visuais Isolados)
// ============================================================================

// Componente que mostra a SUA câmera
export function LocalVideo({ style, className }) {
  const { localStream } = usePsiuFlash();
  const videoRef = useRef();
  
  // Sempre que a variável localStream atualizar, joga ela dentro da tag <video> do HTML
  useEffect(() => { 
    if (videoRef.current && localStream) videoRef.current.srcObject = localStream; 
  }, [localStream]);

  return (
    <video 
      ref={videoRef} 
      autoPlay 
      playsInline 
      muted={true} // OBRIGATÓRIO SER TRUE: Se não, você escuta o próprio eco da sua voz
      style={{ objectFit: 'cover', ...style }} 
      className={className}
    />
  );
}

// Componente que mostra a câmera DO ALUNO / DO OUTRO
export function RemoteVideo({ stream: streamProp, muted = false, style, className, fallbackText = "Aguardando..." }) {
  const { remoteStreams } = usePsiuFlash();
  const videoRef = useRef();

  // INTELIGÊNCIA: Se o cliente montar um grid e passar o stream exato (streamProp), usa ele.
  // Se o cliente jogar o componente solto na tela (modo preguiçoso), tenta puxar o aluno 0 da lista.
  const activeStream = streamProp || (remoteStreams.length > 0 ? remoteStreams[0].stream : null);

  // Sempre que o sinal de vídeo chegar, injeta na tag <video> do HTML
  useEffect(() => { 
    if (videoRef.current && activeStream) {
      videoRef.current.srcObject = activeStream; 
    }
  }, [activeStream]);

  // Tela de "Aguardando" se o vídeo do outro ainda não chegou
  if (!activeStream) {
    return (
      <div 
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', color: '#64748b', fontSize: '14px', width: '100%', height: '100%', ...style }} 
        className={className}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <video 
      ref={videoRef} 
      autoPlay 
      playsInline 
      muted={muted} // O vídeo do aluno tem áudio liberado (false) por padrão para você ouvir ele
      style={{ objectFit: 'cover', ...style }} 
      className={className}
    />
  );
}