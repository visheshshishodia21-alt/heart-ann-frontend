import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, HeartPulse, Mic, MicOff, Volume2, VolumeX,
  RefreshCw, AlertCircle, CheckCircle2, Info
} from "lucide-react";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const descriptions = {
  age: "Age in years",
  sex: "Sex code used by the dataset",
  cp: "Chest pain type code",
  trestbps: "Resting blood pressure (mm Hg)",
  chol: "Serum cholesterol (mg/dl)",
  fbs: "Fasting blood sugar code",
  restecg: "Resting ECG code",
  thalach: "Maximum heart rate achieved",
  exang: "Exercise-induced angina code",
  oldpeak: "ST depression value",
  slope: "ST segment slope code",
  ca: "Number of major vessels (0–3)",
  thal: "Thalassemia code"
};

function App() {
  const [features, setFeatures] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceMessage, setVoiceMessage] = useState("");

  const recognitionSupported = useMemo(
    () => typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    []
  );

  useEffect(() => {
    async function loadFeatures() {
      if (!API_URL) {
        setError("Backend URL is not configured. Add VITE_API_URL in your deployment environment.");
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/features`);
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.features) || data.features.length === 0) {
          throw new Error("Backend did not return model feature names.");
        }
        setFeatures(data.features);
        const initial = {};
        data.features.forEach((name) => { initial[name] = ""; });
        setValues(initial);
        setError("");
      } catch (err) {
        setError(`Could not load model features: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    loadFeatures();
  }, []);

  function updateValue(name, value) {
    setValues((old) => ({ ...old, [name]: value }));
    setResult(null);
  }

  function speak(message) {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage("Voice input is not supported in this browser. Try Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setVoiceMessage("Listening… Speak the numeric values in the displayed feature order, separated by pauses or commas.");
    };
    recognition.onerror = (event) => {
      setListening(false);
      setVoiceMessage(`Voice input error: ${event.error}`);
    };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setVoiceMessage(`Heard: "${transcript}"`);
      // Voice entry accepts numbers in the exact order shown on screen.
      const matches = transcript.match(/-?\d+(?:\.\d+)?/g) || [];
      if (!matches.length) {
        setVoiceMessage(`No numbers detected. Heard: "${transcript}". You can enter values manually.`);
        return;
      }
      setValues((old) => {
        const next = { ...old };
        features.forEach((name, index) => {
          if (matches[index] !== undefined) next[name] = matches[index];
        });
        return next;
      });
      setResult(null);
      setVoiceMessage(`Filled ${Math.min(matches.length, features.length)} of ${features.length} fields. Please verify every value.`);
    };
    recognition.start();
  }

  async function predict(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    const missing = features.filter((name) =>
      values[name] === "" || values[name] === undefined
    );
    if (missing.length) {
      setError(`Please enter all values. Missing: ${missing.join(", ")}`);
      return;
    }

    const numericFeatures = {};
    for (const name of features) {
      const number = Number(values[name]);
      if (!Number.isFinite(number)) {
        setError(`Please enter a valid number for ${name}.`);
        return;
      }
      numericFeatures[name] = number;
    }

    setPredicting(true);
    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: numericFeatures })
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data.detail === "string"
          ? data.detail : JSON.stringify(data.detail || data);
        throw new Error(detail);
      }
      setResult(data);
      const spoken = data.prediction === 1
        ? "The model found a pattern associated with disease in its training dataset."
        : "The model did not find a disease pattern in this input.";
      speak(spoken);
    } catch (err) {
      setError(`Prediction failed: ${err.message}`);
    } finally {
      setPredicting(false);
    }
  }

  function resetForm() {
    const cleared = {};
    features.forEach((name) => { cleared[name] = ""; });
    setValues(cleared);
    setResult(null);
    setError("");
    setVoiceMessage("");
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><HeartPulse size={23} /></div>
          <div><strong>Heart Health</strong><span>ANN Prediction Demo</span></div>
        </div>
        <button className="voice-toggle" onClick={() => setVoiceEnabled((v) => !v)}>
          {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          {voiceEnabled ? "Voice on" : "Voice off"}
        </button>
      </header>

      <section className="hero">
        <div className="eyebrow"><Activity size={15} /> MACHINE LEARNING PROJECT</div>
        <h1>Heart Disease<br /><span>Prediction</span></h1>
        <p>Enter the dataset features to receive an output from your trained Artificial Neural Network model.</p>
        <div className="model-pill"><span className="pulse-dot" /> ANN model connected through API</div>
      </section>

      <section className="notice">
        <Info size={19} />
        <p><strong>Educational demo only.</strong> This model is not a medical device and cannot diagnose heart disease. Do not use its result to make healthcare decisions. Consult a qualified healthcare professional for medical concerns.</p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Patient feature inputs</h2><p>Enter values matching the dataset's feature definitions.</p></div>
          <span className="count">{features.length || "—"} FEATURES</span>
        </div>

        {loading ? <div className="status"><RefreshCw className="spin" /> Loading model features…</div> : null}

        {!loading && features.length > 0 && (
          <>
            <div className="voice-row">
              <button className={`mic-button ${listening ? "listening" : ""}`} onClick={startVoiceInput} disabled={!recognitionSupported || listening}>
                {listening ? <MicOff size={19} /> : <Mic size={19} />}
                {listening ? "Listening…" : "Fill using voice"}
              </button>
              <span className="voice-hint">Speak numeric values in the same order as the fields below.</span>
            </div>
            {!recognitionSupported && <p className="small-warning">Voice recognition is unavailable in this browser. Manual entry still works.</p>}
            {voiceMessage && <p className="voice-message">{voiceMessage}</p>}

            <form onSubmit={predict}>
              <div className="fields">
                {features.map((name, index) => (
                  <label className="field" key={name}>
                    <span><b>{index + 1}. {name}</b><small>{descriptions[name] || "Dataset feature value"}</small></span>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={values[name] ?? ""}
                      onChange={(e) => updateValue(name, e.target.value)}
                      placeholder="Enter value"
                      required
                    />
                  </label>
                ))}
              </div>
              <div className="actions">
                <button className="secondary-button" type="button" onClick={resetForm}>Reset</button>
                <button className="primary-button" type="submit" disabled={predicting}>
                  {predicting ? "Predicting…" : "Run ANN prediction"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {error && <div className="error-box"><AlertCircle size={19} /><span>{error}</span></div>}

      {result && (
        <section className="result-card">
          <div className="result-title"><CheckCircle2 size={20} /><h2>Model response</h2></div>
          <div className="result-main">
            <span className="result-label">Dataset pattern</span>
            <strong>{result.prediction === 1 ? "Disease pattern detected" : "No disease pattern detected"}</strong>
          </div>
          <div className="score-row">
            <span>ANN output score</span><b>{(Number(result.model_score) * 100).toFixed(1)}%</b>
          </div>
          <div className="meter"><span style={{ width: `${Math.max(0, Math.min(100, Number(result.model_score) * 100))}%` }} /></div>
          <p className="result-disclaimer">{result.disclaimer}</p>
          <button className="speak-button" onClick={() => speak(result.label || "Prediction completed.")}><Volume2 size={17} /> Hear result</button>
        </section>
      )}

      <footer>
        <p>Built with React · FastAPI · TensorFlow ANN</p>
        <p>Demo only · Not for diagnosis or treatment decisions</p>
      </footer>
    </main>
  );
}

export default App;
