import { useState, useEffect, useRef } from "react";

export default function useAgentAudioAmplitude(isAgentSpeaking: boolean, getAnalyser: () => AnalyserNode | null) {
    const [amplitude, setAmplitude] = useState<number>(0);
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
        const analyser = getAnalyser();
        if (!isAgentSpeaking || !analyser) return;

        const dataArray = new Uint8Array(analyser.fftSize);

        const updateAmplitude = () => {
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const val = (dataArray[i] - 128) / 128.0;
                sum += val * val;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setAmplitude(rms);
            rafIdRef.current = requestAnimationFrame(updateAmplitude);
        };

        updateAmplitude();

        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [isAgentSpeaking, getAnalyser]);

    return amplitude;
}
