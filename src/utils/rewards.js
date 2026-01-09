// Reward calculation functions for different regimes

export function calculateSparseReward(agentPos, goalPos, threshold = 30) {
  const distance = Math.sqrt(
    Math.pow(agentPos.x - goalPos.x, 2) + Math.pow(agentPos.y - goalPos.y, 2)
  );
  return distance < threshold ? 1.0 : 0.0;
}

export function calculateDistanceShapingReward(
  currentPos,
  nextPos,
  goalPos,
  gamma,
  baseReward = 0.0
) {
  // Define potential as negative Euclidean distance
  const phiCurrent = -Math.sqrt(
    Math.pow(currentPos.x - goalPos.x, 2) + Math.pow(currentPos.y - goalPos.y, 2)
  );
  const phiNext = -Math.sqrt(
    Math.pow(nextPos.x - goalPos.x, 2) + Math.pow(nextPos.y - goalPos.y, 2)
  );
  
  // Calculate shaping term: gamma * Phi(s') - Phi(s)
  const shapingSignal = (gamma * phiNext) - phiCurrent;
  
  // Total reward combines task success with shaping
  return baseReward + shapingSignal;
}

export function calculatePRMReward(
  currentPos,
  goalPos,
  hopSize,
  currentHop,
  hopProgress,
  learningRate = 0.1
) {
  const distance = Math.sqrt(
    Math.pow(currentPos.x - goalPos.x, 2) + Math.pow(currentPos.y - goalPos.y, 2)
  );
  
  // Predict progress based on hop model
  const expectedHops = Math.ceil(distance / hopSize);
  const predictedProgress = Math.max(0, 1 - (expectedHops * hopSize - distance) / (expectedHops * hopSize));
  
  // Reward based on predicted progress and learning rate
  const reward = learningRate * predictedProgress * (1 - distance / (expectedHops * hopSize));
  
  return Math.max(0, reward);
}

export function calculateSemanticReward(agentPos, goalPos, width, height) {
  // Mock vision-language reward using a pre-calculated 2D similarity heatmap
  // This simulates a semantic similarity score based on position
  const normalizedX = agentPos.x / width;
  const normalizedY = agentPos.y / height;
  const goalNormalizedX = goalPos.x / width;
  const goalNormalizedY = goalPos.y / height;
  
  // Create a Gaussian-like similarity function centered on goal
  const dx = normalizedX - goalNormalizedX;
  const dy = normalizedY - goalNormalizedY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Gaussian kernel with sigma = 0.2
  const sigma = 0.2;
  const similarity = Math.exp(-(distance * distance) / (2 * sigma * sigma));
  
  return similarity;
}

export function generateRewardGradient(width, height, goalPos, rewardType, params = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = { x, y };
      let reward = 0;
      
      switch (rewardType) {
        case 'sparse':
          reward = calculateSparseReward(pos, goalPos, params.threshold || 30);
          break;
        case 'shaping':
          // For gradient, use shaping with next position = current position
          reward = calculateDistanceShapingReward(
            pos,
            pos,
            goalPos,
            params.gamma || 0.9,
            0
          );
          // Normalize to 0-1 range
          reward = (reward + 100) / 200; // Rough normalization
          break;
        case 'prm':
          reward = calculatePRMReward(
            pos,
            goalPos,
            params.hopSize || 50,
            0,
            0,
            params.learningRate || 0.1
          );
          break;
        case 'semantic':
          reward = calculateSemanticReward(pos, goalPos, width, height);
          break;
      }
      
      // Map reward to color (blue to green gradient)
      const idx = (y * width + x) * 4;
      const intensity = Math.max(0, Math.min(1, reward));
      
      // Color gradient: dark blue (low) -> light blue -> green (high)
      if (intensity < 0.5) {
        imageData.data[idx] = 0; // R
        imageData.data[idx + 1] = Math.floor(intensity * 2 * 100); // G
        imageData.data[idx + 2] = Math.floor(100 + intensity * 2 * 155); // B
      } else {
        imageData.data[idx] = 0; // R
        imageData.data[idx + 1] = Math.floor(100 + (intensity - 0.5) * 2 * 155); // G
        imageData.data[idx + 2] = Math.floor(255 - (intensity - 0.5) * 2 * 100); // B
      }
      imageData.data[idx + 3] = 100; // Alpha (semi-transparent)
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
