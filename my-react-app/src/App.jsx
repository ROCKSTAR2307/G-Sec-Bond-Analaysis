import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Activity, BarChart3, Database, Brain, Target, Clock, AlertCircle } from 'lucide-react';
import { bondAPI } from './api/bondAPI';
import './App.css';

// ─── Static reference data ───────────────────────────────────────────────────

const modelMetrics = {
  'Linear Regression': {
    '3-year': { mape: 0.0108, mae: 0.0762, mse: 0.0092, r2: 0.7008 },
    '10-year': { mape: 0.0114, mae: 0.0817, mse: 0.0077, r2: 0.7743 },
  },
  'ARIMA': {
    '3-year': { mape: 0.0199, mae: 0.1391, mse: 0.0321, r2: null },
    '10-year': { mape: 0.0362, mae: 0.2551, mse: 0.0968, r2: null },
  },
  'DLSTM': {
    '3-year': { mape: 0.0090, mae: 0.0633, mse: 0.0078, r2: 0.7556 },
    '10-year': { mape: 0.0062, mae: 0.0450, mse: 0.0035, r2: 0.8894 },
  },
  'XGBoost': {
    '3-year': { mape: 0.0018, mae: 0.0753, mse: 0.0101, r2: 0.9890 },
    '10-year': { mape: 0.0013, mae: 0.0398, mse: 0.0026, r2: 0.9938 },
  },
};

const bondData3Year = { totalData: 2943, trainingData: 2354, testingData: 589 };
const bondData10Year = { totalData: 2945, trainingData: 2356, testingData: 589 };

const macroIndicators = [
  { name: 'GDP Growth', value: 6.8, change: 2.3, trend: 'up' },
  { name: 'Inflation Rate', value: 5.2, change: -0.8, trend: 'down' },
  { name: 'Interest Rate', value: 6.5, change: 0.25, trend: 'up' },
  { name: 'Exchange Rate', value: 82.5, change: -1.2, trend: 'down' },
];

// Each model gets a unique accent color
const MODEL_COLORS = {
  'Linear Regression': '#4ade80',   // green
  'ARIMA': '#fb923c',   // orange
  'DLSTM': '#a78bfa',   // violet
  'XGBoost': '#34d399',   // emerald
};

// ─── Per-model prediction card ───────────────────────────────────────────────

function ModelPredictionCard({ modelName }) {
  const [bondType, setBondType] = useState('3-year');
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [computed, setComputed] = useState(false);

  const accentColor = MODEL_COLORS[modelName] || '#4ade80';
  const ACTUAL_COLOR = '#4ade80';   // bright green — Actual is always distinctly readable

  // Switching bond type clears stale results
  const handleBondChange = (bond) => {
    setBondType(bond);
    setComputed(false);
    setChartData([]);
    setMetrics(null);
    setError(null);
  };

  const handleCompute = async () => {
    setIsLoading(true);
    setError(null);
    setMetrics(null);
    setComputed(false);
    try {
      const result = await bondAPI.compute(bondType, modelName);
      const formatted = result.chart_data.dates.map((dateStr, i) => ({
        year: new Date(dateStr).getFullYear().toString(),
        Actual: result.chart_data.actual[i],
        Predicted: result.chart_data.predicted[i],
      }));
      setChartData(formatted);
      setMetrics(result.metrics);
      setComputed(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueYears = [...new Set(chartData.map(d => d.year))];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      border: `1px solid ${accentColor}22`,
      borderRadius: '1.25rem',
      padding: '2rem',
      marginBottom: '2rem',
      boxShadow: `0 10px 30px rgba(0,0,0,0.3), 0 0 0 1px ${accentColor}11`,
    }}>

      {/* ── Header: 3-column grid keeps name / toggle / button always in one row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.25rem',
      }}>

        {/* Model name with glowing dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
            background: accentColor, boxShadow: `0 0 12px ${accentColor}`,
          }} />
          <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
            {modelName}
          </h3>
        </div>

        {/* Bond type pill — centred in available space */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'flex', gap: '4px', padding: '4px',
            background: '#0f172a', borderRadius: '10px', border: '1px solid #334155',
          }}>
            {['3-year', '10-year'].map(b => (
              <button
                key={b}
                onClick={() => handleBondChange(b)}
                style={{
                  padding: '5px 18px',
                  background: bondType === b ? accentColor : 'transparent',
                  color: bondType === b ? '#0f172a' : '#94a3b8',
                  border: 'none', borderRadius: '7px',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                  transition: 'all 0.25s ease', whiteSpace: 'nowrap',
                }}
              >
                {b === '3-year' ? '3-Year' : '10-Year'}
              </button>
            ))}
          </div>
        </div>

        {/* Live Compute button */}
        <button
          onClick={handleCompute}
          disabled={isLoading}
          style={{
            padding: '10px 22px',
            background: isLoading
              ? '#1e293b'
              : `linear-gradient(135deg, ${accentColor}cc, ${accentColor})`,
            color: isLoading ? '#64748b' : '#0f172a',
            border: `1px solid ${isLoading ? '#334155' : accentColor}`,
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '0.875rem',
            display: 'flex', alignItems: 'center', gap: '8px',
            transition: 'all 0.3s ease',
            boxShadow: isLoading ? 'none' : `0 4px 20px ${accentColor}44`,
            whiteSpace: 'nowrap',
          }}
        >
          {isLoading
            ? <><span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span> Computing…</>
            : '⚡ Live Compute'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          color: '#fca5a5', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '8px', padding: '0.75rem 1rem',
          marginBottom: '1rem', fontSize: '0.85rem',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Chart — only after a successful compute */}
      {computed && chartData.length > 0 && (
        <div style={{ marginBottom: '1.5rem', marginTop: '0.5rem' }}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`ga-${modelName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACTUAL_COLOR} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={ACTUAL_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`gp-${modelName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

              <XAxis
                dataKey="year" stroke="#475569"
                ticks={uniqueYears} interval={0}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
              />
              <YAxis
                stroke="#475569" domain={['auto', 'auto']}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                tickFormatter={(v) => Number(v).toFixed(2)}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: `1px solid ${accentColor}44`,
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                itemStyle={{ color: '#cbd5e1' }}
                formatter={(value) => [Number(value).toFixed(2), undefined]}
              />
              <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '0.8rem' }} />

              {/* Actual — solid green */}
              <Area
                type="monotone" dataKey="Actual" name="Actual"
                stroke={ACTUAL_COLOR} fill={`url(#ga-${modelName})`}
                strokeWidth={2} dot={false}
              />
              {/* Predicted — model accent, dashed */}
              <Area
                type="monotone" dataKey="Predicted" name="Predicted"
                stroke={`${accentColor}cc`} fill={`url(#gp-${modelName})`}
                strokeWidth={2} strokeDasharray="6 3" dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state (before first compute) */}
      {!computed && !error && !isLoading && (
        <div style={{
          height: '140px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${accentColor}22`, borderRadius: '1rem',
          color: '#475569', marginBottom: '1.5rem', gap: '8px',
        }}>
          <Brain size={28} style={{ opacity: 0.3, color: accentColor }} />
          <span style={{ fontSize: '0.85rem' }}>
            Select bond type, then click <strong style={{ color: '#94a3b8' }}>⚡ Live Compute</strong>
          </span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div style={{
          height: '140px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${accentColor}33`, borderRadius: '1rem',
          color: '#94a3b8', marginBottom: '1.5rem', gap: '10px',
        }}>
          <span style={{
            fontSize: '1.75rem', display: 'inline-block',
            animation: 'spin 0.8s linear infinite', color: accentColor,
          }}>⟳</span>
          <span>Training <strong style={{ color: accentColor }}>{modelName}</strong> on {bondType} data…</span>
          {modelName === 'DLSTM' && (
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Deep LSTM may take 30–60 s</span>
          )}
        </div>
      )}

      {/* Metrics — ONLY from live API, never hardcoded */}
      {computed && metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {[
            ['MAPE', metrics.mape, 'Mean Absolute % Error'],
            ['MAE', metrics.mae, 'Mean Absolute Error'],
            ['MSE', metrics.mse, 'Mean Squared Error'],
            ['R²', metrics.r2, 'R-Squared Score'],
          ].map(([label, val, desc]) => (
            <div key={label} style={{
              background: '#0a0f1a', borderRadius: '0.75rem',
              border: `1px solid ${accentColor}28`,
              padding: '1rem 0.75rem', textAlign: 'center',
            }}>
              <div style={{
                fontSize: '0.7rem', color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem',
              }}>{label}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: accentColor }}>
                {val !== null && val !== undefined ? Number(val).toFixed(4) : 'N/A'}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.25rem' }}>{desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

function App() {
  const [selectedBond, setSelectedBond] = useState('3-year');
  const [activeTab, setActiveTab] = useState('overview');

  const currentBondData = selectedBond === '3-year' ? bondData3Year : bondData10Year;
  const bestModel = 'XGBoost';
  const currentMetrics = modelMetrics[bestModel][selectedBond];

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <Activity className="header-icon" />
            <div>
              <h1>G-Sec Bond Market Prediction</h1>
              <p className="subtitle">AI-Powered Bond Price Forecasting</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Nav Tabs ── */}
      <nav className="nav-tabs">
        {[
          { key: 'overview', label: 'Overview', Icon: BarChart3 },
          { key: 'predictions', label: 'Predictions', Icon: Brain },
          { key: 'models', label: 'Models', Icon: Target },
          { key: 'data', label: 'Data Analysis', Icon: Database },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`nav-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>

      <div className="main-content">

        {/* ══════════════════════ OVERVIEW TAB ══════════════════════ */}
        {activeTab === 'overview' && (
          <div className="tab-content">

            <div className="section-header">
              <h2>Bond Market Overview</h2>
              <div className="bond-selector">
                <button className={`selector-btn ${selectedBond === '3-year' ? 'active' : ''}`} onClick={() => setSelectedBond('3-year')}>3-Year Bond</button>
                <button className={`selector-btn ${selectedBond === '10-year' ? 'active' : ''}`} onClick={() => setSelectedBond('10-year')}>10-Year Bond</button>
              </div>
            </div>

            {/* Data Reference */}
            <div className="section">
              <h3 className="section-title"><Database size={20} /> Data Reference</h3>
              <div className="stats-grid">
                {[
                  ['Total Dataset', currentBondData.totalData, 'Data points available', Database],
                  ['Training Set', currentBondData.trainingData, '80% of total data', Brain],
                  ['Test Set', currentBondData.testingData, '20% of total data', Target],
                ].map(([label, val, sub, Icon]) => (
                  <div key={label} className="stat-card">
                    <div className="stat-header">
                      <span className="stat-label">{label}</span>
                      <Icon size={20} className="stat-icon" />
                    </div>
                    <div className="stat-value">{val.toLocaleString()}</div>
                    <div className="stat-footer">{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Models Used */}
            <div className="section">
              <h3 className="section-title"><Brain size={20} /> Models Used</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {Object.keys(modelMetrics).map((name) => (
                  <div key={name} style={{
                    padding: '8px 18px', borderRadius: '8px', fontWeight: 700,
                    color: MODEL_COLORS[name],
                    border: `1px solid ${MODEL_COLORS[name]}44`,
                    background: `${MODEL_COLORS[name]}11`,
                  }}>{name}</div>
                ))}
              </div>
            </div>

            {/* Best Model Metrics */}
            <div className="section">
              <h3 className="section-title"><Activity size={20} /> Best Model Metrics ({bestModel})</h3>
              <div className="metrics-grid">
                {[
                  ['MAPE', currentMetrics.mape, 'Mean Absolute Percentage Error'],
                  ['MAE', currentMetrics.mae, 'Mean Absolute Error'],
                  ['MSE', currentMetrics.mse, 'Mean Squared Error'],
                  ['R² Score', currentMetrics.r2, 'Coefficient of Determination'],
                ].map(([label, val, desc]) => (
                  <div key={label} className="metric-card">
                    <div className="metric-label">{label}</div>
                    <div className="metric-value">
                      {val !== null ? val.toFixed(4) : 'N/A'}
                    </div>
                    <div className="metric-description">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Macro/Micro Indicators */}
            <div className="section">
              <h3 className="section-title"><TrendingUp size={20} /> Macro/Micro Indicators Used</h3>
              <div className="features-grid" style={{ marginBottom: '20px' }}>
                {['GDP Growth Rate', 'Inflation Rate', 'Interest Rates', 'Exchange Rates',
                  'Industrial Production', 'Consumer Price Index', 'Money Supply',
                  'Trade Balance', 'Fiscal Deficit', 'Foreign Exchange Reserves', '... and 40 more',
                ].map(f => <div key={f} className="feature-tag">{f}</div>)}
              </div>
              <div className="indicators-grid">
                {macroIndicators.map((ind, i) => (
                  <div key={i} className="indicator-card">
                    <div className="indicator-header">
                      <span className="indicator-name">{ind.name}</span>
                      {ind.trend === 'up'
                        ? <TrendingUp size={16} className="trend-icon trend-up" />
                        : <TrendingDown size={16} className="trend-icon trend-down" />}
                    </div>
                    <div className="indicator-value">{ind.value}%</div>
                    <div className={`indicator-change ${ind.trend === 'up' ? 'positive' : 'negative'}`}>
                      {ind.change > 0 ? '+' : ''}{ind.change}% change
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ PREDICTIONS TAB ══════════════════════ */}
        {activeTab === 'predictions' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Price Predictions</h2>
            </div>
            <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.9rem' }}>
              Each model has its own <strong style={{ color: '#94a3b8' }}>3-Year / 10-Year</strong> selector.
              Click <strong style={{ color: '#94a3b8' }}>⚡ Live Compute</strong> to train and see real results.
            </p>
            {Object.keys(modelMetrics).map((name) => (
              <ModelPredictionCard key={name} modelName={name} />
            ))}
          </div>
        )}

        {/* ══════════════════════ MODELS TAB ══════════════════════ */}
        {activeTab === 'models' && (
          <div className="tab-content">
            <div className="section-header">
              <h2 className="section-title"><Brain size={24} /> Model Performance Comparison</h2>
              <div className="bond-selector">
                <button className={`selector-btn ${selectedBond === '3-year' ? 'active' : ''}`} onClick={() => setSelectedBond('3-year')}>3-Year Bond</button>
                <button className={`selector-btn ${selectedBond === '10-year' ? 'active' : ''}`} onClick={() => setSelectedBond('10-year')}>10-Year Bond</button>
              </div>
            </div>

            <div className="chart-container">
              <h3 className="chart-title">R² Score Comparison ({selectedBond})</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={Object.entries(modelMetrics)
                    .filter(([, v]) => v[selectedBond].r2 !== null)
                    .map(([name, values]) => ({
                      name,
                      r2: values[selectedBond].r2 * 100,
                      mape: values[selectedBond].mape * 100,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                    formatter={(value) => `${value.toFixed(2)}%`}
                  />
                  <Legend />
                  <Bar dataKey="r2" fill="#3b82f6" name="R² Score %" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="table-container">
              <table className="model-table">
                <thead>
                  <tr><th>Model</th><th>MAPE</th><th>MAE</th><th>MSE</th><th>R² Score</th></tr>
                </thead>
                <tbody>
                  {Object.entries(modelMetrics).map(([name, values], i) => (
                    <tr key={i}>
                      <td className="model-name">{name}</td>
                      <td>{values[selectedBond].mape.toFixed(4)}</td>
                      <td>{values[selectedBond].mae.toFixed(4)}</td>
                      <td>{values[selectedBond].mse.toFixed(4)}</td>
                      <td className="accuracy-cell">
                        {values[selectedBond].r2 !== null ? (
                          <>
                            <div className="accuracy-bar" style={{ width: `${values[selectedBond].r2 * 100}%` }} />
                            <span>{(values[selectedBond].r2 * 100).toFixed(2)}%</span>
                          </>
                        ) : (
                          <span className="na-value">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════ DATA ANALYSIS TAB ══════════════════════ */}
        {activeTab === 'data' && (
          <div className="tab-content">
            <h2 className="section-title"><Database size={24} /> Dataset Information</h2>

            <div className="info-grid">
              {[
                ['3-Year Bond Dataset', bondData3Year],
                ['10-Year Bond Dataset', bondData10Year],
              ].map(([title, d]) => (
                <div key={title} className="info-card">
                  <Clock size={20} className="info-icon" />
                  <h3>{title}</h3>
                  <ul className="info-list">
                    <li>Total Data Points: <strong>{d.totalData.toLocaleString()}</strong></li>
                    <li>Training Set: <strong>{d.trainingData.toLocaleString()} (80%)</strong></li>
                    <li>Testing Set: <strong>{d.testingData.toLocaleString()} (20%)</strong></li>
                    <li>Features: <strong>50 Macroeconomic Indicators</strong></li>
                  </ul>
                </div>
              ))}
            </div>

            <div className="section">
              <h3 className="subsection-title"><AlertCircle size={20} /> Key Features Used</h3>
              <div className="features-grid">
                {['GDP Growth Rate', 'Inflation Rate', 'Interest Rates', 'Exchange Rates',
                  'Industrial Production', 'Consumer Price Index', 'Money Supply',
                  'Trade Balance', 'Fiscal Deficit', 'Foreign Exchange Reserves',
                ].map(f => <div key={f} className="feature-tag">{f}</div>)}
              </div>
            </div>

            <div className="section">
              <h3 className="subsection-title">Data Processing Pipeline</h3>
              <div className="pipeline-steps">
                {[
                  ['Data Collection', 'Gather historical bond prices and macroeconomic indicators'],
                  ['Data Preprocessing', 'Clean, normalize, and handle missing values'],
                  ['Feature Engineering', 'Extract relevant features and create time-series sequences'],
                  ['Model Training', 'Train multiple models (Linear Regression, ARIMA, DLSTM, XGBoost)'],
                  ['Evaluation & Deployment', 'Evaluate models and deploy the best performing one'],
                ].map(([title, desc], i) => (
                  <div key={i} className="pipeline-step">
                    <div className="step-number">{i + 1}</div>
                    <div className="step-content"><h4>{title}</h4><p>{desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      <footer className="footer">
        <p>G-Sec Bond Market Prediction System © 2026 | Powered by Deep Learning &amp; AI</p>
      </footer>
    </div>
  );
}

export default App;
