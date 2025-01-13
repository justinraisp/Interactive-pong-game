const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Paddle and Ball Setup
//const paddleWidth = 10, paddleHeight = 180;
//const ballSize = 30;

// Funkcija za prilagoditev velikosti glede na zaslon
function adjustSize() {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // Nastavimo širino in višino loparja kot del širine zaslona
  const paddleWidth = screenWidth * 0.006; // 2% širine zaslona
  const paddleHeight = screenHeight * 0.25; // 20% višine zaslona

  // Nastavimo velikost žoge kot del širine zaslona
  const ballSize = screenWidth * 0.025; // 5% širine zaslona

  const obstacleWidth = screenWidth * 0.0036;
  const obstacleHeight = screenHeight * 0.2;

  return { paddleWidth, paddleHeight, ballSize, obstacleWidth, obstacleHeight };
}

// Klic funkcije za inicializacijo velikosti
const { paddleWidth, paddleHeight, ballSize, obstacleWidth,obstacleHeight } = adjustSize();

// Funkcija za prilagoditev velikosti ob spremembi velikosti okna
window.addEventListener('resize', function() {
  const { paddleWidth, paddleHeight, ballSize, obstacleWidth,obstacleHeight } = adjustSize();
  // Posodobi lastnosti igre z novimi vrednostmi
});


let selectedSpeed = localStorage.getItem("pongSpeed") || 'medium'; // Privzeta hitrost je 'medium'
let leftPlayerFunction = localStorage.getItem("leftPlayerFunction");
let rightPlayerFunction = localStorage.getItem("rightPlayerFunction");
let targetScore = localStorage.getItem("targetScore") || 11; // Privzeta vrednost je 5

let paddleA = { x: 15, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight };
let paddleB = { x: canvas.width - 15 - paddleWidth, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight };
let ball = { x: canvas.width / 2, y: canvas.height / 2, dx: 5, dy: 5, size: ballSize };
let score = { A: 0, B: 0 };
let paddleAHit = false; // Ali je bila žoga zadeta z levim loparjem
let paddleBHit = false; // Ali je bila žoga zadeta z desnim loparjem
let numberOfHits = 0; // Število zadetkov

let paddleA_previousY = paddleA.y; // Prejšnja pozicija za levi lopar
let paddleB_previousY = paddleB.y; // Prejšnja pozicija za desni lopar

let handsDetected = 0; // Keeps track of the number of hands detected
let gameActive = false; // Indicates whether the game can run
let countdownActive = false; // Ali trenutno poteka odštevanje
let gameEnd = false; // Ali je igra končana
let winner = null; // Zmagovalec igre

let countdown = 0; // Odštevalnik (v sekundah)
let countdownInterval = null; // Interval za odštevanje
let invisible = false;
let spin = false;
let countdownTimer = null; 

let currentGesture = null; // Trenutno zaznana gesta
let gestureStartTime = null; // Čas začetka zaznavanja geste
const gestureHoldDuration = 3000; // Trajanje v milisekundah (3 sekunde)
const wiggleRoom = 50; // Prostor za odmik od roba zaslona
const cropPercentage = 0.8;
const delayGesture = 3000; // Zamik za zaznavanje geste
let delayPassed = false;

const hitSound = new Audio('sounds/hit.mp3');
const wallSound = new Audio('sounds/wall.wav');
const victorySound = new Audio('sounds/victory.mp3');

const speedOptions = {
  slow: 4,   // Počasna hitrost
  medium: 7, // Srednja hitrost
  fast: 10    // Hitro hitrost
};

let speed = speedOptions[selectedSpeed];
let startSpeed = speedOptions[selectedSpeed];

function setBallSpeed() {
  ball.dx = speed * (Math.random() < 0.5 ? 1 : -1); // Negativni ali pozitivni smeri
  ball.dy = speed * (Math.random() < 0.5 ? 1 : -1); // Negativni ali pozitivni smeri
}

setBallSpeed();




////////////////////////////
// Ovire 

let obstacle = {};  // Seznam ovir
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


function mapToGameScreen(y_camera, gameHeight, cropPercentage) {
  // Izračunaj zgornjo in spodnjo zarezo
  const topCrop = Math.floor((1 - cropPercentage) / 2 * gameHeight);
  const bottomCrop = Math.floor((1 + cropPercentage) / 2 * gameHeight);

  // Preslika y-koordinate iz kamere v prostor igre
  const relativeY = (y_camera - topCrop) / (bottomCrop - topCrop);
  const gameY = Math.floor(relativeY * gameHeight);

  // Prepreči, da bi y-koordinata presegla meje zaslona igre
  return Math.max(0, Math.min(gameHeight, gameY));
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
function updatePaddlePosition(paddle, hands, paddleX, gameHeight, isLeftPaddle,cropPercentage) {
  const closestHand = getClosestHand(hands, paddleX, isLeftPaddle);

  if (!closestHand) return; // Če ni najdene ustrezne roke, ne premikaj loparja

  // Mapiranje y-koordinate roke na višino zaslona
  // const handY = mapToGameScreen(closestHand.y * canvas.height, gameHeight, wiggleRoom);
  //const handY = closestHand.y * gameHeight;
  const handY = mapToGameScreen(closestHand.y * gameHeight, gameHeight, cropPercentage);
  targetY = handY - paddle.height / 2;
  smoothedY = paddle.y * 0.4 + targetY * 0.6;
  paddle.y = Math.max(0, Math.min(gameHeight - paddle.height, smoothedY));
}


function isHandOpen(landmarks) {
  // Točke, ki predstavljajo členke prstov
  const wrist = landmarks[0]; // Zapestje
  const thumb = [landmarks[1], landmarks[2], landmarks[3], landmarks[4]]; // Členki palca
  const index = [landmarks[5], landmarks[6], landmarks[7], landmarks[8]]; // Členki kazalca
  const middle = [landmarks[9], landmarks[10], landmarks[11], landmarks[12]]; // Členki sredinca
  const ring = [landmarks[13], landmarks[14], landmarks[15], landmarks[16]]; // Členki prstanca
  const pinky = [landmarks[17], landmarks[18], landmarks[19], landmarks[20]]; // Členki mezinca

  // Funkcija za preverjanje, ali so članice v pravilnem vrstnem redu (nižji y)
  function isFingerOpen(finger) {
    for (let i = 2; i < finger.length; i++) {
      knucle1 = finger[i];
      x1 = knucle1.x;
      y1 = knucle1.y;
      knucle0 = finger[i - 2];
      x0 = knucle0.x;
      y0 = knucle0.y;
      if (y1 > y0) {
        return false; // Če je členek višji ali na istem nivoju kot prejšnji, roka ni odprta
      }
    }
    return true;
  }

  // Preverimo, ali so vsi prsti odprti
  if (
    isFingerOpen(thumb) &&
    isFingerOpen(index) &&
    isFingerOpen(middle) &&
    isFingerOpen(ring) &&
    isFingerOpen(pinky)
  ) {
    return true; // Odprta dlan
  }

  return false; // Roka ni odprta
}



function isHandClosed(landmarks) {
  // Izračun razdalj od konic prstov do zapestja
  const wrist = landmarks[0]; // Zapestje
  const thumbTip = landmarks[4]; // Konica palca
  const indexTip = landmarks[8]; // Konica kazalca
  const middleTip = landmarks[12]; // Konica sredinca
  const ringTip = landmarks[16]; // Konica prstanca
  const pinkyTip = landmarks[20]; // Konica mezinca

  // Funkcija za izračun razdalje med dvema točkama
  function distance(pointA, pointB) {
    return Math.sqrt(
      Math.pow(pointA.x - pointB.x, 2) +
      Math.pow(pointA.y - pointB.y, 2) +
      Math.pow(pointA.z - pointB.z, 2)
    );
  }

  // Razdalje od konic prstov do zapestja
  const thumbDistance = distance(wrist, thumbTip);
  const indexDistance = distance(wrist, indexTip);
  const middleDistance = distance(wrist, middleTip);
  const ringDistance = distance(wrist, ringTip);
  const pinkyDistance = distance(wrist, pinkyTip);

  // Prag za zaprtost dlani (nastavi glede na velikost platna ali poskuse)
  const threshold = 0.2; // Eksperimentalna vrednost

  // Če so vse razdalje manjše od praga, je roka zaprta v pest
  if (
    thumbDistance < threshold &&
    indexDistance < threshold &&
    middleDistance < threshold &&
    ringDistance < threshold &&
    pinkyDistance < threshold
  ) {
    return true; // Zaprta roka (pest)
  }
  return false; // Roka ni zaprta v pest
}

// Hand Tracking Logic
hands.onResults((results) => {
  const detectedFingers = [];
  const detectedHands = [];
  const Hands = [];
  if (results.multiHandLandmarks) {
      results.multiHandLandmarks.forEach((landmarks) => {
          const indexFinger = landmarks[8]; // Index finger tip
          detectedFingers.push({ x: indexFinger.x * canvas.width, y: indexFinger.y });
          Hands.push(landmarks);
          for (let i = 0; i < landmarks.length; i++) {
              const landmark = landmarks[i];
              detectedHands.push({ x: landmark.x * canvas.width, y: landmark.y * canvas.height });
          }
      });
  }
  fingersDetected = detectedFingers.length;
  handsDetected = detectedHands.length;
  if (fingersDetected === 2 && !gameActive && !countdownActive && !gameEnd) {
    startCountdown(); // Začni odštevanje
  }
  else if(fingersDetected == 2 && !gameEnd){
    updatePaddlePosition(paddleA, detectedFingers, paddleA.x, canvas.height, true,cropPercentage);  // Levi lopar
    updatePaddlePosition(paddleB, detectedFingers, paddleB.x, canvas.height, false,cropPercentage); // Desni lopar
  }
  else if(gameEnd && handsDetected > 0 && delayPassed){
    //drawHandPosition(detectedHands.slice(0,21));
    const gesture = detectHandGesture(Hands[0]);
    handleGesture(gesture);
    return
  }
  else {
    countdownActive = false; // Deaktiviraj odštevanje
    stopCountdown(); // Prekini odštevanje, če manj kot 2 roki
    gameActive = false; // Deaktiviraj igro
  }
  drawFingerPositions(detectedFingers,true);
});

function delay(delayTime) {
  // Preverimo, ali je delay že minil
  if (!delayPassed) {
    // Nastavimo časovni zamik
    setTimeout(() => {
      delayPassed = true;
    }, delayTime); // delayTime je časovni zamik v milisekundah
  }
}

function detectHandGesture(hand) {
  if (!hand) return null;

  const isFist = isHandClosed(hand);
  const isOpenPalm = isHandOpen(hand);
  if (isFist) return 'fist';
  if (isOpenPalm) return 'openPalm';
  return null;
}


function handleGesture(gesture) {
  const now = Date.now();
  if (gesture === currentGesture) {
    // Če je gesta enaka prejšnji in časovno obdobje preseženo
    if (gestureStartTime && now - gestureStartTime >= gestureHoldDuration) {
      if (gesture === 'openPalm') {
        window.location.href = 'index.html'; // Preusmeritev na začetno stran
      } else if (gesture === 'fist') {
        restartGame(); // Funkcija za ponovni začetek igre
      }
    }
  } else {
    // Če je gesta drugačna, ponastavi časovnik
    currentGesture = gesture;
    gestureStartTime = gesture ? now : null; // Če ni geste, ponastavi časovnik
  }
}


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
      }
  }, 1000);
}


// Funkcija za prekinitev odštevanja
function stopCountdown() {
  if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownActive = false;
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
    ctx.font = '52px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(score.A, canvas.width / 3, 70);
    ctx.fillText(score.B, (2 * canvas.width) / 3, 70);
}

function drawWaitingMessage(hands,time) {
    if (hands) {
        ctx.font = '48px Arial';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText(`Game starts in ${time}...`, canvas.width / 2, canvas.height / 2 - 50);
    }
    else {
      ctx.font = '48px Arial';
      ctx.fillStyle = 'red';
      ctx.textAlign = 'center';
      ctx.fillText("Waiting for both hands...", canvas.width / 2, canvas.height / 2 - 50);
    }
}

function drawVictory(winner) {
  ctx.font = '48px Arial';
  ctx.fillStyle = 'red';
  ctx.textAlign = 'center';
  ctx.fillText(`VICTORY!`, canvas.width / 2, canvas.height / 3);
  ctx.fillText(`${winner} won`, canvas.width / 2, canvas.height / 2);
  ctx.font = '24px Arial';
  ctx.fillStyle = 'white';
  ctx.fillText("Make a fist for 3 seconds for a rematch", canvas.width / 2, canvas.height / 2 + 60);
  ctx.fillText("Make an open hand for 3 seconds to go to main menu", canvas.width / 2, canvas.height / 2 + 100);
}


function drawFingerPositions(hands, finger) {
  const sideBoundary = canvas.width / 2; // Meja med levo in desno polovico zaslona

  hands.forEach(hand => {
      // Določitev barve glede na pozicijo roke
      const isLeftHand = hand.x < sideBoundary;
      ctx.fillStyle = isLeftHand ? 'red' : 'blue'; // Rdeča za levo, modra za desno
      // Nariši krog na poziciji prsta
      if (isLeftHand && finger) {
          x = canvas.width -10
      }
      else if (!isLeftHand && finger) {
          x = 10
      }
      else {
        x = hand.x * canvas.width;
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
  if (effectType === 'fasterHit') {
      ball.dx = Math.sign(ball.dx) * speed * 2.5; // Povečaj hitrost žoge
  } else if (effectType === 'invisibleBall') {
      invisible = true;
      ball.dx = Math.sign(ball.dx) * speed * 1.25;
      setTimeout(() => {
        invisible = false;  // Po 1 sekundi nastavimo žogo spet na vidno
    }, 13500/speed);
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
      wallSound.play();
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
      numberOfHits++;
      if (numberOfHits % 5 == 0) {
        speed *= 1.15; // Povečaj hitrost žoge vsakih 5 udarcev
      }

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
      numberOfHits++;
      if (numberOfHits % 5 == 0) {
        speed *= 1.15; // Povečaj hitrost žoge vsakih 5 udarcev
      }

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
      speed = startSpeed; // Ponastavi hitrost
      if (score.B >= targetScore) {
        gameEnd = true;
        winner = 'Player B';
        victorySound.play();
        delay(delayGesture);
      }  
      resetBall();
  } else if (ball.x >= canvas.width) {
      score.A++;
      obstacleHit = false;
      paddleAHit = false;
      paddleBHit = false;
      speed = startSpeed; // Ponastavi hitrost
      if (score.A >= targetScore) {
        gameEnd = true;
        winner = 'Player A';
        victorySound.play();
        delay(delayGesture);
      }
      resetBall();
  }
}


function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.dx = 5 * (Math.random() < 0.5 ? 1 : -1);
    ball.dy = 5 * (Math.random() < 0.5 ? 1 : -1);
}

function startRematch() {
  score.A = 0;
  score.B = 0;
  resetBall();
  gameActive = true;
  countdownActive = false;
  obstacle = {}; // Reset obstacles
  startCountdown();
}

// Handle end-game logic with gestures
function drawHandPosition(hands) {
  if (!hands || hands.length === 0) return;
    for (let j = 0; j < hands.length; j++) { // Iteracija skozi vse točke v roki
        const point = hands[j]; // Posamezna točka (landmark)
        ctx.beginPath();
        if (point.x < canvas.width / 2) {
          x = canvas.width - point.x;
        }
        else if (point.x > canvas.width / 2) {
          x = canvas.width- point.x;
        }
        ctx.arc(x, point.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }
}

// Funkcija za izvedbo dejanj na podlagi zaznane geste
function handleEndGameGesture(gesture) {
  if (gesture === 'openPalm') {
    // Če je zaznana odprta dlan, preusmeri na začetno stran
    window.location.href = 'index.html';
  } else if (gesture === 'fist') {
    // Če je zaznana pest, ponovno zaženi igro
    restartGame();
  }
}

// Example functions to restart game or show main menu
function restartGame() {
  score.A = 0;
  score.B = 0;
  resetBall();
  gameEnd = false;
  gameActive = true;
  countdownActive = false;
  obstacle = {}; // Reset obstacles
  startCountdown(); // Add logic to reset scores, ball position, etc.
}

// Game Loop
let lastTime = 0;
const fps = 90;
function gameLoop(time) {
  let deltaTime = time - lastTime;
  if (deltaTime > 1000 / fps) {
      lastTime = time;

      // Počisti platno
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (gameEnd) {
        // Draw victory screen when game ends
        drawScores();
        drawVictory(score.A > score.B ? 'Player A' : 'Player B');
      }
      else if (gameActive) {
          // Risanje igre, če je aktivna
          drawPaddle(paddleA);
          drawPaddle(paddleB);
          drawBall();
          drawScores();
          drawCenterLine();
          moveObstacle();  // Premakni ovire
          drawObstacle();  // Nariši ovire
          maybeCreateObstacle(); // Možnost za ustvarjanje nove ovire
          update();
        }
      else {
          drawWaitingMessage(countdownActive, countdown);
          drawPaddle(paddleA);
          drawPaddle(paddleB);
          drawCenterLine();
          drawBall();
          drawScores();
          drawObstacle();
      }
  }

  requestAnimationFrame(gameLoop);
}
gameLoop(0);
