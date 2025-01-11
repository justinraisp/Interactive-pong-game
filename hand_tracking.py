import cv2
import mediapipe as mp
import pygame

class HandTracker:
    def __init__(self):
        self.cap = cv2.VideoCapture(0)
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(min_detection_confidence=0.7, min_tracking_confidence=0.7)

        ret, frame = self.cap.read()
        if ret:
            self.camera_height, self.camera_width = frame.shape[:2]
        else:
            self.camera_height, self.camera_width = 720, 1280 

        self.crop_percentage = 0.8
        self.top_crop = int((1 - self.crop_percentage) / 2 * self.camera_height)
        self.bottom_crop = int((1 + self.crop_percentage) / 2 * self.camera_height)

    def map_to_game_screen(self, y_camera, game_height):
        """Preslika y-koordinate iz kamere v prostor igre."""
        relative_y = (y_camera - self.top_crop) / (self.bottom_crop - self.top_crop)
        game_y = int(relative_y * game_height)
        return max(0, min(game_height, game_y))

    def get_hand_positions(self):
        ret, frame = self.cap.read()
        if not ret:
            return None
        
        frame = cv2.flip(frame, 1)  # Obrni okvir za bolj naravno gibanje
        cropped_frame = frame[self.top_crop:self.bottom_crop, :]

        rgb_frame = cv2.cvtColor(cropped_frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)

        hands_positions = {'left': None, 'right': None}

        if results.multi_hand_landmarks:
            for hand_landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
                label = handedness.classification[0].label
                index_finger_tip = hand_landmarks.landmark[self.mp_hands.HandLandmark.INDEX_FINGER_TIP]
                y_camera = int(index_finger_tip.y * (self.bottom_crop - self.top_crop)) + self.top_crop

                if label == 'Left':
                    hands_positions['left'] = y_camera
                elif label == 'Right':
                    hands_positions['right'] = y_camera

        return hands_positions

    def release(self):
        """Sprosti kamero ob zaključku igre."""
        self.cap.release()
