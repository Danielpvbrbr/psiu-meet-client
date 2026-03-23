# psiu-meet-client

> A forma mais fácil de embutir videoconferências WebRTC em tempo real na sua aplicação React.

[![npm version](https://img.shields.io/npm/v/psiu-meet-client)](https://www.npmjs.com/package/psiu-meet-client)
[![license](https://img.shields.io/npm/l/psiu-meet-client)](https://github.com/Danielpvbrbr/psiu-meet-client/blob/main/LICENSE)
[![GitHub](https://img.shields.io/badge/github-Danielpvbrbr-black?logo=github)](https://github.com/Danielpvbrbr/psiu-meet-client)

 **Hooks limpos** e **Componentes de Vídeo modulares** — sem layouts engessados, sem iframes. 100% customizável.

---

## Índice

- [Instalação](#instalação)
- [Pré-requisito: o servidor](#pré-requisito-o-servidor)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Exemplos de uso](#exemplos-de-uso)
- [Notas Importantes](#notas-importantes)
- [Licença](#licença)

---

## Instalação

Uma única dependência. Tudo que a lib precisa já vem junto.

```bash
npm install psiu-meet-client
```

> A lib requer apenas `react` e `react-dom` — que você já tem no seu projeto.

---

## Pré-requisito: o servidor

A `psiu-meet-client` é o **cliente React**. Para funcionar, ela precisa de um servidor de sinalização rodando. O código completo do servidor está disponível no repositório:

👉 [github.com/Danielpvbrbr/psiumeet-server](https://github.com/Danielpvbrbr/psiumeet-server)

Suba o servidor, anote a URL (ex: `https://sua-api.com`) e use-a no `serverUrl` do Provider.

---

## Quick Start

### Passo 1 — Envolva a tela de vídeo com o Provider

```jsx
import { PsiuFlashProvider } from 'psiu-meet-client';
import SalaDeAula from './SalaDeAula';

export default function App() {
  return (
    <PsiuFlashProvider serverUrl="https://sua-api.com">
      <SalaDeAula />
    </PsiuFlashProvider>
  );
}
```

> Monte o `PsiuFlashProvider` **apenas na tela da videochamada**, não na raiz da aplicação. Cada Provider abre uma conexão independente com o servidor.

---

### Passo 2 — Monte sua tela de vídeo

```jsx
import { LocalVideo, RemoteVideo, usePsiuFlash, formatTime } from 'psiu-meet-client';
import { useEffect, useRef } from 'react';

export default function SalaDeAula() {
  const {
    connect, leaveRoom, onExpired,
    toggleMic, toggleCam,
    isMicOn, isCamOn,
    status, error, remainingMs,
  } = usePsiuFlash();

  const iniciouRef = useRef(false);

  // Registre o onExpired ANTES de chamar o connect
  useEffect(() => {
    onExpired(() => {
      leaveRoom();
      // redirecione o usuário aqui, ex: navigate('/fim')
    });
  }, []);

  useEffect(() => {
    if (iniciouRef.current) return;
    iniciouRef.current = true;

    // Professor: cria a sala e recebe o roomId para passar ao aluno
    connect({ papel: 'professor', nome: 'Daniel', tempo: 60 })
      .then(({ roomId }) => console.log('Compartilhe essa chave com o aluno:', roomId));

    // Aluno: entra em uma sala existente com a chave do professor
    // connect({ papel: 'aluno', nome: 'Gabriel', chave: 'id-da-sala' });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f1115', position: 'relative' }}>

      {/* Status e timer no canto superior esquerdo */}
      <div style={{ position: 'absolute', top: 16, left: 16, color: '#fff', fontFamily: 'monospace', zIndex: 10 }}>
        <span>Status: {status}</span>
        <span style={{ marginLeft: 12 }}>⏱ {formatTime(remainingMs)}</span>
        {error && <span style={{ marginLeft: 12, color: '#f87171' }}>{error}</span>}
      </div>

      {/* Vídeo do outro participante ocupa a tela toda */}
      <RemoteVideo
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        fallbackText="Aguardando o outro participante..."
      />

      {/* Seu próprio vídeo no canto superior direito (PiP) */}
      <div style={{ position: 'absolute', top: 16, right: 16, width: 240, aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden' }}>
        <LocalVideo style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
      </div>

      {/* Controles na parte inferior */}
      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12 }}>
        <button onClick={toggleMic}>{isMicOn ? '🎙 Mutar' : '🔇 Ativar Mic'}</button>
        <button onClick={toggleCam}>{isCamOn ? '📷 Desligar Cam' : '📷 Ligar Cam'}</button>
        <button onClick={leaveRoom} style={{ background: '#ef4444', color: '#fff', padding: '8px 20px', borderRadius: 8 }}>
          Sair
        </button>
      </div>

    </div>
  );
}
```

---

## API Reference

### `<PsiuFlashProvider />`

O Provider conecta ao servidor e disponibiliza o contexto para todos os componentes filhos. Deve ser montado uma única vez por sessão de chamada.

| Prop | Tipo | Padrão | Descrição |
|---|---|---|---|
| `serverUrl` | `String` | — | URL do servidor de sinalização |
| `vibes` | `Boolean` | `false` | Ativa sons de feedback via Web Audio API (entrada, saída, timer) |

```jsx
// Com feedback sonoro ativado
<PsiuFlashProvider serverUrl="https://sua-api.com" vibes>
  <SuaTela />
</PsiuFlashProvider>
```

---

### `usePsiuFlash()`

Hook principal — use dentro de qualquer componente filho do `PsiuFlashProvider`.

#### Funções

| Função | O que faz |
|---|---|
| `connect(payload)` | Liga a câmera e o microfone, depois entra ou cria a sala. Retorna `Promise<{ roomId }>` |
| `leaveRoom()` | Para a câmera, fecha a conexão e limpa tudo. Não precisa de reload |
| `onExpired(fn)` | Registra um callback que é chamado quando o tempo da sala acabar |
| `toggleMic()` | Liga ou desliga o envio do áudio sem parar a câmera |
| `toggleCam()` | Liga ou desliga o envio do vídeo sem parar o microfone |

#### Estado

| Estado | Tipo | Descrição |
|---|---|---|
| `status` | `String` | Estado atual da chamada — veja os valores abaixo |
| `error` | `String \| null` | Mensagem de erro quando `status === 'error'` |
| `remainingMs` | `Number \| null` | Tempo restante em milissegundos. `null` enquanto não conectar |
| `isMicOn` | `Boolean` | `true` se o microfone estiver ativo |
| `isCamOn` | `Boolean` | `true` se a câmera estiver ativa |
| `isSpeaking` | `Boolean` | `true` se o usuário local estiver falando (detecção por volume) |
| `remoteSpeaking` | `Boolean` | `true` se o participante remoto estiver falando |
| `connectionQuality` | `String` | Qualidade da conexão: `'good'` \| `'fair'` \| `'poor'` \| `'unknown'` |
| `localStream` | `MediaStream` | Stream bruto da câmera/microfone local — use para recursos customizados |
| `remoteStreams` | `Array` | Lista de participantes: `[{ userId, stream }]` |

#### Valores de `status`

| Valor | Significado |
|---|---|
| `idle` | Aguardando `connect()` ser chamado |
| `connecting` | Ligando câmera e entrando na sala |
| `connected` | Na sala, tudo funcionando |
| `reconnecting` | Socket caiu, tentando reconectar automaticamente |
| `expired` | Tempo da sala esgotado |
| `error` | Algo deu errado — veja `error` para detalhes |

#### Payload do `connect()`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `papel` | `String` | ✅ | `'professor'` cria a sala. `'aluno'` entra em uma existente |
| `nome` | `String` | ✅ | Nome do usuário — exibido para os outros participantes |
| `chave` | `String` | Só para aluno | ID da sala para entrar |
| `tempo` | `Number` | Só para professor | Duração em minutos. Padrão: `60` |
| `id` | `String` | ❌ | ID customizado do usuário. Se não passar, usa `nome` |
| `maxParticipants` | `Number` | ❌ | Máximo de participantes. Padrão: `2` |

---

### `<LocalVideo />`

Renderiza a câmera do próprio usuário. Vem **mutado por padrão** para evitar eco.

```jsx
<LocalVideo
  className="rounded-xl w-full h-full object-cover"
  style={{ transform: 'scaleX(-1)' }} // espelha como selfie
/>
```

| Prop | Tipo | Descrição |
|---|---|---|
| `style` | `Object` | Estilos inline |
| `className` | `String` | Classes CSS ou Tailwind |

---

### `<RemoteVideo />`

Renderiza o vídeo do participante remoto. Enquanto ele não estiver conectado, exibe o `fallbackText`.

```jsx
<RemoteVideo
  className="w-full h-full object-cover"
  fallbackText="Aguardando o professor..."
/>
```

| Prop | Tipo | Padrão | Descrição |
|---|---|---|---|
| `stream` | `MediaStream` | — | Stream específico — útil em salas com mais de 2 participantes |
| `fallbackText` | `String` | `"Aguardando..."` | Texto exibido enquanto ninguém está conectado |
| `muted` | `Boolean` | `false` | Muta o áudio remoto localmente |
| `style` | `Object` | — | Estilos inline |
| `className` | `String` | — | Classes CSS ou Tailwind |

---

### `formatTime(ms)`

Converte milissegundos em string `MM:SS`.

```js
import { formatTime } from 'psiu-meet-client';

formatTime(null)    // '--:--'
formatTime(300000)  // '05:00'
formatTime(90000)   // '01:30'
formatTime(0)       // '00:00'
```

---

## Exemplos de uso

### Alerta visual quando restar 5 minutos

```jsx
const { remainingMs } = usePsiuFlash();

const timerColor = remainingMs !== null && remainingMs < 300000 ? '#f87171' : '#fff';

<span style={{ color: timerColor, fontFamily: 'monospace', fontSize: 14 }}>
  ⏱ {formatTime(remainingMs)}
</span>
```

---

### Indicador de quem está falando

```jsx
const { isSpeaking, remoteSpeaking } = usePsiuFlash();

// Adiciona uma borda verde ao vídeo de quem está falando
<div style={{ border: isSpeaking ? '2px solid #4ade80' : '2px solid transparent' }}>
  <LocalVideo style={{ width: '100%' }} />
</div>

<div style={{ border: remoteSpeaking ? '2px solid #4ade80' : '2px solid transparent' }}>
  <RemoteVideo style={{ width: '100%' }} />
</div>
```

---

### Indicador de qualidade de conexão

```jsx
const { connectionQuality } = usePsiuFlash();

const cores = { good: '#4ade80', fair: '#facc15', poor: '#f87171', unknown: '#64748b' };
const labels = { good: 'Boa', fair: 'Regular', poor: 'Ruim', unknown: '...' };

<span style={{ color: cores[connectionQuality], fontSize: 12 }}>
  ● {labels[connectionQuality]}
</span>
```

---

### Grid com múltiplos participantes

```jsx
import { usePsiuFlash, RemoteVideo } from 'psiu-meet-client';

export function GridDeParticipantes() {
  const { remoteStreams } = usePsiuFlash();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
      {remoteStreams.map(({ userId, stream }) => (
        <div key={userId} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9' }}>
          <RemoteVideo
            stream={stream}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
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

### Redirecionar ao fim da aula

```jsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
const { onExpired, leaveRoom } = usePsiuFlash();

// Registre ANTES do connect()
useEffect(() => {
  onExpired(() => {
    leaveRoom();
    navigate('/fim-da-aula');
  });
}, []);
```

---

## Notas Importantes

**`connect()` faz tudo de uma vez**
Liga câmera, aguarda o socket conectar e entra na sala. Não precisa chamar nenhuma outra função antes.

**Registre `onExpired` antes de chamar `connect()`**
Se você registrar depois, pode perder o evento caso a sala já tenha expirado.

**`leaveRoom()` não precisa de reload**
Para câmera, fecha todos os peers e limpa o estado. Chame `connect()` de novo para uma nova sessão.

**Proteção contra dupla execução no StrictMode**
O React StrictMode executa `useEffect` duas vezes no desenvolvimento. Use um ref para evitar conexões duplicadas:

```js
const iniciouRef = useRef(false);

useEffect(() => {
  if (iniciouRef.current) return;
  iniciouRef.current = true;
  connect(payload);
}, []);
```

**HTTPS em produção**
Navegadores bloqueiam acesso à câmera e microfone em origens `http://` que não sejam `localhost`. Em produção, sempre use `https://`.

**Não monte mais de um Provider ao mesmo tempo**
Cada `<PsiuFlashProvider>` abre uma conexão independente com o servidor.

---

## Licença

MIT © [Daniel](https://github.com/Danielpvbrbr)

---

<p align="center">
  Feito com ❤️ por <a href="https://github.com/Danielpvbrbr">Danielpvbrbr</a>
</p>