import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Plus, Users, Mic } from 'lucide-react';
import toast from 'react-hot-toast';

const Home = () => {
  const [rooms, setRooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/rooms/active');
      setRooms(data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/rooms/create', { name: newRoomName });
      toast.success('Room created!');
      setShowCreateModal(false);
      navigate(`/room/${data._id}`);
    } catch (error) {
      toast.error('Failed to create room');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Active Voice Rooms</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center bg-primary text-white px-4 py-2 rounded-md hover:bg-opacity-90"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Room
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <Link
            key={room._id}
            to={`/room/${room._id}`}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{room.name}</h3>
              {room.active && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Live</span>}
            </div>
            <div className="flex items-center text-gray-600 mb-4">
              <Users className="w-4 h-4 mr-2" />
              <span>{room.participants.length} listening</span>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {room.host?.profileImage ? (
                    <img src={room.host.profileImage} alt={room.host.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-gray-500">{room.host?.name?.[0] || '?'}</span>
                  )}
                </div>
                <span className="ml-2 text-sm text-gray-600">Hosted by {room.host?.name || 'Unknown'}</span>
              </div>
              <div className="flex items-center text-accent font-medium">
                <Mic className="w-4 h-4 mr-1" />
                Join
              </div>
            </div>
          </Link>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Create a Room</h2>
            <form onSubmit={handleCreateRoom}>
              <input
                type="text"
                placeholder="Room Name"
                className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                required
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-opacity-90"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
