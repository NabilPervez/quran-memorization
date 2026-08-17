// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  BookOpen, Check, X, Eye, Trophy, 
  RotateCcw, Play, Loader2, BookType, Globe,
  BarChart2, PieChart, TrendingUp, Target, Activity, Flame, Award, AlertCircle,
  Settings, Moon, Sun, Download, Upload, Trash2, FileJson, ArrowRight,
  Calendar, Clock, Layers, Star, Minus, Pause, Volume2, CheckCircle, Smartphone, VolumeX
} from 'lucide-react';

const API_BASE_URL = 'https://api.alquran.cloud/v1';
const EDITIONS = 'ar.alafasy,quran-uthmani,en.transliteration,en.sahih';

const playTone = (freq, type, duration, vol = 0.1) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
};

const sfxEngine = {
  memorized: () => { playTone(600, 'sine', 0.1); setTimeout(() => playTone(800, 'sine', 0.15), 100); },
  somewhat: () => playTone(400, 'sine', 0.2),
  review: () => playTone(200, 'triangle', 0.3),
  reveal: () => playTone(300, 'sine', 0.1, 0.05),
  complete: () => { playTone(400, 'sine', 0.1); setTimeout(() => playTone(500, 'sine', 0.1), 100); setTimeout(() => playTone(600, 'sine', 0.2), 200); }
};

function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const metaTags = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'theme-color', content: '#0d9488' }
    ];
    metaTags.forEach(({ name, content }) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) { meta = document.createElement('meta'); meta.name = name; document.head.appendChild(meta); }
      meta.content = content;
    });

    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="512" height="512" style="background-color: #0d9488; padding: 4px; border-radius: 4px;"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
    const iconDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`;

    const manifest = {
      name: "Solo Hifz Partner", short_name: "Solo Hifz", description: "Minimalist Quran memorization app",
      start_url: ".", display: "standalone", background_color: "#ffffff", theme_color: "#0d9488",
      icons: [{ src: iconDataUri, sizes: "192x192 512x512", type: "image/svg+xml", purpose: "any maskable" }]
    };

    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    
    let linkManifest = document.querySelector('link[rel="manifest"]');
    if (!linkManifest) { linkManifest = document.createElement('link'); linkManifest.rel = 'manifest'; document.head.appendChild(linkManifest); }
    linkManifest.href = manifestUrl;

    const handleBeforeInstallPrompt = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => { window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt); URL.revokeObjectURL(manifestUrl); };
  }, []);

  const installPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => { if (choiceResult.outcome === 'accepted') setDeferredPrompt(null); });
    }
  };
  return { isInstallable: !!deferredPrompt, installPWA };
}

export default function App() {
  const { isInstallable, installPWA } = usePWA();
  
  const [activeTab, setActiveTab] = useState('practice');
  const [appState, setAppState] = useState('setup');
  const [surahs, setSurahs] = useState([]);
  const [error, setError] = useState(null);
  
  const [theme, setTheme] = useState(() => localStorage.getItem('sh_theme') || 'light');
  const [soundEnabled, setSoundEnabled] = useState(() => JSON.parse(localStorage.getItem('sh_sound')) ?? true);
  
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [startAyah, setStartAyah] = useState(1);
  const [endAyah, setEndAyah] = useState(7);
  
  const [sessionData, setSessionData] = useState([]);
  const [sessionResults, setSessionResults] = useState([]);
  const [streak, setStreak] = useState(0);

  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('sh_history')) || []);
  const [ayahStats, setAyahStats] = useState(() => JSON.parse(localStorage.getItem('sh_ayahStats')) || {});
  const [globalStreak, setGlobalStreak] = useState(() => JSON.parse(localStorage.getItem('sh_streak')) || { current: 0, longest: 0 });

  useEffect(() => { localStorage.setItem('sh_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('sh_sound', JSON.stringify(soundEnabled)); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('sh_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('sh_ayahStats', JSON.stringify(ayahStats)); }, [ayahStats]);
  useEffect(() => { localStorage.setItem('sh_streak', JSON.stringify(globalStreak)); }, [globalStreak]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/surah`)
      .then(res => res.json())
      .then(data => { if (data.code === 200) setSurahs(data.data); else throw new Error('Failed to fetch Surahs'); })
      .catch(err => { setError('Could not connect to API.'); console.error(err); });
  }, []);

  useEffect(() => {
    const surah = surahs.find(s => s.number === Number(selectedSurah));
    if (surah) {
      if (endAyah > surah.numberOfAyahs) setEndAyah(surah.numberOfAyahs);
      if (startAyah > surah.numberOfAyahs) setStartAyah(1);
    }
  }, [selectedSurah, surahs, startAyah, endAyah]);

  const playSound = useCallback((action) => {
    if (soundEnabled && sfxEngine[action]) sfxEngine[action]();
  }, [soundEnabled]);

  const handleStartSession = async () => {
    if (startAyah > endAyah) { setError("Start Ayah cannot be greater than End Ayah."); return; }
    setAppState('loading'); setError(null); setStreak(0); setSessionResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/surah/${selectedSurah}/editions/${EDITIONS}`);
      const data = await response.json();

      if (data.code === 200) {
        const audioEdition = data.data.find(d => d.edition.identifier === 'ar.alafasy');
        const textEdition = data.data.find(d => d.edition.identifier === 'quran-uthmani') || audioEdition;
        const transEdition = data.data.find(d => d.edition.identifier === 'en.transliteration') || { ayahs: [] };
        const translationEdition = data.data.find(d => d.edition.identifier === 'en.sahih') || { ayahs: [] };

        const mergedAyahs = audioEdition.ayahs.map((audioAyah, index) => ({
          numberInSurah: audioAyah.numberInSurah, audio: audioAyah.audio,
          text: textEdition.ayahs[index]?.text || '', transliteration: transEdition.ayahs[index]?.text || '',
          translation: translationEdition.ayahs[index]?.text || ''
        }));

        const filteredAyahs = mergedAyahs.filter(a => a.numberInSurah >= startAyah && a.numberInSurah <= endAyah);
        setSessionData({ surahNumber: selectedSurah, surahName: audioEdition.englishName, ayahs: filteredAyahs });
        setAppState('recitation');
      } else throw new Error('Failed to fetch recitation data');
    } catch (err) {
      setError('Error preparing session.'); setAppState('setup');
    }
  };

  const handleRecordAyahResult = (ayah, grade) => {
    playSound(grade);
    setSessionResults(prev => [...prev, { ayah, grade }]);
    setGlobalStreak(prev => {
      const newCurrent = grade === 'memorized' ? prev.current + 1 : 0;
      return { current: newCurrent, longest: Math.max(prev.longest, newCurrent) };
    });
  };

  const handleComplete = () => {
    playSound('complete');
    const memorizedCount = sessionResults.filter(r => r.grade === 'memorized').length;
    const somewhatCount = sessionResults.filter(r => r.grade === 'somewhat').length;
    const reviewCount = sessionResults.filter(r => r.grade === 'review').length;

    const newSession = {
      id: Date.now(), date: new Date().toISOString(),
      attempted: sessionData.ayahs.length, 
      memorized: memorizedCount, somewhat: somewhatCount, review: reviewCount,
      surah: sessionData.surahName
    };
    
    setHistory(prev => [...prev, newSession]);
    setAyahStats(prev => {
      const newStats = { ...prev };
      sessionResults.forEach(result => {
        const key = `${sessionData.surahNumber}:${result.ayah.numberInSurah}`;
        if (!newStats[key]) {
          newStats[key] = { 
            memorized: 0, somewhat: 0, review: 0, 
            text: result.ayah.text, surahName: sessionData.surahName,
            audio: result.ayah.audio, numberInSurah: result.ayah.numberInSurah,
            transliteration: result.ayah.transliteration, translation: result.ayah.translation,
            isReviewed: false
          };
        }
        newStats[key][result.grade] += 1;
        if (result.grade === 'somewhat' || result.grade === 'review') newStats[key].isReviewed = false;
      });
      return newStats;
    });
    setAppState('complete');
  };

  const handleMarkReviewed = (key) => {
    setAyahStats(prev => ({ ...prev, [key]: { ...prev[key], isReviewed: true } }));
  };

  const resetToSetup = () => { setAppState('setup'); setSessionData([]); setSessionResults([]); setStreak(0); };
  const handleRepeat = () => { handleStartSession(); };
  
  const goHome = () => { setActiveTab('practice'); resetToSetup(); };

  const handleClearData = () => { setHistory([]); setAyahStats({}); setGlobalStreak({ current: 0, longest: 0 }); };
  const handleImportData = (parsed) => {
    if (parsed.history) setHistory(parsed.history);
    if (parsed.ayahStats) setAyahStats(parsed.ayahStats);
    if (parsed.globalStreak) setGlobalStreak(parsed.globalStreak);
  };

  return (
    <div className={`min-h-[100dvh] w-full overflow-x-hidden font-sans selection:bg-teal-200 flex flex-col transition-colors duration-200 select-none ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <header className={`border-b px-4 md:px-8 py-4 sticky top-0 z-20 pt-[max(1rem,env(safe-area-inset-top))] transition-colors duration-200 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform" onClick={goHome}>
            <div className="bg-teal-600 p-2 rounded-lg shadow-sm shadow-teal-900/20"><BookOpen size={20} className="text-white" /></div>
            <h1 className="text-lg font-bold">Solo Hifz</h1>
          </div>
          {(appState === 'recitation' || appState === 'complete') && activeTab === 'practice' && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-semibold text-sm ${theme === 'dark' ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700'}`}>
              <Flame size={16} className={theme === 'dark' ? 'text-orange-400' : 'text-orange-500'} /><span>Streak: {streak}</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 py-4 pb-24 flex flex-col min-w-0">
        {activeTab === 'practice' && (
          <>
            {error && <div className={`p-4 rounded-xl mb-6 shadow-sm border ${theme === 'dark' ? 'bg-red-900/20 border-red-800/50 text-red-400' : 'bg-red-50 border-red-200 text-red-700'}`}>{error}</div>}
            {appState === 'setup' && <SetupScreen surahs={surahs} selectedSurah={selectedSurah} setSelectedSurah={setSelectedSurah} startAyah={startAyah} setStartAyah={setStartAyah} endAyah={endAyah} setEndAyah={setEndAyah} onStart={handleStartSession} theme={theme} />}
            {appState === 'loading' && <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-teal-600"><Loader2 size={48} className="animate-spin opacity-80" /><p className="font-medium animate-pulse">Preparing your session...</p></div>}
            {appState === 'recitation' && <RecitationScreen sessionData={sessionData} onComplete={handleComplete} streak={streak} setStreak={setStreak} onRecordResult={handleRecordAyahResult} globalAyahStats={ayahStats} theme={theme} playSound={playSound} />}
            {appState === 'complete' && <CompleteScreen streak={streak} totalAyahs={sessionData.ayahs.length} sessionResults={sessionResults} onReset={resetToSetup} onRepeat={handleRepeat} theme={theme} />}
          </>
        )}
        {activeTab === 'review' && <ReviewScreen ayahStats={ayahStats} onMarkReviewed={handleMarkReviewed} theme={theme} />}
        {activeTab === 'analytics' && <AnalyticsScreen history={history} ayahStats={ayahStats} globalStreak={globalStreak} theme={theme} />}
        {activeTab === 'settings' && <SettingsScreen theme={theme} setTheme={setTheme} soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} data={{ history, ayahStats, globalStreak }} onClearData={handleClearData} onImportData={handleImportData} isInstallable={isInstallable} installPWA={installPWA} />}
      </main>

      <div className={`fixed bottom-0 left-0 right-0 border-t z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-colors duration-200 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="w-full max-w-5xl mx-auto flex justify-around px-2 py-2">
          <NavButton icon={<BookOpen size={24} className="mb-1" />} label="Practice" isActive={activeTab === 'practice'} onClick={() => setActiveTab('practice')} theme={theme} />
          <NavButton icon={<AlertCircle size={24} className="mb-1" />} label="Review" isActive={activeTab === 'review'} onClick={() => setActiveTab('review')} theme={theme} />
          <NavButton icon={<BarChart2 size={24} className="mb-1" />} label="Analytics" isActive={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} theme={theme} />
          <NavButton icon={<Settings size={24} className="mb-1" />} label="Settings" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} theme={theme} />
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon, label, isActive, onClick, theme }) {
  const activeStyle = theme === 'dark' ? 'text-teal-400 bg-teal-900/30' : 'text-teal-600 bg-teal-50';
  const inactiveStyle = theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50';
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition-colors ${isActive ? activeStyle : inactiveStyle}`}>
      {icon} <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function SetupScreen({ surahs, selectedSurah, setSelectedSurah, startAyah, setStartAyah, endAyah, setEndAyah, onStart, theme }) {
  const currentSurahObj = surahs.find(s => s.number === Number(selectedSurah));
  const maxAyahs = currentSurahObj ? currentSurahObj.numberOfAyahs : 0;
  const cardBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
  const inputBg = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-100 focus:ring-teal-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-teal-500';

  return (
    <div className={`p-6 rounded-2xl shadow-sm border space-y-6 ${cardBg}`}>
      <div className="text-center mb-4"><h2 className="text-2xl font-bold">New Session</h2><p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Configure your memorization test</p></div>
      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Select Surah</label>
          <div className="relative">
            <select value={selectedSurah} onChange={(e) => setSelectedSurah(Number(e.target.value))} className={`w-full p-3.5 border rounded-xl appearance-none focus:outline-none focus:ring-2 font-medium ${inputBg}`} disabled={surahs.length === 0}>
              {surahs.length === 0 ? <option>Loading...</option> : surahs.map(surah => (<option key={surah.number} value={surah.number}>{surah.number}. {surah.englishName} ({surah.name})</option>))}
            </select>
            <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}><svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Start Ayah</label>
            <input type="number" min="1" max={maxAyahs} value={startAyah} onChange={(e) => setStartAyah(Math.max(1, Math.min(maxAyahs, Number(e.target.value))))} className={`w-full p-3.5 border rounded-xl focus:outline-none focus:ring-2 font-medium text-center ${inputBg}`} />
          </div>
          <div>
            <label className={`block text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>End Ayah</label>
            <input type="number" min="1" max={maxAyahs} value={endAyah} onChange={(e) => setEndAyah(Math.max(1, Math.min(maxAyahs, Number(e.target.value))))} className={`w-full p-3.5 border rounded-xl focus:outline-none focus:ring-2 font-medium text-center ${inputBg}`} />
          </div>
        </div>
      </div>
      <button onClick={onStart} disabled={surahs.length === 0} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
        <Play fill="currentColor" size={20} /> Start Recitation
      </button>
    </div>
  );
}

function RecitationScreen({ sessionData, onComplete, streak, setStreak, onRecordResult, globalAyahStats, theme, playSound }) {
  const [mode, setMode] = useState('START'); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioRef = useRef(null);
  
  const ayahs = sessionData.ayahs;
  const currentAyah = ayahs[currentIndex];

  useEffect(() => {
    const nextAyah = ayahs[currentIndex + 1];
    if (nextAyah) { const prefetch = new Audio(); prefetch.src = nextAyah.audio; prefetch.preload = 'auto'; }
  }, [currentIndex, ayahs]);

  const stopAudio = useCallback(() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } }, []);

  const playCurrentAyah = useCallback(() => {
    if (!currentAyah || mode !== 'REVEALED') return;
    stopAudio(); const audio = new Audio(currentAyah.audio); audioRef.current = audio;
    audio.play().catch(e => console.warn("Playback interrupted", e));
  }, [currentAyah, mode, stopAudio]);

  useEffect(() => { if (mode === 'REVEALED') playCurrentAyah(); return () => stopAudio(); }, [currentIndex, mode, playCurrentAyah, stopAudio]);

  useEffect(() => {
    const handleKeyDown = (e) => { 
      if ((e.code === 'Space' || e.code === 'Enter') && mode === 'GUESSING') { 
        e.preventDefault(); 
        playSound('reveal');
        setMode('REVEALED'); 
      } 
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, playSound]);

  const proceedToNextAyah = (grade) => {
    if (grade) onRecordResult(currentAyah, grade);
    stopAudio();
    if (currentIndex + 1 >= ayahs.length) setTimeout(onComplete, 100); 
    else { setCurrentIndex(prev => prev + 1); setMode('GUESSING'); }
  };

  const handleGrade = (grade) => {
    if (grade === 'memorized') setStreak(s => s + 1);
    else setStreak(0);
    proceedToNextAyah(grade);
  };

  const cardBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
  const headerBg = theme === 'dark' ? 'bg-slate-800/90 border-slate-700 text-slate-400' : 'bg-white/90 border-slate-100 text-slate-500';
  const divLine = theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100';

  const currentAyahKey = `${sessionData.surahNumber}:${currentAyah.numberInSurah}`;
  const hist = globalAyahStats[currentAyahKey] || { memorized: 0, somewhat: 0, review: 0 };

  return (
    <div className="flex flex-col flex-1 justify-between space-y-4" style={{minHeight: 'calc(100dvh - 140px)'}}>
      <div className={`flex-1 overflow-hidden rounded-2xl shadow-sm border flex flex-col relative ${cardBg}`}>
        <div className={`absolute top-0 left-0 right-0 backdrop-blur-sm border-b p-4 flex justify-between items-center text-xs font-semibold z-10 ${headerBg}`}>
          <span>{sessionData.surahName}</span><span>Ayah {currentAyah.numberInSurah}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-6 pt-16 flex flex-col justify-center">
          {mode === 'START' && (
            <div className="text-center space-y-6 m-auto animate-in fade-in zoom-in-95">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${theme === 'dark' ? 'bg-teal-900/30' : 'bg-teal-100'}`}><Play size={40} className="text-teal-600 ml-2" /></div>
              <div><h3 className="text-2xl font-bold">Ready to Begin?</h3><p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Prepare to recite Ayah <strong>{currentAyah.numberInSurah}</strong> from memory.</p></div>
              <button onClick={() => setMode('GUESSING')} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95 flex justify-center items-center gap-2 text-lg">
                Begin Recitation <ArrowRight size={20} />
              </button>
            </div>
          )}
          
          {mode === 'GUESSING' && (
            <div className="text-center space-y-6 m-auto animate-in fade-in zoom-in-95 w-full">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}><BookOpen size={32} className={theme === 'dark' ? 'text-slate-600' : 'text-slate-300'} /></div>
              <div><h3 className="text-xl font-bold">Recite from memory...</h3><p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>Ayah {currentAyah.numberInSurah} is currently hidden.</p></div>
              <div className={`mt-8 pt-6 border-t flex flex-col items-center gap-3 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Your History on this Ayah</span>
                <div className="flex justify-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> {hist.memorized}</div>
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div> {hist.somewhat}</div>
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div> {hist.review}</div>
                </div>
              </div>
            </div>
          )}
          
          {mode === 'REVEALED' && (
            <div className="w-full space-y-6 animate-in fade-in py-4 flex flex-col h-full justify-center select-text">
              <div dir="rtl" className="text-right font-arabic"><p className="text-3xl md:text-4xl leading-[2.2]">{currentAyah.text}</p></div>
              <div className={`h-px w-full ${divLine}`} />
              <div className="text-left space-y-1"><div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}><BookType size={14} /> Transliteration</div><p className={`text-lg italic leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{currentAyah.transliteration}</p></div>
              <div className="text-left space-y-1"><div className="flex items-center gap-1.5 text-xs font-bold text-teal-600 uppercase tracking-wider mb-1"><Globe size={14} /> Translation</div><p className={`text-base md:text-lg leading-relaxed ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{currentAyah.translation}</p></div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-4 min-h-[64px]">
        {mode === 'GUESSING' && (
          <button onClick={() => { playSound('reveal'); setMode('REVEALED'); }} className={`w-full font-bold py-5 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center gap-2 text-lg ${theme === 'dark' ? 'bg-slate-100 hover:bg-white text-slate-900' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}><Eye size={24} /> Reveal & Play</button>
        )}
        {mode === 'REVEALED' && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 animate-in slide-in-from-bottom-4 fade-in">
            <button onClick={() => handleGrade('review')} className={`font-bold py-3 sm:py-4 rounded-xl border flex flex-col items-center gap-1 transition-all active:scale-95 ${theme === 'dark' ? 'bg-rose-900/20 border-rose-800/50 hover:bg-rose-900/40 text-rose-400' : 'bg-rose-100 border-rose-200 hover:bg-rose-200 text-rose-700'}`}>
              <X size={20} /> <span className="text-xs sm:text-sm">Review</span>
            </button>
            <button onClick={() => handleGrade('somewhat')} className={`font-bold py-3 sm:py-4 rounded-xl border flex flex-col items-center gap-1 transition-all active:scale-95 ${theme === 'dark' ? 'bg-amber-900/20 border-amber-800/50 hover:bg-amber-900/40 text-amber-400' : 'bg-amber-100 border-amber-200 hover:bg-amber-200 text-amber-700'}`}>
              <Minus size={20} /> <span className="text-xs sm:text-sm">Somewhat</span>
            </button>
            <button onClick={() => handleGrade('memorized')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 sm:py-4 rounded-xl shadow-md flex flex-col items-center gap-1 transition-all active:scale-95">
              <Check size={20} /> <span className="text-xs sm:text-sm">Memorized</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CompleteScreen({ streak, totalAyahs, sessionResults, onReset, onRepeat, theme }) {
  const memorized = sessionResults.filter(r => r.grade === 'memorized').length;
  const somewhat = sessionResults.filter(r => r.grade === 'somewhat').length;
  const review = sessionResults.filter(r => r.grade === 'review').length;
  
  const accuracy = Math.round(((memorized + (somewhat * 0.5)) / totalAyahs) * 100) || 0;
  const cardBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
  const statBoxBg = theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100';

  return (
    <div className={`p-8 rounded-2xl shadow-sm border flex flex-col items-center text-center space-y-6 ${cardBg}`}>
      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-teal-500 mb-2 ${theme === 'dark' ? 'bg-teal-900/30' : 'bg-teal-100 text-teal-600'}`}><Trophy size={40} /></div>
      <div><h2 className="text-3xl font-bold mb-2">Session Complete!</h2><p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Alhamdulillah, you have finished your selected range.</p></div>
      
      <div className="w-full space-y-4 my-4">
        <div className={`rounded-xl p-4 border flex justify-between items-center ${statBoxBg}`}><span className={`font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>Weighted Accuracy</span><span className={`text-xl font-bold ${accuracy >= 80 ? 'text-emerald-500' : accuracy >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{accuracy}%</span></div>
        <div className="grid grid-cols-3 gap-2">
          <div className={`border rounded-xl p-3 flex flex-col items-center ${theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
            <p className="text-[10px] uppercase font-bold mb-1 opacity-80">Memorized</p><p className="text-xl font-bold">{memorized}</p>
          </div>
          <div className={`border rounded-xl p-3 flex flex-col items-center ${theme === 'dark' ? 'bg-amber-900/20 border-amber-800/50 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
            <p className="text-[10px] uppercase font-bold mb-1 opacity-80">Somewhat</p><p className="text-xl font-bold">{somewhat}</p>
          </div>
          <div className={`border rounded-xl p-3 flex flex-col items-center ${theme === 'dark' ? 'bg-rose-900/20 border-rose-800/50 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
            <p className="text-[10px] uppercase font-bold mb-1 opacity-80">Review</p><p className="text-xl font-bold">{review}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 w-full">
        <button onClick={onReset} className={`flex-1 py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}><RotateCcw size={20} /> Dashboard</button>
        <button onClick={onRepeat} className="flex-1 py-4 font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"><Play size={20} fill="currentColor" /> Repeat</button>
      </div>
    </div>
  );
}

function ReviewScreen({ ayahStats, onMarkReviewed, theme }) {
  const [playingKey, setPlayingKey] = useState(null);
  const audioRef = useRef(null);

  const reviewList = useMemo(() => {
    return Object.entries(ayahStats)
      .map(([key, data]) => ({ key, ...data }))
      .filter(a => (a.review > 0 || a.somewhat > 0) && !a.isReviewed)
      .map(a => {
        const weakness = (a.review * 2) + (a.somewhat * 1) - (a.memorized * 1.5);
        const total = a.memorized + a.somewhat + a.review;
        const accuracy = Math.round(((a.memorized + (a.somewhat * 0.5)) / total) * 100);
        return { ...a, weakness, accuracy };
      })
      .sort((a, b) => b.weakness - a.weakness);
  }, [ayahStats]);

  const handlePlay = (audioUrl, key) => {
    if (!audioUrl) return; 
    if (playingKey === key) {
      audioRef.current.pause();
      setPlayingKey(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play();
      setPlayingKey(key);
      audioRef.current.onended = () => setPlayingKey(null);
    }
  };

  useEffect(() => { return () => { if (audioRef.current) audioRef.current.pause(); } }, []);

  const cardBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
  const divLine = theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100';

  return (
    <div className="space-y-6 pb-6 animate-in fade-in">
      <div className={`p-5 rounded-2xl shadow-sm border ${cardBg}`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-100 text-rose-600'}`}><AlertCircle size={24} /></div>
          <div><h2 className="text-xl font-bold">Needs Review</h2><p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{reviewList.length} Ayahs pending your review</p></div>
        </div>
      </div>

      <div className="space-y-6">
        {reviewList.length === 0 ? (
          <div className={`p-8 rounded-2xl text-center border shadow-sm ${cardBg}`}>
            <CheckCircle size={40} className="mx-auto text-emerald-500 mb-3 opacity-50" />
            <p className="font-semibold text-lg">All clear!</p>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>You don't have any Ayahs marked for review right now.</p>
          </div>
        ) : (
          reviewList.map((ayah) => (
            <div key={ayah.key} className={`p-5 rounded-2xl border shadow-sm space-y-5 transition-all ${cardBg}`}>
              <div className="flex justify-between items-start">
                <div><h4 className="font-bold text-lg">{ayah.surahName}</h4><p className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Ayah {ayah.numberInSurah || ayah.key.split(':')[1]}</p></div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${ayah.accuracy < 50 ? (theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-100 text-rose-700') : (theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700')}`}>
                  {ayah.accuracy}% Accuracy
                </div>
              </div>

              <div className="space-y-4 select-text">
                <div dir="rtl" className="text-right font-arabic"><p className="text-2xl leading-[2.2]">{ayah.text}</p></div>
                {ayah.transliteration && (
                  <div className="text-left space-y-1"><div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}><BookType size={12} /> Transliteration</div><p className={`text-sm italic leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{ayah.transliteration}</p></div>
                )}
                {ayah.translation && (
                  <div className="text-left space-y-1"><div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-1"><Globe size={12} /> Translation</div><p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{ayah.translation}</p></div>
                )}
              </div>
              
              <div className={`flex flex-col sm:flex-row justify-between items-center pt-4 border-t gap-4 ${divLine}`}>
                 <div className="flex gap-3 text-xs font-semibold w-full sm:w-auto justify-center sm:justify-start">
                    <span className="text-rose-500">{ayah.review} Review</span>
                    <span className="text-amber-500">{ayah.somewhat} Somewhat</span>
                 </div>
                 <div className="flex gap-2 w-full sm:w-auto">
                   <button onClick={() => onMarkReviewed(ayah.key)} className={`flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                     <CheckCircle size={16} className="text-emerald-500" /> Mark Reviewed
                   </button>
                   <button onClick={() => handlePlay(ayah.audio, ayah.key)} disabled={!ayah.audio} className={`flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${playingKey === ayah.key ? 'bg-teal-600 text-white' : (theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-teal-400 disabled:opacity-50' : 'bg-slate-100 hover:bg-slate-200 text-teal-700 disabled:opacity-50')}`}>
                     {playingKey === ayah.key ? <Pause size={16} /> : <Volume2 size={16} />} {playingKey === ayah.key ? 'Stop' : 'Listen'}
                   </button>
                 </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AnalyticsScreen({ history, ayahStats, globalStreak, theme }) {
  const stats = useMemo(() => {
    let totalAyahsPracticed = 0, totalAyahsScore = 0;
    const surahAcc = {};
    
    const ayahArray = Object.entries(ayahStats).map(([key, data]) => {
      const total = data.memorized + data.somewhat + data.review;
      const score = data.memorized + (data.somewhat * 0.5);
      totalAyahsPracticed += total; totalAyahsScore += score;
      
      if (data.surahName) {
        if (!surahAcc[data.surahName]) surahAcc[data.surahName] = { attempted: 0, score: 0 };
        surahAcc[data.surahName].attempted += total;
        surahAcc[data.surahName].score += score;
      }
      
      return { key, ...data, total, accuracy: total > 0 ? Math.round((score / total) * 100) : 0 };
    }).filter(a => a.total > 0);

    const overallAccuracy = totalAyahsPracticed ? Math.round((totalAyahsScore / totalAyahsPracticed) * 100) : 0;
    const mastery = { mastered: 0, familiar: 0, learning: 0 };
    ayahArray.forEach(a => { if (a.accuracy >= 80) mastery.mastered++; else if (a.accuracy >= 50) mastery.familiar++; else mastery.learning++; });

    const activityByDay = [0, 0, 0, 0, 0, 0, 0];
    const timeOfDay = { morning: 0, afternoon: 0, evening: 0 };

    history.forEach(s => {
      const dateObj = new Date(s.date);
      if (!isNaN(dateObj.getTime())) {
        activityByDay[dateObj.getDay()] += s.attempted;
        const hour = dateObj.getHours();
        if (hour >= 5 && hour < 12) timeOfDay.morning += s.attempted;
        else if (hour >= 12 && hour < 17) timeOfDay.afternoon += s.attempted;
        else timeOfDay.evening += s.attempted;
      }
    });

    const surahAccuracyList = Object.entries(surahAcc).map(([name, data]) => ({
      name, accuracy: data.attempted ? Math.round((data.score / data.attempted) * 100) : 0, attempted: data.attempted
    })).sort((a,b) => b.accuracy - a.accuracy);

    const maxActivity = Math.max(...activityByDay, 1);
    
    return {
      totalAyahsPracticed, overallAccuracy, totalSessions: history.length, mastery, totalUniqueAyahs: ayahArray.length,
      activityByDay: activityByDay.map(val => ({ value: val, pct: Math.round((val/maxActivity)*100) })),
      surahAccuracyList, timeOfDay,
      barData: history.slice(-7).map((s, i) => ({ label: `S${i+1}`, accuracy: s.attempted ? Math.round(((s.memorized + (s.somewhat * 0.5)) / s.attempted) * 100) : 0 }))
    };
  }, [history, ayahStats]);

  const cardBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
  const chartBg = theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100';
  const textMuted = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="py-2 animate-in fade-in">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center gap-2 text-teal-100 mb-2"><Target size={18} /> <span className="text-sm font-semibold uppercase tracking-wider">Accuracy</span></div>
          <div className="text-4xl font-bold">{stats.overallAccuracy}%</div>
          <p className="text-xs text-teal-200 mt-1">Weighted lifetime avg</p>
        </div>
        <div className={`border rounded-2xl p-5 shadow-sm ${cardBg}`}>
          <div className={`flex items-center gap-2 mb-2 ${textMuted}`}><Activity size={18} /> <span className="text-sm font-semibold uppercase tracking-wider">Total Graded</span></div>
          <div className="text-4xl font-bold">{stats.totalAyahsPracticed}</div>
          <p className={`text-xs mt-1 ${textMuted}`}>Total Ayahs graded</p>
        </div>
      </div>

      {/* Streak row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { icon: <Flame size={20} className="text-orange-500 mb-1" />, val: globalStreak.current, lbl: 'Cur. Streak' },
          { icon: <Trophy size={20} className="text-amber-500 mb-1" />, val: globalStreak.longest, lbl: 'Top Streak' },
          { icon: <BookOpen size={20} className="text-indigo-500 mb-1" />, val: stats.totalSessions, lbl: 'Sessions' }
        ].map((item, i) => (
          <div key={i} className={`p-4 rounded-xl border text-center shadow-sm flex flex-col items-center justify-center ${cardBg}`}>
            {item.icon}<p className="text-2xl font-bold">{item.val}</p><p className={`text-[10px] font-bold uppercase mt-1 ${textMuted}`}>{item.lbl}</p>
          </div>
        ))}
      </div>

      {/* Two column layout on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`border rounded-2xl p-5 shadow-sm space-y-4 ${cardBg}`}>
          <h3 className="font-bold flex items-center gap-2"><Layers size={18} className="text-indigo-500"/> Memorization Status</h3>
          <p className={`text-xs ${textMuted}`}>Based on {stats.totalUniqueAyahs} unique ayahs tracked.</p>
          <div className={`w-full h-4 rounded-full flex overflow-hidden ${chartBg}`}>
             <div className="bg-emerald-500 h-full transition-all" style={{width: `${(stats.mastery.mastered/Math.max(stats.totalUniqueAyahs, 1))*100}%`}}></div>
             <div className="bg-amber-400 h-full transition-all" style={{width: `${(stats.mastery.familiar/Math.max(stats.totalUniqueAyahs, 1))*100}%`}}></div>
             <div className="bg-rose-500 h-full transition-all" style={{width: `${(stats.mastery.learning/Math.max(stats.totalUniqueAyahs, 1))*100}%`}}></div>
          </div>
          <div className="flex justify-between text-xs font-semibold pt-1">
            <span className="text-emerald-600 dark:text-emerald-400">Mastered ({stats.mastery.mastered})</span>
            <span className="text-amber-600 dark:text-amber-500">Familiar ({stats.mastery.familiar})</span>
            <span className="text-rose-600 dark:text-rose-400">Learning ({stats.mastery.learning})</span>
          </div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-sm space-y-6 ${cardBg}`}>
          <h3 className="font-bold flex items-center gap-2"><Calendar size={18} className="text-teal-500"/> Weekly Activity</h3>
          <div className="flex items-end justify-between h-32 gap-1.5 pt-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
              <div key={day} className="flex flex-col items-center flex-1 group">
                <div className={`w-full rounded-t-md relative h-24 flex items-end ${chartBg}`}>
                  <div className={`w-full rounded-t-md transition-all duration-700 ease-out relative ${stats.activityByDay[i].value > 0 ? 'bg-teal-500' : 'bg-transparent'}`} style={{ height: `${stats.activityByDay[i].pct}%` }}>
                    <span className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>{stats.activityByDay[i].value}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold mt-2 ${textMuted}`}>{day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-sm space-y-4 ${cardBg}`}>
          <h3 className="font-bold flex items-center gap-2"><Star size={18} className="text-amber-500"/> Accuracy by Surah</h3>
          <div className="space-y-3 pt-2">
            {stats.surahAccuracyList.length > 0 ? stats.surahAccuracyList.map((d, i) => (
              <div key={i} className="space-y-1">
                 <div className="flex justify-between text-sm">
                   <span className="font-semibold">{d.name} <span className="text-xs font-normal opacity-60">({d.attempted} graded)</span></span>
                   <span className={textMuted}>{d.accuracy}%</span>
                 </div>
                 <div className={`w-full h-2 rounded-full overflow-hidden ${chartBg}`}>
                   <div className={`h-full rounded-full ${d.accuracy >= 80 ? 'bg-emerald-500' : d.accuracy >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${d.accuracy}%` }}></div>
                 </div>
              </div>
            )) : <div className={`text-sm italic text-center py-4 opacity-50 ${textMuted}`}>No Surah data yet.</div>}
          </div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-sm space-y-4 ${cardBg}`}>
          <h3 className="font-bold flex items-center gap-2"><Clock size={18} className="text-indigo-400"/> Practice Time Habits</h3>
          <div className="grid grid-cols-3 gap-2">
             <div className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-amber-100' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
               <Sun size={20} className="mb-1 opacity-80" />
               <span className="text-[10px] uppercase font-bold opacity-70">Morning</span>
               <span className="text-lg font-bold">{stats.timeOfDay.morning}</span>
             </div>
             <div className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-orange-100' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
               <Globe size={20} className="mb-1 opacity-80" />
               <span className="text-[10px] uppercase font-bold opacity-70">Afternoon</span>
               <span className="text-lg font-bold">{stats.timeOfDay.afternoon}</span>
             </div>
             <div className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-indigo-100' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
               <Moon size={20} className="mb-1 opacity-80" />
               <span className="text-[10px] uppercase font-bold opacity-70">Evening</span>
               <span className="text-lg font-bold">{stats.timeOfDay.evening}</span>
             </div>
          </div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-sm space-y-6 md:col-span-2 ${cardBg}`}>
          <h3 className="font-bold flex items-center gap-2"><TrendingUp size={18} className="text-teal-500"/> Recent Sessions Trend</h3>
          <div className="flex items-end justify-between h-32 gap-2 pt-2">
            {stats.barData.length > 0 ? stats.barData.map((d, i) => (
              <div key={i} className="flex flex-col items-center flex-1 group">
                <div className={`w-full rounded-t-md relative h-24 flex items-end ${chartBg}`}>
                  <div className="w-full bg-slate-400 dark:bg-slate-600 rounded-t-md transition-all duration-1000 ease-out relative" style={{ height: `${d.accuracy}%` }}></div>
                </div>
                <span className={`text-[10px] font-semibold mt-2 ${textMuted}`}>{d.label}</span>
              </div>
            )) : <div className={`w-full h-full flex items-center justify-center text-sm italic opacity-50 ${textMuted}`}>Complete a session to see trends.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}




function SettingsScreen({ theme, setTheme, soundEnabled, setSoundEnabled, data, onClearData, onImportData, isInstallable, installPWA }) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [importMessage, setImportMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);
  const cardBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100';
  const rowBorder = theme === 'dark' ? 'border-slate-700' : 'border-slate-100';

  const handleExport = () => {
    const backupStr = JSON.stringify(data, null, 2);
    const blob = new Blob([backupStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `solo-hifz-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.history && typeof parsed.history === 'object') {
          onImportData(parsed); setImportMessage({ text: 'Data imported successfully!', type: 'success' });
        } else setImportMessage({ text: 'Invalid backup format.', type: 'error' });
      } catch (err) { setImportMessage({ text: 'Could not read file.', type: 'error' }); }
      setTimeout(() => setImportMessage({ text: '', type: '' }), 4000); e.target.value = null; 
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-6 animate-in fade-in">
      
      {isInstallable && (
        <div className={`border rounded-2xl overflow-hidden shadow-sm p-5 flex items-center justify-between ${theme === 'dark' ? 'bg-teal-900/30 border-teal-800/50' : 'bg-teal-50 border-teal-100'}`}>
          <div><h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-teal-400' : 'text-teal-800'}`}>Install App</h3><p className={`text-sm ${theme === 'dark' ? 'text-teal-500' : 'text-teal-600'}`}>Add Solo Hifz to your home screen</p></div>
          <button onClick={installPWA} className={`p-3 rounded-xl font-bold shadow-sm ${theme === 'dark' ? 'bg-teal-600 text-white hover:bg-teal-500' : 'bg-teal-600 text-white hover:bg-teal-700'}`}><Smartphone size={20} /></button>
        </div>
      )}

      <div className={`border rounded-2xl overflow-hidden shadow-sm ${cardBg}`}>
        <div className={`p-4 border-b font-bold flex items-center gap-2 ${rowBorder}`}><Settings size={18} className="text-teal-500"/> Preferences</div>
        
        <div className={`p-4 flex items-center justify-between border-b ${rowBorder}`}>
          <div><p className="font-semibold">App Theme</p><p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Toggle light and dark mode</p></div>
          <div className={`flex items-center p-1 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <button onClick={() => setTheme('light')} className={`p-2 rounded-lg transition-all ${theme === 'light' ? 'bg-white shadow-sm text-amber-500' : 'text-slate-400 hover:text-slate-600'}`}><Sun size={18} /></button>
            <button onClick={() => setTheme('dark')} className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-slate-800 shadow-sm text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}><Moon size={18} /></button>
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div><p className="font-semibold">Sound Effects</p><p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Audio feedback when grading</p></div>
          <div className={`flex items-center p-1 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <button onClick={() => setSoundEnabled(true)} className={`p-2 rounded-lg transition-all ${soundEnabled ? (theme === 'dark' ? 'bg-teal-900/50 text-teal-400 shadow-sm' : 'bg-white shadow-sm text-teal-600') : 'text-slate-400 hover:text-slate-600'}`}><Volume2 size={18} /></button>
            <button onClick={() => setSoundEnabled(false)} className={`p-2 rounded-lg transition-all ${!soundEnabled ? (theme === 'dark' ? 'bg-rose-900/50 text-rose-400 shadow-sm' : 'bg-white shadow-sm text-rose-500') : 'text-slate-400 hover:text-slate-600'}`}><VolumeX size={18} /></button>
          </div>
        </div>
      </div>
      
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${cardBg}`}>
        <div className={`p-4 border-b font-bold flex items-center gap-2 ${rowBorder}`}><FileJson size={18} className="text-indigo-500"/> Data & Backup</div>
        <div className={`p-4 flex items-center justify-between border-b ${rowBorder}`}>
          <div><p className="font-semibold">Export Progress</p><p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Save your analytics</p></div>
          <button onClick={handleExport} className={`p-2.5 rounded-xl border transition-colors ${theme === 'dark' ? 'bg-slate-700 border-slate-600 hover:bg-slate-600' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}><Download size={18} className="text-teal-500" /></button>
        </div>
        <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b ${rowBorder}`}>
          <div><p className="font-semibold">Import Backup</p><p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Restore data from JSON</p>{importMessage.text && <p className={`text-xs mt-1 font-semibold ${importMessage.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>{importMessage.text}</p>}</div>
          <button onClick={() => fileInputRef.current?.click()} className={`shrink-0 p-2.5 rounded-xl border transition-colors ${theme === 'dark' ? 'bg-slate-700 border-slate-600 hover:bg-slate-600' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}><Upload size={18} className="text-indigo-500" /></button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
        </div>
        <div className="p-4 flex items-center justify-between">
          <div><p className="font-semibold text-rose-500">Reset Analytics</p><p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Permanently delete history</p></div>
          <button onClick={() => setShowConfirmModal(true)} className={`p-2.5 rounded-xl border transition-colors ${theme === 'dark' ? 'bg-rose-900/20 border-rose-800/50 hover:bg-rose-900/40' : 'bg-rose-50 border-rose-200 hover:bg-rose-100'}`}><Trash2 size={18} className="text-rose-500" /></button>
        </div>
      </div>
      
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-sm p-6 rounded-2xl shadow-xl space-y-6 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className="text-center"><div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} /></div><h3 className="text-xl font-bold text-rose-500 mb-2">Delete all data?</h3><p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>This cannot be undone. Session history will be permanently erased.</p></div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className={`flex-1 py-3 font-semibold rounded-xl ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>Cancel</button>
              <button onClick={() => { onClearData(); setShowConfirmModal(false); }} className="flex-1 py-3 font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}