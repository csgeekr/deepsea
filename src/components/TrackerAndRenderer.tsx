import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { X, HeartPulse, Sparkles, Clock, Zap } from 'lucide-react';
import { CreatureSimulation, EntityType } from '../utils/CreatureSimulation';
import { AudioController } from '../utils/AudioController';

interface Props {
  audioSource: string | null;
  useSynth: boolean;
  onExit: () => void;
  onGameOver: (score: number) => void;
}

export default function TrackerAndRenderer({ audioSource, useSynth, onExit, onGameOver }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayLife, setDisplayLife] = useState(100);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayCombo, setDisplayCombo] = useState(1);
  const [scoreTip, setScoreTip] = useState<{ id: number; text: string; positive: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  
  const lifeRef = useRef(100);
  const scoreRef = useRef(0);
  const comboRef = useRef(1);
  const lastComboAtRef = useRef(0);
  const isGameOverRef = useRef(false);

  const simulationRef = useRef<CreatureSimulation | null>(null);
  const audioControllerRef = useRef<AudioController | null>(null);
  const animationFrameRef = useRef<number>();
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);

  const showScoreTip = (text: string, positive: boolean) => {
    const id = Date.now();
    setScoreTip({ id, text, positive });
    window.setTimeout(() => {
      setScoreTip(current => current?.id === id ? null : current);
    }, 1800);
  };

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        // Init Audio
        const audioController = new AudioController(audioSource);
        await audioController.init();
        audioControllerRef.current = audioController;

        // Init simulation
        if (canvasRef.current) {
          simulationRef.current = new CreatureSimulation(canvasRef.current);
          simulationRef.current.setCollisionCallback((type: EntityType) => {
            if (isGameOverRef.current) return;
            
            const now = performance.now();

            if (type === 'food' || type === 'bonus') {
                comboRef.current = now - lastComboAtRef.current < 2600 ? Math.min(comboRef.current + 1, 8) : 1;
                lastComboAtRef.current = now;

                const baseScore = type === 'bonus' ? 15 : 5;
                const scoreGain = baseScore * comboRef.current;
                scoreRef.current += scoreGain;
                lifeRef.current += type === 'bonus' ? 12 : 5;
                simulationRef.current?.grow();
                if (type === 'bonus') simulationRef.current?.grow();
                showScoreTip(type === 'bonus' ? `能量猎获 +${scoreGain}` : `连击 x${comboRef.current} +${scoreGain}`, true);
            } else if (type === 'dodge') {
                scoreRef.current += 3;
                showScoreTip('擦身闪避 +3', true);
            } else if (type === 'enemy') {
                comboRef.current = 1;
                scoreRef.current -= 8;
                lifeRef.current -= 12;
                simulationRef.current?.shrink();
                showScoreTip('遭遇天敌 -8', false);
            }

            setDisplayLife(lifeRef.current);
            setDisplayScore(scoreRef.current);
            setDisplayCombo(comboRef.current);

            if (lifeRef.current <= -20) {
                isGameOverRef.current = true;
                onGameOver(scoreRef.current);
            }
          });
        }

        // Init Camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
        
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = resolve;
            }
          });
          videoRef.current.play();
        }

        // Init Mediapipe
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });

        if (!active) {
            handLandmarker.close();
            return;
        }

        handLandmarkerRef.current = handLandmarker;
        setIsLoading(false);

        // Start render loop
        let lastVideoTime = -1;
        const renderLoop = () => {
          if (videoRef.current && videoRef.current.readyState >= 2 && handLandmarkerRef.current) {
            const currentTime = videoRef.current.currentTime;
            if (currentTime !== lastVideoTime) {
              const results = handLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
              
              if (results.landmarks && results.landmarks.length > 0) {
                const targets = results.landmarks.map(hand => {
                   const landmark = hand[8];
                   return {
                      x: (1 - landmark.x) * window.innerWidth,
                      y: landmark.y * window.innerHeight
                   };
                });
                
                if (simulationRef.current) {
                  simulationRef.current.setTargets(targets);
                }
              }
              lastVideoTime = currentTime;
            }
          }
          
          if (simulationRef.current) {
            const speed = simulationRef.current.update(scoreRef.current);
            simulationRef.current.draw();
            
            if (audioControllerRef.current) {
              audioControllerRef.current.updateSpeed(speed);
            }
          }

          animationFrameRef.current = requestAnimationFrame(renderLoop);
        };
        
        renderLoop();
        
      } catch (err: any) {
        console.error(err);
        if (active) setError(err.message || 'Failed to initialize camera or AI models.');
      }
    }

    init();

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      active = false;
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
      if (audioControllerRef.current) {
        audioControllerRef.current.dispose();
      }
    };
  }, [audioSource, useSynth]);

  useEffect(() => {
    if (isLoading || error) return;
    
    const interval = setInterval(() => {
      if (isGameOverRef.current) return;
      
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          isGameOverRef.current = true;
          onGameOver(scoreRef.current);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isLoading, error, onGameOver]);

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden">
      {/* Video element for processing */}
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full object-cover opacity-20 transform -scale-x-100 filter blur-xl" 
        playsInline 
        muted 
      />
      
      {/* Canvas for rendering the creature */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen"
      />

      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center flex-col space-y-6 bg-slate-950/80 backdrop-blur-md z-50">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
            </div>
          </div>
          <p className="text-emerald-400 font-medium tracking-widest uppercase text-sm">正在召唤生物...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-md z-50">
          <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl max-w-md text-center space-y-6 shadow-2xl">
            <p className="text-red-400 font-medium">{error}</p>
            <button 
              onClick={onExit} 
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 transition-colors rounded-xl text-white font-medium shadow-lg"
            >
              返回
            </button>
          </div>
        </div>
      )}

      <button 
        onClick={onExit}
        className="absolute top-8 right-8 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-xl border border-white/10 z-50 hover:scale-105 active:scale-95 shadow-2xl"
      >
        <X className="w-6 h-6" />
      </button>

      {!isLoading && !error && (
         <>
           <div className="absolute top-8 left-8 z-50 flex flex-col space-y-3">
              <div className="flex items-center space-x-2 text-white text-xl font-bold drop-shadow-md">
                 <Sparkles className="w-6 h-6 text-yellow-400" />
                 <span>{displayScore} 分</span>
              </div>
              <div className="flex items-center space-x-2 text-white text-xl font-bold drop-shadow-md">
                 <HeartPulse className="w-6 h-6 text-emerald-400" />
                 <span>{displayLife} 生命</span>
              </div>
              <div className="flex items-center space-x-2 text-white text-xl font-bold drop-shadow-md">
                 <Clock className="w-6 h-6 text-cyan-400" />
                 <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </div>
              <div className="flex items-center space-x-2 text-white text-xl font-bold drop-shadow-md">
                 <Zap className="w-6 h-6 text-amber-300" />
                 <span>x{displayCombo} 连击</span>
              </div>
              {scoreTip && (
                <div
                  key={scoreTip.id}
                  className={`absolute left-0 top-full mt-4 inline-flex w-max animate-pulse rounded-full border px-4 py-2 text-sm font-bold shadow-2xl backdrop-blur-md ${scoreTip.positive ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100' : 'border-red-300/40 bg-red-500/20 text-red-100'}`}
                >
                  {scoreTip.text}
                </div>
              )}
           </div>

           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full shadow-2xl pointer-events-none">
             <p className="text-white/80 text-sm font-medium tracking-wide">
                连续捕食提升倍率。金色能量高分回血，贴近躲开天敌可得闪避分。
              </p>
           </div>

           <a
             href="https://beian.miit.gov.cn/"
             target="_blank"
             rel="noreferrer"
             className="absolute bottom-5 left-8 z-50 text-xs text-white/35 transition-colors hover:text-white/70"
           >
             浙ICP备2026032840号-1
           </a>
         </>
      )}
    </div>
  );
}
