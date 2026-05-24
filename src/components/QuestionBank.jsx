import React, { useEffect, useMemo, useRef, useState } from "react";
import '../MockInterview.css';

// ✅ Single-file React component you can drop into any React app.
// Uses Tailwind classes for styling (no external libs required).
// Features:
// - Pick topics (Java, Spring Boot, System Design)
// - 60–180s timer per question
// - Speech-to-text (Web Speech API) + Text-to-speech
// - Live scoring based on keyword coverage
// - Model answers + improvement tips
// - Session summary + export
//
// Notes:
// - Speech recognition works in Chrome-based browsers.
// - Tailwind optional; it will still look fine without it.

const QUESTION_BANK = {
  Java: [
    {
      q: "What are the pillars of OOP in Java?",
      a: "Encapsulation, Abstraction, Inheritance, Polymorphism.",
      keywords: ["encapsulation", "abstraction", "inheritance", "polymorphism"],
      tips: "Briefly define each pillar and give a tiny example."
    },
    {
      q: "HashMap vs ConcurrentHashMap?",
      a: "HashMap is not thread-safe; ConcurrentHashMap is thread-safe via segmented/striped locking and allows concurrent reads/writes.",
      keywords: ["thread-safe", "locking", "concurrent", "hashmap"],
      tips: "Mention fail-fast iterators and that synchronizedMap differs from ConcurrentHashMap."
    },
    {
      q: "Explain JVM memory areas & GC at high level.",
      a: "JVM memory: Heap, Stack, Metaspace. GC reclaims unreachable objects using algorithms like G1; pauses are managed via stop‑the‑world phases.",
      keywords: ["heap", "stack", "metaspace", "gc", "g1"],
      tips: "Add Young vs Old generation and what triggers GC."
    },
    {
      q: "final vs finally vs finalize().",
      a: "final: keyword for constants/methods/classes; finally: block that always runs; finalize(): deprecated cleanup hook called by GC (not reliable).",
      keywords: ["final", "finally", "finalize", "deprecated"],
      tips: "State that finalize() is deprecated/removed in modern Java."
    }
  ],
  "Spring Boot": [
    {
      q: "Spring vs Spring Boot?",
      a: "Spring is the core ecosystem with manual setup; Spring Boot adds auto-configuration, starters, and an embedded server for rapid development.",
      keywords: ["auto-configuration", "starters", "embedded", "spring"],
      tips: "Mention @SpringBootApplication combines 3 annotations."
    },
    {
      q: "How does dependency injection work in Spring?",
      a: "IoC container manages beans and injects dependencies via constructor/setter/field, guided by annotations (@Component, @Service, @Autowired).",
      keywords: ["ioc", "beans", "constructor", "autowired"],
      tips: "Prefer constructor injection for testability/immutability."
    },
    {
      q: "Explain Spring Boot auto-configuration.",
      a: "Based on classpath, beans, and properties, Boot creates sensible defaults using conditionals (@ConditionalOnClass, etc.).",
      keywords: ["classpath", "conditional", "properties", "auto"],
      tips: "Note overriding with @Configuration or properties."
    },
    {
      q: "How to implement JWT auth in Spring Security?",
      a: "Issue JWT on login, verify it via a filter, set Authentication in SecurityContext; stateless sessions.",
      keywords: ["jwt", "filter", "securitycontext", "stateless"],
      tips: "Mention token expiry/refresh and CSRF off for stateless APIs."
    }
  ],
  "System Design": [
    {
      q: "Design a URL shortener like bit.ly.",
      a: "API to create short codes from long URLs, store mapping in DB/Cache, redirect via LB/Edge; use base62 keys, rate limiting, TTL analytics.",
      keywords: ["base62", "cache", "db", "redirect", "rate"],
      tips: "Talk about collisions, custom aliases, and analytics pipeline."
    },
    {
      q: "Design real-time model serving for AI.",
      a: "Expose a low-latency inference API behind a gateway; use autoscaled model servers (e.g., TF Serving), feature store, async queue for heavy jobs, and observability (latency, drift).",
      keywords: ["latency", "autoscale", "feature store", "observability", "drift"],
      tips: "Add canary rollout and model versioning."
    },
    {
      q: "How to scale to millions of RPS?",
      a: "Tiered LBs, aggressive caching (CDN/edge/app), stateless services, sharded/replicated data, queues for spikes, backpressure/circuit breakers.",
      keywords: ["caching", "stateless", "sharding", "queues", "load balancer"],
      tips: "Quote SLOs, capacity planning, and rate limits."
    },
    {
      q: "Design a recommendation system.",
      a: "Offline training + batch feature pipelines, online retrieval+ranking, feature store, A/B testing, feedback loop for retraining.",
      keywords: ["retrieval", "ranking", "feature", "ab testing", "feedback"],
      tips: "Mention candidate generation and cold-start strategies."
    }
  ]
};

const DEFAULT_SETTINGS = {
  perQuestionSeconds: 90,
  totalQuestions: 6,
  tts: false,
  stt: false
};

const useSpeech = () => {
  const synthRef = useRef(window.speechSynthesis || null);
  const voices = useMemo(() => (window.speechSynthesis ? window.speechSynthesis.getVoices() : []), []);

  const speak = (text) => {
    try {
      if (!('speechSynthesis' in window)) return;
      const utter = new SpeechSynthesisUtterance(text);
      const sel = voices.find(v => /en-/.test(v.lang));
      if (sel) utter.voice = sel;
      synthRef.current?.speak(utter);
    } catch {}
  };

  const stop = () => synthRef.current?.cancel();

  return { speak, stop };
};

const useRecognition = (enabled) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      setTranscript(t);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, [enabled]);

  const start = () => {
    if (!recRef.current) return;
    setTranscript("");
    setListening(true);
    try { recRef.current.start(); } catch {}
  };
  const stop = () => {
    if (!recRef.current) return;
    recRef.current.stop();
    setListening(false);
  };

  return { listening, transcript, start, stop };
};

function scoreAnswer(answer, keywords) {
  if (!answer) return 0;
  const text = answer.toLowerCase();
  const hits = keywords.reduce((acc, k) => acc + (text.includes(k.toLowerCase()) ? 1 : 0), 0);
  const density = Math.min(1, text.split(/\s+/).length / 150); // long answers get slight boost up to ~150 words
  const base = hits / Math.max(1, keywords.length);
  return Math.round((0.85 * base + 0.15 * density) * 100);
}

function pickQuestions(selectedTopics, total) {
  const pool = selectedTopics.flatMap((t) => QUESTION_BANK[t] || []);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(total, shuffled.length));
}

export default function MockInterviewApp() {
  const [selectedTopics, setSelectedTopics] = useState(["Java", "Spring Boot", "System Design"]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState("setup"); // setup | running | review
  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionSet, setQuestionSet] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(settings.perQuestionSeconds);

  const { speak, stop } = useSpeech();
  const { stt } = settings;
  const recog = useRecognition(stt);

  useEffect(() => {
    if (phase !== "running") return;
    setTimeLeft(settings.perQuestionSeconds);
  }, [currentIdx, phase, settings.perQuestionSeconds]);

  useEffect(() => {
    if (phase !== "running") return;
    if (timeLeft <= 0) {
      handleSubmitAnswer();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  const startInterview = () => {
    const qs = pickQuestions(selectedTopics, settings.totalQuestions);
    setQuestionSet(qs);
    setAnswers(Array(qs.length).fill({ text: "", score: 0 }));
    setCurrentIdx(0);
    setPhase("running");
    if (settings.tts && qs[0]) speak(qs[0].q);
    if (settings.stt) recog.start();
  };

  const handleSubmitAnswer = () => {
    const curr = questionSet[currentIdx];
    if (!curr) return;
    const typed = answers[currentIdx]?.text || (settings.stt ? recog.transcript : "");
    const score = scoreAnswer(typed, curr.keywords);
    const nextAnswers = [...answers];
    nextAnswers[currentIdx] = { text: typed, score };
    setAnswers(nextAnswers);
    if (settings.tts) speak(`Suggested answer: ${curr.a}`);
    if (settings.stt) recog.stop();
    // Move next after a short pause to show feedback
    setTimeout(() => {
      if (currentIdx + 1 < questionSet.length) {
        setCurrentIdx((i) => i + 1);
        if (settings.tts) speak(questionSet[currentIdx + 1].q);
        if (settings.stt) recog.start();
        setTimeLeft(settings.perQuestionSeconds);
      } else {
        setPhase("review");
      }
    }, 600);
  };

  const handleChangeAnswer = (v) => {
    const next = [...answers];
    next[currentIdx] = { ...(next[currentIdx] || {}), text: v };
    setAnswers(next);
  };

  const exportSummary = () => {
    const rows = questionSet.map((q, i) => ({
      question: q.q,
      your_answer: (answers[i]?.text || "").replace(/\n/g, " "),
      score: answers[i]?.score ?? 0,
      suggested: q.a
    }));
    const header = Object.keys(rows[0] || { question: "question", your_answer: "your_answer", score: "score", suggested: "suggested" });
    const csv = [header.join(","), ...rows.map(r => header.map(h => '"' + String(r[h] ?? '').replace(/"/g, '""') + '"').join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mock_interview_summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalScore = useMemo(() => {
    const vals = answers.map((a) => a?.score ?? 0);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  }, [answers]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">AI Mock Interview</h1>
          <div className="text-sm text-gray-600">Java • Spring Boot • System Design</div>
        </header>

        {phase === "setup" && (
          <div className="grid gap-6">
            <section className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold text-lg mb-3">Topics</h2>
              <div className="flex flex-wrap gap-2">
                {Object.keys(QUESTION_BANK).map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setSelectedTopics((prev) =>
                        prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                      )
                    }
                    className={`px-4 py-2 rounded-full border ${
                      selectedTopics.includes(t)
                        ? "bg-black text-white border-black"
                        : "bg-white hover:bg-gray-100"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold text-lg mb-3">Settings</h2>
              <div className="grid sm:grid-cols-3 gap-4 items-end">
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Questions</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={settings.totalQuestions}
                    onChange={(e) => setSettings((s) => ({ ...s, totalQuestions: Number(e.target.value) }))}
                    className="border rounded-lg px-3 py-2"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm text-gray-600">Seconds / Question</span>
                  <input
                    type="number"
                    min={30}
                    max={300}
                    value={settings.perQuestionSeconds}
                    onChange={(e) => setSettings((s) => ({ ...s, perQuestionSeconds: Number(e.target.value) }))}
                    className="border rounded-lg px-3 py-2"
                  />
                </label>
                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.tts}
                      onChange={(e) => setSettings((s) => ({ ...s, tts: e.target.checked }))}
                    />
                    <span className="text-sm">Read questions aloud (TTS)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.stt}
                      onChange={(e) => setSettings((s) => ({ ...s, stt: e.target.checked }))}
                    />
                    <span className="text-sm">Speech-to-text (STT)</span>
                  </label>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                onClick={startInterview}
                className="px-5 py-3 rounded-2xl bg-black text-white shadow hover:opacity-90"
              >
                Start Interview
              </button>
            </div>
          </div>
        )}

        {phase === "running" && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Question {currentIdx + 1} / {questionSet.length}</div>
              <div className={`text-lg font-semibold ${timeLeft <= 10 ? "text-red-600" : ""}`}>
                ⏱ {timeLeft}s
              </div>
            </div>

            <section className="bg-white rounded-2xl shadow p-5">
              <h2 className="text-lg font-semibold mb-2">{questionSet[currentIdx]?.q}</h2>
              <textarea
                value={settings.stt ? recog.transcript || answers[currentIdx]?.text || "" : answers[currentIdx]?.text || ""}
                onChange={(e) => handleChangeAnswer(e.target.value)}
                placeholder="Speak or type your answer here..."
                className="w-full min-h-[160px] border rounded-xl p-3 focus:outline-none"
              />
              {settings.stt && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => (recog.listening ? recog.stop() : recog.start())}
                    className={`px-4 py-2 rounded-xl border ${recog.listening ? "bg-green-600 text-white border-green-600" : "bg-white"}`}
                  >
                    {recog.listening ? "Listening…" : "Start mic"}
                  </button>
                  <div className="text-xs text-gray-600">Web Speech API (Chrome recommended)</div>
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setPhase("review")} className="px-4 py-2 rounded-xl border">End Early</button>
                <button onClick={handleSubmitAnswer} className="px-4 py-2 rounded-xl bg-black text-white">Submit & Next</button>
              </div>
            </section>

            {/* Immediate feedback after submission (for the previously answered question) */}
            {answers[currentIdx]?.text && (
              <section className="bg-white rounded-2xl shadow p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold">Quick Feedback</div>
                  <div className="text-sm">Score: <span className="font-semibold">{answers[currentIdx]?.score ?? 0}%</span></div>
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  {(() => {
                    const s = answers[currentIdx]?.score ?? 0;
                    if (s >= 80) return "Strong, concise answer. Consider adding a brief example for extra polish.";
                    if (s >= 55) return "Decent coverage. Add missing keywords and structure with: definition → why → example.";
                    return "Too light. Hit the core points and define terms clearly. Use bullets to organize.";
                  })()}
                </div>
                <div className="mt-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Suggested Answer</div>
                  <div className="p-3 rounded-xl bg-gray-50 text-sm">{questionSet[currentIdx]?.a}</div>
                </div>
                <div className="mt-3 text-xs text-gray-600">Tip: {questionSet[currentIdx]?.tips}</div>
              </section>
            )}
          </div>
        )}

        {phase === "review" && (
          <div className="grid gap-6">
            <section className="bg-white rounded-2xl shadow p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Session Summary</h2>
                <div className="text-sm">Overall Score: <span className="font-bold">{totalScore}%</span></div>
              </div>
              <div className="mt-4 grid gap-4">
                {questionSet.map((q, i) => (
                  <div key={i} className="border rounded-xl p-3">
                    <div className="font-medium">Q{i + 1}. {q.q}</div>
                    <div className="mt-2 text-sm"><span className="font-semibold">Your answer:</span> {answers[i]?.text || <em className="text-gray-500">(no answer)</em>}</div>
                    <div className="mt-2 text-sm"><span className="font-semibold">Score:</span> {answers[i]?.score ?? 0}%</div>
                    <div className="mt-2 text-sm"><span className="font-semibold">Suggested:</span> {q.a}</div>
                    <div className="mt-1 text-xs text-gray-600">Tip: {q.tips}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-end">
                <button onClick={exportSummary} className="px-4 py-2 rounded-xl border">Export CSV</button>
                <button
                  onClick={() => { setPhase("setup"); setQuestionSet([]); setAnswers([]); stop(); }}
                  className="px-4 py-2 rounded-xl bg-black text-white"
                >
                  New Session
                </button>
              </div>
            </section>
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-gray-500">
          Practice ethically. No live cheating in interviews.
        </footer>
      </div>
    </div>
  );
}
