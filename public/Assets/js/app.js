let AppProcess = function (){
    let serverProcess;
    let myConnectionId;
    let peersConnectionIds = [];
    let peers_connection = [];

    function _init(SDP_function,myConId){
        serverProcess = SDP_function;
        myConnectionId = myConId;
    }

    let iceConfig = {
        iceServers: [
            {
                urls: 'stun:stun.l.google.com:19302'
            },
            {
                urls: 'stun:stun1.l.google.com:19302',
            }
        ]
    }

    function setConnection(conId){
        let connection = new RTCPeerConnection(iceConfig);

        connection.onnegotiationneeded = async (event) => {
            await setOffer(conId)
        }

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                serverProcess(JSON.stringify({ 'candidate': event.candidate }), conId);
            }
        }

        connection.ontrack = (event) => {

        }

        peersConnectionIds[conId] = conId;
        peers_connection[conId] = connection;
    }

    async function setOffer(conId){
        let connection = peers_connection[conId];
        let offer = await connection.createOffer();

        await connection.setLocalDescription(offer);

        serverProcess(JSON.stringify({ 'offer': connection.localDescription }), conId);
    }

    return {
        setConnection: async (conId) => {
            return await setConnection(conId);
        },
        init: async (SDP_function,myConId) => {
            return await _init(SDP_function,myConId);
        }
    }
}


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

        const SdpFunction = (data,toConId) => {
            socket.emit('SDPProcess', {
                message: data,
                to_connid: toConId
            });
        }

        socket.on('connect', () => {
            if (socket.connected){
                AppProcess().init(SdpFunction,socket.id);
                if (meetingId && userId){
                    socket.emit('userConnect', {meetingId: meetingId, displayName: userId});
                }
            }
        });

        socket.on('inform_other_about_me', (data) => {
            addUser(data.otherUserId, data.connectionId);
            AppProcess().setConnection(data.connectionId);
        });
    }

    const addUser = (otherUserId, connectionId) => {
        let newDivId = $("#otherTemplate").clone();
        newDivId = newDivId.attr('id', connectionId).addClass("other");
        newDivId.find("h2").text(otherUserId);
        newDivId.find("video").attr('id', `v_${connectionId}`);
        newDivId.find("audio").attr('id', `a_${connectionId}`);
        newDivId.show();
        $("#divUsers").append(newDivId);
    }

    return {
        _init: function (uid,mid){
            init(uid,mid);
        }

    }
})();