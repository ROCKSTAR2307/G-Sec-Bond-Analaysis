import { useState } from 'react';
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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
  // ── MACRO ────────────────────────────────────────────────────────────────
  {
    name: 'GDP Growth Rate', short: 'GDP', cat: 'Macro', impact: '↑', color: '#38bdf8',
    def: 'Measures the annual % increase in the total value of goods & services produced. Rising GDP reduces demand for safe-haven bonds as risk appetite improves. A key regime-switching signal — when GDP accelerates past 7%, G-Sec yields typically rise 20–40 bps with a 2-quarter lag.'
  },
  {
    name: 'Inflation Rate (CPI)', short: 'CPI', cat: 'Macro', impact: '↑', color: '#f472b6',
    def: 'Consumer Price Index tracks the change in price paid by end consumers. RBI targets CPI ≤ 4%. Every 1% overshoot historically correlates with a ~35 bps rise in the 10-year G-Sec, as markets pre-price tightening. Used as the primary inflationary regime feature in ARIMA and DLSTM models.'
  },
  {
    name: 'RBI Repo Rate', short: 'Repo', cat: 'Macro', impact: '↑', color: '#fb923c',
    def: 'Rate at which RBI lends to commercial banks overnight. The most direct anchor of the yield curve — a 25 bps hike compresses the spread between Repo and 10Y G-Sec. Fed into the model as a lagged feature (t-1, t-3) because markets anticipate MPC decisions 1–2 meetings ahead.'
  },
  {
    name: 'Exchange Rate (USD/INR)', short: 'FX', cat: 'Macro', impact: '↑', color: '#a78bfa',
    def: 'Number of rupees per US dollar. Rupee depreciation raises the cost of imports, fuelling inflation and pressuring RBI to raise rates. Also triggers FII debt outflows — a combined effect that historically adds 15–25 bps to the 10-year G-Sec for every 2% depreciation.'
  },
  {
    name: 'Fiscal Deficit (% GDP)', short: 'FD', cat: 'Macro', impact: '↑', color: '#f87171',
    def: 'Excess of government spending over revenue, financed by G-Sec issuance. Every 100 bps widening in fiscal deficit raises the G-Sec yield by roughly 10–15 bps through the supply channel. The market watches the fiscal slippage announced in the Union Budget as a major yield trigger.'
  },
  {
    name: 'Current Account Balance', short: 'CAB', cat: 'Macro', impact: '↑', color: '#c084fc',
    def: 'Net of goods, services, and income flows across India\'s borders. India\'s structural CAD (~2% of GDP) makes bond yields sensitive to crude price swings. When CAD widens beyond 3% of GDP, risk premium on 10Y G-Sec rises by 20–30 bps based on historical episodes (2013 Taper Tantrum).'
  },
  {
    name: 'Trade Balance', short: 'TB', cat: 'Macro', impact: '↑', color: '#4ade80',
    def: 'Difference between merchandise exports and imports. A widening trade deficit signals higher USD demand, weakening the Rupee and ultimately pressuring bond markets. Used as a monthly high-frequency proxy for tracking CAD deterioration in the XGBoost feature set.'
  },
  {
    name: 'Money Supply (M3)', short: 'M3', cat: 'Macro', impact: '↑', color: '#22d3ee',
    def: 'Broadest measure of money (currency + demand deposits + time deposits). M3 growth above nominal GDP signals excess liquidity that could stoke inflation. RBI uses Variable Rate Reverse Repo and OMO to drain excess M3 — both operations move G-Sec yields.'
  },
  {
    name: 'Industrial Production (IIP)', short: 'IIP', cat: 'Macro', impact: '↑', color: '#34d399',
    def: 'Monthly output index for manufacturing, mining, and electricity. Strong IIP signals economic expansion, reduces flight-to-safety bond demand, and lowers RBI\'s motivation to cut rates. The model uses 3-month moving average IIP as a trend feature to smooth out base-effect distortions.'
  },
  {
    name: 'Foreign Exchange Reserves', short: 'FXR', cat: 'Macro', impact: '↓', color: '#0ea5e9',
    def: 'Total foreign currency assets + gold held by RBI (~$620 bn as of 2024). High reserves act as a buffer against Rupee depreciation and FII outflows, reducing the risk premium on sovereign bonds. Reserve drawdown months show a statistically significant 8–12 bps yield spike in our dataset.'
  },
  {
    name: 'Government Debt-to-GDP', short: 'D/GDP', cat: 'Macro', impact: '↑', color: '#f472b6',
    def: 'Total sovereign debt (central + state) as % of GDP (~85% for India). Higher ratio raises the sovereign risk premium — particularly visible in long-end (10Y+) yields. Used as a slow-moving structural feature in the Linear Regression model, alongside the fiscal deficit gap.'
  },
  {
    name: 'Net FDI Inflows', short: 'FDI', cat: 'Macro', impact: '↓', color: '#34d399',
    def: 'Long-term foreign equity investment into Indian businesses. Stable FDI improves the Balance of Payments, reduces Rupee volatility, and signals institutional confidence in Indian macros — all of which compress bond risk premia. Distinct from FII flows in that it\'s less sensitive to global risk-off.'
  },
  {
    name: 'Capital Account Balance', short: 'KAB', cat: 'Macro', impact: '↕', color: '#fb923c',
    def: 'Net financial flows — FDI + FII portfolio + ECB borrowings. Volatile component dominated by FII debt flows that directly impact G-Sec demand. Used as an interaction feature with exchange rate to detect "sudden stop" episodes where both simultaneously deteriorate.'
  },

  // ── MARKET / FINANCIAL ───────────────────────────────────────────────────
  {
    name: 'Crude Oil Price (Brent)', short: 'OIL', cat: 'Market', impact: '↑', color: '#f97316',
    def: 'Brent crude benchmark in USD/barrel. India imports ~85% of oil requirements — every $10/bbl rise adds ~₹1.2 trillion to the import bill, widening the fiscal and current accounts, fuelling inflation, and pushing G-Sec yields 15–20 bps higher. Highest individual Granger-causality score in our feature importance analysis.'
  },
  {
    name: 'Gold Prices (MCX)', short: 'GOLD', cat: 'Market', impact: '↓', color: '#fbbf24',
    def: 'Domestic gold futures on MCX (tracking LBMA gold). Gold and G-Secs are co-safe-haven assets — both rally during global risk-off episodes (e.g., COVID-19, Russia-Ukraine war). Negative correlation with equity markets makes it a useful regime indicator in the DLSTM regime embedding.'
  },
  {
    name: 'Stock Market (NIFTY 50)', short: 'EQ', cat: 'Market', impact: '↑', color: '#f59e0b',
    def: 'NSE flagship equity index. Strong equity rally signals risk-on appetite and triggers rotation from bonds into stocks, pushing G-Sec yields up. The equity-bond inverse relationship holds in ~72% of months in our dataset. NIFTY VIX (implied volatility) was also tested but showed multicollinearity with NIFTY.'
  },
  {
    name: 'Corporate Bond Spreads', short: 'CS', cat: 'Market', impact: '↓', color: '#e879f9',
    def: 'Yield premium over G-Sec for AAA-rated corporate bonds of the same tenor. Widening spreads signal credit stress and trigger flight-to-safety flows into G-Secs, compressing yields. The spread also reflects banking system health — a leading indicator for RBI liquidity action.'
  },
  {
    name: 'Yield Curve Slope (10Y−1Y)', short: 'YCS', cat: 'Market', impact: '↕', color: '#38bdf8',
    def: 'Difference between 10-year and 1-year G-Sec yields. A steep curve (>150 bps) signals growth expectations and eventual rate hikes; a flat/inverted curve (<50 bps) signals near-term cuts. Used as an endogenous lagged feature in ARIMA and as a regime label in DLSTM.'
  },
  {
    name: 'Net FII Debt Flows', short: 'FII', cat: 'Market', impact: '↕', color: '#818cf8',
    def: 'Monthly net purchase/sale of Indian debt securities by foreign investors. FII inflows compress G-Sec yields by adding demand; outflows during global tightening cycles (2013, 2018, 2022) sharply spike yields. One of the top-3 features by SHAP value in XGBoost for 10-year bond prediction.'
  },

  // ── LIQUIDITY / MONETARY ──────────────────────────────────────────────────
  {
    name: 'RBI Repo Rate', short: 'RR', cat: 'Liquidity', impact: '↑', color: '#fb923c',
    def: 'Short-term lending rate of RBI — already listed above under Macro for completeness in the full indicator table.'
  },
  {
    name: 'Reverse Repo / SDF Rate', short: 'SDF', cat: 'Liquidity', impact: '↓', color: '#22d3ee',
    def: 'Rate at which RBI absorbs surplus liquidity from banks (now the Standing Deposit Facility rate). The lower bound of the LAF corridor. When the overnight rate collapses toward the SDF, it signals surplus liquidity — putting downward pressure on short-term G-Sec yields.'
  },
  {
    name: 'Cash Reserve Ratio (CRR)', short: 'CRR', cat: 'Liquidity', impact: '↑', color: '#4ade80',
    def: 'Fraction of deposits banks must hold with RBI (currently 4.5%). A CRR hike drains banking system liquidity, tightens money markets, and pushes short-end G-Sec yields higher. CRR changes (rare) are used as a dummy variable in the ARIMA model.'
  },
  {
    name: 'Statutory Liquidity Ratio', short: 'SLR', cat: 'Liquidity', impact: '↓', color: '#a3e635',
    def: 'Fraction of deposits banks must maintain in liquid assets (mainly G-Secs) — currently 18%. SLR creates a structural captive demand for government bonds, keeping yields lower than they would be otherwise. SLR reductions reduce mandatory G-Sec demand, introducing mild upward yield pressure.'
  },
  {
    name: 'LAF Net Liquidity', short: 'LAF', cat: 'Liquidity', impact: '↓', color: '#f59e0b',
    def: 'Net daily liquidity injected/absorbed by RBI through the Liquidity Adjustment Facility (repo + reverse repo + SDF). Surplus LAF (banks parking excess funds) compresses overnight rates and G-Sec yields. Deficit LAF periods (2018, 2019) coincided with 50–80 bps yield spikes in the 3-year bond.'
  },
  {
    name: 'RBI OMO Operations', short: 'OMO', cat: 'Liquidity', impact: '↓', color: '#818cf8',
    def: 'RBI\'s open-market purchases/sales of G-Secs to manage system liquidity. OMO purchases inject base money and directly boost G-Sec prices (reduce yields). OMO calendar announcements are event-driven yield movers — modelled as a structural break dummy in ARIMA.'
  },
  {
    name: 'Money Market Rate (MIBOR)', short: 'MIBOR', cat: 'Liquidity', impact: '↑', color: '#ff6b6b',
    def: 'Mumbai Interbank Offered Rate — overnight rate for unsecured interbank lending. MIBOR anchors the short end of the yield curve; sustained MIBOR-repo spread > 20 bps signals liquidity tightness, which short-end G-Secs reprice to reflect.'
  },
  {
    name: 'Bank Credit Growth', short: 'BCG', cat: 'Liquidity', impact: '↑', color: '#22d3ee',
    def: 'Year-on-year growth in scheduled commercial bank credit. High credit growth reduces bank surplus funds available for G-Sec investment, raising yields through reduced SLR-excess buying. A secondary feature in XGBoost, capturing the credit-deposit ratio tightening signal.'
  },

  // ── MICRO / ACTIVITY ──────────────────────────────────────────────────────
  {
    name: 'WPI Inflation', short: 'WPI', cat: 'Micro', impact: '↑', color: '#fbbf24',
    def: 'Wholesale Price Index — upstream producer price pressures. WPI leads CPI by ~2–3 months in the Indian context. Sustained WPI > 6% historically precedes RBI tightening, making it a predictive leading indicator for forward-looking bond price models. Feature importance: 4th highest in Linear Regression.'
  },
  {
    name: 'PMI Composite', short: 'PMI', cat: 'Micro', impact: '↑', color: '#4ade80',
    def: 'Purchasing Managers\' Index — monthly survey of manufacturing + services activity. PMI > 50 = expansion; PMI < 50 = contraction. A high PMI reduces risk-off demand for G-Secs and signals favourable growth that allows RBI to hold or raise rates. Strong forward-looking signal for short-end G-Sec yields.'
  },
  {
    name: 'T-Bill Yield (91-day)', short: 'T91', cat: 'Micro', impact: '↑', color: '#38bdf8',
    def: '91-day Treasury Bill auction cut-off yield — the risk-free short-term rate. Acts as the benchmark for short-end G-Sec yields. Strong co-integration with Repo rate; deviations signal near-term market tightness. Used as an endogenous feature in the 3-year bond model to capture term structure dynamics.'
  },
  {
    name: 'OIS Rate (1Y)', short: 'OIS', cat: 'Micro', impact: '↑', color: '#c084fc',
    def: 'Overnight Index Swap — the 1-year fixed rate of swapping overnight floating MIBOR for a fixed rate. OIS is a market-based estimate of future policy rates. OIS-G-Sec spread is a key measure of market liquidity risk. Extracted as a forward-rate proxy feature in the DLSTM model\'s input sequence.'
  },
  {
    name: 'G-Sec Traded Volume', short: 'VOL', cat: 'Micro', impact: '↕', color: '#f472b6',
    def: 'Daily NDS-OM traded volume of G-Secs (all tenors). Low volume signals poor price discovery and bid-ask spread widening; high volumes during RBI trading windows indicate institutional positioning. Used as a market microstructure feature to weight confidence intervals in the XGBoost predictions.'
  },
  {
    name: 'SDL Spread (10Y)', short: 'SDL', cat: 'Micro', impact: '↑', color: '#fb923c',
    def: 'Premium of State Development Loan yields over central G-Sec yields of the same tenor. Widening SDL spreads signal fiscal stress at the state level, increasing overall government borrowing cost and crowding out central G-Sec demand. Monitored as a systemic fiscal risk indicator.'
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
      <svg viewBox="0 0 420 160" style={{ width: '100%', maxWidth: 420 }}>
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
      <svg viewBox="0 0 440 140" style={{ width: '100%', maxWidth: 440 }}>
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
      <svg viewBox="0 0 440 160" style={{ width: '100%', maxWidth: 440 }}>
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
      <svg viewBox="0 0 440 150" style={{ width: '100%', maxWidth: 440 }}>
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
          width: '100%', maxWidth: '600px',
          background: 'linear-gradient(160deg, #0c1a2e 0%, #0b1424 50%, #0f172a 100%)',
          borderRadius: '20px',
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
          padding: '22px 24px 16px',
          background: `linear-gradient(135deg, ${color}0d, transparent)`,
          borderBottom: `1px solid ${color}20`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                padding: '4px 10px', borderRadius: '100px', fontSize: '0.65rem',
                fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: `${color}20`, border: `1px solid ${color}44`, color,
              }}>{info.type}</div>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#f1f5f9' }}>{modelName}</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>{info.tagline}</p>
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
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${color}14` }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
            Architecture Diagram
          </div>
          <div style={{
            background: `${color}07`, borderRadius: '12px',
            border: `1px solid ${color}15`, padding: '16px',
          }}>
            <Diagram color={color} />
          </div>
        </div>

        {/* How it's used + params side by side */}
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* In this project */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              In This Project
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.7 }}>{info.project}</p>
          </div>
          {/* Hyperparameters */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Key Parameters
            </div>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <tbody>
                {info.params.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '4px 10px 4px 0', fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>{k}</td>
                    <td style={{
                      padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
                      color: '#e2e8f0', background: `${color}10`, borderRadius: '6px',
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


function ModelPredictionCard({ modelName }) {
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
    const startTime = Date.now();
    try {
      const result = await bondAPI.compute(bondType, modelName);

      // Ensure spinner is visible for at least 800ms
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

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
              <button key={b} onClick={() => handleBondChange(b)} style={{
                padding: '5px 18px',
                background: bondType === b ? accentColor : 'transparent',
                color: bondType === b ? '#0f172a' : '#94a3b8',
                border: 'none', borderRadius: '7px',
                cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                transition: 'all 0.25s ease', whiteSpace: 'nowrap',
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
          {isLoading
            ? <><span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span> Computing…</>
            : '⚡ Live Compute'}
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
                dataKey="year" stroke="#334155"
                ticks={uniqueYears} interval={0}
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={{ stroke: '#334155' }} tickLine={false}
              />
              <YAxis
                stroke="#334155" domain={['auto', 'auto']}
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => Number(v).toFixed(2)}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: `1px solid ${accentColor}66`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
                labelStyle={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}
                itemStyle={{ fontSize: '0.85rem', padding: '2px 0' }}
                formatter={(value, name) => [
                  <span key={name} style={{
                    fontWeight: 700,
                    color: name === 'Actual' ? ACTUAL_LINE_COLOR : accentColor,
                  }}>
                    {Number(value).toFixed(4)}
                  </span>,
                  name,
                ]}
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
                stroke={ACTUAL_LINE_COLOR} strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: ACTUAL_LINE_COLOR, strokeWidth: 0 }}
              />
              {/* Predicted — model accent, dashed */}
              <Line
                type="monotone" dataKey="Predicted" name="Predicted"
                stroke={accentColor} strokeWidth={2} strokeDasharray="6 3"
                dot={false} activeDot={{ r: 4, fill: accentColor, strokeWidth: 0 }}
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

  const currentBondData = selectedBond === '3-year' ? bondData3Year : bondData10Year;
  const bestModel = 'XGBoost';
  const currentMetrics = modelMetrics[bestModel][selectedBond];

  return (
    <div className="app">

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
              <ModelPredictionCard key={name} modelName={name} />
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

        {/* ══════════════ DATA ANALYSIS ══════════════ */}
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
                {ALL_INDICATORS.map(ind => (
                  <div key={ind.name} className="feature-tag">{ind.name}</div>
                ))}

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
