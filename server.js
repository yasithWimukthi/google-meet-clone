const express = require('express');
const path = require('path');


const app = express();

const server = app.listen(3000, () => {
    console.log('Server is listening on port 3000');
});

const io = require('socket.io')(server);

app.use(express.static(path.join(__dirname, '')));

io.on('connection', (socket) => {
    console.log("socket id is: " + socket.id);
}