// ---------------------------
// Placeholder button ID
// ---------------------------
const startBtn = document.getElementById("startVoiceBtn");

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  startBtn.innerText = "Connecting...";

  // ---------------------------
  // 1️⃣ Setup AudioContext & Mic
  // ---------------------------
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext({ latencyHint: "interactive" });

  // ---------------------------
  // 2️⃣ Assign client ID
  // ---------------------------
  const clientId = `user_${Math.floor(Math.random() * 1_000_000)}`;

  // ---------------------------
  // 3️⃣ WebSocket Setup
  // ---------------------------
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUri = location.host.includes("66.65.25.15")
    ? `${protocol}//${location.host}/subdomain=api/chat/voice`
    : `${protocol}//api.${location.host}/chat/voice`;

  const ws = new WebSocket(wsUri);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => startBtn.innerText = "Connected";

  // ---------------------------
  // 4️⃣ Mic AudioWorklet Processor with compressor
  // ---------------------------
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
          sample = Math.sign(sample) *
            (this.compressorThreshold +
             (Math.abs(sample)-this.compressorThreshold)/this.compressorRatio);
        }
        this.buffer.push(Math.max(-1, Math.min(1, sample)));
      }
      if (this.buffer.length >= 1024) {
        const chunk = this.buffer.splice(0, 1024);
        this.port.postMessage(chunk);
      }
    }
    return true;
  }
}
registerProcessor('mic-processor', MicProcessor);
`)
  );

  const micNode = new AudioWorkletNode(audioContext, 'mic-processor');
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(micNode);

  // ---------------------------
  // 5️⃣ Debug Panel + Visual Meter
  // ---------------------------
  let lastRms = 0;
  let sentPackets = 0;

  const debugPanel = document.createElement('div');
  debugPanel.style = `
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: rgba(0,0,0,0.7);
    color: white;
    font-family: monospace;
    padding: 5px;
    display: block;
  `;
  const meter = document.createElement('div');
  meter.style = `
    height: 10px;
    width: 100%;
    background: #333;
    margin-top: 4px;
    position: relative;
  `;
  const meterFill = document.createElement('div');
  meterFill.style = `
    height: 100%;
    width: 0%;
    background: lime;
  `;
  meter.appendChild(meterFill);
  debugPanel.appendChild(document.createElement('div')); // text placeholder
  debugPanel.appendChild(meter);
  document.body.appendChild(debugPanel);

  // ---------------------------
  // 6️⃣ Send mic audio over WebSocket
  // ---------------------------
  micNode.port.onmessage = (e) => {
    const chunk = e.data;
    const rms = Math.sqrt(chunk.reduce((sum, v) => sum + v*v, 0)/chunk.length);
    lastRms = rms;

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(new Float32Array(chunk).buffer);
      sentPackets++;
    }
  };

  // ---------------------------
  // 7️⃣ Remote playback with jitter buffer
  // ---------------------------
  const remoteStreams = new Map(); // clientId -> queue of Float32Arrays
  const MIN_BUFFER_CHUNKS = 3;

  function updateDebug() {
    debugPanel.children[0].innerText =
      `Mic RMS: ${lastRms.toFixed(3)} | Sent packets: ${sentPackets} | Connected clients: ${remoteStreams.size+1}`;
    
    let level = Math.min(1, lastRms / 0.6);
    meterFill.style.width = `${(level*100).toFixed(1)}%`;
    meterFill.style.background = level > 1 ? 'red' : 'lime';

    requestAnimationFrame(updateDebug);
  }
  updateDebug();

  ws.onmessage = (event) => {
    const packet = new Uint8Array(event.data);
    const header = packet.slice(0, 36);
    const audioData = packet.slice(36);

    const decoder = new TextDecoder();
    const senderId = decoder.decode(header).replace(/\0/g, '');
    
    if (senderId === clientId) return;

    const float32Chunk = new Float32Array(audioData.buffer);

    if (!remoteStreams.has(senderId)) remoteStreams.set(senderId, []);
    const queue = remoteStreams.get(senderId);
    queue.push(float32Chunk);
    if (queue.length > 50) queue.splice(0, queue.length - 50);
  };

  // ---------------------------
  // 8️⃣ Playback AudioWorklet
  // ---------------------------
  await audioContext.audioWorklet.addModule(
    'data:application/javascript,' +
      encodeURIComponent(`
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.remoteStreams = {};
    this.port.onmessage = (e) => {
      if (e.data.type === 'update') this.remoteStreams = e.data.streams;
    };
  }
  process(_, outputs) {
    const output = outputs[0][0];
    output.fill(0);

    for (const chunks of Object.values(this.remoteStreams)) {
      if (!chunks.length) continue;
      const chunk = chunks[0];
      const len = Math.min(output.length, chunk.length);
      for (let i = 0; i < len; i++) output[i] += chunk[i];
      if (chunk.length <= output.length) chunks.shift();
      else chunks[0] = chunk.slice(output.length);
    }

    for (let i = 0; i < output.length; i++)
      output[i] = Math.max(-1, Math.min(1, output[i]));

    return true;
  }
}
registerProcessor('playback-processor', PlaybackProcessor);
`)
  );

  const playbackNode = new AudioWorkletNode(audioContext, 'playback-processor');
  playbackNode.connect(audioContext.destination);

  // ---------------------------
  // 9️⃣ Update playback queues each frame
  // ---------------------------
  function updatePlaybackStreams() {
    const streamsObj = {};
    for (const [id, queue] of remoteStreams.entries()) {
      if (queue.length >= MIN_BUFFER_CHUNKS) streamsObj[id] = queue;
    }
    playbackNode.port.postMessage({ type: 'update', streams: streamsObj });
    requestAnimationFrame(updatePlaybackStreams);
  }
  updatePlaybackStreams();

  // ---------------------------
  // 🔟 Resume AudioContext
  // ---------------------------
  if (audioContext.state !== "running") await audioContext.resume();
});