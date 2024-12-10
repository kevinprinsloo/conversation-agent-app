type AnimatedCircleProps = {
    amplitude: number;
    isRecording: boolean;
};

function AnimatedCircle({ amplitude, isRecording }: AnimatedCircleProps) {
    const scale = 1 + amplitude * 1.5;

    return (
        <div
            className="transition-transform duration-200 ease-out flex items-center justify-center"
            style={{
                width: "100px",
                height: "100px",
                transform: `scale(${scale})`,
                transformOrigin: "center",
            }}
        >
            <div
                className={`w-full h-full wavy-shape ${
                    isRecording ? "recording-gradient" : "idle-gradient"
                } flex items-center justify-center`}
            >
                <div className="w-3/4 h-3/4 rounded-full bg-white/10 animate-pulse"></div>
            </div>
        </div>
    );
}

export default AnimatedCircle;
