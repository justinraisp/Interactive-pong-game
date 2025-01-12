const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Paddle and Ball Setup
const paddleWidth = 10, paddleHeight = 180;
const ballSize = 30;

let selectedSpeed = localStorage.getItem("pongSpeed") || 'medium'; // Privzeta hitrost je 'medium'
let leftPlayerFunction = localStorage.getItem("leftPlayerFunction");
let rightPlayerFunction = localStorage.getItem("rightPlayerFunction");

let paddleA = { x: 15, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight };
let paddleB = { x: canvas.width - 15 - paddleWidth, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight };
let ball = { x: canvas.width / 2, y: canvas.height / 2, dx: 5, dy: 5, size: ballSize };
let score = { A: 0, B: 0 };

let handsDetected = 0; // Keeps track of the number of hands detected
let gameActive = false; // Indicates whether the game can run

let countdown = 0; // Odštevalnik (v sekundah)
let countdownInterval = null; // Interval za odštevanje
let invisible = false;
let spin = false;

const hitSound = new Audio('sounds/hit.mp3');
const wallSound = new Audio('sounds/wall.wav');

const speedOptions = {
  slow: 4,   // Počasna hitrost
  medium: 7, // Srednja hitrost
  fast: 10    // Hitro hitrost
};

const speed = speedOptions[selectedSpeed];

function setBallSpeed() {
  ball.dx = speed * (Math.random() < 0.5 ? 1 : -1); // Negativni ali pozitivni smeri
  ball.dy = speed * (Math.random() < 0.5 ? 1 : -1); // Negativni ali pozitivni smeri
}

setBallSpeed();

// MediaPipe Setup for Hand Tracking
const video = document.getElementById('inputVideo');
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 2,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
    modelComplexity: 1
});

// Function to find the closest hand for a given paddle
function getClosestHand(hands, paddleX, isLeftPaddle) {
  if (!hands || hands.length === 0) return null;

  const sideBoundary = canvas.width / 2; // Meja med levo in desno stranjo zaslona
  let closestHand = null;
  let minDistance = Infinity;

  hands.forEach(hand => {
      // Preveri, ali je roka na pravilni strani (glede na lopar)
      const isLeftHand = hand.x < sideBoundary;
      if ((isLeftPaddle && !isLeftHand) || (!isLeftPaddle && isLeftHand)) {
          // Izračunaj razdaljo do loparja
          const distance = Math.abs(hand.x - paddleX);
          if (distance < minDistance) {
              minDistance = distance;
              closestHand = hand;
          }
      }
  });

  return closestHand;
}


// Update paddle position based on closest hand
function updatePaddlePosition(paddle, hands, paddleX, gameHeight, isLeftPaddle) {
  const closestHand = getClosestHand(hands, paddleX, isLeftPaddle);

  if (!closestHand) return; // Če ni najdene ustrezne roke, ne premikaj loparja

  // Mapiranje y-koordinate roke na višino zaslona
  const handY = closestHand.y * gameHeight;
  paddle.y = Math.max(0, Math.min(gameHeight - paddle.height, handY - paddle.height / 2));
}


// Hand Tracking Logic
hands.onResults((results) => {
    const detectedHands = [];
    if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach((landmarks) => {
            const indexFinger = landmarks[8]; // Index finger tip
            detectedHands.push({ x: indexFinger.x * canvas.width, y: indexFinger.y });
        });
    }

    handsDetected = detectedHands.length;

    if (handsDetected === 2) {
        gameActive = true; // Activate game if two hands are detected
        updatePaddlePosition(paddleA, detectedHands, paddleA.x, canvas.height, true);  // Levi lopar
        updatePaddlePosition(paddleB, detectedHands, paddleB.x, canvas.height, false); // Desni lopar
        
    } else {
        gameActive = false; // Deactivate game if less than two hands are detected
    }

    drawFingerPositions(detectedHands);
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


function drawBall() {
    if (invisible) {
      return
    }
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

function drawWaitingMessage() {
    ctx.font = '48px Arial';
    ctx.fillStyle = 'red';
    ctx.textAlign = 'center';
    ctx.fillText("Waiting for both hands...", canvas.width / 2, canvas.height / 2);
}

function drawFingerPositions(hands) {
  const sideBoundary = canvas.width / 2; // Meja med levo in desno polovico zaslona

  hands.forEach(hand => {
      // Določitev barve glede na pozicijo roke
      const isLeftHand = hand.x < sideBoundary;
      ctx.fillStyle = isLeftHand ? 'red' : 'blue'; // Rdeča za levo, modra za desno
      // Nariši krog na poziciji prsta
      if (isLeftHand) {
          x = canvas.width -10
      }
      else {
          x = 10
      }
      ctx.beginPath();
      ctx.arc(x, hand.y * canvas.height, 10, 0, Math.PI * 2);
      ctx.fill();
  });
}


// Function to draw the paddle with different colors for top and bottom halves
function drawPaddle(paddle) {
  const colors = ['#ffffff', '#ff6347', '#ffffff']; // Bela (zgoraj), rdeča (sredina), bela (spodaj)
  const segmentHeight = paddle.height / 3; // Višina vsakega segmenta

  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(paddle.x, paddle.y + i * segmentHeight, paddle.width, segmentHeight);
  }
}


// Spremenljivke za spremljanje, ali je bil uporabljen poseben udarec
let specialHitUsedLeft = false;
let specialHitUsedRight = false;

// Funkcija za posebne učinke (hitrejši udarec, spin, nevidna žoga, naključna smer)
function applySpecialEffect(effectType, ball, paddle) {
  console.log("Applying special effect:", effectType); // Odstrani "upper/lower"
  if (effectType === 'fasterHit') {
      ball.dx = Math.sign(ball.dx) * speed * 2.5; // Povečaj hitrost žoge
  } else if (effectType === 'invisibleBall') {
      invisible = true;
      ball.dx = Math.sign(ball.dx) * speed * 1.25;
      setTimeout(() => {
        invisible = false;  // Po 1 sekundi nastavimo žogo spet na vidno
    }, 15000/speed);
  }
}

// Ball Collision with Paddles
function checkPaddleCollision() {
  // Levi lopar
  if (
      ball.x - ball.size / 2 <= paddleA.x + paddleA.width &&
      ball.y + ball.size / 2>= paddleA.y &&
      ball.y - ball.size / 2<= paddleA.y + paddleA.height
  ) {
      // Preverimo, ali je žoga zadela sredinski del loparja
      const segmentHeight = paddleA.height / 3;
      const relativeY = ball.y - paddleA.y;

      if (relativeY > segmentHeight && relativeY < 2 * segmentHeight) {
          console.log("Sredinski del loparja (levo)");
          applySpecialEffect(leftPlayerFunction, ball, 'left');
      }
      else {
        ball.dx = Math.sign(ball.dx) * speed
      }
      ball.dx *= -1; // Obrne horizontalno smer žoge
      Math.random() < 0.5 ? ball.dy *= 0.75 : ball.dy *= 1.25;
  }

  // Desni lopar
  if (
      ball.x + ball.size / 2 >= paddleB.x &&
      ball.y + ball.size >= paddleB.y &&
      ball.y - ball.size <= paddleB.y + paddleB.height
  ) {
      // Preverimo, ali je žoga zadela sredinski del loparja
      const segmentHeight = paddleB.height / 3;
      const relativeY = ball.y - paddleB.y;

      if (relativeY > segmentHeight && relativeY < 2 * segmentHeight) {
          console.log("Sredinski del loparja (desno)");
          applySpecialEffect(rightPlayerFunction, ball, 'right');
      }
      else {
        ball.dx = Math.sign(ball.dx) * speed
      }
      ball.dx *= -1; // Obrne horizontalno smer žoge
      Math.random() < 0.5 ? ball.dy *= 0.8 : ball.dy *= 1.2;
  }
}

function drawCenterLine() {
  ctx.strokeStyle = '#fff'; // Bela barva črte
  ctx.lineWidth = 2; // Debelina črte
  ctx.setLineDash([10, 10]); // Naredi črto prekinjeno (črtica-pavza)
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0); // Začni na sredini platna (zgoraj)
  ctx.lineTo(canvas.width / 2, canvas.height); // Potegni do dna
  ctx.stroke(); // Nariši črto
  ctx.closePath();
}


// Update Game Logic
function update() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Ball Collision with Top/Bottom
    if (ball.y - ball.size / 2 <= 0 || ball.y + ball.size / 2 >= canvas.height) {
      ball.dy *= -1;
      wallSound.play();
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
      hitSound.play();
      checkPaddleCollision();
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

// Game Loop
let lastTime = 0;
const fps = 60;
function gameLoop(time) {
    let deltaTime = time - lastTime;
    if (deltaTime > 1000 / fps) {
        lastTime = time;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCenterLine();

        if (gameActive) {
            drawPaddle(paddleA);
            drawPaddle(paddleB);
            drawBall();
            drawScores();
            update();
        } else {
            drawWaitingMessage(); // Show waiting message if less than two hands are detected
            drawPaddle(paddleA);
            drawPaddle(paddleB);
            drawBall();
            drawScores();
        }
    }
    requestAnimationFrame(gameLoop);
}
gameLoop(0);
