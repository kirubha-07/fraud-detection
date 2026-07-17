"""Fraud Operations Dashboard — professional fintech analytics console.

Redesign goals:
- Deep navy / charcoal colour palette with semantic risk scale (green → amber → red).
- KPI metric cards with icons in a top row on every tab.
- Cleaned-up sidebar with grouped expandable sections.
- Rich Plotly charts throughout (no plain st.bar_chart / st.dataframe fallbacks).
- Risk-badge pill table in Live Scoring.
- Multi-model ROC + PR overlay, cost curve, annotated confusion matrix heatmap,
  SHAP waterfall for local explanation.
- Custom CSS injected via st.markdown(unsafe_allow_html=True).
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st

# ── project root on path ────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data_loader import load_data, save_processed
from src.evaluate import compute_metrics_at_threshold, find_cost_optimal_threshold
from src.explainability import compute_shap_values, explain_instance
from src.feature_engineering import engineer_features, get_feature_columns
from src.preprocessing import split_data
from src.utils import load_config

logger = logging.getLogger(__name__)

# ── page config (must be first Streamlit call) ───────────────────────────────
st.set_page_config(
    page_title="FraudOps Console",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ═══════════════════════════════════════════════════════════════════════════════
#  DESIGN SYSTEM — injected CSS
#  Palette: navy (#0D1B2A), charcoal (#1B2A3B), teal accent (#00C9A7),
#  card bg (#1E2F45), off-white text (#E8EDF4).
#  Risk scale: green (#22C55E) → amber (#F59E0B) → red (#EF4444).
# ═══════════════════════════════════════════════════════════════════════════════
CUSTOM_CSS = """
<style>
/* ── Google Font ─────────────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* ── Global ─────────────────────────────────────────────────────────────── */
html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Main background */
.stApp {
    background: linear-gradient(135deg, #0D1B2A 0%, #1A2744 100%);
    color: #E8EDF4;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
[data-testid="stSidebar"] {
    background: #0D1B2A !important;
    border-right: 1px solid #1E3A5F;
}
[data-testid="stSidebar"] * {
    color: #C5D0DE !important;
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
[data-testid="stTabs"] [data-baseweb="tab-list"] {
    background: #0D1B2A;
    border-radius: 8px;
    padding: 4px;
    gap: 4px;
    border-bottom: 2px solid #1E3A5F;
}
[data-testid="stTabs"] [data-baseweb="tab"] {
    background: transparent;
    border-radius: 6px;
    color: #7A91A8 !important;
    font-weight: 500;
    font-size: 0.9rem;
    padding: 8px 20px;
    transition: all 0.2s ease;
}
[data-testid="stTabs"] [aria-selected="true"] {
    background: #00C9A7 !important;
    color: #0D1B2A !important;
    font-weight: 600;
}

/* ── KPI Metric Cards ────────────────────────────────────────────────────── */
.kpi-card {
    background: linear-gradient(145deg, #1E3A5F 0%, #162A45 100%);
    border: 1px solid #2A4A6B;
    border-radius: 12px;
    padding: 20px 24px;
    margin: 4px 0;
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,201,167,0.15);
}
.kpi-icon {
    font-size: 1.8rem;
    margin-bottom: 8px;
    display: block;
}
.kpi-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: #7A91A8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
}
.kpi-value {
    font-size: 2rem;
    font-weight: 700;
    color: #E8EDF4;
    line-height: 1;
}
.kpi-delta {
    font-size: 0.78rem;
    margin-top: 6px;
    font-weight: 500;
}
.kpi-delta.positive { color: #22C55E; }
.kpi-delta.negative { color: #EF4444; }
.kpi-delta.neutral  { color: #F59E0B; }

/* ── Risk Badges ─────────────────────────────────────────────────────────── */
.risk-critical { background:#EF4444; color:#fff; padding:2px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; }
.risk-high     { background:#F97316; color:#fff; padding:2px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; }
.risk-moderate { background:#F59E0B; color:#0D1B2A; padding:2px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; }
.risk-low      { background:#22C55E; color:#0D1B2A; padding:2px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; }

/* ── Section Headers ─────────────────────────────────────────────────────── */
.section-header {
    font-size: 1rem;
    font-weight: 600;
    color: #00C9A7;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 12px 0 8px;
    border-bottom: 1px solid #1E3A5F;
    margin-bottom: 16px;
}

/* ── Dataframe overrides ─────────────────────────────────────────────────── */
[data-testid="stDataFrame"] {
    border-radius: 8px;
    overflow: hidden;
}

/* ── Plotly chart containers ─────────────────────────────────────────────── */
[data-testid="stPlotlyChart"] {
    border-radius: 12px;
    overflow: hidden;
    background: #162A45;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
}

/* ── Expanders ───────────────────────────────────────────────────────────── */
[data-testid="stExpander"] {
    background: #0D1B2A !important;
    border: 1px solid #1E3A5F !important;
    border-radius: 8px !important;
}

/* ── Sidebar logo block ──────────────────────────────────────────────────── */
.sidebar-logo {
    background: linear-gradient(135deg, #00C9A7, #0096FF);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
}
.sidebar-subtitle {
    color: #7A91A8;
    font-size: 0.75rem;
    margin-top: -4px;
    margin-bottom: 16px;
}
</style>
"""

# Plotly layout kwargs applied to every chart via _apply_template().
# Stored as a plain dict to avoid go.Layout validation at module-load time.
PLOTLY_LAYOUT_DEFAULTS = dict(
    paper_bgcolor="#162A45",
    plot_bgcolor="#0D1B2A",
    font=dict(family="Inter, sans-serif", color="#C5D0DE", size=12),
    title_font=dict(size=14, color="#E8EDF4", family="Inter, sans-serif"),
    colorway=["#00C9A7", "#0096FF", "#F59E0B", "#EF4444", "#A78BFA", "#34D399"],
    xaxis=dict(gridcolor="#1E3A5F", linecolor="#2A4A6B", tickcolor="#7A91A8"),
    yaxis=dict(gridcolor="#1E3A5F", linecolor="#2A4A6B", tickcolor="#7A91A8"),
    legend=dict(bgcolor="#0D1B2A", bordercolor="#2A4A6B", borderwidth=1),
    margin=dict(l=48, r=24, t=48, b=48),
)

# ── Palettes & constants ──────────────────────────────────────────────────────
ACCENT = "#00C9A7"
RISK_COLORS = {
    "low":      "#22C55E",
    "moderate": "#F59E0B",
    "high":     "#F97316",
    "critical": "#EF4444",
}
MODEL_COLORS = {
    "xgboost":           "#00C9A7",
    "random_forest":     "#0096FF",
    "logistic_regression": "#F59E0B",
    "isolation_forest":  "#A78BFA",
}

# ── Config ────────────────────────────────────────────────────────────────────
config = load_config()
eval_cfg = config["evaluation"]
cost_fp_default = float(eval_cfg["cost_false_positive"])
cost_fn_default = float(eval_cfg["cost_false_negative"])


# ════════════════════════════════════════════════════════════════════════════════
#  DATA & MODEL LOADERS  (unchanged logic, reformatted for clarity)
# ════════════════════════════════════════════════════════════════════════════════

@st.cache_data(show_spinner="⏳  Loading engineered transactions…")
def load_featured_data() -> pd.DataFrame:
    """Load cached engineered data or build it once from raw PaySim."""
    processed_dir = PROJECT_ROOT / config["paths"]["processed_dir"]
    processed_path = processed_dir / "featured_transactions.parquet"
    if processed_path.exists():
        return pd.read_parquet(processed_path)
    raw_df = load_data(config)
    featured = engineer_features(raw_df, config)
    save_processed(featured, processed_path.name, config)
    return featured


@st.cache_resource(show_spinner="⏳  Loading model artifact…")
def load_model(model_name: str) -> dict:
    """Load a trained model bundle; falls back to bare model format."""
    model_path = PROJECT_ROOT / config["paths"]["models_dir"] / f"{model_name}.joblib"
    if model_path.exists():
        artifact = joblib.load(model_path)
        if isinstance(artifact, dict) and "model" in artifact:
            return artifact
        # Backward compat: bare model file
        featured = load_featured_data()
        split = split_data(featured, config)
        return {
            "model": artifact,
            "scaler": split.scaler,
            "feature_names": split.feature_names,
            "threshold": config["dashboard"].get("default_threshold", 0.5),
        }
    if model_name == "xgboost":
        from src.models.tree_ensemble import train_xgboost
        featured = load_featured_data()
        split = split_data(featured, config)
        model = train_xgboost(split, config, optuna_trials=1)
        return {
            "model": model,
            "scaler": split.scaler,
            "feature_names": split.feature_names,
            "threshold": config["dashboard"].get("default_threshold", 0.5),
        }
    raise FileNotFoundError(f"No saved model for {model_name!r}")


@st.cache_data(show_spinner="⏳  Loading saved metrics…")
def load_saved_metrics(model_name: str) -> dict[str, Any] | None:
    """Load the JSON metrics artifact for a trained model if present."""
    metrics_path = (
        PROJECT_ROOT / config["paths"]["metrics_dir"] / f"{model_name}_metrics.json"
    )
    if not metrics_path.exists():
        return None
    return pd.read_json(metrics_path, typ="series").to_dict()


@st.cache_data(show_spinner="⏳  Loading all model metrics…")
def load_all_metrics() -> dict[str, dict]:
    """Load metric JSON files for every available model."""
    metrics_dir = PROJECT_ROOT / config["paths"]["metrics_dir"]
    all_metrics: dict[str, dict] = {}
    for p in sorted(metrics_dir.glob("*_metrics.json")):
        name = p.stem.replace("_metrics", "")
        try:
            with p.open() as f:
                all_metrics[name] = json.load(f)
        except Exception:
            pass
    return all_metrics


# ════════════════════════════════════════════════════════════════════════════════
#  SCORING UTILITIES  (unchanged logic)
# ════════════════════════════════════════════════════════════════════════════════

def _build_scored_frame(
    model_bundle: dict[str, Any],
    featured_df: pd.DataFrame,
    threshold: float,
) -> pd.DataFrame:
    """Score a feature-engineered frame and attach fraud probabilities."""
    model = model_bundle["model"]
    scaler = model_bundle["scaler"]
    feature_cols = model_bundle["feature_names"]
    X = featured_df[feature_cols].values.astype(np.float64)
    if scaler is not None:
        X = scaler.transform(X)
    scores = model.predict_proba(X)[:, 1]
    scored = featured_df.copy().reset_index(drop=True)
    scored["fraud_probability"] = scores
    scored["flagged"] = scored["fraud_probability"] >= threshold
    scored["risk_band"] = pd.cut(
        scored["fraud_probability"],
        bins=[-0.001, 0.25, 0.50, 0.75, 1.0],
        labels=["low", "moderate", "high", "critical"],
    )
    return scored.sort_values("fraud_probability", ascending=False).reset_index(drop=True)


def _test_slice(featured: pd.DataFrame, split) -> pd.DataFrame:
    """Recover the time-ordered test slice from the engineered frame."""
    ordered = featured.sort_values(
        config["preprocessing"].get("step_col", "step")
    ).reset_index(drop=True)
    return ordered.iloc[-len(split.y_test) :].reset_index(drop=True)


def _local_shap_table(
    model_bundle: dict[str, Any], row: pd.DataFrame, feature_cols: list[str]
) -> pd.DataFrame:
    """Build a local SHAP explanation for one scored transaction."""
    import shap

    model = model_bundle["model"]
    scaler = model_bundle["scaler"]
    row_values = row[feature_cols].values
    if scaler is not None:
        row_values = scaler.transform(row_values)
    explainer = shap.TreeExplainer(model)
    values = explainer.shap_values(row_values)
    if isinstance(values, list):
        values = values[1]
    local = explain_instance(values, feature_cols, 0, row_values)
    max_feat = int(config.get("explainability", {}).get("max_display_features", 15))
    return local.head(max_feat)


# ════════════════════════════════════════════════════════════════════════════════
#  CHART BUILDERS — all use the custom Plotly template
# ════════════════════════════════════════════════════════════════════════════════

def _apply_template(fig: go.Figure, title: str = "", height: int = 340) -> go.Figure:
    """Apply the shared fintech Plotly theme to any figure."""
    fig.update_layout(
        **PLOTLY_LAYOUT_DEFAULTS,
        title=title,
        height=height,
    )
    return fig


def _chart_probability_histogram(scores: np.ndarray, threshold: float) -> go.Figure:
    """Fraud probability distribution with threshold marker.
    
    Visual section: Live Scoring — gives analysts a quick sense of
    how scores are distributed across the batch.
    """
    fig = go.Figure()
    fig.add_trace(
        go.Histogram(
            x=scores,
            nbinsx=40,
            name="Score distribution",
            marker_color=ACCENT,
            opacity=0.85,
        )
    )
    fig.add_vline(
        x=threshold,
        line_width=2,
        line_dash="dash",
        line_color="#EF4444",
        annotation_text=f"Threshold {threshold:.2f}",
        annotation_font_color="#EF4444",
        annotation_position="top right",
    )
    return _apply_template(fig, "Fraud Probability Distribution", 300)


def _chart_fraud_rate_over_time(scored_df: pd.DataFrame) -> go.Figure:
    """Fraud rate per PaySim step (time proxy).
    
    Visual section: Live Scoring — surfaces temporal fraud bursts,
    which are an artefact of PaySim's synthetic injection pattern.
    """
    if "step" not in scored_df.columns:
        return None
    step_grp = (
        scored_df.groupby("step")["flagged"]
        .agg(total="count", fraud="sum")
        .assign(fraud_rate=lambda d: d["fraud"] / d["total"])
        .reset_index()
    )
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=step_grp["step"],
            y=step_grp["fraud_rate"],
            mode="lines",
            name="Fraud rate",
            line=dict(color="#EF4444", width=2),
            fill="tozeroy",
            fillcolor="rgba(239,68,68,0.12)",
            hovertemplate="Step %{x}<br>Fraud rate: %{y:.2%}<extra></extra>",
        )
    )
    return _apply_template(fig, "Fraud Rate Over Time (PaySim Steps)", 280)


def _chart_type_donut(scored_df: pd.DataFrame) -> go.Figure:
    """Transaction type breakdown split by fraud vs legitimate.
    
    Visual section: Live Scoring — helps analysts understand which
    transaction types carry the most fraud risk.
    """
    if "type" not in scored_df.columns:
        return None
    type_fraud = (
        scored_df.groupby(["type", "flagged"])
        .size()
        .reset_index(name="count")
    )
    type_fraud["label"] = type_fraud["type"] + " (" + type_fraud["flagged"].map({True: "Fraud", False: "Legit"}) + ")"
    fig = go.Figure(
        go.Pie(
            labels=type_fraud["label"],
            values=type_fraud["count"],
            hole=0.55,
            marker=dict(
                colors=[
                    "#EF4444" if "Fraud" in l else ACCENT
                    for l in type_fraud["label"]
                ]
            ),
            textinfo="label+percent",
            hovertemplate="%{label}<br>Count: %{value:,}<extra></extra>",
        )
    )
    return _apply_template(fig, "Transaction Type Breakdown", 340)


def _chart_amount_distribution(scored_df: pd.DataFrame) -> go.Figure:
    """Log-scale amount distribution: fraud vs legitimate overlay.
    
    Visual section: Live Scoring — higher amounts correlate strongly
    with fraud in PaySim, so this overlay makes that pattern obvious.
    """
    if "amount" not in scored_df.columns:
        return None
    legit = scored_df[~scored_df["flagged"]]["amount"].clip(lower=1)
    fraud = scored_df[scored_df["flagged"]]["amount"].clip(lower=1)
    fig = go.Figure()
    fig.add_trace(
        go.Histogram(
            x=np.log10(legit),
            name="Legitimate",
            marker_color=ACCENT,
            opacity=0.65,
            nbinsx=40,
            hovertemplate="log₁₀(amount)=%{x:.2f}<br>Count=%{y}<extra></extra>",
        )
    )
    fig.add_trace(
        go.Histogram(
            x=np.log10(fraud),
            name="Fraud",
            marker_color="#EF4444",
            opacity=0.8,
            nbinsx=40,
            hovertemplate="log₁₀(amount)=%{x:.2f}<br>Count=%{y}<extra></extra>",
        )
    )
    fig.update_layout(barmode="overlay")
    fig = _apply_template(fig, "Amount Distribution — log₁₀ scale (Fraud vs Legit)", 300)
    fig.update_xaxes(title_text="log₁₀(Amount)")
    fig.update_yaxes(title_text="Count")
    return fig


def _chart_confusion_matrix(confusion: list[list[int]]) -> go.Figure:
    """Annotated heatmap confusion matrix.
    
    Visual section: Model Performance — clearer than a plain table;
    colour intensity guides the eye to TP/TN cells.
    """
    labels = ["Legit", "Fraud"]
    z = confusion
    text = [[f"{v:,}" for v in row] for row in z]
    fig = go.Figure(
        go.Heatmap(
            z=z,
            x=[f"Pred: {l}" for l in labels],
            y=[f"Actual: {l}" for l in labels],
            colorscale=[[0, "#0D1B2A"], [0.5, "#00688B"], [1, ACCENT]],
            showscale=False,
            text=text,
            texttemplate="<b>%{text}</b>",
            textfont=dict(size=18, color="#E8EDF4"),
            hovertemplate="Actual: %{y}<br>Pred: %{x}<br>Count: %{text}<extra></extra>",
        )
    )
    return _apply_template(fig, "Confusion Matrix", 300)


def _chart_multi_model_curves(
    split, all_models: dict[str, dict]
) -> tuple[go.Figure, go.Figure]:
    """ROC + PR curves overlaid for all trained models.
    
    Visual section: Model Performance — lets viewers compare all four
    models on one chart rather than switching tabs.
    """
    from sklearn.metrics import precision_recall_curve, roc_curve, auc

    roc_fig = go.Figure()
    pr_fig = go.Figure()

    # Random baseline for ROC
    roc_fig.add_trace(
        go.Scatter(
            x=[0, 1], y=[0, 1],
            mode="lines",
            line=dict(color="#4A5568", dash="dash"),
            name="Random baseline",
            showlegend=True,
        )
    )

    for model_name, bundle in all_models.items():
        color = MODEL_COLORS.get(model_name, "#94A3B8")
        try:
            m = bundle["model"]
            X = split.X_test
            y = split.y_test
            prob = m.predict_proba(X)[:, 1]

            # ROC
            fpr, tpr, _ = roc_curve(y, prob)
            roc_auc = auc(fpr, tpr)
            roc_fig.add_trace(
                go.Scatter(
                    x=fpr, y=tpr,
                    mode="lines",
                    name=f"{model_name} (AUC={roc_auc:.3f})",
                    line=dict(color=color, width=2),
                    hovertemplate="FPR=%{x:.3f}<br>TPR=%{y:.3f}<extra></extra>",
                )
            )

            # PR
            prec, rec, _ = precision_recall_curve(y, prob)
            pr_auc = auc(rec, prec)
            pr_fig.add_trace(
                go.Scatter(
                    x=rec, y=prec,
                    mode="lines",
                    name=f"{model_name} (AUC={pr_auc:.3f})",
                    line=dict(color=color, width=2),
                    hovertemplate="Recall=%{x:.3f}<br>Precision=%{y:.3f}<extra></extra>",
                )
            )
        except Exception:
            pass

    roc_fig = _apply_template(roc_fig, "ROC Curves — All Models", 360)
    roc_fig.update_xaxes(title_text="False Positive Rate", range=[0, 1])
    roc_fig.update_yaxes(title_text="True Positive Rate", range=[0, 1])

    pr_fig = _apply_template(pr_fig, "Precision-Recall Curves — All Models", 360)
    pr_fig.update_xaxes(title_text="Recall", range=[0, 1])
    pr_fig.update_yaxes(title_text="Precision", range=[0, 1])

    return roc_fig, pr_fig


def _chart_cost_curve(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    cost_fp: float,
    cost_fn: float,
    selected_threshold: float,
) -> go.Figure:
    """Total expected cost vs. threshold with optimal point annotated.
    
    Visual section: Model Performance — helps stakeholders see where
    the business cost-optimal threshold sits vs the one they selected.
    """
    thresholds = np.linspace(0.01, 0.99, 200)
    costs = []
    for t in thresholds:
        y_pred = (y_prob >= t).astype(int)
        fp = int(((y_pred == 1) & (y_true == 0)).sum())
        fn = int(((y_pred == 0) & (y_true == 1)).sum())
        costs.append(fp * cost_fp + fn * cost_fn)
    costs = np.array(costs)
    opt_idx = int(np.argmin(costs))

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=thresholds,
            y=costs,
            mode="lines",
            name="Total cost",
            line=dict(color=ACCENT, width=2),
            fill="tozeroy",
            fillcolor="rgba(0,201,167,0.08)",
            hovertemplate="Threshold=%{x:.3f}<br>Cost=$%{y:,.0f}<extra></extra>",
        )
    )
    # Optimal threshold annotation
    fig.add_vline(
        x=thresholds[opt_idx],
        line_dash="dot",
        line_color="#22C55E",
        annotation_text=f"Optimal {thresholds[opt_idx]:.3f}",
        annotation_font_color="#22C55E",
        annotation_position="top left",
    )
    # Selected threshold annotation
    fig.add_vline(
        x=selected_threshold,
        line_dash="dash",
        line_color="#F59E0B",
        annotation_text=f"Selected {selected_threshold:.3f}",
        annotation_font_color="#F59E0B",
        annotation_position="top right",
    )
    fig = _apply_template(fig, "Cost Curve vs Decision Threshold", 320)
    fig.update_xaxes(title_text="Threshold")
    fig.update_yaxes(title_text="Total cost ($)")
    return fig


def _chart_shap_global(summary_df: pd.DataFrame) -> go.Figure:
    """Styled horizontal bar chart for global SHAP importance.
    
    Visual section: Explainability — colour-encodes impact magnitude
    so high-impact features jump out immediately.
    """
    top = summary_df.head(15).sort_values("mean_abs_shap")
    # Colour gradient from teal (low) to red (high)
    max_val = top["mean_abs_shap"].max()
    colors = [
        f"rgba({int(239*(v/max_val))},{int(68 + 133*(1-v/max_val))},{int(68*(1-v/max_val))},0.85)"
        for v in top["mean_abs_shap"]
    ]
    fig = go.Figure(
        go.Bar(
            x=top["mean_abs_shap"],
            y=top["feature"],
            orientation="h",
            marker_color=colors,
            text=[f"{v:.4f}" for v in top["mean_abs_shap"]],
            textposition="outside",
            hovertemplate="%{y}<br>mean|SHAP|=%{x:.4f}<extra></extra>",
        )
    )
    return _apply_template(fig, "Global Feature Importance (mean |SHAP|)", 420)


def _chart_shap_waterfall(local_table: pd.DataFrame, base_value: float = 0.5) -> go.Figure:
    """Waterfall-style Plotly chart for local SHAP explanation.
    
    Visual section: Explainability — shows which features pushed the
    selected transaction's score above or below the base rate.
    """
    top = local_table.head(12)
    features = top["feature"].tolist()
    shap_vals = top["shap_value"].tolist()
    colors = ["#22C55E" if v < 0 else "#EF4444" for v in shap_vals]

    # Build a waterfall: start from base_value, then each feature contribution
    fig = go.Figure(
        go.Waterfall(
            name="SHAP",
            orientation="h",
            measure=["relative"] * len(features),
            y=features,
            x=shap_vals,
            connector=dict(line=dict(color="#4A5568", width=1)),
            increasing=dict(marker_color="#EF4444"),
            decreasing=dict(marker_color="#22C55E"),
            hovertemplate="%{y}<br>SHAP: %{x:.4f}<extra></extra>",
        )
    )
    return _apply_template(fig, "Local SHAP Explanation — Waterfall", 400)


def _chart_model_comparison(all_saved_metrics: dict[str, dict]) -> go.Figure | None:
    """Styled model comparison heatmap with conditional colour-scaling.
    
    Visual section: Model Performance — encodes metric magnitudes as
    colour intensity so the best model stands out at a glance.
    """
    metric_keys = ["pr_auc", "roc_auc", "precision", "recall", "f1"]
    rows = []
    for name, m in all_saved_metrics.items():
        row = {k: m.get(k, 0.0) for k in metric_keys}
        row["model"] = name
        rows.append(row)
    if not rows:
        return None
    df = pd.DataFrame(rows).set_index("model")[metric_keys]
    z = df.values
    fig = go.Figure(
        go.Heatmap(
            z=z,
            x=[k.upper().replace("_", "-") for k in metric_keys],
            y=df.index.tolist(),
            colorscale=[[0, "#1E3A5F"], [0.5, "#00688B"], [1, ACCENT]],
            zmin=0, zmax=1,
            text=[[f"{v:.4f}" for v in row] for row in z],
            texttemplate="%{text}",
            textfont=dict(size=13, color="#E8EDF4"),
            hovertemplate="%{y}<br>%{x}=%{text}<extra></extra>",
            showscale=True,
        )
    )
    return _apply_template(fig, "Model Comparison (colour = metric value)", 280)


# ════════════════════════════════════════════════════════════════════════════════
#  KPI CARD HELPERS
# ════════════════════════════════════════════════════════════════════════════════

def _kpi_card(icon: str, label: str, value: str, delta: str = "", delta_type: str = "neutral") -> str:
    """Render an HTML KPI card with icon, value, and optional delta."""
    delta_html = (
        f'<div class="kpi-delta {delta_type}">{delta}</div>' if delta else ""
    )
    return f"""
    <div class="kpi-card">
      <span class="kpi-icon">{icon}</span>
      <div class="kpi-label">{label}</div>
      <div class="kpi-value">{value}</div>
      {delta_html}
    </div>
    """


def _risk_badge(band: str) -> str:
    """Return an HTML risk pill for a given risk band."""
    return f'<span class="risk-{band}">{band.upper()}</span>'


# ════════════════════════════════════════════════════════════════════════════════
#  MAIN APP
# ════════════════════════════════════════════════════════════════════════════════

def main() -> None:
    """Run the FraudOps analytics console."""

    # ── Inject custom CSS ──────────────────────────────────────────────────────
    st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

    # ── Sidebar — logo + grouped controls ─────────────────────────────────────
    with st.sidebar:
        st.markdown(
            '<div class="sidebar-logo">🛡️ FraudOps</div>'
            '<div class="sidebar-subtitle">Transaction Risk Console · PaySim</div>',
            unsafe_allow_html=True,
        )
        st.divider()

        # ── Model selector ─────────────────────────────────────────────────────
        with st.expander("🤖  Model", expanded=True):
            models_dir = PROJECT_ROOT / config["paths"]["models_dir"]
            available_models = sorted(p.stem for p in models_dir.glob("*.joblib"))
            if not available_models:
                st.error("No trained model artifacts found.")
                st.stop()
            default_model = "xgboost" if "xgboost" in available_models else available_models[0]
            model_name = st.selectbox(
                "Active model",
                available_models,
                index=available_models.index(default_model),
                label_visibility="collapsed",
            )

        # ── Decision threshold ─────────────────────────────────────────────────
        saved_metrics = load_saved_metrics(model_name) or {}
        threshold_default = float(
            saved_metrics.get("threshold", config["dashboard"].get("default_threshold", 0.5))
        )
        with st.expander("⚙️  Decision Threshold", expanded=True):
            threshold = st.slider(
                "Threshold",
                0.01, 0.99,
                float(threshold_default),
                0.01,
                label_visibility="collapsed",
                help="Score ≥ threshold → flagged as fraud",
            )
            st.caption(f"Current: **{threshold:.3f}**  |  Default: {threshold_default:.3f}")

        # ── Cost parameters ────────────────────────────────────────────────────
        with st.expander("💰  Cost Parameters"):
            cost_fp = st.number_input(
                "False-positive cost ($/txn)", min_value=0.0,
                value=cost_fp_default, step=10.0,
            )
            cost_fn = st.number_input(
                "False-negative cost ($/missed fraud)", min_value=0.0,
                value=cost_fn_default, step=10.0,
            )

        # ── Display & upload ───────────────────────────────────────────────────
        with st.expander("🔍  Display & Data"):
            max_display_rows = st.slider("Rows to display", 25, 200, 100, 25)
            uploaded_file = st.file_uploader("Score a CSV file", type=["csv"])

        # ── Advanced ───────────────────────────────────────────────────────────
        with st.expander("🧪  Advanced"):
            shap_sample_size = st.slider("SHAP background sample", 50, 500, 200, 50)

    # ── Load data & score ──────────────────────────────────────────────────────
    with st.spinner("Loading data…"):
        featured = load_featured_data()
        split = split_data(featured, config)

    model_bundle = load_model(model_name)
    model = model_bundle["model"]
    scaler = model_bundle["scaler"]
    feature_cols = model_bundle["feature_names"]

    test_frame = _test_slice(featured, split)
    test_scored = _build_scored_frame(model_bundle, test_frame, threshold)

    y_test_prob = model.predict_proba(split.X_test)[:, 1]
    y_test_pred = (y_test_prob >= threshold).astype(int)
    current_metrics = compute_metrics_at_threshold(split.y_test, y_test_prob, threshold)

    test_fp = int(((y_test_pred == 1) & (split.y_test == 0)).sum())
    test_fn = int(((y_test_pred == 0) & (split.y_test == 1)).sum())
    current_cost = test_fp * cost_fp + test_fn * cost_fn
    baseline_cost = int(split.y_test.sum()) * cost_fn
    cost_saved = baseline_cost - current_cost

    # ── Page heading ───────────────────────────────────────────────────────────
    st.markdown(
        "<h1 style='font-size:1.6rem;font-weight:700;color:#E8EDF4;margin-bottom:4px;'>"
        "🛡️ Fraud Operations Console"
        "</h1>"
        "<p style='color:#7A91A8;font-size:0.85rem;margin-bottom:16px;'>"
        f"Model: <b style='color:{ACCENT}'>{model_name}</b> &nbsp;·&nbsp; "
        f"Threshold: <b style='color:#F59E0B'>{threshold:.3f}</b> &nbsp;·&nbsp; "
        "Dataset: PaySim synthetic transactions"
        "</p>",
        unsafe_allow_html=True,
    )

    # ════════════════════════════════════════════════════════════════════════════
    #  GLOBAL KPI ROW — shown at top of every tab view
    # ════════════════════════════════════════════════════════════════════════════
    # Five key metrics as styled cards with icons and delta indicators.
    total_txns = len(test_scored)
    fraud_caught = int(test_scored["flagged"].sum())
    fraud_rate_pct = fraud_caught / total_txns * 100 if total_txns else 0

    k1, k2, k3, k4, k5 = st.columns(5)
    with k1:
        st.markdown(
            _kpi_card("📊", "Transactions Scored", f"{total_txns:,}"),
            unsafe_allow_html=True,
        )
    with k2:
        st.markdown(
            _kpi_card("🚨", "Fraud Flagged", f"{fraud_caught:,}",
                      delta=f"threshold {threshold:.2f}", delta_type="neutral"),
            unsafe_allow_html=True,
        )
    with k3:
        st.markdown(
            _kpi_card("📈", "Fraud Rate", f"{fraud_rate_pct:.2f}%",
                      delta="of scored batch", delta_type="negative" if fraud_rate_pct > 2 else "positive"),
            unsafe_allow_html=True,
        )
    with k4:
        st.markdown(
            _kpi_card("🎯", "PR-AUC", f"{current_metrics['pr_auc']:.4f}",
                      delta="primary model metric", delta_type="positive"),
            unsafe_allow_html=True,
        )
    with k5:
        delta_type = "positive" if cost_saved >= 0 else "negative"
        st.markdown(
            _kpi_card("💵", "Est. Cost Saved", f"${cost_saved:,.0f}",
                      delta="vs flag-nothing baseline", delta_type=delta_type),
            unsafe_allow_html=True,
        )

    st.divider()

    # ════════════════════════════════════════════════════════════════════════════
    #  TABS
    # ════════════════════════════════════════════════════════════════════════════
    tab_live, tab_perf, tab_explain = st.tabs(
        ["  📡  Live Scoring  ", "  📊  Model Performance  ", "  🧠  Explainability  "]
    )

    # ══════════════════════ TAB 1 — LIVE SCORING ════════════════════════════════
    with tab_live:
        # Determine data source (uploaded CSV or held-out test set)
        live_source = test_frame
        live_label = "Held-out test batch"

        if uploaded_file is not None:
            with st.spinner("Processing uploaded file…"):
                raw_upload = pd.read_csv(uploaded_file)
                live_source = engineer_features(raw_upload, config)
                live_label = f"Uploaded file ({len(raw_upload):,} rows)"

        live_scored = _build_scored_frame(model_bundle, live_source, threshold)
        live_flagged = int(live_scored["flagged"].sum())
        st.caption(f"📂  Scored source: **{live_label}**")

        # ── Row 1: mini secondary KPIs specific to live batch ─────────────────
        lc1, lc2, lc3, lc4 = st.columns(4)
        lc1.metric("Flagged", f"{live_flagged:,}")
        lc2.metric("Precision", f"{current_metrics['precision']:.4f}")
        lc3.metric("Recall", f"{current_metrics['recall']:.4f}")
        lc4.metric("F1", f"{current_metrics['f1']:.4f}")

        # ── Row 2: three exploratory charts ────────────────────────────────────
        st.markdown('<div class="section-header">Batch Analytics</div>', unsafe_allow_html=True)
        c_hist, c_time = st.columns([1, 1])

        with c_hist:
            with st.spinner("Building score distribution…"):
                fig_hist = _chart_probability_histogram(
                    live_scored["fraud_probability"].to_numpy(), threshold
                )
                st.plotly_chart(fig_hist, use_container_width=True)

        with c_time:
            with st.spinner("Building time series…"):
                fig_time = _chart_fraud_rate_over_time(live_scored)
                if fig_time:
                    st.plotly_chart(fig_time, use_container_width=True)
                else:
                    st.info("No `step` column available for time-series chart.")

        c_donut, c_amount = st.columns([1, 1])
        with c_donut:
            with st.spinner("Building type breakdown…"):
                fig_donut = _chart_type_donut(live_scored)
                if fig_donut:
                    st.plotly_chart(fig_donut, use_container_width=True)

        with c_amount:
            with st.spinner("Building amount distribution…"):
                fig_amount = _chart_amount_distribution(live_scored)
                if fig_amount:
                    st.plotly_chart(fig_amount, use_container_width=True)

        # ── Row 3: risk-badge ranked transaction table ─────────────────────────
        st.markdown('<div class="section-header">Highest-Risk Transactions</div>', unsafe_allow_html=True)

        display_cols = [
            c for c in ["step", "type", "amount", "oldbalanceOrg", "newbalanceOrig",
                         "fraud_probability", "flagged", "risk_band"]
            if c in live_scored.columns
        ]
        visible = live_scored[display_cols].head(max_display_rows).copy()

        # Build a styled dataframe with gradient on the probability column
        styled = (
            visible.style
            .background_gradient(
                subset=["fraud_probability"],
                cmap="RdYlGn_r",   # green (low) → red (high)
                vmin=0, vmax=1,
            )
            .format({"fraud_probability": "{:.4f}", "amount": "${:,.2f}"})
            .map(
                lambda v: f"color: {RISK_COLORS.get(str(v), '#E8EDF4')}; font-weight:600;",
                subset=["risk_band"],
            )
            .hide(axis="index")
        )
        st.dataframe(styled, use_container_width=True, height=420)

    # ══════════════════════ TAB 2 — MODEL PERFORMANCE ═══════════════════════════
    with tab_perf:
        # ── Secondary KPIs ─────────────────────────────────────────────────────
        p1, p2, p3, p4, p5, p6 = st.columns(6)
        p1.metric("PR-AUC",    f"{current_metrics['pr_auc']:.4f}")
        p2.metric("ROC-AUC",   f"{current_metrics['roc_auc']:.4f}")
        p3.metric("Precision", f"{current_metrics['precision']:.4f}")
        p4.metric("Recall",    f"{current_metrics['recall']:.4f}")
        p5.metric("F1",        f"{current_metrics['f1']:.4f}")
        p6.metric("Threshold", f"{threshold:.4f}")

        # ── Confusion matrix + cost curve ──────────────────────────────────────
        st.markdown('<div class="section-header">Evaluation Charts</div>', unsafe_allow_html=True)
        cm_vals = [
            [int((split.y_test == 0).sum() - test_fp), test_fp],
            [test_fn, int((split.y_test == 1).sum() - test_fn)],
        ]

        col_cm, col_cost = st.columns(2)
        with col_cm:
            with st.spinner("Building confusion matrix…"):
                st.plotly_chart(
                    _chart_confusion_matrix(cm_vals),
                    use_container_width=True,
                )
        with col_cost:
            with st.spinner("Building cost curve…"):
                st.plotly_chart(
                    _chart_cost_curve(split.y_test, y_test_prob, cost_fp, cost_fn, threshold),
                    use_container_width=True,
                )

        # ── Multi-model ROC + PR curves ────────────────────────────────────────
        st.markdown('<div class="section-header">All-Model Comparison</div>', unsafe_allow_html=True)

        # Load all model bundles to draw overlaid curves
        all_model_bundles: dict[str, dict] = {}
        for mname in available_models:
            try:
                all_model_bundles[mname] = load_model(mname)
            except Exception:
                pass

        with st.spinner("Computing multi-model curves…"):
            roc_fig, pr_fig = _chart_multi_model_curves(split, all_model_bundles)
            col_roc, col_pr = st.columns(2)
            with col_roc:
                st.plotly_chart(roc_fig, use_container_width=True)
            with col_pr:
                st.plotly_chart(pr_fig, use_container_width=True)

        # ── Model comparison heatmap table ─────────────────────────────────────
        all_saved_metrics = load_all_metrics()
        if all_saved_metrics:
            with st.spinner("Building model comparison…"):
                comp_fig = _chart_model_comparison(all_saved_metrics)
                if comp_fig:
                    st.plotly_chart(comp_fig, use_container_width=True)

    # ══════════════════════ TAB 3 — EXPLAINABILITY ══════════════════════════════
    with tab_explain:
        st.markdown('<div class="section-header">Global Feature Importance</div>', unsafe_allow_html=True)

        # ── Global SHAP ────────────────────────────────────────────────────────
        try:
            with st.spinner("Computing global SHAP values…"):
                global_sample = split.X_test[: min(len(split.X_test), shap_sample_size)]
                feature_cols_expl = get_feature_columns(test_frame)
                _, summary_df = compute_shap_values(model, global_sample, feature_cols_expl, config)

            st.plotly_chart(_chart_shap_global(summary_df), use_container_width=True)

            # ── Local SHAP ─────────────────────────────────────────────────────
            st.markdown('<div class="section-header">Local Transaction Explanation</div>', unsafe_allow_html=True)

            selected_pool = test_scored[test_scored["flagged"]].head(50)
            if selected_pool.empty:
                selected_pool = test_scored.head(50)

            chosen_index = st.selectbox(
                "Select a scored transaction",
                options=list(selected_pool.index),
                format_func=lambda i: (
                    f"Row {i}  •  risk_band: {selected_pool.loc[i, 'risk_band']}  •  "
                    f"score {selected_pool.loc[i, 'fraud_probability']:.4f}"
                ),
            )
            chosen_row = selected_pool.loc[[chosen_index]].reset_index(drop=True)

            with st.spinner("Computing local SHAP explanation…"):
                local_table = _local_shap_table(model_bundle, chosen_row, feature_cols_expl)

            left_col, right_col = st.columns([1.2, 1])
            with left_col:
                # Waterfall chart — visual SHAP breakdown for this transaction
                st.plotly_chart(
                    _chart_shap_waterfall(local_table),
                    use_container_width=True,
                )
            with right_col:
                # Styled dataframe: colour-code positive vs negative SHAP
                styled_local = (
                    local_table.style
                    .bar(
                        subset=["shap_value"],
                        color=["#22C55E", "#EF4444"],
                        align="zero",
                    )
                    .format({"value": "{:.4f}", "shap_value": "{:+.4f}"})
                    .hide(axis="index")
                )
                st.dataframe(styled_local, use_container_width=True, height=380)

                # Transaction summary card
                prob = float(selected_pool.loc[chosen_index, "fraud_probability"])
                band = str(selected_pool.loc[chosen_index, "risk_band"])
                st.markdown(
                    f"""
                    <div class="kpi-card" style="margin-top:12px;">
                      <div class="kpi-label">Selected Transaction Score</div>
                      <div class="kpi-value" style="color:{RISK_COLORS.get(band,'#E8EDF4')}">
                        {prob:.4f}
                      </div>
                      <div class="kpi-delta">{_risk_badge(band)}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

        except Exception as exc:
            st.warning(f"SHAP explanation unavailable: {exc}")


if __name__ == "__main__":
    main()