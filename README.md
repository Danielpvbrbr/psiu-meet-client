# psiu-meet-client

> A forma mais fácil de embutir videoconferências WebRTC em tempo real na sua aplicação React.

Toda a complexidade de sinalização, túneis ICE/STUN e troca de pacotes via Socket.io fica escondida. Para você, apenas **Hooks limpos** e **Componentes de Vídeo modulares** — sem layouts engessados, sem iframes. 100% customizável.

---

## Índice

- [Características](#características)
- [Instalação](#instalação)
- [Estrutura necessária](#estrutura-necessária)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Uso Avançado](#uso-avançado)
- [Backend — Servidor de Sinalização](#backend--servidor-de-sinalização)
- [Notas Importantes](#notas-importantes)

---

## Características

| | |
|---|---|
| **Componentes prontos** | `<LocalVideo />` e `<RemoteVideo />` para montar o layout do seu jeito |
| **Hook headless** | `usePsiuFlash()` expõe todas as funções e o estado da chamada |
| **Tailwind Ready** | Todos os componentes aceitam `className` e `style` nativamente |
| **StrictMode Safe** | Compatível com React StrictMode — sem conexões duplicadas |
| **Topologia Mesh** | Suporte nativo a chamadas 1:1 e expansível para grupos pequenos |

---

## Instalação

```bash
npm install psiu-meet-client
```

### Dependências necessárias no seu projeto

A biblioteca usa as seguintes dependências como `peerDependencies` — elas precisam estar instaladas no seu projeto:

```bash
npm install react react-dom socket.io-client
```

---

## Estrutura necessária

Antes de usar a biblioteca, você precisa ter um **servidor de sinalização** rodando. Veja a seção [Backend](#backend--servidor-de-sinalização) para o código completo.

O fluxo completo é:

```
Seu App React
    └── PsiuFlashProvider (serverUrl)
            └── Conecta via Socket.io ao seu servidor
                    └── Servidor faz o repasse WebRTC entre os clientes
```

---

## Quick Start

### 1. Configure o Provider

Envolva a rota ou tela de vídeo com `PsiuFlashProvider`, passando a URL do seu servidor.

```jsx
import { PsiuFlashProvider } from 'psiu-meet-client';
import SalaDeAula from './SalaDeAula';

export default function App() {
  return (
    <PsiuFlashProvider serverUrl="http://localhost:3333">
      <SalaDeAula />
    </PsiuFlashProvider>
  );
}
```

> **Importante:** Monte o `PsiuFlashProvider` apenas na tela da videochamada, não no topo da aplicação inteira. Cada Provider abre uma conexão Socket independente.

---

### 2. Monte sua Sala de Vídeo

```jsx
import { LocalVideo, RemoteVideo, usePsiuFlash } from 'psiu-meet-client';
import { useEffect, useRef } from 'react';

export default function SalaDeAula() {
  const { startCamera, joinRoom, toggleMic, toggleCam, isMicOn, isCamOn } = usePsiuFlash();

  // useRef garante que a inicialização rode apenas uma vez,
  // mesmo com React StrictMode ativo em desenvolvimento.
  const iniciouRef = useRef(false);

  useEffect(() => {
    if (iniciouRef.current) return;
    iniciouRef.current = true;

    // OBRIGATÓRIO: sempre inicie a câmera ANTES de entrar na sala.
    startCamera().then(() => {
      joinRoom('id-da-sala', 'NomeDoUsuario');
    });
  }, []);

  return (
    <div style={{ display: 'flex', gap: 20, padding: 20 }}>

      {/* Vídeo de quem está do outro lado */}
      <div style={{ width: 600, height: 400, background: '#000' }}>
        <RemoteVideo fallbackText="Aguardando conexão..." />
      </div>

      {/* Seu vídeo e controles */}
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <LocalVideo style={{ width: '100%', borderRadius: 8 }} />

        <button onClick={toggleMic}>
          {isMicOn ? 'Mutar Microfone' : 'Ativar Microfone'}
        </button>
        <button onClick={toggleCam}>
          {isCamOn ? 'Desligar Câmera' : 'Ligar Câmera'}
        </button>
      </div>

    </div>
  );
}
```

---

### 3. Crie uma sala via API antes de entrar

O servidor expõe uma rota REST para criar salas. Chame ela antes de exibir a tela de vídeo:

```js
const res = await fetch('http://localhost:3333/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ maxParticipants: 2, durationMinutes: 60 }),
});

const { roomId } = await res.json();
// Passe o roomId para joinRoom(roomId, userId)
```

---

## API Reference

### `usePsiuFlash()`

Hook principal — deve ser usado dentro de um componente filho do `PsiuFlashProvider`.

| Método / Estado | Tipo | Descrição |
|---|---|---|
| `startCamera()` | `async Function` | Solicita permissão e inicia a captura de áudio e vídeo |
| `joinRoom(roomId, userId)` | `Function` | Entra na sala informada com o nome de usuário fornecido |
| `toggleMic()` | `Function` | Ativa ou desativa o envio do seu áudio |
| `toggleCam()` | `Function` | Ativa ou desativa o envio do seu vídeo |
| `isMicOn` | `Boolean` | `true` se o microfone estiver ativo |
| `isCamOn` | `Boolean` | `true` se a câmera estiver ativa |
| `localStream` | `MediaStream` | Stream bruto da câmera/microfone do próprio usuário |
| `remoteStreams` | `Array` | Lista dos participantes conectados: `[{ userId, stream }]` |

---

### `<LocalVideo />`

Renderiza a câmera do próprio usuário. Vem **mutado por padrão** para evitar eco de áudio.

| Prop | Tipo | Descrição |
|---|---|---|
| `style` | `Object` | Estilos inline |
| `className` | `String` | Classes CSS ou Tailwind |

---

### `<RemoteVideo />`

Renderiza a câmera do participante remoto.

| Prop | Tipo | Padrão | Descrição |
|---|---|---|---|
| `stream` | `MediaStream` | — | *(Opcional)* Stream específico — útil para salas com múltiplos participantes |
| `fallbackText` | `String` | `"Aguardando..."` | Texto exibido enquanto o vídeo remoto não chega |
| `muted` | `Boolean` | `false` | Muta o áudio remoto localmente |
| `style` | `Object` | — | Estilos inline |
| `className` | `String` | — | Classes CSS ou Tailwind |

---

## Uso Avançado

### Grid com múltiplos participantes

Use `remoteStreams` para renderizar um participante por célula:

```jsx
import { usePsiuFlash, RemoteVideo } from 'psiu-meet-client';

export function GridDeParticipantes() {
  const { remoteStreams } = usePsiuFlash();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
      {remoteStreams.map(({ userId, stream }) => (
        <div key={userId} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
          <RemoteVideo stream={stream} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <span style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
            {userId}
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

## Backend — Servidor de Sinalização

A biblioteca foi projetada para funcionar com um servidor **Node.js + Socket.io**. Abaixo está o servidor de referência oficial.

### Instalação

```bash
npm install express socket.io cors
```

### `server.js`

```js
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const activeRooms = new Map();

// ------------------------------------------
// REST API
// ------------------------------------------

// Cria uma nova sala com limite de participantes e tempo de expiração.
// Body:     { maxParticipants?: number, durationMinutes?: number }
// Response: { roomId, expiresAt, maxParticipants }
app.post('/api/rooms', (req, res) => {
  const { maxParticipants = 4, durationMinutes = 60 } = req.body;

  const roomId    = crypto.randomUUID();
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;

  activeRooms.set(roomId, { id: roomId, maxParticipants, expiresAt, participants: new Set() });

  console.log(`[+] Sala criada: ${roomId}`);
  res.status(201).json({ roomId, expiresAt, maxParticipants });
});

// Painel de monitoramento: GET /dashboard
app.get('/dashboard', (req, res) => {
  const now = Date.now();

  let rows = '';
  activeRooms.forEach((room, id) => {
    const min = Math.max(0, Math.floor((room.expiresAt - now) / 60000));
    if (min === 0) { activeRooms.delete(id); return; }
    rows += `<li>${id} — ${room.participants.size}/${room.maxParticipants} participantes — expira em ${min} min</li>`;
  });

  res.send(`
    <body style="background:#111;color:#0f0;font-family:monospace;padding:20px">
      <h1>PsiuFlash — Dashboard</h1>
      <hr style="border-color:#333"/>
      <ul>${rows || '<li>Nenhuma sala ativa.</li>'}</ul>
    </body>
  `);
});

// ------------------------------------------
// WebRTC Signaling
// ------------------------------------------

io.on('connection', (socket) => {

  socket.on('join-room', ({ roomId, userId }) => {
    const room = activeRooms.get(roomId);

    if (!room)
      return socket.emit('error', 'Sala não existe.');
    if (Date.now() > room.expiresAt) {
      activeRooms.delete(roomId);
      return socket.emit('error', 'Sala expirada.');
    }
    if (room.participants.size >= room.maxParticipants)
      return socket.emit('error', 'Sala lotada.');

    socket.join(roomId);
    socket.join(userId);
    room.participants.add(userId);

    socket.roomId = roomId;
    socket.userId = userId;

    console.log(`[>] ${userId} entrou na sala ${roomId}`);

    socket.to(roomId).emit('user-connected', userId);
  });

  // Repasse direto dos pacotes WebRTC entre os clientes
  socket.on('offer',         (toId, offer)     => io.to(toId).emit('offer',         socket.userId, offer));
  socket.on('answer',        (toId, answer)    => io.to(toId).emit('answer',        socket.userId, answer));
  socket.on('ice-candidate', (toId, candidate) => io.to(toId).emit('ice-candidate', socket.userId, candidate));

  socket.on('disconnect', () => {
    if (socket.roomId && activeRooms.has(socket.roomId)) {
      activeRooms.get(socket.roomId).participants.delete(socket.userId);
      socket.to(socket.roomId).emit('user-disconnected', socket.userId);
      console.log(`[<] ${socket.userId} saiu.`);
    }
  });
});

// ------------------------------------------
// Start
// ------------------------------------------

const PORT = 3333;
server.listen(PORT, () => console.log(`PsiuFlash rodando na porta ${PORT}`));
```

### Eventos WebRTC

| Evento | Direção | Payload |
|---|---|---|
| `join-room` | Cliente → Servidor | `{ roomId, userId }` |
| `user-connected` | Servidor → Sala | `userId` |
| `user-disconnected` | Servidor → Sala | `userId` |
| `offer` | Cliente → Cliente | `(toId, offer)` |
| `answer` | Cliente → Cliente | `(toId, answer)` |
| `ice-candidate` | Cliente → Cliente | `(toId, candidate)` |
| `error` | Servidor → Cliente | `mensagem string` |

### Exemplo de criação de sala via curl

```bash
curl -X POST http://localhost:3333/api/rooms \
  -H "Content-Type: application/json" \
  -d '{ "maxParticipants": 2, "durationMinutes": 60 }'
```

```json
{
  "roomId": "a3f2c1d4-...",
  "expiresAt": 1718000000000,
  "maxParticipants": 2
}
```

---

## Notas Importantes

**Ordem de inicialização obrigatória**
Sempre chame `startCamera()` antes de `joinRoom()`. Se a câmera não estiver ativa no momento da negociação WebRTC, nenhuma track de vídeo ou áudio será enviada.

**Proteção contra dupla execução**
Em desenvolvimento com React StrictMode, o `useEffect` executa duas vezes. Use um `useRef` de guarda para garantir que `startCamera()` e `joinRoom()` sejam chamados apenas uma vez:

```js
const iniciouRef = useRef(false);

useEffect(() => {
  if (iniciouRef.current) return;
  iniciouRef.current = true;
  // ... sua lógica aqui
}, []);
```

**Múltiplos Providers**
Não monte mais de um `<PsiuFlashProvider>` ao mesmo tempo. Cada instância abre uma conexão Socket independente e isso gera conflito nos eventos WebRTC.

**HTTPS em produção**
Navegadores bloqueiam acesso à câmera e microfone em origens `http://` que não sejam `localhost`. Em produção, seu servidor e seu frontend precisam rodar em `https://`.

---

<p align="center">Feito para simplificar comunicação em tempo real.</p>