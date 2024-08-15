import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home: React.FC = () => {
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    navigate(`/room/${roomId}`, { state: { name } });
  };

  return (
    <div className="home-container">
      <h1>Teleconsulta</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="ID da Sala"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Seu Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
};

export default Home;
