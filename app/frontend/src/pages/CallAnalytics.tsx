import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Radar } from "react-chartjs-2";
import { Chart, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import "./CallAnalytics.css";

Chart.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface IKeyPhrases {
    problems: string[];
    resolutions: string[];
    needsReview: string[];
}

interface IAnalytics {
    callSummary: string;
    customerIntent: {
        mainIntent: string;
        secondaryIntents: string[];
    };
    sentiment: {
        customerSentimentLabel: string;
        customerSentimentScore: number;
        agentSentimentLabel: string;
        agentSentimentScore: number;
    };
    keyTopics: string[];
    callResolution: string;
    compliance: string;
    escalation: string;
    complexityScore: number;
    intentConfidence: number;
    keyPhrases: IKeyPhrases; // New field
}

interface ITranscriptEntry {
    speaker: string;
    text: string;
    timestamp: string;
}

export default function CallAnalytics() {
    const location = useLocation();
    const transcriptEntries: ITranscriptEntry[] = location.state?.transcriptEntries || [];

    const [analytics, setAnalytics] = useState<IAnalytics | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const response = await fetch("/api/analyzeCall", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transcriptEntries })
                });
    
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
    
                const data = await response.json();
    
                if (data && data.analytics) {
                    setAnalytics(data.analytics);
                } else {
                    setError("No analytics data returned");
                }
                
            } catch (err) {
                console.error("Error fetching analytics:", err);
                setError("Error occurred while analyzing the call.");
            } finally {
                setLoading(false);
            }
        };
    
        if (transcriptEntries.length > 0) {
            fetchAnalytics();
        }
    }, [transcriptEntries]);

    const radarData = analytics ? {
        labels: ["Customer Sentiment", "Agent Sentiment", "Complexity", "Intent Confidence"],
        datasets: [
            {
                label: "Call Metrics",
                data: [
                    analytics.sentiment.customerSentimentScore,
                    analytics.sentiment.agentSentimentScore,
                    analytics.complexityScore,
                    analytics.intentConfidence
                ],
                backgroundColor: "rgba(75,192,192,0.2)",
                borderColor: "rgba(75,192,192,1)",
                borderWidth: 2
            }
        ]
    } : null;

    const highlightTranscriptText = (text: string, keyTopics: string[], searchTerm: string) => {
        const badWords = ["issue", "problem", "error", "fail", "failed"];
        
        let highlighted = text;

        // Highlight keyTopics in green
        keyTopics.forEach((topic) => {
            const regex = new RegExp(`\\b(${topic})\\b`, "gi");
            highlighted = highlighted.replace(regex, '<span class="highlight-good">$1</span>');
        });

        // Highlight bad words in red
        badWords.forEach((bad) => {
            const regex = new RegExp(`\\b(${bad})\\b`, "gi");
            highlighted = highlighted.replace(regex, '<span class="highlight-bad">$1</span>');
        });

        // Highlight search query in yellow
        if (searchTerm.trim() !== "") {
            const searchRegex = new RegExp(`(${searchTerm})`, "gi");
            highlighted = highlighted.replace(searchRegex, '<span class="highlight-search">$1</span>');
        }

        return highlighted;
    };

    const transcriptContent = useMemo(() => {
        if (!analytics) return transcriptEntries;
        return transcriptEntries.map(entry => {
            const processedText = highlightTranscriptText(entry.text, analytics.keyTopics, searchQuery);
            return { ...entry, highlightedText: processedText };
        });
    }, [transcriptEntries, analytics, searchQuery]);

    return (
        <div className="call-analytics-container">
            <h1 className="page-title">Post-Call Analytics</h1>
            <div className="columns">
                {/* Analytics on the left */}
                <div className="analytics-column">
                    <h2 className="section-title">Analytics</h2>
                    {loading ? (
                        <div className="spinner">Loading...</div>
                    ) : error ? (
                        <div className="analytics-result error">{error}</div>
                    ) : analytics ? (
                        <div className="analytics-result">
                            <div className="analytics-card">
                                <h3>Call Summary</h3>
                                <p>{analytics.callSummary}</p>
                            </div>
                            <div className="analytics-card">
                                <h3>Customer Intent</h3>
                                <p><strong>Main Intent:</strong> {analytics.customerIntent.mainIntent}</p>
                                {analytics.customerIntent.secondaryIntents.length > 0 && (
                                    <p><strong>Secondary Intents:</strong> {analytics.customerIntent.secondaryIntents.join(", ")}</p>
                                )}
                            </div>
                            <div className="analytics-card">
                                <h3>Sentiment</h3>
                                <p><strong>Customer:</strong> {analytics.sentiment.customerSentimentLabel} ({analytics.sentiment.customerSentimentScore}/10)</p>
                                <p><strong>Agent:</strong> {analytics.sentiment.agentSentimentLabel} ({analytics.sentiment.agentSentimentScore}/10)</p>
                            </div>
                            <div className="analytics-card">
                                <h3>Key Topics</h3>
                                <ul>
                                    {analytics.keyTopics.map((topic, idx) => <li key={idx}>{topic}</li>)}
                                </ul>
                            </div>

                            {/* New section for key phrases */}
                            <div className="analytics-card">
                                <h3>Key Phrases</h3>
                                <h4>Problems</h4>
                                {analytics.keyPhrases.problems.length === 0 ? (
                                    <p>No specific problem phrases detected.</p>
                                ) : (
                                    <ul>
                                        {analytics.keyPhrases.problems.map((phrase, i) => (
                                            <li key={i}>{phrase}</li>
                                        ))}
                                    </ul>
                                )}

                                <h4>Resolutions</h4>
                                {analytics.keyPhrases.resolutions.length === 0 ? (
                                    <p>No resolutions detected.</p>
                                ) : (
                                    <ul>
                                        {analytics.keyPhrases.resolutions.map((phrase, i) => (
                                            <li key={i}>{phrase}</li>
                                        ))}
                                    </ul>
                                )}

                                <h4>Needs Further Review</h4>
                                {analytics.keyPhrases.needsReview.length === 0 ? (
                                    <p>No phrases flagged for further review.</p>
                                ) : (
                                    <ul>
                                        {analytics.keyPhrases.needsReview.map((phrase, i) => (
                                            <li key={i}>{phrase}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="analytics-card">
                                <h3>Call Resolution</h3>
                                <p>{analytics.callResolution}</p>
                            </div>
                            <div className="analytics-card">
                                <h3>Compliance</h3>
                                <p>{analytics.compliance}</p>
                            </div>
                            <div className="analytics-card">
                                <h3>Escalation</h3>
                                <p>{analytics.escalation}</p>
                            </div>
                            <div className="analytics-card">
                                <h3>Complexity Score</h3>
                                <p>{analytics.complexityScore}/10</p>
                            </div>
                            <div className="analytics-card">
                                <h3>Intent Confidence</h3>
                                <p>{analytics.intentConfidence}/10</p>
                            </div>
                            {radarData && (
                                <div className="analytics-card chart-card">
                                    <h3>Call Metrics Chart</h3>
                                    <Radar data={radarData} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="analytics-result">No data available</div>
                    )}
                </div>

                {/* Transcript on the right */}
                <div className="transcript-column">
                    <h2 className="section-title">Transcript</h2>
                    <div className="transcript-search">
                        <input
                            type="text"
                            placeholder="Search transcript..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="transcript-list">
                        {transcriptContent.map((entry, index) => (
                            <div key={index} className={`transcript-entry ${entry.speaker.toLowerCase()}`}>
                                <div className="transcript-meta">
                                    <span className="speaker">{entry.speaker}</span>
                                    <span className="timestamp">{entry.timestamp}</span>
                                </div>
                                <div
                                    className="transcript-text"
                                    dangerouslySetInnerHTML={{ __html: (entry as any).highlightedText }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
