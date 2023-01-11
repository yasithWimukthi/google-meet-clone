let MyApp = (function (){
    function init(uid,mid){
        console.log('MyApp.init()');
        eventProcessForSignalingServer();
    }

    let socket = null;

    const eventProcessForSignalingServer = () => {
        socket = io.connect();
        socket.on('connect', () => {
            console.log("socket connect to client side");
        });
    }

    return {
        _init: function (uid,mid){
            init(uid,mid);
        }

    }
})();