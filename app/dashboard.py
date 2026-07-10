"""Fraud Operations Dashboard — internal tool for transaction scoring and review."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data_loader import load_data, save_processed
from src.evaluate import compute_metrics_at_threshold, find_cost_optimal_threshold
from src.explainability import compute_shap_values, explain_instance
from src.feature_engineering import engineer_features, get_feature_columns
from src.preprocessing import split_data
from src.utils import load_config

st.set_page_config(
    page_title="Fraud Ops Console",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

config = load_config()
eval_cfg = config["evaluation"]
cost_fp_default = float(eval_cfg["cost_false_positive"])
cost_fn_default = float(eval_cfg["cost_false_negative"])


@st.cache_data(show_spinner="Loading engineered transactions...")
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


@st.cache_resource(show_spinner="Loading model artifact...")
def load_model(model_name: str):
    """Load a trained model from models/ or fall back to the training script."""
    model_path = PROJECT_ROOT / config["paths"]["models_dir"] / f"{model_name}.joblib"

    if model_path.exists():
        return joblib.load(model_path)

    if model_name == "xgboost":
        from src.models.tree_ensemble import train_xgboost

        featured = load_featured_data()
        split = split_data(featured, config)
        return train_xgboost(split, config, optuna_trials=1)

    raise FileNotFoundError(f"No saved model found for {model_name}")


@st.cache_data(show_spinner="Loading saved metrics...")
def load_saved_metrics(model_name: str) -> dict[str, Any] | None:
    """Load the JSON metrics artifact for a trained model if present."""
    metrics_path = PROJECT_ROOT / config["paths"]["metrics_dir"] / f"{model_name}_metrics.json"
    if not metrics_path.exists():
        return None
    return pd.read_json(metrics_path, typ="series").to_dict()


def _build_scored_frame(
    model: Any,
    featured_df: pd.DataFrame,
    threshold: float,
) -> pd.DataFrame:
    """Score a feature-engineered frame and attach fraud probabilities."""
    feature_cols = get_feature_columns(featured_df)
    scores = model.predict_proba(featured_df[feature_cols].values.astype(np.float64))[:, 1]
    scored = featured_df.copy().reset_index(drop=True)
    scored["fraud_probability"] = scores
    scored["flagged"] = scored["fraud_probability"] >= threshold
    scored["risk_band"] = pd.cut(
        scored["fraud_probability"],
        bins=[-0.001, 0.25, 0.50, 0.75, 1.0],
        labels=["low", "moderate", "high", "critical"],
    )
    return scored.sort_values("fraud_probability", ascending=False).reset_index(drop=True)


def _style_score_table(df: pd.DataFrame) -> pd.io.formats.style.Styler:
    """Apply simple color treatment to risk scores."""
    return (
        df.style.background_gradient(subset=["fraud_probability"], cmap="YlOrRd")
        .format({"fraud_probability": "{:.4f}", "amount": "{:.2f}"})
        .hide(axis="index")
    )


def _plot_probability_distribution(scores: np.ndarray, threshold: float) -> go.Figure:
    """Render a histogram of fraud probabilities with a threshold marker."""
    fig = go.Figure()
    fig.add_trace(
        go.Histogram(
            x=scores,
            nbinsx=24,
            name="Fraud probability",
            marker_color="#1f4e79",
            opacity=0.85,
        )
    )
    fig.add_vline(x=threshold, line_width=2, line_dash="dash", line_color="#d1495b")
    fig.update_layout(
        height=320,
        margin=dict(l=10, r=10, t=30, b=10),
        showlegend=False,
        xaxis_title="Fraud probability",
        yaxis_title="Count",
    )
    return fig


def _plot_curves(y_true: np.ndarray, y_prob: np.ndarray) -> tuple[go.Figure, go.Figure]:
    """Build ROC and precision-recall curves for the selected model."""
    from sklearn.metrics import precision_recall_curve, roc_curve, auc

    precision, recall, _ = precision_recall_curve(y_true, y_prob)
    fpr, tpr, _ = roc_curve(y_true, y_prob)

    pr_fig = go.Figure()
    pr_fig.add_trace(go.Scatter(x=recall, y=precision, mode="lines", line=dict(color="#1f4e79"), name="PR curve"))
    pr_fig.update_layout(
        height=320,
        margin=dict(l=10, r=10, t=30, b=10),
        xaxis_title="Recall",
        yaxis_title="Precision",
        title=f"Precision-Recall curve (AUC = {auc(recall, precision):.4f})",
    )

    roc_fig = go.Figure()
    roc_fig.add_trace(go.Scatter(x=fpr, y=tpr, mode="lines", line=dict(color="#2a9d8f"), name="ROC curve"))
    roc_fig.add_trace(
        go.Scatter(
            x=[0, 1],
            y=[0, 1],
            mode="lines",
            line=dict(color="#aaaaaa", dash="dash"),
            name="Chance",
            showlegend=False,
        )
    )
    roc_fig.update_layout(
        height=320,
        margin=dict(l=10, r=10, t=30, b=10),
        xaxis_title="False positive rate",
        yaxis_title="True positive rate",
        title="ROC curve",
    )
    return pr_fig, roc_fig


def _plot_confusion_matrix(confusion: list[list[int]]) -> go.Figure:
    """Render a confusion matrix heatmap."""
    fig = go.Figure(
        data=go.Heatmap(
            z=confusion,
            x=["Pred: legit", "Pred: fraud"],
            y=["Actual: legit", "Actual: fraud"],
            colorscale="Blues",
            showscale=False,
            text=confusion,
            texttemplate="%{text}",
        )
    )
    fig.update_layout(height=280, margin=dict(l=10, r=10, t=10, b=10))
    return fig


def _local_shap_table(model: Any, row: pd.DataFrame, feature_cols: list[str]) -> pd.DataFrame:
    """Build a local SHAP explanation for one scored transaction."""
    import shap

    explainer = shap.TreeExplainer(model)
    values = explainer.shap_values(row[feature_cols].values)
    if isinstance(values, list):
        values = values[1]
    local = explain_instance(values, feature_cols, 0, row[feature_cols].values)
    return local.head(int(config.get("explainability", {}).get("max_display_features", 15)))


def _test_slice(featured: pd.DataFrame, split) -> pd.DataFrame:
    """Recover the time-ordered test slice from the engineered frame."""
    ordered = featured.sort_values(config["preprocessing"].get("step_col", "step")).reset_index(drop=True)
    return ordered.iloc[-len(split.y_test) :].reset_index(drop=True)


def main() -> None:
    """Run the fraud operations dashboard."""
    st.title("Fraud Operations Console")
    st.caption("Human-in-the-loop transaction scoring for the PaySim fraud portfolio project.")

    featured = load_featured_data()
    split = split_data(featured, config)

    models_dir = PROJECT_ROOT / config["paths"]["models_dir"]
    available_models = sorted(p.stem for p in models_dir.glob("*.joblib"))
    if not available_models:
        st.error("No trained model artifacts found in models/.")
        st.stop()

    default_model = "xgboost" if "xgboost" in available_models else available_models[0]

    with st.sidebar:
        st.header("Controls")
        model_name = st.selectbox("Model", available_models, index=available_models.index(default_model))
        saved_metrics = load_saved_metrics(model_name) or {}
        threshold_default = float(saved_metrics.get("threshold", config["dashboard"].get("default_threshold", 0.5)))
        threshold = st.slider("Decision threshold", 0.01, 0.99, float(threshold_default), 0.01)
        cost_fp = st.number_input("False positive cost", min_value=0.0, value=cost_fp_default, step=10.0)
        cost_fn = st.number_input("False negative cost", min_value=0.0, value=cost_fn_default, step=10.0)
        max_display_rows = st.slider("Rows to display", 25, 200, 100, 25)
        uploaded_file = st.file_uploader("Score a CSV file", type=["csv"])
        with st.expander("Advanced"):
            shap_sample_size = st.slider("SHAP background sample", 50, 500, 200, 50)

    model = load_model(model_name)
    test_frame = _test_slice(featured, split)
    test_scored = _build_scored_frame(model, test_frame, threshold)
    current_metrics = compute_metrics_at_threshold(split.y_test, model.predict_proba(split.X_test)[:, 1], threshold)
    y_test_prob = model.predict_proba(split.X_test)[:, 1]
    y_test_pred = (y_test_prob >= threshold).astype(int)
    test_fp = int(((y_test_pred == 1) & (split.y_test == 0)).sum())
    test_fn = int(((y_test_pred == 0) & (split.y_test == 1)).sum())
    current_cost = test_fp * cost_fp + test_fn * cost_fn
    baseline_cost = int(split.y_test.sum()) * cost_fn
    cost_saved = baseline_cost - current_cost

    tab_live, tab_perf, tab_explain = st.tabs(["Live Scoring", "Model Performance", "Explainability"])

    with tab_live:
        live_source = test_frame
        live_label = "Held-out test batch"

        if uploaded_file is not None:
            raw_upload = pd.read_csv(uploaded_file)
            live_source = engineer_features(raw_upload, config)
            live_label = f"Uploaded file ({len(raw_upload):,} rows before feature engineering)"

        live_scored = _build_scored_frame(model, live_source, threshold)
        live_flagged = int(live_scored["flagged"].sum())

        st.subheader("Batch overview")
        metric_cols = st.columns(4)
        metric_cols[0].metric("Flagged", f"{live_flagged:,}")
        metric_cols[1].metric("Precision", f"{current_metrics['precision']:.4f}")
        metric_cols[2].metric("Recall", f"{current_metrics['recall']:.4f}")
        metric_cols[3].metric("Cost saved", f"${cost_saved:,.0f}")
        st.caption(f"Scored source: {live_label}")

        st.plotly_chart(_plot_probability_distribution(live_scored["fraud_probability"].to_numpy(), threshold), use_container_width=True)

        st.markdown("#### Highest-risk transactions")
        display_cols = [
            "step",
            "type",
            "amount",
            "oldbalanceOrg",
            "newbalanceOrig",
            "fraud_probability",
            "flagged",
            "risk_band",
        ]
        visible = live_scored.loc[:, [c for c in display_cols if c in live_scored.columns]].head(max_display_rows)
        st.dataframe(_style_score_table(visible), use_container_width=True, height=420)

    with tab_perf:
        st.subheader("Selected Model Performance")
        perf_cols = st.columns(6)
        perf_cols[0].metric("PR-AUC", f"{current_metrics['pr_auc']:.4f}")
        perf_cols[1].metric("ROC-AUC", f"{current_metrics['roc_auc']:.4f}")
        perf_cols[2].metric("Precision", f"{current_metrics['precision']:.4f}")
        perf_cols[3].metric("Recall", f"{current_metrics['recall']:.4f}")
        perf_cols[4].metric("F1", f"{current_metrics['f1']:.4f}")
        perf_cols[5].metric("Threshold", f"{threshold:.4f}")

        cm = [[int((split.y_test == 0).sum() - test_fp), test_fp], [test_fn, int((split.y_test == 1).sum() - test_fn)]]
        pr_fig, roc_fig = _plot_curves(split.y_test, y_test_prob)
        cm_fig = _plot_confusion_matrix(cm)

        chart_cols = st.columns(2)
        chart_cols[0].plotly_chart(pr_fig, use_container_width=True)
        chart_cols[1].plotly_chart(roc_fig, use_container_width=True)
        st.plotly_chart(cm_fig, use_container_width=True)

        st.markdown("#### Baseline metrics")
        summary = pd.DataFrame(
            {
                "metric": ["PR-AUC", "Precision", "Recall", "F1", "Threshold", "Cost saved"],
                "value": [
                    f"{current_metrics['pr_auc']:.4f}",
                    f"{current_metrics['precision']:.4f}",
                    f"{current_metrics['recall']:.4f}",
                    f"{current_metrics['f1']:.4f}",
                    f"{threshold:.4f}",
                    f"${cost_saved:,.0f}",
                ],
            }
        )
        st.dataframe(summary, use_container_width=True, hide_index=True)

    with tab_explain:
        st.subheader("Explainability")
        selected_pool = test_scored[test_scored["flagged"]].head(50)
        if selected_pool.empty:
            selected_pool = test_scored.head(50)

        chosen_index = st.selectbox(
            "Select a scored transaction",
            options=list(selected_pool.index),
            format_func=lambda i: f"Row {i} - score {selected_pool.loc[i, 'fraud_probability']:.4f}",
        )
        chosen_row = selected_pool.loc[[chosen_index]].reset_index(drop=True)
        feature_cols = get_feature_columns(test_frame)

        try:
            local_table = _local_shap_table(model, chosen_row, feature_cols)
            global_sample = split.X_test[: min(len(split.X_test), shap_sample_size)]
            _, summary_df = compute_shap_values(model, global_sample, feature_cols, config)

            left, right = st.columns(2)
            with left:
                st.markdown("**Local SHAP explanation**")
                st.dataframe(local_table, use_container_width=True, hide_index=True)
            with right:
                st.markdown("**Global feature importance**")
                st.dataframe(summary_df.head(10), use_container_width=True, hide_index=True)

            st.markdown("**Top global contributors**")
            fig = go.Figure(
                data=go.Bar(
                    x=summary_df.head(10)["mean_abs_shap"],
                    y=summary_df.head(10)["feature"],
                    orientation="h",
                    marker_color="#1f4e79",
                )
            )
            fig.update_layout(height=360, margin=dict(l=10, r=10, t=10, b=10), xaxis_title="mean |SHAP|")
            st.plotly_chart(fig, use_container_width=True)
        except Exception as exc:
            st.warning(f"SHAP explanation unavailable: {exc}")


if __name__ == "__main__":
    main()