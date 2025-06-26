interface ScoreBody {
	username: string;
	score: number;
	time: number;
  }

// Cloudflare Worker for Hand-Based AI Fruit Catching Game with Leaderboard
export interface Env {
	DB?: D1Database; // Cloudflare D1 database binding (optional for now)
	LEADERBOARD?: DurableObjectNamespace; // Fallback to Durable Object
  }
  
  export default {
	async fetch(request: Request, env: Env): Promise<Response> {
	  const url = new URL(request.url);
	  
	  if (url.pathname === '/') {
		return new Response(HTML_CONTENT, {
		  headers: { 'Content-Type': 'text/html' }
		});
	  }
	  
	  // API endpoint to save score
	  if (url.pathname === '/api/save-score' && request.method === 'POST') {
		try {
			const body = await request.json() as ScoreBody;
			const { username, score, time } = body;
		  
		  // Validate input
		  if (!username || typeof score !== 'number' || typeof time !== 'number') {
			return new Response('Invalid data', { status: 400 });
		  }
		  
		  // Try D1 first, fallback to in-memory storage for demo
		  if (env.DB) {
			try {
			  // Check if user already exists
			  const existingUser = await env.DB.prepare(
				'SELECT id, score, time FROM leaderboard WHERE username = ? ORDER BY score DESC, time ASC LIMIT 1'
			  ).bind(username.slice(0, 20)).first() as { id: number, score: number, time: number } | undefined;
			  
			  if (existingUser) {
				// User exists - check if this is a better score
				const isBetterScore = score > existingUser.score || 
									 (score === existingUser.score && time < existingUser.time);
				
				if (isBetterScore) {
				  // Update existing record with better score
				  await env.DB.prepare(
					'UPDATE leaderboard SET score = ?, time = ?, date = ? WHERE id = ?'
				  ).bind(score, time, new Date().toISOString(), existingUser.id).run();
				  
				  return new Response('Score updated in D1', { status: 200 });
				} else {
				  // Don't save worse score, but still return success
				  return new Response('Score not better than existing', { status: 200 });
				}
			  } else {
				// New user - insert new record
				await env.DB.prepare(
				  'INSERT INTO leaderboard (username, score, time, date) VALUES (?, ?, ?, ?)'
				).bind(username.slice(0, 20), score, time, new Date().toISOString()).run();
				
				return new Response('New score saved to D1', { status: 200 });
			  }
			} catch (dbError) {
			  console.error('D1 Error:', dbError);
			  // Fall through to demo mode
			}
		  }
		  
		  // Demo mode - just return success without actually saving
		  console.log('Demo mode: Score would be saved:', { username, score, time });
		  return new Response('Score saved (demo mode)', { status: 200 });
		  
		} catch (error) {
		  console.error('Error saving score:', error);
		  return new Response('Error saving score', { status: 500 });
		}
	  }
	  
	  // API endpoint to get leaderboard
	  if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
		try {
		  // Try D1 first
		  if (env.DB) {
			try {
			  const result = await env.DB.prepare(
				'SELECT username, score, time, date FROM leaderboard ORDER BY score DESC, time ASC LIMIT 10'
			  ).all();
			  
			  return new Response(JSON.stringify(result.results), {
				headers: { 'Content-Type': 'application/json' }
			  });
			} catch (dbError) {
			  console.error('D1 Error:', dbError);
			  // Fall through to demo data
			}
		  }
		  
		  // Demo mode - return sample leaderboard data
		  const demoLeaderboard = [
			{ username: "SpeedyHands", score: 20, time: 45, date: "2024-01-15T10:30:00Z" },
			{ username: "FruitMaster", score: 20, time: 52, date: "2024-01-15T11:15:00Z" },
			{ username: "SwipeKing", score: 20, time: 58, date: "2024-01-15T09:45:00Z" },
			{ username: "QuickCatch", score: 19, time: 40, date: "2024-01-14T16:20:00Z" },
			{ username: "HandsOfSteel", score: 18, time: 35, date: "2024-01-14T14:30:00Z" }
		  ];
		  
		  return new Response(JSON.stringify(demoLeaderboard), {
			headers: { 'Content-Type': 'application/json' }
		  });
		  
		} catch (error) {
		  console.error('Error fetching leaderboard:', error);
		  return new Response('Error fetching leaderboard', { status: 500 });
		}
	  }
	  
	  return new Response('Not Found', { status: 404 });
	}
  };
  
  const HTML_CONTENT = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>🤚 AI Hand Fruit Catching Game</title>
	  <style>
		  * { margin: 0; padding: 0; box-sizing: border-box; }
		  body { 
			  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
			  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
			  overflow: hidden; 
			  color: white;
		  }
		  #gameContainer { position: relative; width: 100vw; height: 100vh; }
		  #videoCanvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; background: #000; }
		  #gameCanvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; }
		  #handCanvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none; }
		  
		  #ui { position: absolute; top: 20px; left: 20px; z-index: 4; color: white; font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
		  .player-score { margin-bottom: 10px; padding: 15px; background: rgba(0,0,0,0.4); border-radius: 10px; border-left: 4px solid #FF9800; }
		  
		  #timer { 
			  position: absolute; top: 20px; right: 20px; z-index: 4; 
			  background: rgba(0,0,0,0.6); padding: 15px; border-radius: 10px; 
			  font-size: 24px; font-weight: bold; color: #FFD700; 
			  text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
		  }
		  
		  #startButton { 
			  padding: 25px 50px; font-size: 28px; background: linear-gradient(45deg, #FF9800, #F57C00); 
			  color: white; border: none; border-radius: 15px; cursor: pointer; 
			  box-shadow: 0 8px 15px rgba(0,0,0,0.3); transition: all 0.3s; 
			  margin-top: 20px;
		  }
		  #startButton:hover { background: linear-gradient(45deg, #F57C00, #FF9800); transform: scale(1.05); }
		  #startButton:disabled { 
			  background: #666; cursor: not-allowed; transform: none; 
			  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
		  }
		  
		  #usernameInput {
			  padding: 15px; font-size: 18px; border: 2px solid #FF9800; 
			  border-radius: 10px; background: rgba(255,255,255,0.9); 
			  color: #333; margin-bottom: 15px; width: 300px; text-align: center;
		  }
		  #usernameInput:focus { outline: none; border-color: #F57C00; box-shadow: 0 0 10px rgba(255,152,0,0.5); }
		  
		  #cameraStatus { position: absolute; bottom: 20px; left: 20px; z-index: 4; background: rgba(0,0,0,0.6); padding: 15px; border-radius: 10px; font-size: 14px; }
		  #handStatus { position: absolute; bottom: 60px; right: 20px; z-index: 4; background: rgba(0,0,0,0.6); padding: 15px; border-radius: 10px; font-size: 14px; }
		  
		  .celebration { 
			  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
			  font-size: 64px; color: #FFD700; text-shadow: 3px 3px 6px rgba(0,0,0,0.8); z-index: 6; 
			  animation: celebration 2.5s ease-out; 
		  }
		  @keyframes celebration { 
			  0% { transform: translate(-50%, -50%) scale(0) rotate(-180deg); opacity: 0; } 
			  50% { transform: translate(-50%, -50%) scale(1.3) rotate(0deg); opacity: 1; } 
			  100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0; } 
		  }
		  
		  .info-panel { 
			  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; 
			  background: rgba(0,0,0,0.9); color: white; padding: 40px; border-radius: 20px; 
			  text-align: center; max-width: 600px; border: 2px solid #FF9800; 
		  }
		  .info-panel h2 { margin-bottom: 20px; color: #FF9800; font-size: 32px; }
		  .info-panel p { margin-bottom: 15px; line-height: 1.6; font-size: 18px; }
		  .info-panel .emoji { font-size: 24px; margin: 0 5px; }
		  .hidden { display: none; }
		  
		  .leaderboard-panel {
			  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10;
			  background: rgba(0,0,0,0.95); color: white; padding: 40px; border-radius: 20px;
			  text-align: center; max-width: 700px; min-width: 500px; border: 2px solid #FFD700;
		  }
		  .leaderboard-panel h2 { margin-bottom: 30px; color: #FFD700; font-size: 36px; }
		  .leaderboard-entry { 
			  display: flex; justify-content: space-between; align-items: center;
			  padding: 12px 20px; margin: 8px 0; background: rgba(255,255,255,0.1);
			  border-radius: 10px; font-size: 18px;
		  }
		  .leaderboard-entry.current-player { 
			  background: rgba(255,215,0,0.2); border: 2px solid #FFD700;
		  }
		  .leaderboard-rank { font-weight: bold; color: #FFD700; min-width: 40px; }
		  .leaderboard-name { flex: 1; text-align: left; margin-left: 20px; }
		  .leaderboard-stats { text-align: right; font-family: monospace; }
		  
		  #playAgainButton {
			  padding: 20px 40px; font-size: 24px; background: linear-gradient(45deg, #4CAF50, #45a049);
			  color: white; border: none; border-radius: 15px; cursor: pointer;
			  margin-top: 30px; transition: all 0.3s;
		  }
		  #playAgainButton:hover { transform: scale(1.05); }
		  
		  #loadingStatus { 
			  position: absolute; bottom: 20px; right: 20px; z-index: 4; 
			  background: rgba(0,0,0,0.8); padding: 15px; border-radius: 10px; 
			  font-size: 14px; color: #FF9800; 
		  }
		  
		  .hand-indicator { 
			  position: absolute; background: rgba(255, 152, 0, 0.8); 
			  border: 2px solid #FF9800; border-radius: 50%; 
			  pointer-events: none; z-index: 4; 
			  animation: handPulse 1s infinite; 
		  }
		  @keyframes handPulse { 
			  0%, 100% { transform: scale(1); opacity: 0.8; } 
			  50% { transform: scale(1.2); opacity: 1; } 
		  }
	  </style>
  </head>
  <body>
	  <div id="gameContainer">
		  <canvas id="videoCanvas"></canvas>
		  <canvas id="gameCanvas"></canvas>
		  <canvas id="handCanvas"></canvas>
		  
		  <div id="ui"><div id="scores"></div></div>
		  <div id="timer" class="hidden">⏱️ 00:00</div>
		  <div id="cameraStatus">📷 Camera: Initializing...</div>
		  <div id="handStatus">🤚 Hands: Loading AI...</div>
		  <div id="loadingStatus">🤖 Loading MediaPipe...</div>
		  
		  <div id="infoPanel" class="info-panel">
			  <h2>🤚 AI Hand Fruit Catching Game</h2>
			  <p><strong>🎯 How to Play:</strong></p>
			  <p><span class="emoji">🤚</span> Show your hands to the camera</p>
			  <p><span class="emoji">👐</span> Catch fruits (+1 point) or SWIPE them (+3 points!) <span class="emoji">🍎🍊🍌🍇</span></p>
			  <p><span class="emoji">💣</span> AVOID bombs - they damage you!</p>
			  <p><span class="emoji">🏆</span> Get 20 fruits to win!</p>
			  <p><strong>🤖 AI-Powered Detection:</strong></p>
			  <p>Uses MediaPipe for real-time hand tracking and swipe detection</p>
			  <p><em>⚡ Move your hands FAST to swipe for bonus points!</em></p>
			  
			  <input type="text" id="usernameInput" placeholder="Enter your username" maxlength="20" />
			  <br>
			  <button id="startButton" disabled>🎮 Start Game</button>
		  </div>
		  
		  <div id="leaderboardPanel" class="leaderboard-panel hidden">
			  <h2>🏆 Leaderboard</h2>
			  <div id="leaderboardContent"></div>
			  <button id="playAgainButton">🎮 Play Again</button>
		  </div>
	  </div>
	  
	  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"></script>
	  <script type="module">
		  import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";
		  
		  class HandFruitCatchingGame {
			  constructor() {
				  this.videoCanvas = document.getElementById('videoCanvas');
				  this.gameCanvas = document.getElementById('gameCanvas');
				  this.handCanvas = document.getElementById('handCanvas');
				  
				  this.videoCtx = this.videoCanvas.getContext('2d');
				  this.gameCtx = this.gameCanvas.getContext('2d');
				  this.handCtx = this.handCanvas.getContext('2d');
				  
				  this.video = null;
				  this.handLandmarker = null;
				  this.hands = [];
				  this.handHistory = [];
				  this.fruits = [];
				  this.bombs = [];
				  this.swipeEffects = [];
				  this.scores = { player: 0 };
				  this.gameActive = false;
				  this.runningMode = "VIDEO";
				  this.lastVideoTime = -1;
				  this.gameHealth = 3;
				  this.username = '';
				  this.gameStartTime = 0;
				  this.gameDuration = 0;
				  this.timerInterval = null;
				  
				  this.initializeGame();
			  }
			  
			  async initializeGame() {
				  await this.setupCamera();
				  await this.initializeHandDetection();
				  this.resizeCanvases();
				  this.setupEventListeners();
				  this.gameLoop();
			  }
			  
			  async initializeHandDetection() {
				  const statusEl = document.getElementById('handStatus');
				  const loadingEl = document.getElementById('loadingStatus');
				  
				  try {
					  statusEl.textContent = '🤖 Hands: Loading MediaPipe...';
					  loadingEl.textContent = '🤖 Loading Hand Landmarker...';
					  
					  const vision = await FilesetResolver.forVisionTasks(
						  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
					  );
					  
					  this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
						  baseOptions: {
							  modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
							  delegate: "GPU"
						  },
						  runningMode: this.runningMode,
						  numHands: 4
					  });
					  
					  statusEl.textContent = '🤚 Hands: AI Ready!';
					  loadingEl.textContent = '✅ MediaPipe Loaded!';
					  setTimeout(() => loadingEl.style.display = 'none', 2000);
					  
					  console.log('Hand detection initialized successfully');
				  } catch (error) {
					  console.error('Hand detection initialization failed:', error);
					  statusEl.textContent = '❌ Hands: Failed to load';
					  loadingEl.textContent = '❌ MediaPipe Failed';
				  }
			  }
			  
			  async setupCamera() {
				  const statusEl = document.getElementById('cameraStatus');
				  try {
					  statusEl.textContent = '📷 Camera: Requesting access...';
					  
					  const stream = await navigator.mediaDevices.getUserMedia({
						  video: { 
							  width: { ideal: 1280 }, 
							  height: { ideal: 720 }, 
							  facingMode: 'user' 
						  }
					  });
					  
					  this.video = document.createElement('video');
					  this.video.srcObject = stream;
					  this.video.autoplay = true;
					  this.video.muted = true;
					  this.video.playsInline = true;
					  
					  return new Promise((resolve) => {
						  this.video.onloadedmetadata = () => {
							  statusEl.textContent = \`📷 Camera: Ready (\${this.video.videoWidth}x\${this.video.videoHeight})\`;
							  this.video.play().then(() => {
								  console.log('Video playing successfully');
								  resolve();
							  }).catch(err => {
								  console.error('Video play failed:', err);
								  statusEl.textContent = '📷 Camera: Play failed';
							  });
						  };
					  });
				  } catch (error) {
					  console.error('Camera access failed:', error);
					  statusEl.textContent = '📷 Camera: Access denied';
				  }
			  }
			  
			  resizeCanvases() {
				  const container = document.getElementById('gameContainer');
				  const width = container.offsetWidth;
				  const height = container.offsetHeight;
				  
				  [this.videoCanvas, this.gameCanvas, this.handCanvas].forEach(canvas => {
					  canvas.width = width;
					  canvas.height = height;
				  });
			  }
			  
			  setupEventListeners() {
				  const usernameInput = document.getElementById('usernameInput');
				  const startButton = document.getElementById('startButton');
				  const playAgainButton = document.getElementById('playAgainButton');
				  
				  usernameInput.addEventListener('input', (e) => {
					  const username = e.target.value.trim();
					  startButton.disabled = username.length < 2;
					  if (username.length >= 2) {
						  this.username = username;
					  }
				  });
				  
				  usernameInput.addEventListener('keypress', (e) => {
					  if (e.key === 'Enter' && !startButton.disabled) {
						  this.startGame();
					  }
				  });
				  
				  startButton.addEventListener('click', () => this.startGame());
				  playAgainButton.addEventListener('click', () => this.resetToStart());
				  window.addEventListener('resize', () => this.resizeCanvases());
			  }
			  
			  startGame() {
				  this.gameActive = true;
				  this.hands = [];
				  this.handHistory = [];
				  this.fruits = [];
				  this.bombs = [];
				  this.swipeEffects = [];
				  this.scores = { player: 0 };
				  this.gameHealth = 3;
				  this.gameStartTime = Date.now();
				  this.gameDuration = 0;
				  
				  document.getElementById('infoPanel').classList.add('hidden');
				  document.getElementById('timer').classList.remove('hidden');
				  
				  // Start timer
				  this.timerInterval = setInterval(() => {
					  if (this.gameActive) {
						  this.gameDuration = Date.now() - this.gameStartTime;
						  this.updateTimer();
					  }
				  }, 100);
			  }
			  
			  updateTimer() {
				  const seconds = Math.floor(this.gameDuration / 1000);
				  const minutes = Math.floor(seconds / 60);
				  const remainingSeconds = seconds % 60;
				  const timerText = \`⏱️ \${minutes.toString().padStart(2, '0')}:\${remainingSeconds.toString().padStart(2, '0')}\`;
				  document.getElementById('timer').textContent = timerText;
			  }
			  
			  stopTimer() {
				  if (this.timerInterval) {
					  clearInterval(this.timerInterval);
					  this.timerInterval = null;
				  }
			  }
			  
			  async saveScore() {
				  try {
					  const response = await fetch('/api/save-score', {
						  method: 'POST',
						  headers: { 'Content-Type': 'application/json' },
						  body: JSON.stringify({
							  username: this.username,
							  score: this.scores.player,
							  time: Math.floor(this.gameDuration / 1000)
						  })
					  });
					  
					  if (!response.ok) {
						  console.error('Failed to save score');
					  }
				  } catch (error) {
					  console.error('Error saving score:', error);
				  }
			  }
			  
			  async showLeaderboard() {
				  try {
					  const response = await fetch('/api/leaderboard');
					  const leaderboard = await response.json();
					  
					  const content = document.getElementById('leaderboardContent');
					  content.innerHTML = '';
					  
					  if (leaderboard.length === 0) {
						  content.innerHTML = '<p>No scores yet! Be the first to play!</p>';
					  } else {
						  leaderboard.forEach((entry, index) => {
							  const isCurrentPlayer = entry.username === this.username && 
													 entry.score === this.scores.player;
							  
							  const entryDiv = document.createElement('div');
							  entryDiv.className = \`leaderboard-entry\${isCurrentPlayer ? ' current-player' : ''}\`;
							  
							  const rank = index + 1;
							  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : \`#\${rank}\`;
							  const timeMinutes = Math.floor(entry.time / 60);
							  const timeSeconds = entry.time % 60;
							  const timeStr = \`\${timeMinutes}:\${timeSeconds.toString().padStart(2, '0')}\`;
							  
							  entryDiv.innerHTML = \`
								  <span class="leaderboard-rank">\${rankEmoji}</span>
								  <span class="leaderboard-name">\${entry.username}</span>
								  <span class="leaderboard-stats">Score: \${entry.score} | Time: \${timeStr}</span>
							  \`;
							  
							  content.appendChild(entryDiv);
						  });
					  }
					  
					  document.getElementById('leaderboardPanel').classList.remove('hidden');
				  } catch (error) {
					  console.error('Error fetching leaderboard:', error);
					  document.getElementById('leaderboardContent').innerHTML = '<p>Error loading leaderboard</p>';
					  document.getElementById('leaderboardPanel').classList.remove('hidden');
				  }
			  }
			  
			  resetToStart() {
				  this.gameActive = false;
				  this.scores = { player: 0 };
				  this.fruits = [];
				  this.bombs = [];
				  this.hands = [];
				  this.handHistory = [];
				  this.swipeEffects = [];
				  this.gameHealth = 3;
				  this.stopTimer();
				  
				  document.getElementById('leaderboardPanel').classList.add('hidden');
				  document.getElementById('timer').classList.add('hidden');
				  document.getElementById('infoPanel').classList.remove('hidden');
				  
				  // Reset username input
				  document.getElementById('usernameInput').value = '';
				  document.getElementById('startButton').disabled = true;
				  this.username = '';
			  }
			  
			  detectHands() {
				  if (!this.handLandmarker || !this.video || !this.gameActive) return;
				  
				  let startTimeMs = performance.now();
				  
				  if (this.lastVideoTime !== this.video.currentTime) {
					  this.lastVideoTime = this.video.currentTime;
					  
					  try {
						  const results = this.handLandmarker.detectForVideo(this.video, startTimeMs);
						  this.processHandResults(results);
					  } catch (error) {
						  console.error('Hand detection error:', error);
					  }
				  }
			  }
			  
			  processHandResults(results) {
				  const currentTime = Date.now();
				  this.hands = [];
				  
				  if (results.landmarks) {
					  results.landmarks.forEach((landmarks, index) => {
						  const palmCenter = landmarks[9];
						  const wrist = landmarks[0];
						  const indexTip = landmarks[8];
						  const thumbTip = landmarks[4];
						  
						  const handX = palmCenter.x * this.gameCanvas.width;
						  const handY = palmCenter.y * this.gameCanvas.height;
						  
						  const handSize = Math.sqrt(
							  Math.pow((indexTip.x - wrist.x) * this.gameCanvas.width, 2) +
							  Math.pow((indexTip.y - wrist.y) * this.gameCanvas.height, 2)
						  );
						  
						  let handedness = 'Hand';
						  if (results.handednesses[index]) {
							  const detectedHand = results.handednesses[index][0].categoryName;
							  handedness = detectedHand === 'Left' ? 'Right' : 'Left';
						  }
						  
						  let velocity = { x: 0, y: 0, magnitude: 0 };
						  const handId = \`\${handedness}_\${index}\`;
						  
						  const recentHands = this.handHistory
							  .filter(h => h.id === handId && currentTime - h.time < 150)
							  .sort((a, b) => b.time - a.time);
						  
						  if (recentHands.length >= 2) {
							  const prevHand = recentHands[0];
							  const deltaTime = Math.max(0.016, (currentTime - prevHand.time) / 1000);
							  
							  velocity.x = (handX - prevHand.x) / deltaTime;
							  velocity.y = (handY - prevHand.y) / deltaTime;
							  velocity.magnitude = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
						  }
						  
						  const hand = {
							  id: index,
							  x: handX,
							  y: handY,
							  catchRadius: Math.max(30, handSize * 0.4),
							  landmarks: landmarks,
							  handedness: handedness,
							  velocity: velocity,
							  isSwipe: velocity.magnitude > 600
						  };
						  
						  this.hands.push(hand);
						  
						  this.handHistory = this.handHistory.filter(h => currentTime - h.time < 300);
						  this.handHistory.push({
							  id: handId,
							  x: handX,
							  y: handY,
							  time: currentTime
						  });
					  });
				  }
				  
				  if (this.hands.length > 0 && !('player' in this.scores)) {
					  this.scores.player = 0;
				  }
			  }
			  
			  spawnFruit() {
				  if (this.gameActive && Math.random() < 0.025) {
					  const fruits = ['🍎', '🍊', '🍌', '🍇', '🥝', '🍓', '🍑', '🍒', '🥭', '🍍', '🍋', '🥥', '🥑', '🍈'];
					  const fruit = {
						  x: Math.random() * this.gameCanvas.width,
						  y: -60,
						  emoji: fruits[Math.floor(Math.random() * fruits.length)],
						  speed: 2 + Math.random() * 2,
						  size: 35 + Math.random() * 10,
						  rotation: Math.random() * 360,
						  rotationSpeed: (Math.random() - 0.5) * 10
					  };
					  this.fruits.push(fruit);
				  }
				  
				  if (this.gameActive && Math.random() < 0.008) {
					  const bombEmojis = ['💣', '🧨', '💥'];
					  const bomb = {
						  x: Math.random() * this.gameCanvas.width,
						  y: -60,
						  emoji: bombEmojis[Math.floor(Math.random() * bombEmojis.length)],
						  speed: 1.5 + Math.random() * 1.5,
						  size: 40 + Math.random() * 10,
						  rotation: Math.random() * 360,
						  rotationSpeed: (Math.random() - 0.5) * 15,
						  dangerRadius: 45
					  };
					  this.bombs.push(bomb);
				  }
			  }
			  
			  updateFruits() {
				  this.fruits = this.fruits.filter(fruit => {
					  fruit.y += fruit.speed;
					  fruit.rotation += fruit.rotationSpeed;
					  
					  for (const hand of this.hands) {
						  if (this.checkCollision(fruit, hand)) {
							  if (hand.isSwipe) {
								  this.scores.player += 3;
								  console.log(\`SWIPED \${fruit.emoji}! +3 points! Score: \${this.scores.player}\`);
								  this.createSwipeEffect(fruit, hand);
							  } else {
								  this.scores.player++;
								  console.log(\`Caught \${fruit.emoji}! Score: \${this.scores.player}\`);
							  }
							  this.checkWinCondition();
							  return false;
						  }
					  }
					  
					  return fruit.y < this.gameCanvas.height + 100;
				  });
				  
				  this.swipeEffects = this.swipeEffects.filter(effect => {
					  effect.age += 16;
					  effect.particles.forEach(particle => {
						  particle.x += particle.vx;
						  particle.y += particle.vy;
						  particle.vy += 0.3;
						  particle.alpha -= 0.02;
						  particle.scale += 0.01;
					  });
					  return effect.age < 2000;
				  });
				  
				  this.bombs = this.bombs.filter(bomb => {
					  bomb.y += bomb.speed;
					  bomb.rotation += bomb.rotationSpeed;
					  
					  for (const hand of this.hands) {
						  if (this.checkBombCollision(bomb, hand)) {
							  this.gameHealth--;
							  console.log(\`Hit by \${bomb.emoji}! Health: \${this.gameHealth}\`);
							  this.showDamage();
							  
							  if (this.gameHealth <= 0) {
								  this.gameOver();
							  }
							  return false;
						  }
					  }
					  
					  return bomb.y < this.gameCanvas.height + 100;
				  });
			  }
			  
			  checkCollision(fruit, hand) {
				  const handX = this.gameCanvas.width - hand.x;
				  const distance = Math.sqrt(
					  Math.pow(fruit.x - handX, 2) + 
					  Math.pow(fruit.y - hand.y, 2)
				  );
				  
				  const collisionRadius = hand.isSwipe ? 
					  hand.catchRadius * 1.2 + fruit.size / 2 : 
					  hand.catchRadius + fruit.size / 2;
				  
				  const collision = distance < collisionRadius;
				  
				  if (collision) {
					  console.log(hand.isSwipe ? 'FRUIT SWIPED!' : 'FRUIT CAUGHT!', {
						  fruit: fruit.emoji,
						  hand: hand.handedness,
						  distance: distance.toFixed(2),
						  velocity: hand.velocity.magnitude.toFixed(0),
						  isSwipe: hand.isSwipe
					  });
				  }
				  return collision;
			  }
			  
			  checkBombCollision(bomb, hand) {
				  const handX = this.gameCanvas.width - hand.x;
				  const distance = Math.sqrt(
					  Math.pow(bomb.x - handX, 2) + 
					  Math.pow(bomb.y - hand.y, 2)
				  );
				  
				  const collision = distance < (hand.catchRadius * 0.8) + (bomb.size / 2);
				  
				  if (collision) {
					  console.log('BOMB HIT!', {
						  bomb: bomb.emoji,
						  hand: hand.handedness,
						  distance: distance.toFixed(2),
						  threshold: ((hand.catchRadius * 0.8) + (bomb.size / 2)).toFixed(2)
					  });
				  }
				  return collision;
			  }
			  
			  createSwipeEffect(fruit, hand) {
				  const swipeEmojis = ['✨', '💫', '⭐', '🌟', '💥', '🔥', '⚡'];
				  const effectEmoji = swipeEmojis[Math.floor(Math.random() * swipeEmojis.length)];
				  
				  const particles = [];
				  for (let i = 0; i < 12; i++) {
					  particles.push({
						  x: this.gameCanvas.width - hand.x,
						  y: hand.y,
						  vx: (Math.random() - 0.5) * 15,
						  vy: (Math.random() - 0.5) * 15 - 5,
						  emoji: effectEmoji,
						  alpha: 1,
						  scale: 0.5 + Math.random() * 0.5
					  });
				  }
				  
				  this.swipeEffects.push({
					  particles: particles,
					  age: 0,
					  centerX: this.gameCanvas.width - hand.x,
					  centerY: hand.y,
					  swipeText: '+3 SWIPE!',
					  originalFruit: fruit.emoji
				  });
			  }
			  
			  showDamage() {
				  const damageOverlay = document.createElement('div');
				  damageOverlay.style.cssText = \`
					  position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10;
					  background: rgba(255, 0, 0, 0.5); pointer-events: none;
					  animation: damageFlash 0.5s ease-out;
				  \`;
				  
				  const style = document.createElement('style');
				  style.textContent = \`
					  @keyframes damageFlash {
						  0% { opacity: 0.8; }
						  100% { opacity: 0; }
					  }
				  \`;
				  document.head.appendChild(style);
				  
				  document.getElementById('gameContainer').appendChild(damageOverlay);
				  setTimeout(() => {
					  damageOverlay.remove();
					  style.remove();
				  }, 500);
			  }
			  
			  gameOver() {
				  this.stopTimer();
				  this.gameActive = false;
				  
				  const gameOverDiv = document.createElement('div');
				  gameOverDiv.className = 'celebration';
				  gameOverDiv.textContent = \`💥 Game Over! Final Score: \${this.scores.player} 🍎\`;
				  gameOverDiv.style.background = 'rgba(255, 0, 0, 0.8)';
				  gameOverDiv.style.padding = '20px';
				  gameOverDiv.style.borderRadius = '15px';
				  document.getElementById('gameContainer').appendChild(gameOverDiv);
				  setTimeout(() => gameOverDiv.remove(), 3000);
				  
				  // Don't save score on loss, just show leaderboard
				  setTimeout(() => {
					  this.showLeaderboard();
				  }, 3000);
			  }
			  
			  async checkWinCondition() {
				  if (this.scores.player >= 20) {
					  this.stopTimer();
					  this.gameActive = false;
					  
					  this.showCelebration();
					  await this.saveScore();
					  
					  setTimeout(() => {
						  this.showLeaderboard();
					  }, 2500);
				  }
			  }
			  
			  showCelebration() {
				  const celebration = document.createElement('div');
				  celebration.className = 'celebration';
				  celebration.textContent = \`🎉 You Win! Score: \${this.scores.player} 🏆\`;
				  document.getElementById('gameContainer').appendChild(celebration);
				  setTimeout(() => celebration.remove(), 2500);
			  }
			  
			  render() {
				  this.videoCtx.clearRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
				  this.gameCtx.clearRect(0, 0, this.gameCanvas.width, this.gameCanvas.height);
				  this.handCtx.clearRect(0, 0, this.handCanvas.width, this.handCanvas.height);
				  
				  if (this.video && this.video.videoWidth > 0 && this.video.readyState >= 2) {
					  this.videoCtx.save();
					  this.videoCtx.scale(-1, 1);
					  this.videoCtx.drawImage(this.video, -this.videoCanvas.width, 0, this.videoCanvas.width, this.videoCanvas.height);
					  this.videoCtx.restore();
				  }
				  
				  this.hands.forEach((hand, index) => {
					  const displayX = this.gameCanvas.width - hand.x;
					  
					  if (hand.landmarks) {
						  const HAND_CONNECTIONS = [
							  [0, 1], [1, 2], [2, 3], [3, 4],
							  [0, 5], [5, 6], [6, 7], [7, 8],
							  [5, 9], [9, 10], [10, 11], [11, 12],
							  [9, 13], [13, 14], [14, 15], [15, 16],
							  [13, 17], [17, 18], [18, 19], [19, 20],
							  [0, 17]
						  ];
						  
						  this.handCtx.strokeStyle = '#00FF00';
						  this.handCtx.lineWidth = 3;
						  this.handCtx.beginPath();
						  
						  HAND_CONNECTIONS.forEach(([start, end]) => {
							  const startPoint = hand.landmarks[start];
							  const endPoint = hand.landmarks[end];
							  
							  const startX = this.handCanvas.width - (startPoint.x * this.handCanvas.width);
							  const startY = startPoint.y * this.handCanvas.height;
							  const endX = this.handCanvas.width - (endPoint.x * this.handCanvas.width);
							  const endY = endPoint.y * this.handCanvas.height;
							  
							  this.handCtx.moveTo(startX, startY);
							  this.handCtx.lineTo(endX, endY);
						  });
						  this.handCtx.stroke();
						  
						  this.handCtx.fillStyle = '#FF0000';
						  hand.landmarks.forEach(landmark => {
							  const x = this.handCanvas.width - (landmark.x * this.handCanvas.width);
							  const y = landmark.y * this.handCanvas.height;
							  
							  this.handCtx.beginPath();
							  this.handCtx.arc(x, y, 4, 0, Math.PI * 2);
							  this.handCtx.fill();
						  });
					  }
					  
					  const time = Date.now() / 1000;
					  const pulseSize = hand.catchRadius + Math.sin(time * 3) * 5;
					  
					  if (hand.isSwipe) {
						  this.gameCtx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
						  this.gameCtx.lineWidth = 6;
						  this.gameCtx.beginPath();
						  this.gameCtx.arc(displayX, hand.y, pulseSize + 15, 0, Math.PI * 2);
						  this.gameCtx.stroke();
						  
						  this.gameCtx.strokeStyle = '#FFD700';
						  this.gameCtx.lineWidth = 4;
						  this.gameCtx.beginPath();
						  this.gameCtx.arc(displayX, hand.y, pulseSize, 0, Math.PI * 2);
						  this.gameCtx.stroke();
						  
						  this.gameCtx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
						  this.gameCtx.lineWidth = 2;
						  this.gameCtx.beginPath();
						  this.gameCtx.moveTo(displayX, hand.y);
						  this.gameCtx.lineTo(displayX - hand.velocity.x * 0.1, hand.y - hand.velocity.y * 0.1);
						  this.gameCtx.stroke();
					  } else {
						  this.gameCtx.strokeStyle = 'rgba(255, 152, 0, 0.3)';
						  this.gameCtx.lineWidth = 4;
						  this.gameCtx.beginPath();
						  this.gameCtx.arc(displayX, hand.y, pulseSize + 5, 0, Math.PI * 2);
						  this.gameCtx.stroke();
						  
						  this.gameCtx.strokeStyle = '#FF9800';
						  this.gameCtx.lineWidth = 3;
						  this.gameCtx.beginPath();
						  this.gameCtx.arc(displayX, hand.y, pulseSize, 0, Math.PI * 2);
						  this.gameCtx.stroke();
					  }
					  
					  this.gameCtx.fillStyle = hand.isSwipe ? '#FFD700' : '#FF9800';
					  this.gameCtx.beginPath();
					  this.gameCtx.arc(displayX, hand.y, 4, 0, Math.PI * 2);
					  this.gameCtx.fill();
					  
					  this.gameCtx.fillStyle = 'white';
					  this.gameCtx.font = 'bold 18px Arial';
					  const modeText = hand.isSwipe ? '⚡ SWIPE MODE' : '🤚 Catch Mode';
					  this.gameCtx.fillText(\`\${hand.handedness} Hand - \${modeText}\`, displayX + 80, hand.y - 20);
					  
					  this.gameCtx.fillStyle = hand.isSwipe ? '#FFD700' : '#ffeb3b';
					  this.gameCtx.font = '16px Arial';
					  const actionText = hand.isSwipe ? 'SWIPE for +3 points!' : 'Catch Zone Active!';
					  this.gameCtx.fillText(actionText, displayX + 80, hand.y + 10);
				  });
				  
				  this.fruits.forEach(fruit => {
					  this.gameCtx.save();
					  this.gameCtx.translate(fruit.x, fruit.y);
					  this.gameCtx.rotate(fruit.rotation * Math.PI / 180);
					  
					  this.gameCtx.font = fruit.size + 'px Arial';
					  this.gameCtx.textAlign = 'center';
					  this.gameCtx.textBaseline = 'middle';
					  
					  this.gameCtx.fillStyle = 'rgba(0,0,0,0.4)';
					  this.gameCtx.fillText(fruit.emoji, 3, 3);
					  
					  this.gameCtx.fillStyle = 'white';
					  this.gameCtx.fillText(fruit.emoji, 0, 0);
					  
					  this.gameCtx.restore();
				  });
				  
				  this.swipeEffects.forEach(effect => {
					  effect.particles.forEach(particle => {
						  if (particle.alpha > 0) {
							  this.gameCtx.save();
							  this.gameCtx.globalAlpha = particle.alpha;
							  this.gameCtx.translate(particle.x, particle.y);
							  this.gameCtx.scale(particle.scale, particle.scale);
							  
							  this.gameCtx.font = '24px Arial';
							  this.gameCtx.textAlign = 'center';
							  this.gameCtx.textBaseline = 'middle';
							  this.gameCtx.fillStyle = 'white';
							  this.gameCtx.fillText(particle.emoji, 0, 0);
							  
							  this.gameCtx.restore();
						  }
					  });
					  
					  if (effect.age < 1000) {
						  this.gameCtx.save();
						  this.gameCtx.globalAlpha = Math.max(0, 1 - effect.age / 1000);
						  this.gameCtx.font = 'bold 32px Arial';
						  this.gameCtx.textAlign = 'center';
						  this.gameCtx.textBaseline = 'middle';
						  this.gameCtx.fillStyle = '#FFD700';
						  this.gameCtx.strokeStyle = '#000';
						  this.gameCtx.lineWidth = 3;
						  this.gameCtx.strokeText(effect.swipeText, effect.centerX, effect.centerY - 40);
						  this.gameCtx.fillText(effect.swipeText, effect.centerX, effect.centerY - 40);
						  this.gameCtx.restore();
					  }
				  });
				  
				  this.bombs.forEach(bomb => {
					  this.gameCtx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
					  this.gameCtx.lineWidth = 4;
					  this.gameCtx.beginPath();
					  this.gameCtx.arc(bomb.x, bomb.y, bomb.dangerRadius, 0, Math.PI * 2);
					  this.gameCtx.stroke();
					  
					  this.gameCtx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
					  this.gameCtx.lineWidth = 2;
					  this.gameCtx.beginPath();
					  this.gameCtx.arc(bomb.x, bomb.y, bomb.dangerRadius * 0.6, 0, Math.PI * 2);
					  this.gameCtx.stroke();
					  
					  this.gameCtx.save();
					  this.gameCtx.translate(bomb.x, bomb.y);
					  this.gameCtx.rotate(bomb.rotation * Math.PI / 180);
					  
					  this.gameCtx.font = bomb.size + 'px Arial';
					  this.gameCtx.textAlign = 'center';
					  this.gameCtx.textBaseline = 'middle';
					  
					  this.gameCtx.fillStyle = 'rgba(0,0,0,0.6)';
					  this.gameCtx.fillText(bomb.emoji, 4, 4);
					  
					  this.gameCtx.fillStyle = 'white';
					  this.gameCtx.fillText(bomb.emoji, 0, 0);
					  
					  this.gameCtx.restore();
				  });
				  
				  this.gameCtx.fillStyle = 'white';
				  this.gameCtx.font = 'bold 20px Arial';
				  this.gameCtx.fillText(\`🤚 Hands Detected: \${this.hands.length}\`, 20, 40);
				  this.gameCtx.fillText(\`❤️ Health: \${this.gameHealth}\`, 20, 70);
				  this.gameCtx.fillText(\`💣 Bombs: \${this.bombs.length}\`, 20, 100);
				  
				  this.hands.forEach((hand, index) => {
					  this.gameCtx.fillStyle = hand.isSwipe ? '#FFD700' : '#FF9800';
					  this.gameCtx.font = '16px Arial';
					  const velocity = Math.round(hand.velocity.magnitude);
					  const modeText = hand.isSwipe ? 'SWIPING' : 'Ready';
					  this.gameCtx.fillText(\`\${hand.handedness} Hand: \${modeText} (v:\${velocity})\`, 20, 130 + (index * 25));
				  });
				  
				  this.updateUI();
			  }
			  
			  updateUI() {
				  const scoresDiv = document.getElementById('scores');
				  scoresDiv.innerHTML = '';
				  
				  const scoreDiv = document.createElement('div');
				  scoreDiv.className = 'player-score';
				  scoreDiv.innerHTML = \`<strong>🏆 Score:</strong> \${this.scores.player}/20 🍎 | <strong>❤️ Health:</strong> \${this.gameHealth}/3\`;
				  scoresDiv.appendChild(scoreDiv);
			  }
			  
			  gameLoop() {
				  if (this.gameActive) {
					  this.detectHands();
					  this.spawnFruit();
					  this.updateFruits();
				  }
				  this.render();
				  requestAnimationFrame(() => this.gameLoop());
			  }
		  }
		  
		  window.addEventListener('DOMContentLoaded', () => {
			  new HandFruitCatchingGame();
		  });
	  </script>
  </body>
  </html>
  `;