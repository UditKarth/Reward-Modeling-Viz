# RewardArena

A React SPA to visualize reward modeling efficiency in robot manipulation.

## Features

- **Four Reward Regimes:**
  - **Sparse Reward:** Binary reward based on distance threshold
  - **Distance Shaping:** Potential-based reward shaping with gamma discount
  - **Process Model (PRM):** Discrete hop-based progress prediction
  - **Semantic Reward:** Mock vision-language reward using 2D similarity heatmap

- **Interactive Visualizations:**
  - Real-time Matter.js simulations with point-mass agents
  - Reward gradient backgrounds for each canvas
  - Live HUD overlays showing current reward values
  - Chart.js analytics tracking cumulative successes

- **Global Controls:**
  - Gamma (γ) slider for reward shaping discount factor
  - Learning Rate (α) slider for PRM
  - Speed multiplier for high-speed simulation

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Build

```bash
npm run build
```

## Technical Stack

- **React 18** - UI framework
- **Matter.js** - Physics simulation engine
- **Chart.js** - Analytics visualization
- **KaTeX** - Math notation rendering
- **Tailwind CSS** - Styling
- **Vite** - Build tool

## Reward Formulae

### Sparse Reward
\[
R(s) = \begin{cases} 1.0 & \text{if } d(s, g) < \theta \\ 0.0 & \text{otherwise} \end{cases}
\]

### Distance Shaping
\[
R_{\text{shaped}} = R_{\text{base}} + \gamma \Phi(s') - \Phi(s)
\]
where \(\Phi(s) = -d(s, g)\)

### Process Model (PRM)
\[
R_{\text{PRM}} = \alpha \cdot \hat{p} \cdot (1 - \frac{d}{d_{\text{max}}})
\]
where \(\hat{p}\) is predicted progress based on discrete hops

### Semantic Reward
\[
R_{\text{semantic}} = \exp\left(-\frac{d^2}{2\sigma^2}\right)
\]
