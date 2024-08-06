export class Peer {
  id: string;
  name: string;
  transports: Map<string, any>;
  consumers: Map<string, any>;
  producers: Map<string, any>;

  constructor(socket_id: string, name: string) {
    this.id = socket_id;
    this.name = name;
    this.transports = new Map();
    this.consumers = new Map();
    this.producers = new Map();
  }

  addTransport(transport: any) {
    this.transports.set(transport.id, transport);
  }

  async connectTransport(transport_id: string, dtlsParameters: any) {
    if (!this.transports.has(transport_id)) return;
    await this.transports.get(transport_id).connect({ dtlsParameters });
  }

  async createProducer(producerTransportId: string, rtpParameters: any, kind: string) {
    let producer = await this.transports.get(producerTransportId).produce({
      kind,
      rtpParameters
    });

    this.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      console.log('Producer transport close', { name: `${this.name}`, consumer_id: `${producer.id}` });
      this.producers.delete(producer.id);
    });

    return producer;
  }

  async createConsumer(consumer_transport_id: string, producer_id: string, rtpCapabilities: any) {
    let consumerTransport = this.transports.get(consumer_transport_id);
    if (!consumerTransport) return;

    let consumer = await consumerTransport.consume({
      producerId: producer_id,
      rtpCapabilities,
      paused: true
    });

    this.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      console.log('Consumer transport close', { name: `${this.name}`, consumer_id: `${consumer.id}` });
      this.consumers.delete(consumer.id);
    });

    return consumer;
  }

  closeProducer(producer_id: string) {
    this.producers.get(producer_id).close();
    this.producers.delete(producer_id);
  }

  getProducer(producer_id: string) {
    return this.producers.get(producer_id);
  }

  removeConsumer(consumer_id: string) {
    this.consumers.delete(consumer_id);
  }
}
