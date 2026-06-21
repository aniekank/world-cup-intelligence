import type { Metadata } from 'next';
import { labData } from '@/server/lab';
import { PageHeader, Panel } from '@/components/ui';
import { PoissonHeatmap } from '@/components/lab/PoissonHeatmap';
import { MonteCarloSimulator } from '@/components/lab/MonteCarloSimulator';
import { TeamEmbedding } from '@/components/lab/TeamEmbedding';
import { CalibrationLab } from '@/components/lab/CalibrationLab';
import { PredictionExplainer } from '@/components/lab/PredictionExplainer';

export const metadata: Metadata = { title: 'Model Lab' };

export default function LabPage() {
  const data = labData();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Data Science"
        title="Model Lab"
        description="The machinery behind the predictions, made playable. Every visual recomputes live in your browser from the real engine — drag a control and watch the math move. No black boxes: a bivariate-Poisson goals model, a Monte Carlo tournament simulator, PCA + k-means on team style, model calibration, and Shapley attribution."
      />

      <Panel
        title="Bivariate-Poisson Score Matrix"
        subtitle="The generative model behind every prediction"
      >
        <p className="mb-5 max-w-3xl text-sm text-terminal-muted">
          Each prediction starts here: two goal expectations (λ) feed a bivariate-Poisson distribution over every possible scoreline, with a shared component (λ₃) for the correlation between the two scores. Win/draw/loss, BTTS and over/under are just sums over this grid. Load a real fixture or drag the λ sliders to reshape it.
        </p>
        <PoissonHeatmap matches={data.matches} />
      </Panel>

      <Panel
        title="Monte Carlo What-If Simulator"
        subtitle="Re-run the tournament 3,000 times with a team's strength of your choosing"
      >
        <p className="mb-5 max-w-3xl text-sm text-terminal-muted">
          Override a team&rsquo;s attack, defense or ELO and the real engine re-simulates the rest of the tournament 3,000 times against the current results — sampling every remaining group game, resolving the bracket, and playing it out. Watch the chosen team&rsquo;s survival path and the whole title race react.
        </p>
        <MonteCarloSimulator teams={data.teams} defaultTeamId={data.defaultTeamId} />
      </Panel>

      <Panel
        title="Team Embedding — PCA + k-means"
        subtitle="48 teams, 8 style dimensions, projected to 2D"
      >
        <p className="mb-5 max-w-3xl text-sm text-terminal-muted">
          Every team is a vector of playing-style metrics. Principal Component Analysis (computed in-browser via a covariance eigendecomposition) collapses that to two axes that capture the most variance, and k-means groups teams into stylistic clusters. Toggle which metrics feed the projection and it recomputes instantly.
        </p>
        <TeamEmbedding dims={data.embedding.dims} teams={data.embedding.teams} />
      </Panel>

      <Panel
        title="Calibration Lab"
        subtitle="Is the model honest? Predicted probability vs observed frequency"
      >
        <p className="mb-5 max-w-3xl text-sm text-terminal-muted">
          A reliability diagram tests whether stated probabilities mean what they say — of all the times the model said 70%, did it happen ~70% of the time? The Brier score and its Murphy decomposition (reliability − resolution + uncertainty) quantify it against every finished match.
        </p>
        <CalibrationLab pairs={data.calibration.pairs} n={data.calibration.n} skill={data.calibration.skill} hitRate={data.calibration.hitRate} />
      </Panel>

      <Panel
        title="Prediction Explainer — Shapley values"
        subtitle="What drives a single match prediction"
      >
        <p className="mb-5 max-w-3xl text-sm text-terminal-muted">
          Game-theoretic attribution: each input (home advantage, both teams&rsquo; attack and defense) gets credit equal to its average marginal effect over every ordering — exact Shapley values. The contributions sum precisely from the neutral baseline to the model&rsquo;s win probability.
        </p>
        <PredictionExplainer matches={data.matches} />
      </Panel>
    </div>
  );
}

export const dynamic = 'force-dynamic';
