import express from 'express';
import https from 'https';
import fs from 'fs';
import { Server } from 'socket.io';
import * as mediasoup from 'mediasoup';

const app = express();
const keyPath = '/home/carlosveerde/mediasoup-sfu-webrtc-video-rooms-1/backend/ssl/key.pem';
const certPath = '/home/carlosveerde/mediasoup-sfu-webrtc-video-rooms-1/backend/ssl/cert.pem';

async function CreateKey() {
  return fs.readFileSync(keyPath, 'utf8');
}

async function CreateCert() {
  return fs.readFileSync(certPath, 'utf8');
}

async function createServer() {
  const key = await CreateKey();
  const cert = await CreateCert();

  const server = https.createServer({
    key: key,
    cert: cert
  }, app);

  const io = new Server(server);

  // Variáveis globais para Mediasoup
  let worker: mediasoup.types.Worker;
  let router: mediasoup.types.Router;
  const transports = new Map<string, mediasoup.types.WebRtcTransport>();
  const producers = new Map<string, mediasoup.types.Producer>();

  // Função para iniciar o Worker do Mediasoup
  async function startMediasoup() {
    worker = await mediasoup.createWorker();
    router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {}
        }
      ]
    });
  }

  startMediasoup();

  io.on('connection', (socket) => {
    console.log('Novo cliente conectado');

    // Handler para criar um WebRTC Transport
    socket.on('createWebRtcTransport', async (data, callback) => {
      try {
        const transport = await router.createWebRtcTransport({
          listenIps: [{ ip: '0.0.0.0', announcedIp: 'seu.ips.anunciado' }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        });

        transports.set(transport.id, transport);

        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      } catch (error: unknown) {
        console.error('Erro ao criar WebRTC transport', error);
        callback({ error: (error as Error).message });
      }
    });

    // Handler para conectar o transport
    socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
      try {
        const transport = transports.get(transportId);
        if (transport) {
          await transport.connect({ dtlsParameters });
          callback();
        } else {
          callback({ error: 'Transport não encontrado' });
        }
      } catch (error: unknown) {
        console.error('Erro ao conectar transport', error);
        callback({ error: (error as Error).message });
      }
    });

    // Handler para produzir um fluxo de mídia
    socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
      try {
        const transport = transports.get(transportId);
        if (transport) {
          const producer = await transport.produce({ kind, rtpParameters });
          producers.set(producer.id, producer);
          callback({ id: producer.id });
        } else {
          callback({ error: 'Transport não encontrado' });
        }
      } catch (error: unknown) {
        console.error('Erro ao produzir', error);
        callback({ error: (error as Error).message });
      }
    });

    // Handler para desconectar o usuário e limpar recursos
    socket.on('disconnect', () => {
      console.log('Cliente desconectado');
      transports.forEach(transport => transport.close());
      producers.forEach(producer => producer.close());
    });
  });

  server.listen(3016, () => {
    console.log('Servidor rodando na porta 3016');
  });
}

createServer();
