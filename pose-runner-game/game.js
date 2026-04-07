const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const currentPoseElement = document.getElementById('current-pose');

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_HEIGHT = 50;

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let gameSpeed = 5;
let animationId;
let frames = 0;

// -----------------------------------------
// Teachable Machine AI Setup (Placeholder)
// -----------------------------------------
// Replace this URL with your trained model's URL when ready
const URL = "https://teachablemachine.withgoogle.com/models/YOUR_MODEL_ID/";
let model, webcam, ctxWebcam, labelContainer, maxPredictions;
let isModelLoaded = false;
let isUseWebcam = false; // Toggle to false to use keyboard

async function initModel() {
    // This function will be triggered later when you have the actual model URL
    // For now, we wrap it in try-catch so it won't crash if URL is invalid
    try {
        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";

        model = await tmPose.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        // Setup webcam
        const size = 200;
        const flip = true;
        webcam = new tmPose.Webcam(size, size, flip);
        await webcam.setup();
        await webcam.play();
        window.requestAnimationFrame(loopWebcam);

        // Append canvas to DOM
        const webcamContainer = document.getElementById("webcam-container");
        webcamContainer.appendChild(webcam.canvas);
        isModelLoaded = true;
        isUseWebcam = true;
        console.log("Model and webcam loaded successfully.");
    } catch (error) {
        console.warn("Model could not be loaded. Please check the URL or use Keyboard mode.", error);
        isUseWebcam = false;
    }
}

async function loopWebcam(timestamp) {
    if(!isUseWebcam || gameState === 'GAMEOVER') return;

    webcam.update();
    await predictPose();
    window.requestAnimationFrame(loopWebcam);
}

async function predictPose() {
    // predict can take in an image, video or canvas html element
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);

    // Find the class with the highest probability
    let highestProb = 0;
    let bestClass = "NORMAL";

    for (let i = 0; i < maxPredictions; i++) {
        if (prediction[i].probability > highestProb) {
            highestProb = prediction[i].probability;
            bestClass = prediction[i].className.toUpperCase();
        }
    }

    // Map model classes to our game POSES enums
    // Make sure your Teachable Machine classes are named similar to these!
    if (highestProb > 0.7) { // Threshold
        if (bestClass.includes("DUCK") || bestClass.includes("蹲")) updatePoseUI(POSES.DUCK);
        else if (bestClass.includes("HAND") || bestClass.includes("手")) updatePoseUI(POSES.HANDSUP);
        else if (bestClass.includes("LEG") || bestClass.includes("腳")) updatePoseUI(POSES.ONELEG);
        else updatePoseUI(POSES.NORMAL);
    }
}

// -----------------------------------------
// Game Logic
// -----------------------------------------

// Enums for Poses
const POSES = {
    NORMAL: 'NORMAL',
    DUCK: 'DUCK',
    HANDSUP: 'HANDSUP',
    ONELEG: 'ONELEG'
};

// Current detected pose (simulated via keyboard for now)
let currentPose = POSES.NORMAL;

// Colors mapping
const POSE_COLORS = {
    [POSES.NORMAL]: '#cccccc',
    [POSES.DUCK]: '#4facfe', // Blue
    [POSES.HANDSUP]: '#ff4b2b', // Red
    [POSES.ONELEG]: '#00b09b'  // Green
};

// Player Object
const player = {
    x: 100,
    y: CANVAS_HEIGHT - GROUND_HEIGHT - 60,
    width: 40,
    height: 60,

    draw() {
        ctx.fillStyle = '#ffffff';
        // Change player appearance based on current pose
        switch(currentPose) {
            case POSES.NORMAL:
                ctx.fillRect(this.x, this.y, this.width, this.height);
                break;
            case POSES.DUCK:
                // Draw shorter and wider
                ctx.fillRect(this.x, this.y + 30, this.width + 20, this.height - 30);
                break;
            case POSES.HANDSUP:
                // Draw taller
                ctx.fillRect(this.x, this.y - 20, this.width, this.height + 20);
                break;
            case POSES.ONELEG:
                // Draw narrower
                ctx.fillRect(this.x + 10, this.y, this.width - 20, this.height);
                break;
        }
    }
};

// Obstacles Array
let obstacles = [];

class Obstacle {
    constructor() {
        this.x = CANVAS_WIDTH;
        this.width = 60;
        this.height = 100;

        // Randomly pick required pose (excluding NORMAL)
        const poseKeys = Object.keys(POSES).filter(k => k !== 'NORMAL');
        this.requiredPose = POSES[poseKeys[Math.floor(Math.random() * poseKeys.length)]];

        // Adjust geometry based on required pose
        switch(this.requiredPose) {
            case POSES.DUCK:
                // High laser (need to duck)
                this.y = CANVAS_HEIGHT - GROUND_HEIGHT - 120;
                this.height = 40;
                break;
            case POSES.HANDSUP:
                // Wall with hand marks (need hands up)
                this.y = CANVAS_HEIGHT - GROUND_HEIGHT - 100;
                this.height = 100;
                break;
            case POSES.ONELEG:
                // Narrow door (need to stand narrow)
                this.y = CANVAS_HEIGHT - GROUND_HEIGHT - 80;
                this.height = 80;
                break;
        }
    }

    draw() {
        ctx.fillStyle = POSE_COLORS[this.requiredPose];
        ctx.globalAlpha = 0.7;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.globalAlpha = 1.0;

        // Draw icon or text indicating requirement
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(this.requiredPose, this.x, this.y - 10);
    }

    update() {
        this.x -= gameSpeed;
        this.draw();
    }
}

// Controls (Mocking Model Input)
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (gameState === 'START' || gameState === 'GAMEOVER') {
            resetGame();
        }
    }

    // Only allow pose changes if playing
    if (gameState === 'PLAYING') {
        let newPose = currentPose;
        if (e.key.toLowerCase() === 'n') newPose = POSES.NORMAL;
        if (e.key.toLowerCase() === 'd') newPose = POSES.DUCK;
        if (e.key.toLowerCase() === 'h') newPose = POSES.HANDSUP;
        if (e.key.toLowerCase() === 'o') newPose = POSES.ONELEG;

        updatePoseUI(newPose);
    }
});

function updatePoseUI(newPose) {
    if (currentPose === newPose) return;
    currentPose = newPose;

    // Update UI
    currentPoseElement.className = `pose-indicator pose-${newPose.toLowerCase()}`;
    currentPoseElement.innerText = `${newPose}`;
}

// Collision Detection
function checkCollision(player, obstacle) {
    // Basic AABB Collision
    let pX = player.x;
    let pY = player.y;
    let pW = player.width;
    let pH = player.height;

    // Adjust player hit box based on pose
    if(currentPose === POSES.DUCK) {
        pY += 30; pH -= 30; pW += 20;
    } else if (currentPose === POSES.HANDSUP) {
        pY -= 20; pH += 20;
    } else if (currentPose === POSES.ONELEG) {
        pX += 10; pW -= 20;
    }

    const collision = pX < obstacle.x + obstacle.width &&
                      pX + pW > obstacle.x &&
                      pY < obstacle.y + obstacle.height &&
                      pY + pH > obstacle.y;

    if (collision) {
        // If collision happens, check if the current pose matches the required pose
        // In a real game, you might want a "safe zone" or "action zone" instead of purely relying on hitting it.
        // For this prototype: if they overlap, but the pose is CORRECT, they pass through safely.
        if (currentPose === obstacle.requiredPose) {
            return false; // Safe!
        }
        return true; // Crash!
    }
    return false;
}

function drawGround() {
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
}

function handleObstacles() {
    // Generate new obstacles
    if (frames % 120 === 0) { // spawn rate
        obstacles.push(new Obstacle());
    }

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.update();

        // Check collision
        if (checkCollision(player, obs)) {
            gameOver();
            return;
        }

        // Remove off-screen obstacles and add score
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            i--;
            score += 10;
            scoreElement.innerText = score;

            // Increase speed slightly
            if(score % 50 === 0) gameSpeed += 0.5;
        }
    }
}

function resetGame() {
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    obstacles = [];
    score = 0;
    gameSpeed = 5;
    frames = 0;
    scoreElement.innerText = score;
    updatePoseUI(POSES.NORMAL);
    animate();
}

function gameOver() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    gameOverScreen.classList.remove('hidden');
    finalScoreElement.innerText = score;
}

function animate() {
    if (gameState !== 'PLAYING') return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawGround();
    player.draw();
    handleObstacles();

    frames++;
    animationId = requestAnimationFrame(animate);
}

// Initial draw
drawGround();
player.draw();
