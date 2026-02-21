// src/api/bondAPI.js

// Vite uses import.meta.env
const API_BASE_URL = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000/api';

export const bondAPI = {
    // Primary Endpoint: Trains the model and gets BOTH metrics and chart data in one call
    compute: async (bondType, modelName) => {
        // Map frontend display names to exact backend model identifiers
        const modelMap = {
            'Linear Regression': 'linear_regression',
            'ARIMA': 'arima',
            'DLSTM': 'lstm',   // backend expects 'lstm' for Deep LSTM
            'XGBoost': 'xgboost',
        };
        const mappedModel = modelMap[modelName] || 'xgboost';

        // Map frontend bond selector to backend bond_type param
        const mappedBond = bondType === '3-year' ? '3yr' : '10yr';

        const response = await fetch(`${API_BASE_URL}/compute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: mappedModel,
                bond_type: mappedBond,
            })
        });

        if (!response.ok) {
            // Try to extract backend error message for better UX
            let msg = response.statusText;
            try {
                const errBody = await response.json();
                if (errBody && errBody.error) msg = errBody.error;
            } catch (_) { /* ignore parse errors */ }
            throw new Error(`${response.status}: ${msg}`);
        }

        return response.json();
    }
};
