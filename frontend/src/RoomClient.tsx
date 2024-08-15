import io from 'socket.io-client';
import { Device } from 'mediasoup-client';

type RtpCapabilities = any;

interface TransportOptions {
  id: string;
  iceParameters: any; // Substitua `any` por tipos específicos conforme necessário
  iceCandidates: any[];
  dtlsParameters: any;
  sctpParameters?: any;
}

class RoomClient {
  private socket: any;
  private device!: Device;
  private roomId: string;
  private name: string;
  private producer: any;
  private localStream: MediaStream | null = null;

  constructor(roomId: string, name: string) {
    this.roomId = roomId;
    this.name = name;
    this.socket = io('https://localhost:3016');

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.joinRoom();
    });
  }

  async joinRoom() {
    this.socket.emit('joinRoom', { roomId: this.roomId, name: this.name });

    this.device = new Device();
    const routerRtpCapabilities = await this.getRouterRtpCapabilities();
    await this.device.load({ routerRtpCapabilities });
  }

  async init() {
    const routerRtpCapabilities = await this.getRouterRtpCapabilities();
    await this.device.load({ routerRtpCapabilities });
  }

  async getRouterRtpCapabilities(): Promise<RtpCapabilities> {
    return new Promise((resolve, reject) => {
      this.socket.emit('getRouterRtpCapabilities', (data: RtpCapabilities) => {
        resolve(data);
      });
    });
  }

  async getUserMedia() {
    this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    return this.localStream;
  }

  async produce(stream: MediaStream) {
    const transportOptions = await this.createTransport();
    const transport = this.device.createSendTransport(transportOptions);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.socket.emit('connectTransport', { dtlsParameters, transportId: transport.id }, callback);
    });

    transport.on('produce', (parameters, callback, errback) => {
      this.socket.emit('produce', { ...parameters, transportId: transport.id }, callback);
    });

    const track = stream.getVideoTracks()[0];
    this.producer = await transport.produce({ track });
  }

  async createTransport(): Promise<TransportOptions> {
    return new Promise((resolve, reject) => {
      this.socket.emit('createTransport', (data: TransportOptions) => {
        resolve(data);
      });
    });
  }

  toggleAudio() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    }
  }

  toggleVideo() {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    }
  }

  async shareScreen() {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    this.produce(screenStream);
  }

  hangUp() {
    this.socket.emit('leaveRoom', { roomId: this.roomId, name: this.name });
    this.socket.disconnect();
  }

  sendMessage(message: string) {
    this.socket.emit('chatMessage', message);
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket.on(event, callback);
  }
}

export default RoomClient;
