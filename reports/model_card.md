# Model Card: PaySim Mobile Money Fraud Detector

Following the Google Model Cards framework.

## Model Details

| Field | Value |
|---|---|
| Model name | PaySim Fraud Scorer |
| Version | 0.1.0 |
| Primary model | XGBoost |
| Baseline models | Logistic Regression, Random Forest, Isolation Forest |
| AutoEncoder | Implemented in `src/models/anomaly_detection.py`, but not evaluated in this workspace because TensorFlow is unavailable in the current Python 3.14 runtime |
| Maintainer | Portfolio project |
| Last updated | 2026-07-10 |

## Intended Use

- Score PaySim mobile-money transactions for fraud risk in batch or near-real-time workflows.
- Support fraud-operations analysts with a probability score and SHAP-based explanation.
- Compare threshold choices using a business cost model.

## Out of Scope

- Direct production use without validation on real transaction data.
- Fully automated block/allow decisions without human review.
- Regulatory or legal decisions.
- Scoring transaction types that the dataset never labeled as fraud (`PAYMENT`, `CASH_IN`) as if they were positive classes.

## Training Data

| Field | Value |
|---|---|
| Dataset | Kaggle PaySim synthetic financial transactions (`ealaxi/paysim1`) |
| Full dataset size | 6,362,620 rows |
| Full dataset fraud count | 8,213 |
| Full dataset fraud rate | 0.1291% |
| Sample used in this workspace | 500,000 rows |
| Rows after filtering `PAYMENT` and `CASH_IN` | 221,223 |
| Filtered fraud rate | 0.2916% |
| Split strategy | Time-aware by `step` to reduce temporal leakage |

### Feature Set

The model uses the original PaySim numeric fields plus engineered balance features:

- `errorBalanceOrig`
- `errorBalanceDest`
- `hasBalanceErrorOrig`
- `hasBalanceErrorDest`
- `amountToOldBalanceRatio`
- `drainsFullBalance`
- `logAmount`
- `isNewDestAccount`
- `isZeroOrigBalance`
- `balanceChangeOrig`
- `balanceChangeDest`
- one-hot `type_*` columns for the remaining transaction types

Identifier columns are excluded from modeling.

## Evaluation Data

- Train: 159,834 rows
- Validation: 28,206 rows
- Test: 33,183 rows
- Test fraud count: 312
- Test fraud rate: 0.9402%

### Metrics

Saved metrics in `outputs/metrics/`:

| Model | PR-AUC | Precision | Recall | F1 | Threshold | Total cost | CV PR-AUC |
|---|---:|---:|---:|---:|---:|---:|---:|
| Logistic Regression | 0.9856 | 0.9341 | 1.0000 | 0.9659 | 0.7041 | 1100 | 0.8772 ± 0.0307 |
| Random Forest | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.4286 | 0 | N/A |
| XGBoost | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9838 | 0 | 0.9925 ± 0.0093 |
| Isolation Forest | 0.4031 | 0.2035 | 0.7372 | 0.3190 | 0.5642 | 86000 | N/A |

### Imbalance Comparison

The workspace also produced a direct comparison across imbalance strategies using XGBoost:

| Strategy | PR-AUC | Precision | Recall | F1 | Training time (s) | Threshold | Total cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| class_weight | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.11 | 0.9454 | 0 |
| smote | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 4.68 | 0.5485 | 0 |
| undersample | 1.0000 | 0.9936 | 1.0000 | 0.9968 | 0.13 | 0.8480 | 100 |
| smote_enn | 0.9999 | 0.9873 | 1.0000 | 0.9936 | 51.77 | 0.4438 | 200 |

## Performance Notes

The dataset is unusually separable because PaySim's fraud injection logic creates many fraudulent transactions with balance-drain patterns. The strongest features in the engineered set are:

1. `hasBalanceErrorOrig`
2. `errorBalanceOrig`
3. `newbalanceOrig`
4. `balanceChangeOrig`
5. `drainsFullBalance`

This means the near-perfect supervised metrics are not representative of real-world fraud systems.

## Ethical Considerations

### False Positives

False positives create customer friction and can block legitimate payments. That is why threshold selection is cost-based rather than fixed at 0.5.

### False Negatives

False negatives allow fraud to slip through and create direct financial loss.

### Synthetic Data Limits

PaySim is synthetic, so the model can learn patterns that are too easy compared with real adversarial behavior. The metrics should not be extrapolated to production use.

### Fairness

The dataset does not include demographic attributes, so fairness analysis cannot be performed on this data alone.

## Deployment Guidance

1. Validate the approach on real labeled fraud data before any production use.
2. Recalibrate the decision threshold when the fraud rate shifts.
3. Keep humans in the loop for high-score transactions.
4. Monitor for drift in score distribution and fraud prevalence.

## Changelog

| Version | Date | Changes |
|---|---|---|
| 0.1.0 | 2026-07-10 | Initial portfolio release with cached parquet reuse, Optuna-tuned XGBoost, imbalance comparison, SHAP dashboard, and evaluation tests |