import pygame
from hand_tracking import HandTracker
from pong_game import PongGame

def main():
    tracker = HandTracker()
    game = PongGame()
    screen = game.screen
    while True:
        hands = tracker.get_hand_positions()
        if hands:
            game.update_paddleA(hands['left'])
            game.update_paddleB(hands['right'])
        
        game.draw(screen)

        pygame.display.flip()
        pygame.time.Clock().tick(70)

        game.run(tracker)

if __name__ == "__main__":
    main()
