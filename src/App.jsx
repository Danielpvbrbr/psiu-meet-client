import { PsiuFlashProvider, LocalVideo, RemoteVideo, usePsiuFlash } from 'psiu-meet-client';
import { useEffect, useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, GripVertical, User, GraduationCap } from 'lucide-react';

const SERVER_URL = "http://localhost:3333";

// ============================================================================
// 1. DADOS DE TESTE (MOCK)
// ============================================================================
const jsonProfessor = { papel: 'professor', nome: 'Daniel', tempo: 60 };
const jsonAluno = { papel: 'aluno', nome: 'Gabriel' };

// ============================================================================
// 2. TELA DO PAINEL DE TESTE
// ============================================================================
function TelaDeMock({ onInjetarJson, salaAtivaId }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-slate-950 text-slate-200 font-sans p-6">
      <h1 className="text-3xl font-bold mb-2">Painel de Teste - PsiuMeet</h1>
      <p className="text-slate-400 mb-8">Abra duas abas: uma como Professor, outra como Aluno.</p>

      {salaAtivaId && (
        <div className="mb-8 p-4 bg-blue-900/50 border border-blue-500 rounded-xl text-blue-300">
          <strong>Sala ativa no momento:</strong> {salaAtivaId}
        </div>
      )}

      <div className="flex gap-8 w-full max-w-4xl">
        {/* Card Professor */}
        <div className="flex-1 bg-slate-900 border border-blue-500/30 p-8 rounded-3xl shadow-xl flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="text-blue-500" size={32} />
            <h2 className="text-2xl font-bold text-white">1. Criar Sala</h2>
          </div>
          <button 
            onClick={() => onInjetarJson(jsonProfessor)}
            className="mt-auto py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            Abrir como Professor
          </button>
        </div>

        {/* Card Aluno */}
        <div className="flex-1 bg-slate-900 border border-emerald-500/30 p-8 rounded-3xl shadow-xl flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <User className="text-emerald-500" size={32} />
            <h2 className="text-2xl font-bold text-white">2. Acessar Sala</h2>
          </div>
          <button 
            onClick={() => onInjetarJson(jsonAluno)}
            disabled={!salaAtivaId} 
            className="mt-auto py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salaAtivaId ? "Abrir como Aluno" : "Aguardando Professor..."}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. SALA DE VÍDEO PREMIUM (Agora com os seus Hooks!)
// ============================================================================
function SalaDeVideo({ payload, onSair, salaId, setSalaId }) {
  // 👇 AQUI ESTÁ A MÁGICA: Puxando exatamente os recursos da sua biblioteca!
  const { startCamera, joinRoom, toggleMic, toggleCam, isMicOn, isCamOn } = usePsiuFlash(); 
  
  const janelaVideoRef = useRef(null); 

  useEffect(() => {
    const conectarNoServidor = async () => {
      try {
        await startCamera();

        let idDaSalaParaConectar = salaId;

        if (payload.papel === 'professor') {
          const resposta = await fetch(`${SERVER_URL}/api/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxParticipants: 2, durationMinutes: payload.tempo })
          });
          
          const dadosApi = await resposta.json();
          idDaSalaParaConectar = dadosApi.roomId;
          setSalaId(idDaSalaParaConectar);
        }

        // 👇 USA A SUA FUNÇÃO PRONTA PARA CONECTAR NO SOCKET E NO WEBRTC
        console.log(`📡 Conectando na sala: ${idDaSalaParaConectar} como ${payload.nome}`);
        joinRoom(idDaSalaParaConectar, payload.nome);

      } catch (err) {
        console.error("Erro na conexão:", err);
      }
    };

    conectarNoServidor();
  }, []);

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden font-sans text-white">
      
      {/* Cabeçalho */}
      <div className="absolute top-6 left-6 z-30 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-mono text-slate-300">Sala: {salaId || 'Criando...'}</h2>
          <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${payload.papel === 'professor' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {payload.papel}
          </span>
        </div>
      </div>

      {/* Vídeo do Outro */}
      <div className="absolute inset-0 z-0">
        <RemoteVideo className="w-full h-full object-cover" fallbackText="" />
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm peer-empty:flex hidden">
           <p className="text-xl text-slate-400 font-medium animate-pulse">
             {payload.papel === 'professor' ? 'Aguardando o aluno entrar...' : 'Aguardando conexão de vídeo...'}
           </p>
        </div>
      </div>

      {/* Seu Vídeo (PiP Arrastável) */}
      <Draggable nodeRef={janelaVideoRef} bounds="parent" defaultPosition={{x: 0, y: 0}}>
        <div ref={janelaVideoRef} className="absolute top-6 right-6 z-20 w-72 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/5 flex group cursor-grab active:cursor-grabbing">
          <div className="absolute inset-y-0 left-0 w-6 flex items-center justify-center bg-slate-800/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <GripVertical size={16} className="text-white/40" />
          </div>
          <LocalVideo className="w-full h-full object-cover pl-0 group-hover:pl-6 transition-all duration-300" />
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded text-xs text-white/70">
            {payload.nome} (Você)
          </div>
        </div>
      </Draggable>

      {/* Controles (AGORA INTEGRADOS COM SUA BIBLIOTECA) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-slate-900/80 backdrop-blur-lg px-8 py-5 rounded-full shadow-2xl border border-white/10">
        
        <button 
          onClick={toggleMic} 
          className={`p-4 rounded-full transition-all duration-300 transform hover:scale-105 ${isMicOn ? 'bg-slate-800 text-white' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}
        >
          {isMicOn ? <Mic size={26} /> : <MicOff size={26} />}
        </button>
        
        <button 
          onClick={toggleCam} 
          className={`p-4 rounded-full transition-all duration-300 transform hover:scale-105 ${isCamOn ? 'bg-slate-800 text-white' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}
        >
          {isCamOn ? <VideoIcon size={26} /> : <VideoOff size={26} />}
        </button>
        
        <div className="w-px h-10 bg-white/10 mx-2"></div>
        
        <button 
          onClick={onSair} 
          className="flex items-center gap-3 px-8 py-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-lg shadow-lg shadow-red-500/30 transition-all duration-300 transform hover:scale-105"
        >
          <PhoneOff size={24} />
          <span>Sair</span>
        </button>

      </div>

    </div>
  );
}

// ============================================================================
// 4. COMPONENTE RAIZ
// ============================================================================
export default function App() {
  const [payload, setPayload] = useState(null);
  const [salaAtivaId, setSalaAtivaId] = useState(null); 

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950">
      {!payload ? (
        <TelaDeMock 
          onInjetarJson={(jsonRecebido) => setPayload(jsonRecebido)} 
          salaAtivaId={salaAtivaId} 
        />
      ) : (
        <PsiuFlashProvider serverUrl={SERVER_URL}>
          <SalaDeVideo 
            payload={payload} 
            salaId={salaAtivaId}
            setSalaId={setSalaAtivaId}
            onSair={() => {
              setPayload(null);
              // Recarrega a página ao sair para limpar streams antigos do navegador
              window.location.reload(); 
            }} 
          />
        </PsiuFlashProvider>
      )}
    </div>
  );
}