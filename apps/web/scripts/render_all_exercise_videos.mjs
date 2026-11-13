import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8998;
const VIDEOS_DIR = path.join(__dirname, '..', 'public', 'videos');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

const EXERCISES_CONFIG = [
  {
    id: 'bench-press',
    outFile: 'bench-press-technique.webm',
    poster: '/bench-press-poster.jpg',
    title: 'PRESS DE BANCA CON BARRA',
    category: 'Empuje Horizontal • Pectoral, Tríceps & Hombros',
    type: 'bench',
  },
  {
    id: 'squat',
    outFile: 'squat-technique.webm',
    poster: '/squat-poster.jpg',
    title: 'SENTADILLA LIBRE CON BARRA (SQUAT)',
    category: 'Dominancia de Rodilla • Cuádriceps, Glúteos & Core',
    type: 'squat',
  },
  {
    id: 'pullup',
    outFile: 'pullup-technique.webm',
    poster: '/pullup-poster.jpg',
    title: 'DOMINADAS CON LASTRE / JALÓN',
    category: 'Tracción Vertical • Dorsal Ancho & Bíceps',
    type: 'pullup',
  },
  {
    id: 'cardio',
    outFile: 'cardio-mobility-technique.webm',
    poster: '/cardio-poster.jpg',
    title: 'CAMINATA INCLINADA & RECUPERACIÓN',
    category: 'Zona 2 Cardiovascular • Movilidad Articular',
    type: 'cardio',
  },
];

let currentIndex = 0;

function generateHtml(ex) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; background: #07090e; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    canvas { display: block; width: 1280px; height: 720px; }
  </style>
</head>
<body>
  <canvas id="cv" width="1280" height="720"></canvas>
  <script>
    const canvas = document.getElementById('cv');
    const ctx = canvas.getContext('2d');
    const W = 1280, H = 720;
    const exType = "${ex.type}";

    const posterImg = new Image();
    posterImg.crossOrigin = "anonymous";
    posterImg.src = "${ex.poster}";

    posterImg.onload = () => startRecording();
    posterImg.onerror = () => startRecording();

    function startRecording() {
      const stream = canvas.captureStream(30);
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const buffer = await blob.arrayBuffer();
        await fetch('/save?exercise=${ex.id}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: buffer
        });
        console.log("SAVED_${ex.id}");
      };

      recorder.start();

      const TOTAL_DURATION = 5000;
      const startTime = performance.now();

      function render(now) {
        const elapsed = (now - startTime) % TOTAL_DURATION;
        const t = elapsed / TOTAL_DURATION; // 0..1

        // Background
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, W, H);

        if (posterImg.complete && posterImg.naturalWidth > 0) {
          ctx.globalAlpha = 0.50;
          ctx.drawImage(posterImg, 0, 0, W, H);
          ctx.globalAlpha = 1.0;
        }

        // Overlay vignette gradient
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, 'rgba(10, 15, 26, 0.7)');
        grad.addColorStop(0.5, 'rgba(10, 15, 26, 0.45)');
        grad.addColorStop(1, 'rgba(7, 9, 14, 0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Biomechanical Repetition Phase Math
        // Phase 1 (0..0.12): Setup & Inhale
        // Phase 2 (0.12..0.52): Controlled Excentric (bajada)
        // Phase 3 (0.52..0.66): Bottom isometric pause
        // Phase 4 (0.66..0.90): Explosive Concentric (subida)
        // Phase 5 (0.90..1.0): Lockout & reset
        let normY = 0; // 0 = start/lockout, 1 = max stretch/inflection
        let phaseText = "1. INICIO Y ESTABILIZACIÓN";
        let phaseColor = "#5ab9fc";
        let phaseDuration = "Setup";
        let speedMps = "0.0 m/s";
        let cueText = "";

        if (t < 0.12) {
          normY = 0;
          phaseText = "1. ESTABILIZACIÓN Y AIRE (VALSALVA)";
          phaseColor = "#5ab9fc";
          phaseDuration = "0s";
          speedMps = "0.0 m/s";
          cueText = "Activa el core, inhala profundo y fija los puntos de apoyo.";
        } else if (t < 0.52) {
          const p = (t - 0.12) / 0.40;
          normY = 0.5 - 0.5 * Math.cos(p * Math.PI);
          phaseText = "2. FASE EXCÉNTRICA (BAJADA CONTROLADA)";
          phaseColor = "#ffb020";
          phaseDuration = (p * 2.5).toFixed(1) + "s";
          speedMps = "0.24 m/s";
          cueText = "Controla el descenso en 2-3 seg. No dejes caer el peso por gravedad.";
        } else if (t < 0.66) {
          normY = 1.0;
          phaseText = "3. PAUSA ISOMÉTRICA (MÁXIMA TENSIÓN)";
          phaseColor = "#ff5722";
          phaseDuration = "0.5s";
          speedMps = "0.0 m/s";
          cueText = "Pausa breve con tensión muscular total. Cero rebotes.";
        } else if (t < 0.90) {
          const p = (t - 0.66) / 0.24;
          normY = 1 - Math.sin(p * Math.PI * 0.5);
          phaseText = "4. FASE CONCÉNTRICA (EMPUJE EXPLOSIVO)";
          phaseColor = "#10b981";
          phaseDuration = (p * 1.0).toFixed(1) + "s";
          speedMps = "0.62 m/s";
          cueText = "Empuje potente y continuo. Exhala al superar el punto de estancamiento.";
        } else {
          normY = 0;
          phaseText = "5. BLOQUEO ARTICULAR Y RESPIRACIÓN";
          phaseColor = "#5ab9fc";
          phaseDuration = "Lockout";
          speedMps = "0.0 m/s";
          cueText = "Mantén la rigidez y prepara la siguiente repetición.";
        }

        // ==========================================
        // KINEMATIC ANATOMY & MOTION RENDERING
        // ==========================================
        ctx.save();

        if (exType === 'bench') {
          // Flat Bench station
          const benchY = 480;
          // Bench pad
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(440, benchY, 400, 24);
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.strokeRect(440, benchY, 400, 24);

          // Lifter Torso with powerlifting arch
          const headX = 480, headY = benchY - 18;
          const chestX = 610, chestY = benchY - 26;
          const hipX = 740, hipY = benchY;

          // Head
          ctx.fillStyle = '#f1f5f9';
          ctx.beginPath();
          ctx.arc(headX, headY, 18, 0, Math.PI * 2);
          ctx.fill();

          // Torso line with arch
          ctx.beginPath();
          ctx.moveTo(headX + 12, headY + 5);
          ctx.quadraticCurveTo(chestX, chestY - 14, hipX, hipY);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Planted Leg (hip -> knee -> foot on floor)
          const kneeX = 780, kneeY = benchY + 60;
          const footX = 770, footY = benchY + 120;
          ctx.beginPath();
          ctx.moveTo(hipX, hipY);
          ctx.lineTo(kneeX, kneeY);
          ctx.lineTo(footX, footY);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 10;
          ctx.stroke();

          // Barbell Movement: Bar drops from high (280) to sternum (benchY - 45)
          const barTopY = 280;
          const barBottomY = benchY - 45;
          const currentBarY = barTopY + normY * (barBottomY - barTopY);
          const currentBarX = 610 + normY * 12;

          // Arms: Shoulder -> Elbow -> Hands gripping the bar
          const shoulderX = 540, shoulderY = benchY - 22;
          // Elbow travels down and tucks slightly
          const elbowRestX = 575, elbowRestY = 360;
          const elbowBottomX = 560, elbowBottomY = benchY + 10;
          const elbowX = elbowRestX + normY * (elbowBottomX - elbowRestX);
          const elbowY = elbowRestY + normY * (elbowBottomY - elbowRestY);

          // Arm lines
          ctx.beginPath();
          ctx.moveTo(shoulderX, shoulderY);
          ctx.lineTo(elbowX, elbowY);
          ctx.lineTo(currentBarX, currentBarY);
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 9;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();

          // Barbell Shaft & Plates
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(currentBarX - 140, currentBarY - 5, 280, 10);
          // Olympic Plates (Cyan / Chrome)
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(currentBarX - 120, currentBarY - 42, 22, 84);
          ctx.fillRect(currentBarX + 98, currentBarY - 42, 22, 84);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(currentBarX - 120, currentBarY - 42, 22, 84);
          ctx.strokeRect(currentBarX + 98, currentBarY - 42, 22, 84);

        } else if (exType === 'squat') {
          // Squat Movement: Lifter drops into deep squat below parallel
          const floorY = 580;
          // Floor gym line
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(350, floorY);
          ctx.lineTo(950, floorY);
          ctx.stroke();

          // Motion coordinates
          const standHipY = 380, deepHipY = 485;
          const standHipX = 620, deepHipX = 590; // hips sit back
          const currentHipY = standHipY + normY * (deepHipY - standHipY);
          const currentHipX = standHipX + normY * (deepHipX - standHipX);

          // Barbell drops with torso
          const standBarY = 240, deepBarY = 370;
          const currentBarY = standBarY + normY * (deepBarY - standBarY);
          const currentBarX = 628;

          // Head
          const headY = currentBarY - 18;
          ctx.fillStyle = '#f1f5f9';
          ctx.beginPath();
          ctx.arc(628, headY, 18, 0, Math.PI * 2);
          ctx.fill();

          // Torso (Shoulders/Bar -> Hips)
          ctx.beginPath();
          ctx.moveTo(currentBarX, currentBarY);
          ctx.lineTo(currentHipX, currentHipY);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 16;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Knees & Feet
          const footX = 645, footY = floorY;
          const standKneeX = 640, standKneeY = 480;
          const deepKneeX = 675, deepKneeY = 470; // knees travel slightly forward
          const currentKneeX = standKneeX + normY * (deepKneeX - standKneeX);
          const currentKneeY = standKneeY + normY * (deepKneeY - standKneeY);

          // Thigh (Femur)
          ctx.beginPath();
          ctx.moveTo(currentHipX, currentHipY);
          ctx.lineTo(currentKneeX, currentKneeY);
          ctx.strokeStyle = normY > 0.6 ? '#f97316' : '#0284c7'; // quad tension glow
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Shin (Tibia)
          ctx.beginPath();
          ctx.moveTo(currentKneeX, currentKneeY);
          ctx.lineTo(footX, footY);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 12;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Barbell
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(currentBarX - 160, currentBarY - 6, 320, 12);
          // Olympic Plates
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(currentBarX - 140, currentBarY - 50, 24, 100);
          ctx.fillRect(currentBarX + 116, currentBarY - 50, 24, 100);
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 2;
          ctx.strokeRect(currentBarX - 140, currentBarY - 50, 24, 100);
          ctx.strokeRect(currentBarX + 116, currentBarY - 50, 24, 100);

        } else if (exType === 'pullup') {
          // Pull-up Bar
          const barY = 160;
          ctx.fillStyle = '#475569';
          ctx.fillRect(400, barY - 8, 480, 16);

          // In pull-up: normY = 0 is hang (bottom), normY = 1 is top (chest to bar)
          const hangBodyY = 440;
          const topBodyY = 250;
          const bodyY = hangBodyY - normY * (hangBodyY - topBodyY);
          const bodyX = 640;

          // Head
          ctx.fillStyle = '#f1f5f9';
          ctx.beginPath();
          ctx.arc(bodyX, bodyY - 45, 18, 0, Math.PI * 2);
          ctx.fill();

          // Torso with V-Taper
          ctx.beginPath();
          ctx.moveTo(bodyX, bodyY - 25);
          ctx.lineTo(bodyX, bodyY + 90);
          ctx.strokeStyle = normY > 0.4 ? '#38bdf8' : '#1e293b'; // Lat activation glow
          ctx.lineWidth = 18;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Arms: Hands on bar at (580, barY) & (700, barY) -> Elbows -> Shoulders
          const elbowY = barY + 40 + (1 - normY) * 90;
          const leftElbowX = 540 + normY * 30;
          const rightElbowX = 740 - normY * 30;

          ctx.beginPath();
          // Left arm
          ctx.moveTo(580, barY);
          ctx.lineTo(leftElbowX, elbowY);
          ctx.lineTo(bodyX - 16, bodyY - 20);
          // Right arm
          ctx.moveTo(700, barY);
          ctx.lineTo(rightElbowX, elbowY);
          ctx.lineTo(bodyX + 16, bodyY - 20);
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Legs hanging with knees slightly bent
          ctx.beginPath();
          ctx.moveTo(bodyX, bodyY + 90);
          ctx.lineTo(bodyX + 15, bodyY + 170);
          ctx.lineTo(bodyX + 25, bodyY + 230);
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 12;
          ctx.lineCap = 'round';
          ctx.stroke();

        } else if (exType === 'cardio') {
          // Incline Treadmill Deck (12% slope)
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(420, 570);
          ctx.lineTo(840, 480);
          ctx.stroke();

          // Running / Incline Marching leg stride cycle
          const strideCycle = (t * 8) % 1; // 8 steps in 5 sec
          const legPhase = Math.sin(strideCycle * Math.PI * 2);

          const hipX = 620, hipY = 380;
          // Head & Torso
          ctx.fillStyle = '#f1f5f9';
          ctx.beginPath();
          ctx.arc(626, hipY - 95, 18, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(626, hipY - 75);
          ctx.lineTo(hipX, hipY);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 16;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Left Leg
          const leftFootX = hipX - 45 + legPhase * 40;
          const leftFootY = 535 - legPhase * 15;
          ctx.beginPath();
          ctx.moveTo(hipX, hipY);
          ctx.lineTo(hipX - 15, 450);
          ctx.lineTo(leftFootX, leftFootY);
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 10;
          ctx.stroke();

          // Right Leg
          const rightFootX = hipX + 35 - legPhase * 40;
          const rightFootY = 515 + legPhase * 15;
          ctx.beginPath();
          ctx.moveTo(hipX, hipY);
          ctx.lineTo(hipX + 15, 450);
          ctx.lineTo(rightFootX, rightFootY);
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 10;
          ctx.stroke();

          // Heart rate graph / Zone 2 metric
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 15px monospace';
          ctx.fillText("❤️ 132 BPM (Zona 2 Oxidativa) • Inclinación: +12%", 500, 310);
        }

        ctx.restore();

        // ==========================================
        // HUD OVERLAYS & TELEMETRY
        // ==========================================
        // Header Banner
        ctx.fillStyle = 'rgba(13, 19, 34, 0.90)';
        ctx.fillRect(40, 36, 560, 72);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(40, 36, 560, 72);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText("${ex.title}", 60, 68);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText("${ex.category}", 60, 93);

        // Phase Badge
        ctx.fillStyle = phaseColor;
        ctx.fillRect(40, 122, 500, 42);
        ctx.fillStyle = '#0a0d14';
        ctx.font = 'bold 15px monospace';
        ctx.fillText(phaseText, 56, 149);

        // Right Telemetry Box
        const boxX = W - 320, boxY = 40, boxW = 280, boxH = 400;
        ctx.fillStyle = 'rgba(10, 15, 26, 0.92)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText("BIOMECÁNICA Y TRAYECTORIA", boxX + 20, boxY + 32);

        // Trajectory tracking line
        const pathLineX = boxX + 60;
        const pathTopY = boxY + 70;
        const pathBottomY = boxY + 310;

        ctx.beginPath();
        ctx.moveTo(pathLineX, pathTopY);
        ctx.lineTo(pathLineX + 15, pathBottomY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 4;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated tracker dot
        const currentDotY = pathTopY + normY * (pathBottomY - pathTopY);
        const currentDotX = pathLineX + normY * 15;

        const dotGlow = ctx.createRadialGradient(currentDotX, currentDotY, 2, currentDotX, currentDotY, 18);
        dotGlow.addColorStop(0, phaseColor);
        dotGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = dotGlow;
        ctx.beginPath();
        ctx.arc(currentDotX, currentDotY, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = phaseColor;
        ctx.beginPath();
        ctx.arc(currentDotX, currentDotY, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText("Extensión / Lockout", pathLineX + 30, pathTopY + 5);
        ctx.fillText("Máxima Profundidad", pathLineX + 45, pathBottomY + 5);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '13px monospace';
        ctx.fillText("Velocidad: " + speedMps, boxX + 20, boxY + 350);
        ctx.fillText("Tiempo fase: " + phaseDuration, boxX + 20, boxY + 375);

        // Bottom Cues Banner
        ctx.fillStyle = 'rgba(10, 15, 26, 0.94)';
        ctx.fillRect(40, H - 86, W - 80, 56);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.strokeRect(40, H - 86, W - 80, 56);

        ctx.fillStyle = '#5ab9fc';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText("PAUTA BIOMECÁNICA:", 60, H - 52);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText(cueText, 235, H - 52);

        if (now - startTime < TOTAL_DURATION) {
          requestAnimationFrame(render);
        } else {
          recorder.stop();
        }
      }

      requestAnimationFrame(render);
    }
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/') {
    const exId = url.searchParams.get('exercise') || EXERCISES_CONFIG[currentIndex].id;
    const exConfig = EXERCISES_CONFIG.find(c => c.id === exId) || EXERCISES_CONFIG[0];
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(generateHtml(exConfig));
  } else if (url.pathname.endsWith('.jpg')) {
    const filePath = path.join(PUBLIC_DIR, path.basename(url.pathname));
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end();
    }
  } else if (url.pathname === '/save') {
    const exId = url.searchParams.get('exercise');
    const exConfig = EXERCISES_CONFIG.find(c => c.id === exId);
    const outFile = exConfig ? exConfig.outFile : `${exId}-technique.webm`;
    const outPath = path.join(VIDEOS_DIR, outFile);

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(outPath, buffer);
      console.log(`[OK] Saved ${buffer.length} bytes to ${outPath}`);
      res.writeHead(200);
      res.end('OK');

      // Proceed to next exercise
      currentIndex += 1;
      if (currentIndex < EXERCISES_CONFIG.length) {
        renderNextExercise();
      } else {
        console.log("All videos generated successfully!");
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 800);
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

let currentEdgeProcess = null;

function renderNextExercise() {
  if (currentIndex >= EXERCISES_CONFIG.length) return;
  const ex = EXERCISES_CONFIG[currentIndex];
  console.log(`Starting render for [${ex.id}] (${currentIndex + 1}/${EXERCISES_CONFIG.length})...`);

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  currentEdgeProcess = spawn(edgePath, [
    '--headless',
    '--disable-gpu',
    `http://localhost:${PORT}/?exercise=${ex.id}`
  ]);

  currentEdgeProcess.on('error', (err) => {
    console.error(`Edge process error on [${ex.id}]:`, err);
  });
}

server.listen(PORT, () => {
  console.log(`Video render server active on port ${PORT}`);
  renderNextExercise();
});
