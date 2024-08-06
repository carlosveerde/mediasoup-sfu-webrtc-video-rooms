import React from 'react';
import RoomClient from './RoomClient';

const App: React.FC = () => {
  return (
    <div>
      <h1>Mediasoup SFU Video Rooms</h1>
      <RoomClient />
    </div>
  );
};

export default App;