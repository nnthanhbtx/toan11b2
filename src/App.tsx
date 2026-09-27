import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  HelpCircle, 
  Phone, 
  Users, 
  RotateCcw, 
  Lightbulb, 
  Trophy, 
  Medal, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  Award, 
  Sparkles, 
  Check, 
  X, 
  Clock, 
  User, 
  GraduationCap, 
  ListChecks, 
  AlertCircle,
  Lock,
  WifiOff,
  Info,
  Timer,
  ShieldCheck,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { questionSetsData, Question } from './data';
import Latex from 'react-latex-next';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { GoogleSheetModal } from './components/GoogleSheetModal';
import { 
  getGoogleSheetUrl, 
  saveQuizResultToSheet, 
  initAutoSyncListener, 
  QuizResultPayload 
} from './services/googleSheetService';

// --- Prize ladder constants ---
const PRIZE_LIST = [
  "100.000",
  "200.000",
  "300.000",
  "500.000",
  "1.000.000",   // Milestone 5 (Mốc 1)
  "2.000.000",
  "3.600.000",
  "6.000.000",
  "10.000.000",
  "14.000.000",  // Milestone 10 (Mốc 2)
  "22.000.000",
  "30.000.000",
  "40.000.000",
  "60.000.000",
  "85.000.000"   // Milestone 15 (Mốc 3 - Đỉnh vinh quang)
];

const SAFE_HAVEN_INDICES = [4, 9, 14]; // 0-indexed: 5th, 10th, 15th questions
const QUESTION_TIME_LIMIT = 60; // 60 seconds per question

// --- Web Audio API Engine (100% Offline & Pure Web Audio) ---
class AudioEngine {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  
  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(frequency: number, type: OscillatorType, duration: number, volume = 0.1) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio fallback catch
    }
  }

  playHover() { 
    this.playTone(587.33, 'sine', 0.08, 0.03); 
  }

  playSelect() { 
    this.playTone(330, 'triangle', 0.25, 0.08); 
    setTimeout(() => this.playTone(392, 'triangle', 0.35, 0.08), 80);
  }

  playLock() {
    // Dramatic tension suspense drone
    this.playTone(110, 'triangle', 1.8, 0.12);
    setTimeout(() => this.playTone(130.81, 'sine', 1.6, 0.10), 150);
    setTimeout(() => this.playTone(164.81, 'triangle', 1.2, 0.08), 400);
  }

  playTick() {
    this.playTone(880, 'sine', 0.05, 0.05);
  }

  playCorrect() {
    this.playTone(523.25, 'sine', 0.25, 0.1); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.25, 0.1), 120); // E5
    setTimeout(() => this.playTone(783.99, 'sine', 0.25, 0.1), 240); // G5
    setTimeout(() => this.playTone(1046.50, 'sine', 0.7, 0.12), 360); // C6
  }

  playWrong() {
    // Dramatic deep buzzer
    this.playTone(146.83, 'sawtooth', 0.5, 0.15); // D3
    setTimeout(() => this.playTone(110.00, 'sawtooth', 0.8, 0.18), 160); // A2
  }

  playTimeout() {
    this.playTone(250, 'sawtooth', 0.3, 0.15);
    setTimeout(() => this.playTone(200, 'sawtooth', 0.6, 0.15), 200);
  }

  playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51, 1567.98];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.5, 0.12), i * 130);
    });
  }

  playMilestone() {
    [440, 554.37, 659.25, 880, 1108.73].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.4, 0.12), i * 100);
    });
  }

  playLifeline() {
    this.playTone(659.25, 'sine', 0.2, 0.08);
    setTimeout(() => this.playTone(880, 'sine', 0.3, 0.08), 90);
    setTimeout(() => this.playTone(1174.66, 'sine', 0.4, 0.08), 180);
  }
}

const audio = new AudioEngine();

// --- Main App Component ---
export default function App() {
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'gameover' | 'victory'>('intro');
  const [playerName, setPlayerName] = useState('');
  const [playerClass, setPlayerClass] = useState('');
  const [selectedSetIndex, setSelectedSetIndex] = useState<number>(0); // 0..3 or -1 for random
  
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(questionSetsData[0].questions);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const [showResultStatus, setShowResultStatus] = useState<'none' | 'correct' | 'wrong'>('none');
  
  const [lifelines, setLifelines] = useState({ fiftyFifty: true, askAudience: true, callFriend: true });
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  
  const [activeModal, setActiveModal] = useState<'none' | 'audience' | 'friend' | 'solution' | 'stopConfirm' | 'review' | 'ladder' | 'rules'>('none');
  const [audienceData, setAudienceData] = useState<number[]>([0, 0, 0, 0]);
  const [friendMessage, setFriendMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  
  // Google Sheet integration state
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState(false);
  const [sheetSaveStatus, setSheetSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'queued' | 'no_url'>('idle');
  const [sheetSaveMessage, setSheetSaveMessage] = useState('');
  const hasSavedCurrentGameRef = useRef(false);
  const isSheetConnected = !!getGoogleSheetUrl();

  // Initialize auto-sync background listener for offline queue
  useEffect(() => {
    const cleanup = initAutoSyncListener();
    return cleanup;
  }, []);

  const [timeElapsed, setTimeElapsed] = useState(0);
  const [questionCountdown, setQuestionCountdown] = useState(QUESTION_TIME_LIMIT);
  const [isCountdownEnabled, setIsCountdownEnabled] = useState(true);
  const [isVoluntaryStop, setIsVoluntaryStop] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const currentQ = activeQuestions[currentQIndex] || activeQuestions[0];

  // Global Elapsed Timer
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = window.setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // Question Countdown Timer (60s authentic rule)
  useEffect(() => {
    if (gameState === 'playing' && isCountdownEnabled && !isAnswerLocked && activeModal === 'none') {
      countdownRef.current = window.setInterval(() => {
        setQuestionCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            handleTimeExpired();
            return 0;
          }
          if (prev <= 6) {
            audio.playTick();
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [gameState, isCountdownEnabled, isAnswerLocked, activeModal, currentQIndex]);

  const handleTimeExpired = () => {
    setIsTimedOut(true);
    setIsAnswerLocked(true);
    setShowResultStatus('wrong');
    audio.playTimeout();
    setTimeout(() => {
      setGameState('gameover');
    }, 2400);
  };

  const toggleSound = () => {
    audio.isMuted = !isMuted;
    setIsMuted(!isMuted);
    if (isMuted) {
      audio.init();
      audio.playHover();
    }
  };

  const startGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !playerClass.trim()) return;
    
    audio.init();
    audio.playWin();

    // Prepare questions set
    let preparedQuestions: Question[];
    if (selectedSetIndex === -1) {
      const allQ = questionSetsData.flatMap(s => s.questions);
      preparedQuestions = [...allQ].sort(() => Math.random() - 0.5).slice(0, 15);
    } else {
      preparedQuestions = questionSetsData[selectedSetIndex]?.questions || questionSetsData[0].questions;
    }

    setActiveQuestions(preparedQuestions);
    setGameState('playing');
    setTimeElapsed(0);
    setCurrentQIndex(0);
    setIsVoluntaryStop(false);
    setIsTimedOut(false);
    setLifelines({ fiftyFifty: true, askAudience: true, callFriend: true });
    hasSavedCurrentGameRef.current = false;
    setSheetSaveStatus('idle');
    setSheetSaveMessage('');
    resetQuestionState();
  };

  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setIsAnswerLocked(false);
    setShowResultStatus('none');
    setHiddenOptions([]);
    setActiveModal('none');
    setQuestionCountdown(QUESTION_TIME_LIMIT);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Step 1: Contestant clicks to select an option (or clicks again to lock)
  const handleSelectAnswer = (index: number) => {
    if (isAnswerLocked || hiddenOptions.includes(index)) return;
    
    audio.init();
    
    if (selectedAnswer === index) {
      // Double tap on same option = confirm and lock!
      confirmLockAnswer(index);
    } else {
      audio.playSelect();
      setSelectedAnswer(index);
    }
  };

  // Step 2: Final Answer Confirmation ("Chốt đáp án cuối cùng")
  const confirmLockAnswer = (indexToLock?: number) => {
    const index = indexToLock !== undefined ? indexToLock : selectedAnswer;
    if (index === null || isAnswerLocked || hiddenOptions.includes(index)) return;

    audio.init();
    audio.playLock();
    setIsAnswerLocked(true);

    // Suspense delay (1.8s) before revealing answer
    setTimeout(() => {
      if (index === currentQ.correctAnswerIndex) {
        audio.playCorrect();
        setShowResultStatus('correct');
        
        // Check milestone sounds
        if (SAFE_HAVEN_INDICES.includes(currentQIndex)) {
          setTimeout(() => audio.playMilestone(), 300);
        }

        // Wait before moving to next question or victory
        setTimeout(() => {
          if (currentQIndex === 14) {
            audio.playWin();
            setGameState('victory');
          } else {
            setCurrentQIndex(prev => prev + 1);
            resetQuestionState();
          }
        }, 2400);
      } else {
        // WRONG ANSWER: Game ends immediately! (Rule of Ai là triệu phú)
        audio.playWrong();
        setShowResultStatus('wrong');
        setTimeout(() => {
          setGameState('gameover');
        }, 2600);
      }
    }, 1800);
  };

  const useFiftyFifty = () => {
    if (!lifelines.fiftyFifty || isAnswerLocked) return;
    audio.init();
    audio.playLifeline();
    setLifelines(prev => ({ ...prev, fiftyFifty: false }));
    
    const wrongOptions = [0, 1, 2, 3].filter(i => i !== currentQ.correctAnswerIndex);
    // Pick 2 random wrong options to hide
    wrongOptions.sort(() => Math.random() - 0.5);
    setHiddenOptions([wrongOptions[0], wrongOptions[1]]);
    
    // If the currently selected answer was hidden, unselect it
    if (selectedAnswer !== null && (wrongOptions[0] === selectedAnswer || wrongOptions[1] === selectedAnswer)) {
      setSelectedAnswer(null);
    }
  };

  const useAskAudience = () => {
    if (!lifelines.askAudience || isAnswerLocked) return;
    audio.init();
    audio.playLifeline();
    setLifelines(prev => ({ ...prev, askAudience: false }));
    
    const data = [0, 0, 0, 0];
    const availableIndices = [0, 1, 2, 3].filter(i => !hiddenOptions.includes(i));
    
    // Give correct answer the majority percentage (55% to 85%)
    const correctPercent = Math.min(90, Math.max(52, Math.floor(Math.random() * 30) + 55));
    data[currentQ.correctAnswerIndex] = correctPercent;
    
    let remaining = 100 - correctPercent;
    const remainingWrongIndices = availableIndices.filter(i => i !== currentQ.correctAnswerIndex);
    
    remainingWrongIndices.forEach((idx, i) => {
      if (i === remainingWrongIndices.length - 1) {
        data[idx] = remaining;
      } else {
        const share = Math.floor(Math.random() * (remaining * 0.7));
        data[idx] = share;
        remaining -= share;
      }
    });
    
    setAudienceData(data);
    setActiveModal('audience');
  };

  const useCallFriend = () => {
    if (!lifelines.callFriend || isAnswerLocked) return;
    audio.init();
    audio.playLifeline();
    setLifelines(prev => ({ ...prev, callFriend: false }));
    
    const isCorrect = Math.random() < 0.85; // 85% accuracy
    const availableWrong = [0, 1, 2, 3].filter(i => i !== currentQ.correctAnswerIndex && !hiddenOptions.includes(i));
    const suggestedIndex = isCorrect || availableWrong.length === 0
      ? currentQ.correctAnswerIndex 
      : availableWrong[Math.floor(Math.random() * availableWrong.length)];
    
    const optionsText = ['A', 'B', 'C', 'D'];
    const friends = ['Bạn Nam (Chuyên Toán)', 'Bạn Linh (Lớp phó học tập)', 'Bạn Tuấn (Học sinh giỏi)', 'Bạn Mai (Thủ khoa Toán)'];
    const randomFriend = friends[Math.floor(Math.random() * friends.length)];
    
    setFriendMessage(
      `${randomFriend}: "Alo ${playerName || 'bạn'} à! Câu này mình vừa ôn bài Công thức lượng giác xong. Mình tin chắc 90% đáp án đúng là ${optionsText[suggestedIndex]}. Hãy tự tin lên nhé!"`
    );
    setActiveModal('friend');
  };

  const handleStopGame = () => {
    setIsVoluntaryStop(true);
    setActiveModal('none');
    setGameState('gameover');
  };

  const restartGame = () => {
    hasSavedCurrentGameRef.current = false;
    setSheetSaveStatus('idle');
    setSheetSaveMessage('');
    setGameState('intro');
    resetQuestionState();
  };

  // Guaranteed prize formula (Strict Ai là triệu phú rules)
  const getGuaranteedPrize = () => {
    if (gameState === 'victory') return PRIZE_LIST[14];
    if (isVoluntaryStop && currentQIndex > 0) return PRIZE_LIST[currentQIndex - 1];
    if (currentQIndex >= 10) return PRIZE_LIST[9]; // 14.000.000 (Mốc 2)
    if (currentQIndex >= 5) return PRIZE_LIST[4];  // 1.000.000 (Mốc 1)
    return "0";
  };

  const getFeedbackMessage = (score: number) => {
    if (score === 15) return "Xuất sắc tuyệt đỉnh! Chúc mừng bạn đã chinh phục trọn vẹn 15 câu và trở thành Triệu phú Toán BTX!";
    if (score >= 10) return "Rất xuất sắc! Bạn nắm rất vững các công thức lượng giác và đã vượt qua mốc số 10 an toàn!";
    if (score >= 5) return "Làm tốt lắm! Bạn đã vượt qua mốc số 5. Hãy ôn luyện thêm các công thức biến đổi tích thành tổng để bứt phá nhé!";
    return "Hãy tiếp tục cố gắng! Bạn liên hệ giáo viên dạy Toán (Mr Thanh btx) để được hướng dẫn và luyện tập thêm nhé!";
  };

  // Automatically save results to Google Sheet upon Game Over or Victory
  useEffect(() => {
    if ((gameState === 'gameover' || gameState === 'victory') && !hasSavedCurrentGameRef.current) {
      hasSavedCurrentGameRef.current = true;
      const isVictory = gameState === 'victory';
      const finalScore = isVictory ? 15 : currentQIndex;
      const prizeWon = getGuaranteedPrize();

      const payload: QuizResultPayload = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleString('vi-VN'),
        playerName: playerName.trim() || 'Học sinh',
        playerClass: playerClass.trim() || '11',
        score: finalScore,
        totalQuestions: 15,
        prize: prizeWon,
        timeSpent: formatTime(timeElapsed),
        setName: selectedSetIndex === -1 ? 'Ngẫu nhiên (15 câu)' : (questionSetsData[selectedSetIndex]?.title || 'Bộ đề'),
        status: isVictory 
          ? 'Chiến thắng (15/15)' 
          : (isVoluntaryStop 
              ? 'Dừng cuộc chơi' 
              : (isTimedOut ? 'Hết thời gian' : 'Trả lời sai')),
        details: `Dừng tại câu ${currentQIndex + 1}. Mức thưởng: ${prizeWon} đ`,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      };

      setSheetSaveStatus('saving');
      setSheetSaveMessage('Đang tự động chuyển dữ liệu lên Google Sheet...');

      saveQuizResultToSheet(payload).then((res) => {
        if (res.status === 'sent') {
          setSheetSaveStatus('saved');
          setSheetSaveMessage(res.message);
        } else if (res.status === 'queued') {
          setSheetSaveStatus('queued');
          setSheetSaveMessage(res.message);
        } else {
          setSheetSaveStatus('no_url');
          setSheetSaveMessage(res.message);
        }
      }).catch(() => {
        setSheetSaveStatus('queued');
        setSheetSaveMessage('Đã lưu bài thi ngoại tuyến. Sẽ tự động gửi khi có mạng.');
      });
    }
  }, [gameState]);

  // --- RENDER SCREEN: INTRO ---
  if (gameState === 'intro') {
    return (
      <div className="min-h-screen bg-[#020024] flex items-center justify-center p-3 sm:p-4 md:p-6 relative overflow-hidden font-sans select-none pt-safe pb-safe pl-safe pr-safe">
        {/* Offline indicator banner */}
        <OfflineIndicator />

        {/* Stage background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(9,9,121,0.5)_0%,rgba(2,0,36,1)_100%)] z-0"></div>
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] min-w-[280px] min-h-[280px] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] min-w-[280px] min-h-[280px] bg-purple-500/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        {/* Action icons on top */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
          {/* Google Sheet Connection Button */}
          <button
            id="google-sheet-settings-btn"
            onClick={() => setIsGoogleSheetModalOpen(true)}
            className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-full bg-slate-800/80 border border-emerald-500/50 flex items-center gap-1.5 text-emerald-400 hover:bg-slate-700 active:scale-95 transition-all shadow-lg cursor-pointer text-xs font-semibold"
            title="Kết nối Google Sheet lưu điểm học sinh"
          >
            <FileSpreadsheet size={16} />
            <span className="hidden xs:inline">Google Sheet</span>
            {isSheetConnected ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            )}
          </button>

          {/* Rules Modal Button */}
          <button
            onClick={() => setActiveModal('rules')}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/80 border border-blue-400/40 flex items-center justify-center text-blue-300 hover:bg-slate-700 active:scale-95 transition-all shadow-lg cursor-pointer"
            title="Xem thể lệ & luật chơi"
          >
            <Info size={18} />
          </button>

          {/* Sound toggle */}
          <button
            id="sound-toggle-intro"
            onClick={toggleSound}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/80 border border-blue-400/40 flex items-center justify-center text-yellow-400 hover:bg-slate-700 active:scale-95 transition-all shadow-lg cursor-pointer"
            title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        <motion.div 
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-900/90 backdrop-blur-xl p-4 sm:p-7 md:p-9 rounded-2xl sm:rounded-3xl shadow-2xl z-10 border-2 border-yellow-500/50 w-full max-w-lg text-center relative"
        >
          {/* Logo Badge */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-yellow-300 via-amber-500 to-yellow-600 rounded-full mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.5)] mb-2.5 sm:mb-3 border-3 sm:border-4 border-slate-900">
            <span className="text-2xl sm:text-3xl font-black text-slate-950">$</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 mb-0.5 drop-shadow-sm uppercase tracking-wider">
            Ai Là Triệu Phú
          </h1>
          <h2 className="text-xs sm:text-lg font-bold text-blue-200 mb-2 uppercase tracking-wider">
            Toán 11 &bull; Công Thức Lượng Giác
          </h2>
          
          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black tracking-tight text-blue-300 mb-3 sm:mb-4 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-500/30">
            <span className="text-[10px] text-gray-400 uppercase font-normal">Thiết kế:</span> 
            <span className="text-white">GV Mr Thanh</span>
            <span className="text-yellow-400 font-bold">btx</span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-emerald-400 flex items-center gap-0.5 text-[10px]">
              <ShieldCheck size={11} /> 100% Offline
            </span>
          </div>

          {/* Form */}
          <form onSubmit={startGame} className="space-y-3 sm:space-y-3.5 text-left">
            <div>
              <label className="block text-[11px] sm:text-xs uppercase font-bold text-blue-300 mb-1 flex items-center gap-1.5">
                <User size={13} className="text-yellow-400" /> Họ và tên học sinh
              </label>
              <input 
                id="player-name-input"
                type="text" 
                placeholder="Nhập họ và tên của bạn..." 
                required
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-slate-800/80 border border-blue-400/40 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-sm sm:text-base"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs uppercase font-bold text-blue-300 mb-1 flex items-center gap-1.5">
                <GraduationCap size={13} className="text-yellow-400" /> Lớp học
              </label>
              <input 
                id="player-class-input"
                type="text" 
                placeholder="Nhập lớp (Ví dụ: 11A1)..." 
                required
                value={playerClass}
                onChange={e => setPlayerClass(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-slate-800/80 border border-blue-400/40 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-sm sm:text-base"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs uppercase font-bold text-blue-300 mb-1 flex items-center gap-1.5">
                <BookOpen size={13} className="text-yellow-400" /> Chọn chủ đề bộ đề (Chuẩn 2018)
              </label>
              <select
                id="dataset-select"
                value={selectedSetIndex}
                onChange={e => setSelectedSetIndex(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-blue-400/40 text-yellow-300 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all text-xs sm:text-sm cursor-pointer"
              >
                {questionSetsData.map((set, idx) => (
                  <option key={set.id} value={idx} className="bg-slate-900 text-white">
                    {set.title}
                  </option>
                ))}
                <option value={-1} className="bg-slate-900 text-yellow-400 font-bold">
                  🎲 Ngẫu nhiên (Xáo trộn 15 câu từ tất cả chủ đề)
                </option>
              </select>
            </div>

            {/* Google Sheet auto-save status indicator */}
            <div 
              onClick={() => setIsGoogleSheetModalOpen(true)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs cursor-pointer hover:bg-emerald-950/40 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                <FileSpreadsheet size={14} className="text-emerald-400 shrink-0" />
                <span className="truncate">Lưu điểm vào Google Sheet:</span>
              </div>
              <div className="flex items-center gap-1 font-bold shrink-0">
                {isSheetConnected ? (
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Đã kết nối
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    Cấu hình ngay &rarr;
                  </span>
                )}
              </div>
            </div>

            {/* Countdown timer toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Timer size={14} className="text-yellow-400" /> Giới hạn 60s mỗi câu (Luật chuẩn)
              </span>
              <button
                type="button"
                onClick={() => setIsCountdownEnabled(!isCountdownEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${isCountdownEnabled ? 'bg-yellow-500' : 'bg-slate-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 transition-transform ${isCountdownEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <button 
              id="start-game-button"
              type="submit"
              className="w-full mt-2 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 active:scale-[0.98] text-slate-950 font-black py-3 sm:py-3.5 px-6 rounded-xl shadow-[0_4px_0_0_#a16207] active:shadow-[0_0px_0_0_#a16207] transition-all text-base sm:text-lg flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
            >
              <Play fill="currentColor" size={18} /> Bắt đầu cuộc thi
            </button>
          </form>

          {/* PWA Install Button on mobile */}
          <div className="mt-3">
            <PWAInstallButton />
          </div>

          {/* Highlights */}
          <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-around text-[10px] sm:text-xs text-blue-300/80">
            <span className="flex items-center gap-1"><Sparkles size={11} className="text-yellow-400" /> 15 Câu hỏi</span>
            <span className="flex items-center gap-1"><HelpCircle size={11} className="text-yellow-400" /> 3 Trợ giúp</span>
            <span className="flex items-center gap-1"><Trophy size={11} className="text-yellow-400" /> Mốc 5 &bull; 10 &bull; 15</span>
          </div>
        </motion.div>

        {/* Modal: Rules & Guidelines */}
        <AnimatePresence>
          {activeModal === 'rules' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 text-left"
            >
              <motion.div 
                initial={{ scale: 0.92, y: 15 }} 
                animate={{ scale: 1, y: 0 }} 
                exit={{ scale: 0.92, y: 15 }}
                className="bg-slate-900 border-2 border-yellow-500/60 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 w-full max-w-md max-h-[88vh] flex flex-col text-white"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <h3 className="text-base sm:text-lg font-bold text-yellow-400 flex items-center gap-2">
                    <Trophy size={18} className="text-yellow-400" /> Luật Chơi Ai Là Triệu Phú
                  </h3>
                  <button 
                    onClick={() => setActiveModal('none')}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="overflow-y-auto my-3 space-y-3 text-xs sm:text-sm text-slate-200 leading-relaxed pr-1">
                  <div className="p-3 bg-blue-950/40 rounded-xl border border-blue-500/30">
                    <strong className="text-yellow-300 block mb-1">1. Mục tiêu cuộc thi:</strong>
                    Vượt qua 15 câu hỏi trắc nghiệm Toán 11 (Bài 2: Công thức lượng giác) để giành giải thưởng cao nhất <strong>85.000.000 đ</strong>.
                  </div>

                  <div className="p-3 bg-red-950/30 rounded-xl border border-red-500/30">
                    <strong className="text-red-300 block mb-1">2. Trả lời sai & Kết thúc:</strong>
                    Khi trả lời sai bất kỳ câu hỏi nào, <strong>cuộc chơi kết thúc ngay lập tức</strong>! Bạn sẽ bảo toàn số tiền thưởng ở mốc an toàn gần nhất đã vượt qua:
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-300">
                      <li>Sai trước câu 5: <strong>0 đ</strong> (ra về tay trắng).</li>
                      <li>Sai từ câu 6 - 10: Nhận <strong>1.000.000 đ</strong> (Mốc 1).</li>
                      <li>Sai từ câu 11 - 15: Nhận <strong>14.000.000 đ</strong> (Mốc 2).</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-yellow-950/30 rounded-xl border border-yellow-500/30">
                    <strong className="text-yellow-300 block mb-1">3. Quyền dừng cuộc chơi:</strong>
                    Trước khi bấm chốt đáp án, bạn có quyền <strong>Dừng cuộc chơi</strong> để bảo toàn trọn vẹn số tiền thưởng của câu vừa vượt qua.
                  </div>

                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                    <strong className="text-blue-300 block mb-1">4. Ba quyền trợ giúp:</strong>
                    Mỗi quyền chỉ được dùng 1 lần trong cả cuộc thi:
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-300">
                      <li><strong>50:50:</strong> Máy tính loại bỏ 2 phương án sai.</li>
                      <li><strong>Khán giả trường quay:</strong> Thống kê bình chọn từ khán giả.</li>
                      <li><strong>Gọi điện thoại cho người thân:</strong> Nhận tư vấn từ bạn học giỏi Toán.</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30">
                    <strong className="text-emerald-300 block mb-1">5. Chơi Ngoại tuyến 100% (Không cần Wifi):</strong>
                    Ứng dụng được đóng gói toàn bộ công thức và âm thanh tự động, bạn có thể cài đặt về màn hình chính điện thoại và chơi mượt mà kể cả khi không có mạng Internet.
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700 text-right">
                  <button 
                    onClick={() => setActiveModal('none')}
                    className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Đã hiểu luật chơi
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Sheet Integration Modal */}
        <GoogleSheetModal 
          isOpen={isGoogleSheetModalOpen} 
          onClose={() => setIsGoogleSheetModalOpen(false)} 
        />
      </div>
    );
  }

  // --- RENDER SCREEN: GAMEOVER OR VICTORY ---
  if (gameState === 'gameover' || gameState === 'victory') {
    const isVictory = gameState === 'victory';
    const finalScore = isVictory ? 15 : currentQIndex;
    const prizeWon = getGuaranteedPrize();
    
    return (
      <div className="min-h-screen bg-[#020024] flex items-center justify-center p-3 sm:p-4 md:p-6 relative overflow-hidden font-sans select-none pt-safe pb-safe pl-safe pr-safe">
        {/* Offline indicator */}
        <OfflineIndicator />

        {/* Victory confetti animation */}
        {isVictory && (
          <div className="absolute inset-0 pointer-events-none z-0 flex flex-wrap justify-center overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -50, x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 400), rotate: 0 }}
                animate={{ y: (typeof window !== 'undefined' ? window.innerHeight : 700) + 50, rotate: 360 }}
                transition={{ duration: 2.5 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
                className="w-2.5 h-2.5 absolute rounded-sm"
                style={{ backgroundColor: ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#a855f7', '#ec4899'][Math.floor(Math.random() * 6)] }}
              />
            ))}
          </div>
        )}
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(9,9,121,0.5)_0%,rgba(2,0,36,1)_100%)] z-0"></div>
        
        <motion.div 
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-900/90 backdrop-blur-xl p-4 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-2xl z-10 border-2 border-yellow-500/40 w-full max-w-2xl text-center relative"
        >
          <div className="mb-2.5 sm:mb-4 flex justify-center">
            {isVictory ? (
              <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-full bg-yellow-500/20 border-2 border-yellow-400 flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.4)]">
                <Trophy size={36} className="text-yellow-400 animate-bounce sm:w-12 sm:h-12" />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center shadow-[0_0_30px_rgba(96,165,250,0.3)]">
                <Medal size={36} className="text-blue-400 sm:w-12 sm:h-12" />
              </div>
            )}
          </div>
          
          <h1 className="text-base sm:text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 mb-1 uppercase tracking-wide">
            {isVictory 
              ? 'BẠN LÀ NHÀ TRIỆU PHÚ TOÁN BTX!' 
              : (isVoluntaryStop 
                  ? 'BẠN ĐÃ DỪNG CUỘC CHƠI!' 
                  : (isTimedOut 
                      ? 'HẾT THỜI GIAN SUY NGHĨ!' 
                      : 'KẾT THÚC CUỘC THI!'))}
          </h1>

          {!isVictory && !isVoluntaryStop && (
            <p className="text-xs sm:text-sm text-red-300 font-medium mb-1">
              {isTimedOut 
                ? `Bạn đã hết 60 giây suy nghĩ ở câu số ${currentQIndex + 1}.` 
                : `Rất tiếc! Bạn đã trả lời sai ở câu số ${currentQIndex + 1}.`}
            </p>
          )}
          
          <div className="text-xs sm:text-sm text-blue-100 mb-1 font-semibold">
            Thí sinh: <span className="text-yellow-400">{playerName}</span> &bull; Lớp: <span className="text-yellow-400">{playerClass}</span>
          </div>

          <div className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-black tracking-tight text-blue-300 mb-3 sm:mb-5">
            <span className="text-[10px] text-gray-400 uppercase font-normal">Thiết kế:</span> 
            <span className="text-white">GV Mr Thanh</span>
            <span className="text-yellow-400">btx</span>
          </div>

          {/* Stats & Prize Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3.5 sm:mb-5">
            <div className="bg-slate-800/80 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-blue-500/20">
              <div className="text-[10px] sm:text-xs text-blue-300 mb-0.5 flex items-center justify-center gap-1">
                <ListChecks size={12} /> <span className="truncate">Số câu đúng</span>
              </div>
              <div className="text-base sm:text-2xl font-black text-white">{finalScore} / 15</div>
            </div>
            
            <div className="bg-slate-800/80 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-blue-500/20">
              <div className="text-[10px] sm:text-xs text-blue-300 mb-0.5 flex items-center justify-center gap-1">
                <Award size={12} className="text-yellow-400" /> <span className="truncate">Tiền thưởng</span>
              </div>
              <div className="text-xs sm:text-xl font-black text-yellow-400 truncate">{prizeWon} <span className="text-[10px] font-normal">đ</span></div>
            </div>

            <div className="bg-slate-800/80 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-blue-500/20">
              <div className="text-[10px] sm:text-xs text-blue-300 mb-0.5 flex items-center justify-center gap-1">
                <Clock size={12} /> <span className="truncate">Thời gian</span>
              </div>
              <div className="text-base sm:text-2xl font-bold text-white">{formatTime(timeElapsed)}</div>
            </div>
          </div>
          
          {/* Google Sheet Auto-Save Status Card */}
          <div className="bg-slate-800/90 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-700/80 mb-3 sm:mb-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-left">
            <div className="flex items-center gap-2.5 w-full sm:w-auto min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                sheetSaveStatus === 'saved' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                  : (sheetSaveStatus === 'saving' 
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' 
                      : (sheetSaveStatus === 'queued' 
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                          : 'bg-slate-700/50 text-slate-400 border border-slate-600'))
              }`}>
                {sheetSaveStatus === 'saving' ? (
                  <RefreshCw size={15} className="animate-spin text-blue-400" />
                ) : (
                  <FileSpreadsheet size={15} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                  <span>Google Sheet:</span>
                  {sheetSaveStatus === 'saved' && (
                    <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-0.5">
                      <Check size={12} /> Đã tự động lưu thành công!
                    </span>
                  )}
                  {sheetSaveStatus === 'saving' && (
                    <span className="text-blue-300 text-[11px] font-semibold flex items-center gap-1">
                      Đang chuyển dữ liệu về Google Sheet...
                    </span>
                  )}
                  {sheetSaveStatus === 'queued' && (
                    <span className="text-amber-400 text-[11px] font-semibold">
                      Đã lưu ngoại tuyến (Tự động gửi khi có mạng)
                    </span>
                  )}
                  {sheetSaveStatus === 'no_url' && (
                    <span className="text-amber-300 text-[11px]">
                      Chưa kết nối URL Google Sheet
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {sheetSaveMessage || (sheetSaveStatus === 'saved' ? 'Điểm thi đã được đồng bộ vào bảng điểm của GV Mr Thanh btx.' : 'Dữ liệu được lưu trữ an toàn.')}
                </p>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={() => setIsGoogleSheetModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-xs text-emerald-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FileSpreadsheet size={13} /> {isSheetConnected ? 'Chi tiết / Đồng bộ' : 'Kết nối Google Sheet'}
              </button>
            </div>
          </div>

          {/* Feedback message */}
          <div className="bg-blue-950/70 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-blue-500/30 mb-3.5 sm:mb-5">
            <p className="text-xs sm:text-sm text-blue-100 font-medium leading-relaxed">
              {getFeedbackMessage(finalScore)}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
            <button 
              id="review-solutions-button"
              onClick={() => setActiveModal('review')}
              className="bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-yellow-400 border border-yellow-500/50 font-bold py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl transition-all text-xs sm:text-sm flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
            >
              <Lightbulb size={16} /> Xem lại đáp án & Lời giải
            </button>

            <button 
              id="restart-game-button"
              onClick={restartGame}
              className="bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 active:scale-[0.98] text-white font-bold py-2.5 sm:py-3 px-5 sm:px-7 rounded-xl shadow-[0_4px_0_0_#1e3a8a] active:shadow-[0_0px_0_0_#1e3a8a] transition-all text-xs sm:text-sm flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
            >
              <RotateCcw size={16} /> Chơi lại ván mới
            </button>
          </div>
        </motion.div>

        {/* Modal: Full review of questions and solutions */}
        <AnimatePresence>
          {activeModal === 'review' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 text-left"
            >
              <motion.div 
                initial={{ scale: 0.92, y: 15 }} 
                animate={{ scale: 1, y: 0 }} 
                exit={{ scale: 0.92, y: 15 }}
                className="bg-slate-900 border-2 border-yellow-500/60 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 w-full max-w-3xl max-h-[92vh] flex flex-col relative"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <h3 className="text-base sm:text-lg font-bold text-yellow-400 flex items-center gap-2">
                    <BookOpen size={18} /> Tổng hợp đáp án & Lời giải chi tiết
                  </h3>
                  <button 
                    onClick={() => setActiveModal('none')}
                    className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 my-3 space-y-3">
                  {activeQuestions.map((q, idx) => {
                    const isAnsweredCorrect = idx < finalScore;
                    const isFailurePoint = idx === finalScore && !isVictory && !isVoluntaryStop;
                    const isStopPoint = idx === finalScore && isVoluntaryStop;

                    return (
                      <div 
                        key={q.id || idx}
                        className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border ${
                          isAnsweredCorrect 
                            ? 'bg-green-950/30 border-green-500/40' 
                            : (isFailurePoint 
                                ? 'bg-red-950/30 border-red-500/40' 
                                : (isStopPoint 
                                    ? 'bg-amber-950/30 border-amber-500/40' 
                                    : 'bg-slate-800/60 border-slate-700'))
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] sm:text-xs font-black uppercase text-yellow-400 bg-yellow-950/60 px-2 py-0.5 rounded-full border border-yellow-500/40">
                            Câu {idx + 1}
                          </span>
                          {isAnsweredCorrect ? (
                            <span className="text-[11px] sm:text-xs text-green-400 font-bold flex items-center gap-1">
                              <Check size={12} /> Đã trả lời đúng
                            </span>
                          ) : isFailurePoint ? (
                            <span className="text-[11px] sm:text-xs text-red-400 font-bold flex items-center gap-1">
                              <X size={12} /> {isTimedOut ? 'Hết giờ tại đây' : 'Trả lời sai tại đây'}
                            </span>
                          ) : isStopPoint ? (
                            <span className="text-[11px] sm:text-xs text-amber-400 font-bold flex items-center gap-1">
                              <AlertCircle size={12} /> Dừng cuộc chơi tại đây
                            </span>
                          ) : (
                            <span className="text-[11px] sm:text-xs text-slate-400 font-medium">Chưa thi đấu</span>
                          )}
                        </div>

                        <div className="text-white font-medium mb-2 text-xs sm:text-sm leading-relaxed break-words">
                          <Latex>{q.question}</Latex>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2 text-xs">
                          {q.options.map((opt, optIdx) => (
                            <div 
                              key={optIdx} 
                              className={`p-2 rounded-lg border flex items-start gap-2 ${
                                optIdx === q.correctAnswerIndex 
                                  ? 'bg-green-900/40 border-green-400 text-green-200 font-bold' 
                                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                              }`}
                            >
                              <span className="w-5 h-5 rounded-full bg-slate-900 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-yellow-400">
                                {['A', 'B', 'C', 'D'][optIdx]}
                              </span>
                              <span className="break-words flex-1"><Latex>{opt}</Latex></span>
                              {optIdx === q.correctAnswerIndex && <Check size={14} className="ml-auto text-green-400 flex-shrink-0" />}
                            </div>
                          ))}
                        </div>

                        <div className="bg-slate-950/80 p-2 sm:p-2.5 rounded-xl border border-yellow-500/20 text-xs text-yellow-100/90 leading-relaxed break-words">
                          <span className="font-bold text-yellow-400 mr-1.5 inline-flex items-center gap-1">
                            <Lightbulb size={12} /> Lời giải:
                          </span>
                          <Latex>{q.solution}</Latex>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-700 text-right">
                  <button 
                    onClick={() => setActiveModal('none')}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Sheet Integration Modal */}
        <GoogleSheetModal 
          isOpen={isGoogleSheetModalOpen} 
          onClose={() => setIsGoogleSheetModalOpen(false)} 
        />
      </div>
    );
  }

  // --- RENDER SCREEN: PLAYING ---
  return (
    <div className="min-h-screen bg-[#020024] text-white font-sans overflow-hidden flex flex-col relative select-none pt-safe pb-safe pl-safe pr-safe">
      {/* Offline Status Banner */}
      <OfflineIndicator />

      {/* Background Lighting Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(9,9,121,0.5)_0%,rgba(2,0,36,1)_100%)] z-0"></div>
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] min-w-[280px] min-h-[280px] bg-blue-500/15 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] min-w-[280px] min-h-[280px] bg-purple-500/15 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Header Bar */}
      <header className="relative z-10 w-full px-2.5 sm:px-6 md:px-8 py-2 sm:py-2.5 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-blue-500/30">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-600 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-white shadow-[0_0_12px_rgba(251,191,36,0.5)]">
            <span className="text-xs sm:text-base font-black italic text-slate-950">TP</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base font-black bg-gradient-to-r from-yellow-300 via-yellow-400 to-white bg-clip-text text-transparent uppercase tracking-wider truncate">
              TRIỆU PHÚ TOÁN 11
            </h1>
            <p className="text-[10px] sm:text-xs text-blue-200 truncate">
              {playerName} ({playerClass})
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 flex-shrink-0">
          {/* Mobile Prize Ladder Opener Button */}
          <button
            id="mobile-ladder-btn"
            onClick={() => setActiveModal('ladder')}
            className="lg:hidden h-8 px-2 sm:h-9 sm:px-3 rounded-full border border-yellow-400/60 bg-yellow-950/40 flex items-center gap-1 text-yellow-300 hover:bg-yellow-900/60 active:scale-95 transition-all text-xs font-bold shadow-md cursor-pointer"
            title="Xem bảng tiền thưởng"
          >
            <Trophy size={13} className="text-yellow-400" />
            <span className="text-[11px] sm:text-xs hidden xs:inline">{PRIZE_LIST[currentQIndex]}</span>
          </button>

          {/* Sound Toggle */}
          <button 
            id="sound-toggle-playing"
            onClick={toggleSound}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-blue-400/30 bg-slate-800/80 flex items-center justify-center text-yellow-400 hover:bg-slate-700 active:scale-95 transition-all shadow-md flex-shrink-0 cursor-pointer"
            title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Lifelines Group */}
          <div className="flex space-x-1 sm:space-x-1.5">
            {/* 50:50 Lifeline */}
            <button 
              id="lifeline-fifty-fifty"
              disabled={!lifelines.fiftyFifty || isAnswerLocked}
              onClick={useFiftyFifty}
              title="Trợ giúp 50:50 (Loại bỏ 2 phương án sai)"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center font-black text-[10px] sm:text-xs transition-all shadow-md ${
                lifelines.fiftyFifty 
                  ? 'border-yellow-400 bg-blue-950/80 text-yellow-400 hover:bg-blue-800 active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                  : 'border-gray-600 bg-gray-900/80 text-gray-600 opacity-40 relative cursor-not-allowed'
              }`}
            >
              {!lifelines.fiftyFifty && <div className="absolute w-full h-[2px] bg-red-500 rotate-45"></div>}
              50:50
            </button>
            
            {/* Ask Audience Lifeline */}
            <button 
              id="lifeline-ask-audience"
              disabled={!lifelines.askAudience || isAnswerLocked}
              onClick={useAskAudience}
              title="Hỏi ý kiến khán giả trong trường quay"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all shadow-md ${
                lifelines.askAudience 
                  ? 'border-yellow-400 bg-blue-950/80 text-yellow-400 hover:bg-blue-800 active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                  : 'border-gray-600 bg-gray-900/80 text-gray-600 opacity-40 relative cursor-not-allowed'
              }`}
            >
              {!lifelines.askAudience && <div className="absolute w-full h-[2px] bg-red-500 rotate-45"></div>}
              <Users size={14} />
            </button>
            
            {/* Call Friend Lifeline */}
            <button 
              id="lifeline-call-friend"
              disabled={!lifelines.callFriend || isAnswerLocked}
              onClick={useCallFriend}
              title="Gọi điện thoại cho người thân / bạn học giỏi"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all shadow-md ${
                lifelines.callFriend 
                  ? 'border-yellow-400 bg-blue-950/80 text-yellow-400 hover:bg-blue-800 active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                  : 'border-gray-600 bg-gray-900/80 text-gray-600 opacity-40 relative cursor-not-allowed'
              }`}
            >
              {!lifelines.callFriend && <div className="absolute w-full h-[2px] bg-red-500 rotate-45"></div>}
              <Phone size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Stage */}
      <div className="flex-1 relative z-10 flex flex-col lg:flex-row w-full overflow-hidden">
        
        {/* Left Side: Question and Answers Area */}
        <div className="flex-1 flex flex-col justify-between items-center px-3 sm:px-6 md:px-12 py-2 sm:py-5 space-y-2.5 sm:space-y-4 h-full overflow-y-auto">
          
          {/* Progress Banner, Countdown & Current Prize Indicator */}
          <div className="flex items-center justify-between w-full max-w-3xl text-xs">
            <div className="flex items-center space-x-1.5 sm:space-x-2 bg-blue-900/40 px-2.5 sm:px-3 py-1 rounded-full border border-blue-400/40">
              <span className="text-yellow-400 font-bold uppercase tracking-wider text-[10px] sm:text-xs">
                CÂU {String(currentQIndex + 1).padStart(2, '0')} / 15
              </span>
              {SAFE_HAVEN_INDICES.includes(currentQIndex) && (
                <span className="text-[9px] sm:text-[10px] bg-yellow-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full uppercase">
                  MỐC AN TOÀN 🏆
                </span>
              )}
            </div>

            {/* Middle: 60s Countdown indicator */}
            {isCountdownEnabled && (
              <div className={`flex items-center gap-1.5 px-3 py-0.5 rounded-full border font-mono font-bold text-xs ${
                questionCountdown <= 10 
                  ? 'bg-red-950/80 border-red-500 text-red-400 animate-pulse' 
                  : 'bg-slate-900/70 border-blue-400/30 text-yellow-300'
              }`}>
                <Timer size={13} className={questionCountdown <= 10 ? 'text-red-400' : 'text-yellow-400'} />
                <span>{questionCountdown}s</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="text-[10px] sm:text-xs text-yellow-300 font-bold bg-slate-900/70 px-2.5 sm:px-3 py-1 rounded-full border border-yellow-500/30">
                Thưởng: <span className="text-white font-extrabold">{PRIZE_LIST[currentQIndex]} đ</span>
              </div>
            </div>
          </div>

          {/* Countdown Progress Line Bar */}
          {isCountdownEnabled && (
            <div className="w-full max-w-3xl h-1 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                  questionCountdown <= 10 ? 'bg-red-500' : (questionCountdown <= 25 ? 'bg-amber-400' : 'bg-blue-400')
                }`}
                style={{ width: `${(questionCountdown / QUESTION_TIME_LIMIT) * 100}%` }}
              />
            </div>
          )}

          {/* Question Box */}
          <motion.div 
            key={`q-${currentQIndex}`}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-3xl my-auto"
          >
            {/* Desktop Connectors */}
            <div className="hidden md:block absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-[2px] bg-blue-400/80 shadow-[0_0_10px_#60a5fa]"></div>
            <div className="hidden md:block absolute -right-5 top-1/2 -translate-y-1/2 w-10 h-[2px] bg-blue-400/80 shadow-[0_0_10px_#60a5fa]"></div>
            
            <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 border-2 border-blue-400/80 py-3.5 sm:py-5 md:py-7 px-4 sm:px-6 md:px-8 text-center rounded-2xl sm:rounded-[28px] shadow-[0_0_35px_rgba(30,58,138,0.7)] relative overflow-hidden">
              <h2 className="text-sm sm:text-base md:text-xl font-medium leading-relaxed drop-shadow-md text-slate-100 break-words">
                <Latex>{currentQ.question}</Latex>
              </h2>
            </div>
          </motion.div>

          {/* Answer Confirmation Bar when user picked an option */}
          <AnimatePresence>
            {selectedAnswer !== null && !isAnswerLocked && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="w-full max-w-3xl bg-amber-500/10 border border-amber-400/50 p-2 sm:p-2.5 rounded-xl flex items-center justify-between gap-2 shadow-lg"
              >
                <div className="text-xs text-amber-200 flex items-center gap-1.5 truncate">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0">
                    {['A', 'B', 'C', 'D'][selectedAnswer]}
                  </span>
                  <span className="truncate">Bạn đã chọn đáp án <strong>{['A', 'B', 'C', 'D'][selectedAnswer]}</strong>. Bạn có chắc chắn không?</span>
                </div>
                <button
                  id="confirm-lock-btn"
                  onClick={() => confirmLockAnswer(selectedAnswer)}
                  className="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer flex-shrink-0"
                >
                  <Lock size={12} /> Chốt đáp án
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result Alert Announcement */}
          {showResultStatus !== 'none' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`w-full max-w-3xl py-2 px-3 rounded-xl border text-center font-bold text-xs sm:text-sm flex items-center justify-center gap-2 ${
                showResultStatus === 'correct' 
                  ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.4)]' 
                  : 'bg-red-950/90 border-red-500 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
              }`}
            >
              {showResultStatus === 'correct' ? (
                <>
                  <Check size={18} className="text-emerald-400" />
                  <span>CHÍNH XÁC! Chúc mừng bạn đã vượt qua câu {currentQIndex + 1}!</span>
                </>
              ) : (
                <>
                  <X size={18} className="text-red-400" />
                  <span>
                    {isTimedOut 
                      ? `HẾT THỜI GIAN! Đáp án đúng là ${['A', 'B', 'C', 'D'][currentQ.correctAnswerIndex]}. CUỘC CHƠI KẾT THÚC!` 
                      : `RẤT TIẾC, ĐÁP ÁN ĐÚNG LÀ ${['A', 'B', 'C', 'D'][currentQ.correctAnswerIndex]}! CUỘC CHƠI KẾT THÚC!`}
                  </span>
                </>
              )}
            </motion.div>
          )}

          {/* Answers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 w-full max-w-4xl pb-1">
            {currentQ.options.map((opt, idx) => {
              const optionLabels = ['A', 'B', 'C', 'D'];
              const isHidden = hiddenOptions.includes(idx);
              const isSelected = selectedAnswer === idx;
              const isCorrectAnswer = currentQ.correctAnswerIndex === idx;
              
              let wrapperClass = "group relative flex items-center w-full transition-all ";
              let lineClass = "hidden md:block absolute -left-4 w-6 h-[2px] z-10 transition-colors ";
              let btnClass = "w-full py-2.5 sm:py-3 px-3 sm:px-5 rounded-xl sm:rounded-full text-left transition-all text-xs sm:text-sm md:text-base relative z-20 flex items-center cursor-pointer min-h-[46px] ";
              
              if (isHidden) {
                wrapperClass += "opacity-0 pointer-events-none";
              } else if (!isAnswerLocked) {
                if (isSelected) {
                  // Chosen, awaiting confirmation
                  lineClass += "bg-amber-400";
                  btnClass += "bg-gradient-to-r from-amber-600 to-yellow-500 border-2 border-white text-slate-950 font-bold shadow-[0_0_20px_rgba(245,158,11,0.6)]";
                } else {
                  lineClass += "bg-blue-400 group-hover:bg-yellow-400";
                  btnClass += "bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 border border-blue-400/60 hover:bg-yellow-500 hover:border-white hover:text-black active:scale-[0.99] shadow-md hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]";
                }
              } else if (isSelected && showResultStatus === 'none') {
                // Locked answer, dramatic pulse
                lineClass += "bg-yellow-400";
                btnClass += "bg-gradient-to-r from-yellow-500 to-yellow-600 border-2 border-white text-slate-950 font-black shadow-[0_0_25px_rgba(234,179,8,0.7)] animate-pulse";
              } else if (showResultStatus !== 'none') {
                if (isCorrectAnswer) {
                  lineClass += "bg-green-400";
                  btnClass += "bg-gradient-to-r from-green-600 to-green-500 border-2 border-white text-white shadow-[0_0_30px_rgba(34,197,94,0.7)] font-bold";
                } else if (isSelected && showResultStatus === 'wrong') {
                  lineClass += "bg-red-500";
                  btnClass += "bg-gradient-to-r from-red-600 to-red-500 border-2 border-white text-white shadow-[0_0_25px_rgba(239,68,68,0.7)]";
                } else {
                  lineClass += "bg-blue-950/40";
                  btnClass += "bg-blue-950/40 border border-blue-900/30 text-white/35 cursor-not-allowed";
                }
              }

              return (
                <motion.button
                  key={`opt-${idx}`}
                  id={`option-button-${idx}`}
                  disabled={isAnswerLocked || isHidden}
                  onClick={() => handleSelectAnswer(idx)}
                  onMouseEnter={() => !isAnswerLocked && audio.playHover()}
                  className={wrapperClass}
                  style={{
                    animation: (isSelected && showResultStatus === 'wrong') ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none'
                  }}
                >
                  <div className={lineClass}></div>
                  <div className={btnClass}>
                    <span className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mr-2 font-black text-xs border ${
                      isSelected && !isAnswerLocked 
                        ? 'bg-slate-950 text-yellow-400 border-white' 
                        : 'bg-blue-950/80 border-blue-400/50 text-yellow-400 group-hover:bg-yellow-400 group-hover:text-slate-950 group-hover:border-white'
                    }`}>
                      {optionLabels[idx]}
                    </span>
                    <span className="font-medium break-words flex-1 leading-snug"><Latex>{opt}</Latex></span>
                    
                    {isSelected && !isAnswerLocked && (
                      <span className="ml-1 text-[10px] font-bold text-slate-950 bg-white/70 px-1.5 py-0.5 rounded uppercase">
                        Chạm để chốt
                      </span>
                    )}
                    {showResultStatus !== 'none' && isCorrectAnswer && (
                      <Check size={18} className="ml-2 text-white flex-shrink-0" />
                    )}
                    {showResultStatus === 'wrong' && isSelected && (
                      <X size={18} className="ml-2 text-white flex-shrink-0" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Bottom Control Bar in Game area */}
          <div className="w-full max-w-4xl flex justify-between items-center pt-0.5">
            {showResultStatus !== 'none' ? (
              <motion.button
                id="view-detailed-solution-btn"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setActiveModal('solution')}
                className="flex items-center space-x-1.5 bg-blue-900/80 hover:bg-blue-800 border border-blue-400/50 px-3 py-1.5 rounded-xl text-yellow-300 hover:text-white transition-all cursor-pointer shadow-md text-xs font-bold active:scale-95"
              >
                <Lightbulb size={14} className="text-yellow-400" />
                <span>Xem lời giải chi tiết</span>
              </motion.button>
            ) : (
              <div className="text-[10px] text-blue-400/70 font-medium truncate flex items-center gap-1">
                <span>GV Mr Thanh btx &bull; Toán 11 Lượng Giác</span>
              </div>
            )}

            {/* Dừng cuộc chơi button (Authentic Millionaire Rule) */}
            <button
              id="stop-game-mobile-btn"
              disabled={isAnswerLocked}
              onClick={() => setActiveModal('stopConfirm')}
              className={`text-[11px] text-red-300 hover:text-white border border-red-500/40 bg-red-950/40 hover:bg-red-900/60 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all font-semibold cursor-pointer ${
                isAnswerLocked ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              Dừng cuộc chơi
            </button>
          </div>

        </div>
          
        {/* Right Side: Score Ladder (15 steps) on Desktop */}
        <div className="hidden lg:flex flex-1 bg-black/40 border-l border-blue-900/70 p-4 flex-col justify-between overflow-y-auto min-w-[270px] max-w-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-center text-blue-300/80 mb-2">
            Bảng Tiền Thưởng (15 Mốc)
          </div>

          <div className="space-y-1 flex flex-col-reverse h-full justify-end">
            {PRIZE_LIST.map((prize, i) => {
              const isCurrent = i === currentQIndex;
              const isPassed = i < currentQIndex;
              const isSafeHaven = SAFE_HAVEN_INDICES.includes(i);
              
              let itemClass = "flex items-center justify-between px-3 py-1 rounded-lg text-xs font-semibold transition-all ";
              let spanNumClass = "w-5 text-right mr-2 ";
              let spanLineClass = "flex-1 border-b mx-2 ";
              let spanPrizeClass = "font-mono ";
              
              if (isCurrent) {
                itemClass += "bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.6)]";
                spanLineClass += "border-white/40";
                spanPrizeClass += "text-white font-black";
              } else if (isPassed) {
                itemClass += "text-amber-400 bg-amber-950/20";
                spanLineClass += "border-amber-400/20";
              } else if (isSafeHaven) {
                itemClass += "bg-white/10 text-white font-bold border border-white/20";
                spanLineClass += "border-white/30";
                spanPrizeClass += "text-yellow-300";
              } else {
                itemClass += "text-slate-500";
                spanNumClass += "text-slate-500";
                spanLineClass += "border-slate-800";
                spanPrizeClass += "italic";
              }

              return (
                <div key={i} className={itemClass}>
                  <span className={spanNumClass}>{i + 1}</span>
                  <span className={spanLineClass}></span>
                  <span className={spanPrizeClass}>{prize} đ</span>
                  {isSafeHaven && <span className="ml-1 text-[10px]">🏆</span>}
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-blue-900/50">
            <button 
              id="stop-game-desktop-btn"
              disabled={isAnswerLocked}
              onClick={() => setActiveModal('stopConfirm')}
              className={`w-full py-2 bg-red-950/50 hover:bg-red-900/70 border border-red-500/40 text-red-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer active:scale-95 ${
                isAnswerLocked ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              DỪNG CUỘC CHƠI & BẢO TOÀN THƯỞNG
            </button>
          </div>
        </div>
      </div>

      {/* Modals Overlay */}
      <AnimatePresence>
        {activeModal !== 'none' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 text-left"
          >
            <motion.div 
              initial={{ scale: 0.92, y: 15 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.92, y: 15 }}
              className="bg-slate-900 border-2 border-blue-400/80 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 w-full max-w-md relative max-h-[90vh] flex flex-col"
            >
              <button 
                id="modal-close-button"
                onClick={() => setActiveModal('none')}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>

              {/* Modal: Mobile Prize Ladder */}
              {activeModal === 'ladder' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <h3 className="text-base sm:text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
                    <Trophy className="text-yellow-400" size={18} /> Bảng Tiền Thưởng (15 Mốc)
                  </h3>
                  <div className="space-y-1 overflow-y-auto my-2 flex-1 pr-1 flex flex-col-reverse justify-end max-h-[60vh]">
                    {PRIZE_LIST.map((prize, i) => {
                      const isCurrent = i === currentQIndex;
                      const isPassed = i < currentQIndex;
                      const isSafeHaven = SAFE_HAVEN_INDICES.includes(i);
                      
                      let itemClass = "flex items-center justify-between px-3 py-1 rounded-lg text-xs font-semibold ";
                      if (isCurrent) {
                        itemClass += "bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black";
                      } else if (isPassed) {
                        itemClass += "text-amber-400 bg-amber-950/30";
                      } else if (isSafeHaven) {
                        itemClass += "bg-white/10 text-yellow-300 font-bold border border-white/20";
                      } else {
                        itemClass += "text-slate-500";
                      }

                      return (
                        <div key={i} className={itemClass}>
                          <span className="w-5 text-right font-bold">{i + 1}</span>
                          <span className="flex-1 border-b border-slate-700 mx-2"></span>
                          <span className="font-mono">{prize} đ</span>
                          {isSafeHaven && <span className="ml-1.5 text-[10px]">🏆</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-2 border-t border-slate-700 flex gap-2">
                    <button 
                      onClick={() => setActiveModal('none')}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button 
                      disabled={isAnswerLocked}
                      onClick={() => {
                        setActiveModal('none');
                        setTimeout(() => setActiveModal('stopConfirm'), 100);
                      }}
                      className="flex-1 py-2 bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-500/40 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Dừng chơi
                    </button>
                  </div>
                </div>
              )}

              {/* Modal: Ask Audience */}
              {activeModal === 'audience' && (
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
                    <Users className="text-yellow-400" size={18} /> Khán giả trường quay
                  </h3>
                  <div className="flex h-36 sm:h-44 items-end justify-around gap-2 border-b border-slate-700 pb-2 pt-4">
                    {['A', 'B', 'C', 'D'].map((label, idx) => (
                      <div key={label} className="flex flex-col items-center w-10 sm:w-12">
                        <div className="text-[11px] sm:text-xs font-bold text-yellow-300 mb-1">{audienceData[idx]}%</div>
                        <div 
                          className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t-md transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                          style={{ height: `${Math.max(4, audienceData[idx] * 1.3)}px` }}
                        ></div>
                        <div className="mt-1.5 font-black text-white bg-slate-800 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border border-blue-400/40 text-xs sm:text-sm">
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-200 mt-3 text-center leading-relaxed">
                    Số đông nghiêng về phương án có phần trăm cao nhất. Hãy cân nhắc kỹ trước khi chốt đáp án!
                  </p>
                </div>
              )}

              {/* Modal: Call a Friend */}
              {activeModal === 'friend' && (
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
                    <Phone className="text-yellow-400" size={18} /> Gọi điện thoại người thân
                  </h3>
                  <div className="bg-slate-800/80 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-400/40 text-blue-100 leading-relaxed text-xs sm:text-sm relative">
                    <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-slate-700/60 text-xs font-bold text-yellow-400">
                      <GraduationCap size={15} /> Bạn học cùng lớp tư vấn:
                    </div>
                    {friendMessage}
                  </div>
                </div>
              )}

              {/* Modal: Solution */}
              {activeModal === 'solution' && (
                <div className="flex flex-col h-full">
                  <h3 className="text-base sm:text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
                    <Lightbulb className="text-yellow-400" size={18} /> Lời giải chi tiết - Câu {currentQIndex + 1}
                  </h3>
                  <div className="bg-slate-800/80 p-3.5 rounded-xl border border-blue-400/40 text-blue-100 leading-relaxed text-xs sm:text-sm max-h-64 sm:max-h-72 overflow-y-auto">
                    <div className="mb-2 font-semibold text-white break-words">
                      <Latex>{currentQ.question}</Latex>
                    </div>
                    <div className="pt-2 border-t border-slate-700/60 text-yellow-100 break-words">
                      <Latex>{currentQ.solution}</Latex>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal: Voluntary Stop Confirmation */}
              {activeModal === 'stopConfirm' && (
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="text-red-400" size={18} /> Xác nhận dừng cuộc chơi
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mb-3 leading-relaxed">
                    Bạn đang ở câu số <strong className="text-white">{currentQIndex + 1}</strong>. Nếu quyết định dừng cuộc chơi tại đây, bạn sẽ bảo toàn được số tiền thưởng của câu trước:
                  </p>
                  <div className="text-center bg-slate-800 p-2.5 sm:p-3 rounded-xl border border-yellow-500/40 mb-4">
                    <span className="text-xl sm:text-2xl font-black text-yellow-400">
                      {currentQIndex > 0 ? PRIZE_LIST[currentQIndex - 1] : "0"} VNĐ
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setActiveModal('none')}
                      className="flex-1 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                    >
                      Tiếp tục thi
                    </button>
                    <button 
                      onClick={handleStopGame}
                      className="flex-1 py-2 sm:py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-lg cursor-pointer"
                    >
                      Dừng & Nhận thưởng
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shake animation stylesheet */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}} />
      {/* Google Sheet Integration Modal */}
      <GoogleSheetModal 
        isOpen={isGoogleSheetModalOpen} 
        onClose={() => setIsGoogleSheetModalOpen(false)} 
      />
    </div>
  );
}
