import { useState } from 'react';
import { PsiuFlashProvider, usePsiuFlash, TelaVideo, SubTela } from './lib';

// ⚠️ Coloque o IP da sua máquina aqui (ex: http://192.168.1.15:3333)
const SERVIDOR_NODE = "http://localhost:3333"; 

function PainelDemo() {
  const { joinRoom, startCamera, toggleMic, toggleCam, isMicOn, isCamOn } = usePsiuFlash();
  const [codigoSala, setCodigoSala] = useState('');
  const [emChamada, setEmChamada] = useState(false);

  const iniciarDemo = async () => {
    await startCamera();
    
    // Se não digitou código, cria uma sala nova na API
    let salaId = codigoSala;
    if (!salaId) {
      const res = await fetch(`${SERVIDOR_NODE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 60, maxParticipants: 2 })
      });
      const data = await res.json();
      salaId = data.roomId;
      setCodigoSala(salaId); // Mostra o código gerado na tela
    }

    // Conecta usando o Hook da nossa biblioteca
    joinRoom(salaId, 'User-' + Math.random().toString(36).substring(7));
    setEmChamada(true);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui', background: '#0f172a', color: '#fff' }}>
      
      {/* MENU LATERAL FALSO (Só para dar cara de SaaS) */}
      <div style={{ width: '250px', background: '#1e293b', padding: '20px', borderRight: '1px solid #334155' }}>
        <h2 style={{ color: '#3b82f6', marginBottom: '40px' }}>Meu SaaS</h2>
        <p style={{ color: '#94a3b8', margin: '15px 0', cursor: 'pointer' }}>📊 Dashboard</p>
        <p style={{ color: '#94a3b8', margin: '15px 0', cursor: 'pointer' }}>👥 Clientes</p>
        <p style={{ color: '#fff', fontWeight: 'bold', margin: '15px 0', cursor: 'pointer' }}>📹 Atendimento Ao Vivo</p>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div style={{ flex: 1, padding: '40px' }}>
        <h1>Demonstração PsiuFlash</h1>
        <p style={{ color: '#94a3b8', marginBottom: '30px' }}>Veja como é fácil embutir vídeo no seu próprio layout usando as peças de Lego.</p>

        {!emChamada ? (
          <div style={{ background: '#1e293b', padding: '30px', borderRadius: '12px', width: '400px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px' }}>Tem um código de convite?</label>
            <input 
              value={codigoSala} 
              onChange={(e) => setCodigoSala(e.target.value)} 
              placeholder="Deixe em branco para criar sala"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff', marginBottom: '20px' }}
            />
            <button onClick={iniciarDemo} style={{ width: '100%', padding: '14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Iniciar Atendimento
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '20px', padding: '15px', background: '#1e293b', borderRadius: '8px', display: 'inline-block' }}>
               Sala Ativa: <strong style={{ color: '#10b981' }}>{codigoSala}</strong>
            </div>

            {/* AQUI ESTÁ A MÁGICA DOS LEGOS QUE VOCÊ PEDIU! */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              
              {/* O seu vídeo grande */}
              <div style={{ width: '700px', height: '450px', borderRadius: '16px', overflow: 'hidden', border: '4px solid #3b82f6', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                <TelaVideo estilo={{ width: '100%', height: '100%' }} />
              </div>

              {/* O painel lateral com o aluno e os controles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* O vídeo pequeno do aluno */}
                <div style={{ width: '300px', height: '200px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #334155' }}>
                  <SubTela mute={false} estilo={{ width: '100%', height: '100%' }} />
                </div>

                {/* Botões do seu sistema chamando as funções da biblioteca */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={toggleMic} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: isMicOn ? '#334155' : '#ef4444', color: '#fff', cursor: 'pointer' }}>
                    {isMicOn ? '🎙️ Mudo' : '🔇 Desmutar'}
                  </button>
                  <button onClick={toggleCam} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: isCamOn ? '#334155' : '#ef4444', color: '#fff', cursor: 'pointer' }}>
                    {isCamOn ? '📹 Ocultar' : '🚫 Mostrar'}
                  </button>
                </div>
                
                <button onClick={() => window.location.reload()} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  Encerrar Atendimento
                </button>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// O App envelopa tudo no Provedor
export default function App() {
  return (
    <PsiuFlashProvider serverUrl={SERVIDOR_NODE}>
      <PainelDemo />
    </PsiuFlashProvider>
  );
}