import { useEffect, useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, GripVertical, User, GraduationCap, Code } from 'lucide-react';
import { PsiuFlashProvider, usePsiuFlash, formatTime } from './lib/PsiuFlashContext';
import { LocalVideo, RemoteVideo } from './lib/VideoComponents';

const SERVER_URL  = 'http://localhost:3333';
const SESSION_KEY = 'psiu_session';

const readSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || {}; }
  catch { return {}; }
};

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

  const cards = [
    { label: 'Criar Sala (Professor)', icon: <GraduationCap className="text-blue-500" size={28} />,   color: 'blue',    json: jsonProfStr, setJson: setJsonProfStr, btnText: 'Conectar Professor' },
    { label: 'Acessar Sala (Aluno)',   icon: <User          className="text-emerald-500" size={28} />, color: 'emerald', json: jsonAlunoStr, setJson: setJsonAlunoStr, btnText: 'Conectar Aluno'    },
  ];

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
        {cards.map(({ label, icon, color, json, setJson, btnText }) => (
          <div key={label} className={`flex-1 bg-slate-900 border border-${color}-500/30 hover:border-${color}-500/50 p-6 rounded-3xl shadow-xl flex flex-col transition-all`}>
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
  const { connect, leaveRoom, onExpired, toggleMic, toggleCam, isMicOn, isCamOn, status, error, remainingMs } = usePsiuFlash();
  const janelaVideoRef = useRef(null);
  const iniciouRef     = useRef(false);

  useEffect(() => {
    // Quando a sala expirar: limpa e volta pro painel
    onExpired(() => {
      leaveRoom();
      onSair();
    });
  }, []);

  useEffect(() => {
    if (iniciouRef.current) return;
    iniciouRef.current = true;

    connect({ ...payload, chave: payload.chave || salaId })
      .then(({ roomId }) => { if (roomId) setSalaId(roomId); })
      .catch(console.error);
  }, []);

  const isProfessor = payload.papel === 'professor';
  const statusLabel = { connecting: 'Conectando...', reconnecting: 'Reconectando...', error }[status] ?? null;
  const statusColor = status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400';
  const timerColor  = remainingMs !== null && remainingMs < 300000 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300';

  const handleSair = () => { leaveRoom(); onSair(); };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden text-white">

      {/* Header */}
      <div className="absolute top-6 left-6 z-30 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-lg">
        <span className="text-xs font-mono text-slate-300">
          Sala: {payload.chave || salaId || 'Conectando...'}
        </span>
        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${isProfessor ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {payload.papel}
        </span>
        {statusLabel && (
          <span className={`px-2 py-0.5 text-[10px] rounded font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        )}
        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${timerColor}`}>
          ⏱ {formatTime(remainingMs)}
        </span>
      </div>

      {/* Vídeo remoto (fundo) */}
      <div className="absolute inset-0 z-0">
        <RemoteVideo className="w-full h-full object-cover" fallbackText="" />
      </div>

      {/* PiP arrastável */}
      <Draggable nodeRef={janelaVideoRef} bounds="parent" defaultPosition={{ x: 0, y: 0 }}>
        <div ref={janelaVideoRef} className="absolute top-6 right-6 z-20 w-72 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/5 group cursor-grab active:cursor-grabbing">
          <div className="absolute inset-y-0 left-0 w-6 flex items-center justify-center bg-slate-800/80 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical size={16} className="text-white/40" />
          </div>
          <LocalVideo className="w-full h-full object-cover scale-x-[-1]" />
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded text-xs text-white/70">
            {payload.nome} (Você)
          </div>
        </div>
      </Draggable>

      {/* Controles */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-slate-900/80 backdrop-blur-lg px-8 py-5 rounded-full shadow-2xl border border-white/10">
        <ControlBtn onClick={toggleMic} active={isMicOn}>
          {isMicOn ? <Mic size={26} /> : <MicOff size={26} />}
        </ControlBtn>
        <ControlBtn onClick={toggleCam} active={isCamOn}>
          {isCamOn ? <VideoIcon size={26} /> : <VideoOff size={26} />}
        </ControlBtn>
        <div className="w-px h-10 bg-white/10 mx-2" />
        <button
          onClick={handleSair}
          className="flex items-center gap-3 px-8 py-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-lg shadow-lg transition-all hover:scale-105"
        >
          <PhoneOff size={24} />
          Sair
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
  const [payload,     setPayload]     = useState(() => readSession().payload     || null);
  const [salaAtivaId, setSalaAtivaId] = useState(() => readSession().salaAtivaId || null);

  useEffect(() => {
    if (!payload) return;
    const roomId = payload.chave || salaAtivaId;
    if (roomId) localStorage.setItem(SESSION_KEY, JSON.stringify({ payload, salaAtivaId: roomId }));
  }, [payload, salaAtivaId]);

  const handleSair = () => {
    localStorage.removeItem(SESSION_KEY);
    setPayload(null);
    setSalaAtivaId(null);
  };

  const handleSetSalaId = (id) => {
    setSalaAtivaId(id);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ payload, salaAtivaId: id }));
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950">
      {!payload ? (
        <TelaDeMock onInjetarJson={setPayload} salaAtivaId={salaAtivaId} />
      ) : (
        <PsiuFlashProvider serverUrl={SERVER_URL} vibes>
          <SalaDeVideo
            payload={payload}
            salaId={salaAtivaId}
            setSalaId={handleSetSalaId}
            onSair={handleSair}
          />
        </PsiuFlashProvider>
      )}
    </div>
  );
}