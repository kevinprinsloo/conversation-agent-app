import { useState, useEffect, useRef } from "react";

export default function useAudioAmplitude(isActive: boolean) {
    const [amplitude, setAmplitude] = useState<number>(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        let isCancelled = false;

        const setup = async () => {
            // Only setup if isActive is true
            if (!isActive) return;
            
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (isCancelled) return;

            audioContextRef.current = new AudioContext();
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            const bufferLength = analyserRef.current.frequencyBinCount;
            dataArrayRef.current = new Uint8Array(bufferLength);

            sourceRef.current.connect(analyserRef.current);

            visualize();
        };

        setup();

        return () => {
            isCancelled = true;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            // Stop the tracks to release microphone
            stream?.getAudioTracks().forEach(track => track.stop());
        };
    }, [isActive]);

    const visualize = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        
        // Calculate RMS amplitude
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
            const val = (dataArrayRef.current[i] - 128) / 128.0;
            sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArrayRef.current.length);
        // rms will be between ~0 and 1, where 0 = silence, 1 = max amplitude
        setAmplitude(rms);

        rafIdRef.current = requestAnimationFrame(visualize);
    };

    return amplitude;
}
