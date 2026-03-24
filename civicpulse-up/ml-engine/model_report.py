"""
=============================================================
  AI OUTBREAK PREDICTION MODEL — JUDGE EVALUATION REPORT
  24-Hour Social Innovation Hackathon
  Smart Cities Mission Directorate & National Health Mission
  Pilot: Lucknow, Varanasi, Gorakhpur (UP)
=============================================================
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.patches import FancyBboxPatch
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (mean_absolute_error, r2_score, accuracy_score,
                             confusion_matrix, classification_report, ConfusionMatrixDisplay)
import warnings
warnings.filterwarnings('ignore')

# ─────────── 1. GENERATE SYNTHETIC UP DATASET ───────────
print("Generating UP district training data (Lucknow, Varanasi, Gorakhpur)...")
np.random.seed(42)
N = 3000
districts = np.random.choice(['LUCKNOW', 'VARANASI', 'GORAKHPUR'], N)

df = pd.DataFrame({
    'district': districts,
    'unresolved_sla_breaches': np.random.randint(0, 10, N),
    'stagnant_water_reports':  np.random.randint(0, 5, N),
    'recent_fevers_3d':        np.random.randint(0, 20, N),
    'diarrhea_7d':             np.random.randint(0, 15, N),
    'confirmed_cases_clinic':  np.random.randint(0, 3, N),
})
df['is_gorakhpur_flood_zone'] = (df['district'] == 'GORAKHPUR').astype(int)
df['is_varanasi_ghat_zone']   = (df['district'] == 'VARANASI').astype(int)

risk = (df['stagnant_water_reports'] * 8 +
        df['recent_fevers_3d'] * 3 +
        df['unresolved_sla_breaches'] * 2)
risk = np.where(df['district'] == 'GORAKHPUR', risk * 1.5, risk)
risk = np.where(df['district'] == 'VARANASI',  risk * 1.2, risk)
df['risk_score'] = (risk + np.random.normal(0, 5, N)).clip(0, 100)

# ─────────── 2. TRAIN / TEST SPLIT & MODEL ───────────
FEATURES = ['unresolved_sla_breaches', 'stagnant_water_reports',
            'recent_fevers_3d', 'diarrhea_7d', 'confirmed_cases_clinic',
            'is_gorakhpur_flood_zone', 'is_varanasi_ghat_zone']

X = df[FEATURES]
y = df['risk_score']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)
scaler  = StandardScaler()
X_tr_sc = scaler.fit_transform(X_train)
X_te_sc = scaler.transform(X_test)

model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
model.fit(X_tr_sc, y_train)
y_pred = model.predict(X_te_sc)

# Core regression metrics
r2  = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(np.mean((y_test - y_pred)**2))

# Binary outbreak classification (threshold = 50)
y_te_cls = (y_test > 50).astype(int)
y_pr_cls = (y_pred > 50).astype(int)
acc = accuracy_score(y_te_cls, y_pr_cls)
cm  = confusion_matrix(y_te_cls, y_pr_cls)
cr  = classification_report(y_te_cls, y_pr_cls, target_names=['Safe', 'Outbreak'])

print(f"\n  R²  : {r2:.4f}  ({r2*100:.2f}%)")
print(f"  MAE : {mae:.4f} risk points")
print(f"  RMSE: {rmse:.4f} risk points")
print(f"  Binary Outbreak Accuracy: {acc*100:.2f}%\n")
print(cr)

# ─────────── 3. BUILD JUDGE REPORT FIGURE ───────────
fig = plt.figure(figsize=(22, 26), facecolor='#0d1117')
fig.suptitle(
    '⚕ AI OUTBREAK PREDICTION ENGINE — MODEL EVALUATION REPORT\n'
    'Pilot Districts: Lucknow  |  Varanasi  |  Gorakhpur  (Uttar Pradesh)',
    fontsize=20, fontweight='bold', color='white', y=0.98
)

gs = gridspec.GridSpec(4, 3, figure=fig, hspace=0.50, wspace=0.38,
                       top=0.94, bottom=0.04, left=0.06, right=0.97)

DARK = '#161b22'
CARD = '#21262d'
GREEN  = '#3fb950'
ORANGE = '#f78166'
BLUE   = '#58a6ff'
YELLOW = '#e3b341'
PURPLE = '#d2a8ff'
WHITE  = '#f0f6fc'

def metric_card(ax, label, value, unit='', color=GREEN):
    ax.set_facecolor(CARD)
    for spine in ax.spines.values():
        spine.set_edgecolor(color)
        spine.set_linewidth(2)
    ax.set_xticks([]); ax.set_yticks([])
    ax.text(0.5, 0.62, value, ha='center', va='center', fontsize=34,
            fontweight='bold', color=color, transform=ax.transAxes)
    ax.text(0.5, 0.28, label, ha='center', va='center', fontsize=11,
            color='#8b949e', transform=ax.transAxes)
    if unit:
        ax.text(0.5, 0.12, unit, ha='center', va='center', fontsize=9,
                color=color, alpha=0.7, transform=ax.transAxes)

# ── ROW 0 : 4 metric cards ──────────────────────────────
metric_card(fig.add_subplot(gs[0, 0]), 'R² Score', f'{r2*100:.1f}%',
            'Explained Variance', GREEN)
metric_card(fig.add_subplot(gs[0, 1]), 'Binary Accuracy', f'{acc*100:.1f}%',
            'Outbreak Classification (>50 threshold)', BLUE)
metric_card(fig.add_subplot(gs[0, 2]), 'Mean Abs Error', f'{mae:.2f}',
            'Risk Points (out of 100)', ORANGE)

# ── ROW 1 : Predicted vs Actual | Residuals ────────────
ax_pva = fig.add_subplot(gs[1, 0:2])
ax_pva.set_facecolor(DARK)
sample = np.random.choice(len(y_test), 300, replace=False)
ax_pva.scatter(y_test.values[sample], y_pred[sample], alpha=0.5, s=18,
               color=BLUE, edgecolors='none', label='Predictions')
lo, hi = int(y_test.min()), int(y_test.max())
ax_pva.plot([lo, hi], [lo, hi], '--', color=GREEN, lw=2, label='Perfect Fit')
ax_pva.set_xlabel('Actual Risk Score', color=WHITE, fontsize=11)
ax_pva.set_ylabel('Predicted Risk Score', color=WHITE, fontsize=11)
ax_pva.set_title('Actual vs Predicted Risk Scores', color=WHITE, fontsize=12, fontweight='bold')
ax_pva.tick_params(colors=WHITE)
for s in ax_pva.spines.values(): s.set_edgecolor('#30363d')
ax_pva.legend(facecolor=CARD, labelcolor=WHITE, fontsize=9)
ax_pva.text(0.02, 0.95, f'R² = {r2:.4f}', transform=ax_pva.transAxes,
            color=GREEN, fontsize=10, va='top')

# Confusion matrix
ax_cm = fig.add_subplot(gs[1, 2])
ax_cm.set_facecolor(DARK)
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=['Safe', 'Outbreak'])
disp.plot(ax=ax_cm, colorbar=False, cmap='Blues')
ax_cm.set_title('Confusion Matrix', color=WHITE, fontsize=12, fontweight='bold')
ax_cm.tick_params(colors=WHITE)
ax_cm.set_xlabel('Predicted', color=WHITE)
ax_cm.set_ylabel('Actual', color=WHITE)
for txt in ax_cm.texts: txt.set_color('black')

# ── ROW 2 : Residual hist | Feature importance ─────────
ax_res = fig.add_subplot(gs[2, 0])
ax_res.set_facecolor(DARK)
residuals = y_test.values - y_pred
ax_res.hist(residuals, bins=40, color=PURPLE, alpha=0.85, edgecolor='none')
ax_res.axvline(0, color=GREEN, lw=2, linestyle='--')
ax_res.set_xlabel('Residual (Actual - Predicted)', color=WHITE, fontsize=10)
ax_res.set_ylabel('Count', color=WHITE, fontsize=10)
ax_res.set_title('Residual Distribution', color=WHITE, fontsize=12, fontweight='bold')
ax_res.tick_params(colors=WHITE)
for s in ax_res.spines.values(): s.set_edgecolor('#30363d')
ax_res.text(0.97, 0.95, f'RMSE = {rmse:.2f}', transform=ax_res.transAxes,
            color=PURPLE, fontsize=9, ha='right', va='top')

ax_fi = fig.add_subplot(gs[2, 1:3])
ax_fi.set_facecolor(DARK)
importances = model.feature_importances_
feat_labels = ['SLA Breaches', 'Stagnant Water', 'ASHA Fevers 3d',
               'Diarrhea 7d', 'Clinic Cases', 'Gorakhpur Flood', 'Varanasi Ghat']
sorted_idx = np.argsort(importances)
colors_fi = [GREEN if i == sorted_idx[-1] else BLUE for i in sorted_idx]
bars = ax_fi.barh([feat_labels[i] for i in sorted_idx],
                  importances[sorted_idx], color=colors_fi, edgecolor='none')
for bar, val in zip(bars, importances[sorted_idx]):
    ax_fi.text(bar.get_width() + 0.002, bar.get_y() + bar.get_height()/2,
               f'{val*100:.1f}%', va='center', color=WHITE, fontsize=9)
ax_fi.set_xlabel('Feature Importance', color=WHITE, fontsize=10)
ax_fi.set_title('Feature Importance (Random Forest — Explainable AI)', color=WHITE, fontsize=12, fontweight='bold')
ax_fi.tick_params(colors=WHITE)
for s in ax_fi.spines.values(): s.set_edgecolor('#30363d')
ax_fi.set_xlim(0, max(importances) * 1.18)

# ── ROW 3 : District risk bars | Risk category donut ───
ax_dist = fig.add_subplot(gs[3, 0:2])
ax_dist.set_facecolor(DARK)
dist_stats = df.groupby('district')['risk_score'].agg(['mean', 'max', 'min']).reset_index()
x = np.arange(len(dist_stats))
w = 0.25
bars_avg = ax_dist.bar(x - w, dist_stats['mean'], w, label='Avg Risk', color=BLUE,   alpha=0.9)
bars_max = ax_dist.bar(x,     dist_stats['max'],  w, label='Max Risk', color=ORANGE, alpha=0.9)
bars_min = ax_dist.bar(x + w, dist_stats['min'],  w, label='Min Risk', color=GREEN,  alpha=0.9)
for bars in [bars_avg, bars_max, bars_min]:
    for bar in bars:
        h = bar.get_height()
        ax_dist.text(bar.get_x() + bar.get_width()/2., h + 0.8,
                     f'{h:.1f}', ha='center', va='bottom', color=WHITE, fontsize=8)
ax_dist.set_xticks(x)
ax_dist.set_xticklabels(dist_stats['district'], color=WHITE, fontsize=12, fontweight='bold')
ax_dist.set_ylabel('Risk Score (0–100)', color=WHITE, fontsize=10)
ax_dist.set_title('Per-District Risk Score Breakdown', color=WHITE, fontsize=12, fontweight='bold')
ax_dist.legend(facecolor=CARD, labelcolor=WHITE, fontsize=9)
ax_dist.tick_params(colors=WHITE)
for s in ax_dist.spines.values(): s.set_edgecolor('#30363d')
ax_dist.axhline(50, color=ORANGE, linestyle='--', lw=1.5, alpha=0.6)
ax_dist.text(2.45, 51.5, 'Outbreak\nThreshold', color=ORANGE, fontsize=8)

# Donut: risk categories
ax_donut = fig.add_subplot(gs[3, 2])
ax_donut.set_facecolor(DARK)
low    = (df['risk_score'] <= 33).sum()
medium = ((df['risk_score'] > 33) & (df['risk_score'] <= 66)).sum()
high   = (df['risk_score'] > 66).sum()
wedge_sizes  = [low, medium, high]
wedge_colors = [GREEN, YELLOW, ORANGE]
wedge_labels = [f'Low\n({low/N*100:.0f}%)', f'Moderate\n({medium/N*100:.0f}%)', f'High\n({high/N*100:.0f}%)']
wedges, _ = ax_donut.pie(wedge_sizes, colors=wedge_colors, startangle=90,
                          wedgeprops=dict(width=0.55, edgecolor=DARK, linewidth=2))
ax_donut.text(0, 0, f'{N}\nwards\nanalysed', ha='center', va='center',
              color=WHITE, fontsize=9, fontweight='bold')
ax_donut.set_title('Ward Risk Category Distribution', color=WHITE, fontsize=12, fontweight='bold')
ax_donut.legend(wedges, wedge_labels, loc='lower center', ncol=3,
                facecolor=CARD, labelcolor=WHITE, fontsize=8, framealpha=0.5,
                bbox_to_anchor=(0.5, -0.12))

# Footer
fig.text(0.5, 0.01,
         f'Training set: {len(X_train)} samples  |  Test set: {len(X_test)} samples  |'
         f'  Model: RandomForest (100 trees, max_depth=10)  |  Features: 7  |  '
         f'Districts: Lucknow · Varanasi · Gorakhpur',
         ha='center', color='#8b949e', fontsize=9)

out_path = r'c:\Users\HP\Desktop\model\model_accuracy_report.png'
plt.savefig(out_path, dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.close()
print("\n[DONE] Judge-ready accuracy report saved -> " + out_path)
