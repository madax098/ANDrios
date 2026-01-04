
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const rooms = {};

// Odaya bağlı kullanıcıları güncelle
function updateRoomUsers(roomName) {
  const room = rooms[roomName];
  if (!room) return;
  const users = Object.values(room.users).map(u => u.username);
  io.to(roomName).emit('onlineUsers', users);
  io.to(roomName).emit('onlineCount', users.length);
}

// Bağlı olduğu odanın adını bul (socket.id'ye göre)
function findUserRoom(socketId) {
  for (const roomName in rooms) {
    if (rooms[roomName].users[socketId]) return roomName;
  }
  return null;
}

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`Yeni kullanıcı bağlandı: ${socket.id}`);

  socket.on('createRoom', ({ roomName, pin, username, avatar }, callback) => {
    if (rooms[roomName]) {
      return callback({ error: 'Bu isimde oda zaten var!' });
    }
    rooms[roomName] = {
      pin,
      ownerId: socket.id,
      pinnedMessage: null,
      users: {}
    };
    rooms[roomName].users[socket.id] = { username, avatar, typing: false, joinTime: Date.now(), voiceMessageCount: 0 };
    socket.join(roomName);
    updateRoomUsers(roomName);
    callback({ success: true });
  });

  socket.on('joinRoom', ({ roomName, pin, username, avatar }, callback) => {
    const room = rooms[roomName];
    if (!room) return callback({ error: 'Oda bulunamadı!' });
    if (room.pin !== pin) return callback({ error: 'PIN yanlış!' });

    room.users[socket.id] = { username, avatar, typing: false, joinTime: Date.now(), voiceMessageCount: 0 };
    socket.join(roomName);
    updateRoomUsers(roomName);

    const isOwner = room.ownerId === socket.id;
    callback({ success: true, isOwner, pinnedMessage: room.pinnedMessage });
  });

  socket.on('leaveRoom', ({ roomName }) => {
    const room = rooms[roomName];
    if (!room) return;
    if (room.users[socket.id]) {
      delete room.users[socket.id];
      socket.leave(roomName);
      updateRoomUsers(roomName);

      if (Object.keys(room.users).length === 0) {
        delete rooms[roomName];
      }
    }
  });

  socket.on('sendMessage', ({ roomName, username, avatar, message }) => {
    if (!rooms[roomName]) return;
    const data = { username, avatar, message, timestamp: Date.now() };
    io.to(roomName).emit('newMessage', data);
  });

  socket.on('sendVoiceMessage', ({ roomName, username, avatar, audioBlob }) => {
    if (!rooms[roomName]) return;
    io.to(roomName).emit('newVoiceMessage', { username, avatar, audioBlob });
  });

  socket.on('pinMessage', ({ roomName, messageId, message }) => {
    const room = rooms[roomName];
    if (!room) return;
    if (socket.id !== room.ownerId) return;
    room.pinnedMessage = { messageId, message };
    io.to(roomName).emit('pinnedMessage', room.pinnedMessage);
  });

  socket.on('typing', ({ roomName, isTyping }) => {
    const room = rooms[roomName];
    if (!room || !room.users[socket.id]) return;
    room.users[socket.id].typing = isTyping;

    const typingUsers = Object.values(room.users)
      .filter(u => u.typing)
      .map(u => u.username);

    io.to(roomName).emit('typingUsers', typingUsers);
  });

  socket.on('kickUser', ({ roomName, userId }, callback) => {
    const room = rooms[roomName];
    if (!room) return callback({ error: 'Oda bulunamadı!' });
    if (socket.id !== room.ownerId) return callback({ error: 'Yetkiniz yok!' });

    if (room.users[userId]) {
      io.sockets.sockets.get(userId)?.leave(roomName);
      delete room.users[userId];
      updateRoomUsers(roomName);
      io.to(roomName).emit('userKicked', userId);
      return callback({ success: true });
    }
    callback({ error: 'Kullanıcı bulunamadı!' });
  });

  socket.on('changePin', ({ roomName, newPin }, callback) => {
    const room = rooms[roomName];
    if (!room) return callback({ error: 'Oda bulunamadı!' });
    if (socket.id !== room.ownerId) return callback({ error: 'Yetkiniz yok!' });

    room.pin = newPin;
    callback({ success: true });
  });

  socket.on('getRoomLink', ({ roomName }, callback) => {
    const room = rooms[roomName];
    if (!room) return callback({ error: 'Oda bulunamadı!' });
    const link = `https://yourdomain.com/?room=${encodeURIComponent(roomName)}`;
    callback({ success: true, link });
  });

  socket.on('disconnect', () => {
    for (const roomName in rooms) {
      const room = rooms[roomName];
      if (room.users[socket.id]) {
        delete room.users[socket.id];
        socket.leave(roomName);
        updateRoomUsers(roomName);

        if (Object.keys(room.users).length === 0) {
          delete rooms[roomName];
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor.`);
});