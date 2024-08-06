// src/app.ts
import express from 'express';
import fs from 'fs';
import http2 from 'http2';
import { Server } from 'socket.io';
import { createWorker } from 'mediasoup';
import config from './config';
import { Room } from './Room';
import { Peer } from './Peer';
import http2Express from 'http2-express-bridge';

const app = http2Express(express);
const options = {
  key: fs.readFileSync('./ssl/key.pem', 'utf8'),
  cert: fs.readFileSync('./ssl/cert.pem', 'utf8')
};

// Middleware para logs de requisições
app.use((req, res, next) => {
  console.log(`Received request for ${req.url}`);
  next();
});

// Serve arquivos estáticos do diretório public
app.use(express.static('public'));

// Rota de teste para verificar se o servidor está respondendo
app.get('/test', (req, res) => {
  res.send('Servidor está rodando corretamente.');
});

// Rota padrão para verificar se o servidor está respondendo
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Use http2 para criar o servidor HTTPS/2
const httpsServer = http2.createSecureServer(options, app);
const io = new Server(httpsServer);

let workers: any[] = [];
let nextMediasoupWorkerIdx = 0;

(async () => {
  for (let i = 0; i < config.mediasoup.numWorkers; i++) {
    let worker = await createWorker({
      logLevel: config.mediasoup.worker.logLevel as any,
      logTags: config.mediasoup.worker.logTags as any,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort
    });

    worker.on('died', () => {
      console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }
})();

const roomList = new Map<string, Room>();

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('joinRoom', async ({ room_id, name }, callback) => {
    if (!roomList.has(room_id)) {
      let worker = workers[nextMediasoupWorkerIdx];
      nextMediasoupWorkerIdx++;
      if (nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;
      const room = new Room(room_id, worker, io);
      await room.initializeRouter(worker); // Certifique-se de que o Router está inicializado
      roomList.set(room_id, room);
    }

    const room = roomList.get(room_id);
    if (room) {
      room.addPeer(new Peer(socket.id, name));
      socket.data.room_id = room_id;

      const peers = room.toJson();
      callback(peers);
    }
  });

  socket.on('getProducers', (callback) => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      console.log('Get producers', { name: `${room.peers.get(socket.id)?.name}` });
      let producerList = room.getProducerListForPeer();
      callback(producerList);
    }
  });

  socket.on('getRtpCapabilities', (callback) => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      callback(room.getRtpCapabilities());
    }
  });

  socket.on('createWebRtcTransport', async (callback) => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      try {
        const transport = await room.createWebRtcTransport(socket.id);
        if (transport) {
          const params = transport; // Ajuste aqui para acessar os parâmetros necessários do transport
          callback(params);
        }
      } catch (err) {
        callback({ error: (err as Error).message });
      }
    }
  });

  socket.on('connectTransport', async ({ transport_id, dtlsParameters }, callback) => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      await room.connectPeerTransport(socket.id, transport_id, dtlsParameters);
      callback('success');
    }
  });

  socket.on('produce', async ({ producerTransportId, rtpParameters, kind }, callback) => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      let producer_id = await room.produce(socket.id, producerTransportId, rtpParameters, kind);
      callback({ producer_id });
    }
  });

  socket.on('consume', async ({ consumerTransportId, producerId, rtpCapabilities }, callback) => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      let result = await room.consume(socket.id, consumerTransportId, producerId, rtpCapabilities);
      if (result) {
        let { consumer, params } = result;
        callback(params);
      }
    }
  });

  socket.on('resume', async (callback) => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      const consumer = room.getConsumer(socket.id);
      if (consumer) {
        await consumer.resume();
        callback();
      } else {
        callback({ error: 'Consumer not found' });
      }
    }
  });

  socket.on('getRoomInfo', (cb) => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      cb(room.toJson());
    }
  });

  socket.on('disconnect', () => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      room.removePeer(socket.id);
    }
  });

  socket.on('producerClosed', ({ producer_id }) => {
    const room = roomList.get(socket.data.room_id);
    if (room) {
      room.closeProducer(socket.id, producer_id);
    }
  });
});

httpsServer.listen(config.listenPort, () => {
  console.log(`Server is running on port ${config.listenPort}`);
});
