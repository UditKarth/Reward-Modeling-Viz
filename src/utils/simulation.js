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
      frictionAir: 0.1,
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
    
    // Success threshold
    this.successThreshold = 30;
    
    // PRM parameters
    this.hopSize = 50;
    this.currentHop = 0;
    this.hopProgress = 0;
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
    this.agentVelocity = { x: vx, y: vy };
    Body.setVelocity(this.agent, { x: vx, y: vy });
  }
  
  step() {
    // Apply velocity
    if (this.agentVelocity.x !== 0 || this.agentVelocity.y !== 0) {
      Body.setVelocity(this.agent, this.agentVelocity);
    }
    
    // Update position history for PRM
    const currentPos = this.getAgentPosition();
    this.positionHistory.push({ ...currentPos, time: Date.now() });
    if (this.positionHistory.length > this.maxHistoryLength) {
      this.positionHistory.shift();
    }
    
    // Update PRM hop progress
    this.updatePRMProgress();
    
    Engine.update(this.engine, 1000 / 60);
  }
  
  updatePRMProgress() {
    const agentPos = this.getAgentPosition();
    const goalPos = this.getGoalPosition();
    const distance = this.getDistance();
    
    // Calculate expected number of hops
    const expectedHops = Math.ceil(distance / this.hopSize);
    
    // Calculate current hop based on distance
    this.currentHop = Math.floor((this.getInitialDistance() - distance) / this.hopSize);
    
    // Calculate progress within current hop
    const hopStartDistance = this.getInitialDistance() - (this.currentHop * this.hopSize);
    const hopEndDistance = Math.max(0, hopStartDistance - this.hopSize);
    const hopProgress = (hopStartDistance - distance) / (hopStartDistance - hopEndDistance || 1);
    this.hopProgress = Math.max(0, Math.min(1, hopProgress));
  }
  
  getInitialDistance() {
    // Use first position in history or current distance
    if (this.positionHistory.length > 0) {
      const firstPos = this.positionHistory[0];
      const goalPos = this.getGoalPosition();
      return Math.sqrt(
        Math.pow(firstPos.x - goalPos.x, 2) + Math.pow(firstPos.y - goalPos.y, 2)
      );
    }
    return this.getDistance();
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
    this.currentHop = 0;
    this.hopProgress = 0;
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
