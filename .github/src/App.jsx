import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Volume2, Mic, Loader2, Check, X, RotateCcw, ArrowRight, ArrowLeft,
  Layers, MessageSquare, Home as HomeIcon, Send, Sparkles, Trash2,
  Target, ChevronDown, Settings, KeyRound, ExternalLink
} from "lucide-react";

/* ============================================================
   BRUG — پل زبان
   نسخهٔ مستقل (دسکتاپ/موبایل) — با Google Gemini API
   ============================================================ */

const C = {
  ink: "#0C2740", panel: "#153A5C", panel2: "#1E4B73", line: "#2B5C87",
  paper: "#F6F2E9", paper2: "#E9E3D5", geel: "#FFC917", klei: "#C9614A",
  gras: "#5FA37A", mist: "#9DB2C6", dim: "#6E8CA8",
};

const fa = { fontFamily: "'Vazirmatn', system-ui, sans-serif" };
const disp = { fontFamily: "'Bricolage Grotesque', sans-serif" };
const serif = { fontFamily: "'Newsreader', Georgia, serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

const LOKETTEN = {
  nl: [
    { n: "A-01", fa: "شهرداری — ثبت‌نام و BSN", q: "registering at the gemeente to get a BSN number" },
    { n: "A-02", fa: "مطب پزشک عمومی (huisarts)", q: "describing symptoms to a Dutch huisarts" },
    { n: "A-03", fa: "سوپرمارکت و صندوق", q: "shopping and paying at a Dutch supermarket, incl. bonuskaart" },
    { n: "A-04", fa: "اجارهٔ خانه و صاحبخانه", q: "viewing a rental apartment and negotiating with a landlord" },
    { n: "A-05", fa: "مصاحبهٔ شغلی", q: "a job interview in the Netherlands" },
    { n: "A-06", fa: "تعمیرگاه دوچرخه", q: "getting a bicycle repaired at a fietsenmaker" },
    { n: "A-07", fa: "گفت‌وگو با همسایه", q: "small talk with a Dutch neighbour in the stairwell" },
    { n: "A-08", fa: "بانک و افتتاح حساب", q: "opening a bank account in the Netherlands" },
    { n: "A-09", fa: "مدرسهٔ بچه‌ها و معلم", q: "a parent-teacher meeting at a Dutch primary school" },
    { n: "A-10", fa: "تماس تلفنی اداری", q: "making a formal phone call to a Dutch institution" },
    { n: "A-11", fa: "کافه و رستوران", q: "ordering food and drinks at a Dutch cafe" },
    { n: "A-12", fa: "گزارش دزدی به پلیس", q: "reporting a stolen bicycle at a Dutch police station" },
  ],
  en: [
    { n: "B-01", fa: "مصاحبهٔ شغلی", q: "a professional job interview in English" },
    { n: "B-02", fa: "فرودگاه و گمرک", q: "going through airport immigration and customs" },
    { n: "B-03", fa: "پذیرش هتل", q: "checking into a hotel and solving a room problem" },
    { n: "B-04", fa: "جلسهٔ کاری", q: "speaking up in a business meeting" },
    { n: "B-05", fa: "مطب دکتر", q: "describing symptoms to a doctor in English" },
    { n: "B-06", fa: "خرید و مرجوعی", q: "shopping and returning a faulty item" },
    { n: "B-07", fa: "دانشگاه و استاد", q: "talking to a university professor about an assignment" },
    { n: "B-08", fa: "تماس تلفنی رسمی", q: "a formal customer-service phone call" },
    { n: "B-09", fa: "معرفی خود در جمع", q: "introducing yourself at a networking event" },
    { n: "B-10", fa: "اجارهٔ خانه", q: "renting an apartment and talking to a landlord" },
  ],
};

const LANGNAME = { nl: "Dutch", en: "English" };
const LANGFA = { nl: "هلندی", en: "انگلیسی" };
const LOCALE = { nl: "nl-NL", en: "en-US" };
const LEVELS = ["A1", "A2", "B1", "B2"];
const GEMINI_MODEL = "gemini-2.0-flash";
const LS_KEY = "brug_state_v1";
const LS_APIKEY = "brug_gemini_key";

/* ---------- ابزارها ---------- */

function extractJSON(text) {
  let t = (text || "").trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

async function askGemini(prompt, apiKey) {
  if (!apiKey) throw new Error("NO_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1400 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GEMINI_${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("\n");
}

function norm(s) {
  return (s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

function similarity(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return Math.max(0, Math.round((1 - d[m][n] / Math.max(m, n)) * 100));
}

const DAY = 86400000;

function schedule(card, grade) {
  let { ease = 2.5, interval = 0, reps = 0, lapses = 0 } = card;
  if (grade === 0) { lapses++; reps = 0; ease = Math.max(1.3, ease - 0.2); interval = 0; }
  else if (grade === 1) { reps++; ease = Math.max(1.3, ease - 0.15); interval = interval ? interval * 1.2 : 0.5; }
  else if (grade === 2) { reps++; interval = interval ? interval * ease : 1; }
  else { reps++; ease = Math.min(3.2, ease + 0.15); interval = interval ? interval * ease * 1.3 : 2.5; }
  return { ...card, ease, interval, reps, lapses, due: Date.now() + Math.max(interval, 0.007) * DAY };
}

function useVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices() || []);
    load();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
  }, []);
  return voices;
}

function speak(text, lang, voices) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LOCALE[lang];
  const v = voices.find((x) => x.lang?.replace("_", "-").startsWith(LOCALE[lang])) ||
    voices.find((x) => x.lang?.startsWith(lang));
  if (v) u.voice = v;
  u.rate = 0.88;
  window.speechSynthesis.speak(u);
}

/* ---------- اجزای مشترک ---------- */

function Ticket({ children, style }) {
  const notch = `radial-gradient(circle at 8px 0, transparent 0 6px, ${C.paper} 6px)`;
  return (
    <div style={{ background: C.paper, backgroundImage: notch, backgroundSize: "16px 100%", backgroundRepeat: "repeat-x", borderRadius: 3, ...style }}>
      {children}
    </div>
  );
}

function SpeakBtn({ text, lang, voices, dark }) {
  return (
    <button onClick={() => speak(text, lang, voices)} aria-label="پخش صدا"
      className="shrink-0 rounded-full p-2 transition-opacity hover:opacity-60"
      style={{ background: dark ? C.panel2 : C.paper2, color: dark ? C.geel : C.ink }}>
      <Volume2 size={15} />
    </button>
  );
}

function Mirror({ target, lang }) {
  const [state, setState] = useState("idle");
  const [heard, setHeard] = useState("");
  const [score, setScore] = useState(null);
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = () => {
    if (!SR) { setState("unsupported"); return; }
    const r = new SR();
    r.lang = LOCALE[lang]; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results[0][0].transcript; setHeard(t); setScore(similarity(t, target)); setState("done"); };
    r.onerror = () => setState("error");
    r.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    setState("listening"); setHeard(""); setScore(null); r.start();
  };

  const color = score === null ? C.dim : score >= 80 ? C.gras : score >= 55 ? C.geel : C.klei;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={start} disabled={state === "listening"}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-opacity hover:opacity-75 disabled:opacity-100"
          style={{ ...fa, background: state === "listening" ? C.klei : C.paper2, color: state === "listening" ? C.paper : C.ink }}>
          <Mic size={13} />{state === "listening" ? "در حال شنیدن…" : "تلفظ من"}
        </button>
        {score !== null && <span style={{ ...mono, color, fontSize: 13, fontWeight: 700 }}>{score}٪</span>}
      </div>
      {state === "done" && (
        <p style={{ ...fa, color: C.dim, fontSize: 12 }} className="mt-1.5">
          شنیدم: <span dir="ltr" style={{ ...serif, color: C.ink }}>{heard || "—"}</span>
          {score >= 80 ? " ✓ عالی" : score >= 55 ? " — نزدیک بود، دوباره" : " — دوباره، آهسته‌تر"}
        </p>
      )}
      {state === "unsupported" && (
        <p style={{ ...fa, color: C.dim, fontSize: 12 }} className="mt-1.5">
          این دستگاه از تشخیص گفتار پشتیبانی نمی‌کند.
        </p>
      )}
    </div>
  );
}

/* ============================================================
   برنامهٔ اصلی
   ============================================================ */

export default function App() {
  const [lang, setLang] = useState("nl");
  const [level, setLevel] = useState("A1");
  const [view, setView] = useState("home");
  const [deck, setDeck] = useState({ nl: [], en: [] });
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [apiKey, setApiKey] = useState("");
  const voices = useVoices();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.deck) setDeck(s.deck);
        if (s.lang) setLang(s.lang);
        if (s.level) setLevel(s.level);
      }
      const k = localStorage.getItem(LS_APIKEY);
      if (k) setApiKey(k);
      else setView("settings");
    } catch (e) { /* اولین اجرا */ }
  }, []);

  const save = useCallback((nextDeck, nextLang, nextLevel) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        deck: nextDeck ?? deck, lang: nextLang ?? lang, level: nextLevel ?? level,
      }));
    } catch (e) { /* ذخیره ناموفق */ }
  }, [deck, lang, level]);

  useEffect(() => { save(); }, [lang, level]); // eslint-disable-line

  const saveKey = (k) => {
    setApiKey(k);
    try { localStorage.setItem(LS_APIKEY, k); } catch (e) {}
  };

  const addCards = (cards) => {
    const now = Date.now();
    const existing = new Set(deck[lang].map((c) => norm(c.front)));
    const fresh = cards.filter((c) => c.front && !existing.has(norm(c.front)))
      .map((c, i) => ({ ...c, id: `${now}_${i}`, due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0 }));
    if (!fresh.length) return 0;
    const next = { ...deck, [lang]: [...deck[lang], ...fresh] };
    setDeck(next); save(next);
    return fresh.length;
  };

  const dueCount = deck[lang].filter((c) => c.due <= Date.now()).length;

  const buildLesson = async (situationEn) => {
    if (!apiKey) { setView("settings"); return; }
    setLoading(true); setErr(""); setLesson(null); setView("lesson");
    const L = LANGNAME[lang];
    const place = lang === "nl" ? "the Netherlands" : "an English-speaking country";
    const prompt = `You are an expert ${L} teacher for Persian (Farsi) speakers who need survival language for real life.

Situation: "${situationEn}"
Target language: ${L}. CEFR level: ${level}.

Write a compact situational lesson. Return ONLY raw JSON, no markdown fences, no preamble:
{
"titleTarget":"short scene title in ${L}",
"sceneFa":"یک جملهٔ فارسی: کاربر کجاست و چه می‌خواهد",
"dialogue":[{"whoFa":"نقش گوینده به فارسی","t":"line in ${L}","fa":"ترجمهٔ روان فارسی"}],
"chunks":[{"t":"phrase in ${L}","fa":"معنی فارسی","use":"کی به کار می‌رود، کوتاه"}],
"grammar":{"pointFa":"نام نکته","explainFa":"توضیح کوتاه با مقایسهٔ صریح با فارسی","example":"مثال در ${L}"},
"cultureFa":"یک نکتهٔ فرهنگی واقعی و کاربردی دربارهٔ این موقعیت در ${place}",
"trapFa":"یک اشتباه رایج که فارسی‌زبانان در این موقعیت می‌کنند و چرا"
}
Rules: exactly 6 dialogue lines alternating between the user and the other person; exactly 5 chunks, chosen for reusability beyond this scene; vocabulary strictly at ${level}; all Persian short, concrete, no romanization.${lang === "nl" ? " For Dutch nouns in chunks, always include the article (de/het)." : ""}`;

    try {
      const raw = await askGemini(prompt, apiKey);
      setLesson(extractJSON(raw));
    } catch (e) {
      setErr(e.message === "NO_KEY" ? "کلید API تنظیم نشده." : "درس ساخته نشد. کلید API یا اتصال اینترنت را بررسی کنید.");
    }
    setLoading(false);
  };

  return (
    <div dir="rtl" style={{ ...fa, background: C.ink, minHeight: "100vh", color: C.paper }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${C.geel}; outline-offset: 2px; }
        input, textarea, select { font-family: 'Vazirmatn', sans-serif; }
        .rise { animation: rise .45s cubic-bezier(.2,.7,.3,1) both; }
        @keyframes rise { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:none;} }
        @media (prefers-reduced-motion: reduce) { .rise { animation: none; } }
      `}</style>

      <TopBar {...{ lang, setLang, level, setLevel, view, setView, deck }} />

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5">
        {view === "settings" && <SettingsView apiKey={apiKey} saveKey={saveKey} setView={setView} hasData={deck.nl.length + deck.en.length > 0} />}
        {view === "home" && <HomeView lang={lang} level={level} onPick={buildLesson} loading={loading} />}
        {view === "lesson" && <LessonView {...{ lesson, loading, err, lang, voices, addCards, setView }} />}
        {view === "talk" && <TalkView {...{ lang, level, voices, addCards, apiKey, setView }} />}
        {view === "review" && (
          <ReviewView deck={deck[lang]} lang={lang} voices={voices}
            onGrade={(id, g) => { const next = { ...deck, [lang]: deck[lang].map((c) => (c.id === id ? schedule(c, g) : c)) }; setDeck(next); save(next); }}
            onDelete={(id) => { const next = { ...deck, [lang]: deck[lang].filter((c) => c.id !== id) }; setDeck(next); save(next); }} />
        )}
        {view === "dehet" && <DeHetView level={level} voices={voices} addCards={addCards} lang={lang} apiKey={apiKey} setView={setView} />}
      </main>

      <BottomNav {...{ view, setView, lang, dueCount }} />
    </div>
  );
}

/* ---------- تنظیمات / کلید API ---------- */

function SettingsView({ apiKey, saveKey, setView, hasData }) {
  const [val, setVal] = useState(apiKey);
  return (
    <div className="rise">
      <div className="mb-5 flex items-center gap-2">
        <KeyRound size={18} style={{ color: C.geel }} />
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>کلید Gemini API</h1>
      </div>
      <p style={{ color: C.mist, fontSize: 13.5, lineHeight: 2 }} className="mb-4">
        این برنامه برای ساخت درس و مکالمه از Google Gemini استفاده می‌کند. کلید فقط روی همین دستگاه شما ذخیره می‌شود و به هیچ سروری فرستاده نمی‌شود.
      </p>
      <div className="rounded p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <input value={val} onChange={(e) => setVal(e.target.value)} type="password" dir="ltr"
          placeholder="AIzaSy..." className="w-full rounded px-3 py-2.5 text-sm"
          style={{ background: C.ink, color: C.paper, border: `1px solid ${C.line}`, ...mono }} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => { saveKey(val.trim()); setView("home"); }} disabled={!val.trim()}
            className="rounded px-4 py-2 text-sm disabled:opacity-40"
            style={{ background: C.geel, color: C.ink, fontWeight: 600 }}>ذخیره و شروع</button>
          {hasData && (
            <button onClick={() => setView("home")} className="rounded px-4 py-2 text-sm"
              style={{ background: "transparent", color: C.mist, border: `1px solid ${C.line}` }}>بازگشت</button>
          )}
        </div>
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
          className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: C.geel }}>
          <ExternalLink size={12} /> گرفتن کلید رایگان از Google AI Studio
        </a>
      </div>
      <p style={{ color: C.dim, fontSize: 11.5 }} className="mt-4 leading-6">
        سطح رایگان Gemini برای استفادهٔ روزانهٔ شخصی کافی است. اگر محدودیت خوردید، چند دقیقه صبر کنید یا فردا دوباره امتحان کنید.
      </p>
    </div>
  );
}

/* ---------- نوار بالا ---------- */

function TopBar({ lang, setLang, level, setLevel, setView, deck }) {
  const total = deck[lang].length;
  const learned = deck[lang].filter((c) => c.reps > 0).length;
  return (
    <header style={{ borderBottom: `1px solid ${C.line}`, background: C.ink }} className="sticky top-0 z-20">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span style={{ ...disp, color: C.geel, fontWeight: 800, fontSize: 21, letterSpacing: "-0.02em" }}>BRUG</span>
          <span style={{ color: C.dim, fontSize: 12 }}>پل زبان</span>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <div className="flex rounded-full p-0.5" style={{ background: C.panel }}>
            {["nl", "en"].map((l) => (
              <button key={l} onClick={() => setLang(l)} className="rounded-full px-3 py-1 text-xs transition-colors"
                style={{ background: lang === l ? C.geel : "transparent", color: lang === l ? C.ink : C.mist, fontWeight: lang === l ? 600 : 400 }}>
                {LANGFA[l]}
              </button>
            ))}
          </div>
          <div className="relative">
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="appearance-none rounded-full py-1 pr-3 pl-7 text-xs"
              style={{ background: C.panel, color: C.paper, border: `1px solid ${C.line}` }}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <ChevronDown size={12} style={{ color: C.mist }} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
          </div>
          <button onClick={() => setView("settings")} className="rounded-full p-1.5" style={{ background: C.panel }} aria-label="تنظیمات">
            <Settings size={14} style={{ color: C.mist }} />
          </button>
        </div>
      </div>
      {total > 0 && (
        <div className="mx-auto max-w-3xl px-4 pb-2">
          <div className="flex items-center gap-2" style={{ fontSize: 11, color: C.dim }}>
            <span style={mono}>{learned}/{total}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: C.panel }}>
              <div className="h-full" style={{ width: `${total ? (learned / total) * 100 : 0}%`, background: C.geel }} />
            </div>
            <span>کارت آموخته</span>
          </div>
        </div>
      )}
    </header>
  );
}

/* ---------- صفحهٔ خانه ---------- */

function HomeView({ lang, level, onPick, loading }) {
  const [custom, setCustom] = useState("");
  const list = LOKETTEN[lang];
  return (
    <div className="rise">
      <div className="mb-5">
        <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.5 }}>امروز کجا می‌روی؟</h1>
        <p style={{ color: C.mist, fontSize: 14 }} className="mt-1">یک باجه انتخاب کن. زبانِ همان لحظه را می‌سازم.</p>
      </div>
      <div className="mb-6 rounded p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={15} style={{ color: C.geel }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>موقعیت خودت را بنویس</span>
        </div>
        <p style={{ color: C.mist, fontSize: 12.5 }} className="mb-3 leading-6">
          هر چیزی که این هفته با آن روبه‌رو می‌شوی.
        </p>
        <div className="flex gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) onPick(custom.trim()); }}
            placeholder="موقعیت واقعی‌ات را اینجا بنویس…" className="flex-1 rounded px-3 py-2.5 text-sm"
            style={{ background: C.ink, color: C.paper, border: `1px solid ${C.line}` }} />
          <button onClick={() => custom.trim() && onPick(custom.trim())} disabled={!custom.trim() || loading}
            className="rounded px-4 text-sm transition-opacity disabled:opacity-40" style={{ background: C.geel, color: C.ink, fontWeight: 600 }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : "بساز"}
          </button>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <span style={{ ...mono, fontSize: 11, color: C.dim, letterSpacing: "0.08em" }}>LOKETTEN</span>
        <div className="h-px flex-1" style={{ background: C.line }} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((s) => (
          <button key={s.n} onClick={() => onPick(s.q)} disabled={loading}
            className="group flex flex-col justify-between rounded p-3 text-right transition-colors disabled:opacity-50"
            style={{ background: C.panel, border: `1px solid ${C.line}`, minHeight: 92 }}>
            <span style={{ ...mono, fontSize: 10, color: C.geel, letterSpacing: "0.05em" }}>{s.n}</span>
            <span style={{ fontSize: 13, lineHeight: 1.6 }}>{s.fa}</span>
          </button>
        ))}
      </div>
      <p style={{ color: C.dim, fontSize: 11.5 }} className="mt-5 leading-6">
        سطح فعلی: <span style={mono}>{level}</span>
      </p>
    </div>
  );
}

/* ---------- درس ---------- */

function LessonView({ lesson, loading, err, lang, voices, addCards, setView }) {
  const [added, setAdded] = useState(0);
  useEffect(() => { setAdded(0); }, [lesson]);

  if (loading) return <Waiting />;
  if (err) return (
    <div className="rise rounded p-6 text-center" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <p style={{ color: C.klei, fontSize: 14 }}>{err}</p>
      <div className="mt-3 flex justify-center gap-2">
        <button onClick={() => setView("settings")} className="rounded px-4 py-2 text-sm" style={{ background: C.geel, color: C.ink, fontWeight: 600 }}>بررسی کلید API</button>
        <button onClick={() => setView("home")} className="rounded px-4 py-2 text-sm" style={{ background: C.panel2, color: C.paper }}>بازگشت</button>
      </div>
    </div>
  );
  if (!lesson) return null;

  const saveAll = () => {
    const cards = [
      ...(lesson.chunks || []).map((c) => ({ front: c.t, back: c.fa, hint: c.use, kind: "chunk" })),
      ...(lesson.dialogue || []).slice(0, 3).map((d) => ({ front: d.t, back: d.fa, hint: d.whoFa, kind: "line" })),
    ];
    setAdded(addCards(cards));
  };

  return (
    <div className="rise">
      <Ticket style={{ color: C.ink }}>
        <div className="px-5 pb-5 pt-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <span style={{ ...mono, fontSize: 10, color: C.klei, letterSpacing: "0.1em" }}>NU AAN DE BEURT</span>
              <h2 dir="ltr" style={{ ...disp, fontSize: 22, fontWeight: 800, lineHeight: 1.25, marginTop: 4 }}>{lesson.titleTarget}</h2>
            </div>
            <SpeakBtn text={lesson.titleTarget} lang={lang} voices={voices} />
          </div>
          <p style={{ color: "#4A5A68", fontSize: 13.5, lineHeight: 1.9 }}>{lesson.sceneFa}</p>
        </div>
        <div style={{ borderTop: `1px dashed ${C.paper2}` }} />
        <div className="px-5 py-5">
          <SectionLabel n="01" fa="گفت‌وگو" />
          <div className="space-y-4">
            {(lesson.dialogue || []).map((d, i) => (
              <div key={i} style={{ borderRight: `2px solid ${i % 2 ? C.paper2 : C.geel}`, paddingRight: 12 }}>
                <span style={{ fontSize: 11, color: "#7A8894" }}>{d.whoFa}</span>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <p dir="ltr" style={{ ...serif, fontSize: 17, lineHeight: 1.5, textAlign: "left", flex: 1 }}>{d.t}</p>
                  <SpeakBtn text={d.t} lang={lang} voices={voices} />
                </div>
                <p style={{ fontSize: 13, color: "#4A5A68", lineHeight: 1.9 }} className="mt-1">{d.fa}</p>
                {i % 2 === 0 && <Mirror target={d.t} lang={lang} />}
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: `1px dashed ${C.paper2}` }} />
        <div className="px-5 py-5">
          <SectionLabel n="02" fa="عبارت‌هایی که بارها به کارت می‌آیند" />
          <div className="space-y-3">
            {(lesson.chunks || []).map((c, i) => (
              <div key={i} className="rounded p-3" style={{ background: C.paper2 }}>
                <div className="flex items-start justify-between gap-2">
                  <p dir="ltr" style={{ ...serif, fontSize: 16, fontWeight: 500, textAlign: "left", flex: 1 }}>{c.t}</p>
                  <SpeakBtn text={c.t} lang={lang} voices={voices} />
                </div>
                <p style={{ fontSize: 13, marginTop: 4 }}>{c.fa}</p>
                <p style={{ fontSize: 11.5, color: "#7A8894", marginTop: 2 }}>{c.use}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: `1px dashed ${C.paper2}` }} />
        {lesson.grammar && (
          <div className="px-5 py-5">
            <SectionLabel n="03" fa="نکتهٔ ساختاری — در مقایسه با فارسی" />
            <h4 style={{ fontSize: 14, fontWeight: 600 }}>{lesson.grammar.pointFa}</h4>
            <p style={{ fontSize: 13.5, lineHeight: 2, color: "#4A5A68" }} className="mt-1.5">{lesson.grammar.explainFa}</p>
            {lesson.grammar.example && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded px-3 py-2" style={{ background: C.paper2 }}>
                <p dir="ltr" style={{ ...serif, fontSize: 15, textAlign: "left" }}>{lesson.grammar.example}</p>
                <SpeakBtn text={lesson.grammar.example} lang={lang} voices={voices} />
              </div>
            )}
          </div>
        )}
        <div style={{ borderTop: `1px dashed ${C.paper2}` }} />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          {lesson.cultureFa && (
            <div><SectionLabel n="04" fa="نکتهٔ فرهنگی" /><p style={{ fontSize: 13, lineHeight: 2, color: "#4A5A68" }}>{lesson.cultureFa}</p></div>
          )}
          {lesson.trapFa && (
            <div><SectionLabel n="05" fa="تلهٔ فارسی‌زبان‌ها" color={C.klei} /><p style={{ fontSize: 13, lineHeight: 2, color: "#4A5A68" }}>{lesson.trapFa}</p></div>
          )}
        </div>
      </Ticket>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={saveAll} disabled={added > 0}
          className="flex items-center gap-2 rounded px-4 py-2.5 text-sm transition-opacity disabled:opacity-60"
          style={{ background: added ? C.gras : C.geel, color: C.ink, fontWeight: 600 }}>
          {added ? <><Check size={15} /> {added} کارت اضافه شد</> : <><Layers size={15} /> بفرست به مرور</>}
        </button>
        <button onClick={() => setView("talk")} className="flex items-center gap-2 rounded px-4 py-2.5 text-sm" style={{ background: C.panel, color: C.paper, border: `1px solid ${C.line}` }}>
          <MessageSquare size={15} /> حالا خودت امتحان کن
        </button>
        <button onClick={() => setView("home")} className="flex items-center gap-2 rounded px-4 py-2.5 text-sm" style={{ background: "transparent", color: C.mist, border: `1px solid ${C.line}` }}>
          <ArrowRight size={15} /> باجهٔ دیگر
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ n, fa: t, color }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span style={{ ...mono, fontSize: 10, color: color || C.klei, letterSpacing: "0.08em" }}>{n}</span>
      <span style={{ fontSize: 11.5, color: "#7A8894", letterSpacing: "0.02em" }}>{t}</span>
      <div className="h-px flex-1" style={{ background: C.paper2 }} />
    </div>
  );
}

function Waiting() {
  const steps = ["گرفتن نوبت…", "پشت باجه…", "نوشتن برگه…"];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % steps.length), 1400); return () => clearInterval(t); }, []);
  return (
    <div className="rise flex flex-col items-center justify-center rounded py-16" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <Loader2 size={26} className="animate-spin" style={{ color: C.geel }} />
      <p style={{ color: C.mist, fontSize: 13 }} className="mt-3">{steps[i]}</p>
    </div>
  );
}

/* ---------- مکالمه ---------- */

function TalkView({ lang, level, voices, addCards, apiKey, setView }) {
  const [role, setRole] = useState("");
  const [started, setStarted] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const suggestions = lang === "nl"
    ? ["کارمند شهرداری", "پزشک عمومی", "صاحبخانه", "همسایه", "فروشندهٔ دوچرخه"]
    : ["مصاحبه‌کنندهٔ شغلی", "پذیرش هتل", "استاد دانشگاه", "افسر گمرک"];

  if (!apiKey) return (
    <Empty icon={<KeyRound size={22} style={{ color: C.dim }} />} title="کلید API لازم است"
      body="برای مکالمهٔ زنده اول کلید Gemini را در تنظیمات وارد کن." action={{ fa: "برو به تنظیمات", fn: () => setView("settings") }} />
  );

  const send = async (text) => {
    const userMsg = { role: "user", t: text };
    const history = [...msgs, userMsg];
    setMsgs(history); setInput(""); setBusy(true);
    const L = LANGNAME[lang];
    const transcript = history.map((m) => `${m.role === "user" ? "Learner" : "You"}: ${m.t}`).join("\n");
    const prompt = `You are role-playing in ${L} to help a Persian-speaking learner practise.
Your character: ${role}. Learner's CEFR level: ${level}.
Conversation so far:
${transcript}
Stay in character. Reply in ${L} at ${level} level, 1-2 sentences, natural. Keep the scene moving.
If the learner's last message has a mistake, correct it, else set "fix" to null.
Return ONLY raw JSON, no fences:
{"t":"your reply in ${L}","fa":"ترجمهٔ فارسی پاسخ تو","fix":null or {"wrong":"...","right":"...","whyFa":"..."},"hint":"a short ${L} phrase to reply with","hintFa":"معنی فارسی"}`;
    try {
      const raw = await askGemini(prompt, apiKey);
      setMsgs((m) => [...m, { role: "bot", ...extractJSON(raw) }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "bot", t: "…", fa: "پاسخ دریافت نشد. دوباره بفرست.", fix: null }]);
    }
    setBusy(false);
  };

  const begin = async (r) => {
    setRole(r); setStarted(true); setBusy(true); setMsgs([]);
    const L = LANGNAME[lang];
    const prompt = `You are role-playing in ${L} for a Persian-speaking learner at CEFR ${level}.
Your character: ${r}. Open the scene naturally with the first thing this character would say (1 sentence, ${level} level).
Return ONLY raw JSON, no fences:
{"t":"opening line in ${L}","fa":"ترجمهٔ فارسی","fix":null,"hint":"a short ${L} phrase to reply with","hintFa":"معنی فارسی"}`;
    try {
      const raw = await askGemini(prompt, apiKey);
      setMsgs([{ role: "bot", ...extractJSON(raw) }]);
    } catch (e) { setMsgs([{ role: "bot", t: "Hallo!", fa: "سلام!", fix: null }]); }
    setBusy(false);
  };

  if (!started) return (
    <div className="rise">
      <h2 style={{ fontSize: 21, fontWeight: 700 }}>با چه کسی تمرین کنیم؟</h2>
      <p style={{ color: C.mist, fontSize: 13.5, lineHeight: 1.9 }} className="mt-1.5">من نقش را بازی می‌کنم و به {LANGFA[lang]} جواب می‌دهم.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button key={s} onClick={() => begin(s)} className="rounded-full px-3.5 py-2 text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.paper }}>{s}</button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input value={role} onChange={(e) => setRole(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && role.trim()) begin(role.trim()); }}
          placeholder="یا نقش دلخواه بنویس…" className="flex-1 rounded px-3 py-2.5 text-sm" style={{ background: C.panel, color: C.paper, border: `1px solid ${C.line}` }} />
        <button onClick={() => role.trim() && begin(role.trim())} disabled={!role.trim()} className="rounded px-4 text-sm disabled:opacity-40" style={{ background: C.geel, color: C.ink, fontWeight: 600 }}>شروع</button>
      </div>
    </div>
  );

  const lastHint = [...msgs].reverse().find((m) => m.role === "bot" && m.hint);

  return (
    <div className="rise">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><span style={{ ...mono, fontSize: 10, color: C.geel }}>LOKET</span><span style={{ fontSize: 14, fontWeight: 600 }}>{role}</span></div>
        <button onClick={() => { setStarted(false); setMsgs([]); setRole(""); }} className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs" style={{ color: C.mist, border: `1px solid ${C.line}` }}>
          <RotateCcw size={12} /> نقش دیگر
        </button>
      </div>
      <div className="space-y-3">
        {msgs.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-start">
            <div className="max-w-[85%] rounded px-3.5 py-2.5" style={{ background: C.panel2 }}>
              <p dir="ltr" style={{ ...serif, fontSize: 15.5, textAlign: "left" }}>{m.t}</p>
            </div>
          </div>
        ) : (
          <div key={i} className="flex justify-end">
            <div className="max-w-[90%]">
              <Ticket style={{ color: C.ink, padding: "12px 14px 14px" }}>
                <div className="flex items-start justify-between gap-2">
                  <p dir="ltr" style={{ ...serif, fontSize: 16, textAlign: "left", flex: 1, lineHeight: 1.5 }}>{m.t}</p>
                  <SpeakBtn text={m.t} lang={lang} voices={voices} />
                </div>
                <p style={{ fontSize: 12.5, color: "#7A8894" }} className="mt-1">{m.fa}</p>
              </Ticket>
              {m.fix && (
                <div className="mt-1.5 rounded px-3 py-2.5" style={{ background: "rgba(201,97,74,0.14)", border: `1px solid ${C.klei}` }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span dir="ltr" style={{ ...serif, fontSize: 13.5, color: C.mist, textDecoration: "line-through" }}>{m.fix.wrong}</span>
                    <ArrowLeft size={12} style={{ color: C.klei }} />
                    <span dir="ltr" style={{ ...serif, fontSize: 14.5, color: C.geel, fontWeight: 500 }}>{m.fix.right}</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.mist, lineHeight: 1.8 }} className="mt-1">{m.fix.whyFa}</p>
                  <button onClick={() => addCards([{ front: m.fix.right, back: m.fix.whyFa, hint: "اصلاح مکالمه", kind: "fix" }])} className="mt-1.5 text-xs underline" style={{ color: C.geel }}>این را به مرور اضافه کن</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-end"><div className="rounded px-3 py-2" style={{ background: C.panel }}><Loader2 size={15} className="animate-spin" style={{ color: C.geel }} /></div></div>}
        <div ref={endRef} />
      </div>
      {lastHint && !busy && (
        <button onClick={() => setInput(lastHint.hint)} className="mt-3 w-full rounded px-3 py-2 text-right" style={{ background: C.panel, border: `1px dashed ${C.line}` }}>
          <span style={{ fontSize: 11, color: C.dim }}>گیر کردی؟ بگو:</span>
          <span dir="ltr" style={{ ...serif, fontSize: 14, color: C.geel }} className="block text-left">{lastHint.hint}</span>
          <span style={{ fontSize: 11.5, color: C.mist }}>{lastHint.hintFa}</span>
        </button>
      )}
      <div className="sticky bottom-20 mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} dir="ltr"
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim() && !busy) send(input.trim()); }}
          placeholder={lang === "nl" ? "Typ in het Nederlands…" : "Type in English…"}
          style={{ ...serif, background: C.panel, color: C.paper, border: `1px solid ${C.line}`, textAlign: "left" }}
          className="flex-1 rounded px-3 py-2.5 text-[15px]" />
        <button onClick={() => input.trim() && send(input.trim())} disabled={!input.trim() || busy} className="rounded px-4 disabled:opacity-40" style={{ background: C.geel, color: C.ink }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

/* ---------- مرور ---------- */

function ReviewView({ deck, lang, voices, onGrade, onDelete }) {
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const due = deck.filter((c) => c.due <= Date.now()).sort((a, b) => a.due - b.due);
  const card = due[0];
  useEffect(() => { setFlipped(false); }, [card?.id]);

  if (!deck.length) return <Empty icon={<Layers size={22} style={{ color: C.dim }} />} title="هنوز کارتی نداری" body="یک درس موقعیتی بساز و «بفرست به مرور» را بزن." />;

  if (!card) {
    const next = deck.sort((a, b) => a.due - b.due)[0];
    const hours = Math.max(1, Math.round((next.due - Date.now()) / 3600000));
    return <Empty icon={<Check size={22} style={{ color: C.gras }} />} title={done ? `${done} کارت مرور شد` : "همه‌چیز به‌روز است"} body={`کارت بعدی حدود ${hours} ساعت دیگر برمی‌گردد.`} />;
  }

  const grades = [{ g: 0, fa: "دوباره", c: C.klei }, { g: 1, fa: "سخت", c: C.dim }, { g: 2, fa: "خوب", c: C.gras }, { g: 3, fa: "آسان", c: C.geel }];

  return (
    <div className="rise">
      <div className="mb-3 flex items-center justify-between" style={{ fontSize: 12, color: C.dim }}>
        <span style={mono}>{due.length} کارت در نوبت</span>
        <button onClick={() => onDelete(card.id)} className="flex items-center gap-1 hover:opacity-70"><Trash2 size={12} /> حذف این کارت</button>
      </div>
      <Ticket style={{ color: C.ink, minHeight: 240 }}>
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <span style={{ ...mono, fontSize: 10, color: C.klei, letterSpacing: "0.1em" }}>{card.kind === "fix" ? "CORRECTIE" : card.kind === "line" ? "ZIN" : "UITDRUKKING"}</span>
          <div className="mt-3 flex items-center gap-2">
            <p dir="ltr" style={{ ...serif, fontSize: 24, lineHeight: 1.4 }}>{card.front}</p>
            <SpeakBtn text={card.front} lang={lang} voices={voices} />
          </div>
          {flipped ? (
            <div className="mt-5 w-full rise">
              <div className="mx-auto mb-3 h-px w-16" style={{ background: C.paper2 }} />
              <p style={{ ...fa, fontSize: 16, lineHeight: 1.9 }}>{card.back}</p>
              {card.hint && <p style={{ ...fa, fontSize: 12, color: "#7A8894" }} className="mt-1.5">{card.hint}</p>}
              <div className="mt-4"><Mirror target={card.front} lang={lang} /></div>
            </div>
          ) : (
            <button onClick={() => setFlipped(true)} className="mt-6 rounded-full px-5 py-2 text-sm" style={{ ...fa, background: C.ink, color: C.paper }}>معنی را نشانم بده</button>
          )}
        </div>
      </Ticket>
      {flipped && (
        <div className="mt-3 grid grid-cols-4 gap-2 rise">
          {grades.map((x) => (
            <button key={x.g} onClick={() => { onGrade(card.id, x.g); setDone((d) => d + 1); }} className="rounded py-3 text-sm transition-opacity hover:opacity-80" style={{ background: C.panel, border: `1px solid ${x.c}`, color: x.c, fontWeight: 600 }}>{x.fa}</button>
          ))}
        </div>
      )}
      <p style={{ color: C.dim, fontSize: 11.5 }} className="mt-3 text-center leading-6">صادق باش. «دوباره» زدن ضعف نیست.</p>
    </div>
  );
}

/* ---------- de/het ---------- */

function DeHetView({ level, voices, addCards, lang, apiKey, setView }) {
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState({ ok: 0, no: 0 });

  if (lang !== "nl") return <Empty icon={<Target size={22} style={{ color: C.dim }} />} title="این تمرین فقط برای هلندی است" body="برای انگلیسی از تمرین مکالمه استفاده کن." />;
  if (!apiKey) return <Empty icon={<KeyRound size={22} style={{ color: C.dim }} />} title="کلید API لازم است" body="اول کلید Gemini را در تنظیمات وارد کن." action={{ fa: "برو به تنظیمات", fn: () => setView("settings") }} />;

  const load = async () => {
    setBusy(true); setItems([]); setI(0); setPicked(null); setScore({ ok: 0, no: 0 });
    const prompt = `Give 8 common Dutch nouns at CEFR ${level} level for a newcomer to the Netherlands. Mix de-words and het-words.
Return ONLY raw JSON, no fences:
{"items":[{"w":"noun without article","a":"de or het","fa":"معنی فارسی","hookFa":"یک قاعده یا حافظه‌یار کوتاه فارسی"}]}`;
    try { const r = extractJSON(await askGemini(prompt, apiKey)); setItems(r.items || []); } catch (e) {}
    setBusy(false);
  };

  useEffect(() => { load(); }, [level]); // eslint-disable-line

  if (busy) return <Waiting />;
  if (!items.length) return <Empty icon={<Target size={22} style={{ color: C.dim }} />} title="واژه‌ها بارگذاری نشد" body="اینترنت یا کلید API را بررسی کن." action={{ fa: "دوباره", fn: load }} />;

  const it = items[i];
  const finished = i >= items.length;
  if (finished) return <Empty icon={<Check size={22} style={{ color: C.gras }} />} title={`${score.ok} از ${items.length} درست`} body="حرف تعریف اسم‌های هلندی باید همراه خود اسم حفظ شود." action={{ fa: "هشت واژهٔ تازه", fn: load }} />;

  const answer = (a) => { setPicked(a); setScore((s) => (a === it.a ? { ...s, ok: s.ok + 1 } : { ...s, no: s.no + 1 })); };

  return (
    <div className="rise">
      <div className="mb-4 flex items-center justify-between"><span style={{ ...mono, fontSize: 11, color: C.dim }}>{i + 1} / {items.length}</span><span style={{ fontSize: 12, color: C.dim }}>سخت‌ترین بخش هلندی</span></div>
      <Ticket style={{ color: C.ink }}>
        <div className="px-6 py-10 text-center">
          <div className="flex items-center justify-center gap-2">
            <p dir="ltr" style={{ ...serif, fontSize: 30 }}>{picked && <span style={{ color: C.klei, fontWeight: 500 }}>{it.a} </span>}{it.w}</p>
            <SpeakBtn text={`${it.a} ${it.w}`} lang="nl" voices={voices} />
          </div>
          <p style={{ ...fa, fontSize: 14, color: "#7A8894" }} className="mt-2">{it.fa}</p>
          {!picked ? (
            <div className="mt-7 flex justify-center gap-3">
              {["de", "het"].map((a) => (
                <button key={a} onClick={() => answer(a)} className="rounded px-9 py-3 transition-opacity hover:opacity-80" style={{ ...serif, fontSize: 20, background: C.ink, color: C.paper }}>{a}</button>
              ))}
            </div>
          ) : (
            <div className="mt-6 rise">
              <div className="flex items-center justify-center gap-2">
                {picked === it.a ? <><Check size={17} style={{ color: C.gras }} /><span style={{ ...fa, color: C.gras, fontWeight: 600 }}>درست</span></> : <><X size={17} style={{ color: C.klei }} /><span style={{ ...fa, color: C.klei, fontWeight: 600 }}>{it.a} درست بود</span></>}
              </div>
              <p style={{ ...fa, fontSize: 13, lineHeight: 2, color: "#4A5A68" }} className="mx-auto mt-3 max-w-md">{it.hookFa}</p>
              <div className="mt-5 flex justify-center gap-2">
                <button onClick={() => { addCards([{ front: `${it.a} ${it.w}`, back: it.fa, hint: it.hookFa, kind: "chunk" }]); setPicked(null); setI(i + 1); }} className="rounded px-4 py-2 text-sm" style={{ ...fa, background: C.geel, color: C.ink, fontWeight: 600 }}>ذخیره و بعدی</button>
                <button onClick={() => { setPicked(null); setI(i + 1); }} className="rounded px-4 py-2 text-sm" style={{ ...fa, background: C.paper2, color: C.ink }}>فقط بعدی</button>
              </div>
            </div>
          )}
        </div>
      </Ticket>
    </div>
  );
}

function Empty({ icon, title, body, action }) {
  return (
    <div className="rise flex flex-col items-center rounded px-6 py-14 text-center" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      {icon}
      <h3 style={{ fontSize: 16, fontWeight: 600 }} className="mt-3">{title}</h3>
      <p style={{ color: C.mist, fontSize: 13, lineHeight: 2 }} className="mt-2 max-w-sm">{body}</p>
      {action && <button onClick={action.fn} className="mt-4 rounded px-4 py-2 text-sm" style={{ background: C.geel, color: C.ink, fontWeight: 600 }}>{action.fa}</button>}
    </div>
  );
}

function BottomNav({ view, setView, lang, dueCount }) {
  const tabs = [
    { k: "home", fa: "باجه‌ها", icon: HomeIcon },
    { k: "talk", fa: "مکالمه", icon: MessageSquare },
    { k: "review", fa: "مرور", icon: Layers, badge: dueCount },
    { k: "dehet", fa: lang === "nl" ? "de / het" : "de/het", icon: Target, off: lang !== "nl" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20" style={{ background: C.ink, borderTop: `1px solid ${C.line}` }}>
      <div className="mx-auto flex max-w-3xl">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = view === t.k || (view === "lesson" && t.k === "home");
          return (
            <button key={t.k} onClick={() => setView(t.k)} className="relative flex flex-1 flex-col items-center gap-1 py-3 transition-opacity" style={{ color: on ? C.geel : C.dim, opacity: t.off ? 0.4 : 1 }}>
              <Icon size={17} />
              <span style={{ fontSize: 10.5 }}>{t.fa}</span>
              {t.badge > 0 && <span style={{ ...mono, background: C.klei, color: C.paper, fontSize: 9 }} className="absolute right-1/2 top-1.5 translate-x-6 rounded-full px-1.5 py-0.5">{t.badge}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
