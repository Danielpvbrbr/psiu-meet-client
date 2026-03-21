# psiu-meet-client

> A forma mais fácil de embutir videoconferências WebRTC em tempo real na sua aplicação React.

[![npm version](https://img.shields.io/npm/v/psiu-meet-client)](https://www.npmjs.com/package/psiu-meet-client)
[![license](https://img.shields.io/npm/l/psiu-meet-client)](https://github.com/Danielpvbrbr/psiu-meet-client/blob/main/LICENSE)
[![GitHub](https://img.shields.io/badge/github-Danielpvbrbr-black?logo=github)](https://github.com/Danielpvbrbr/psiu-meet-client)

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
- [Licença](#licença)

---

## Características

| | |
|---|---|
| **Componentes prontos** | `<LocalVideo />` e `<RemoteVideo />` para montar o layout do seu jeito |
| **Hook headless** | `usePsiuFlash()` expõe todas as funções e o estado da chamada |
| **Tailwind Ready** | Todos os componentes aceitam `className` e `style` nativamente |
| **StrictMode Safe** | Compatível com React StrictMode — sem conexões duplicadas |
| **Reconexão automática** | Se o socket cair, reconecta e re-entra na sala automaticamente |
| **Timer por consumo** | O tempo só é consumido quando os dois participantes estão conectados |
| **Vibes** | Feedback sonoro opcional via Web Audio API — sem arquivos externos |
| **Topologia Mesh** | Suporte nativo a chamadas 1:1 e expansível para grupos pequenos |

---

## Instalação

```bash
npm install psiu-meet-client
```

### Dependências necessárias no seu projeto

```bash
npm install react react-dom socket.io-client
```

---

## Estrutura necessária

Antes de usar a biblioteca, você precisa ter um **servidor de sinalização** rodando. Veja a seção [Backend](#backend--servidor-de-sinalização) para o código completo.

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

Para ativar o feedback sonoro, passe a prop `vibes`:

```jsx
<PsiuFlashProvider serverUrl="http://localhost:3333" vibes>
```

> **Importante:** Monte o `PsiuFlashProvider` apenas na tela da videochamada, não no topo da aplicação inteira. Cada Provider abre uma conexão Socket independente.

---

### 2. Monte sua Sala de Vídeo

```jsx
import { LocalVideo, RemoteVideo, usePsiuFlash, formatTime } from 'psiu-meet-client';
import { useEffect, useRef } from 'react';

export default function SalaDeAula() {
  const {
    connect, leaveRoom, onExpired,
    toggleMic, toggleCam,
    isMicOn, isCamOn,
    status, error, remainingMs
  } = usePsiuFlash();

  const iniciouRef = useRef(false);

  useEffect(() => {
    onExpired(() => {
      leaveRoom();
      // redirecione o usuário aqui
    });
  }, []);

  useEffect(() => {
    if (iniciouRef.current) return;
    iniciouRef.current = true;

    // Professor — cria a sala automaticamente
    connect({ papel: 'professor', nome: 'Daniel', tempo: 60 })
      .then(({ roomId }) => console.log('Sala criada:', roomId))
      .catch(console.error);

    // Aluno — entra em uma sala existente
    // connect({ papel: 'aluno', nome: 'Gabriel', chave: 'id-da-sala' })
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f1115', position: 'relative' }}>

      <div style={{ position: 'absolute', top: 16, left: 16, color: '#fff', fontFamily: 'monospace' }}>
        <span>Status: {status}</span>
        <span style={{ marginLeft: 12 }}>⏱ {formatTime(remainingMs)}</span>
        {error && <span style={{ marginLeft: 12, color: 'red' }}>{error}</span>}
      </div>

      <RemoteVideo
        style={{ width: '100%', height: '100%' }}
        fallbackText="Aguardando o outro participante..."
      />

      <div style={{ position: 'absolute', top: 16, right: 16, width: 240, aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden' }}>
        <LocalVideo style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
      </div>

      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12 }}>
        <button onClick={toggleMic}>{isMicOn ? 'Mutar' : 'Ativar Mic'}</button>
        <button onClick={toggleCam}>{isCamOn ? 'Desligar Cam' : 'Ligar Cam'}</button>
        <button onClick={leaveRoom} style={{ background: 'red', color: '#fff' }}>Sair</button>
      </div>

    </div>
  );
}
```

---

## API Reference

### `<PsiuFlashProvider />`

| Prop | Tipo | Padrão | Descrição |
|---|---|---|---|
| `serverUrl` | `String` | — | URL do servidor de sinalização |
| `vibes` | `Boolean` | `false` | Ativa feedback sonoro via Web Audio API |

---

### `usePsiuFlash()`

Hook principal — deve ser usado dentro de um componente filho do `PsiuFlashProvider`.

| Método / Estado | Tipo | Descrição |
|---|---|---|
| `connect(payload)` | `async Function` | Liga câmera, cria ou entra na sala. Retorna `{ roomId }` |
| `leaveRoom()` | `Function` | Para câmera, fecha peers, limpa estado. Sem reload necessário |
| `onExpired(fn)` | `Function` | Registra callback chamado quando o tempo da sala esgotar |
| `toggleMic()` | `Function` | Ativa ou desativa o envio do seu áudio |
| `toggleCam()` | `Function` | Ativa ou desativa o envio do seu vídeo |
| `isMicOn` | `Boolean` | `true` se o microfone estiver ativo |
| `isCamOn` | `Boolean` | `true` se a câmera estiver ativa |
| `status` | `String` | `idle` \| `connecting` \| `connected` \| `reconnecting` \| `expired` \| `error` |
| `error` | `String` | Mensagem do último erro — `null` se não houver |
| `remainingMs` | `Number` | Tempo restante da sala em milissegundos — `null` até conectar |
| `localStream` | `MediaStream` | Stream bruto da câmera/microfone do próprio usuário |
| `remoteStreams` | `Array` | Lista dos participantes conectados: `[{ userId, stream }]` |

#### Payload do `connect()`

| Campo | Tipo | Descrição |
|---|---|---|
| `papel` | `String` | `'professor'` cria a sala, `'aluno'` entra em uma existente |
| `nome` | `String` | Nome do usuário — usado como `userId` |
| `chave` | `String` | *(Opcional)* ID da sala — obrigatório para o aluno |
| `tempo` | `Number` | *(Opcional)* Duração em minutos — padrão `60`, só para professor |

---

### `formatTime(ms)`

```js
import { formatTime } from 'psiu-meet-client';

formatTime(null)    // '--:--'
formatTime(300000)  // '05:00'
formatTime(90000)   // '01:30'
```

---

### `<LocalVideo />`

Renderiza a câmera do próprio usuário. Vem **mutado por padrão** para evitar eco de áudio.

| Prop | Tipo | Descrição |
|---|---|---|
| `style` | `Object` | Estilos inline |
| `className` | `String` | Classes CSS ou Tailwind |

---

### `<RemoteVideo />`

| Prop | Tipo | Padrão | Descrição |
|---|---|---|---|
| `stream` | `MediaStream` | — | *(Opcional)* Stream específico — útil para salas com múltiplos participantes |
| `fallbackText` | `String` | `"Aguardando..."` | Texto exibido enquanto o vídeo remoto não chega |
| `muted` | `Boolean` | `false` | Muta o áudio remoto localmente |
| `style` | `Object` | — | Estilos inline |
| `className` | `String` | — | Classes CSS ou Tailwind |

---

## Uso Avançado

### Reagir ao encerramento da sala

```jsx
useEffect(() => {
  onExpired(() => {
    leaveRoom();
    navigate('/fim-da-aula');
  });
}, []);
```

### Grid com múltiplos participantes

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

### Countdown visual com alerta de 5 minutos

```jsx
const timerColor = remainingMs !== null && remainingMs < 300000 ? 'red' : 'white';

<span style={{ color: timerColor, fontFamily: 'monospace' }}>
  ⏱ {formatTime(remainingMs)}
</span>
```

---

## Backend — Servidor de Sinalização

A biblioteca foi projetada para funcionar com um servidor **Node.js + Socket.io + SQLite**. O tempo é controlado por consumo ativo — só é debitado quando os dois participantes estão conectados ao mesmo tempo.

### Instalação

```bash
npm install express socket.io cors better-sqlite3
```

### Eventos WebRTC

| Evento | Direção | Payload | Descrição |
|---|---|---|---|
| `join-room` | Cliente → Servidor | `{ roomId, userId }` | Entra na sala |
| `room-joined` | Servidor → Cliente | `{ roomId, userId, remainingMs }` | Confirmação com tempo restante |
| `user-connected` | Servidor → Sala | `userId` | Outro participante entrou |
| `user-disconnected` | Servidor → Sala | `userId` | Participante saiu |
| `timer-update` | Servidor → Sala | `{ remainingMs }` | Sincronização do timer a cada 10s |
| `timer-paused` | Servidor → Sala | `{ remainingMs }` | Timer pausado — menos de 2 participantes |
| `timer-expired` | Servidor → Sala | — | Tempo esgotado — sala encerrada |
| `offer` | Cliente → Cliente | `(toId, offer)` | Oferta WebRTC |
| `answer` | Cliente → Cliente | `(toId, answer)` | Resposta WebRTC |
| `ice-candidate` | Cliente → Cliente | `(toId, candidate)` | Candidatos ICE |
| `error` | Servidor → Cliente | `mensagem string` | Sala inexistente, expirada, finalizada ou lotada |

### Rotas REST

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/rooms` | Cria uma sala. Body: `{ maxParticipants?, durationMinutes? }` |
| `GET` | `/api/rooms/:roomId` | Tempo restante e participantes online |
| `GET` | `/api/rooms/:roomId/history` | Histórico completo com entradas e saídas |
| `GET` | `/api/history` | Histórico geral de todas as salas |
| `GET` | `/dashboard` | Painel de monitoramento em HTML |

> O código completo do servidor está disponível no repositório: [github.com/Danielpvbrbr/psiu-meet-client](https://github.com/Danielpvbrbr/psiu-meet-client)

---

## Notas Importantes

**`connect()` substitui `startCamera()` + `joinRoom()`**
Cuida de tudo em uma chamada: liga câmera, aguarda socket e entra na sala. Professor cria a sala automaticamente se não passar `chave`.

**Registre `onExpired` antes de chamar `connect()`**

```js
useEffect(() => {
  onExpired(() => { leaveRoom(); onSair(); });
}, []);
```

**`leaveRoom()` não precisa de reload**
Para a câmera, fecha todos os peers e limpa o estado internamente.

**Timer por consumo ativo**
O tempo só é debitado quando os dois participantes estão conectados simultaneamente. Se a internet cair, o timer pausa e retoma quando reconectar.

**Proteção contra dupla execução no StrictMode**

```js
const iniciouRef = useRef(false);
useEffect(() => {
  if (iniciouRef.current) return;
  iniciouRef.current = true;
  connect(payload);
}, []);
```

**Múltiplos Providers**
Não monte mais de um `<PsiuFlashProvider>` ao mesmo tempo.

**HTTPS em produção**
Navegadores bloqueiam câmera e microfone em origens `http://` que não sejam `localhost`. Em produção, use `https://`.

---

## Licença

MIT © [Daniel](https://github.com/Danielpvbrbr)

---

<p align="center">
  Feito com ❤️ por <a href="https://github.com/Danielpvbrbr">Danielpvbrbr</a>
</p>
