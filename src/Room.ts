// src/Room.ts
import { Worker, Router } from 'mediasoup/node/lib/types';
import { Server } from 'socket.io';
import { Peer } from './Peer';

export class Room {
  id: string;
  router!: Router; // Inicialize como opcional e depois defina em um método async
  peers: Map<string, Peer>;
  io: Server;

  constructor(room_id: string, worker: Worker, io: Server) {
    this.id = room_id;
    this.peers = new Map();
    this.io = io;
    this.initializeRouter(worker);
  }

  async initializeRouter(worker: Worker) {
    this.router = await worker.createRouter({ mediaCodecs: [] });
  }

  addPeer(peer: Peer) {
    this.peers.set(peer.id, peer);
  }

  getProducerListForPeer() {
    let producerList: any[] = [];
    this.peers.forEach((peer) => {
      peer.producers.forEach((producer) => {
        producerList.push(producer);
      });
    });
    return producerList;
  }

  getRtpCapabilities() {
    return this.router.rtpCapabilities;
  }

  async createWebRtcTransport(socket_id: string) {
    const transport = await this.router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: undefined }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    transport.on('dtlsstatechange', (dtlsState: any) => {
      if (dtlsState === 'closed') {
        const peer = this.peers.get(socket_id);
        if (peer) {
          console.log('Transport close', { name: peer.name });
        }
      }
    });

    transport.on('routerclose', () => {
      const peer = this.peers.get(socket_id);
      if (peer) {
        console.log('Transport close', { name: peer.name });
      }
    });

    const peer = this.peers.get(socket_id);
    if (peer) {
      peer.addTransport(transport);
    }
    return transport;
  }

  async connectPeerTransport(socket_id: string, transport_id: string, dtlsParameters: any) {
    const peer = this.peers.get(socket_id);
    if (!peer) return;
    await peer.connectTransport(transport_id, dtlsParameters);
  }

  async produce(socket_id: string, producerTransportId: string, rtpParameters: any, kind: string) {
    return new Promise(async (resolve, reject) => {
      try {
        const peer = this.peers.get(socket_id);
        if (!peer) throw new Error('Peer not found');
        let producer = await peer.createProducer(producerTransportId, rtpParameters, kind);
        resolve(producer.id);
      } catch (e) {
        reject(e);
      }
    });
  }

  async consume(socket_id: string, consumer_transport_id: string, producer_id: string, rtpCapabilities: any) {
    if (!this.router.canConsume({ producerId: producer_id, rtpCapabilities })) {
      console.error('can not consume');
      return;
    }

    const peer = this.peers.get(socket_id);
    if (!peer) return;

    let consumer = await peer.createConsumer(consumer_transport_id, producer_id, rtpCapabilities);
    consumer.on('transportclose', () => {
      console.log('transport close from consumer');
      const peer = this.peers.get(socket_id);
      if (peer) {
        peer.removeConsumer(consumer.id);
      }
    });

    consumer.on('producerclose', () => {
      console.log('producer of consumer closed');
      const peer = this.peers.get(socket_id);
      if (peer) {
        peer.removeConsumer(consumer.id);
      }
    });

    return {
      consumer,
      params: {
        producerId: producer_id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused
      }
    };
  }

  removePeer(socket_id: string) {
    const peer = this.peers.get(socket_id);
    if (peer) {
      // peer.close(); // Remover ou substituir, pois o método 'close' não existe em Peer
      this.peers.delete(socket_id);
    }
  }

  closeProducer(socket_id: string, producer_id: string) {
    const peer = this.peers.get(socket_id);
    if (peer) {
      peer.closeProducer(producer_id);
    }
  }

  getConsumer(socket_id: string) {
    const peer = this.peers.get(socket_id);
    if (peer) {
      // Supondo que há um mapa de consumidores em Peer, ajuste conforme necessário
      return peer.consumers.get(socket_id);
    }
  }

  broadCast(socket_id: string, name: string, data: any) {
    for (let otherID of Array.from(this.peers.keys()).filter((id) => id !== socket_id)) {
      this.send(otherID, name, data);
    }
  }

  send(socket_id: string, name: string, data: any) {
    this.io.to(socket_id).emit(name, data);
  }

  toJson() {
    return {
      id: this.id,
      peers: JSON.stringify([...this.peers])
    };
  }
}
