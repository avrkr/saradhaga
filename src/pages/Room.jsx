import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Peer from 'simple-peer';
import { Mic, MicOff, PhoneOff, Send, Smile, ThumbsUp, Heart, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

const Room = () => {
  const { id: roomId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState(null);
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const userVideo = useRef();
  const peersRef = useRef([]);
  const messagesEndRef = useRef(null);
  const joinRoomRef = useRef(null);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const { data } = await api.get(`/rooms/${roomId}`);
        setRoom(data);
        const msgs = await api.get(`/rooms/${roomId}/messages`);
        setMessages(msgs.data);
      } catch (error) {
        toast.error('Failed to load room');
        navigate('/');
      }
    };
    fetchRoom();
  }, [roomId, navigate]);

  useEffect(() => {
    if (!socket || !user) return;

    let localStream = null;

    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(stream => {
      localStream = stream;
      
      // Send full user object to backend
      const joinRoom = () => {
        console.log('Joining room:', roomId);
        socket.emit('join-room', roomId, user);
      };
      joinRoomRef.current = joinRoom;
      
      if (socket.connected) {
        joinRoom();
      }
      
      socket.on('connect', joinRoom);

      socket.on('all-users', users => {
        console.log('Received all-users:', users);
        // users is now [{ socketId, user }, ...]
        
        // Clear existing peers
        peersRef.current.forEach(p => p.peer.destroy());
        peersRef.current = [];
        
        const peers = [];
        users.forEach(userObj => {
          const peer = createPeer(userObj.socketId, socket.id, stream);
          peersRef.current.push({
            peerID: userObj.socketId,
            peer,
            user: userObj.user // Store user info
          });
          peers.push({
            peerID: userObj.socketId,
            peer,
            user: userObj.user
          });
        });
        setPeers(peers);
      });

      socket.on('user-joined', payload => {
        console.log('Received user-joined:', payload);
        // payload: { signal, callerID, callerUser }
        
        // Check if peer already exists in ref
        const existingPeer = peersRef.current.find(p => p.peerID === payload.callerID);
        if (existingPeer) {
          console.log('Peer already exists in ref, ignoring user-joined');
          // If it exists in ref but not in state (rare sync issue), add to state
          setPeers(users => {
            if (users.find(u => u.peerID === payload.callerID)) return users;
            return [...users, { 
              peerID: payload.callerID, 
              peer: existingPeer.peer,
              user: payload.callerUser 
            }];
          });
          return;
        }

        const peer = addPeer(payload.signal, payload.callerID, stream);
        peersRef.current.push({
          peerID: payload.callerID,
          peer,
          user: payload.callerUser // Store caller info
        });
        
        // Force update state
        setPeers(users => {
          if (users.find(u => u.peerID === payload.callerID)) return users;
          return [...users, { 
            peerID: payload.callerID, 
            peer,
            user: payload.callerUser 
          }];
        });
      });

      socket.on('receiving-returned-signal', payload => {
        const item = peersRef.current.find(p => p.peerID === payload.id);
        if (item) {
          item.peer.signal(payload.signal);
        }
      });

      socket.on('user-left', id => {
        const peerObj = peersRef.current.find(p => p.peerID === id);
        if (peerObj) {
          peerObj.peer.destroy();
        }
        const peers = peersRef.current.filter(p => p.peerID !== id);
        peersRef.current = peers;
        setPeers(peers);
      });

      socket.on('new-message', message => {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
      });

      socket.on('react-message', updatedMessage => {
        setMessages(prev => prev.map(m => m._id === updatedMessage._id ? updatedMessage : m));
      });

      socket.on('hype-room', () => {
        setRoom(prev => ({ ...prev, hypeCount: (prev?.hypeCount || 0) + 1 }));
        toast('🔥 Room Hyped!', { icon: '🔥' });
      });
    });

    return () => {
      if (joinRoomRef.current) {
        socket.off('connect', joinRoomRef.current);
      }
      socket.off('all-users');
      socket.off('user-joined');
      socket.off('receiving-returned-signal');
      socket.off('user-left');
      socket.off('new-message');
      socket.off('react-message');
      socket.off('hype-room');
      
      peersRef.current.forEach(p => p.peer.destroy());
      peersRef.current = [];
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [socket, roomId, user]);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] }
    });

    peer.on('signal', signal => {
      socket.emit('sending-signal', { userToSignal, callerID, signal });
    });
    
    peer.on('error', err => {
      // Ignore user-initiated close errors
      if (err.message.includes('User-Initiated Abort') || err.code === 'ERR_DATA_CHANNEL') {
        return;
      }
      console.error('Peer error:', err);
    });

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] }
    });

    peer.on('signal', signal => {
      socket.emit('returning-signal', { signal, callerID });
    });
    
    peer.on('error', err => {
      if (err.message.includes('User-Initiated Abort') || err.code === 'ERR_DATA_CHANNEL') {
        return;
      }
      console.error('Peer error:', err);
    });

    peer.signal(incomingSignal);

    return peer;
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!socket) {
      toast.error('Not connected to chat server');
      return;
    }

    try {
      const { data } = await api.post(`/rooms/${roomId}/messages`, { text: newMessage });
      socket.emit('send-message', data);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message', error);
    }
  };

  const handleReaction = async (msgId, emoji) => {
    if (!socket) return;
    try {
      const { data } = await api.post(`/messages/${msgId}/react`, { emoji });
      socket.emit('react-message', data);
    } catch (error) {
      console.error('Failed to react', error);
    }
  };

  const handleHype = async () => {
    if (!socket) return;
    try {
      const { data } = await api.post(`/rooms/${roomId}/hype`);
      // Update local state immediately
      setRoom(prev => ({ 
        ...prev, 
        hypeCount: data.hypeCount,
        hypes: [...(prev.hypes || []), user._id] 
      }));
      socket.emit('hype-room', roomId);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to hype');
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      toast.success('Room deleted');
      navigate('/');
    } catch (error) {
      toast.error('Failed to delete room');
    }
  };

  const handleToggleStatus = async () => {
    try {
      const { data } = await api.put(`/rooms/${roomId}/status`);
      setRoom(prev => ({ ...prev, active: data.active }));
      toast.success(data.message);
    } catch (error) {
      toast.error('Failed to update room status');
    }
  };

  const toggleMute = () => {
    // Logic to mute local stream audio track
    // stream.getAudioTracks()[0].enabled = !isMuted;
    setIsMuted(!isMuted);
  };

  if (!room) return <div>Loading...</div>;

  const isHost = room.host._id === user._id;
  const hasHyped = room.hypes?.includes(user._id);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row bg-gray-100">
      {/* Voice Area */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="bg-white rounded-lg shadow-md p-6 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                {room.name}
                {!room.active && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">Inactive</span>}
              </h2>
              <p className="text-gray-500">{peers.length + 1} participants</p>
            </div>
            <div className="flex items-center space-x-4">
              {isHost && (
                <div className="flex space-x-2 mr-4">
                  <button
                    onClick={handleToggleStatus}
                    className={`px-3 py-1 rounded text-sm font-medium ${room.active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                  >
                    {room.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={handleDeleteRoom}
                    className="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              )}
              <div className="flex items-center bg-orange-100 px-3 py-1 rounded-full text-orange-600 font-bold">
                <Zap className="w-4 h-4 mr-1" />
                {room.hypeCount || 0}
              </div>
              <button
                onClick={handleHype}
                disabled={hasHyped}
                className={`bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-2 rounded-full font-bold transition-all ${hasHyped ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:opacity-90 hover:scale-105'}`}
              >
                {hasHyped ? 'HYPED!' : 'HYPE!'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 flex-1 content-start">
            {/* Self */}
            <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg border-2 border-primary">
              <div className="w-20 h-20 rounded-full bg-gray-300 mb-2 overflow-hidden">
                {user.profileImage ? (
                  <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-500">
                    {user.name[0]}
                  </div>
                )}
              </div>
              <span className="font-medium text-gray-900">{user.name} (You)</span>
              {isMuted && <MicOff className="w-4 h-4 text-red-500 mt-1" />}
            </div>

            {/* Peers */}
            {peers.map((peerObj, index) => (
              <div key={peerObj.peerID} className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                <div className="w-20 h-20 rounded-full bg-gray-300 mb-2 overflow-hidden">
                  {peerObj.user?.profileImage ? (
                    <img src={peerObj.user.profileImage} alt={peerObj.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-500">
                      {peerObj.user?.name?.[0] || 'U'}
                    </div>
                  )}
                </div>
                <span className="font-medium text-gray-900">{peerObj.user?.name || `User ${index + 1}`}</span>
                <Audio peer={peerObj.peer} />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center space-x-4">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full ${isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-800'} hover:bg-opacity-80`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <button
              onClick={() => navigate('/')}
              className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-full md:w-96 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-700">Room Chat</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg._id} className={`flex flex-col ${msg.sender._id === user._id ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${msg.sender._id === user._id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                <p className="text-xs opacity-75 mb-1">{msg.sender.name}</p>
                <p>{msg.text}</p>
              </div>
              
              {/* Reactions */}
              <div className="flex -mt-2 space-x-1">
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="bg-white shadow-sm rounded-full px-2 py-0.5 text-xs flex items-center border border-gray-100">
                    {msg.reactions.map((r, i) => (
                      <span key={i}>{r.emoji}</span>
                    ))}
                  </div>
                )}
                <button 
                  onClick={() => handleReaction(msg._id, '❤️')}
                  className="text-xs bg-gray-50 hover:bg-gray-200 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Heart className="w-3 h-3 text-red-500" />
                </button>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="p-2 bg-primary text-white rounded-full hover:bg-opacity-90"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Audio = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on('stream', stream => {
      ref.current.srcObject = stream;
    });
  }, [peer]);

  return <audio playsInline autoPlay ref={ref} />;
};

const UsersIcon = () => (
  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export default Room;
