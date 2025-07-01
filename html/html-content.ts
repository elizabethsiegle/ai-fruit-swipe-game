import { CSS_CONTENT } from '../styles/main.css.js';
import { GAME_SCRIPT } from './game-script';

export const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤚 AI Hand Fruit Catching Game</title>
    <style>
    ${CSS_CONTENT}
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
			<p><span class="emoji">🏆</span> Get 50 fruits to win!</p>  <!-- Changed from 20 to 50 -->
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
${GAME_SCRIPT}
    </script>
</body>
</html>`