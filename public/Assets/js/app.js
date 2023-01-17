let AppProcess = (function (){
    let serverProcess;
    let myConnectionId;
    let peersConnectionIds = [];
    let peers_connection = [];
    let remote_vid_stream = [];
    let remote_aud_stream = [];

    async function _init(SDP_function,myConId){
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

    async function setConnection(conId){
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
            if (!remote_vid_stream[conId]) {
                remote_vid_stream[conId].srcObject = new MediaStream();
            }

            if (!remote_aud_stream[conId]) {
                remote_aud_stream[conId].srcObject = new MediaStream();
            }

            if (event.track.kind == 'video') {
                remote_vid_stream[conId]
                    .getVideoTracks()
                    .forEach((track) => remote_vid_stream[conId].removeTrack(track));

                remote_vid_stream[conId].addTrack(event.track);

                let remoteVideoPlayer = document.getElementById(`v_${conId}`);
                remoteVideoPlayer.srcObject = null;
                remoteVideoPlayer.srcObject = remote_vid_stream[conId];
                remoteVideoPlayer.load();
            } else if (event.track.kind == 'audio') {
                remote_aud_stream[conId]
                    .getAudioTracks()
                    .forEach((track) => remote_aud_stream[conId].removeTrack(track));

                remote_aud_stream[conId].addTrack(event.track);

                let remoteAudioPlayer = document.getElementById(`a_${conId}`);
                remoteAudioPlayer.srcObject = null;
                remoteAudioPlayer.srcObject = remote_aud_stream[conId];
                remoteAudioPlayer.load();
            }

        };

        peersConnectionIds[conId] = conId;
        peers_connection[conId] = connection;

        return connection;
    }

    async function setOffer(conId){
        let connection = peers_connection[conId];
        let offer = await connection.createOffer();

        await connection.setLocalDescription(offer);

        serverProcess(JSON.stringify({ 'offer': connection.localDescription }), conId);
    }

    async function SDPProcess (data,fromConnid){
        let message = JSON.parse(data);
        if (message.answer){
            await peers_connection[fromConnid].setRemoteDescription(new RTCSessionDescription(message.answer));
        }else if (message.offer){
            if (!peers_connection[fromConnid]) {
                await setConnection(fromConnid);
            }
            await peers_connection[fromConnid].setRemoteDescription(new RTCSessionDescription(message.offer));
            let answer = await peers_connection[fromConnid].createAnswer();
            await peers_connection[fromConnid].setLocalDescription(answer);
            serverProcess(JSON.stringify({ 'answer': answer }), fromConnid);
        }else if (message.icecandidate){
            if (!peers_connection[fromConnid]) {
                await setConnection(fromConnid);
            }
            try {
                await peers_connection[fromConnid].addIceCandidate(new RTCIceCandidate(message.icecandidate));
            }catch (e) {
                console.log(e);
            }
        }
    }

    return {
        setConnection: async (conId) => {
            return await setConnection(conId);
        },
        init: async (SDP_function,myConId) => {
            return await _init(SDP_function,myConId);
        },
        processClientFunc: async (data,fromConnid) => {
            return await SDPProcess(data,fromConnid);
        }
    }
})();


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

                AppProcess.init(SdpFunction,socket.id);
                if (meetingId && userId){
                    socket.emit('userConnect', {meetingId: meetingId, displayName: userId});
                }
            }
        });

        socket.on('inform_other_about_me', (data) => {
            addUser(data.otherUserId, data.connectionId);
            AppProcess.setConnection(data.connectionId);
        });

        socket.on('SDPProcess', async (data) => {
            await AppProcess.processClientFunc(data.message, data.from_connid);
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