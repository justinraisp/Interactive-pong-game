import random

x = 1

for i in range(1,10000000):
  if(random.random() < 0.5):
    x *= 1.1
  else:
    x /= 1.1

print(x)