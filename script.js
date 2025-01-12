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
let paddleAHit = false; // Ali je bila žoga zadeta z levim loparjem
let paddleBHit = false; // Ali je bila žoga zadeta z desnim loparjem

let paddleA_previousY = paddleA.y; // Prejšnja pozicija za levi lopar
let paddleB_previousY = paddleB.y; // Prejšnja pozicija za desni lopar

let handsDetected = 0; // Keeps track of the number of hands detected
let gameActive = false; // Indicates whether the game can run
let countdownActive = false; // Ali trenutno poteka odštevanje

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


////////////////////////////
// Ovire 

let obstacle = {};  // Seznam ovir
const obstacleWidth = 5;
const obstacleHeight = 150;
const obstacleSpeed = 1; // Hitrost gibanja ovir navzdol
let obstacleHit = false; // Ali je žoga zadela oviro

// Funkcija za ustvarjanje naključnih ovir na levi ali desni strani
function createObstacle() {
  // Določimo meje za sredinske dve četrtini zaslona
  const quarterWidth = canvas.width / 4;
  const middleStart = quarterWidth;  // Začetek sredinskega dela
  const middleEnd = 3 * quarterWidth; // Konec sredinskega dela

  // Naključno določimo pozicijo X znotraj sredinskega dela zaslona
  const randomX = middleStart + Math.random() * (middleEnd - middleStart);  // Naključno med sredinskima četrtinama
  const randomY = -obstacleHeight;

  // Preverimo, ali že obstaja ovira na tej strani
    obstacle = { x: randomX, y: randomY };
}

// Funkcija za risanje ovir
function drawObstacle() {
  ctx.fillStyle = '#ff6347'; // Barva ovir (rdeča)
  ctx.fillRect(obstacle.x, obstacle.y, obstacleWidth, obstacleHeight);  // Nariši vsako oviro
}

// Funkcija za premikanje ovir
function moveObstacle() {
  obstacle.y += obstacleSpeed; // Premakni oviro navzdol

  // Odstrani ovire, ki so šle izven zaslona
  if (obstacle.y > canvas.height) {
    obstacle = {}; // Remove the obstacle if it goes off the screen
  }
}

// Funkcija za občasno ustvarjanje novih ovir
function maybeCreateObstacle() {
  if (!obstacle.x && !obstacle.y && Math.random() < 0.9) {  // 2% verjetnost, da se pojavi nova ovira vsak frame
      createObstacle();
  }
}


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
  targetY = handY - paddle.height / 2;
  smoothedY = paddle.y * 0.4 + targetY * 0.6;
  paddle.y = Math.max(0, Math.min(gameHeight - paddle.height, smoothedY));
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

  if (handsDetected === 2 && !gameActive && !countdownActive) {
    startCountdown(); // Začni odštevanje
  }
  else if(handsDetected == 2){
    updatePaddlePosition(paddleA, detectedHands, paddleA.x, canvas.height, true);  // Levi lopar
    updatePaddlePosition(paddleB, detectedHands, paddleB.x, canvas.height, false); // Desni lopar
  }
  else {
      drawWaitingMessage(false,0);
      //stopCountdown(); // Prekini odštevanje, če manj kot 2 roki
      gameActive = false; // Deaktiviraj igro
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


function startCountdown() {
  countdownActive = true;
  countdown = 3; // Začetno število sekund

  countdownTimer = setInterval(() => {
      countdown--; // Zmanjšaj čas
      if (countdown <= 0) {
          clearInterval(countdownTimer);
          countdownActive = false;
          gameActive = true; // Aktiviraj igro
          console.log("Odštevanje končano! Začnemo z igro.");
      }
  }, 1000);
}


// Funkcija za prekinitev odštevanja
function stopCountdown() {
  if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownActive = false;
      console.log("Odštevanje prekinjeno.");
  }
}


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

function drawWaitingMessage(hands,time) {
    if (hands) {
        ctx.font = '48px Arial';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText(`Game starts in ${time}...`, canvas.width / 2, canvas.height / 2);
    }
    else {
      ctx.font = '48px Arial';
      ctx.fillStyle = 'red';
      ctx.textAlign = 'center';
      ctx.fillText("Waiting for both hands...", canvas.width / 2, canvas.height / 2);
    }
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
    }, 14000/speed);
  }
}

// Ball Collision with Paddles
function checkPaddleCollision(paddle) {
  // Levi lopar
  if ( paddle == "left"
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
  }

  // Desni lopar
  if ( paddle == "right"
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
      obstacleHit = false;
      paddleAHit = false;
      paddleBHit = false;
  }
  // Preverjanje trkov z oviro
  else if (obstacle.x && obstacle.y && 
    ball.x + ball.size / 2 >= obstacle.x && 
    ball.x - ball.size / 2 <= obstacle.x + obstacleWidth && 
    ball.y + ball.size / 2 >= obstacle.y && 
    ball.y - ball.size / 2 <= obstacle.y + obstacleHeight &&
    !obstacleHit) {
      obstacleHit = true;
      paddleAHit = false;
      paddleBHit = false;
      ball.dy *= -1; // Obrne vertikalno smer žoge
  }

  // Preverjanje trkov z levim loparjem
  else if (ball.x - ball.size / 2 <= paddleA.x + paddleA.width &&
      ball.y >= paddleA.y && ball.y <= paddleA.y + paddleA.height &&
      !paddleAHit) {
      obstacleHit = false;
      paddleAHit = true;
      paddleBHit = false;
      hitSound.play();
      ball.dx *= -1; // Obrne horizontalno smer žoge
      Math.random() < 0.5 ? ball.dy *= 0.92 : ball.dy /= 0.92;

      // Preverimo, ali je žoga zadela sredinski del loparja
      const segmentHeight = paddleA.height / 3;
      const relativeY = ball.y - paddleA.y;

      if (relativeY > segmentHeight && relativeY < 2 * segmentHeight) {
          applySpecialEffect(leftPlayerFunction, ball, 'left');
      } else {
          ball.dx = Math.sign(ball.dx) * speed; // Osveži hitrost
      }

  }

  // Preverjanje trkov z desnim loparjem
  else if (ball.x + ball.size / 2 >= paddleB.x &&
      ball.y >= paddleB.y && ball.y <= paddleB.y + paddleB.height &&
      !paddleBHit) {
      obstacleHit = false;
      paddleAHit = false;
      paddleBHit = true;
      hitSound.play();
      ball.dx *= -1; // Obrne horizontalno smer žoge
      Math.random() < 0.5 ? ball.dy *= 0.92 : ball.dy /= 0.92;

      // Preverimo, ali je žoga zadela sredinski del loparja
      const segmentHeight = paddleB.height / 3;
      const relativeY = ball.y - paddleB.y;

      if (relativeY > segmentHeight && relativeY < 2 * segmentHeight) {
          applySpecialEffect(rightPlayerFunction, ball, 'right');
      } else {
          ball.dx = Math.sign(ball.dx) * speed; // Osveži hitrost
      }
  }

  // Scoring
  else if (ball.x <= 0) {
      score.B++;
      obstacleHit = false;
      paddleAHit = false;
      paddleBHit = false;  
      resetBall();
  } else if (ball.x >= canvas.width) {
      score.A++;
      obstacleHit = false;
      paddleAHit = false;
      paddleBHit = false; 
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
const fps = 75;
function gameLoop(time) {
  let deltaTime = time - lastTime;
  if (deltaTime > 1000 / fps) {
      lastTime = time;

      // Počisti platno
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Vedno nariši sredinsko črto
      drawCenterLine();

      if (gameActive) {
          // Risanje igre, če je aktivna
          drawPaddle(paddleA);
          drawPaddle(paddleB);
          drawBall();
          drawScores();
          moveObstacle();  // Premakni ovire
          drawObstacle();  // Nariši ovire
          maybeCreateObstacle(); // Možnost za ustvarjanje nove ovire
          update();
        }
      else {
          // Prikaži sporočilo "Waiting for both hands"
          drawWaitingMessage(countdownActive, countdown);

          // Risanje elementov igre (loparji, žoga, točke)
          drawPaddle(paddleA);
          drawPaddle(paddleB);
          drawBall();
          drawScores();
          drawObstacle();
      }
  }

  // Nadaljuj animacijo
  requestAnimationFrame(gameLoop);
}
gameLoop(0);
