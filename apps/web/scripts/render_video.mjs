import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8999;
const OUT_PATH = path.join(__dirname, '..', 'public', 'videos', 'bench-press-technique.webm');

const HTML_CONTENT = `<!DOCTYPE html>
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

    // Load poster image to draw background / athlete backdrop
    const posterImg = new Image();
    posterImg.crossOrigin = "anonymous";
    posterImg.src = "/bench-press-poster.jpg";

    posterImg.onload = () => {
      startRecording();
    };

    posterImg.onerror = () => {
      startRecording();
    };

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
        await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: buffer
        });
        console.log("DONE");
      };

      recorder.start();

      const TOTAL_DURATION = 5000; // 5 seconds loop
      const startTime = performance.now();

      function render(now) {
        const elapsed = (now - startTime) % TOTAL_DURATION;
        const t = elapsed / TOTAL_DURATION; // 0..1

        // Background
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, W, H);

        if (posterImg.complete && posterImg.naturalWidth > 0) {
          ctx.globalAlpha = 0.85;
          ctx.drawImage(posterImg, 0, 0, W, H);
          ctx.globalAlpha = 1.0;
        }

        // Overlay stylized gym gradient
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, 'rgba(10, 15, 26, 0.4)');
        grad.addColorStop(0.7, 'rgba(10, 15, 26, 0.2)');
        grad.addColorStop(1, 'rgba(7, 9, 14, 0.9)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Barbell trajectory math
        // Phase 1 (0..0.15): Lockout hold
        // Phase 2 (0.15..0.55): Descent (Excentric)
        // Phase 3 (0.55..0.68): Chest touch pause
        // Phase 4 (0.68..0.92): Explosive press (Concentric)
        // Phase 5 (0.92..1.0): Lockout reset
        let barYNorm = 0; // 0 = high (lockout), 1 = low (chest)
        let phaseName = "1. INICIO Y RETRACCIÓN";
        let phaseColor = "#5ab9fc";
        let phaseSec = "0s";
        let speed = "0.0 m/s";

        if (t < 0.15) {
          barYNorm = 0;
          phaseName = "1. BLOQUEO Y RETRACCIÓN ESCAPULAR";
          phaseColor = "#5ab9fc";
          phaseSec = "Prep";
          speed = "0.0 m/s";
        } else if (t < 0.55) {
          const p = (t - 0.15) / 0.40;
          // ease-in-out descent
          barYNorm = 0.5 - 0.5 * Math.cos(p * Math.PI);
          phaseName = "2. FASE EXCÉNTRICA (BAJADA CONTROLADA)";
          phaseColor = "#ffb020";
          phaseSec = (p * 2.5).toFixed(1) + "s";
          speed = "0.22 m/s";
        } else if (t < 0.68) {
          barYNorm = 1;
          phaseName = "3. PAUSA EN PECHO (SIN REBOTAR)";
          phaseColor = "#ff5722";
          phaseSec = "0.5s";
          speed = "0.0 m/s";
        } else if (t < 0.92) {
          const p = (t - 0.68) / 0.24;
          // fast explosive press (ease out)
          barYNorm = 1 - Math.sin(p * Math.PI * 0.5);
          phaseName = "4. FASE CONCÉNTRICA (EMPUJE EXPLOSIVO)";
          phaseColor = "#10b981";
          phaseSec = (p * 1.0).toFixed(1) + "s";
          speed = "0.58 m/s";
        } else {
          barYNorm = 0;
          phaseName = "5. BLOQUEO ARTICULAR & AIRE";
          phaseColor = "#5ab9fc";
          phaseSec = "Lockout";
          speed = "0.0 m/s";
        }

        // Draw HUD overlay
        // Header bar
        ctx.fillStyle = 'rgba(13, 19, 34, 0.85)';
        ctx.fillRect(40, 36, 520, 68);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(40, 36, 520, 68);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText("PRESS DE BANCA CON BARRA", 60, 68);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText("Guía Biomecánica Oficial • StudentOS Gym Engine", 60, 92);

        // Phase badge
        ctx.fillStyle = phaseColor;
        ctx.fillRect(40, 120, 480, 44);
        ctx.fillStyle = '#0a0d14';
        ctx.font = 'bold 15px monospace';
        ctx.fillText(phaseName, 56, 148);

        // Trajectory tracking visualizer on right side
        const boxX = W - 320, boxY = 40, boxW = 280, boxH = 400;
        ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText("TRAYECTORIA Y PARÁMETROS", boxX + 20, boxY + 32);

        // Vertical path line
        const pathLineX = boxX + 60;
        const pathTopY = boxY + 70;
        const pathBottomY = boxY + 310;

        ctx.beginPath();
        ctx.moveTo(pathLineX, pathTopY);
        ctx.lineTo(pathLineX + 15, pathBottomY); // slight natural diagonal path
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 4;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated barbell tracker dot
        const currentDotY = pathTopY + barYNorm * (pathBottomY - pathTopY);
        const currentDotX = pathLineX + barYNorm * 15;

        // Glow
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

        // Target points labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText("Bloqueo (Lockout)", pathLineX + 30, pathTopY + 5);
        ctx.fillText("Esternón (Pecho)", pathLineX + 45, pathBottomY + 5);

        // Telemetry stats
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '13px monospace';
        ctx.fillText("Velocidad: " + speed, boxX + 20, boxY + 350);
        ctx.fillText("Tiempo fase: " + phaseSec, boxX + 20, boxY + 375);

        // Bottom cues banner
        ctx.fillStyle = 'rgba(10, 15, 26, 0.92)';
        ctx.fillRect(40, H - 90, W - 80, 56);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(40, H - 90, W - 80, 56);

        ctx.fillStyle = '#5ab9fc';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText("CLAVE TÉCNICA:", 60, H - 56);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px system-ui, sans-serif';
        const cueText = barYNorm > 0.7 
          ? "Mantén codos a 45-60°, escápulas retraídas y pies haciendo fuerza contra el suelo (Leg Drive)."
          : "Agarre firme, muñecas rectas y trayectoria ligeramente diagonal hacia los ojos al subir.";
        ctx.fillText(cueText, 190, H - 56);

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

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_CONTENT);
  } else if (req.method === 'GET' && req.url === '/bench-press-poster.jpg') {
    const posterPath = path.join(__dirname, '..', 'public', 'bench-press-poster.jpg');
    if (fs.existsSync(posterPath)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      fs.createReadStream(posterPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end();
    }
  } else if (req.method === 'POST' && req.url === '/save') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(OUT_PATH, buffer);
      console.log(`Saved ${buffer.length} bytes to ${OUT_PATH}`);
      res.writeHead(200);
      res.end('OK');
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 500);
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  // Launch Edge headless
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const edge = spawn(edgePath, [
    '--headless',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    `http://localhost:${PORT}/`
  ]);

  edge.on('error', (err) => {
    console.error('Failed to spawn edge:', err);
    server.close();
    process.exit(1);
  });
});
