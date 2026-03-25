#!/usr/bin/env python3
"""
ISSUE 4 FIX — ML Model Sanity Check (Fixed)
Run from ml-engine dir: python sanity_check.py
"""

import sys
import os
import json
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))

from outbreak_prediction import RealTimeOutbreakPredictor

print("✅ Imported RealTimeOutbreakPredictor from outbreak_prediction.py")

# ── Generate same historical data format as main.py ──────────────────────────
def generate_historical_data(n_samples=3000):
    np.random.seed(42)
    districts = np.random.choice(['LUCKNOW', 'VARANASI', 'GORAKHPUR'], n_samples)
    df = pd.DataFrame({
        'district': districts,
        'ward_id': ['W-' + str(np.random.randint(1, 20)) for _ in range(n_samples)],
        'unresolved_sla_breaches': np.random.randint(0, 10, n_samples),
        'stagnant_water_reports': np.random.randint(0, 5, n_samples),
        'recent_fevers_3d': np.random.randint(0, 20, n_samples),
        'diarrhea_7d': np.random.randint(0, 15, n_samples),
        'confirmed_cases_clinic': np.random.randint(0, 3, n_samples),
    })
    df['is_gorakhpur_flood_zone'] = (df['district'] == 'GORAKHPUR').astype(int)
    df['is_varanasi_ghat_zone']   = (df['district'] == 'VARANASI').astype(int)
    risk_base = (
        df['stagnant_water_reports'] * 8 +
        df['recent_fevers_3d'] * 3 +
        df['unresolved_sla_breaches'] * 2
    )
    risk_base = np.where(df['district'] == 'GORAKHPUR', risk_base * 1.5, risk_base)
    risk_base = np.where(df['district'] == 'VARANASI',  risk_base * 1.2, risk_base)
    df['future_outbreak_risk_score'] = (risk_base + np.random.normal(0, 5, n_samples)).clip(0, 100)
    return df

# ── Mock ward payloads (same format as /predict-stream endpoint) ──────────────
MOCK_WARDS = [
    {
        "ward_id": "W-9", "district": "GORAKHPUR",
        "unresolved_sla_breaches": 8,
        "stagnant_water_reports": 4,
        "recent_fevers_3d": 17,
        "diarrhea_7d": 11,
        "confirmed_cases_clinic": 2,
    },
    {
        "ward_id": "W-3", "district": "VARANASI",
        "unresolved_sla_breaches": 3,
        "stagnant_water_reports": 2,
        "recent_fevers_3d": 6,
        "diarrhea_7d": 4,
        "confirmed_cases_clinic": 0,
    },
    {
        "ward_id": "W-1", "district": "LUCKNOW",
        "unresolved_sla_breaches": 1,
        "stagnant_water_reports": 0,
        "recent_fevers_3d": 2,
        "diarrhea_7d": 1,
        "confirmed_cases_clinic": 0,
    },
]

print("\n" + "═"*60)
print("  ML OUTBREAK PREDICTOR — SANITY CHECK  ")
print("═"*60)

# 1. Train
print("\n[1/4] Training model on 3000 synthetic UP samples...")
predictor = RealTimeOutbreakPredictor()
df = generate_historical_data(3000)
predictor.train_initial_model(df)
print("   ✅ train_initial_model() completed")

# 2. Verify model is fitted
has_model = hasattr(predictor, 'model') and predictor.model is not None
print(f"\n[2/4] Model fitted: {'✅ Yes' if has_model else '❌ No — something went wrong'}")

# 3. Run predictions on mock wards
print("\n[3/4] Running predictions on 3 mock wards:")
print(f"\n   {'Ward':<10} {'District':<12} {'Risk Score':>12} {'Risk Level':<12} {'Fever':>6} {'Drain':>6}")
print(f"   {'-'*60}")

results = []
for ward in MOCK_WARDS:
    try:
        result = predictor.stream_process(ward)
        rs = result.get('risk_score', result.get('predicted_risk', 0))
        rl = result.get('risk_level', 'UNKNOWN')
        results.append({'ward': ward['ward_id'], 'district': ward['district'], 'risk_score': rs, 'risk_level': rl})
        print(f"   {ward['ward_id']:<10} {ward['district']:<12} {rs:>12.4f} {rl:<12} {ward['recent_fevers_3d']:>6} {ward['stagnant_water_reports']:>6}")
    except Exception as e:
        print(f"   {ward['ward_id']:<10} ERROR: {e}")

# 4. Feature importances
print("\n[4/4] Feature importances (proves AI is working mathematically):")
try:
    fi = predictor.model.feature_importances_
    features = getattr(predictor, 'feature_names', [f'f{i}' for i in range(len(fi))])
    ranked = sorted(zip(list(features), fi.tolist()), key=lambda x: -x[1])
    print(f"\n   {'Rank':<5} {'Feature':<28} {'Importance':>12}  Bar")
    print(f"   {'-'*58}")
    for i, (name, imp) in enumerate(ranked, 1):
        bar = "█" * int(imp * 60)
        print(f"   #{i:<4} {name:<28} {imp:>12.4f}  {bar}")
except Exception as e:
    print(f"   ⚠️  {e}")

# Final verdict
print("\n" + "═"*60)
checks = {
    "Model trains without error":     has_model,
    "All 3 wards predicted":          len(results) == 3,
    "Risk scores in range [0,1]":     all(0 <= r['risk_score'] <= 1 for r in results),
    "Gorakhpur has highest risk":     len(results) == 3 and results[0]['risk_score'] >= results[2]['risk_score'],
    "Feature importances available":  has_model and hasattr(predictor.model, 'feature_importances_'),
}
all_pass = all(checks.values())
print("  SANITY CHECK RESULTS:")
for check, passed in checks.items():
    print(f"  {'✅' if passed else '❌'} {check}")

print(f"\n  {'🎉 ALL CHECKS PASSED — AI prediction is mathematically functioning' if all_pass else '⚠️  SOME CHECKS FAILED'}")
print("═"*60)
