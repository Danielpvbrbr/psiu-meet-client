import { useEffect, useRef, useState } from 'react';
import { usePsiuFlash } from './PsiuFlashContext';

const VideoPlayer = ({ stream, isLocal, name }) => {
  const videoRef = useRef();
  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);

  return (
    <div style={{ position: 'relative', background: '#1e293b', borderRadius: '16px', overflow: 'hidden', width: '100%', height: '100%', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <span style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', backdropFilter: 'blur(4px)' }}>{name}</span>
    </div>
  );
};

export function PsiuFlashMeet({ serverUrl }) {
  const { startCamera, localStream, remoteStreams, joinRoom, toggleMic, toggleCam, isMicOn, isCamOn } = usePsiuFlash();
  const [roomId, setRoomId] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [conectado, setConectado] = useState(false);

  useEffect(() => { startCamera(); }, []);

  const handleCriarSala = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 60, maxParticipants: 4 })
      });
      const data = await res.json();
      setRoomId(data.roomId);
      joinRoom(data.roomId, 'Prof-' + Math.random().toString(36).substring(7));
      setConectado(true);
    } catch (error) { alert("Erro ao criar sala. Verifique o servidor."); }
  };

  const handleEntrarSala = () => {
    if (!inputRoomCode) return alert("Digite o código da sala!");
    setRoomId(inputRoomCode);
    joinRoom(inputRoomCode, 'Aluno-' + Math.random().toString(36).substring(7));
    setConectado(true);
  };

  const totalPessoas = 1 + remoteStreams.length;

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui', background: '#0f172a', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>⚡ PsiuFlash Meet</h2>
        {conectado && <div style={{ background: '#1e293b', padding: '10px 20px', borderRadius: '8px', fontSize: '14px' }}>Código: <strong style={{ color: '#10b981' }}>{roomId}</strong></div>}
      </div>

      {!conectado ? (
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '10vh' }}>
          <div style={{ background: '#1e293b', padding: '30px', borderRadius: '16px', width: '320px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Nova Aula</h3>
            <button onClick={handleCriarSala} style={{ width: '100%', padding: '14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Criar Sala</button>
          </div>
          <div style={{ background: '#1e293b', padding: '30px', borderRadius: '16px', width: '320px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Entrar na Aula</h3>
            <input type="text" placeholder="Código..." value={inputRoomCode} onChange={e => setInputRoomCode(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff' }} />
            <button onClick={handleEntrarSala} style={{ width: '100%', padding: '14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Participar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ flex: 1, display: 'grid', gap: '20px', padding: '10px', gridTemplateColumns: totalPessoas === 1 ? '1fr' : totalPessoas === 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', maxHeight: '75vh' }}>
            {localStream ? <VideoPlayer stream={localStream} isLocal={true} name="Você" /> : <div style={{ background: '#1e293b', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Câmera Off</div>}
            {remoteStreams.map(peer => <VideoPlayer key={peer.userId} stream={peer.stream} isLocal={false} name="Aluno" />)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', padding: '20px', marginTop: 'auto' }}>
            <button onClick={toggleMic} style={{ padding: '15px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: isMicOn ? '#334155' : '#ef4444', color: 'white', width: '60px', height: '60px', fontSize: '20px' }}>{isMicOn ? '🎙️' : '🔇'}</button>
            <button onClick={toggleCam} style={{ padding: '15px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: isCamOn ? '#334155' : '#ef4444', color: 'white', width: '60px', height: '60px', fontSize: '20px' }}>{isCamOn ? '📹' : '🚫'}</button>
            <button onClick={() => window.location.reload()} style={{ padding: '15px 30px', borderRadius: '30px', border: 'none', cursor: 'pointer', background: '#ef4444', color: 'white', fontWeight: 'bold' }}>Sair</button>
          </div>
        </div>
      )}
    </div>
  );
}