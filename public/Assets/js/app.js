let AppProcess = (function () {
    let serverProcess;
    let myConnectionId;
    let peersConnectionIds = [];
    let peers_connection = [];
    let remote_vid_stream = [];
    let remote_aud_stream = [];
    let localDiv;
    let audio;
    let isAudioMuted = true;
    let rtpAudSenders = [];
    let videoStates = {
        NONE: 0,
        VIDEO: 1,
        SCREEN: 2
    };
    let videoState = videoStates.NONE;
    let videoCamTrack;
    let rtpVidSenders = [];

    async function _init(SDP_function, myConId) {
        serverProcess = SDP_function;
        myConnectionId = myConId;
        eventProcess();
        localDiv = document.getElementById('localVideoPlayer');
    }

    function eventProcess() {
        $("#micMuteUnmute").on('click', async function () {
            if (!audio) {
                await loadAudio();
            }
            if (!audio) {
                alert("Audio permission has not been granted");
                return;
            }
            if (isAudioMuted) {
                audio.enabled = true;
                $(this).html('<span class="material-icons" style="width: 100%">mic</span>');
                updateMediaSenders(audio, rtpAudSenders);
            } else {
                audio.enabled = false;
                $(this).html('<span class="material-icons" style="width: 100%">mic_off</span>');
                removeMediaSenders(rtpAudSenders);
            }

            isAudioMuted = !isAudioMuted;
        });

        $("#videoCamOnOff").on('click', async function () {
            if (videoState === videoStates.NONE) {
                await videoProcess(videoStates.VIDEO);
            } else {
                await videoProcess(videoStates.NONE);
            }
        });

        $("#btnScreenShareOnOff").on('click', async function () {
            if (videoState === videoStates.SCREEN) {
                await videoProcess(videoStates.NONE);
            } else {
                await videoProcess(videoStates.SCREEN);
            }
        });

    }

    function loadAudio() {
        try {
            let audioStream = navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
            audio = audioStream.getAudioTracks()[0];
            audio.enabled = false;
        }catch (e) {
            console.log(e);
        }
    }


    function connectionStatus(connection) {
        if (connection &&
            (
                connection.connectionState === 'connected' ||
                connection.connectionState === 'connecting' ||
                connection.connectionState === 'new'
            )) {
            return true;

        } else {
            return false;
        }
    }

    function updateMediaSenders(stream, senders) {
        for (let connectionId in peersConnectionIds) {
            if (connectionStatus(connectionId)) {
                if (senders[connectionId] && senders[connectionId].track) {
                    senders[connectionId].replaceTrack(stream);
                }else {
                    senders[connectionId] = peers_connection[connectionId].addTrack(stream);
                }
            }
        }
    }

    function removeMediaSenders(senders) {
        for (let connectionId in peersConnectionIds) {
            if(senders[connectionId] && connectionStatus(peers_connection[connectionId])){
                peers_connection[connectionId].removeTrack(senders[connectionId]);
                senders[connectionId] = null;
            }
        }
    }

    function removeVideoStream(rtpVidSenders) {
        if (videoCamTrack){
            videoCamTrack.stop();
            videoCamTrack = null;
            localDiv.srcObject = null;
            removeMediaSenders(rtpVidSenders);
        }
    }

    async function videoProcess(newVideoState) {
        if (newVideoState === videoStates.NONE) {
            $("#videoCamOnOff").html('<span class="material-icons">videocam_off</span>');
            videoState = newVideoState;

            removeVideoStream(rtpVidSenders);
        }
        if (newVideoState === videoStates.VIDEO) {
            $("#videoCamOnOff").html('<span class="material-icons">videocam_on</span>');
        }
        try {
            let videoStream = null;
            if (newVideoState == videoStates.VIDEO) {
                console.log("videoProcess: video");
                videoStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: 1920,
                        height: 1080
                    },
                    audio: false
                })
            } else if (newVideoState == videoStates.SCREEN) {
                videoStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: 1920,
                        height: 1080
                    },
                    audio: false
                })
            }

            if (videoStream && videoStream.getVideoTracks().length > 0) {
                videoCamTrack = videoStream.getVideoTracks()[0];
                if (videoCamTrack) {
                    localDiv.srcObject = new MediaStream([videoCamTrack]);
                    alert("Video stream has been started");
                    updateMediaSenders(videoCamTrack, rtpVidSenders);
                }
            }
        } catch (e) {
            console.log(e);
            return;
        }

        videoState = newVideoState;
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

    async function setConnection(conId) {
        let connection = new RTCPeerConnection(iceConfig);

        connection.onnegotiationneeded = async (event) => {
            await setOffer(conId)
        }

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                serverProcess(JSON.stringify({'candidate': event.candidate}), conId);
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


        if (videoState == videoStates.VIDEO || videoState == videoStates.SCREEN) {
            if (videoCamTrack) {
                updateMediaSenders(videoCamTrack, rtpVidSenders);
            }
        }

        return connection;
    }

    async function setOffer(conId) {
        let connection = peers_connection[conId];
        let offer = await connection.createOffer();

        await connection.setLocalDescription(offer);

        serverProcess(JSON.stringify({'offer': connection.localDescription}), conId);
    }

    async function SDPProcess(data, fromConnid) {
        let message = JSON.parse(data);
        if (message.answer) {
            await peers_connection[fromConnid].setRemoteDescription(new RTCSessionDescription(message.answer));
        } else if (message.offer) {
            if (!peers_connection[fromConnid]) {
                await setConnection(fromConnid);
            }
            await peers_connection[fromConnid].setRemoteDescription(new RTCSessionDescription(message.offer));
            let answer = await peers_connection[fromConnid].createAnswer();
            await peers_connection[fromConnid].setLocalDescription(answer);
            serverProcess(JSON.stringify({'answer': answer}), fromConnid);
        } else if (message.icecandidate) {
            if (!peers_connection[fromConnid]) {
                await setConnection(fromConnid);
            }
            try {
                await peers_connection[fromConnid].addIceCandidate(new RTCIceCandidate(message.icecandidate));
            } catch (e) {
                console.log(e);
            }
        }
    }

    return {
        setConnection: async (conId) => {
            return await setConnection(conId);
        },
        init: async (SDP_function, myConId) => {
            return await _init(SDP_function, myConId);
        },
        processClientFunc: async (data, fromConnid) => {
            return await SDPProcess(data, fromConnid);
        }
    }
})();


let MyApp = (function () {
    let socket = null;
    let meetingId = null;
    let userId = null;

    function init(uid, mid) {
        userId = uid;
        meetingId = mid;
        $("#meetingContainer").show();
        $("#me h2").text(`${userId} (Me)`);
        document.title = `Meeting: ${meetingId} - ${userId}`;
        eventProcessForSignalingServer();
    }


    const eventProcessForSignalingServer = () => {
        socket = io.connect();

        const SdpFunction = (data, toConId) => {
            socket.emit('SDPProcess', {
                message: data,
                to_connid: toConId
            });
        }

        socket.on('connect', () => {
            if (socket.connected) {

                AppProcess.init(SdpFunction, socket.id);
                if (meetingId && userId) {
                    socket.emit('userConnect', {meetingId: meetingId, displayName: userId});
                }
            }
        });

        socket.on('inform_other_about_me', (data) => {
            addUser(data.otherUserId, data.connectionId);
            AppProcess.setConnection(data.connectionId);
        });

        socket.on('inform_me_about_others', (otherUsers) => {
            if (otherUsers) {
                for (let i = 0; i < otherUsers.length; i++) {
                    addUser(otherUsers[i].userId, otherUsers[i].connectionId);
                    AppProcess.setConnection(otherUsers[i].connectionId);
                }
            }
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
        _init: function (uid, mid) {
            init(uid, mid);
        }

    }
})();