import { io } from "https://cdn.socket.io/4.7.1/socket.io.esm.min.js";

const socket = io();

let selectedAvatar = null;
let username = null;
let currentRoom = null;
let isRoomOwner = false;

const avatarListEl = document.getElementById('avatarList');
const usernameInput = document.getElementById('usernameInput');
const btnLogin = document.getElementById('btnLogin');

const loginScreen = document.getElementById('loginScreen');
const mainMenu = document.getElementById('mainMenu');
const createRoomScreen = document.getElementById('createRoomScreen');
const joinRoomScreen = document.getElementById('joinRoomScreen');
const chatScreen = document.getElementById('chatScreen');

const roomNameInput = document.getElementById('roomNameInput');
const roomPinInput = document.getElementById('roomPinInput');

const joinRoomNameInput = document.getElementById('joinRoomNameInput');
const joinRoomPinInput = document.getElementById('joinRoomPinInput');

const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const btnSendMessage = document.getElementById('btnSendMessage');

const chatRoomName = document.getElementById('chatRoomName');
const btnLeaveRoom = document.getElementById('btnLeaveRoom');

const onlineCountEl = document.getElementById('onlineCount');
const onlineUsersEl = document.getElementById('onlineUsers');
const typingStatusEl = document.getElementById('typingStatus');
const clockEl = document.getElementById('clock');

function setClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(setClock, 1000);
setClock();

// Avatarları göster
const avatars = ['🧑‍💻','👩‍🎤','👨‍🚀','👩‍🍳','🧙‍♂️','👻','🐱','🐶','🐵','🦊'];
avatars.forEach(av => {
    const span = document.createElement('span');
    span.textContent = av;
    span.style.cursor = 'pointer';
    span.style.fontSize = '30px';
    span.onclick = () => {
        selectedAvatar = av;
        document.querySelectorAll('#avatarList span').forEach(s => s.classList.remove('selected'));
        span.classList.add('selected');
    };
    avatarListEl.appendChild(span);
});

btnLogin.onclick = () => {
    if (!selectedAvatar) return alert('Lütfen avatar seçin!');
    if (!usernameInput.value.trim()) return alert('Lütfen isim yazın!');
    username = usernameInput.value.trim();

    loginScreen.classList.remove('active');
    loginScreen.classList.add('hidden');

    mainMenu.classList.remove('hidden');
    mainMenu.classList.add('active');
};

document.getElementById('btnCreateRoom').onclick = () => {
    mainMenu.classList.remove('active');
    mainMenu.classList.add('hidden');
    createRoomScreen.classList.remove('hidden');
    createRoomScreen.classList.add('active');
};

document.getElementById('btnJoinRoom').onclick = () => {
    mainMenu.classList.remove('active');
    mainMenu.classList.add('hidden');
    joinRoomScreen.classList.remove('hidden');
    joinRoomScreen.classList.add('active');
};

document.querySelectorAll('.btnBack').forEach(btn => {
    btn.onclick = () => {
        createRoomScreen.classList.add('hidden');
        joinRoomScreen.classList.add('hidden');
        mainMenu.classList.remove('hidden');
        mainMenu.classList.add('active');
    };
});

document.getElementById('btnCreateRoomConfirm').onclick = () => {
    const roomName = roomNameInput.value.trim();
    const pin = roomPinInput.value.trim();
    if (!roomName || !pin) {
        alert('Oda adı ve PIN zorunlu!');
        return;
    }
    socket.emit('createRoom', { roomName, pin, username, avatar: selectedAvatar }, (res) => {
        if (res.error) return alert(res.error);
        currentRoom = roomName;
        isRoomOwner = true;
        openChat();
    });
};

document.getElementById('btnJoinRoomConfirm').onclick = () => {
    const roomName = joinRoomNameInput.value.trim();
    const pin = joinRoomPinInput.value.trim();
    if (!roomName || !pin) {
        alert('Oda adı ve PIN zorunlu!');
        return;
    }
    socket.emit('joinRoom', { roomName, pin, username, avatar: selectedAvatar }, (res) => {
        if (res.error) return alert(res.error);
        currentRoom = roomName;
        isRoomOwner = false;
        openChat();
    });
};

btnSendMessage.onclick = sendMessage;
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

btnLeaveRoom.onclick = () => {
    socket.emit('leaveRoom', { roomName: currentRoom });
    currentRoom = null;
    isRoomOwner = false;
    messagesEl.innerHTML = '';
    chatScreen.classList.remove('active');
    chatScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    mainMenu.classList.add('active');
    onlineCountEl.textContent = 'Online: 0';
    onlineUsersEl.textContent = '';
    typingStatusEl.textContent = '';
};

// Gelen online kullanıcı sayısı
socket.on('onlineCount', (count) => {
    onlineCountEl.textContent = `Online: ${count}`;
});

// Gelen online kullanıcı listesi
socket.on('onlineUsers', (users) => {
    onlineUsersEl.textContent = users.join(', ');
});

// Yazıyor göstergesi
socket.on('typingUsers', (typingUsers) => {
    if (typingUsers.length === 0) {
        typingStatusEl.textContent = '';
    } else if (typingUsers.length === 1) {
        typingStatusEl.textContent = `${typingUsers[0]} yazıyor...`;
    } else {
        typingStatusEl.textContent = `${typingUsers.join(', ')} yazıyor...`;
    }
});

function openChat() {
    mainMenu.classList.remove('active');
    mainMenu.classList.add('hidden');
    createRoomScreen.classList.add('hidden');
    joinRoomScreen.classList.add('hidden');

    chatScreen.classList.remove('hidden');
    chatScreen.classList.add('active');

    chatRoomName.textContent = currentRoom;
    messagesEl.innerHTML = '';
}

// Mesaj gönderme
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    socket.emit('sendMessage', { roomName: currentRoom, username, avatar: selectedAvatar, message });

    messageInput.value = '';
    sendTyping(false);
}

// Yeni mesaj alındığında göster
socket.on('newMessage', (data) => {
    const div = document.createElement('div');
    div.innerHTML = `<strong>${data.avatar} ${data.username}:</strong> ${data.message}`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
});

// Yazıyor durumunu servera bildir
messageInput.addEventListener('input', () => {
    sendTyping(messageInput.value.trim().length > 0);
});
function sendTyping(isTyping) {
    socket.emit('typing', { roomName: currentRoom, isTyping });
}

// Ses kaydı ve gönderimi
let mediaRecorder;
let audioChunks = [];

const btnRecord = document.createElement('button');
btnRecord.textContent = 'Ses Kaydet';
btnRecord.style.marginLeft = '10px';
document.getElementById('chatInputArea').appendChild(btnRecord);

btnRecord.onclick = () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      audioChunks = [];

      mediaRecorder.ondataavailable = e => {
        audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64AudioMessage = reader.result;
          socket.emit('sendVoiceMessage', { roomName: currentRoom, username, avatar: selectedAvatar, audioBlob: base64AudioMessage });
        };
      };

      btnRecord.textContent = 'Kaydı Durdur';
    }).catch(() => alert('Mikrofona erişim izni gerekli.'));
  } else if (mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    btnRecord.textContent = 'Ses Kaydet';
  }
};

// Sesli mesaj geldiğinde oynat
socket.on('newVoiceMessage', ({ username, avatar, audioBlob }) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${avatar} ${username}:</strong> <audio controls src="${audioBlob}"></audio>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
})