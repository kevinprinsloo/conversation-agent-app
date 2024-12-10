import { useRef } from "react";
import { Player } from "@/components/audio/player";

const SAMPLE_RATE = 24000;

export default function useAudioPlayer() {
    const audioPlayer = useRef<Player | null>(null);

    const reset = async () => {
        audioPlayer.current = new Player();
        await audioPlayer.current.init(SAMPLE_RATE);
    };

    const play = (base64Audio: string) => {
        const binary = atob(base64Audio);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        const pcmData = new Int16Array(bytes.buffer);
        audioPlayer.current?.play(pcmData);
    };

    const stop = () => {
        audioPlayer.current?.stop();
    };

    // Provide a way to get the analyser node for amplitude visualization
    const getAnalyser = () => {
        return audioPlayer.current?.getAnalyserNode() ?? null;
    };

    return { reset, play, stop, getAnalyser };
}
