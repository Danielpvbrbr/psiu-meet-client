import { useEffect, useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, GripVertical, User, GraduationCap, Code } from 'lucide-react';
import { PsiuFlashProvider, usePsiuFlash } from './lib/PsiuFlashContext';
import { LocalVideo, RemoteVideo } from './lib/VideoComponents';

const SERVER_URL = 'http://localhost:3333';

// ============================================================================
// PAINEL DE TESTE
// ============================================================================
function TelaDeMock({ onInjetarJson, salaAtivaId }) {
  const [jsonProfStr, setJsonProfStr] = useState(
    JSON.stringify({ papel: 'professor', nome: 'Daniel', tempo: 60, chave: '' }, null, 2)
  );
  const [jsonAlunoStr, setJsonAlunoStr] = useState(
    JSON.stringify({ papel: 'aluno', nome: 'Gabriel', chave: salaAtivaId || '' }, null, 2)
  );

  useEffect(() => {
    if (!salaAtivaId) return;
    try {
      const obj = JSON.parse(jsonAlunoStr);
      setJsonAlunoStr(JSON.stringify({ ...obj, chave: salaAtivaId }, null, 2));
    } catch {}
  }, [salaAtivaId]);

  const handleInjetar = (jsonString) => {
    try {
      const payload = JSON.parse(jsonString);
      if (!payload.nome) return alert("O JSON precisa ter a propriedade 'nome'!");
      onInjetarJson(payload);
    } catch {
      alert('Erro de Sintaxe no JSON! Verifique as aspas e vírgulas.');
    }
  };

  const cardClass = (color) =>
    `flex-1 bg-slate-900 border border-${color}-500/30 hover:border-${color}-500/50 p-6 rounded-3xl shadow-xl flex flex-col transition-all`;

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-slate-950 text-slate-200 p-6 overflow-auto">
      <h1 className="text-3xl font-bold mb-2 text-white">Painel de Teste — PsiuMeet</h1>
      <p className="text-slate-400 mb-8">Edite o JSON livremente antes de conectar.</p>

      {salaAtivaId && (
        <div className="mb-8 p-4 bg-blue-900/30 border border-blue-500 rounded-xl text-blue-300 font-mono text-sm">
          <strong>Sala ativa:</strong> {salaAtivaId}
        </div>
      )}

      <div className="flex gap-8 w-full max-w-5xl">
        {[
          { label: 'Criar Sala (Professor)', icon: <GraduationCap className="text-blue-500" size={28} />, color: 'blue', json: jsonProfStr, setJson: setJsonProfStr, btnText: 'Conectar Professor' },
          { label: 'Acessar Sala (Aluno)',   icon: <User className="text-emerald-500" size={28} />,       color: 'emerald', json: jsonAlunoStr, setJson: setJsonAlunoStr, btnText: 'Conectar Aluno' },
        ].map(({ label, icon, color, json, setJson, btnText }) => (
          <div key={label} className={cardClass(color)}>
            <div className="flex items-center gap-3 mb-4">
              {icon}
              <h2 className="text-xl font-bold text-white">{label}</h2>
            </div>
            <div className="relative mb-6 flex-1">
              <Code className="absolute top-3 right-3 text-slate-500" size={20} />
              <textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                className={`w-full h-48 bg-slate-950 text-emerald-400 font-mono text-sm p-4 rounded-xl border border-slate-800 focus:border-${color}-500 outline-none resize-none shadow-inner`}
                spellCheck="false"
              />
            </div>
            <button
              onClick={() => handleInjetar(json)}
              className={`w-full py-4 bg-${color}-600 hover:bg-${color}-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-${color}-600/20 active:scale-[0.98]`}
            >
              {btnText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SALA DE VÍDEO
// ============================================================================
function SalaDeVideo({ payload, onSair, salaId, setSalaId }) {
  const { startCamera, joinRoom, toggleMic, toggleCam, isMicOn, isCamOn } = usePsiuFlash();
  const janelaVideoRef = useRef(null);
  const iniciouRef = useRef(false);

  useEffect(() => {
    if (iniciouRef.current) return;
    iniciouRef.current = true;

    const conectar = async () => {
      try {
        await startCamera();

        let roomId = payload.chave || salaId;

        if (payload.papel === 'professor' && !payload.chave) {
          const res = await fetch(`${SERVER_URL}/api/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maxParticipants: 2, durationMinutes: payload.tempo || 60 }),
          });
          const { roomId: id } = await res.json();
          roomId = id;
          setSalaId(roomId);
        }

        if (!roomId) { alert('Erro: Nenhuma chave de sala!'); return onSair(); }

        setTimeout(() => joinRoom(roomId, payload.nome), 800);
      } catch (err) {
        console.error('Erro ao conectar:', err);
      }
    };

    conectar();
  }, []);

  const isProfessor = payload.papel === 'professor';

  return (
    <div className="relative w-full h-screen bg-[#0f1115] overflow-hidden text-white">

      {/* Header */}
      <div className="absolute top-6 left-6 z-30 flex items-center gap-3 bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/5 shadow-lg">
        <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isProfessor ? 'bg-blue-500' : 'bg-emerald-500'}`} />
        <span className="text-sm font-medium text-slate-200 tracking-wide">
          Sala: {payload.chave || salaId || 'Conectando...'}
        </span>
        <span className="text-slate-500 mx-1">|</span>
        <span className="text-sm font-semibold text-slate-300 capitalize">{payload.nome}</span>
      </div>

      {/* Vídeo remoto (fundo) */}
      <div className="absolute inset-0 z-0 bg-[#0f1115]">
        <RemoteVideo className="w-full h-full object-cover" fallbackText="" />
      </div>

      {/* PiP arrastável */}
      <Draggable nodeRef={janelaVideoRef} bounds="parent" defaultPosition={{ x: window.innerWidth - 320, y: 24 }}>
        <div
          ref={janelaVideoRef}
          className="absolute z-20 w-64 aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700/50 group cursor-grab active:cursor-grabbing hover:border-blue-500/50 transition-colors"
        >
          <div className="absolute top-0 inset-x-0 h-6 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-start pt-1 z-30">
            <GripVertical size={14} className="text-white/60 rotate-90" />
          </div>
          <LocalVideo className="w-full h-full object-cover scale-x-[-1]" />
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[11px] font-medium z-30">
            Você
          </div>
        </div>
      </Draggable>

      {/* Controles */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-[#1c1f26]/90 backdrop-blur-lg px-6 py-4 rounded-2xl shadow-2xl border border-white/5">
        <ControlBtn onClick={toggleMic} active={isMicOn}>
          {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
        </ControlBtn>
        <ControlBtn onClick={toggleCam} active={isCamOn}>
          {isCamOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
        </ControlBtn>

        <div className="w-px h-8 bg-slate-700 mx-2" />

        <button
          onClick={onSair}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 font-medium shadow-lg shadow-red-500/20 transition-all active:scale-95"
        >
          <PhoneOff size={20} />
          Encerrar
        </button>
      </div>
    </div>
  );
}

function ControlBtn({ onClick, active, children }) {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all active:scale-95 ${active ? 'bg-slate-700/50 hover:bg-slate-600 text-white' : 'bg-red-500 text-white'}`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// RAIZ
// ============================================================================
export default function App() {
  const [payload, setPayload] = useState(null);
  const [salaAtivaId, setSalaAtivaId] = useState(null);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950">
      {!payload ? (
        <TelaDeMock onInjetarJson={setPayload} salaAtivaId={salaAtivaId} />
      ) : (
        <PsiuFlashProvider serverUrl={SERVER_URL}>
          <SalaDeVideo
            payload={payload}
            salaId={salaAtivaId}
            setSalaId={setSalaAtivaId}
            onSair={() => { setPayload(null); window.location.reload(); }}
          />
        </PsiuFlashProvider>
      )}
    </div>
  );
}