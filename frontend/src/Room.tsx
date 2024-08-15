import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import RoomClient from './RoomClient';
import './Room.css';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const state = location.state as { name: string };
  const [roomClient, setRoomClient] = useState<RoomClient | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const joinRoom = async () => {
      if (roomId && location.state?.name) {
        const client = new RoomClient(roomId, location.state.name);
        setRoomClient(client);

        const stream = await client.getUserMedia();
        setLocalStream(stream);
        client.produce(stream);

        client.on('newParticipant', (participantName: string) => {
          setParticipants(prev => [...prev, participantName]);
        });

        client.on('newMessage', (message: string) => {
          setMessages(prev => [...prev, message]);
        });
      }
    };

    joinRoom();
  }, [roomId, location.state?.name]);

  const handleSendMessage = (message: string) => {
    if (roomClient) {
      roomClient.sendMessage(message);
      setMessages(prev => [...prev, `Eu: ${message}`]);
    }
  };

  return (
    <div className="room-container">
      <div className="header">
        <div className="logo">
          <img src="/logo.png" alt="Logo" />
        </div>
        <div className="title">
          <h2>Teleconsulta Grupo</h2>
          <p>12 de Junho, 2024 | 11:00 AM</p>
        </div>
      </div>
      
      <div className="video-section">
        <div className="main-video">
          {localStream && <video autoPlay muted ref={(video) => video && (video.srcObject = localStream)} />}
          <div className="main-video-info">
            <p>Dr. Humberto Serra</p>
            <span>00:00</span>
          </div>
        </div>
        
        <div className="participant-videos">
          {participants.map((participant, index) => (
            <div key={index} className="participant">
              <div className="participant-video"> {/* Placeholder para o vídeo do participante */}</div>
              <p>{participant}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="side-section">
        <div className="participants-list">
          <h3>Participantes</h3>
          <ul>
            {participants.map((participant, index) => (
              <li key={index}>{participant}</li>
            ))}
          </ul>
        </div>
        
        <div className="chat-section">
          <h3>Chats</h3>
          <div className="messages">
            {messages.map((message, index) => (
              <p key={index}>{message}</p>
            ))}
          </div>
          <input
            type="text"
            placeholder="Digite seu texto"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
        </div>
      </div>

      <div className="controls">
        <button onClick={() => roomClient?.toggleAudio()}>Áudio</button>
        <button onClick={() => roomClient?.toggleVideo()}>Vídeo</button>
        <button onClick={() => roomClient?.shareScreen()}>Compartilhar Tela</button>
        <button onClick={() => roomClient?.hangUp()}>Desconectar</button>
      </div>
    </div>
  );
};

export default Room;
