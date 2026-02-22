import { useState } from 'react';
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Activity, BarChart3,
  Database, Brain, Target, Clock, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
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

// Unique accent per model — used for Predicted line
const MODEL_COLORS = {
  'Linear Regression': '#38bdf8',   // sky blue
  'ARIMA': '#fb923c',   // orange
  'DLSTM': '#c084fc',   // purple
  'XGBoost': '#34d399',   // emerald
};

// Actual line is always the same near-white so it's always distinct
const ACTUAL_LINE_COLOR = '#e2e8f0';


// ─── Indicators with categories, definitions, and yield impact ───────────────

const ALL_INDICATORS = [
  // ── MARKET ACTION & VELOCITY ───────────────────────────────────────────────────
  {
    name: 'Change %', short: 'Δ%', cat: 'Market Action', impact: '↕', color: '#38bdf8',
    def: 'The percentage difference in the bond yield/price compared to the previous trading day. Captures immediate daily momentum and shock reactions.'
  },
  {
    name: 'Daily Return (%)', short: 'Return', cat: 'Market Action', impact: '↕', color: '#0ea5e9',
    def: 'Alternative calculation of the logarithmic or simple daily return of the bond, used as a stationary feature for time-series forecasting.'
  },
  {
    name: 'Volatility (7D)', short: 'Vol (7D)', cat: 'Market Action', impact: '↑', color: '#818cf8',
    def: 'The rolling 7-day standard deviation of the bond returns. Used by the models to detect turbulent market regimes and adjust state confidence.'
  },
  {
    name: 'SMA (7D)', short: 'SMA-7', cat: 'Market Action', impact: '↕', color: '#c084fc',
    def: 'Simple Moving Average over 7 days. Smooths out daily noise to provide a short-term trend line, a crucial feature for the DLSTM sequence modelling.'
  },
  {
    name: 'SMA (30D)', short: 'SMA-30', cat: 'Market Action', impact: '↕', color: '#e879f9',
    def: 'Simple Moving Average over 30 days. Anchors the medium-term momentum and allows models to detect mean-reversion pullbacks.'
  },
  {
    name: '10-Year FBIL (%)', short: '10Y FBIL', cat: 'Market Action', impact: '↕', color: '#a78bfa',
    def: 'The benchmark 10-year yield reported by FBIL. Used as a cross-reference anchor even when predicting the 3-year bond to capture yield curve slope dynamics.'
  },

  // ── RBI RATES & LIQUIDITY ──────────────────────────────────────────────────
  {
    name: 'Policy Repo Rate (%)', short: 'Repo', cat: 'Liquidity', impact: '↑', color: '#f97316',
    def: 'The primary policy rate at which RBI lends to commercial banks. The ultimate anchor of the short-term yield curve.'
  },
  {
    name: 'Reverse Repo Rate (%)', short: 'Rev Repo', cat: 'Liquidity', impact: '↓', color: '#fbbf24',
    def: 'The rate at which banks park surplus funds with RBI. Acts as the lower bound of the overnight rate corridor during surplus liquidity periods.'
  },
  {
    name: 'MSF Rate (%)', short: 'MSF', cat: 'Liquidity', impact: '↑', color: '#f59e0b',
    def: 'The penal rate at which banks can borrow overnight funds from RBI against G-Secs. Forms the upper bound of the interest rate corridor.'
  },
  {
    name: 'Bank Rate (%)', short: 'Bank Rate', cat: 'Liquidity', impact: '↑', color: '#f43f5e',
    def: 'The standard rate at which RBI buys or rediscounts bills of exchange or other commercial papers. Aligned with the MSF rate.'
  },
  {
    name: 'Base Rate (%)', short: 'Base Rate', cat: 'Liquidity', impact: '↑', color: '#fb923c',
    def: 'The minimum interest rate below which banks cannot lend to their customers. A slow-moving indicator of systemic credit costs.'
  },
  {
    name: 'Cash Reserve Ratio (%)', short: 'CRR', cat: 'Liquidity', impact: '↑', color: '#4ade80',
    def: 'The fraction of deposits banks must hold with RBI as balance. Hikes drain systemic liquidity, putting upward pressure on yields.'
  },
  {
    name: 'Statutory Liquidity (%)', short: 'SLR', cat: 'Liquidity', impact: '↓', color: '#2dd4bf',
    def: 'The fraction of deposits banks must invest in liquid assets (chiefly G-Secs). Directly creates a captive demand loop for sovereign bonds.'
  },

  // ── MONEY MARKET & FOREX ─────────────────────────────────────────────────
  {
    name: '91-Day T-Bill Yield (%)', short: '91D', cat: 'Micro', impact: '↑', color: '#34d399',
    def: 'Yield on 3-month government paper. Tracks immediate short-term systemic liquidity, risk-free rate, and inflation expectations.'
  },
  {
    name: '182-Day T-Bill Yield (%)', short: '182D', cat: 'Micro', impact: '↑', color: '#10b981',
    def: 'Yield on 6-month government paper. Fills out the short end of the yield curve.'
  },
  {
    name: '364-Day T-Bill Yield (%)', short: '364D', cat: 'Micro', impact: '↑', color: '#059669',
    def: 'Yield on 1-year government paper. The essential bridge connecting money markets to the medium-term G-Sec bond market.'
  },
  {
    name: 'FX Premia 1-month (%)', short: 'FX 1M', cat: 'Macro', impact: '↑', color: '#22d3ee',
    def: 'The 1-month forward premium on the USD/INR currency pair. Reflects the covered interest parity gap and immediate FII currency hedging costs.'
  },
  {
    name: 'FX Premia 3-month (%)', short: 'FX 3M', cat: 'Macro', impact: '↑', color: '#06b6d4',
    def: 'The 3-month forward premium on USD/INR. A critical indicator of medium-term currency depreciation expectations.'
  },
  {
    name: 'FX Premia 6-month (%)', short: 'FX 6M', cat: 'Macro', impact: '↑', color: '#0891b2',
    def: 'The 6-month forward premium on USD/INR. Used by foreign portfolio investors to price out exchange risk on Indian debt.'
  },
  {
    name: 'FX Reserves (US $M)', short: 'Reserves', cat: 'Macro', impact: '↓', color: '#6366f1',
    def: 'RBI\'s total US Dollar and foreign currency asset stockpile. Significant drainages indicate central bank market interventions to protect the Rupee, tightening systemic liquidity.'
  },
];

// ── modal portal ─────────────────────────────────────────────────────────────

function IndicatorModal({ indicator, onClose }) {
  if (!indicator) return null;
  const { name, short, cat, impact, color, def } = indicator;

  const catColors = { Macro: '#38bdf8', Market: '#f59e0b', Liquidity: '#34d399', Micro: '#c084fc' };
  const catColor = catColors[cat] || '#94a3b8';
  const impactLabel = impact === '↑' ? 'Raises Yield' : impact === '↓' ? 'Lowers Yield' : 'Mixed Effect';
  const impactBg = impact === '↑' ? 'rgba(248,113,113,0.15)' : impact === '↓' ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)';
  const impactClr = impact === '↑' ? '#f87171' : impact === '↓' ? '#34d399' : '#fbbf24';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'backdropIn 0.25s ease both',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px',
          background: 'linear-gradient(160deg, #0f1f35 0%, #0b1424 60%, #0f172a 100%)',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: `0 0 0 1px ${color}33, 0 40px 80px rgba(0,0,0,0.7), 0 0 80px ${color}18`,
          animation: 'modalZoomIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        {/* Coloured accent bar at top */}
        <div style={{
          height: '4px',
          background: `linear-gradient(90deg, ${color}, ${color}88, transparent)`,
        }} />

        {/* Header */}
        <div style={{
          padding: '24px 24px 16px',
          background: `linear-gradient(135deg, ${color}0f, transparent)`,
          borderBottom: `1px solid ${color}20`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Abbr badge */}
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                background: `${color}18`,
                border: `1px solid ${color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 20px ${color}22`,
              }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 900, color, letterSpacing: '0.04em' }}>{short}</span>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2, marginBottom: '6px' }}>
                  {name}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Category */}
                  <span className="cat-badge" style={{ background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}33` }}>
                    {cat} Indicator
                  </span>
                  {/* Yield impact */}
                  <span className="cat-badge" style={{ background: impactBg, color: impactClr, border: `1px solid ${impactClr}33` }}>
                    {impact} {impactLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Close X */}
            <button onClick={onClose} style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b'; }}
            >✕</button>
          </div>
        </div>

        {/* Definition body */}
        <div style={{ padding: '20px 24px 28px' }}>
          <div style={{
            fontSize: '0.8rem', fontWeight: 600, color: color,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
          }}>Definition &amp; G-Sec Context</div>
          <p style={{
            margin: 0,
            fontSize: '0.9rem',
            color: '#cbd5e1',
            lineHeight: 1.75,
          }}>{def}</p>
        </div>

        {/* Bottom glow strip */}
        <div style={{
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${color}44, transparent)`,
        }} />
      </div>
    </div>
  );
}

function ExpandableIndicators() {
  const [selected, setSelected] = useState(null);

  // Group by category
  const groups = ALL_INDICATORS.reduce((acc, ind) => {
    if (ind.name === 'RBI Repo Rate' && acc['Liquidity']) return acc; // dedup
    if (!acc[ind.cat]) acc[ind.cat] = [];
    acc[ind.cat].push(ind);
    return acc;
  }, {});

  const catOrder = ['Macro', 'Market', 'Liquidity', 'Micro'];
  const catColors = { Macro: '#38bdf8', Market: '#f59e0b', Liquidity: '#34d399', Micro: '#c084fc' };

  return (
    <div style={{ marginBottom: '24px' }}>
      {catOrder.map(cat => {
        const inds = groups[cat];
        if (!inds?.length) return null;
        return (
          <div key={cat} style={{ marginBottom: '16px' }}>
            {/* Category label */}
            <div style={{
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: catColors[cat],
              marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <div style={{ height: '1px', width: '20px', background: catColors[cat], opacity: 0.5 }} />
              {cat} Indicators
              <div style={{ height: '1px', flex: 1, background: `${catColors[cat]}22` }} />
            </div>
            {/* Tag pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {inds.map(ind => (
                <button
                  key={ind.name}
                  className={`ind-tag ${selected?.name === ind.name ? 'active' : ''}`}
                  style={{ '--tag-color': ind.color }}
                  onClick={() => setSelected(prev => prev?.name === ind.name ? null : ind)}
                >
                  <span className="dot" />
                  {ind.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Modal portal */}
      {selected && <IndicatorModal indicator={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── ML Model Explainer Modal ────────────────────────────────────────────────

const MODEL_INFO = {
  'Linear Regression': {
    type: 'Classical Statistical',
    tagline: 'Baseline benchmark — fast, interpretable, surprisingly strong',
    params: [['Features', '50 macro indicators'], ['Method', 'Ordinary Least Squares'], ['Scaling', 'Z-score normalisation'], ['Train split', '80% (2,354 points)']],
    project: 'Used as the interpretability benchmark. Each coefficient tells exactly which macro variable pushes bond yields — CPI and Repo Rate have the highest β weights. Achieves R² = 0.77 on the 10-year bond despite being a linear model.',
    Diagram: ({ color }) => (
      <svg viewBox="0 0 420 160" style={{ width: '100%', maxWidth: 700 }}>
        <defs>
          <marker id="arr-lr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color} opacity="0.7" />
          </marker>
        </defs>
        {/* Feature boxes */}
        {[['CPI', '#f472b6'], ['Repo', '#fb923c'], ['GDP', '#38bdf8'], ['FX', '#a78bfa'], ['Oil', '#f97316']].map(([label, c], i) => (
          <g key={label}>
            <rect x={4} y={i * 28 + 4} width={52} height={22} rx={5} fill={`${c}18`} stroke={`${c}55`} strokeWidth={1} />
            <text x={30} y={i * 28 + 18} textAnchor="middle" fill={c} fontSize={10} fontWeight="700">{label}</text>
          </g>
        ))}
        {/* Arrows to Σ */}
        {[0, 1, 2, 3, 4].map(i => (
          <line key={i} x1={57} y1={i * 28 + 15} x2={148} y2={80} stroke={color} strokeWidth={1} opacity={0.4} markerEnd="url(#arr-lr)" />
        ))}
        {/* Weighted sum node */}
        <circle cx={168} cy={80} r={22} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
        <text x={168} y={76} textAnchor="middle" fill={color} fontSize={13} fontWeight="900">Σ</text>
        <text x={168} y={90} textAnchor="middle" fill={color} fontSize={8} opacity={0.7}>β·x</text>
        {/* Arrow to output */}
        <line x1={191} y1={80} x2={255} y2={80} stroke={color} strokeWidth={1.5} markerEnd="url(#arr-lr)" />
        {/* Output */}
        <rect x={258} y={62} width={80} height={36} rx={8} fill={`${color}22`} stroke={color} strokeWidth={1.5} />
        <text x={298} y={77} textAnchor="middle" fill={color} fontSize={10} fontWeight="700">Predicted</text>
        <text x={298} y={91} textAnchor="middle" fill={color} fontSize={10} fontWeight="700">Price ŷ</text>
        {/* Equation */}
        <text x={168} y={140} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">ŷ = β₀ + β₁CPI + β₂Repo + ... + β₅₀x₅₀</text>
      </svg>
    ),
  },
  'ARIMA': {
    type: 'Time-Series Statistical',
    tagline: 'Classic time-series — captures autocorrelation in yield movements',
    params: [['Order (3Y)', 'ARIMA(2,1,2)'], ['Order (10Y)', 'ARIMA(1,1,1)'], ['Stationarity', 'ADF-tested, d=1'], ['Scope', 'Univariate (yield only)']],
    project: 'Fits purely on the historical bond yield series — no macro features. Differencing (d=1) removes the unit root to achieve stationarity. The AR(p) terms model yield momentum, MA(q) terms model shock recovery. Best at capturing mean-reversion in stable regimes.',
    Diagram: ({ color }) => (
      <svg viewBox="0 0 440 140" style={{ width: '100%', maxWidth: 700 }}>
        <defs>
          <marker id="arr-ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color} opacity="0.7" />
          </marker>
        </defs>
        {[['Raw\nYields', 10], ['  I(d=1)\nDifference', 90], ['AR(p)\nHistory', 178], ['MA(q)\nErrors', 266], ['Forecast\nPrice', 356]].map(([label, x], i) => {
          const lines = label.split('\n');
          return (
            <g key={i}>
              <rect x={x} y={44} width={72} height={52} rx={8} fill={i === 4 ? `${color}25` : `${color}12`} stroke={i === 4 ? color : `${color}55`} strokeWidth={i === 4 ? 2 : 1} />
              {lines.map((l, li) => <text key={li} x={x + 36} y={64 + li * 16} textAnchor="middle" fill={i === 4 ? color : '#94a3b8'} fontSize={9.5} fontWeight={i === 4 ? 700 : 500}>{l.trim()}</text>)}
              {i < 4 && <line x1={x + 72} y1={70} x2={x + 89} y2={70} stroke={color} strokeWidth={1.5} markerEnd="url(#arr-ar)" opacity={0.7} />}
            </g>
          );
        })}
        <text x={220} y={122} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace">Yₜ = c + φ₁Yₜ₋₁ + φ₂Yₜ₋₂ + θ₁εₜ₋₁ + θ₂εₜ₋₂ + εₜ</text>
        <text x={220} y={135} textAnchor="middle" fill="#475569" fontSize={8}>AIC-optimal order selection via grid search</text>
      </svg>
    ),
  },
  'DLSTM': {
    type: 'Deep Learning (Recurrent)',
    tagline: 'Stacked LSTM — learns long-range temporal dependencies in bond yields',
    params: [['Seq length', '60 trading days'], ['Architecture', 'LSTM(128) → LSTM(64) → Dense(1)'], ['Optimiser', 'Adam (lr=0.001)'], ['Epochs', '200, batch=32, dropout=0.2']],
    project: 'Takes the last 60 days of 50 macro features as a 3D sequence (60×50). Two stacked LSTM layers capture short-term momentum and long-term macro regime. Dropout(0.2) prevents overfitting. Achieves best 10Y accuracy with R²=0.89.',
    Diagram: ({ color }) => (
      <svg viewBox="0 0 440 160" style={{ width: '100%', maxWidth: 700 }}>
        <defs>
          <marker id="arr-lstm" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color} opacity="0.7" />
          </marker>
        </defs>
        {/* Input */}
        <rect x={4} y={55} width={58} height={50} rx={7} fill="#1e293b" stroke="#334155" strokeWidth={1} />
        <text x={33} y={74} textAnchor="middle" fill="#94a3b8" fontSize={9}>Input</text>
        <text x={33} y={87} textAnchor="middle" fill="#64748b" fontSize={8}>60×50</text>
        <text x={33} y={99} textAnchor="middle" fill="#64748b" fontSize={8}>sequence</text>
        <line x1={62} y1={80} x2={78} y2={80} stroke={color} strokeWidth={1.5} markerEnd="url(#arr-lstm)" opacity={0.7} />
        {/* LSTM Cell 1 */}
        <rect x={80} y={30} width={100} height={100} rx={10} fill={`${color}12`} stroke={`${color}55`} strokeWidth={1.5} />
        <text x={130} y={52} textAnchor="middle" fill={color} fontSize={9.5} fontWeight={700}>LSTM Layer 1</text>
        <text x={130} y={65} textAnchor="middle" fill="#64748b" fontSize={8}>128 units</text>
        {[['f', 'Forget', '#f87171'], ['i', 'Input', '#34d399'], ['o', 'Output', '#60a5fa']].map(([sym, label, gc], idx) => (
          <g key={sym}>
            <rect x={88} y={72 + idx * 18} width={84} height={14} rx={4} fill={`${gc}22`} stroke={`${gc}55`} strokeWidth={0.7} />
            <text x={130} y={82 + idx * 18} textAnchor="middle" fill={gc} fontSize={8}>{sym} — {label} Gate</text>
          </g>
        ))}
        <line x1={180} y1={80} x2={196} y2={80} stroke={color} strokeWidth={1.5} markerEnd="url(#arr-lstm)" opacity={0.7} />
        {/* LSTM Cell 2 */}
        <rect x={198} y={42} width={90} height={76} rx={10} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
        <text x={243} y={62} textAnchor="middle" fill={color} fontSize={9.5} fontWeight={700}>LSTM Layer 2</text>
        <text x={243} y={75} textAnchor="middle" fill="#64748b" fontSize={8}>64 units</text>
        <text x={243} y={90} textAnchor="middle" fill="#64748b" fontSize={8}>dropout 0.2</text>
        <text x={243} y={108} textAnchor="middle" fill="#64748b" fontSize={8}>return_seq=False</text>
        <line x1={288} y1={80} x2={304} y2={80} stroke={color} strokeWidth={1.5} markerEnd="url(#arr-lstm)" opacity={0.7} />
        {/* Dense */}
        <rect x={306} y={60} width={64} height={40} rx={8} fill={`${color}18`} stroke={color} strokeWidth={1} />
        <text x={338} y={77} textAnchor="middle" fill={color} fontSize={9} fontWeight={700}>Dense</text>
        <text x={338} y={90} textAnchor="middle" fill="#64748b" fontSize={8}>1 neuron</text>
        <line x1={370} y1={80} x2={386} y2={80} stroke={color} strokeWidth={1.5} markerEnd="url(#arr-lstm)" opacity={0.7} />
        {/* Output */}
        <rect x={388} y={64} width={46} height={32} rx={7} fill={`${color}25`} stroke={color} strokeWidth={2} />
        <text x={411} y={78} textAnchor="middle" fill={color} fontSize={9} fontWeight={800}>ŷ</text>
        <text x={411} y={90} textAnchor="middle" fill={color} fontSize={8}>price</text>
        {/* Cell state arrow */}
        <path d="M80,28 Q210,-2 370,28" fill="none" stroke={`${color}55`} strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={224} y={17} textAnchor="middle" fill={`${color}88`} fontSize={8}>Cell State cₜ (long-term memory)</text>
      </svg>
    ),
  },
  'XGBoost': {
    type: 'Gradient Boosted Trees (Ensemble)',
    tagline: 'Best performer — R²=0.99, top feature: Crude Oil (SHAP)',
    params: [['Trees', '200 estimators'], ['Max depth', '6'], ['Learning rate', '0.1'], ['Subsample', '0.8, colsample=0.8']],
    project: 'Sequentially builds 200 shallow trees where each corrects the residual error of the previous ensemble. XGBoost uses second-order gradient statistics for fast convergence. Top SHAP features: Crude Oil, FII Flows, CPI. Achieves R²=0.99 on both 3Y and 10Y bonds — the best model in this study.',
    Diagram: ({ color }) => (
      <svg viewBox="0 0 440 150" style={{ width: '100%', maxWidth: 700 }}>
        <defs>
          <marker id="arr-xgb" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color} opacity="0.7" />
          </marker>
        </defs>
        {/* Features */}
        <rect x={4} y={50} width={55} height={50} rx={7} fill="#1e293b" stroke="#334155" strokeWidth={1} />
        <text x={31} y={72} textAnchor="middle" fill="#94a3b8" fontSize={9}>50</text>
        <text x={31} y={85} textAnchor="middle" fill="#94a3b8" fontSize={9}>Features</text>
        <text x={31} y={97} textAnchor="middle" fill="#64748b" fontSize={8}>x₁…x₅₀</text>
        <line x1={59} y1={75} x2={74} y2={75} stroke={color} strokeWidth={1.5} markerEnd="url(#arr-xgb)" opacity={0.7} />
        {/* Trees */}
        {[1, 2, 3].map((n, i) => {
          const x = 76 + i * 106;
          const opa = 1 - i * 0.18;
          return (
            <g key={n} opacity={opa}>
              <polygon points={`${x + 38},${30 - i * 4} ${x},${100} ${x + 76},${100}`} fill={`${color}${i === 0 ? '22' : '12'}`} stroke={`${color}${i === 0 ? '88' : '44'}`} strokeWidth={1.5} />
              <text x={x + 38} y={62} textAnchor="middle" fill={color} fontSize={10} fontWeight={700}>T{n}</text>
              <text x={x + 38} y={76} textAnchor="middle" fill="#94a3b8" fontSize={8}>depth=6</text>
              {/* residual note */}
              <text x={x + 38} y={115} textAnchor="middle" fill="#475569" fontSize={7.5}>r{n} = y−ŷ{n - 1}</text>
              {i < 2 && <line x1={x + 76} y1={75} x2={x + 105} y2={75} stroke={color} strokeWidth={1.2} markerEnd="url(#arr-xgb)" opacity={0.6} strokeDasharray="3 2" />}
            </g>
          );
        })}
        {/* Dots */}
        <text x={368} y={79} fill={`${color}88`} fontSize={16}>…</text>
        <line x1={382} y1={75} x2={396} y2={75} stroke={color} strokeWidth={1.5} markerEnd="url(#arr-xgb)" opacity={0.7} />
        {/* Final output */}
        <rect x={398} y={55} width={38} height={40} rx={8} fill={`${color}25`} stroke={color} strokeWidth={2} />
        <text x={417} y={72} textAnchor="middle" fill={color} fontSize={9} fontWeight={800}>Σ</text>
        <text x={417} y={85} textAnchor="middle" fill={color} fontSize={8}>ŷ</text>
        {/* Equation */}
        <text x={220} y={138} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace">F(x) = T₁(x) + η·T₂(x) + η²·T₃(x) + … + η¹⁹⁹·T₂₀₀(x)</text>
      </svg>
    ),
  },
};

function ModelExplainerModal({ modelName, onClose }) {
  if (!modelName) return null;
  const info = MODEL_INFO[modelName];
  const color = MODEL_COLORS[modelName] || '#38bdf8';
  const { Diagram } = info;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'backdropIn 0.25s ease both',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '850px',
          background: 'linear-gradient(160deg, #0c1a2e 0%, #0b1424 50%, #0f172a 100%)',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: `0 0 0 1px ${color}33, 0 40px 100px rgba(0,0,0,0.8), 0 0 100px ${color}14`,
          animation: 'modalZoomIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: '4px', background: `linear-gradient(90deg, ${color}, ${color}88, transparent)` }} />

        {/* Header */}
        <div style={{
          padding: '28px 32px 20px',
          background: `linear-gradient(135deg, ${color}0d, transparent)`,
          borderBottom: `1px solid ${color}20`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                padding: '5px 12px', borderRadius: '100px', fontSize: '0.75rem',
                fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: `${color}20`, border: `1px solid ${color}44`, color,
              }}>{info.type}</div>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#f1f5f9' }}>{modelName}</h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.95rem', color: '#64748b', fontStyle: 'italic' }}>{info.tagline}</p>
          </div>
          <button onClick={onClose} style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#64748b', cursor: 'pointer', fontSize: '1.1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#f1f5f9'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b'; }}
          >✕</button>
        </div>

        {/* SVG Diagram */}
        <div style={{ padding: '24px 32px', borderBottom: `1px solid ${color}14` }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
            Architecture Diagram
          </div>
          <div style={{
            background: `${color}07`, borderRadius: '16px',
            border: `1px solid ${color}15`, padding: '24px',
            display: 'flex', justifyContent: 'center',
          }}>
            <Diagram color={color} />
          </div>
        </div>

        {/* How it's used + params side by side */}
        <div style={{ padding: '24px 32px 32px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
          {/* In this project */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
              In This Project
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#94a3b8', lineHeight: 1.75 }}>{info.project}</p>
          </div>
          {/* Hyperparameters */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
              Key Parameters
            </div>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <tbody>
                {info.params.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '6px 14px 6px 0', fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>{k}</td>
                    <td style={{
                      padding: '6px 14px', fontSize: '0.85rem', fontWeight: 600,
                      color: '#e2e8f0', background: `${color}10`, borderRadius: '8px',
                      boxShadow: `inset 0 0 0 1px ${color}15`,
                    }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom glow */}
        <div style={{ height: '2px', background: `linear-gradient(90deg, transparent, ${color}44, transparent)` }} />
      </div>
    </div>
  );
}

function ModelCardsSection() {
  const [activeModel, setActiveModel] = useState(null);

  const MODEL_TYPES = {
    'Linear Regression': { type: 'Classical', icon: '📐', metric: 'R² 0.77' },
    'ARIMA': { type: 'Time-Series', icon: '📈', metric: 'MAPE 1.9%' },
    'DLSTM': { type: 'Deep Learning', icon: '🧠', metric: 'R² 0.89' },
    'XGBoost': { type: 'Ensemble', icon: '🌲', metric: 'R² 0.99 ★' },
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {Object.keys(MODEL_INFO).map(name => {
          const color = MODEL_COLORS[name] || '#38bdf8';
          const { type, icon, metric } = MODEL_TYPES[name];
          return (
            <button
              key={name}
              onClick={() => setActiveModel(name)}
              style={{
                padding: '18px 20px',
                background: `linear-gradient(135deg, ${color}0e 0%, #0f172a 100%)`,
                border: `1px solid ${color}33`,
                borderRadius: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px ${color}66`;
                e.currentTarget.style.borderColor = `${color}77`;
                e.currentTarget.style.background = `linear-gradient(135deg, ${color}18 0%, #0f172a 100%)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = `${color}33`;
                e.currentTarget.style.background = `linear-gradient(135deg, ${color}0e 0%, #0f172a 100%)`;
              }}
            >
              {/* Glow orb */}
              <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 80, height: 80, borderRadius: '50%',
                background: `radial-gradient(circle, ${color}1a, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: `${color}cc`,
                  background: `${color}18`, border: `1px solid ${color}33`,
                  padding: '2px 8px', borderRadius: '100px',
                }}>{type}</span>
              </div>
              {/* Name */}
              <div style={{ fontSize: '1rem', fontWeight: 800, color: color, marginBottom: '4px' }}>{name}</div>
              {/* Metric */}
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{metric}</div>
              {/* Hint */}
              <div style={{
                position: 'absolute', bottom: 10, right: 12,
                fontSize: '0.7rem', color: `${color}66`, fontWeight: 600,
              }}>✦ click to explore</div>
            </button>
          );
        })}
      </div>

      {activeModel && (
        <ModelExplainerModal modelName={activeModel} onClose={() => setActiveModel(null)} />
      )}
    </>
  );
}

// ─── Per-model prediction card ────────────────────────────────────────────────


function ModelPredictionCard({ modelName, onTrainingChange }) {
  const [bondType, setBondType] = useState('3-year');
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [computed, setComputed] = useState(false);

  const accentColor = MODEL_COLORS[modelName] || '#38bdf8';

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
    onTrainingChange?.(modelName);          // ← tell header we're training
    const startTime = Date.now();
    try {
      const result = await bondAPI.compute(bondType, modelName);

      // Ensure spinner is visible for at least 800ms
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

      const formatted = result.chart_data.dates.map((dateStr, i) => {
        const d = new Date(dateStr);
        const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return {
          date: label,
          year: d.getFullYear().toString(),
          Actual: result.chart_data.actual[i],
          Predicted: result.chart_data.predicted[i],
        };
      });
      setChartData(formatted);
      setMetrics(result.metrics);
      setComputed(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      onTrainingChange?.(null);             // ← training done, back to idle
    }
  };




  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      border: `1px solid ${accentColor}22`,
      borderRadius: '1.25rem',
      padding: '2rem',
      marginBottom: '2rem',
      boxShadow: `0 10px 30px rgba(0,0,0,0.3), 0 0 0 1px ${accentColor}11`,
    }}>

      {/* Header: 3-col grid → name | toggle (centred) | button */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.25rem',
      }}>
        {/* Model name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
            background: accentColor, boxShadow: `0 0 12px ${accentColor}`,
          }} />
          <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
            {modelName}
          </h3>
        </div>

        {/* Bond type pill */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'flex', gap: '4px', padding: '4px',
            background: '#0f172a', borderRadius: '10px', border: '1px solid #334155',
          }}>
            {['3-year', '10-year'].map(b => (
              <button key={b} onClick={() => !isLoading && handleBondChange(b)} style={{
                padding: '5px 18px',
                background: bondType === b ? accentColor : 'transparent',
                color: bondType === b ? '#0f172a' : isLoading ? '#334155' : '#94a3b8',
                border: 'none', borderRadius: '7px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.8rem',
                transition: 'all 0.25s ease', whiteSpace: 'nowrap',
                opacity: isLoading && bondType !== b ? 0.35 : 1,
              }}>
                {b === '3-year' ? '3-Year' : '10-Year'}
              </button>
            ))}
          </div>
        </div>

        {/* Compute button */}
        <button onClick={handleCompute} disabled={isLoading} style={{
          padding: '10px 22px',
          background: isLoading ? '#1e293b' : `linear-gradient(135deg, ${accentColor}cc, ${accentColor})`,
          color: isLoading ? '#64748b' : '#0f172a',
          border: `1px solid ${isLoading ? '#334155' : accentColor}`,
          borderRadius: '8px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', gap: '8px',
          transition: 'all 0.3s ease',
          boxShadow: isLoading ? 'none' : `0 4px 20px ${accentColor}44`,
          whiteSpace: 'nowrap',
        }}>
          {isLoading ? (
            <>
              <span style={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.15)',
                borderTopColor: '#fff',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
              Computing…
            </>
          ) : '⚡ Live Compute'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          color: '#fca5a5', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem',
        }}>⚠ {error}</div>
      )}

      {/* Chart — LineChart with white Actual + accent Predicted */}
      {computed && chartData.length > 0 && (
        <div style={{
          marginBottom: '1.5rem', marginTop: '0.5rem',
          background: 'rgba(15,23,42,0.6)',
          borderRadius: '1rem',
          padding: '1rem 0.5rem 0.5rem',
          border: '1px solid #1e293b',
        }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#334155"
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tick={{ fontSize: 11, fill: '#64748b' }}
                interval={Math.floor(chartData.length / 6)}
                tickFormatter={(val) => {
                  // show only the year part of the date string
                  const parts = val.split(' ');
                  return parts[2] || val;
                }}
              />
              <YAxis
                stroke="#334155" domain={['auto', 'auto']}
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => Number(v).toFixed(2)}
                width={52}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(148,163,184,0.15)', strokeWidth: 1, strokeDasharray: '4 3' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload || {};
                  const actual = payload.find(p => p.dataKey === 'Actual');
                  const predicted = payload.find(p => p.dataKey === 'Predicted');
                  return (
                    <div style={{
                      background: 'linear-gradient(160deg,#0f1f35,#0b1424)',
                      border: `1px solid ${accentColor}55`,
                      borderRadius: 14, padding: '14px 18px',
                      boxShadow: `0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px ${accentColor}18`,
                      minWidth: 200,
                    }}>
                      {/* Date header */}
                      <div style={{
                        fontSize: '0.72rem', fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        marginBottom: 10, paddingBottom: 8,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}>📅 {d.date}</div>
                      {/* Values */}
                      {actual && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 6 }}>
                          <span style={{ fontSize: '0.75rem', color: ACTUAL_LINE_COLOR, fontWeight: 600 }}>Actual</span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: ACTUAL_LINE_COLOR, fontVariantNumeric: 'tabular-nums' }}>
                            {Number(actual.value).toFixed(5)}
                          </span>
                        </div>
                      )}
                      {predicted && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                          <span style={{ fontSize: '0.75rem', color: accentColor, fontWeight: 600 }}>Predicted</span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>
                            {Number(predicted.value).toFixed(5)}
                          </span>
                        </div>
                      )}
                      {/* Error */}
                      {actual && predicted && (
                        <div style={{
                          marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)',
                          display: 'flex', justifyContent: 'space-between',
                        }}>
                          <span style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 600 }}>Error</span>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700,
                            color: Math.abs(actual.value - predicted.value) < 0.05 ? '#4ade80' : '#fbbf24',
                          }}>
                            {Math.abs(actual.value - predicted.value).toFixed(5)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '10px', fontSize: '0.82rem' }}
                formatter={(value) => (
                  <span style={{
                    color: value === 'Actual' ? ACTUAL_LINE_COLOR : accentColor,
                    fontWeight: 600,
                  }}>{value}</span>
                )}
              />
              {/* Actual — near-white, solid */}
              <Line
                type="monotone" dataKey="Actual" name="Actual"
                stroke={ACTUAL_LINE_COLOR} strokeWidth={1.5}
                dot={false}
                activeDot={{
                  r: 6, fill: ACTUAL_LINE_COLOR, strokeWidth: 2.5,
                  stroke: 'rgba(255,255,255,0.25)',
                  filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))',
                }}
              />
              {/* Predicted — model accent, dashed */}
              <Line
                type="monotone" dataKey="Predicted" name="Predicted"
                stroke={accentColor} strokeWidth={1.5} strokeDasharray="6 3"
                dot={false}
                activeDot={{
                  r: 6, fill: accentColor, strokeWidth: 2.5,
                  stroke: `${accentColor}44`,
                  filter: `drop-shadow(0 0 8px ${accentColor})`,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state */}
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

      {/* Loading */}
      {isLoading && (
        <div style={{
          height: '140px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${accentColor}33`, borderRadius: '1rem',
          color: '#94a3b8', marginBottom: '1.5rem', gap: '10px',
        }}>
          <span style={{ fontSize: '1.75rem', display: 'inline-block', animation: 'spin 0.8s linear infinite', color: accentColor }}>⟳</span>
          <span>Training <strong style={{ color: accentColor }}>{modelName}</strong> on {bondType} data…</span>
          {modelName === 'DLSTM' && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Deep LSTM may take 30–60 s</span>}
        </div>
      )}

      {/* Metrics grid */}
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
              border: `1px solid ${accentColor}28`, padding: '1rem 0.75rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>{label}</div>
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

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [selectedBond, setSelectedBond] = useState('3-year');
  const [activeTab, setActiveTab] = useState('overview');
  const [trainingModels, setTrainingModels] = useState(new Set()); // Set of model names currently training

  // Add or remove a model from the training set
  const handleTrainingChange = (modelName, isTraining) => {
    setTrainingModels(prev => {
      const next = new Set(prev);
      if (isTraining) next.add(modelName);
      else next.delete(modelName);
      return next;
    });
  };

  const currentBondData = selectedBond === '3-year' ? bondData3Year : bondData10Year;
  const bestModel = 'XGBoost';
  const currentMetrics = modelMetrics[bestModel][selectedBond];

  return (
    <div className="app">

      <header className="header">
        <div className="header-content">
          <div className="header-left">
            {/* Custom logo mark */}
            <div style={{
              width: 46, height: 46, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg,#0c2a4a,#0a1e36)',
              border: '1px solid rgba(56,189,248,0.25)',
              boxShadow: '0 0 20px rgba(56,189,248,0.15), inset 0 1px 0 rgba(56,189,248,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <polyline points="1,18 6,10 10,14 14,6 18,11 22,4 25,8"
                  stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  fill="none" style={{ filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.8))' }} />
                <circle cx="25" cy="8" r="2" fill="#4ade80"
                  style={{ filter: 'drop-shadow(0 0 5px rgba(74,222,128,0.9))' }}>
                  <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>

            <div>
              <h1>G-Sec Bond Market Prediction</h1>
              <p className="subtitle">AI-Powered Bond Yield Forecasting · India</p>
            </div>
          </div>

          {/* Right side badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Right side badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {trainingModels.size === 0 ? (
                /* Idle */
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 14px',
                  background: 'rgba(74,222,128,0.08)',
                  border: '1px solid rgba(74,222,128,0.22)',
                  borderRadius: 99,
                  fontSize: '0.72rem', fontWeight: 700, color: '#4ade80',
                  letterSpacing: '0.06em',
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#4ade80',
                    boxShadow: '0 0 8px rgba(74,222,128,0.8)',
                    flexShrink: 0, display: 'inline-block',
                  }} />
                  LIVE · 4 MODELS
                </div>
              ) : (
                /* One badge per training model */
                [...trainingModels].map(name => (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 12px',
                    background: 'rgba(251,191,36,0.08)',
                    border: '1px solid rgba(251,191,36,0.28)',
                    borderRadius: 99,
                    fontSize: '0.7rem', fontWeight: 700, color: '#fbbf24',
                    letterSpacing: '0.04em', whiteSpace: 'nowrap',
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      border: '2px solid rgba(251,191,36,0.2)',
                      borderTopColor: '#fbbf24',
                      display: 'inline-block',
                      animation: 'spin 0.7s linear infinite',
                      flexShrink: 0,
                    }} />
                    {name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="nav-tabs">
        {[
          { key: 'overview', label: 'Overview', Icon: BarChart3 },
          { key: 'predictions', label: 'Predictions', Icon: Brain },
          { key: 'models', label: 'Models', Icon: Target },
          { key: 'data', label: 'Research', Icon: Database },
          { key: 'authors', label: 'Authors', Icon: Activity },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`nav-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => { setActiveTab(key); setTrainingModels(new Set()); }}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>

      <div className="main-content">

        {/* ══════════════ OVERVIEW ══════════════ */}
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

            {/* Models Used — clickable explainer cards */}
            <div className="section">
              <h3 className="section-title"><Brain size={20} /> Models Used</h3>
              <p style={{ color: '#475569', fontSize: '0.8rem', marginBottom: '14px' }}>Click any model to see its architecture &amp; how we used it →</p>
              <ModelCardsSection />
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
                    <div className="metric-value">{val !== null ? val.toFixed(4) : 'N/A'}</div>
                    <div className="metric-description">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Macro/Micro Indicators — expandable */}
            <div className="section">
              <h3 className="section-title"><TrendingUp size={20} /> Macro/Micro Indicators Used</h3>
              <ExpandableIndicators />
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

        {/* ══════════════ PREDICTIONS ══════════════ */}
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
              <ModelPredictionCard key={name} modelName={name} onTrainingChange={handleTrainingChange} />
            ))}
          </div>
        )}

        {/* ══════════════ MODELS ══════════════ */}
        {activeTab === 'models' && (
          <div className="tab-content">
            <div className="section-header">
              <h2 className="section-title"><Brain size={24} /> Model Performance Comparison</h2>
              <div className="bond-selector">
                <button className={`selector-btn ${selectedBond === '3-year' ? 'active' : ''}`} onClick={() => setSelectedBond('3-year')}>3-Year Bond</button>
                <button className={`selector-btn ${selectedBond === '10-year' ? 'active' : ''}`} onClick={() => setSelectedBond('10-year')}>10-Year Bond</button>
              </div>
            </div>

            {/* ── Premium Chart ───────────────────────────────────────────── */}
            <div style={{
              background: 'linear-gradient(160deg,#0c1a2e,#0b1424)',
              border: '1px solid rgba(56,189,248,0.12)',
              borderRadius: '20px',
              padding: '28px 32px 20px',
              marginBottom: '24px',
            }}>
              {/* Title + description lines */}
              <div style={{ marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f0f6ff', letterSpacing: '-0.01em' }}>
                  Model Accuracy — MAPE &amp; R² Comparison
                  <span style={{
                    marginLeft: 10, fontSize: '0.72rem', fontWeight: 500,
                    background: `linear-gradient(90deg,#38bdf8,#818cf8)`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                  }}>({selectedBond} bond)</span>
                </h3>
                <p style={{ margin: '6px 0 2px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>MAPE (Mean Absolute Percentage Error)</span> — lower is better;
                  measures how closely the model's predictions track real bond yields on average.
                </p>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  <span style={{ color: '#818cf8', fontWeight: 600 }}>R² Score</span> — higher is better;
                  measures the proportion of yield variance explained by the model (ARIMA excluded — no macro features).
                </p>
              </div>

              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  barCategoryGap="30%"
                  barGap={4}
                  data={Object.entries(modelMetrics).map(([name, values]) => ({
                    name,
                    'MAPE %': +(values[selectedBond].mape * 100).toFixed(4),
                    'R² %': values[selectedBond].r2 !== null ? +(values[selectedBond].r2 * 100).toFixed(2) : null,
                    mapeRaw: values[selectedBond].mape,
                    maeRaw: values[selectedBond].mae,
                    mseRaw: values[selectedBond].mse,
                    r2Raw: values[selectedBond].r2,
                  }))}
                  margin={{ top: 20, right: 20, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradMape" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ade80" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradR2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148,163,184,0.04)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload || {};
                      const bestMape = Math.min(...Object.values(modelMetrics).map(v => v[selectedBond].mape));
                      const isBest = Math.abs(d.mapeRaw - bestMape) < 1e-9;
                      return (
                        <div style={{
                          background: 'linear-gradient(160deg,#0f1f35,#0b1424)',
                          border: '1px solid rgba(74,222,128,0.25)',
                          borderRadius: '14px', padding: '16px 20px',
                          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                          minWidth: '210px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f0f6ff' }}>{label}</span>
                            {isBest && <span style={{ fontSize: '0.65rem', padding: '2px 7px', background: 'rgba(74,222,128,0.18)', color: '#4ade80', borderRadius: 99, fontWeight: 700 }}>BEST MAPE ★</span>}
                          </div>
                          {/* MAPE hero */}
                          <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                            <div style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>⭐ MAPE (Primary Metric)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80' }}>{(d.mapeRaw * 100).toFixed(4)}%</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Avg error per prediction on real yields</div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div style={{ background: 'rgba(129,140,248,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                              <div style={{ fontSize: '0.65rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>R²</div>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: d.r2Raw !== null ? '#818cf8' : '#64748b' }}>
                                {d.r2Raw !== null ? `${(d.r2Raw * 100).toFixed(2)}%` : 'N/A'}
                              </div>
                            </div>
                            <div style={{ background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                              <div style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>MAE</div>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f87171' }}>{d.maeRaw?.toFixed(4)}</div>
                            </div>
                            <div style={{ background: 'rgba(251,191,36,0.08)', borderRadius: 8, padding: '8px 10px', gridColumn: '1/-1' }}>
                              <div style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>MSE</div>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fbbf24' }}>{d.mseRaw?.toFixed(4)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>{value}</span>}
                  />
                  <Bar dataKey="MAPE %" fill="url(#gradMape)" radius={[6, 6, 0, 0]} maxBarSize={52}>
                    {Object.entries(modelMetrics).map(([name]) => (
                      <Cell key={name} />
                    ))}
                  </Bar>
                  <Bar dataKey="R² %" fill="url(#gradR2)" radius={[6, 6, 0, 0]} maxBarSize={52}>
                    {Object.entries(modelMetrics).map(([name, values]) => (
                      <Cell key={name} fillOpacity={values[selectedBond].r2 === null ? 0.25 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Premium Table ────────────────────────────────────────────── */}
            {(() => {
              const bestMape = Math.min(...Object.values(modelMetrics).map(v => v[selectedBond].mape));
              const worstMape = Math.max(...Object.values(modelMetrics).map(v => v[selectedBond].mape));
              return (
                <div style={{
                  background: 'linear-gradient(160deg,#0c1a2e,#0b1424)',
                  border: '1px solid rgba(56,189,248,0.10)',
                  borderRadius: '20px',
                  overflow: 'hidden',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15,31,55,0.9)' }}>
                        {[['Model', 'left'], ['MAPE ★', 'center'], ['MAE', 'center'], ['MSE', 'center'], ['R² Score', 'center']].map(([h, align]) => (
                          <th key={h} style={{
                            padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                            color: h === 'MAPE ★' ? '#4ade80' : '#64748b',
                            textAlign: align,
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(modelMetrics).map(([name, values], i) => {
                        const m = values[selectedBond];
                        const isBest = Math.abs(m.mape - bestMape) < 1e-9;
                        const isWorst = Math.abs(m.mape - worstMape) < 1e-9;
                        const mapeColor = isBest ? '#4ade80' : isWorst ? '#f97316' : '#94a3b8';
                        const rowBg = isBest
                          ? 'rgba(74,222,128,0.04)'
                          : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';
                        const MODEL_COLORS_LOCAL = {
                          'Linear Regression': '#38bdf8', 'ARIMA': '#f59e0b', 'DLSTM': '#818cf8', 'XGBoost': '#4ade80'
                        };
                        const mc = MODEL_COLORS_LOCAL[name] || '#94a3b8';
                        return (
                          <tr key={i} style={{ background: rowBg, borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = rowBg}
                          >
                            {/* Model */}
                            <td style={{ padding: '14px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: mc, boxShadow: `0 0 8px ${mc}88`, flexShrink: 0 }} />
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f0f6ff' }}>{name}</span>
                                {isBest && <span style={{ fontSize: '0.6rem', padding: '2px 7px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', borderRadius: 99, fontWeight: 700 }}>BEST</span>}
                              </div>
                            </td>
                            {/* MAPE — hero */}
                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                <span style={{
                                  fontSize: '1rem', fontWeight: 800, color: mapeColor,
                                  padding: '4px 12px', borderRadius: 8,
                                  background: isBest ? 'rgba(74,222,128,0.12)' : isWorst ? 'rgba(249,115,22,0.10)' : 'rgba(148,163,184,0.08)',
                                  border: `1px solid ${mapeColor}30`,
                                }}>{(m.mape * 100).toFixed(4)}%</span>
                                <div style={{ width: '100%', height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${(m.mape / worstMape) * 100}%`, background: `linear-gradient(90deg,${mapeColor},${mapeColor}88)`, borderRadius: 99 }} />
                                </div>
                              </div>
                            </td>
                            {/* MAE */}
                            <td style={{ padding: '14px 20px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '0.88rem' }}>
                              {m.mae.toFixed(4)}
                            </td>
                            {/* MSE */}
                            <td style={{ padding: '14px 20px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: '0.88rem' }}>
                              {m.mse.toFixed(4)}
                            </td>
                            {/* R² */}
                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                              {m.r2 !== null ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                  <span style={{
                                    fontSize: '0.95rem', fontWeight: 800,
                                    color: m.r2 > 0.90 ? '#4ade80' : m.r2 > 0.75 ? '#38bdf8' : '#94a3b8'
                                  }}>{(m.r2 * 100).toFixed(2)}%</span>
                                  <div style={{ width: 80, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%', width: `${m.r2 * 100}%`,
                                      background: m.r2 > 0.90 ? 'linear-gradient(90deg,#4ade80,#059669)' :
                                        m.r2 > 0.75 ? 'linear-gradient(90deg,#38bdf8,#0ea5e9)' :
                                          'linear-gradient(90deg,#64748b,#475569)'
                                    }} />
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: '#475569', fontSize: '0.82rem', fontStyle: 'italic' }}>N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════════════ DATA ANALYSIS ══════════════ */}
        {activeTab === 'data' && (
          <div className="tab-content">

            {/* ══ ABOUT THIS PROJECT ══════════════════════════════════════════ */}
            <div style={{ marginBottom: 36 }}>

              {/* Hero headline */}
              <div style={{
                background: 'linear-gradient(135deg,rgba(56,189,248,0.08) 0%,rgba(129,140,248,0.08) 100%)',
                border: '1px solid rgba(56,189,248,0.15)',
                borderRadius: 24,
                padding: '36px 40px 32px',
                marginBottom: 24,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Glow orb */}
                <div style={{
                  position: 'absolute', top: -60, right: -60, width: 240, height: 240,
                  background: 'radial-gradient(circle,rgba(56,189,248,0.12),transparent 70%)', pointerEvents: 'none'
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: '1.55rem' }}>📄</span>
                  <div>
                    <div style={{
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: '#38bdf8', marginBottom: 3
                    }}>
                      IEEE Research Paper · Final Year Project
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#f0f6ff', lineHeight: 1.25 }}>
                      Predicting Indian G-Sec Bond Yields<br />
                      <span style={{
                        background: 'linear-gradient(90deg,#38bdf8,#818cf8)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                      }}>
                        Using Machine Learning &amp; Deep Learning
                      </span>
                    </h2>
                  </div>
                </div>

                <p style={{ margin: '0 0 16px', fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.8, maxWidth: 780 }}>
                  Indian Government Securities (G-Secs) are sovereign debt instruments issued by the RBI on behalf of the Government of India.
                  Their <strong style={{ color: '#e2e8f0' }}>yields</strong> reflect the market's collective assessment of inflation, growth, liquidity,
                  and fiscal risk — making accurate forecasting critical for institutional portfolio managers, monetary policy analysis, and
                  financial risk management.
                </p>
                <p style={{ margin: 0, fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.8, maxWidth: 780 }}>
                  This study constructs a <strong style={{ color: '#e2e8f0' }}>daily-frequency dataset spanning 2003–2024</strong> (~2,943 trading days)
                  for both the 3-year and 10-year G-Sec benchmarks, enriched with <strong style={{ color: '#e2e8f0' }}>20 macroeconomic &amp; technical features</strong> drawn
                  from RBI publications (monetary rates, T-bill yields, FX premia, FX reserves) and market-derived signals (SMA, Volatility, Return).
                </p>
              </div>

              {/* What we're trying to prove */}
              <div style={{
                background: 'linear-gradient(160deg,#0c1a2e,#0b1424)',
                border: '1px solid rgba(129,140,248,0.15)',
                borderRadius: 20,
                padding: '28px 32px',
                marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: '1.2rem' }}>🎯</span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f0f6ff' }}>
                    What This Research Sets Out to Prove
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
                  {[
                    {
                      icon: '📐', color: '#38bdf8',
                      title: 'Classical Baselines Work Surprisingly Well',
                      body: 'Linear Regression achieves R²=0.77 on the 10Y bond using only macro features — proving that a well-designed feature set beats model complexity for interpretability.',
                    },
                    {
                      icon: '🧠', color: '#818cf8',
                      title: 'Deep Sequence Models Capture Regime Shifts',
                      body: 'DLSTM (2-layer, 128→64 units) exploits the temporal ordering of macro variables to outperform classical models across long forecast horizons (R²=0.89 on 10Y).',
                    },
                    {
                      icon: '🌲', color: '#4ade80',
                      title: 'XGBoost Dominates on Tabular Data',
                      body: 'With MAPE of just 0.13% on the 10Y bond (best across all models), gradient-boosted trees prove superior at capturing non-linear interactions between macro indicators.',
                    },
                    {
                      icon: '📈', color: '#f59e0b',
                      title: 'ARIMA Struggles Without Macro Context',
                      body: 'Pure time-series modelling (ARIMA 2,1,2) trained only on yield history collapses when macro regimes shift — negative R² in some periods proves macro features are non-optional.',
                    },
                  ].map(({ icon, color, title, body }) => (
                    <div key={title} style={{
                      background: `rgba(255,255,255,0.025)`,
                      border: `1px solid ${color}22`,
                      borderRadius: 14, padding: '18px 20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                        <span style={{ fontSize: '1.15rem' }}>{icon}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{title}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.75 }}>{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Web Project Architecture */}
              <div style={{
                background: 'linear-gradient(160deg,#0c1a2e,#0b1424)',
                border: '1px solid rgba(74,222,128,0.12)',
                borderRadius: 20,
                padding: '28px 32px',
                marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: '1.2rem' }}>🏗️</span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f0f6ff' }}>
                    Web Application Architecture
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                  {/* Frontend */}
                  <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 16, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                      <span style={{ fontSize: '1.1rem' }}>🖥️</span>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Frontend</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f0f6ff' }}>React 19 + Vite + Recharts</div>
                      </div>
                    </div>
                    {[
                      ['Overview Tab', 'Live bond price stat cards, macroeconomic KPIs, and expandable indicator library with per-indicator yield impact modals'],
                      ['Predictions Tab', 'On-demand model inference — select bond (3Y/10Y) + model, fire POST /api/compute, render Actual vs Predicted line chart with 60-pt sequence context'],
                      ['Models Tab', 'Premium dual-metric bar chart (MAPE + R²) with custom hover tooltips; color-coded performance table with MAPE as the primary metric'],
                      ['Data Analysis Tab', 'Research context, web architecture overview, dataset cards, feature grid, and data processing pipeline'],
                    ].map(([tab, desc]) => (
                      <div key={tab} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', marginBottom: 3 }}>→ {tab}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.65 }}>{desc}</div>
                      </div>
                    ))}
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['React 19', 'Vite', 'Recharts', 'Lucide Icons', 'Render (Static)'].map(t => (
                        <span key={t} style={{ fontSize: '0.65rem', padding: '3px 8px', background: 'rgba(56,189,248,0.10)', color: '#38bdf8', borderRadius: 6, fontWeight: 600 }}>{t}</span>
                      ))}
                    </div>
                  </div>

                  {/* Backend */}
                  <div style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 16, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                      <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Backend</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f0f6ff' }}>Python Flask + TensorFlow + scikit-learn</div>
                      </div>
                    </div>
                    {[
                      ['POST /api/compute', 'Accepts { model, bond_type }. Trains (or loads cached) the selected model on the dataset, runs inference on the test split, and returns metrics + chart_data arrays'],
                      ['Model Registry', '4 model handlers: linear_regression (OLS), arima (2,1,2), lstm (2-layer DLSTM, seq=60), xgboost (n_estimators=200, max_depth=6)'],
                      ['Feature Pipeline', 'Reads p_merged_data CSV → Z-score normalisation → 80/20 split → sequence generation (DLSTM only) → model fit → predictions de-normalised back to yield %'],
                      ['Deployment', 'Hosted on Render (https://g-sec-svc.onrender.com) with venv + requirements.txt; Python 3.12.6 pinned via .python-version'],
                    ].map(([tab, desc]) => (
                      <div key={tab} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4ade80', marginBottom: 3 }}>→ {tab}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.65 }}>{desc}</div>
                      </div>
                    ))}
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['Flask', 'TensorFlow', 'scikit-learn', 'statsmodels', 'XGBoost', 'Render (Web SVC)'].map(t => (
                        <span key={t} style={{ fontSize: '0.65rem', padding: '3px 8px', background: 'rgba(74,222,128,0.10)', color: '#4ade80', borderRadius: 6, fontWeight: 600 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* API flow diagram */}
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
                  {[
                    { label: 'User selects\nModel + Bond', icon: '👤', color: '#38bdf8' },
                    { arrow: true },
                    { label: 'React fires\nPOST /api/compute', icon: '⚛️', color: '#818cf8' },
                    { arrow: true },
                    { label: 'Flask trains\n& runs model', icon: '🐍', color: '#4ade80' },
                    { arrow: true },
                    { label: 'Returns metrics\n+ chart arrays', icon: '📊', color: '#f59e0b' },
                    { arrow: true },
                    { label: 'Recharts renders\nActual vs Predicted', icon: '📈', color: '#f472b6' },
                  ].map((step, i) =>
                    step.arrow ? (
                      <div key={i} style={{ padding: '0 6px', color: '#334155', fontSize: '1.2rem' }}>→</div>
                    ) : (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.03)', border: `1px solid ${step.color}22`,
                        borderRadius: 12, padding: '12px 14px', textAlign: 'center', minWidth: 100,
                      }}>
                        <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{step.icon}</div>
                        <div style={{ fontSize: '0.65rem', color: step.color, fontWeight: 700, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{step.label}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* ══ PDF RESEARCH PAPER CARD ══ */}
            <div style={{ marginBottom: 28 }}>
              {/* Section label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span style={{ fontSize: '1.2rem' }}>📄</span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f0f6ff' }}>IEEE Research Paper</h3>
                <span style={{ fontSize: '0.65rem', padding: '3px 10px', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', borderRadius: 99, fontWeight: 700, border: '1px solid rgba(56,189,248,0.25)' }}>PDF</span>
              </div>

              {/* Clickable card */}
              <div
                onClick={() => window.open('/research-paper.pdf', '_blank')}
                style={{
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg,rgba(56,189,248,0.06) 0%,rgba(129,140,248,0.06) 100%)',
                  border: '1px solid rgba(56,189,248,0.18)',
                  borderRadius: 20,
                  padding: '32px 36px',
                  display: 'flex', alignItems: 'center', gap: 32,
                  position: 'relative', overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.border = '1px solid rgba(56,189,248,0.45)';
                  e.currentTarget.style.background = 'linear-gradient(135deg,rgba(56,189,248,0.10) 0%,rgba(129,140,248,0.10) 100%)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(56,189,248,0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.border = '1px solid rgba(56,189,248,0.18)';
                  e.currentTarget.style.background = 'linear-gradient(135deg,rgba(56,189,248,0.06) 0%,rgba(129,140,248,0.06) 100%)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Glow orb */}
                <div style={{
                  position: 'absolute', top: -40, right: -40, width: 180, height: 180,
                  background: 'radial-gradient(circle,rgba(56,189,248,0.10),transparent 70%)', pointerEvents: 'none'
                }} />

                {/* PDF Icon */}
                <div style={{
                  flexShrink: 0, width: 72, height: 88,
                  background: 'linear-gradient(160deg,#1e3a5f,#0f2040)',
                  border: '1px solid rgba(56,189,248,0.25)',
                  borderRadius: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  <span style={{ fontSize: '2rem' }}>📄</span>
                  <span style={{
                    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.08em', color: '#f87171',
                    background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
                    borderRadius: 4, padding: '2px 6px'
                  }}>PDF</span>
                </div>

                {/* Meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
                    color: '#38bdf8', marginBottom: 8
                  }}>IEEE Conference Paper · Final Year Project 2025–26</div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '1.25rem', fontWeight: 800, color: '#f0f6ff', lineHeight: 1.3 }}>
                    Predicting Indian G-Sec Bond Yields Using Machine Learning &amp; Deep Learning
                  </h3>
                  <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.65 }}>
                    Comparative study of Linear Regression, ARIMA, DLSTM, and XGBoost on 20+ macroeconomic &amp; technical features
                    over a daily dataset spanning 2003–2024. XGBoost achieves MAPE of <strong style={{ color: '#4ade80' }}>0.13%</strong> on the 10-year bond.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {['Linear Regression', 'ARIMA', 'DLSTM', 'XGBoost', 'G-Sec Yield Forecasting', 'RBI Macro Features'].map(tag => (
                      <span key={tag} style={{
                        fontSize: '0.62rem', padding: '3px 9px',
                        background: 'rgba(255,255,255,0.04)', color: '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 99, fontWeight: 600
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#38bdf8,#818cf8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 24px rgba(56,189,248,0.35)',
                  }}>
                    <span style={{ fontSize: '1.3rem' }}>↗</span>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>Click to open</span>
                </div>
              </div>
            </div>

            {/* ══ FEATURE DEEP DIVE ══ */}
            <div style={{
              background: 'linear-gradient(160deg,#0c1a2e,#0b1424)',
              border: '1px solid rgba(56,189,248,0.10)',
              borderRadius: 20,
              padding: '28px 32px',
              marginTop: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: '1.2rem' }}>🔬</span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f0f6ff' }}>Feature Deep Dive</h3>
              </div>
              <p style={{ margin: '0 0 22px', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6 }}>
                All 20 features used across models, grouped by category. Yield impact shows whether a rise in that indicator historically <span style={{ color: '#f87171' }}>raises ↑</span>, <span style={{ color: '#4ade80' }}>lowers ↓</span>, or has a <span style={{ color: '#fbbf24' }}>mixed ↕</span> effect on G-Sec yields.
              </p>
              {(() => {
                const CAT_META = {
                  'Market Action': { color: '#38bdf8', icon: '📊', desc: 'Price-derived signals computed from the bond yield series itself' },
                  'Liquidity': { color: '#4ade80', icon: '🏦', desc: 'RBI monetary policy rates that anchor the yield curve corridor' },
                  'Micro': { color: '#818cf8', icon: '📋', desc: 'Short-term T-bill yields forming the risk-free rate curve' },
                  'Macro': { color: '#f59e0b', icon: '🌐', desc: 'USD/INR forward premia and FX reserves reflecting currency market pressure' },
                };
                const impactStyle = (impact) => ({
                  fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  color: impact === '↑' ? '#f87171' : impact === '↓' ? '#4ade80' : '#fbbf24',
                  background: impact === '↑' ? 'rgba(248,113,113,0.12)' : impact === '↓' ? 'rgba(74,222,128,0.10)' : 'rgba(251,191,36,0.10)',
                  border: impact === '↑' ? '1px solid rgba(248,113,113,0.2)' : impact === '↓' ? '1px solid rgba(74,222,128,0.18)' : '1px solid rgba(251,191,36,0.18)',
                });
                const impactLabel = (impact) => impact === '↑' ? '↑ Raises yield' : impact === '↓' ? '↓ Lowers yield' : '↕ Mixed';

                const grouped = {};
                ALL_INDICATORS.forEach(ind => {
                  if (!grouped[ind.cat]) grouped[ind.cat] = [];
                  grouped[ind.cat].push(ind);
                });
                return Object.entries(grouped).map(([cat, inds]) => {
                  const meta = CAT_META[cat] || { color: '#94a3b8', icon: '📌', desc: '' };
                  return (
                    <div key={cat} style={{ marginBottom: 24 }}>
                      {/* Category header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: '1rem' }}>{meta.icon}</span>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: meta.color }}>{cat}</span>
                          <span style={{ fontSize: '0.72rem', color: '#475569', marginLeft: 10 }}>{meta.desc}</span>
                        </div>
                      </div>
                      {/* Feature rows */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 8 }}>
                        {inds.map(ind => (
                          <div key={ind.name} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${meta.color}18`,
                            borderRadius: 10, padding: '10px 14px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ind.color || meta.color, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{ind.name}</div>
                                <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600 }}>{ind.short}</div>
                              </div>
                            </div>
                            <span style={impactStyle(ind.impact)}>{impactLabel(ind.impact)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ══════════════ AUTHORS ══════════════ */}
        {activeTab === 'authors' && (
          <div className="tab-content">
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg,rgba(129,140,248,0.08) 0%,rgba(56,189,248,0.06) 100%)',
              border: '1px solid rgba(129,140,248,0.15)',
              borderRadius: 24, padding: '36px 40px', marginBottom: 28,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -60, right: -60, width: 240, height: 240,
                background: 'radial-gradient(circle,rgba(129,140,248,0.12),transparent 70%)', pointerEvents: 'none'
              }} />
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818cf8', marginBottom: 10 }}>
                Final Year Project · IEEE Research · 2025–26
              </div>
              <h2 style={{ margin: '0 0 12px', fontSize: '1.6rem', fontWeight: 800, color: '#f0f6ff', lineHeight: 1.2 }}>
                Meet the Team
              </h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b', maxWidth: 640, lineHeight: 1.75 }}>
                This project was developed as a Final Year B.Tech project, combining machine learning,
                deep learning, and financial data science to predict Indian G-Sec bond yields.
              </p>
            </div>

            {/* Author cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 20, marginBottom: 28 }}>
              {[
                {
                  name: 'T Shankarsai',
                  initials: 'TS',
                  color: '#38bdf8',
                  role: 'Web Developer · Research Contributor',
                  college: 'B.Tech · Computer Science & Engineering',
                  bio: 'Designed and built the complete full-stack web application — React dashboard, Flask REST API, and deployed the system on Render. Also contributed to the IEEE research paper writing and analysis.',
                  contributions: ['React 19 dashboard & UI/UX', 'Flask REST API backend', 'Render deployment (frontend + backend)', 'Research paper contribution', 'Data visualisation (Recharts)'],
                  tech: ['React', 'Vite', 'Flask', 'JavaScript', 'Python'],
                  github: 'https://github.com/ROCKSTAR2307',
                },
                {
                  name: 'S Vigneshwaraan',
                  initials: 'SV',
                  color: '#818cf8',
                  role: 'ML Engineer · Data Scientist',
                  college: 'B.Tech · Computer Science & Engineering',
                  bio: 'Led the entire machine learning pipeline — dataset curation, feature engineering, and training all four models (Linear Regression, ARIMA, DLSTM, XGBoost) on 21 years of G-Sec yield data.',
                  contributions: ['Linear Regression & ARIMA models', 'DLSTM (2-layer deep LSTM)', 'XGBoost (best MAPE: 0.13%)', 'Data preprocessing & feature engineering', 'Model evaluation & benchmarking'],
                  tech: ['Python', 'TensorFlow', 'XGBoost', 'scikit-learn', 'statsmodels'],
                  github: '#',
                },
              ].map((author) => (
                <div key={author.name} style={{
                  background: 'linear-gradient(160deg,#0c1a2e,#0b1424)',
                  border: `1px solid ${author.color}22`,
                  borderRadius: 20, overflow: 'hidden',
                }}>
                  {/* Top accent bar */}
                  <div style={{ height: 3, background: `linear-gradient(90deg,${author.color},#818cf8)` }} />

                  <div style={{ padding: '28px 28px 24px' }}>
                    {/* Avatar + name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg,${author.color}33,${author.color}11)`,
                        border: `2px solid ${author.color}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.3rem', fontWeight: 800, color: author.color,
                        boxShadow: `0 0 24px ${author.color}22`,
                        letterSpacing: '-0.02em',
                      }}>{author.initials}</div>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f0f6ff', lineHeight: 1.2 }}>{author.name}</div>
                        <div style={{ fontSize: '0.75rem', color: author.color, fontWeight: 600, marginTop: 4 }}>{author.role}</div>
                        <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 2 }}>{author.college}</div>
                      </div>
                    </div>

                    {/* Bio */}
                    <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.75 }}>{author.bio}</p>

                    {/* Contributions */}
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: 10 }}>Key Contributions</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {author.contributions.map(c => (
                          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: author.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tech */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                      {author.tech.map(t => (
                        <span key={t} style={{
                          fontSize: '0.62rem', padding: '3px 9px',
                          background: `${author.color}12`,
                          border: `1px solid ${author.color}25`,
                          borderRadius: 99, color: author.color, fontWeight: 700,
                        }}>{t}</span>
                      ))}
                    </div>

                    {/* Social links */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <a href={author.github} target="_blank" rel="noopener noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: '0.72rem', fontWeight: 600, color: '#64748b',
                        padding: '6px 14px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                        textDecoration: 'none', transition: 'color 0.2s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f0f6ff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                        GitHub
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Project summary card */}
            <div style={{
              background: 'linear-gradient(160deg,#0c1a2e,#0b1424)',
              border: '1px solid rgba(56,189,248,0.10)',
              borderRadius: 20, padding: '28px 32px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <span style={{ fontSize: '1.2rem' }}>🏫</span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f0f6ff' }}>Project Summary</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
                {[
                  { label: 'Dataset Size', value: '~2,943', sub: 'Daily G-Sec data points', color: '#38bdf8' },
                  { label: 'Date Range', value: '2003–24', sub: '21 years of market data', color: '#818cf8' },
                  { label: 'Features Used', value: '20', sub: 'Macro & technical indicators', color: '#4ade80' },
                  { label: 'Best MAPE', value: '0.13%', sub: 'XGBoost on 10-Year bond', color: '#fbbf24' },
                  { label: 'Best R²', value: '99.38%', sub: 'XGBoost on 10-Year bond', color: '#f472b6' },
                  { label: 'Models Tested', value: '4', sub: 'LR · ARIMA · DLSTM · XGBoost', color: '#fb923c' },
                ].map(item => (
                  <div key={item.label} style={{
                    background: `${item.color}08`, border: `1px solid ${item.color}18`,
                    borderRadius: 14, padding: '16px 18px',
                  }}>
                    <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: item.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{item.value}</div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 6 }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      <footer className="footer">
        <div style={{ fontSize: '0.72rem', color: '#334155', textAlign: 'center', width: '100%' }}>
          G-Sec Bond Market Prediction · Final Year Project · © 2026 Thaneesh Shankarsai
        </div>
      </footer>
    </div>
  );
}

export default App;
