const voiceButton = document.getElementById("startVoiceBtn");
let audioContext, stream, ws;
let micNode, playbackNode;
let remoteStreams = new Map();
let connectedIds = new Set();
let lastRms = 0, sentPackets = 0;
let animationFrameId;
let debugPanel;
let selfId;

async function startVoice() {
  voiceButton.innerText = "connecting"
  audioContext = new AudioContext({ latencyHint: "interactive" });
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  await audioContext.audioWorklet.addModule(
    'data:application/javascript,' +
      encodeURIComponent(`
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.compressorThreshold = 0.6;
    this.compressorRatio = 4.0;
  }
  process(inputs) {
    const input = inputs[0][0]; // mono
    if (input) {
      for (let i = 0; i < input.length; i++) {
        let sample = input[i];
        if (Math.abs(sample) > this.compressorThreshold) {
          sample = Math.sign(sample)*(this.compressorThreshold + (Math.abs(sample)-this.compressorThreshold)/this.compressorRatio);
        }
        this.buffer.push(Math.max(-1, Math.min(1, sample)));
      }
      if (this.buffer.length >= 512) {
        this.port.postMessage(this.buffer.splice(0, 512));
      }
    }
    return true;
  }
}
registerProcessor('mic-processor', MicProcessor);
`)
  );

  micNode = new AudioWorkletNode(audioContext, 'mic-processor');
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(micNode);

  debugPanel = document.getElementById("voiceDebug");
  if (!debugPanel) {
    debugPanel = document.createElement('div');
    debugPanel.id = "voiceDebug";
    debugPanel.style = "position:fixed;bottom:0;left:0;width:100%;background:rgba(0,0,0,0.7);color:white;font-family:monospace;padding:5px;";
    const meter = document.createElement('div');
    meter.style = "height:10px;width:100%;background:#333;margin-top:4px;position:relative";
    const meterFill = document.createElement('div');
    meterFill.style = "height:100%;width:0%;background:lime";
    meter.appendChild(meterFill);
    debugPanel.appendChild(document.createElement('div'));
    debugPanel.appendChild(meter);
    document.body.appendChild(debugPanel);
  }
  debugPanel.style.display = "block";

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUri = location.host.includes("66.65.25.15")
    ? `${protocol}//${location.host}/subdomain=api/chat/voice`
    : `${protocol}//api.${location.host}/chat/voice`;

  ws = new WebSocket(wsUri);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => voiceButton.innerText = "disconnect";

  micNode.port.onmessage = (e) => {
    const chunk = e.data;
    const rms = Math.sqrt(chunk.reduce((sum,v)=>sum+v*v,0)/chunk.length);
    lastRms = rms;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(new Float32Array(chunk).buffer);
      sentPackets++;
    }
  };

  ws.onmessage = async (event) => {
    if (typeof event.data === "string") {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
  
      if (msg.type === "voice-connect") {
        connectedIds.add(msg.clientId);
        if (!remoteStreams.has(msg.clientId)) {
          remoteStreams.set(msg.clientId, []);
        }
      }
  
      if (msg.type === "voice-disconnect") {
        connectedIds.delete(msg.clientId);
        remoteStreams.delete(msg.clientId);
      }
  
      if (msg.type === "info") {
        selfId = msg.clientId;
      }
      return;
    }
  
    let buffer;
    if (event.data instanceof Blob) {
      buffer = await event.data.arrayBuffer();
    } else if (event.data instanceof ArrayBuffer) {
      buffer = event.data;
    } else {
      return;
    }
  
    if (buffer.byteLength <= 36) return;
  
    const packet = new Uint8Array(buffer);
    const header = packet.subarray(0, 36);
    const audioData = packet.subarray(36);
  
    const senderId = new TextDecoder().decode(header).replace(/\0/g, "");
  
    if (senderId === selfId) return;
  
    if (!remoteStreams.has(senderId)) {
      remoteStreams.set(senderId, []);
      connectedIds.add(senderId);
    }
  
    const queue = remoteStreams.get(senderId);
  
    const float32Chunk = new Float32Array(
      audioData.buffer,
      audioData.byteOffset,
      audioData.byteLength / 4
    );
  
    queue.push(float32Chunk);
    if (queue.length > 50) queue.splice(0, queue.length - 50);
  };

  await audioContext.audioWorklet.addModule(
    'data:application/javascript,'+
    encodeURIComponent(`
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.remoteStreams={};
    this.port.onmessage = (e) => {
      if(e.data.type==='update') this.remoteStreams=e.data.streams;
    }
  }
  process(_,outputs) {
    const output=outputs[0][0];
    output.fill(0);
    for(const chunks of Object.values(this.remoteStreams)){
      if(!chunks.length) continue;
      const chunk=chunks[0];
      const len=Math.min(output.length,chunk.length);
      for(let i=0;i<len;i++) output[i]+=chunk[i];
      if(chunk.length<=output.length) chunks.shift();
      else chunks[0]=chunk.slice(output.length);
    }
    for(let i=0;i<output.length;i++) output[i]=Math.max(-1,Math.min(1,output[i]));
    return true;
  }
}
registerProcessor('playback-processor',PlaybackProcessor);
`)
  );

  playbackNode = new AudioWorkletNode(audioContext,'playback-processor');
  playbackNode.connect(audioContext.destination);

  function updatePlaybackStreams(){
    const streamsObj={};
    for(const [id,queue] of remoteStreams.entries()){
      if(queue.length>=3) streamsObj[id]=queue;
    }
    playbackNode.port.postMessage({type:'update',streams:streamsObj});

    debugPanel.children[0].innerText=
      `Mic RMS: ${lastRms.toFixed(3)} | Sent packets: ${sentPackets} | Connected clients: ${connectedIds.size} | ID: ${selfId}`;
    const meterFill = debugPanel.children[1].children[0];
    let level=Math.min(1,lastRms/0.6);
    meterFill.style.width=`${(level*100).toFixed(1)}%`;
    meterFill.style.background=level>1?'red':'lime';

    animationFrameId=requestAnimationFrame(updatePlaybackStreams);
  }
  updatePlaybackStreams();

  if(audioContext.state!=='running') await audioContext.resume();
}

function stopVoice(){
  if(ws) ws.close();
  if(micNode) micNode.disconnect();
  if(playbackNode) playbackNode.disconnect();
  if(animationFrameId) cancelAnimationFrame(animationFrameId);
  debugPanel.style.display = "none";
  voiceButton.innerText = "connect"
  remoteStreams.clear();
  connectedIds.clear();
  lastRms=0;
  sentPackets=0;
}

voiceButton.addEventListener('click',()=>{
  if(ws && ws.readyState===WebSocket.OPEN){
    stopVoice();
  }else{
    startVoice();
  }
});
