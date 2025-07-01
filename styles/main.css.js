export const CSS_CONTENT =`
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
}`