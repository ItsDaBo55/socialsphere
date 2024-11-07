const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.get('/', (req, res) => {
    res.send('Hello World!');
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server is running on ${port}`);
});

let users = [];

io.on('connection', (socket) => {
    console.log('A user connected');
    let notificationInterval;
    
    socket.on('register', async (userId) => {
        socket.user_id = userId;
        users.push(socket); // Store the socket directly

        if (userId !== undefined && userId !== null) {
            try {
                const response = await fetch(`https://socialsphere.getenjoyment.net//api/user-exist.php?user=${userId}`);
                if (response) {
                    notificationInterval = setInterval(async () => {
                        const unreadNotifications = await getUnreadNotifications(userId);
                        const unreadMessages = await getUnreadMessages(userId);
                        socket.emit('notification', unreadNotifications.unread_count);
                        socket.emit('messagesNum', unreadMessages.unread_count);
                    }, 5000);
                } else {
                    console.log('User does not exist.');
                }
            } catch (error) {
                console.log('Error: ', error);
            }
        }
    });

    socket.on('newPost', async (data) => {
        if (data.userId !== undefined && data.userId !== null) {
            try {
                const response = await fetch(`https://socialsphere.getenjoyment.net//api/user-exist.php?user=${data.userId}`);
                if (response) {
                    const udata = await response.json();
                    const unreadNotifications = await getPost(data.userId, data.postId, udata.admin);
                    if (unreadNotifications) {
                        io.emit('newPost', unreadNotifications);
                    }
                } else {
                    console.log('User does not exist.');
                }
            } catch (error) {
                console.log('Error: ', error);
            }
        }
    });

    socket.on('message', async (data) => {
        if (data.userId !== undefined && data.userId !== null && data.convId !== undefined && data.convId !== null) {
            try {
                const response = await fetch(`https://socialsphere.getenjoyment.net//api/user-exist.php?user=${data.userId}`);
                if (response) {
                    const convExist = await fetch(`https://socialsphere.getenjoyment.net//api/user-conv.php?user=${data.userId}&conv=${data.convId}`);
                    const cdata = await convExist.json();
                    if (cdata.success) {
                        const findSocket = users.find(s => s.user_id == cdata.other_user.id);
                        if (findSocket) {
                            findSocket.emit('message', {read: data.read ? true : false, message: data.message, convId: data.convId });
                        }
                    }
                } else {
                    console.log('User does not exist.');
                }
            } catch (error) {
                console.log('Error: ', error);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        clearInterval(notificationInterval); // Clear the interval on disconnect
        users = users.filter(s => s.id !== socket.id); // Remove the socket from the users array
    });
});

async function getUnreadNotifications(id) {
    try {
        const response = await fetch(`https://socialsphere.getenjoyment.net//api/unread-noti.php?user=${id}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.log('Error: ', error);
        return { unread_count: 0 }; // Return a default value in case of an error
    }
}

async function getUnreadMessages(id) {
    try {
        const response = await fetch(`https://socialsphere.getenjoyment.net//api/unread-messages.php?user=${id}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.log('Error: ', error);
        return { unread_count: 0 }; // Return a default value in case of an error
    }
}

async function getPost(uid, pid, admin) {
    try {
        const response = await fetch(`https://socialsphere.getenjoyment.net//api/get-post.php?user=${uid}&post=${pid}&admin=${admin}`);
        const data = await response.json();
        return data.post[0];
    } catch (error) {
        console.log('Error: ', error);
        return false; // Return a default value in case of an error
    }
}
