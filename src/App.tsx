/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Upload, Play, Volume2, Sparkles, Trophy } from 'lucide-react';
import TrackerAndRenderer from './components/TrackerAndRenderer';

interface ScoreEntry {
  id: string;
  score: number;
  date: string;
}

export default function App() {
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [useSynth, setUseSynth] = useState(false);
  
  const [scores, setScores] = useState<ScoreEntry[]>(() => {
    const saved = localStorage.getItem('abyssal_scores');
    return saved ? JSON.parse(saved) : [];
  });

  const handleGameOver = (finalScore: number) => {
    const newScore = {
      id: Math.random().toString(36).substr(2, 9),
      score: finalScore,
      date: new Date().toLocaleDateString()
    };
    const newScores = [...scores, newScore].sort((a, b) => b.score - a.score);
    setScores(newScores);
    localStorage.setItem('abyssal_scores', JSON.stringify(newScores));
    setStarted(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioSource(url);
      setUseSynth(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans selection:bg-emerald-500/30">
      {!started ? (
        <div className="max-w-md w-full bg-slate-900 p-10 rounded-[2rem] shadow-2xl border border-white/5 space-y-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500"></div>
          
          <div className="space-y-4 text-center">
            <h1 className="text-4xl font-light tracking-tight text-white flex items-center justify-center gap-3">
              <Sparkles className="w-8 h-8 text-emerald-400" />
              深海游弋
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
              通过摄像头使用手势引导程序生成的海洋生物。
            </p>
          </div>
          
          <div className="space-y-5">
            {scores.length > 0 && (
              <div className="w-full bg-slate-950/50 p-5 rounded-2xl border border-white/5">
                <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> 最高得分
                </h3>
                <div className="space-y-2">
                  {scores.slice(0, 3).map((s, i) => (
                    <div key={s.id} className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">
                        <span className="text-emerald-500/70 font-medium mr-2">#{i + 1}</span>
                        {s.date}
                      </span>
                      <span className="text-white font-medium">{s.score} 分</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="flex flex-col items-center justify-center w-full h-32 border border-slate-700 border-dashed rounded-3xl cursor-pointer hover:bg-slate-800/50 hover:border-emerald-500/50 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-3 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                <p className="text-sm text-slate-300 font-medium group-hover:text-emerald-300 transition-colors">上传视频/音频</p>
                <p className="text-xs text-slate-500 mt-2 px-6 text-center">选择您的视频以提取其音频作为背景声（可选）</p>
              </div>
              <input type="file" className="hidden" accept="video/*,audio/*" onChange={handleFileUpload} />
            </label>

            {audioSource && (
              <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <div className="flex items-center space-x-3 text-emerald-400">
                  <Volume2 className="w-5 h-5" />
                  <span className="text-sm font-medium">已加载自定义音频</span>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (!audioSource) setUseSynth(true);
                setStarted(true);
              }}
              className="w-full py-4 px-6 rounded-2xl font-medium transition-all flex items-center justify-center space-x-3 bg-white text-slate-900 hover:bg-emerald-50 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            >
              <Play className="w-5 h-5" />
              <span>{audioSource ? '开始探索' : '使用合成音频开始探索'}</span>
            </button>
          </div>
        </div>
      ) : (
        <TrackerAndRenderer 
          audioSource={audioSource} 
          useSynth={useSynth}
          onExit={() => setStarted(false)}
          onGameOver={handleGameOver}
        />
      )}
      {!started && (
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-slate-500 transition-colors hover:text-slate-300"
        >
          浙ICP备2026032840号-1
        </a>
      )}
    </div>
  );
}
