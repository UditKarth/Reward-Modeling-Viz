import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

export default function RewardFormula({ rewardType }) {
  switch (rewardType) {
    case 'sparse':
      return (
        <div className="text-sm text-gray-700 bg-gray-100 p-2 rounded">
          <InlineMath math="R(s) = \begin{cases} 1.0 & \text{if } d(s, g) < \theta \\ 0.0 & \text{otherwise} \end{cases}" />
        </div>
      );
    case 'shaping':
      return (
        <div className="text-sm text-gray-700 bg-gray-100 p-2 rounded">
          <div className="mb-1">
            <InlineMath math="R_{\text{shaped}} = R_{\text{base}} + \gamma \Phi(s') - \Phi(s)" />
          </div>
          <div className="text-xs text-gray-600">
            where <InlineMath math="\Phi(s) = -d(s, g)" />
          </div>
        </div>
      );
    case 'prm':
      return (
        <div className="text-sm text-gray-700 bg-gray-100 p-2 rounded">
          <div className="mb-1">
            <InlineMath math="R_{\text{PRM}} = \alpha \cdot \hat{p} \cdot (1 - \frac{d}{d_{\text{max}}})" />
          </div>
          <div className="text-xs text-gray-600">
            where <InlineMath math="\hat{p}" /> is predicted progress
          </div>
        </div>
      );
    case 'semantic':
      return (
        <div className="text-sm text-gray-700 bg-gray-100 p-2 rounded">
          <InlineMath math="R_{\text{semantic}} = \exp\left(-\frac{d^2}{2\sigma^2}\right)" />
        </div>
      );
    default:
      return null;
  }
}
