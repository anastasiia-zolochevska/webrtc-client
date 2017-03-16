'use strict';

var isChannelReady = false;
var isServer = false;
var localStream;
var pc;
var remoteStream;

var serverButton = document.getElementById('serverButton');
var startTestButton = document.getElementById('startTestButton');
var connectButton = document.getElementById('connectButton');

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

serverButton.onclick = function () {
  isServer = true;
  openFile();
}

startTestButton.onclick = function () {
  doCall();
}

connectButton.onclick = function(){
  createPeerConnection();
}

var room = 'foo';

var socket = io.connect("http://3dstreamingserver.azurewebsites.net:8080/");
// var socket = io.connect("http://127.0.0.1:8080/");

if (room !== '') {
  socket.emit('create or join', room);
}

socket.on('join', function (room) {
  isChannelReady = true;
});

socket.on('joined', function (room) {
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function (message) {
  console.log('Client received message:', message);
  if (message.type === 'offer') {
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer') {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } 
});


function gotStream(stream) {
  console.log('Adding local stream.');
  localVideo.src = window.URL.createObjectURL(stream);
  localStream = stream;
}


window.onbeforeunload = function () {
  sendMessage('bye');
};


function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    if(isServer){
        pc.addStream(localStream);
    }
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteVideo.src = window.URL.createObjectURL(event.stream);
  remoteStream = event.stream;
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}



function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.', window.URL.createObjectURL(event.stream), event.stream);
  remoteVideo.src = window.URL.createObjectURL(event.stream);
  remoteStream = event.stream;
}


function openFile() {
  var selector = new FileSelector();
  selector.selectSingleFile(function (file) {
    localVideo.loop = true;
    localVideo.src = URL.createObjectURL(file);

    setTimeout(function () {
      var stream;
      if ('captureStream' in localVideo) {
        stream = localVideo.captureStream(15);
      }
      else if ('mozCaptureStream' in localVideo) {
        stream = localVideo.mozCaptureStream(15);
      }
      else if ('webkitCaptureStream' in localVideo) {
        stream = localVideo.webkitCaptureStream(15);
      }

      window.localStream = localStream = stream;
    }, 500);
  });
}

