# G-Sec Bond Market Prediction System

A machine learning-powered dashboard for predicting Indian Government Securities (G-Sec) bond yields using 50+ macroeconomic indicators.

## Overview

This project implements multiple ML models to forecast 3-year and 10-year G-Sec bond prices by analyzing macroeconomic data including GDP, inflation rates, interest rates, and exchange rates. The interactive React dashboard visualizes predictions and model performance metrics.

## Features

- **Bond Price Predictions** - Compare actual vs predicted prices for 3-year and 10-year bonds
- **Multi-Model Comparison** - Evaluate Linear Regression, ARIMA, DLSTM, and XGBoost models
- **Performance Metrics** - View MAPE, MAE, MSE, and R² scores for each model
- **Data Analysis** - Explore 50+ macroeconomic indicators used in predictions
- **Interactive Visualizations** - Charts and graphs powered by Recharts

## Tech Stack

**Frontend:**
- React 19
- Vite
- Recharts
- Lucide React Icons

**Machine Learning Models:**
- Linear Regression
- ARIMA (AutoRegressive Integrated Moving Average)
- DLSTM (Deep Long Short-Term Memory)
- XGBoost (Best performing - 99.38% R² score)

## Project Structure

```
Final_Year_Project/
├── my-react-app/              # React frontend
│   ├── src/
│   │   ├── App.jsx            # Main dashboard component
│   │   ├── App.css            # Styles
│   │   └── main.jsx           # Entry point
│   ├── package.json
│   └── vite.config.js
├── p_merged_data_3.csv        # 3-year bond dataset (2,943 records)
├── p_merged_data_10.csv       # 10-year bond dataset (2,945 records)
├── train_data.csv             # Training data (80%)
├── test_data.csv              # Testing data (20%)
├── 50 Macroeconomic Indicators.csv
├── vs.ipynb                   # ML model training notebook
├── render.yaml                # Deployment config
└── Research Paper IEEE.pdf    # Academic paper
```

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Final_Year_Project.git

# Navigate to the React app
cd Final_Year_Project/my-react-app

# Install dependencies
npm install

# Start development server
npm run dev
```

## Usage

After starting the development server, open your browser to the local URL (typically `http://localhost:5173`).

The dashboard has four main tabs:

| Tab | Description |
|-----|-------------|
| **Overview** | Bond market statistics and macroeconomic indicators |
| **Predictions** | Actual vs predicted price charts with model selection |
| **Models** | R² score comparison and detailed performance metrics |
| **Data Analysis** | Dataset information and feature list |

## Model Performance

| Model | 3-Year Bond R² | 10-Year Bond R² |
|-------|----------------|-----------------|
| XGBoost | 98.90% | 99.38% |
| DLSTM | 96.78% | 97.52% |
| Linear Regression | 94.56% | 95.23% |
| ARIMA | 92.34% | 93.67% |

## Build for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

## Deployment

The project is configured for deployment on Render as a static site. The `render.yaml` file contains the deployment configuration.

## Data Sources

The model uses 50+ macroeconomic indicators including:
- GDP Growth Rate
- Consumer Price Index (CPI)
- Wholesale Price Index (WPI)
- Repo Rate & Reverse Repo Rate
- Foreign Exchange Reserves
- Trade Balance
- Industrial Production Index
- And more...

## License

This project is part of a Final Year academic project.

## Authors

Thaneesh Shankarsai
