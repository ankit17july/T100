// State
let gameState = {
    playerName: '',
    score: 0,
    currentLevel: 1,
    maxLevels: 100,
    timerId: null,
    currentAnswer: null,
    isTransitioning: false,
    startTime: 0,
    timerDuration: 10000
};

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'correct') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'fail') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

// Interactivity Initialization
document.addEventListener('DOMContentLoaded', () => {
    initSpaceWarp();
    bindEvents();
    checkReturningUser();
    loadLeaderboard();
});

function checkReturningUser() {
    const storedName = localStorage.getItem('t100_player_name');
    if(storedName) {
        gameState.playerName = storedName;
        document.getElementById('new-user-ui').classList.add('hidden');
        document.getElementById('returning-user-ui').classList.remove('hidden');
        document.getElementById('display-name').textContent = storedName;
    }
}

function bindEvents() {
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-change-name').addEventListener('click', () => {
        localStorage.removeItem('t100_player_name');
        gameState.playerName = '';
        document.getElementById('returning-user-ui').classList.add('hidden');
        document.getElementById('new-user-ui').classList.remove('hidden');
    });
    document.getElementById('player-name').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') startGame();
    });
    
    document.getElementById('btn-restart').addEventListener('click', () => {
        playSound('click');
        // Instant play again, skip inputs
        gameState.score = 0;
        gameState.currentLevel = 1;
        document.getElementById('app').classList.remove('screen-shake');
        showScreen('screen-game');
        loadQuestion();
    });
}

function startGame() {
    if(!gameState.playerName) {
        const nameInput = document.getElementById('player-name');
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.classList.add('error');
            nameInput.style.borderColor = 'var(--error)';
            setTimeout(() => nameInput.style.borderColor = '', 1000);
            return;
        }
        gameState.playerName = name;
        localStorage.setItem('t100_player_name', name);
    }
    
    playSound('click');
    gameState.score = 0;
    gameState.currentLevel = 1;
    
    document.documentElement.style.setProperty('--gravity-x', '0px');
    document.documentElement.style.setProperty('--gravity-y', '0px');
    document.documentElement.style.setProperty('--tilt', '0deg');
    document.getElementById('app').classList.remove('screen-shake');
    
    showScreen('screen-game');
    loadQuestion();
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

/**
 * Difficulty Progression (Values/Operands Count):
 * 1-5: 3 values
 * 6-15: 4 values
 * 16-30: 6 values
 * > 30: +1 value every 10 levels
 */
function generateMathQuestion() {
    const lvl = gameState.currentLevel;
    let numValues = 3;
    
    if (lvl <= 5) numValues = 3;
    else if (lvl <= 15) numValues = 4;
    else if (lvl <= 30) numValues = 6;
    else numValues = 6 + Math.floor((lvl - 31) / 10);

    let exprForEval = "";
    let questionText = "";
    let answer = 0;

    let attempt = 0;
    while(attempt < 2000) {
        attempt++;
        let expArr = [];
        let displayArr = [];
        let operators = ['+', '-', '*'];
        
        // Initial random operand purely between 1 and 9
        let val = Math.floor(Math.random() * 9) + 1;
        expArr.push(val);
        displayArr.push(val);
        
        let lastOp = '';
        let lastVal = val;
        for (let i = 1; i < numValues; i++) {
            let op = operators[Math.floor(Math.random() * 3)];
            
            // Prevent consecutive multiplications preventing massive values
            if (lastOp === '*' && op === '*') {
                op = Math.random() < 0.5 ? '+' : '-';
            }
            lastOp = op;
            
            let nextVal;
            // Prevent adjacent duplicate operands and enforce 1-9 limit strictly
            do {
                nextVal = Math.floor(Math.random() * 9) + 1;
            } while (nextVal === lastVal);
            lastVal = nextVal;
            
            expArr.push(op);
            expArr.push(nextVal);
            
            let dispOp = op === '*' ? '×' : (op === '-' ? '−' : '+');
            displayArr.push(dispOp);
            displayArr.push(nextVal);
        }
        
        exprForEval = expArr.join('');
        let testRes = Function(`"use strict";return (${exprForEval})`)();
        
        if (Number.isInteger(testRes) && testRes < 300) {
            // Early levels maintain positive simplicity
            if (lvl <= 15 && testRes < 0) continue; 
            if (lvl <= 5 && testRes === 0) continue; 
            
            // Limit severe negatives entirely
            if (testRes < -50) continue; 
            
            answer = testRes;
            questionText = displayArr.join(' ');
            break;
        }
    }
    
    questionText += " = ?";
    
    // Generate 3 unique options
    let options = new Set([answer]);
    while(options.size < 3) {
        let offset = Math.floor(Math.random() * 15) - 7;
        if(offset === 0) offset = 2;
        let distractor = answer + offset;
        
        if (lvl <= 15 && distractor < 0) continue;
        if (distractor < -50) continue;
        
        options.add(distractor);
        
        // Trap logic: Left-to-right ignore BODMAS distractor 
        if (options.size < 3 && exprForEval.includes('*')) {
             try {
                 let tokens = exprForEval.split(/(\+|\-|\*)/);
                 let res = parseInt(tokens[0]);
                 for(let i=1; i<tokens.length; i+=2) {
                     let op = tokens[i];
                     let val = parseInt(tokens[i+1]);
                     if(op==='+') res += val;
                     if(op==='-') res -= val;
                     if(op==='*') res *= val;
                 }
                 if(res !== answer && Number.isInteger(res) && res >= -50) {
                     options.add(res);
                 }
             } catch(e) {}
        }
    }
    
    options = Array.from(options).sort(() => Math.random() - 0.5);
    return { questionText, answer, options };
}

function loadQuestion() {
    gameState.isTransitioning = false;
    
    const qData = generateMathQuestion();
    gameState.currentAnswer = qData.answer;
    
    // Update UI
    document.getElementById('question-number').textContent = `${gameState.currentLevel}/${gameState.maxLevels}`;
    document.getElementById('score-display').textContent = gameState.score;
    document.getElementById('game-progress').style.width = `${(gameState.currentLevel / gameState.maxLevels) * 100}%`;
    
    const qEl = document.getElementById('question-text');
    qEl.textContent = qData.questionText;

    const optsContainer = document.getElementById('options-container');
    optsContainer.innerHTML = '';
    
    qData.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.onclick = () => handleAnswerClick(btn, opt);
        optsContainer.appendChild(btn);
    });

    applyAntiGravity();
    startTimer();
}

function startTimer() {
    if(gameState.timerId) cancelAnimationFrame(gameState.timerId);
    
    gameState.startTime = performance.now();
    const timerBar = document.getElementById('timer-bar-fill');
    
    // Visual reset
    timerBar.style.width = '100%';
    timerBar.style.background = 'linear-gradient(90deg, var(--accent), #10b981)';

    function updateTimer(currentTime) {
        if(gameState.isTransitioning) return;
        
        const elapsed = currentTime - gameState.startTime;
        const remaining = Math.max(0, gameState.timerDuration - elapsed);
        
        const percentage = (remaining / gameState.timerDuration) * 100;
        timerBar.style.width = `${percentage}%`;
        
        // Change color based on urgency
        if(percentage < 30) {
            timerBar.style.background = 'linear-gradient(90deg, var(--error), #fca5a5)';
        } else if (percentage < 60) {
            timerBar.style.background = 'linear-gradient(90deg, #f59e0b, #fcd34d)';
        }

        if (remaining <= 0) {
            handleGameOver(false); // timeout = game over!
            return;
        }
        
        gameState.timerId = requestAnimationFrame(updateTimer);
    }
    
    gameState.timerId = requestAnimationFrame(updateTimer);
}

function handleAnswerClick(btn, selectedOption) {
    if(gameState.isTransitioning) return;
    gameState.isTransitioning = true;
    if(gameState.timerId) cancelAnimationFrame(gameState.timerId);
    
    const isCorrect = selectedOption === gameState.currentAnswer;
    
    if (isCorrect) {
        playSound('correct');
        btn.classList.add('correct');
        gameState.score++;
        document.getElementById('score-display').textContent = gameState.score;
        createMiniParticles(btn);
        
        setTimeout(() => {
            nextLevel();
        }, 500);
    } else {
        btn.classList.add('wrong');
        // Highlight correct answer
        document.querySelectorAll('.option-btn').forEach(b => {
            if(parseInt(b.textContent) === gameState.currentAnswer) {
                b.style.borderColor = 'var(--accent)';
                b.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.4)';
            }
        });
        handleGameOver(true);
    }
}

function handleGameOver(fromWrongAnswer) {
    gameState.isTransitioning = true;
    if(gameState.timerId) cancelAnimationFrame(gameState.timerId);
    
    playSound('fail');
    
    if(!fromWrongAnswer) {
        // Came from timeout
        document.querySelectorAll('.option-btn').forEach(b => {
            if(parseInt(b.textContent) === gameState.currentAnswer) {
                b.style.borderColor = 'var(--accent)';
            }
        });
    }

    // Shake the main screen container
    document.getElementById('app').classList.add('screen-shake');
    
    // Overload speed for dramatic effect
    warpSpeedMultiplier = 5;

    setTimeout(() => {
        warpSpeedMultiplier = 1;
        saveScore();
        showScreen('screen-leaderboard');
        document.getElementById('final-score-value').textContent = gameState.score;
        loadLeaderboard();
        document.getElementById('app').classList.remove('screen-shake');
    }, 1200);
}

function nextLevel() {
    if (gameState.currentLevel < gameState.maxLevels) {
        gameState.currentLevel++;
        warpSpeedMultiplier = 2; // quick burst of speed!
        setTimeout(() => warpSpeedMultiplier = 1, 500);
        loadQuestion();
    } else {
        handleGameOver(false); // Not actually game over, finished! 
        // We'll reuse logic, but without screen shake if won. Overriding:
        document.getElementById('screen-leaderboard').querySelector('h2').textContent = "Victory!";
        document.getElementById('screen-leaderboard').querySelector('h2').classList.remove('text-error');
        document.getElementById('screen-leaderboard').querySelector('h2').style.color = "var(--accent)";
        showScreen('screen-leaderboard');
        saveScore();
        document.getElementById('final-score-value').textContent = gameState.score;
        loadLeaderboard();
    }
}

function applyAntiGravity() {
    // Increase chaos as level progresses
    const levelFactor = gameState.currentLevel / gameState.maxLevels;
    
    // Adjust container gravity variables
    const maxShift = 30 * levelFactor; // up to 30px
    const maxTilt = 5 * levelFactor;   // up to 5 degrees
    
    const rX = (Math.random() - 0.5) * 2 * maxShift;
    const rY = (Math.random() - 0.5) * 2 * maxShift;
    const rTilt = (Math.random() - 0.5) * 2 * maxTilt;

    document.documentElement.style.setProperty('--gravity-x', `${rX}px`);
    document.documentElement.style.setProperty('--gravity-y', `${rY}px`);
    document.documentElement.style.setProperty('--tilt', `${rTilt}deg`);
}

// Local Leaderboard Logic
function saveScore() {
    const currentBest = parseInt(localStorage.getItem('t100_best_score') || '0');
    if (gameState.score > currentBest) {
        localStorage.setItem('t100_best_score', gameState.score);
    }
    
    let lb = JSON.parse(localStorage.getItem('t100_v2_lb') || '[]');
    const existing = lb.find(x => x.name === gameState.playerName);
    if(existing) {
        existing.score = Math.max(existing.score, gameState.score);
        existing.date = Date.now();
    } else {
        lb.push({ name: gameState.playerName, score: gameState.score, date: Date.now() });
    }
    lb.sort((a, b) => b.score - a.score);
    localStorage.setItem('t100_v2_lb', JSON.stringify(lb.slice(0, 10)));
}

function loadLeaderboard() {
    document.getElementById('final-score-value').textContent = Math.max(gameState.score, parseInt(localStorage.getItem('t100_best_score') || '0'));
    
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    
    const lbArray = JSON.parse(localStorage.getItem('t100_v2_lb') || '[]');
    if (lbArray.length === 0) {
        list.innerHTML = '<li class="lb-item"><div class="lb-score">No scores yet!</div></li>';
        return;
    }

    lbArray.forEach((entry, idx) => {
        const li = document.createElement('li');
        li.className = 'lb-item';
        li.style.animationDelay = `${idx * 0.1}s`;
        
        if (entry.name === gameState.playerName) {
            li.classList.add('current-player');
        }

        li.innerHTML = `
            <div class="lb-rank-name">
                <span class="lb-rank">#${idx + 1}</span>
                <span class="lb-name">${escapeHTML(entry.name)}</span>
            </div>
            <span class="lb-score">${entry.score} pts</span>
        `;
        list.appendChild(li);
    });
    
    const h2 = document.getElementById('screen-leaderboard').querySelector('h2');
    if(gameState.score < 100) {
        h2.textContent = "Game Over";
        h2.classList.add('text-error');
        h2.style.color = "";
    } else {
        h2.textContent = "Victory!";
        h2.classList.remove('text-error');
        h2.style.color = "var(--accent)";
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag]));
}

// Particle Burst on Correct Answer
function createMiniParticles(parentBtn) {
    const rect = parentBtn.getBoundingClientRect();
    for (let i = 0; i < 15; i++) {
        const p = document.createElement('div');
        p.style.position = 'fixed';
        p.style.width = '8px';
        p.style.height = '8px';
        p.style.background = 'var(--accent)';
        p.style.borderRadius = '50%';
        p.style.left = `${rect.left + rect.width / 2}px`;
        p.style.top = `${rect.top + rect.height / 2}px`;
        p.style.zIndex = 100;
        p.style.pointerEvents = 'none';
        p.style.boxShadow = '0 0 10px var(--accent)';
        
        document.body.appendChild(p);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 150 + 50;
        const duration = Math.random() * 400 + 400;
        
        const keyframes = [
            { transform: `translate(0, 0) scale(1)`, opacity: 1 },
            { transform: `translate(${Math.cos(angle)*speed}px, ${Math.sin(angle)*speed}px) scale(0)`, opacity: 0 }
        ];
        
        const anim = p.animate(keyframes, {
            duration: duration,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        
        anim.onfinish = () => p.remove();
    }
}

// Subsystem: Space Warp Background Continuous Animation
let warpSpeedMultiplier = 1;

function initSpaceWarp() {
    const canvas = document.getElementById('space-canvas');
    const ctx = canvas.getContext('2d');
    
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    window.addEventListener('resize', () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    });

    const numStars = 400;
    const stars = [];

    for(let i = 0; i < numStars; i++) {
        stars.push(createStar(width, height));
    }

    function createStar(w, h) {
        return {
            x: Math.random() * w - w / 2,
            y: Math.random() * h - h / 2,
            z: Math.random() * w,
            radius: Math.random() * 1.5 + 0.5
        };
    }

    function animate() {
        // Clear with slight trailing effect disabled for sharp warp
        ctx.fillStyle = 'rgba(2, 6, 23, 1)'; 
        ctx.fillRect(0, 0, width, height);
        
        const cx = width / 2;
        const cy = height / 2;

        for (let i = 0; i < numStars; i++) {
            let s = stars[i];
            
            s.z -= (2 * warpSpeedMultiplier); // Move towards viewer
            
            if (s.z <= 0) {
                s.x = Math.random() * width - cx;
                s.y = Math.random() * height - cy;
                s.z = width;
            }

            // Perspective division
            let px = (s.x / s.z) * width + cx;
            let py = (s.y / s.z) * width + cy;
            
            // Map z to roughly opacity and size
            let size = (1 - s.z / width) * 3 * s.radius;
            let opacity = 1 - s.z / width;

            // Draw line from previous position to simulate speed blur
            let pz = s.z + (2 * warpSpeedMultiplier);
            let prevX = (s.x / pz) * width + cx;
            let prevY = (s.y / pz) * width + cy;

            ctx.beginPath();
            if(warpSpeedMultiplier > 1) {
                ctx.moveTo(prevX, prevY);
                ctx.lineTo(px, py);
                ctx.lineWidth = size;
                ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                ctx.stroke();
            } else {
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                ctx.fill();
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}
