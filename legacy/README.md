# Legacy: Original Streamlit Dashboard

`dashboard.py` is the original Streamlit fraud-ops console, superseded by the FastAPI + Next.js
rebuild in `backend/` and `frontend/`. Kept for reference and as an academic "before" artefact.

See the main README's **Dashboard** section for the current architecture, or run the full stack:

```bash
# Current stack
python -m uvicorn backend.main:app --reload --port 8000
cd frontend && npm run dev
```

To run the legacy dashboard instead (requires Streamlit):

```bash
pip install streamlit
streamlit run legacy/dashboard.py
```
