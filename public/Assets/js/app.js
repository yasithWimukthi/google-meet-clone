let MyApp = (function (){
    let socket = null;
    let meetingId = null;
    let userId = null;

    function init(uid,mid){
        userId = uid;
        meetingId = mid;
        eventProcessForSignalingServer();
    }


    const eventProcessForSignalingServer = () => {
        socket = io.connect();
        socket.on('connect', () => {
            if (socket.connected){
                if (meetingId && userId){
                    socket.emit('userConnect', {meetingId: meetingId, displayName: userId});
                }
            }
        });
    }

    return {
        _init: function (uid,mid){
            init(uid,mid);
        }

    }
})();