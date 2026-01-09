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
  initialDistance,
  learningRate = 0.1
) {
  const distance = Math.sqrt(
    Math.pow(currentPos.x - goalPos.x, 2) + Math.pow(currentPos.y - goalPos.y, 2)
  );
  
  // Continuous Progress Reward: Normalized distance reduction
  // NO Math.floor or Math.ceil - fully continuous
  if (initialDistance === null || initialDistance === 0) {
    return 0;
  }
  const progress = Math.max(0, (initialDistance - distance) / initialDistance);
  // Scale by learning rate for consistency
  return learningRate * progress;
}

export function calculateSemanticReward(agentPos, goalPos, width, height) {
  // Gaussian Similarity: R = exp(-d^2 / 2sigma^2)
  // Provides a smooth "hill" to climb.
  const distance = Math.sqrt(
    Math.pow(agentPos.x - goalPos.x, 2) + Math.pow(agentPos.y - goalPos.y, 2)
  );
  
  // Use pixel-space sigma for better gradient
  const sigma = 100; // Adjusted for pixel space (was 0.2 in normalized space)
  return Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(sigma, 2)));
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
          // For gradient, estimate initial distance (use max possible distance)
          const maxDist = Math.sqrt(width * width + height * height);
          reward = calculatePRMReward(
            pos,
            goalPos,
            maxDist,
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
