const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Paddle and Ball Setup
const paddleWidth = 20, paddleHeight = 150;
const ballSize = 30;

let paddleA = { x: 30, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight };
let paddleB = { x: canvas.width - 30 - paddleWidth, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight };
let ball = { x: canvas.width / 2, y: canvas.height / 2, dx: 5, dy: 5, size: ballSize };
let score = { A: 0, B: 0 };

// MediaPipe Setup for Hand Tracking
const video = document.getElementById('inputVideo');
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
  maxNumHands: 2,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  modelComplexity: 1 // Lower complexity for better performance
});

// Hand Tracking Logic
const handTracker = {
  topCrop: 0,
  bottomCrop: canvas.height,
  cropPercentage: 0.8,
  getHandPositions: function(results) {
      const handPositions = { left: null, right: null, leftIndex: null, rightIndex: null };

      if (results.multiHandLandmarks) {
          results.multiHandLandmarks.forEach((landmarks, index) => {
              const handedness = results.multiHandedness[index].label;
              const indexFinger = landmarks[8];  // Index finger tip
              const yCamera = indexFinger.y * canvas.height;

              // Store the position of the index fingers for later drawing
              if (handedness === 'Left') {
                  handPositions.left = this.mapToGameScreen(yCamera, canvas.height);
                  handPositions.leftIndex = { x: indexFinger.x * canvas.width, y: yCamera };
              } else if (handedness === 'Right') {
                  handPositions.right = this.mapToGameScreen(yCamera, canvas.height);
                  handPositions.rightIndex = { x: indexFinger.x * canvas.width, y: yCamera };
              }
          });
      }

      return handPositions;
  },

    mapToGameScreen: function(yCamera, gameHeight) {
        const relativeY = (yCamera - this.topCrop) / (this.bottomCrop - this.topCrop);
        const gameY = Math.floor(relativeY * gameHeight);
        return Math.max(0, Math.min(gameHeight, gameY));
    }
};

// Function to handle the results from MediaPipe and update paddle positions
hands.onResults((results) => {
    const handPositions = handTracker.getHandPositions(results);

    if (handPositions.left !== null) {
        paddleB.y = Math.max(0, Math.min(canvas.height - paddleHeight, handPositions.left - paddleHeight / 2));
    }

    if (handPositions.right !== null) {
        paddleA.y = Math.max(0, Math.min(canvas.height - paddleHeight, handPositions.right - paddleHeight / 2));
    }
    drawFingerPositions(handPositions);
});

// Camera Setup for MediaPipe
const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 1280,
    height: 720
});
camera.start();

// Drawing Functions
function drawPaddle(paddle) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

function drawBall() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
}

function drawScores() {
    ctx.font = '48px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(score.A, canvas.width / 4, 50);
    ctx.fillText(score.B, (3 * canvas.width) / 4, 50);
}

// Update Game Logic
function update() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Ball Collision with Top/Bottom
    if (ball.y - ball.size / 2 <= 0 || ball.y + ball.size / 2 >= canvas.height) {
        ball.dy *= -1;
    }

    // Ball Collision with Paddles
    if (
        (ball.x - ball.size / 2 <= paddleA.x + paddleA.width &&
            ball.y >= paddleA.y &&
            ball.y <= paddleA.y + paddleA.height) ||
        (ball.x + ball.size / 2 >= paddleB.x &&
            ball.y >= paddleB.y &&
            ball.y <= paddleB.y + paddleB.height)
    ) {
        ball.dx *= -1.1; // Speed up the ball after hitting paddle
    }

    // Scoring
    if (ball.x <= 0) {
        score.B++;
        resetBall();
    } else if (ball.x >= canvas.width) {
        score.A++;
        resetBall();
    }
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.dx = 5 * (Math.random() < 0.5 ? 1 : -1);
    ball.dy = 5 * (Math.random() < 0.5 ? 1 : -1);
}

function drawFingerPositions(handPositions) {
  if (handPositions.leftIndex) {
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(canvas.width-10, handPositions.leftIndex.y, 10, 0, Math.PI * 2); // Red circle for left index finger
      ctx.fill();
  }
  if (handPositions.rightIndex) {
      ctx.fillStyle = 'blue';
      ctx.beginPath();
      ctx.arc(10, handPositions.rightIndex.y, 10, 0, Math.PI * 2); // Blue circle for right index finger
      ctx.fill();
  }
}

// Game Loop
let lastTime = 0;
const fps = 60;
function gameLoop(time) {
    let deltaTime = time - lastTime;
    if (deltaTime > 1000 / fps) {
        lastTime = time;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPaddle(paddleA);
        drawPaddle(paddleB);
        drawBall();
        drawScores();
        update();
    }
    requestAnimationFrame(gameLoop);
}
gameLoop(0);

