#!/usr/bin/env python3
"""
Hybrid Sales Forecasting CLI Worker.

Reads JSON daily time-series from stdin and writes JSON forecasts (daily + monthly)
to stdout. Supports optional `autogluon.timeseries` and `statsmodels` when installed,
with a built-in pure-Python Damped Holt + Day-of-Week Seasonal engine so CLI
execution always works reliably even without external pip packages.
"""

from __future__ import annotations

import calendar
import datetime as dt
import importlib.util
import json
import math
import statistics
import sys
import time
from typing import Any


WEEKDAY_NAMES_ID = [
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
    "Minggu",
]


def _has_module(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except ModuleNotFoundError:
        return False


def detect_available_engines() -> dict[str, bool]:
    return {
        "builtin": True,
        "statsmodels": _has_module("statsmodels") and _has_module("numpy"),
        "autogluon": _has_module("autogluon")
        and _has_module("autogluon.timeseries")
        and _has_module("pandas"),
    }


def add_months_ym(year: int, month: int, offset: int) -> tuple[int, int]:
    total = year * 12 + (month - 1) + offset
    return total // 12, (total % 12) + 1


def month_last_day(year: int, month: int) -> dt.date:
    last_dom = calendar.monthrange(year, month)[1]
    return dt.date(year, month, last_dom)


def parse_iso_date(date_str: str) -> dt.date:
    return dt.date.fromisoformat(date_str[:10])


def build_dense_daily_series(
    raw_series: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not raw_series:
        return []

    by_date: dict[str, dict[str, float]] = {}
    for row in raw_series:
        d_str = str(row.get("date", ""))[:10]
        if len(d_str) != 10:
            continue
        try:
            parse_iso_date(d_str)
        except ValueError:
            continue

        entry = by_date.setdefault(
            d_str,
            {"netSalesIdr": 0.0, "qtyCarton": 0.0, "invoiceCount": 0.0},
        )
        entry["netSalesIdr"] += float(row.get("netSalesIdr", 0.0) or 0.0)
        entry["qtyCarton"] += float(row.get("qtyCarton", 0.0) or 0.0)
        entry["invoiceCount"] += float(row.get("invoiceCount", 0.0) or 0.0)

    if not by_date:
        return []

    sorted_dates = sorted(by_date.keys())
    start_date = parse_iso_date(sorted_dates[0])
    end_date = parse_iso_date(sorted_dates[-1])
    total_days = (end_date - start_date).days + 1

    dense: list[dict[str, Any]] = []
    for offset in range(total_days):
        cur = start_date + dt.timedelta(days=offset)
        cur_iso = cur.isoformat()
        vals = by_date.get(cur_iso)
        dense.append(
            {
                "date": cur_iso,
                "weekday": cur.weekday(),
                "netSalesIdr": vals["netSalesIdr"] if vals else 0.0,
                "qtyCarton": vals["qtyCarton"] if vals else 0.0,
                "invoiceCount": vals["invoiceCount"] if vals else 0.0,
            }
        )
    return dense


def compute_weekday_indices(values: list[float], weekdays: list[int]) -> list[float]:
    overall_mean = sum(values) / max(1, len(values))
    if overall_mean <= 0 or len(values) < 7:
        return [1.0] * 7

    buckets: list[list[float]] = [[] for _ in range(7)]
    for val, wd in zip(values, weekdays):
        buckets[wd].append(max(0.0, val))

    indices: list[float] = []
    # Shrinkage toward 1.0 prevents small-sample weekdays from exaggerating spikes
    shrink_weight = 2.0
    for wd in range(7):
        bucket = buckets[wd]
        if not bucket:
            indices.append(1.0)
            continue
        wd_mean = sum(bucket) / len(bucket)
        raw_ratio = wd_mean / overall_mean
        shrunk = (len(bucket) * raw_ratio + shrink_weight * 1.0) / (
            len(bucket) + shrink_weight
        )
        indices.append(max(0.25, min(2.2, shrunk)))

    avg_idx = sum(indices) / 7.0
    if avg_idx > 0:
        indices = [x / avg_idx for x in indices]
    return indices


def forecast_builtin_damped_seasonal(
    values: list[float],
    weekdays: list[int],
    future_weekdays: list[int],
) -> tuple[list[float], float, list[float]]:
    """
    Pure-Python Damped Holt Exponential Smoothing + Weekday Seasonality.
    Returns (point_forecasts, daily_sigma, weekday_indices).
    """
    n = len(values)
    if n == 0:
        return [0.0] * len(future_weekdays), 0.0, [1.0] * 7

    wd_indices = compute_weekday_indices(values, weekdays)
    deseason = [
        max(0.0, v) / wd_indices[wd] if wd_indices[wd] > 0 else max(0.0, v)
        for v, wd in zip(values, weekdays)
    ]

    if n == 1:
        base = deseason[0]
        preds = [max(0.0, base * wd_indices[wd]) for wd in future_weekdays]
        return preds, max(1.0, base * 0.18), wd_indices

    alpha = 0.24
    beta = 0.06
    phi = 0.90  # Damping factor prevents runaway extrapolation

    init_window = min(7, n)
    level = sum(deseason[:init_window]) / init_window
    if n >= 14:
        first_week = sum(deseason[:7]) / 7.0
        second_week = sum(deseason[7:14]) / 7.0
        trend = (second_week - first_week) / 7.0
    else:
        trend = (deseason[-1] - deseason[0]) / max(1, n - 1)
    trend *= 0.5  # Conservative initial slope

    # Guard against extreme single-day outliers inflating trend
    med = statistics.median(deseason)
    cap_delta = max(med * 0.25, 1.0)
    trend = max(-cap_delta, min(cap_delta, trend))

    residuals: list[float] = []
    for t in range(n):
        fitted_deseason = max(0.0, level + phi * trend)
        fitted_actual = fitted_deseason * wd_indices[weekdays[t]]
        residuals.append(values[t] - fitted_actual)

        obs = deseason[t]
        prev_level = level
        level = alpha * obs + (1.0 - alpha) * (level + phi * trend)
        trend = beta * (level - prev_level) + (1.0 - beta) * phi * trend
        trend = max(-cap_delta, min(cap_delta, trend))

    # Recent residuals weighted slightly more, skip noisy first 3 warmup days when n > 10
    eval_res = residuals[3:] if n > 10 else residuals
    sq_err = sum(r * r for r in eval_res) / max(1, len(eval_res))
    daily_sigma = math.sqrt(sq_err)
    mean_level = sum(values) / max(1, n)
    if mean_level > 0:
        daily_sigma = max(mean_level * 0.10, min(mean_level * 0.65, daily_sigma))

    forecasts: list[float] = []
    phi_cum = 0.0
    for step_idx, wd in enumerate(future_weekdays, start=1):
        phi_cum += phi ** step_idx
        deseason_pred = max(0.0, level + phi_cum * trend)
        forecasts.append(max(0.0, deseason_pred * wd_indices[wd]))

    return forecasts, daily_sigma, wd_indices


def try_statsmodels_forecast(
    values: list[float],
    future_days: int,
) -> tuple[list[float], float] | None:
    try:
        import numpy as np
        from statsmodels.tsa.holtwinters import ExponentialSmoothing

        arr = np.maximum(np.array(values, dtype=float), 0.0)
        use_seasonal = len(arr) >= 14 and float(np.std(arr)) > 0
        model = ExponentialSmoothing(
            arr,
            trend="add",
            damped_trend=True,
            seasonal="add" if use_seasonal else None,
            seasonal_periods=7 if use_seasonal else None,
            initialization_method="estimated",
        )
        fitted = model.fit(optimized=True)
        fc = np.maximum(fitted.forecast(future_days), 0.0)
        resid = arr - np.maximum(fitted.fittedvalues, 0.0)
        sigma = float(np.sqrt(np.mean(np.square(resid)))) if len(resid) > 0 else 0.0
        mean_val = float(np.mean(arr)) if len(arr) > 0 else 0.0
        if mean_val > 0:
            sigma = max(mean_val * 0.10, min(mean_val * 0.65, sigma))
        return [float(x) for x in fc], sigma
    except Exception:
        return None


def try_autogluon_forecast(
    dense_series: list[dict[str, Any]],
    future_days: int,
) -> tuple[list[float], list[float], list[float]] | None:
    try:
        import pandas as pd
        from autogluon.timeseries import TimeSeriesDataFrame, TimeSeriesPredictor

        df = pd.DataFrame(
            {
                "item_id": ["sales"] * len(dense_series),
                "timestamp": pd.to_datetime([row["date"] for row in dense_series]),
                "target": [max(0.0, float(row["netSalesIdr"])) for row in dense_series],
            }
        )
        ts_df = TimeSeriesDataFrame.from_data_frame(
            df, id_column="item_id", timestamp_column="timestamp"
        )
        predictor = TimeSeriesPredictor(
            prediction_length=future_days,
            freq="D",
            quantile_levels=[0.1, 0.5, 0.9],
            verbosity=0,
        )
        predictor.fit(ts_df, presets="fast_training", time_limit=15)
        preds = predictor.predict(ts_df)
        item_preds = preds.loc["sales"]
        point = [max(0.0, float(v)) for v in item_preds["mean"].tolist()]
        low = [max(0.0, float(v)) for v in item_preds["0.1"].tolist()]
        high = [max(0.0, float(v)) for v in item_preds["0.9"].tolist()]
        return point, low, high
    except Exception:
        return None


def run_forecast_pipeline(payload: dict[str, Any]) -> dict[str, Any]:
    started_at = time.perf_counter()
    raw_series = payload.get("dailySeries") or []
    horizon_months = int(payload.get("horizonMonths") or 2)
    horizon_months = max(1, min(3, horizon_months))
    preferred_engine = str(payload.get("preferredEngine") or "auto").strip().lower()

    available_engines = detect_available_engines()
    dense = build_dense_daily_series(raw_series)

    if not dense:
        return {
            "ok": True,
            "engineUsed": "python-seasonal-cli",
            "engineLabel": "Python CLI · Kosong",
            "availableEngines": available_engines,
            "executionMs": round((time.perf_counter() - started_at) * 1000, 1),
            "sampleDays": 0,
            "diagnostics": None,
            "dailyPoints": [],
            "projectedMonths": [],
        }

    last_actual_date = parse_iso_date(dense[-1]["date"])
    target_end_ym = add_months_ym(last_actual_date.year, last_actual_date.month, horizon_months)
    horizon_end_date = month_last_day(target_end_ym[0], target_end_ym[1])
    future_days = max(1, (horizon_end_date - last_actual_date).days)

    future_dates = [
        last_actual_date + dt.timedelta(days=offset)
        for offset in range(1, future_days + 1)
    ]
    future_weekdays = [d.weekday() for d in future_dates]

    net_values = [float(r["netSalesIdr"]) for r in dense]
    carton_values = [float(r["qtyCarton"]) for r in dense]
    weekdays = [int(r["weekday"]) for r in dense]

    wd_indices = compute_weekday_indices(net_values, weekdays)

    engine_used = "python-seasonal-cli"
    engine_label = "Python CLI · Damped Holt + Musiman Mingguan"
    net_forecasts: list[float] | None = None
    low_forecasts: list[float] | None = None
    high_forecasts: list[float] | None = None
    daily_sigma = 0.0

    # 1. Optional AutoGluon TimeSeries when explicitly installed & requested/auto
    if (
        preferred_engine in ("autogluon", "auto")
        and available_engines["autogluon"]
        and len(dense) >= 21
        and preferred_engine == "autogluon"
    ):
        ag_res = try_autogluon_forecast(dense, future_days)
        if ag_res is not None:
            net_forecasts, low_forecasts, high_forecasts = ag_res
            engine_used = "autogluon-timeseries"
            engine_label = "Python CLI · AutoGluon TimeSeries"

    # 2. Optional Statsmodels Holt-Winters when installed
    if (
        net_forecasts is None
        and preferred_engine in ("auto", "statsmodels")
        and available_engines["statsmodels"]
        and len(dense) >= 14
    ):
        sm_res = try_statsmodels_forecast(net_values, future_days)
        if sm_res is not None:
            net_forecasts, daily_sigma = sm_res
            engine_used = "python-statsmodels"
            engine_label = "Python CLI · Statsmodels Holt-Winters"

    # 3. Built-in pure-Python Damped Holt + Weekday Seasonality
    if net_forecasts is None:
        net_forecasts, daily_sigma, wd_indices = forecast_builtin_damped_seasonal(
            net_values, weekdays, future_weekdays
        )

    carton_forecasts, _, _ = forecast_builtin_damped_seasonal(
        carton_values, weekdays, future_weekdays
    )

    if low_forecasts is None or high_forecasts is None:
        z_80 = 1.2816
        low_forecasts = []
        high_forecasts = []
        for idx, pred in enumerate(net_forecasts):
            # Uncertainty widens gently with horizon
            step_scale = 1.0 + 0.35 * math.sqrt(idx / 30.0)
            margin = z_80 * daily_sigma * step_scale
            low_forecasts.append(max(0.0, pred - margin))
            high_forecasts.append(pred + margin)

    # Diagnostics: weekday peak/low + empirical fit error on positive days
    peak_wd_idx = max(range(7), key=lambda i: wd_indices[i])
    low_wd_idx = min(range(7), key=lambda i: wd_indices[i])

    # Quick baseline fit error using builtin deseasonalized average ratio on positive days
    positive_vals = [v for v in net_values if v > 0]
    mean_pos = sum(positive_vals) / max(1, len(positive_vals))
    mape_pct: float | None = None
    if len(positive_vals) >= 7 and mean_pos > 0:
        abs_pct_errors = []
        for val, wd in zip(net_values, weekdays):
            if val > 0:
                expected = mean_pos * wd_indices[wd]
                abs_pct_errors.append(abs(val - expected) / val * 100.0)
        if abs_pct_errors:
            mape_pct = round(min(99.0, sum(abs_pct_errors) / len(abs_pct_errors)), 1)

    daily_points: list[dict[str, Any]] = []
    for idx, row in enumerate(dense):
        is_anchor = idx == len(dense) - 1
        actual_net = round(float(row["netSalesIdr"]))
        daily_points.append(
            {
                "date": row["date"],
                "isForecast": False,
                "actualNetSalesIdr": actual_net,
                "forecastNetSalesIdr": actual_net if is_anchor else None,
                "forecastRange": [actual_net, actual_net] if is_anchor else None,
                "lowIdr": actual_net if is_anchor else None,
                "highIdr": actual_net if is_anchor else None,
            }
        )

    for d_obj, pred, lo, hi in zip(future_dates, net_forecasts, low_forecasts, high_forecasts):
        p_round = max(0, round(pred))
        l_round = max(0, round(lo))
        h_round = max(p_round, round(hi))
        daily_points.append(
            {
                "date": d_obj.isoformat(),
                "isForecast": True,
                "actualNetSalesIdr": None,
                "forecastNetSalesIdr": p_round,
                "forecastRange": [l_round, h_round],
                "lowIdr": l_round,
                "highIdr": h_round,
            }
        )

    # Aggregate daily forecasts into the requested future calendar months
    future_month_keys: list[str] = []
    for step in range(1, horizon_months + 1):
        y, m = add_months_ym(last_actual_date.year, last_actual_date.month, step)
        future_month_keys.append(f"{y:04d}-{m:02d}")

    month_buckets: dict[str, dict[str, Any]] = {
        mk: {"net": 0.0, "cartons": 0.0, "days": 0} for mk in future_month_keys
    }
    for d_obj, pred_net, pred_carton in zip(future_dates, net_forecasts, carton_forecasts):
        mk = d_obj.strftime("%Y-%m")
        if mk in month_buckets:
            month_buckets[mk]["net"] += pred_net
            month_buckets[mk]["cartons"] += pred_carton
            month_buckets[mk]["days"] += 1

    # Also compute average monthly revenue from actuals to clamp monthly CI safely
    monthly_actuals: dict[str, float] = {}
    for row in dense:
        mk = row["date"][:7]
        monthly_actuals[mk] = monthly_actuals.get(mk, 0.0) + float(row["netSalesIdr"])
    avg_monthly_actual = (
        sum(monthly_actuals.values()) / max(1, len(monthly_actuals))
        if monthly_actuals
        else 0.0
    )

    projected_months: list[dict[str, Any]] = []
    for step_idx, mk in enumerate(future_month_keys, start=1):
        bucket = month_buckets[mk]
        proj_net = max(0, round(bucket["net"]))
        proj_cartons = max(0, round(bucket["cartons"]))

        # Monthly std scales with sqrt(days_in_month), bounded cleanly between 7% and 26%
        days_cnt = max(1, bucket["days"])
        raw_margin = 1.2816 * daily_sigma * math.sqrt(days_cnt) * (1.0 + 0.12 * (step_idx - 1))
        min_margin = round(proj_net * 0.07)
        max_margin = round(max(proj_net, avg_monthly_actual) * 0.26)
        margin = max(min_margin, min(max_margin, round(raw_margin))) if max_margin > 0 else min_margin

        projected_months.append(
            {
                "monthKey": mk,
                "projectedNetSalesIdr": proj_net,
                "lowIdr": max(0, proj_net - margin),
                "highIdr": proj_net + margin,
                "projectedCartons": proj_cartons,
            }
        )

    elapsed_ms = round((time.perf_counter() - started_at) * 1000, 1)

    return {
        "ok": True,
        "engineUsed": engine_used,
        "engineLabel": engine_label,
        "availableEngines": available_engines,
        "executionMs": elapsed_ms,
        "sampleDays": len(dense),
        "diagnostics": {
            "mapePct": mape_pct,
            "peakWeekday": WEEKDAY_NAMES_ID[peak_wd_idx],
            "peakDeltaPct": round((wd_indices[peak_wd_idx] - 1.0) * 100.0, 1),
            "lowWeekday": WEEKDAY_NAMES_ID[low_wd_idx],
            "lowDeltaPct": round((wd_indices[low_wd_idx] - 1.0) * 100.0, 1),
        },
        "dailyPoints": daily_points,
        "projectedMonths": projected_months,
    }


def main() -> int:
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            sys.stdout.write(json.dumps({"ok": False, "error": "Input JSON kosong"}))
            return 1
        payload = json.loads(raw_input)
        result = run_forecast_pipeline(payload)
        sys.stdout.write(json.dumps(result))
        return 0
    except Exception as exc:
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
