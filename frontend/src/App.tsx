import React, { useState } from 'react';
import RoomClient from './RoomClient';

const App: React.FC = () => {
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const [roomClient, setRoomClient] = useState<RoomClient | null>(null);

  const handleJoin = () => {
    if (roomId && name) {
      const client = new RoomClient(roomId, name);
      setRoomClient(client);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <input
        type="text"
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={handleJoin}>Join Room</button>
      {roomClient && <div>Room client initialized</div>}
    </div>
  );
};

export default App;
