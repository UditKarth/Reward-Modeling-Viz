import { useState, useCallback } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import SuccessChart from './components/SuccessChart';
import RewardFormula from './components/RewardFormula';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 300;

function App() {
  const [gamma, setGamma] = useState(0.9);
  const [learningRate, setLearningRate] = useState(0.1);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  
  // Track rewards and successes for each regime
  const [rewards, setRewards] = useState({
    sparse: 0,
    shaping: 0,
    prm: 0,
    semantic: 0,
  });
  
  const [successes, setSuccesses] = useState({
    sparse: 0,
    shaping: 0,
    prm: 0,
    semantic: 0,
  });
  
  const [chartData, setChartData] = useState([]);
  
  const handleRewardUpdate = useCallback((rewardType, reward) => {
    setRewards((prev) => ({ ...prev, [rewardType]: reward }));
  }, []);
  
  const handleSuccess = useCallback((rewardType, count) => {
    setSuccesses((prev) => {
      const newSuccesses = { ...prev, [rewardType]: count };
      
      // Update chart data
      setChartData((prevData) => {
        const newData = [...prevData];
        const lastEntry = newData[newData.length - 1] || { sparse: 0, shaping: 0, prm: 0, semantic: 0 };
        const newEntry = { ...lastEntry, [rewardType]: count };
        newData.push(newEntry);
        
        // Keep only last 100 data points
        if (newData.length > 100) {
          return newData.slice(-100);
        }
        return newData;
      });
      
      return newSuccesses;
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">RewardArena</h1>
          <p className="text-gray-600">
            Visualizing reward modeling efficiency in robot manipulation
          </p>
        </header>

        {/* Global Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Global Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gamma (γ): {gamma.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={gamma}
                onChange={(e) => setGamma(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Discount factor for reward shaping
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Learning Rate (α): {learningRate.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={learningRate}
                onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Learning rate for PRM
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speed Multiplier: {speedMultiplier}x
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={speedMultiplier}
                onChange={(e) => setSpeedMultiplier(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Simulation speed
              </p>
            </div>
          </div>
        </div>

        {/* Simulation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Sparse Reward */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold mb-2">Sparse Reward</h3>
            <RewardFormula rewardType="sparse" />
            <div className="mt-4 border-2 border-gray-300 rounded overflow-hidden">
              <SimulationCanvas
                rewardType="sparse"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                gamma={gamma}
                learningRate={learningRate}
                speedMultiplier={speedMultiplier}
                onRewardUpdate={(reward) => handleRewardUpdate('sparse', reward)}
                onSuccess={(count) => handleSuccess('sparse', count)}
              />
            </div>
          </div>

          {/* Distance Shaping */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold mb-2">Distance Shaping</h3>
            <RewardFormula rewardType="shaping" />
            <div className="mt-4 border-2 border-gray-300 rounded overflow-hidden">
              <SimulationCanvas
                rewardType="shaping"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                gamma={gamma}
                learningRate={learningRate}
                speedMultiplier={speedMultiplier}
                onRewardUpdate={(reward) => handleRewardUpdate('shaping', reward)}
                onSuccess={(count) => handleSuccess('shaping', count)}
              />
            </div>
          </div>

          {/* PRM */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold mb-2">Process Model (PRM)</h3>
            <RewardFormula rewardType="prm" />
            <div className="mt-4 border-2 border-gray-300 rounded overflow-hidden">
              <SimulationCanvas
                rewardType="prm"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                gamma={gamma}
                learningRate={learningRate}
                speedMultiplier={speedMultiplier}
                onRewardUpdate={(reward) => handleRewardUpdate('prm', reward)}
                onSuccess={(count) => handleSuccess('prm', count)}
              />
            </div>
          </div>

          {/* Semantic */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold mb-2">Semantic Reward</h3>
            <RewardFormula rewardType="semantic" />
            <div className="mt-4 border-2 border-gray-300 rounded overflow-hidden">
              <SimulationCanvas
                rewardType="semantic"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                gamma={gamma}
                learningRate={learningRate}
                speedMultiplier={speedMultiplier}
                onRewardUpdate={(reward) => handleRewardUpdate('semantic', reward)}
                onSuccess={(count) => handleSuccess('semantic', count)}
              />
            </div>
          </div>
        </div>

        {/* Analytics Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Analytics</h2>
          {chartData.length > 0 ? (
            <SuccessChart successData={chartData} />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Chart data will appear as agents achieve successes...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
