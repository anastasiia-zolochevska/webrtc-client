'use strict';

var isChannelReady = false;
var isServer = false;
var localStream;
var receiveChannel;
var peerConnection;
var remoteStream;
var sendChannel;

var serverButton = document.getElementById('serverButton');
var startTestButton = document.getElementById('startTestButton');
var connectButton = document.getElementById('connectButton');
var getStatsButton = document.getElementById('getStatsButton');
var sendTextArea = document.querySelector('textarea#sendTextArea');
var dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
var sendButton = document.querySelector('button#sendButton');
var dataTestButton = document.querySelector('button#dataTestButton');



var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

sendButton.onclick = function () {
  sendData(sendTextArea.value);
}

dataTestButton.onclick = function () {
  sendData(JSON.stringify({ "sentTs": Date.now() }));
}

serverButton.onclick = function () {
  isServer = true;
  openFile();
}

startTestButton.onclick = function () {
  doCall();
}

connectButton.onclick = function () {
  createPeerConnection();
}

getStatsButton.onclick = function () {
  gatherStats();
}

var room = 'foo';

var socket = io.connect("http://3dstreamingsignalingserver.azurewebsites.net:80");
// var socket = io.connect("http://127.0.0.1:1234");

if (room !== '') {
  socket.emit('create or join', room);
}

socket.on('join', function (room) {
  isChannelReady = true;
});

socket.on('joined', function (room) {
  isChannelReady = true;
});

socket.on('log', function (array) {
  //console.log.apply(console, array);
});


function sendMessage(message) {
  // console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function (message) {
  // console.log('Client received message:', message);
  if (message.type === 'offer') {
    peerConnection.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer') {
    peerConnection.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peerConnection.addIceCandidate(candidate);
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



var pcConfig = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
};


function sendData(data) {
  sendChannel.send(data);
}

function receiveChannelCallback(event) {
  console.log('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = onReceiveMessageCallback;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;
}

function onReceiveMessageCallback(event) {
  var object = JSON.parse(event.data);
  console.log('Received Message', object);
  if (!object.receivedTs) {
    object = Object.assign({ receivedTs: Date.now() }, object);
    sendData(JSON.stringify(object));
  }
  else {
    console.log("RTT", Date.now() - object.sentTs);
  }
  //  dataChannelReceive.value = event.data;
}

function onSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  console.log('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    sendTextArea.disabled = false;
    sendTextArea.focus();
  } else {
    sendTextArea.disabled = true;
    sendButton.disabled = true;
  }
}

function onReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  console.log('Receive channel state is: ' + readyState);
}


function createPeerConnection() {
  try {

    peerConnection = new RTCPeerConnection(pcConfig);
    if (isServer) {
      sendChannel
      //peerConnection.addStream(localStream);
    }
    sendChannel = peerConnection.createDataChannel("sendChannel");

    peerConnection.onicecandidate = handleIceCandidate;
    peerConnection.onaddstream = handleRemoteStreamAdded;
    sendChannel.onopen = onSendChannelStateChange;
    sendChannel.onclose = onSendChannelStateChange;

    peerConnection.ondatachannel = receiveChannelCallback;

    console.log('Created RTCPeerConnnection', peerConnection);
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    console.log('icecandidate event candidate info: ', event.candidate.candidate);
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
  peerConnection.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  peerConnection.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  peerConnection.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error.toString());
}



function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.', window.URL.createObjectURL(event.stream), event.stream);
  remoteVideo.src = window.URL.createObjectURL(event.stream);
  remoteStream = event.stream;
}


var stats = {};
stats.rttStats = new StatisticsAggregate();

// function gotStats(response) {
//   console.log("stats", response);

//   for (var i in response) {
//     if (response[i].id === 'bweforvideo') {
//       console.log("googAvailableSendBandwidth", response[i].googAvailableSendBandwidth);
//     }
//     if (response[i].type === 'ssrc') {
//       console.log("googRtt", response[i].googRtt);
//     }
//     if (response[i].type === 'inboundrtp') {
//       console.log("mozRtt", response[i].mozRtt);
//       console.log("jitter", response[i].jitter);
//       console.log("packetsLost", response[i].packetsLost);
//     }
//     if (response[i].type === 'outboundrtp') {
//       console.log("bitrateMean", response[i].bitrateMean);
//       console.log("bitrateStdDev", response[i].bitrateStdDev);
//       console.log("framerateMean", response[i].framerateMean);
//     }
//   }

// }


function gotStats(response) {
  for (var i in response) {
    if (response[i].type === 'ssrc') {
      console.log("googRtt", response[i].googRtt);
    }
    if (response[i].type === 'inboundrtp') {
      console.log("packetsLost", response[i].packetsLost);
    }
  }
}

function gatherStats() {
  var stats = [];
  var statsCollectTime = [];
  var statStepMs = 500;
  var counter = 0;

  var selector = (adapter.browserDetails.browser === 'chrome') ?
    (localStream || remoteStream).getVideoTracks()[0] : null;


  function getStats_() {

    peerConnection.getStats(selector)
      .then((response) => {
        console.log("response", response);
        for (var index in response) {
          stats.push(response[index]);
          statsCollectTime.push(Date.now());
        }
        if (counter == 5) {
          gotStats(stats);
        }
        else {
          setTimeout(getStats_, statStepMs)
        }
        counter++;
      })
      .catch(function (error) {
        console.log("Error gathering starts", error)
      });
  }

  setTimeout(getStats_, statStepMs);


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

