let rtcConnection = null
let myVideoStream = null
let video = null;
let otherVideo = null
let context = null;
let streaming = false;

let width = 100;    // We will scale the photo width to this.
let height = 0;     // This will be computed based on the input stream

let mediaConstraints = {
    audio: false, // We want an audio track
    video: true // ...and we want a video track
};

let myPeerId;
let targetPeerId;

let authToken = "";
let baseUrl = "";

/// SignalR setup ///
let srConnection = buildSignalRConnection();

function buildSignalRConnection() {
    const sr =  new signalR.HubConnectionBuilder()
        .withUrl(`https://${baseUrl}/api/hub/connect`, { accessTokenFactory: () => authToken })
        .configureLogging(signalR.LogLevel.Information)
        .build();

    sr.on("error", data => {
        console.error("error", data);

    });

    sr.on("exchangeIceCandidate", data => {
        console.log("exchangeIceCandidate", data);
        rtcConnection.addIceCandidate(new RTCIceCandidate(data.iceCandidate));

    });

    sr.on("exchangeSdp", data => {
        console.log("exchangeSdp", data);
        targetPeerId = data.sourcePeerId;
        if (data.sdp.type == 'offer') {
            createPeerConnection()
            rtcConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
                .then(function () {
                    //                return navigator.mediaDevices.getDisplayMedia(mediaConstraints);
                    return navigator.mediaDevices.getUserMedia(mediaConstraints);
                })
                .then(function (stream) {
                    myVideoStream = stream
                    video = document.getElementById("video")
                    video.srcObject = stream

                    // Add our stream to the connection to be shared
                    rtcConnection.addStream(myVideoStream);
                })
                .then(function () {
                    return rtcConnection.createAnswer()
                })
                .then(function (answer) {
                    return rtcConnection.setLocalDescription(answer);
                })
                .then(function () {
                    srConnection.invoke("exchangeSdp", {
                        targetPeerId: targetPeerId,
                        sdp: {
                            sdp: rtcConnection.localDescription.sdp,
                            type: rtcConnection.localDescription.type
                        }
                    });
                })
        }
        else if (data.sdp.type == 'answer') {
            rtcConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
        }
    });

    return sr;
}

// automatically reconnect on close
srConnection.onclose(connectToSignalingHub);

// define (re)start function
async function connectToSignalingHub() {
    try {
        await srConnection.start({ jsonp: true });
        console.log("SignalR Connected.");
    } catch (err) {
        console.log(err);
        setTimeout(connectToSignalingHub, 5000);
    }
};

const getAccessToken = async (user, pass) => {
    const endpoint = `https://${baseUrl}/api/auth/signin`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify({
                email: user,
                password: pass
            }),
            headers: {
                "Content-Type": "application/json"
            }
        });
        if (response.ok) {
            return await response.json();
        }
    }
    catch (error) {
        console.error(error)
    }
};

// connect to SignalR

window.WebCamFunctions = {
    init: async (options) => { await init(options); },
    start: (options) => { onStart(options); }
};

async function init(options) {
    video = document.getElementById(options.videoID);
    width = options.width;

    baseUrl = options.baseUrl;
    myPeerId = options.myPeerId;
    targetPeerId = options.targetPeerId;

    mediaConstraints.audio = options.Audio;

    const data = await getAccessToken(options.user, options.pass);

    console.log(data);
    authToken = data.accessToken;

    srConnection = buildSignalRConnection();

    await connectToSignalingHub();

    await srConnection.invoke("registerPeer", myPeerId);
}

function onStart(options) {

    createPeerConnection()

    navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(function (stream) {
            video.srcObject = stream
            myVideoStream = stream

            rtcConnection.addStream(myVideoStream)
        })
        .catch(function (err) {
            console.log("An error occurred: " + err);
        });

    video.addEventListener('canplay', function () {
        if (!streaming) {
            height = video.videoHeight / (video.videoWidth / width);

            if (isNaN(height)) {
                height = width / (4 / 3);
            }

            video.setAttribute('width', width);
            video.setAttribute('height', height);
            streaming = true;
        }
    }, false);
}

window.onbeforeunload = function (event) {
    let message = 'You sure?';
    if (typeof event == 'undefined') {
        event = window.event;
    }
    if (event) {
        event.returnValue = message;
    }
    srConnection.stop();
    return message;
};

// code from MDN examples
function createPeerConnection()
{
    rtcConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302"
                ]
            }
        ]
    });

    
    rtcConnection.onicecandidate = function(event) {
        if (event.candidate) {
            // send to peers over SignalR
            srConnection.invoke("exchangeIceCandidate", {
                targetPeerId: targetPeerId,
                iceCandidate: {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                }
            });
        }
    }

    rtcConnection.onaddstream = function(event) {
        otherVideo = document.getElementById('remote');

        // Attach the stream to the Video element via adapter.js
        otherVideo.srcObject = event.stream
        otherVideo.play()
    }

    rtcConnection.onnegotiationneeded = function()
    {
        rtcConnection.createOffer()
        .then(function(offer) {
            return rtcConnection.setLocalDescription(offer)
        })
        .then(function() {
            srConnection.invoke("exchangeSdp", {
                targetPeerId: targetPeerId,
                sdp: {
                    sdp: rtcConnection.localDescription.sdp,
                    type: rtcConnection.localDescription.type
                }
            });
        })
    }
}
