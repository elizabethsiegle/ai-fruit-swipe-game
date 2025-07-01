export const GAME_SCRIPT = `
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
                    statusEl.textContent = '📷 Camera: Ready (' + this.video.videoWidth + 'x' + this.video.videoHeight + ')';
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
        const timerText = '⏱️ ' + minutes.toString().padStart(2, '0') + ':' + remainingSeconds.toString().padStart(2, '0');
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
                    const isCurrentPlayer = entry.username === this.username && entry.score === this.scores.player;
                    const entryDiv = document.createElement('div');
                    entryDiv.className = 'leaderboard-entry' + (isCurrentPlayer ? ' current-player' : '');
                    const rank = index + 1;
                    const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
                    const timeMinutes = Math.floor(entry.time / 60);
                    const timeSeconds = entry.time % 60;
                    const timeStr = timeMinutes + ':' + timeSeconds.toString().padStart(2, '0');
                    entryDiv.innerHTML = '<span class="leaderboard-rank">' + rankEmoji + '</span>' + '<span class="leaderboard-name">' + entry.username + '</span>' + '<span class="leaderboard-stats">Score: ' + entry.score + ' | Time: ' + timeStr + '</span>';
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
                const handId = handedness + '_' + index;
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
                        console.log('SWIPED ' + fruit.emoji + '! +3 points! Score: ' + this.scores.player);
                        this.createSwipeEffect(fruit, hand);
                    } else {
                        this.scores.player++;
                        console.log('Caught ' + fruit.emoji + '! Score: ' + this.scores.player);
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
                    console.log('Hit by ' + bomb.emoji + '! Health: ' + this.gameHealth);
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
        damageOverlay.style.cssText =
            'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10;' +
            'background: rgba(255, 0, 0, 0.5); pointer-events: none;' +
            'animation: damageFlash 0.5s ease-out;';
        const style = document.createElement('style');
        style.textContent =
            '@keyframes damageFlash {' +
            '0% { opacity: 0.8; }' +
            '100% { opacity: 0; }' +
            '}';
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
        gameOverDiv.textContent = '💥 Game Over! Final Score: ' + this.scores.player + ' 🍎';
        gameOverDiv.style.background = 'rgba(255, 0, 0, 0.8)';
        gameOverDiv.style.padding = '20px';
        gameOverDiv.style.borderRadius = '15px';
        document.getElementById('gameContainer').appendChild(gameOverDiv);
        setTimeout(() => gameOverDiv.remove(), 3000);
        this.saveScore().then(() => {
            setTimeout(() => {
                this.showLeaderboard();
            }, 3000);
        });
    }
    async checkWinCondition() {
        if (this.scores.player >= 50) {
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
        celebration.textContent = '🎉 You Win! Score: ' + this.scores.player + ' 🏆';
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
            this.gameCtx.fillText(hand.handedness + ' Hand - ' + modeText, displayX + 80, hand.y - 20);
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
        this.gameCtx.fillText('🤚 Hands Detected: ' + this.hands.length, 20, 40);
        this.gameCtx.fillText('❤️ Health: ' + this.gameHealth, 20, 70);
        this.gameCtx.fillText('💣 Bombs: ' + this.bombs.length, 20, 100);
        this.hands.forEach((hand, index) => {
            this.gameCtx.fillStyle = hand.isSwipe ? '#FFD700' : '#FF9800';
            this.gameCtx.font = '16px Arial';
            const velocity = Math.round(hand.velocity.magnitude);
            const modeText = hand.isSwipe ? 'SWIPING' : 'Ready';
            this.gameCtx.fillText(hand.handedness + ' Hand: ' + modeText + ' (v:' + velocity + ')', 20, 130 + (index * 25));
        });
        this.updateUI();
    }
    updateUI() {
        const scoresDiv = document.getElementById('scores');
        scoresDiv.innerHTML = '';
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'player-score';
        scoreDiv.innerHTML = '<strong>🏆 Score:</strong> ' + this.scores.player + '/50 🍎 | <strong>❤️ Health:</strong> ' + this.gameHealth + '/3';
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
`; 