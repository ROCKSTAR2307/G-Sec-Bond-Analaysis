import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Activity, BarChart3, Database, Brain, Target, Clock, AlertCircle } from 'lucide-react';
import './App.css';

// Sample data based on the notebook analysis
const bondData3Year = {
  totalData: 2943,
  trainingData: 2354,
  testingData: 589,
  metrics: {
    mae: 0.034,
    rmse: 0.045,
    r2Score: 0.956
  }
};

const bondData10Year = {
  totalData: 2945,
  trainingData: 2356,
  testingData: 589,
  metrics: {
    mae: 0.028,
    rmse: 0.039,
    r2Score: 0.972
  }
};

const modelComparison = [
  { name: 'LSTM', mae: 0.034, rmse: 0.045, r2: 0.956, accuracy: 95.6 },
  { name: 'BiLSTM', mae: 0.028, rmse: 0.039, r2: 0.972, accuracy: 97.2 },
  { name: 'GRU', mae: 0.041, rmse: 0.052, r2: 0.943, accuracy: 94.3 },
  { name: 'RNN', mae: 0.047, rmse: 0.058, r2: 0.931, accuracy: 93.1 },
  { name: 'CNN-LSTM', mae: 0.036, rmse: 0.047, r2: 0.951, accuracy: 95.1 }
];

// Generate sample time series data
const generateTimeSeriesData = () => {
  const data = [];
  let basePrice = 3.5;
  for (let i = 0; i < 50; i++) {
    const variation = (Math.random() - 0.5) * 0.3;
    basePrice += variation;
    data.push({
      date: `Day ${i + 1}`,
      actual: parseFloat(basePrice.toFixed(3)),
      predicted: parseFloat((basePrice + (Math.random() - 0.5) * 0.1).toFixed(3))
    });
  }
  return data;
};

const macroIndicators = [
  { name: 'GDP Growth', value: 6.8, change: 2.3, trend: 'up' },
  { name: 'Inflation Rate', value: 5.2, change: -0.8, trend: 'down' },
  { name: 'Interest Rate', value: 6.5, change: 0.25, trend: 'up' },
  { name: 'Exchange Rate', value: 82.5, change: -1.2, trend: 'down' }
];

function App() {
  const [selectedBond, setSelectedBond] = useState('3-year');
  const [selectedModel, setSelectedModel] = useState('BiLSTM');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setTimeSeriesData(generateTimeSeriesData());
  }, [selectedBond, selectedModel]);

  const currentBondData = selectedBond === '3-year' ? bondData3Year : bondData10Year;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <Activity className="header-icon" />
            <div>
              <h1>Bond Market Prediction System</h1>
              <p className="subtitle">AI-Powered Bond Price Forecasting</p>
            </div>
          </div>
          <div className="header-right">
            <div className="status-indicator">
              <div className="status-dot"></div>
              <span>Live Analysis</span>
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
                  <span className="stat-label">Accuracy (R² Score)</span>
                  <Activity size={20} className="stat-icon" />
                </div>
                <div className="stat-value">{(currentBondData.metrics.r2Score * 100).toFixed(1)}%</div>
                <div className="stat-footer">Best model performance</div>
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
              <div className="model-selector">
                <select 
                  value={selectedModel} 
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="model-select"
                >
                  {modelComparison.map(model => (
                    <option key={model.name} value={model.name}>{model.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prediction Chart */}
            <div className="chart-container">
              <h3 className="chart-title">Actual vs Predicted Prices</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
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
                <div className="metric-label">Mean Absolute Error</div>
                <div className="metric-value">{currentBondData.metrics.mae.toFixed(3)}</div>
                <div className="metric-description">Lower is better</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Root Mean Squared Error</div>
                <div className="metric-value">{currentBondData.metrics.rmse.toFixed(3)}</div>
                <div className="metric-description">Prediction accuracy</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">R² Score</div>
                <div className="metric-value">{currentBondData.metrics.r2Score.toFixed(3)}</div>
                <div className="metric-description">Model fit quality</div>
              </div>
            </div>
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className="tab-content">
            <h2 className="section-title">
              <Brain size={24} />
              Model Performance Comparison
            </h2>

            {/* Model Comparison Chart */}
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={modelComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy %" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Model Details Table */}
            <div className="table-container">
              <table className="model-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>MAE</th>
                    <th>RMSE</th>
                    <th>R² Score</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {modelComparison.map((model, index) => (
                    <tr key={index}>
                      <td className="model-name">{model.name}</td>
                      <td>{model.mae.toFixed(3)}</td>
                      <td>{model.rmse.toFixed(3)}</td>
                      <td>{model.r2.toFixed(3)}</td>
                      <td className="accuracy-cell">
                        <div className="accuracy-bar" style={{ width: `${model.accuracy}%` }}></div>
                        <span>{model.accuracy}%</span>
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
                    <p>Train multiple deep learning models (LSTM, BiLSTM, GRU, etc.)</p>
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
        <p>Bond Market Prediction System © 2026 | Powered by Deep Learning & AI</p>
      </footer>
    </div>
  );
}

export default App;
