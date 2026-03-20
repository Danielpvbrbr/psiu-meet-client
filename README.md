# PsiuMeet Client

> A forma mais fácil e flexível de embutir videoconferências em tempo real (WebRTC) na sua aplicação React.

Nós cuidamos de toda a complexidade de sinais, túneis de rede (ICE/STUN) e troca de pacotes via Socket.io. Para você, entregamos apenas **Hooks limpos** e **Componentes de Vídeo modulares** para montar a interface do seu jeito — sem layouts engessados, sem iframes pesados. **100% customizável.**

---

## Características

| | |
|---|---|
| **Componentes "Lego"** | Exiba o vídeo onde e como quiser usando `<LocalVideo />` e `<RemoteVideo />` |
| **Headless Hook** | Acesse as funções puras de WebRTC usando `usePsiuFlash()` |
| **Tailwind Ready** | Todos os componentes aceitam `className` e `style` nativamente |
| **Seguro** | Tratamento automático de ausência de hardware (câmera/microfone) |
| **Topologia Mesh** | Suporte nativo para chamadas 1:1 e expansível para turmas pequenas |

---

## Instalação

```bash
npm install psiu-meet-client
```

> **Nota:** Esta biblioteca possui `socket.io-client` como dependência de comunicação com o backend.

---

## Quick Start

### 1. Configurando o Provider

Envolva sua aplicação (ou rota de vídeo) com o `PsiuFlashProvider`, passando a URL do seu servidor de sinalização.

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

### 2. Montando sua Sala de Vídeo

Use os componentes prontos para renderizar os vídeos e o Hook para controlar a chamada.

```jsx
import { LocalVideo, RemoteVideo, usePsiuFlash } from 'psiu-meet-client';
import { useEffect } from 'react';

export default function SalaDeAula() {
  const { startCamera, joinRoom, toggleMic, toggleCam, isMicOn, isCamOn } = usePsiuFlash();

  useEffect(() => {
    // 1. Liga a câmera do usuário ao abrir a tela
    startCamera().then(() => {
      // 2. Conecta na sala desejada
      joinRoom('id-da-sala-123', 'NomeDoUsuario');
    });
  }, []);

  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px' }}>

      {/* Vídeo remoto */}
      <div style={{ width: '600px', height: '400px', background: '#000' }}>
        <RemoteVideo fallbackText="Aguardando conexão..." />
      </div>

      {/* Vídeo local e controles */}
      <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <LocalVideo style={{ width: '100%', borderRadius: '8px' }} />

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

## Documentação da API

### `usePsiuFlash()`

Hook principal que expõe os controles e o estado da chamada.

| Método / Estado | Tipo | Descrição |
|---|---|---|
| `startCamera()` | `async Function` | Pede permissão e inicia a captura de áudio/vídeo do navegador |
| `joinRoom(roomId, userId)` | `Function` | Emite o evento de entrada na sala para o backend |
| `toggleMic()` | `Function` | Ativa/Desativa o envio do seu áudio na conexão WebRTC |
| `toggleCam()` | `Function` | Ativa/Desativa o envio do seu vídeo na conexão WebRTC |
| `isMicOn` | `Boolean` | `true` se o microfone estiver ativo |
| `isCamOn` | `Boolean` | `true` se a câmera estiver ativa |
| `localStream` | `MediaStream` | Objeto de vídeo/áudio bruto do próprio usuário |
| `remoteStreams` | `Array` | Lista de usuários conectados: `[{ userId, stream }]` | ---

### `<LocalVideo />`

Renderiza a câmera do próprio usuário. Vem **mutado por padrão** para evitar eco de áudio.

| Prop | Tipo | Descrição |
|---|---|---|
| `style` | `Object` | Estilos inline |
| `className` | `String` | Classes CSS / Tailwind | ---

### `<RemoteVideo />`

Renderiza a câmera de quem está do outro lado.

| Prop | Tipo | Descrição |
|---|---|---|
| `stream` | `MediaStream` | *(Opcional)* Stream específico — útil para salas com mais de 2 pessoas |
| `fallbackText` | `String` | Texto exibido enquanto o vídeo do outro usuário não conecta |
| `muted` | `Boolean` | Muta o áudio da pessoa para o usuário local |
| `style` | `Object` | Estilos inline |
| `className` | `String` | Classes CSS / Tailwind | ---

## ‍ Uso Avançado: Grid com Várias Pessoas

Para renderizar múltiplos participantes, faça um `.map()` na variável `remoteStreams`:

```jsx
import { usePsiuFlash, RemoteVideo } from 'psiu-meet-client';

export function GridDeAlunos() {
  const { remoteStreams } = usePsiuFlash();

  return (
    <div className="grid grid-cols-2 gap-4">
      {remoteStreams.map((aluno) => (
        <div key={aluno.userId} className="relative rounded-lg overflow-hidden">
          <RemoteVideo stream={aluno.stream} className="w-full h-full object-cover" />
          <span className="absolute bottom-2 left-2 bg-black/50 text-white px-2 rounded">
            {aluno.userId}
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

## Backend (Signaling Server)

Esta biblioteca foi projetada para se conectar a um servidor **Node.js + Socket.io**. Abaixo está o servidor de referência oficial do PsiuFlash.

### Dependências

```bash
npm install express socket.io cors
```

### `server.js`

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const activeRooms = new Map();

//  REST API 

/**
 * POST /api/rooms
 * Cria uma nova sala com expiração e limite de participantes.
 *
 * Body: { maxParticipants?: number, durationMinutes?: number }
 * Response: { roomId, expiresAt, maxParticipants }
 */
app.post('/api/rooms', (req, res) => {
  const { maxParticipants = 4, durationMinutes = 60 } = req.body;
  const roomId = crypto.randomUUID();
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;

  activeRooms.set(roomId, {
    id: roomId,
    maxParticipants,
    expiresAt,
    participants: new Set(),
  });

  console.log(`[+] Nova sala criada: ${roomId}`);
  res.status(201).json({ roomId, expiresAt, maxParticipants });
});

//  DASHBOARD 

/** GET /dashboard — Painel de monitoramento das salas ativas */
app.get('/dashboard', (req, res) => {
  const now = Date.now();
  let html = `
    <body style="background:#111; color:#0f0; font-family:monospace; padding:20px;">
    <h1> PsiuFlash — Dashboard</h1>
    <hr style="border-color:#333"/>
    <ul>
  `;

  if (activeRooms.size === 0) {
    html += '<li>Nenhuma sala ativa. </li>';
  } else {
    activeRooms.forEach((room, id) => {
      const min = Math.max(0, Math.floor((room.expiresAt - now) / 60000));
      if (min === 0) return activeRooms.delete(id);
      html += `
        <li>
          <strong>Sala:</strong> ${id} | <strong>Ocupação:</strong> ${room.participants.size}/${room.maxParticipants} | <strong>Expira em:</strong> ${min} min
        </li>
      `;
    });
  }

  res.send(html + '</ul></body>');
});

//  WEBRTC SIGNALING 

io.on('connection', (socket) => {

  socket.on('join-room', ({ roomId, userId }) => {
    const room = activeRooms.get(roomId);

    if (!room)
      return socket.emit('error', 'Sala não existe.');
    if (Date.now() > room.expiresAt) {
      activeRooms.delete(roomId);
      return socket.emit('error', 'Tempo expirou.');
    }
    if (room.participants.size >= room.maxParticipants)
      return socket.emit('error', 'Sala lotada.');

    socket.join(roomId);
    socket.join(userId); // Sala pessoal para mensagens diretas
    room.participants.add(userId);

    socket.roomId = roomId;
    socket.userId = userId;

    console.log(`[>] ${userId} entrou na sala ${roomId}`);
    socket.to(roomId).emit('user-connected', userId);

    // Repasse direto dos eventos WebRTC para o destinatário
    socket.on('offer',         (toId, offer)      => io.to(toId).emit('offer',         socket.userId, offer));
    socket.on('answer',        (toId, answer)      => io.to(toId).emit('answer',        socket.userId, answer));
    socket.on('ice-candidate', (toId, candidate)   => io.to(toId).emit('ice-candidate', socket.userId, candidate));
  });

  socket.on('disconnect', () => {
    if (socket.roomId && activeRooms.has(socket.roomId)) {
      activeRooms.get(socket.roomId).participants.delete(socket.userId);
      socket.to(socket.roomId).emit('user-disconnected', socket.userId);
      console.log(`[<] ${socket.userId} saiu.`);
    }
  });
});

//  START 

const PORT = 3333;
server.listen(PORT, () => console.log(` PsiuFlash voando na porta ${PORT}`));
```

### Fluxo de Eventos WebRTC

| Evento | Direção | Descrição |
|---|---|---|
| `join-room` | Cliente → Servidor | Entra na sala: `{ roomId, userId }` |
| `user-connected` | Servidor → Sala | Notifica os demais quando alguém entra |
| `user-disconnected` | Servidor → Sala | Notifica os demais quando alguém sai |
| `offer` | Cliente → Cliente | Oferta de conexão WebRTC (via servidor) |
| `answer` | Cliente → Cliente | Resposta à oferta WebRTC (via servidor) |
| `ice-candidate` | Cliente → Cliente | Candidatos ICE para estabelecer o túnel |
| `error` | Servidor → Cliente | Sala inexistente, expirada ou lotada | ### Criando uma Sala via API

```bash
curl -X POST http://localhost:3333/api/rooms \
  -H "Content-Type: application/json" \
  -d '{ "maxParticipants": 4, "durationMinutes": 60 }'
```

```json
{
  "roomId": "a3f2c1d4-...",
  "expiresAt": 1718000000000,
  "maxParticipants": 4
}
```

Use o `roomId` retornado para chamar `joinRoom(roomId, userId)` no frontend.

---

<p align="center">Desenvolvido com  e  para revolucionar a comunicação de sistemas.</p>
