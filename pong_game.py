import pygame
import sys
import random
import time

starting_speed = 10

class PongGame:
    def __init__(self):
        pygame.init()
        info = pygame.display.Info()
        self.WIDTH, self.HEIGHT = info.current_w, info.current_h
        self.screen = pygame.display.set_mode((self.WIDTH, self.HEIGHT), pygame.FULLSCREEN)
        pygame.display.set_caption("Pong")

        self.WHITE = (255, 255, 255)
        self.BLACK = (0, 0, 0)

        self.paddle_width = int(self.WIDTH * 0.015)
        self.paddle_height = int(self.HEIGHT * 0.2)
        self.ball_size = int(self.WIDTH * 0.025)
        self.last_time = time.time()
        self.last_left_y = self.HEIGHT // 2 
        self.last_right_y = self.HEIGHT // 2
        self.smoothed_left_y = self.HEIGHT // 2
        self.smoothed_right_y = self.HEIGHT // 2

        self.paddleA = pygame.Rect(int(self.WIDTH * 0.03), (self.HEIGHT - self.paddle_height) // 2,
                                   self.paddle_width, self.paddle_height)
        self.paddleB = pygame.Rect(self.WIDTH - self.paddle_width - 30,
                                  (self.HEIGHT - self.paddle_height) // 2, 
                                  self.paddle_width, self.paddle_height)
        self.ball = pygame.Rect((self.WIDTH - self.ball_size) // 2, 
                                (self.HEIGHT - self.ball_size) // 2, 
                                self.ball_size, self.ball_size)

        self.ball = pygame.Rect(self.WIDTH // 2, self.HEIGHT // 2, self.ball_size, self.ball_size)

        self.ball_speed_x, self.ball_speed_y = starting_speed,starting_speed
        self.score = [0, 0]
        self.font = pygame.font.Font(None, int(self.HEIGHT * 0.1))
        self.game_active = False

    def update_paddleA(self, y):
        if y is not None:
          target_y = y - self.paddle_height // 2
          smoothed_y = int(0.7 * self.paddleA.y + 0.3 * target_y)
          self.paddleA.y = max(0, min(self.HEIGHT - self.paddle_height, smoothed_y))

    def update_paddleB(self, y):
        if y is not None:
          target_y = y - self.paddle_height // 2
          smoothed_y = int(0.7 * self.paddleB.y + 0.3 * target_y)
          self.paddleB.y = max(0, min(self.HEIGHT - self.paddle_height, smoothed_y))

    def reset_ball(self):
        self.ball.x = self.WIDTH // 2 - self.ball_size // 2
        self.ball.y = self.HEIGHT // 2 - self.ball_size // 2
        self.ball_speed_x = starting_speed *random.choice([-1, 1])
        self.ball_speed_y = starting_speed * random.choice([-1, 1])

    def display_scores(self):
        score_text_left = self.font.render(str(self.score[0]), True, self.WHITE)
        score_text_right = self.font.render(str(self.score[1]), True, self.WHITE)

        self.screen.blit(score_text_left, (self.WIDTH // 4 - score_text_left.get_width() // 2, 20))
        self.screen.blit(score_text_right, (3 * self.WIDTH // 4 - score_text_right.get_width() // 2, 20))

    def display_wait_message(self):
        message = "Waiting for both hands..."
        text = self.font.render(message, True, self.WHITE)
        text_rect = text.get_rect(center=(self.WIDTH // 2, self.HEIGHT // 2))
        self.screen.blit(text, text_rect)

    def draw(self, screen):
        pygame.draw.rect(screen, (255, 255, 255), self.ball)

    def run(self, hand_tracker):
        try:
            while True:
                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        hand_tracker.release()
                        pygame.quit()
                        sys.exit()
                    elif event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                        hand_tracker.release()
                        pygame.quit()
                        sys.exit()

                hand_positions = hand_tracker.get_hand_positions()
                if hand_positions:
                    left_y = hand_positions['left']
                    right_y = hand_positions['right']

                    if left_y is None or right_y is None:
                        self.game_active = False
                    else:
                        self.game_active = True
                    if left_y is not None:
                        self.last_left_y = hand_tracker.map_to_game_screen(left_y, self.HEIGHT)
                    if right_y is not None:
                        self.last_right_y = hand_tracker.map_to_game_screen(right_y, self.HEIGHT)
                    if self.game_active:
                        if left_y is not None:
                            self.update_paddleA(self.last_left_y)

                        if right_y is not None:
                            self.update_paddleB(self.last_right_y)

                if self.game_active:
                    self.ball.x += self.ball_speed_x
                    self.ball.y += self.ball_speed_y
                    
                    if self.ball.top <= 0 or self.ball.bottom >= self.HEIGHT:
                        self.ball_speed_y *= -1.05

                    if self.ball.colliderect(self.paddleA) or self.ball.colliderect(self.paddleB):
                        self.ball_speed_x *= -1.05
                        
                    if self.ball.left <= 0:
                        self.score[1] += 1
                        self.reset_ball()

                    if self.ball.right >= self.WIDTH:
                        self.score[0] += 1
                        self.reset_ball()
                        
                smooth_factor = 0.7
                self.smoothed_left_y = int(smooth_factor * self.smoothed_left_y + (1 - smooth_factor) * self.last_left_y)
                self.smoothed_right_y = int(smooth_factor * self.smoothed_right_y + (1 - smooth_factor) * self.last_right_y)

                self.screen.fill(self.BLACK)
                pygame.draw.rect(self.screen, self.WHITE, self.paddleA)
                pygame.draw.rect(self.screen, self.WHITE, self.paddleB)
                pygame.draw.ellipse(self.screen, self.WHITE, self.ball)
                pygame.draw.aaline(self.screen, self.WHITE, (self.WIDTH // 2, 0), (self.WIDTH // 2, self.HEIGHT))

                pygame.draw.circle(self.screen, (255, 0, 0), (self.paddleA.centerx, self.smoothed_left_y), 10)  # Rdeči krog
                pygame.draw.circle(self.screen, (0, 0, 255), (self.paddleB.centerx, self.smoothed_right_y), 10)  # Modri krog

                self.display_scores()

                if not self.game_active:
                    self.display_wait_message()

                pygame.display.flip()
        finally:
            hand_tracker.release()

