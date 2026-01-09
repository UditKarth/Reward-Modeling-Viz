import Matter from 'matter-js';

const { Engine, Render, World, Bodies, Body } = Matter;

export class SimulationEngine {
  constructor(canvasRef, width, height) {
    this.width = width;
    this.height = height;
    this.engine = Engine.create();
    this.engine.world.gravity.y = 0; // No gravity for manipulation task
    
    // Create renderer
    this.render = Render.create({
      canvas: canvasRef.current,
      engine: this.engine,
      options: {
        width,
        height,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio || 1,
      },
    });
    
    // Create point-mass agent (simpler than 2-DOF arm for visualization)
    const agentRadius = 15;
    this.agent = Bodies.circle(width / 4, height / 2, agentRadius, {
      frictionAir: 0, // No friction - velocity is controlled directly by policy
      render: {
        fillStyle: '#3b82f6',
        strokeStyle: '#1e40af',
        lineWidth: 2,
      },
    });
    
    // Create static goal position
    const goalRadius = 20;
    this.goal = Bodies.circle(width * 0.75, height / 2, goalRadius, {
      isStatic: true,
      isSensor: true,
      render: {
        fillStyle: '#10b981',
        strokeStyle: '#059669',
        lineWidth: 2,
      },
    });
    
    // Add bodies to world
    World.add(this.engine.world, [this.agent, this.goal]);
    
    // Initialize agent velocity
    this.agentVelocity = { x: 0, y: 0 };
    
    // Track position history for PRM
    this.positionHistory = [];
    this.maxHistoryLength = 10;
    
    // Success threshold (distance between centers)
    // Agent radius: 15, Goal radius: 20, so threshold of 35 allows overlap
    this.successThreshold = 35;
    
    // Track previous distance for continuous reward calculation
    this.previousDistance = null;
    this.initialDistance = null;
    
    // Success counter
    this.successCount = 0;
  }
  
  getAgentPosition() {
    return {
      x: this.agent.position.x,
      y: this.agent.position.y,
    };
  }
  
  getGoalPosition() {
    return {
      x: this.goal.position.x,
      y: this.goal.position.y,
    };
  }
  
  getDistance() {
    const agentPos = this.getAgentPosition();
    const goalPos = this.getGoalPosition();
    return Math.sqrt(
      Math.pow(agentPos.x - goalPos.x, 2) + Math.pow(agentPos.y - goalPos.y, 2)
    );
  }
  
  updateAgentVelocity(vx, vy) {
    // Store velocity - it will be applied in step() before physics update
    this.agentVelocity = { x: vx, y: vy };
  }
  
  step(rewardType, gamma = 0.9, learningRate = 0.1, width = 400, height = 300) {
    // 1. Calculate the Reward for the current state (before physics update)
    const reward = this.getReward(rewardType, gamma, learningRate, width, height);
    
    // 2. Check for Success and Reset
    let isDone = false;
    if (this.isSuccess()) {
      this.successCount++;
      this.reset();
      isDone = true;
      // Return success reward
      return { reward: 1.0, isDone: true };
    }

    // 3. Apply velocity before physics update
    // This ensures the agent moves according to the policy's desired velocity
    // Always apply velocity (even if zero) to ensure consistent behavior
    Body.setVelocity(this.agent, this.agentVelocity);
    
    // 4. Physics Update
    Engine.update(this.engine, 1000 / 60);
    
    // Update position history
    const currentPos = this.getAgentPosition();
    this.positionHistory.push({ ...currentPos, time: Date.now() });
    if (this.positionHistory.length > this.maxHistoryLength) {
      this.positionHistory.shift();
    }
    
    return { reward, isDone: false };
  }
  
  // Continuous reward calculator - no discretization
  getReward(type, gamma = 0.9, learningRate = 0.1, width = 400, height = 300) {
    const dist = this.getDistance();
    const prevDist = this.previousDistance !== null ? this.previousDistance : dist;
    
    // Initialize initial distance on first call
    if (this.initialDistance === null) {
      this.initialDistance = dist;
    }
    
    this.previousDistance = dist;

    switch (type) {
      case 'sparse':
        // Only 1 at the goal, 0 elsewhere. Extremely hard to learn.
        return dist < this.successThreshold ? 1.0 : 0.0;

      case 'shaping':
        // Potential-based: r = gamma * Phi(s') - Phi(s)
        // Phi is negative distance; reward is positive for getting closer.
        const phiNext = -dist;
        const phiCurr = -prevDist;
        return (gamma * phiNext) - phiCurr;

      case 'prm':
        // Continuous Progress Reward: Normalized distance reduction
        // NO Math.floor or Math.ceil - fully continuous
        const initialDist = this.initialDistance;
        const progress = Math.max(0, (initialDist - dist) / initialDist);
        // Scale by learning rate for consistency
        return learningRate * progress;

      case 'semantic':
        // Gaussian Similarity: R = exp(-d^2 / 2sigma^2)
        // Provides a smooth "hill" to climb.
        const sigma = 100; // Adjusted for pixel space
        return Math.exp(-Math.pow(dist, 2) / (2 * Math.pow(sigma, 2)));

      default:
        return 0;
    }
  }
  
  isSuccess() {
    return this.getDistance() < this.successThreshold;
  }
  
  reset() {
    // Reset agent to initial position
    Body.setPosition(this.agent, { x: this.width / 4, y: this.height / 2 });
    Body.setVelocity(this.agent, { x: 0, y: 0 });
    this.agentVelocity = { x: 0, y: 0 };
    this.positionHistory = [];
    // Reset distance tracking for continuous rewards
    this.previousDistance = null;
    this.initialDistance = null;
  }
  
  getSuccessCount() {
    return this.successCount;
  }
  
  resetSuccessCount() {
    this.successCount = 0;
  }
  
  renderFrame() {
    Render.world(this.render);
    // Note: In Matter.js, we typically use Render.run() for continuous rendering
    // But for manual control, we update the render manually
  }
  
  destroy() {
    Render.stop(this.render);
    Engine.clear(this.engine);
    this.render.canvas.remove();
    this.render.textures = {};
  }
}
