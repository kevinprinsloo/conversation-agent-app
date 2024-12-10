export class Player {
    private playbackNode: AudioWorkletNode | null = null;
    private audioContext: AudioContext | null = null;
    private analyserNode: AnalyserNode | null = null;

    async init(sampleRate: number) {
        this.audioContext = new AudioContext({ sampleRate });
        await this.audioContext.audioWorklet.addModule("audio-playback-worklet.js");

        this.playbackNode = new AudioWorkletNode(this.audioContext, "audio-playback-worklet");

        // Create an AnalyserNode to measure the amplitude of the played audio
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 2048; // Adjust as needed

        // Connect: playbackNode -> analyserNode -> audioContext.destination
        this.playbackNode.connect(this.analyserNode);
        this.analyserNode.connect(this.audioContext.destination);
    }

    // Allow external code to access the analyser node
    getAnalyserNode(): AnalyserNode | null {
        return this.analyserNode;
    }

    play(buffer: Int16Array) {
        if (this.playbackNode) {
            this.playbackNode.port.postMessage(buffer);
        }
    }

    stop() {
        if (this.playbackNode) {
            this.playbackNode.port.postMessage(null);
        }
    }
}
