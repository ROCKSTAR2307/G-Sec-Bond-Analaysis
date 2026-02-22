// src/api/bondAPI.js
const API_BASE_URL =
    (import.meta && import.meta.env && import.meta.env.VITE_API_URL) ||
    'http://localhost:8000/api';

// Model name → backend identifier
const MODEL_MAP = {
    'Linear Regression': 'linear_regression',
    'ARIMA': 'arima',
    'DLSTM': 'lstm',
    'XGBoost': 'xgboost',
};

// Bond selector → backend bond_type
const BOND_MAP = {
    '3-year': '3yr',
    '10-year': '10yr',
};

// Minimum loading animation duration per model (ms)
// Models are cached after first call — these are just the UX spinners.
const MIN_LOADING_MS = {
    lstm: 10_000,   // DLSTM: 10 s
    _default: 3000, // everything else: 3 s
};

async function handleResponse(res) {
    if (!res.ok) {
        let msg = res.statusText;
        try {
            const body = await res.json();
            if (body && body.error) msg = body.error;
        } catch (_) { }
        throw new Error(`${res.status}: ${msg}`);
    }
    return res.json();
}

export const bondAPI = {
    /**
     * Train (cached) + return full test-set chart data & metrics.
     */
    compute: async (bondType, modelName) => {
        const mapped = MODEL_MAP[modelName] || 'xgboost';
        const mappedBond = BOND_MAP[bondType] || '3yr';
        const minMs = MIN_LOADING_MS[mapped] ?? MIN_LOADING_MS._default;

        const startTime = Date.now();
        const res = await fetch(`${API_BASE_URL}/compute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: mapped, bond_type: mappedBond }),
        });
        const data = await handleResponse(res);

        // Enforce minimum spinner duration in frontend (models trained once on backend)
        const elapsed = Date.now() - startTime;
        if (elapsed < minMs) {
            await new Promise(r => setTimeout(r, minMs - elapsed));
        }
        return data;
    },

    /**
     * Returns the valid date range (test split) for a bond type.
     * GET /api/dates/3yr
     */
    getDateRange: async (bondType) => {
        const mappedBond = BOND_MAP[bondType] || '3yr';
        const res = await fetch(`${API_BASE_URL}/dates/${mappedBond}`);
        return handleResponse(res);
    },

    /**
     * Returns feature values & actual yield for a specific date.
     * GET /api/features?date=YYYY-MM-DD&bond_type=3yr
     */
    getFeatures: async (date, bondType) => {
        const mappedBond = BOND_MAP[bondType] || '3yr';
        const res = await fetch(
            `${API_BASE_URL}/features?date=${date}&bond_type=${mappedBond}`
        );
        return handleResponse(res);
    },

    /**
     * Predict yield for a single date using the cached trained model.
     * POST /api/predict-single { date, bond_type, model }
     */
    predictSingle: async (date, bondType, modelName) => {
        const mapped = MODEL_MAP[modelName] || 'xgboost';
        const mappedBond = BOND_MAP[bondType] || '3yr';
        const res = await fetch(`${API_BASE_URL}/predict-single`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, bond_type: mappedBond, model: mapped }),
        });
        return handleResponse(res);
    },
};
