/**
 * @file JarvisVisualizer.js
 * @brief Professional JARVIS-style circular audio waveform and HUD visualizer for CaseThread.
 * Visualizes real Web Audio API microphone frequency data during speech recognition,
 * animated speech synthesis pulses during playback, and cybernetic orbital status rings.
 * @project CASETHREAD
 */

import React, { useRef, useEffect } from 'react';

export default function JarvisVisualizer({
  state = 'IDLE',
  audioData = null,
  isListening = false,
  isSpeaking = false,
  size = 220,
  onClick = null
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      phaseRef.current += 0.025;
      const phase = phaseRef.current;

      ctx.clearRect(0, 0, width, height);

      // Determine state colors
      let primaryColor = '#38BDF8';   // Default Cyan
      let secondaryColor = '#0284C7';
      let coreGlow = 'rgba(56, 189, 248, 0.15)';

      if (state === 'LISTENING' || isListening) {
        primaryColor = '#06B6D4'; // Electric Cyan
        secondaryColor = '#0891B2';
        coreGlow = 'rgba(6, 182, 212, 0.35)';
      } else if (state === 'SPEAKING' || isSpeaking) {
        primaryColor = '#10B981'; // Emerald Green / Mint
        secondaryColor = '#059669';
        coreGlow = 'rgba(16, 185, 129, 0.35)';
      } else if (state === 'SEARCHING_RECORDS' || state === 'GENERATING_ANSWER') {
        primaryColor = '#818CF8'; // Indigo / Violet
        secondaryColor = '#6366F1';
        coreGlow = 'rgba(129, 140, 248, 0.3)';
      } else if (state === 'ERROR') {
        primaryColor = '#EF4444'; // Crimson
        secondaryColor = '#DC2626';
        coreGlow = 'rgba(239, 68, 68, 0.3)';
      }

      // 1. Draw outer dashed HUD radar ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(phase * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.restore();

      // 2. Draw rotating segment arcs
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-phase * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, radius - 8, 0, Math.PI * 0.8);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 8]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius - 8, Math.PI, Math.PI * 1.6);
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 10]);
      ctx.stroke();
      ctx.restore();

      // 3. Draw ambient core breathing glow
      const breath = Math.sin(phase * 2) * 4;
      const coreRadius = Math.max(10, radius * 0.42 + (isListening || isSpeaking ? breath * 1.5 : breath));

      const radialGradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, coreRadius * 1.4);
      radialGradient.addColorStop(0, primaryColor);
      radialGradient.addColorStop(0.5, coreGlow);
      radialGradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = radialGradient;
      ctx.fill();

      // 4. Draw Audio Waveform or Activity Bars
      const numBars = 32;
      const barBaseRadius = radius * 0.58;
      const angleStep = (Math.PI * 2) / numBars;

      for (let i = 0; i < numBars; i++) {
        const angle = i * angleStep;
        let barHeight = 4;

        if ((state === 'LISTENING' || isListening) && audioData && audioData.length > 0) {
          // Real microphone frequency data from Web Audio API AnalyserNode
          const dataIndex = Math.floor((i / numBars) * audioData.length);
          const rawVal = audioData[dataIndex] || 0;
          barHeight = Math.max(3, (rawVal / 255) * (radius * 0.38));
        } else if (state === 'SPEAKING' || isSpeaking) {
          // Synthetic audio pulse matching speech cadence
          const wave = Math.sin(phase * 4 + i * 0.35);
          barHeight = Math.max(3, Math.abs(wave) * (radius * 0.28) + 4);
        } else if (state === 'SEARCHING_RECORDS' || state === 'GENERATING_ANSWER') {
          // Rotating scanning beam
          const sweep = Math.sin(phase * 3 - i * 0.2);
          barHeight = Math.max(2, Math.abs(sweep) * (radius * 0.2) + 2);
        } else {
          // Gentle idle tick
          const idleWave = Math.sin(phase + i * 0.5);
          barHeight = Math.max(2, Math.abs(idleWave) * 4 + 2);
        }

        const startX = centerX + Math.cos(angle) * barBaseRadius;
        const startY = centerY + Math.sin(angle) * barBaseRadius;
        const endX = centerX + Math.cos(angle) * (barBaseRadius + barHeight);
        const endY = centerY + Math.sin(angle) * (barBaseRadius + barHeight);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 5. Draw inner tech hub with micro ticks
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Center geometric focal node
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.fillStyle = primaryColor;
      ctx.fill();

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, audioData, isListening, isSpeaking, size]);

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: size,
        height: size,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none'
      }}
      title={onClick ? 'Click to toggle microphone' : undefined}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          display: 'block'
        }}
      />
    </div>
  );
}
