import { useEffect, useRef, useState } from 'react';
import { SimulationEngine } from '../utils/simulation';
import {
  calculateSparseReward,
  calculateDistanceShapingReward,
  calculatePRMReward,
  calculateSemanticReward,
  generateRewardGradient,
} from '../utils/rewards';

export default function SimulationCanvas({
  rewardType,
  width,
  height,
  gamma,
  learningRate,
  speedMultiplier,
  onRewardUpdate,
  onSuccess,
}) {
  const canvasRef = useRef(null);
  const backgroundCanvasRef = useRef(null);
  const simulationRef = useRef(null);
  const animationFrameRef = useRef(null);
  const previousPosRef = useRef(null);
  const [currentReward, setCurrentReward] = useState(0);
  const [cumulativeSuccesses, setCumulativeSuccesses] = useState(0);
  const [currentDistance, setCurrentDistance] = useState(0);
  const gradientImageRef = useRef(null);
  
  // Policy state: momentum and reward history
  const momentumRef = useRef({ x: 0, y: 0 });
  const rewardHistoryRef = useRef([]);
  const lastRewardRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current || !backgroundCanvasRef.current) return;

    // Initialize simulation
    const sim = new SimulationEngine(canvasRef.current, width, height);
    simulationRef.current = sim;
    previousPosRef.current = sim.getAgentPosition();
    
    // Reset policy state
    momentumRef.current = { x: 0, y: 0 };
    rewardHistoryRef.current = [];
    lastRewardRef.current = 0;

    // Generate reward gradient background
    const goalPos = sim.getGoalPosition();
    const gradientCanvas = generateRewardGradient(
      width,
      height,
      goalPos,
      rewardType,
      { gamma, learningRate, threshold: 30, hopSize: 50 }
    );
    gradientImageRef.current = gradientCanvas;
    
    const bgCtx = backgroundCanvasRef.current.getContext('2d');
    bgCtx.drawImage(gradientCanvas, 0, 0);

    // Reward-guided policy: uses reward gradient to determine movement
    const updateAgent = (currentReward) => {
      const agentPos = sim.getAgentPosition();
      const goalPos = sim.getGoalPosition();
      const distance = sim.getDistance();
      
      // Stop if we've reached success
      if (distance <= sim.successThreshold) {
        sim.updateAgentVelocity(0, 0);
        momentumRef.current = { x: 0, y: 0 };
        return;
      }
      
      // Estimate reward gradient by sampling nearby positions
      const sampleDistance = 10; // pixels to sample for gradient estimation
      const samples = [
        { dx: sampleDistance, dy: 0 },
        { dx: -sampleDistance, dy: 0 },
        { dx: 0, dy: sampleDistance },
        { dx: 0, dy: -sampleDistance },
        { dx: sampleDistance * 0.707, dy: sampleDistance * 0.707 },
        { dx: -sampleDistance * 0.707, dy: sampleDistance * 0.707 },
        { dx: sampleDistance * 0.707, dy: -sampleDistance * 0.707 },
        { dx: -sampleDistance * 0.707, dy: -sampleDistance * 0.707 },
      ];
      
      let bestDirection = { x: 0, y: 0 };
      let maxExpectedReward = currentReward;
      
      // Sample rewards in different directions
      samples.forEach((sample) => {
        const testPos = {
          x: agentPos.x + sample.dx,
          y: agentPos.y + sample.dy,
        };
        
        // Clamp to canvas bounds
        testPos.x = Math.max(15, Math.min(width - 15, testPos.x));
        testPos.y = Math.max(15, Math.min(height - 15, testPos.y));
        
        // Calculate expected reward at test position using continuous reward functions
        const testDistance = Math.sqrt(
          Math.pow(testPos.x - goalPos.x, 2) + Math.pow(testPos.y - goalPos.y, 2)
        );
        
        let expectedReward = 0;
        switch (rewardType) {
          case 'sparse':
            expectedReward = calculateSparseReward(testPos, goalPos, sim.successThreshold);
            break;
          case 'shaping':
            // For shaping, estimate reward at test position
            // Potential-based: r = gamma * Phi(s') - Phi(s)
            const phiCurrent = -distance;
            const phiNext = -testDistance;
            expectedReward = (gamma * phiNext) - phiCurrent;
            break;
          case 'prm':
            // Use continuous PRM reward with initial distance
            const initialDist = sim.initialDistance || distance;
            expectedReward = calculatePRMReward(
              testPos,
              goalPos,
              initialDist,
              learningRate
            );
            break;
          case 'semantic':
            expectedReward = calculateSemanticReward(testPos, goalPos, width, height);
            break;
        }
        
        // If this direction has higher expected reward, use it
        if (expectedReward > maxExpectedReward) {
          maxExpectedReward = expectedReward;
          bestDirection = { x: sample.dx, y: sample.dy };
        }
      });
      
      // Normalize direction
      const dirLength = Math.sqrt(bestDirection.x * bestDirection.x + bestDirection.y * bestDirection.y);
      if (dirLength > 0) {
        bestDirection.x /= dirLength;
        bestDirection.y /= dirLength;
      } else {
        // Fallback: move towards goal if no better direction found
        const dx = goalPos.x - agentPos.x;
        const dy = goalPos.y - agentPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          bestDirection.x = dx / dist;
          bestDirection.y = dy / dist;
        }
      }
      
      // Apply momentum for smooth movement (reduces oscillations)
      const momentumDecay = 0.7; // How much momentum to keep
      const momentumWeight = 0.3; // How much momentum affects movement
      
      momentumRef.current.x = momentumRef.current.x * momentumDecay + bestDirection.x * (1 - momentumDecay);
      momentumRef.current.y = momentumRef.current.y * momentumDecay + bestDirection.y * (1 - momentumDecay);
      
      // Normalize momentum
      const momLength = Math.sqrt(
        momentumRef.current.x * momentumRef.current.x + momentumRef.current.y * momentumRef.current.y
      );
      if (momLength > 0) {
        momentumRef.current.x /= momLength;
        momentumRef.current.y /= momLength;
      }
      
      // Combine reward gradient direction with momentum
      const finalDirection = {
        x: bestDirection.x * (1 - momentumWeight) + momentumRef.current.x * momentumWeight,
        y: bestDirection.y * (1 - momentumWeight) + momentumRef.current.y * momentumWeight,
      };
      
      // Normalize final direction
      const finalLength = Math.sqrt(finalDirection.x * finalDirection.x + finalDirection.y * finalDirection.y);
      if (finalLength > 0) {
        finalDirection.x /= finalLength;
        finalDirection.y /= finalLength;
      }
      
      // Calculate speed: faster when far, slower when close
      const baseSpeed = Math.min(4, Math.max(1.5, distance * 0.015));
      
      // Apply velocity
      const vx = finalDirection.x * baseSpeed;
      const vy = finalDirection.y * baseSpeed;
      sim.updateAgentVelocity(vx, vy);
    };

    let frameCount = 0;
    const animate = () => {
      for (let i = 0; i < speedMultiplier; i++) {
        // Update distance for display
        const distance = sim.getDistance();
        setCurrentDistance(distance);
        
        // Update agent using reward-guided policy
        // We'll get the reward from step() which uses the continuous reward system
        const currentReward = sim.getReward(rewardType, gamma, learningRate, width, height);
        updateAgent(currentReward);
        
        // Step simulation - this now returns reward and isDone
        const stepResult = sim.step(rewardType, gamma, learningRate, width, height);
        const reward = stepResult.reward;
        const isDone = stepResult.isDone;
        
        // Update reward history
        rewardHistoryRef.current.push(reward);
        if (rewardHistoryRef.current.length > 10) {
          rewardHistoryRef.current.shift();
        }
        lastRewardRef.current = reward;
        
        setCurrentReward(reward);
        onRewardUpdate?.(rewardType, reward);
        
        // Handle success and reset
        if (isDone) {
          setCumulativeSuccesses((prev) => {
            const newCount = prev + 1;
            onSuccess?.(rewardType, newCount);
            return newCount;
          });
          // Reset momentum and state on success
          momentumRef.current = { x: 0, y: 0 };
          rewardHistoryRef.current = [];
          lastRewardRef.current = 0;
          previousPosRef.current = sim.getAgentPosition();
        } else {
          previousPosRef.current = sim.getAgentPosition();
        }
        
        frameCount++;
      }
      
      sim.renderFrame();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (simulationRef.current) {
        simulationRef.current.destroy();
      }
    };
  }, [rewardType, width, height, gamma, learningRate, speedMultiplier, onRewardUpdate, onSuccess]);

  // Update gradient when gamma or learningRate changes
  useEffect(() => {
    if (!backgroundCanvasRef.current || !simulationRef.current) return;
    
    const goalPos = simulationRef.current.getGoalPosition();
    const gradientCanvas = generateRewardGradient(
      width,
      height,
      goalPos,
      rewardType,
      { gamma, learningRate, threshold: 30, hopSize: 50 }
    );
    gradientImageRef.current = gradientCanvas;
    
    const bgCtx = backgroundCanvasRef.current.getContext('2d');
    bgCtx.clearRect(0, 0, width, height);
    bgCtx.drawImage(gradientCanvas, 0, 0);
  }, [gamma, learningRate, rewardType, width, height]);

  return (
    <div className="relative" style={{ width, height }}>
      {/* Background canvas for reward gradient */}
      <canvas
        ref={backgroundCanvasRef}
        width={width}
        height={height}
        className="absolute inset-0"
        style={{ zIndex: 0 }}
      />
      
      {/* Main simulation canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      />
      
      {/* HUD Overlay */}
      <div
        className="absolute top-2 left-2 bg-black bg-opacity-70 text-white p-2 rounded text-sm font-mono"
        style={{ zIndex: 2 }}
      >
        <div>Reward: {currentReward.toFixed(3)}</div>
        <div>Distance: {currentDistance.toFixed(1)}</div>
        <div>Successes: {cumulativeSuccesses}</div>
        <div>Type: {rewardType}</div>
      </div>
    </div>
  );
}
