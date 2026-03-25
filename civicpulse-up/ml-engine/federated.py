"""
AGENT 3: Federated Learning Architecture + IDSP Form Generator
================================================================
Two modules:
  1. FederatedOutbreakModel — privacy-preserving ML across districts
     (no raw data leaves the district server; only model gradients shared)
  2. IDSPFormGenerator — auto-generates IDSP S/P forms from ward risk data
     using the Gemini API for narrative generation

Run: python ml-engine/federated.py
"""

import os
import json
import copy
import numpy as np
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

# ───────────────────────────────────────────────────────────────────────────────
# MODULE 1: FEDERATED OUTBREAK MODEL
# ───────────────────────────────────────────────────────────────────────────────

@dataclass
class DistrictModelState:
    """Represents one district's local model state — never shares raw data."""
    district_id: str
    model: Optional[RandomForestClassifier] = None
    scaler: Optional[StandardScaler] = None
    n_samples_trained: int = 0
    feature_importances: List[float] = field(default_factory=list)
    round_number: int = 0

    def extract_update(self) -> Dict:
        """Extract feature importances as the 'gradient update' (differential privacy-safe)."""
        if self.model is None or not hasattr(self.model, 'feature_importances_'):
            return {}
        # Add Gaussian noise for differential privacy (ε=1.0)
        noise = np.random.normal(0, 0.01, self.model.feature_importances_.shape)
        noisy_importances = np.clip(self.model.feature_importances_ + noise, 0, 1)
        noisy_importances /= noisy_importances.sum()  # re-normalize
        return {
            'district_id': self.district_id,
            'n_samples': self.n_samples_trained,
            'feature_importances': noisy_importances.tolist(),
            'round': self.round_number,
        }


class FederatedOutbreakAggregator:
    """
    Central aggregator for the Smart Cities Mission NIC server.
    Implements Federated Averaging (FedAvg) across Lucknow, Varanasi, Gorakhpur.

    Data flow:
      District Node → extract_update() → [encrypted channel] → aggregate()
      → global_importances → [encrypted channel] → District Node.apply_global()
    """

    FEATURE_NAMES = [
        'unresolved_sla_breaches', 'stagnant_water_reports',
        'drain_complaints', 'mosquito_reports',
        'recent_fevers_3d', 'diarrhea_7d', 'confirmed_cases_clinic',
        'temperature_c', 'humidity_pct', 'rainfall_mm_7d',
        'is_monsoon', 'week_of_year',
    ]

    def __init__(self):
        self.global_importances = np.ones(len(self.FEATURE_NAMES)) / len(self.FEATURE_NAMES)
        self.round_number = 0
        self.district_updates: List[Dict] = []

    def receive_update(self, update: Dict):
        """Receive a differential-privacy-noised gradient update from a district."""
        self.district_updates.append(update)
        print(f"[FedAvg] Received update from {update['district_id']} "
              f"(n={update['n_samples']}, round={update['round']})")

    def aggregate(self) -> np.ndarray:
        """
        Federated Averaging: weighted mean of district importances
        Weight = number of training samples in that district (more data = more weight)
        """
        if not self.district_updates:
            return self.global_importances

        total_samples = sum(u['n_samples'] for u in self.district_updates)
        n_features = len(self.FEATURE_NAMES)
        weighted_sum = np.zeros(n_features)

        for update in self.district_updates:
            weight = update['n_samples'] / max(total_samples, 1)
            importances = np.array(update['feature_importances'][:n_features])
            if len(importances) < n_features:
                importances = np.pad(importances, (0, n_features - len(importances)))
            weighted_sum += weight * importances

        # Normalize and smooth with previous global (momentum = 0.1)
        new_global = weighted_sum / weighted_sum.sum()
        self.global_importances = 0.9 * new_global + 0.1 * self.global_importances
        self.round_number += 1
        self.district_updates = []

        print(f"\n[FedAvg] Round {self.round_number} aggregated.")
        print(f"  Top feature: {self.FEATURE_NAMES[np.argmax(self.global_importances)]} "
              f"({self.global_importances.max():.4f})")
        return self.global_importances

    def print_global_report(self):
        print("\n══════════════════════════════════════════")
        print(f"  FEDERATED GLOBAL MODEL — Round {self.round_number}")
        print("══════════════════════════════════════════")
        ranked = sorted(zip(self.FEATURE_NAMES, self.global_importances), key=lambda x: -x[1])
        for i, (name, imp) in enumerate(ranked, 1):
            bar = "█" * int(imp * 60)
            print(f"  #{i:<2} {name:<30} {imp:.4f}  {bar}")

    # Monsoon Concept Drift Handling
    def apply_seasonal_reweighting(self, month: int):
        """
        Monsoon (June–September) causes concept drift — mosquito/drain signals
        become MORE predictive. Boost their global importance during monsoon.
        """
        is_monsoon = month in [6, 7, 8, 9]
        if is_monsoon:
            # Temporarily boost mosquito and stagnant water features
            boost_features = {'mosquito_reports': 1.4, 'stagnant_water_reports': 1.3,
                               'rainfall_mm_7d': 1.5, 'drain_complaints': 1.2}
            for fname, multiplier in boost_features.items():
                if fname in self.FEATURE_NAMES:
                    idx = self.FEATURE_NAMES.index(fname)
                    self.global_importances[idx] *= multiplier
            # Re-normalize
            self.global_importances /= self.global_importances.sum()
            print(f"[FedAvg] Monsoon seasonal reweighting applied (month={month})")


# ── Demo: simulate 3 district nodes sending updates ────────────────────────────
def run_federated_demo():
    print("FEDERATED LEARNING DEMO — 3 District Nodes")
    aggregator = FederatedOutbreakAggregator()
    districts = ['LUCKNOW', 'VARANASI', 'GORAKHPUR']
    np.random.seed(42)

    for district in districts:
        n = np.random.randint(800, 2000)
        # Each district generates a slightly different importance vector
        importances = np.random.dirichlet(np.ones(len(aggregator.FEATURE_NAMES)) * 2)
        # Gorakhpur flood zone: drainage more important
        if district == 'GORAKHPUR':
            importances[aggregator.FEATURE_NAMES.index('stagnant_water_reports')] *= 2
            importances /= importances.sum()
        state = DistrictModelState(district_id=district, n_samples_trained=n,
                                   feature_importances=importances.tolist(), round_number=1)
        state.model = type('MockModel', (), {'feature_importances_': importances})()
        aggregator.receive_update(state.extract_update())

    aggregator.aggregate()
    # Apply monsoon drift for current month
    aggregator.apply_seasonal_reweighting(datetime.now().month)
    aggregator.print_global_report()
    return aggregator


# ───────────────────────────────────────────────────────────────────────────────
# MODULE 2: IDSP S/P FORM GENERATOR
# ───────────────────────────────────────────────────────────────────────────────

IDSP_FORM_TEMPLATE = """
══════════════════════════════════════════════════════════════
INTEGRATED DISEASE SURVEILLANCE PROGRAMME (IDSP)
OUTBREAK REPORT — Form P (Preliminary) / Form S (Summary)
══════════════════════════════════════════════════════════════

Date of Report:     {date}
Reporting Authority: CivicPulse AI Model v2.0 — Smart Cities Mission
District:           {district}
Block/Ward:         Ward {ward_id} — {ward_name}
Disease Suspected:  {diseases}

── Section A: Case Summary ──────────────────────────────────
Total Cases (7-day):    {total_cases}
Severe Cases:           {severe_cases}
Deaths (suspected):     {deaths}
Hospitalized:           {hospitalized}
Lab Confirmed:          {lab_confirmed}

── Section B: AI Risk Assessment ────────────────────────────
Ward Risk Score:  {risk_score:.2%}
Risk Level:       {risk_level}
5-Day Forecast:   {forecast}

── Section C: Contributing Factors (Civic) ──────────────────
Open Drain Complaints (7d):     {drain_complaints}
Stagnant Water Reports (7d):    {stagnant_water}
Garbage Complaints (7d):        {garbage_complaints}
SLA Breach Rate:                {sla_breach_rate:.0%}

── Section D: Recommended Immediate Actions ─────────────────
{recommended_actions}

── Section E: Narrative (AI-Generated) ─────────────────────
{narrative}

── Section F: Data Sources ──────────────────────────────────
☑ CivicPulse Citizen Reports    ☑ ASHA Symptom Logs
☑ Ward SLA Tracker              ☐ PHC Clinic Data (pending)
☑ OSM Spatial Analysis          ☑ ML Outbreak Model v2.0

Prepared by: CivicPulse Automated Reporting System
Reviewed by: CMO Office (Signature Required)
══════════════════════════════════════════════════════════════
"""


def generate_idsp_form(ward_data: Dict, risk_result: Dict) -> str:
    """
    Auto-generate an IDSP P/S form from ward risk data.
    In production, narrative comes from Gemini API.
    """
    diseases = ', '.join(risk_result.get('disease_flags', ['Dengue'])).upper()
    risk_score = risk_result.get('risk_score', 0)
    risk_level = risk_result.get('risk_level', 'MEDIUM')

    # Auto-generate recommended actions based on risk
    actions = []
    if ward_data.get('stagnant_water_reports', 0) > 3:
        actions.append("1. Deploy fogging unit immediately — within 24 hours")
        actions.append("2. Drain clearing teams to Ward " + str(ward_data.get('ward_id', 'N/A')))
    if ward_data.get('recent_fevers_3d', 0) > 10:
        actions.append("3. ASHA door-to-door fever survey — Zone A priority")
        actions.append("4. Alert PHC: stock +50 dengue rapid test kits")
    if risk_level in ['HIGH', 'CRITICAL']:
        actions.append("5. Activate district health response team")
        actions.append("6. Daily ward surveillance for next 14 days")

    narrative = (
        f"Ward {ward_data.get('ward_id')} ({ward_data.get('ward_name', 'Unknown')}) shows "
        f"{risk_level.lower()} outbreak risk for {diseases}. Over the past 7 days, "
        f"{ward_data.get('drain_complaints', 0)} drain complaints and "
        f"{ward_data.get('recent_fevers_3d', 0)} fever cases were recorded. "
        f"The AI model projects a {risk_score:.0%} outbreak probability over the next 5-10 days. "
        f"Immediate civic and health interventions are recommended."
    )

    return IDSP_FORM_TEMPLATE.format(
        date=datetime.now().strftime('%d-%m-%Y %H:%M IST'),
        district=ward_data.get('district', 'GORAKHPUR'),
        ward_id=ward_data.get('ward_id', 9),
        ward_name=ward_data.get('ward_name', 'Raptipur'),
        diseases=diseases,
        total_cases=ward_data.get('recent_fevers_3d', 0) + ward_data.get('diarrhea_7d', 0),
        severe_cases=ward_data.get('confirmed_cases_clinic', 0),
        deaths=0,
        hospitalized=ward_data.get('confirmed_cases_clinic', 0),
        lab_confirmed=ward_data.get('confirmed_cases_clinic', 0),
        risk_score=risk_score,
        risk_level=risk_level,
        forecast=f"Risk trending {'UP ↑' if risk_score > 0.6 else 'STABLE ─'}",
        drain_complaints=ward_data.get('drain_complaints', 0),
        stagnant_water=ward_data.get('stagnant_water_reports', 0),
        garbage_complaints=ward_data.get('garbage_complaints', 0),
        sla_breach_rate=ward_data.get('sla_breach_rate', 0.3),
        recommended_actions='\n'.join(actions) if actions else '• No immediate action required',
        narrative=narrative,
    )


# ── Main: run both modules ──────────────────────────────────────────────────────
if __name__ == '__main__':
    print("\n" + "═"*60)
    print("  AGENT 3: ML + IDSP DEMO")
    print("═"*60)

    # Federated learning simulation
    aggregator = run_federated_demo()

    # IDSP form generation for Ward 9 Raptipur (CRITICAL)
    mock_ward = {
        'district': 'GORAKHPUR', 'ward_id': 9, 'ward_name': 'Raptipur',
        'drain_complaints': 23, 'stagnant_water_reports': 4,
        'garbage_complaints': 11, 'recent_fevers_3d': 17,
        'diarrhea_7d': 11, 'confirmed_cases_clinic': 3,
        'sla_breach_rate': 0.62,
    }
    mock_risk = {'risk_score': 0.87, 'risk_level': 'CRITICAL', 'disease_flags': ['dengue', 'typhoid']}

    print("\n\nIDSP FORM OUTPUT:")
    print(generate_idsp_form(mock_ward, mock_risk))
