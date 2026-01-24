import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Activity, BarChart3, Database, Brain, Target, Clock, AlertCircle } from 'lucide-react';
import './App.css';

// Model metrics data - hardcoded as per research paper
const modelMetrics = {
  'Linear Regression': {
    '3-year': { mape: 0.0108, mae: 0.0762, mse: 0.0092, r2: 0.7008 },
    '10-year': { mape: 0.0114, mae: 0.0817, mse: 0.0077, r2: 0.7743 }
  },
  'ARIMA': {
    '3-year': { mape: 0.0199, mae: 0.1391, mse: 0.0321, r2: null },
    '10-year': { mape: 0.0362, mae: 0.2551, mse: 0.0968, r2: null }
  },
  'DLSTM': {
    '3-year': { mape: 0.0090, mae: 0.0633, mse: 0.0078, r2: 0.7556 },
    '10-year': { mape: 0.0062, mae: 0.0450, mse: 0.0035, r2: 0.8894 }
  },
  'XGBoost': {
    '3-year': { mape: 0.0018, mae: 0.0753, mse: 0.0101, r2: 0.9890 },
    '10-year': { mape: 0.0013, mae: 0.0398, mse: 0.0026, r2: 0.9938 }
  }
};

// Dataset info
const bondData3Year = {
  totalData: 2943,
  trainingData: 2354,
  testingData: 589
};

const bondData10Year = {
  totalData: 2945,
  trainingData: 2356,
  testingData: 589
};

// Generate time series data for 3-year bond (3 data points for years)
const generate3YearData = () => {
  return [
    { year: '2022', actual: 6.82, predicted: 6.75 },
    { year: '2023', actual: 7.05, predicted: 7.12 },
    { year: '2024', actual: 6.91, predicted: 6.88 }
  ];
};

// Generate time series data for 10-year bond (10 data points for years)
const generate10YearData = () => {
  return [
    { year: '2015', actual: 7.75, predicted: 7.68 },
    { year: '2016', actual: 7.45, predicted: 7.52 },
    { year: '2017', actual: 6.98, predicted: 7.05 },
    { year: '2018', actual: 7.35, predicted: 7.28 },
    { year: '2019', actual: 6.85, predicted: 6.92 },
    { year: '2020', actual: 6.15, predicted: 6.08 },
    { year: '2021', actual: 6.45, predicted: 6.52 },
    { year: '2022', actual: 7.25, predicted: 7.18 },
    { year: '2023', actual: 7.15, predicted: 7.22 },
    { year: '2024', actual: 6.95, predicted: 6.88 }
  ];
};

const macroIndicators = [
  { name: 'GDP Growth', value: 6.8, change: 2.3, trend: 'up' },
  { name: 'Inflation Rate', value: 5.2, change: -0.8, trend: 'down' },
  { name: 'Interest Rate', value: 6.5, change: 0.25, trend: 'up' },
  { name: 'Exchange Rate', value: 82.5, change: -1.2, trend: 'down' }
];

function App() {
  const [selectedBond, setSelectedBond] = useState('3-year');
  const [selectedModel, setSelectedModel] = useState('XGBoost');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (selectedBond === '3-year') {
      setTimeSeriesData(generate3YearData());
    } else {
      setTimeSeriesData(generate10YearData());
    }
  }, [selectedBond]);

  const currentBondData = selectedBond === '3-year' ? bondData3Year : bondData10Year;
  const currentMetrics = modelMetrics[selectedModel][selectedBond];

  // Get best model for display (XGBoost has best R² score)
  const bestR2 = modelMetrics['XGBoost'][selectedBond].r2;

  return (
    <div className="app">
      {/* Header */}
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

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={18} />
          Overview
        </button>
        <button
          className={`nav-tab ${activeTab === 'predictions' ? 'active' : ''}`}
          onClick={() => setActiveTab('predictions')}
        >
          <Brain size={18} />
          Predictions
        </button>
        <button
          className={`nav-tab ${activeTab === 'models' ? 'active' : ''}`}
          onClick={() => setActiveTab('models')}
        >
          <Target size={18} />
          Models
        </button>
        <button
          className={`nav-tab ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          <Database size={18} />
          Data Analysis
        </button>
      </nav>

      <div className="main-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            {/* Bond Type Selector */}
            <div className="section-header">
              <h2>Bond Market Overview</h2>
              <div className="bond-selector">
                <button
                  className={`selector-btn ${selectedBond === '3-year' ? 'active' : ''}`}
                  onClick={() => setSelectedBond('3-year')}
                >
                  3-Year Bond
                </button>
                <button
                  className={`selector-btn ${selectedBond === '10-year' ? 'active' : ''}`}
                  onClick={() => setSelectedBond('10-year')}
                >
                  10-Year Bond
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Total Dataset</span>
                  <Database size={20} className="stat-icon" />
                </div>
                <div className="stat-value">{currentBondData.totalData.toLocaleString()}</div>
                <div className="stat-footer">Data points available</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Training Set</span>
                  <Brain size={20} className="stat-icon" />
                </div>
                <div className="stat-value">{currentBondData.trainingData.toLocaleString()}</div>
                <div className="stat-footer">80% of total data</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Test Set</span>
                  <Target size={20} className="stat-icon" />
                </div>
                <div className="stat-value">{currentBondData.testingData.toLocaleString()}</div>
                <div className="stat-footer">20% of total data</div>
              </div>

              <div className="stat-card highlight">
                <div className="stat-header">
                  <span className="stat-label">Best R² Score</span>
                  <Activity size={20} className="stat-icon" />
                </div>
                <div className="stat-value">{(bestR2 * 100).toFixed(2)}%</div>
                <div className="stat-footer">XGBoost model performance</div>
              </div>
            </div>

            {/* Macro Indicators */}
            <div className="section">
              <h3 className="section-title">
                <TrendingUp size={20} />
                Macroeconomic Indicators
              </h3>
              <div className="indicators-grid">
                {macroIndicators.map((indicator, index) => (
                  <div key={index} className="indicator-card">
                    <div className="indicator-header">
                      <span className="indicator-name">{indicator.name}</span>
                      {indicator.trend === 'up' ? (
                        <TrendingUp size={16} className="trend-icon trend-up" />
                      ) : (
                        <TrendingDown size={16} className="trend-icon trend-down" />
                      )}
                    </div>
                    <div className="indicator-value">{indicator.value}%</div>
                    <div className={`indicator-change ${indicator.trend === 'up' ? 'positive' : 'negative'}`}>
                      {indicator.change > 0 ? '+' : ''}{indicator.change}% change
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Predictions Tab */}
        {activeTab === 'predictions' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Price Predictions</h2>
              <div className="selectors-row">
                <div className="bond-selector">
                  <button
                    className={`selector-btn ${selectedBond === '3-year' ? 'active' : ''}`}
                    onClick={() => setSelectedBond('3-year')}
                  >
                    3-Year Bond
                  </button>
                  <button
                    className={`selector-btn ${selectedBond === '10-year' ? 'active' : ''}`}
                    onClick={() => setSelectedBond('10-year')}
                  >
                    10-Year Bond
                  </button>
                </div>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="model-select"
                >
                  {Object.keys(modelMetrics).map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prediction Chart */}
            <div className="chart-container">
              <h3 className="chart-title">Actual vs Predicted Prices ({selectedBond === '3-year' ? '3 Years' : '10 Years'})</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="year" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="#3b82f6"
                    fill="url(#colorActual)"
                    strokeWidth={2}
                    name="Actual Price"
                  />
                  <Area
                    type="monotone"
                    dataKey="predicted"
                    stroke="#10b981"
                    fill="url(#colorPredicted)"
                    strokeWidth={2}
                    name="Predicted Price"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Metrics */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">MAPE</div>
                <div className="metric-value">{currentMetrics.mape.toFixed(4)}</div>
                <div className="metric-description">Mean Absolute Percentage Error</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">MAE</div>
                <div className="metric-value">{currentMetrics.mae.toFixed(4)}</div>
                <div className="metric-description">Mean Absolute Error</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">MSE</div>
                <div className="metric-value">{currentMetrics.mse.toFixed(4)}</div>
                <div className="metric-description">Mean Squared Error</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">R² Score</div>
                <div className="metric-value">{currentMetrics.r2 !== null ? currentMetrics.r2.toFixed(4) : 'N/A'}</div>
                <div className="metric-description">Coefficient of Determination</div>
              </div>
            </div>
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className="tab-content">
            <div className="section-header">
              <h2 className="section-title">
                <Brain size={24} />
                Model Performance Comparison
              </h2>
              <div className="bond-selector">
                <button
                  className={`selector-btn ${selectedBond === '3-year' ? 'active' : ''}`}
                  onClick={() => setSelectedBond('3-year')}
                >
                  3-Year Bond
                </button>
                <button
                  className={`selector-btn ${selectedBond === '10-year' ? 'active' : ''}`}
                  onClick={() => setSelectedBond('10-year')}
                >
                  10-Year Bond
                </button>
              </div>
            </div>

            {/* Model Comparison Chart */}
            <div className="chart-container">
              <h3 className="chart-title">R² Score Comparison ({selectedBond})</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(modelMetrics).filter(([_, v]) => v[selectedBond].r2 !== null).map(([name, values]) => ({
                  name,
                  r2: values[selectedBond].r2 * 100,
                  mape: values[selectedBond].mape * 100
                }))}>
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

            {/* Model Details Table */}
            <div className="table-container">
              <table className="model-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>MAPE</th>
                    <th>MAE</th>
                    <th>MSE</th>
                    <th>R² Score</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(modelMetrics).map(([name, values], index) => (
                    <tr key={index}>
                      <td className="model-name">{name}</td>
                      <td>{values[selectedBond].mape.toFixed(4)}</td>
                      <td>{values[selectedBond].mae.toFixed(4)}</td>
                      <td>{values[selectedBond].mse.toFixed(4)}</td>
                      <td className="accuracy-cell">
                        {values[selectedBond].r2 !== null ? (
                          <>
                            <div className="accuracy-bar" style={{ width: `${values[selectedBond].r2 * 100}%` }}></div>
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

        {/* Data Analysis Tab */}
        {activeTab === 'data' && (
          <div className="tab-content">
            <h2 className="section-title">
              <Database size={24} />
              Dataset Information
            </h2>

            <div className="info-grid">
              <div className="info-card">
                <Clock size={20} className="info-icon" />
                <h3>3-Year Bond Dataset</h3>
                <ul className="info-list">
                  <li>Total Data Points: <strong>2,943</strong></li>
                  <li>Training Set: <strong>2,354 (80%)</strong></li>
                  <li>Testing Set: <strong>589 (20%)</strong></li>
                  <li>Features: <strong>50 Macroeconomic Indicators</strong></li>
                </ul>
              </div>

              <div className="info-card">
                <Clock size={20} className="info-icon" />
                <h3>10-Year Bond Dataset</h3>
                <ul className="info-list">
                  <li>Total Data Points: <strong>2,945</strong></li>
                  <li>Training Set: <strong>2,356 (80%)</strong></li>
                  <li>Testing Set: <strong>589 (20%)</strong></li>
                  <li>Features: <strong>50 Macroeconomic Indicators</strong></li>
                </ul>
              </div>
            </div>

            <div className="section">
              <h3 className="subsection-title">
                <AlertCircle size={20} />
                Key Features Used
              </h3>
              <div className="features-grid">
                <div className="feature-tag">GDP Growth Rate</div>
                <div className="feature-tag">Inflation Rate</div>
                <div className="feature-tag">Interest Rates</div>
                <div className="feature-tag">Exchange Rates</div>
                <div className="feature-tag">Industrial Production</div>
                <div className="feature-tag">Consumer Price Index</div>
                <div className="feature-tag">Money Supply</div>
                <div className="feature-tag">Trade Balance</div>
                <div className="feature-tag">Fiscal Deficit</div>
                <div className="feature-tag">Foreign Exchange Reserves</div>
              </div>
            </div>

            <div className="section">
              <h3 className="subsection-title">Data Processing Pipeline</h3>
              <div className="pipeline-steps">
                <div className="pipeline-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Data Collection</h4>
                    <p>Gather historical bond prices and macroeconomic indicators</p>
                  </div>
                </div>
                <div className="pipeline-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Data Preprocessing</h4>
                    <p>Clean, normalize, and handle missing values</p>
                  </div>
                </div>
                <div className="pipeline-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Feature Engineering</h4>
                    <p>Extract relevant features and create time-series sequences</p>
                  </div>
                </div>
                <div className="pipeline-step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <h4>Model Training</h4>
                    <p>Train multiple models (Linear Regression, ARIMA, DLSTM, XGBoost)</p>
                  </div>
                </div>
                <div className="pipeline-step">
                  <div className="step-number">5</div>
                  <div className="step-content">
                    <h4>Evaluation & Deployment</h4>
                    <p>Evaluate models and deploy the best performing one</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>G-Sec Bond Market Prediction System © 2026 | Powered by Deep Learning & AI</p>
      </footer>
    </div>
  );
}

export default App;
