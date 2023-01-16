const express = require('express');
const path = require('path');


const app = express();

const server = app.listen(3000, () => {
    console.log('Server is listening on port 3000');
});

const io = require('socket.io')(server,{
    allowEIO3: true
});

app.use(express.static(path.join(__dirname, '')));

let userConnections = [];

io.on('connection', (socket) => {
    console.log("socket id is: " + socket.id);
    socket.on('userConnect', (data) => {

        const otherUsers = userConnections.filter((user) => {
            return user.meetingId === data.meetingId ;
        });

        userConnections.push({
            connectionId: socket.id,
            userId: data.displayName,
            meetingId: data.meetingId
        });

        otherUsers.forEach((user) => {
            socket.to(user.connectionId).emit('inform_other_about_me', {
                otherUserId: data.displayName,
                connectionId: socket.id
            });
        });

    });

    socket.on('SDPProcess', (data) => {
        socket.to(data.to_connid).emit('SDPProcess', {
            message: data.message,
            from_connid: socket.id
        });
    });
})