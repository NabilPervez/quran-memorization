// src/App.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, Check, X, Eye, Loader2 } from 'lucide-react';

// --- Types ---
type AppMode = 'setup' | 'prompt' | 'testing' | 'completed';

interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

interface AyahData {
  numberInSurah: number;
  text: string;
  audio: string;
}

export default function App() {
  // --- State Management ---
  const [mode, setMode] = useState<AppMode>('setup');
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(7);
  
  const [ayahs, setAyahs] = useState<AyahData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0); // 0 = prompt, 1+ = testing
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(0);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Audio Concurrency Control
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Initialization: Fetch Surah List ---
  useEffect(() => {
    const fetchSurahs = async () => {
      try {
        const res = await fetch('https://api.alquran.cloud/v1/surah');
        if (!res.ok) throw new Error('Failed to fetch API');
        const json = await res.json();
        setSurahs(json.data);
      } catch (err) {
        setError('Network error. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSurahs();
    
    // Initialize singleton audio element
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  // Ensure Ayah range is valid when Surah changes
  useEffect(() => {
    const maxAyahs = surahs.find(s => s.number === selectedSurah)?.numberOfAyahs || 1;
    if (endAyah > maxAyahs) setEndAyah(maxAyahs);
    if (startAyah > maxAyahs) setStartAyah(1);
  }, [selectedSurah, surahs]);

  // --- Core Actions ---
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startAyah > endAyah) return alert('Start Ayah cannot be greater than End Ayah.');
    
    setIsLoading(true);
    try {
      // Fetch Uthmani text and Alafasy audio editions simultaneously
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${selectedSurah}/editions/quran-uthmani,ar.alafasy`);
      if (!res.ok) throw new Error('Failed to fetch Surah data');
      const json = await res.json();
      
      const textEdition = json.data[0].ayahs;
      const audioEdition = json.data[1].ayahs;
      
      const combined: AyahData[] = textEdition.map((txt: any, idx: number) => ({
        numberInSurah: txt.numberInSurah,
        text: txt.text,
        audio: audioEdition[idx].audio
      }));
      
      // Slice to user selection (0-indexed)
      const selectedRange = combined.slice(startAyah - 1, endAyah);
      setAyahs(selectedRange);
      
      // Transition to Prompt mode (play first Ayah)
      setMode('prompt');
      setCurrentIndex(0);
      setStreak(0);
      setIsRevealed(false);
      
      playAudio(selectedRange[0].audio);
    } catch (err) {
      setError('Failed to load recitation data.');
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.load();
      audioRef.current.play().catch(console.error); // Catch auto-play block if any
      
      // Automatically move from prompt to testing when prompt finishes
      audioRef.current.onended = () => {
        if (mode === 'prompt' && ayahs.length > 1) {
          moveToNextAyah(1);
        }
      };
    }
  };

  const handleReveal = useCallback(() => {
    if (!isRevealed) {
      setIsRevealed(true);
      playAudio(ayahs[currentIndex].audio);
    }
  }, [isRevealed, currentIndex, ayahs]);

  const handleScore = (correct: boolean) => {
    if (correct) {
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }
    
    if (currentIndex + 1 >= ayahs.length) {
      if (audioRef.current) audioRef.current.pause();
      setMode('completed');
    } else {
      moveToNextAyah(currentIndex + 1);
    }
  };

  const moveToNextAyah = (index: number) => {
    if (audioRef.current) audioRef.current.pause();
    setCurrentIndex(index);
    setIsRevealed(false);
    setMode('testing');
  };

  // --- Background Audio Prefetching ---
  useEffect(() => {
    if (mode === 'testing' && !isRevealed && ayahs[currentIndex]) {
      const nextAudioUrl = ayahs[currentIndex].audio;
      fetch(nextAudioUrl, { mode: 'no-cors' }).catch(() => {});
    }
  }, [currentIndex, mode, isRevealed, ayahs]);

  // --- Accessibility: Keyboard Nav ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Enter') && mode === 'testing' && !isRevealed) {
        e.preventDefault();
        handleReveal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isRevealed, handleReveal]);

  // --- UI Renderers ---
  if (isLoading && mode === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100">
      <main className="max-w-md mx-auto p-4 md:p-6 min-h-screen flex flex-col justify-center">
        
        <AnimatePresence mode="wait">
          
          {/* SPRINT 2: SETUP MODE */}
          {mode === 'setup' && (
            <motion.form 
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={handleStartSession} 
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
            >
              <h1 className="text-2xl font-bold mb-6 text-center tracking-tight">The Solo Hifz Partner</h1>
              
              {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              
              <div className="space-y-5">
                <div>
                  <label htmlFor="surah" className="block text-sm font-medium text-gray-700 mb-1">Surah</label>
                  <select 
                    id="surah"
                    value={selectedSurah} 
                    onChange={e => setSelectedSurah(Number(e.target.value))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    {surahs.map(s => (
                      <option key={s.number} value={s.number}>{s.number}. {s.englishName} ({s.name})</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label htmlFor="startAyah" className="block text-sm font-medium text-gray-700 mb-1">Start Ayah</label>
                    <input 
                      id="startAyah"
                      type="number" 
                      min={1} 
                      max={surahs.find(s => s.number === selectedSurah)?.numberOfAyahs || 1}
                      value={startAyah} 
                      onChange={e => setStartAyah(Number(e.target.value))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="endAyah" className="block text-sm font-medium text-gray-700 mb-1">End Ayah</label>
                    <input 
                      id="endAyah"
                      type="number" 
                      min={startAyah} 
                      max={surahs.find(s => s.number === selectedSurah)?.numberOfAyahs || 1}
                      value={endAyah} 
                      onChange={e => setEndAyah(Number(e.target.value))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                    />
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 touch-manipulation"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  Begin Memorization
                </button>
              </div>
            </motion.form>
          )}

          {/* SPRINT 3: PROMPT MODE (Playing First Ayah) */}
          {mode === 'prompt' && (
            <motion.div 
              key="prompt"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="text-sm font-medium text-gray-400 mb-8 uppercase tracking-widest">Initial Prompt</div>
              <div className="bg-white p-8 w-full rounded-3xl shadow-sm border border-gray-100 text-center mb-6 min-h-[250px] flex items-center justify-center">
                <p dir="rtl" className="text-4xl md:text-5xl leading-[1.8] font-arabic text-gray-800">
                  {ayahs[0].text}
                </p>
              </div>
              
              <button 
                onClick={() => ayahs.length > 1 ? moveToNextAyah(1) : setMode('completed')}
                className="py-3 px-8 text-indigo-600 font-medium hover:bg-indigo-50 rounded-full transition-colors"
              >
                Skip Audio & Begin
              </button>
            </motion.div>
          )}

          {/* SPRINT 3 & 4: TESTING MODE */}
          {mode === 'testing' && (
            <motion.div 
              key="testing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex flex-col"
            >
              <div className="flex justify-between items-center mb-6 px-2">
                <span className="text-sm font-medium text-gray-500">Ayah {ayahs[currentIndex].numberInSurah}</span>
                <span className="text-sm font-bold flex items-center gap-1 text-orange-500 bg-orange-50 px-3 py-1 rounded-full">
                  🔥 Streak: {streak}
                </span>
              </div>

              <div className="bg-white p-8 w-full rounded-3xl shadow-sm border border-gray-100 min-h-[300px] flex flex-col items-center justify-center mb-8 relative overflow-hidden">
                {!isRevealed ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center w-full"
                  >
                    <p className="text-gray-400 mb-6 text-lg">Recite Ayah {ayahs[currentIndex].numberInSurah} from memory</p>
                    <button 
                      onClick={handleReveal}
                      aria-label="Reveal Ayah"
                      className="w-full py-16 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group touch-manipulation"
                    >
                      <Eye className="w-10 h-10 mb-3 group-hover:scale-110 transition-transform" />
                      <span className="font-medium text-lg">Tap to Reveal</span>
                      <span className="text-xs mt-2 opacity-50">(or press Spacebar)</span>
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="w-full flex flex-col items-center"
                  >
                    <p dir="rtl" className="text-4xl md:text-5xl leading-[1.8] font-arabic text-gray-900 mb-8 text-center">
                      {ayahs[currentIndex].text}
                    </p>
                    <button 
                      onClick={() => playAudio(ayahs[currentIndex].audio)}
                      className="text-indigo-600 p-3 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"
                      aria-label="Replay Audio"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Assessment Controls */}
              <AnimatePresence>
                {isRevealed && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    <button 
                      onClick={() => handleScore(false)}
                      className="py-4 border-2 border-red-100 bg-red-50 text-red-600 font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors touch-manipulation"
                    >
                      <X className="w-5 h-5" /> Incorrect
                    </button>
                    <button 
                      onClick={() => handleScore(true)}
                      className="py-4 border-2 border-emerald-100 bg-emerald-50 text-emerald-600 font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors touch-manipulation"
                    >
                      <Check className="w-5 h-5" /> Correct
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* SPRINT 4: COMPLETED MODE */}
          {mode === 'completed' && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center"
            >
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Session Complete</h2>
              <p className="text-gray-500 mb-8">You finished the selected Ayah range.</p>
              
              <div className="bg-orange-50 text-orange-600 rounded-xl p-4 mb-8">
                <span className="block text-sm font-medium mb-1">Final Streak</span>
                <span className="text-3xl font-bold">{streak}</span>
              </div>

              <button 
                onClick={() => setMode('setup')}
                className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors touch-manipulation"
              >
                Start New Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}