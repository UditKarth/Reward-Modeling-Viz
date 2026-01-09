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
  const gradientImageRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !backgroundCanvasRef.current) return;

    // Initialize simulation
    const sim = new SimulationEngine(canvasRef.current, width, height);
    simulationRef.current = sim;
    previousPosRef.current = sim.getAgentPosition();

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

    // Simple control: move agent towards goal with some randomness
    const updateAgent = () => {
      const agentPos = sim.getAgentPosition();
      const goalPos = sim.getGoalPosition();
      
      // Calculate direction to goal
      const dx = goalPos.x - agentPos.x;
      const dy = goalPos.y - agentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 5) {
        // Add some exploration noise
        const noise = 0.3;
        const vx = (dx / distance) * 2 + (Math.random() - 0.5) * noise;
        const vy = (dy / distance) * 2 + (Math.random() - 0.5) * noise;
        sim.updateAgentVelocity(vx, vy);
      } else {
        sim.updateAgentVelocity(0, 0);
      }
    };

    let frameCount = 0;
    const animate = () => {
      for (let i = 0; i < speedMultiplier; i++) {
        updateAgent();
        sim.step();
        
        // Calculate reward
        const currentPos = sim.getAgentPosition();
        const goalPos = sim.getGoalPosition();
        let reward = 0;
        
        switch (rewardType) {
          case 'sparse':
            reward = calculateSparseReward(currentPos, goalPos, 30);
            break;
          case 'shaping':
            reward = calculateDistanceShapingReward(
              previousPosRef.current,
              currentPos,
              goalPos,
              gamma,
              0
            );
            break;
          case 'prm':
            reward = calculatePRMReward(
              currentPos,
              goalPos,
              50,
              sim.currentHop,
              sim.hopProgress,
              learningRate
            );
            break;
          case 'semantic':
            reward = calculateSemanticReward(currentPos, goalPos, width, height);
            break;
        }
        
        setCurrentReward(reward);
        onRewardUpdate?.(rewardType, reward);
        
        // Check for success
        if (sim.isSuccess()) {
          setCumulativeSuccesses((prev) => {
            const newCount = prev + 1;
            onSuccess?.(rewardType, newCount);
            return newCount;
          });
          sim.reset();
          previousPosRef.current = sim.getAgentPosition();
        } else {
          previousPosRef.current = { ...currentPos };
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
        <div>Successes: {cumulativeSuccesses}</div>
        <div>Type: {rewardType}</div>
      </div>
    </div>
  );
}
