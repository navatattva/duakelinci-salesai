import datetime as dt
import json
import subprocess
import sys
import unittest
from pathlib import Path

from scripts.forecast_worker import run_forecast_pipeline


class ForecastWorkerTest(unittest.TestCase):
    def test_empty_series_returns_empty_result(self) -> None:
        res = run_forecast_pipeline({"dailySeries": [], "horizonMonths": 2})
        self.assertTrue(res["ok"])
        self.assertEqual(res["sampleDays"], 0)
        self.assertEqual(res["projectedMonths"], [])
        self.assertEqual(res["dailyPoints"], [])

    def test_weekly_seasonality_and_monthly_rollup(self) -> None:
        start = dt.date(2026, 9, 1)
        series = []
        for i in range(61):
            cur = start + dt.timedelta(days=i)
            # Friday (4) high, Sunday (6) low, mild upward trend
            wd = cur.weekday()
            base = 25_000_000 + i * 80_000
            factor = 1.35 if wd == 4 else (0.55 if wd == 6 else 1.0)
            series.append(
                {
                    "date": cur.isoformat(),
                    "netSalesIdr": round(base * factor),
                    "qtyCarton": round(120 * factor),
                    "invoiceCount": 12,
                }
            )

        res = run_forecast_pipeline({"dailySeries": series, "horizonMonths": 2})
        self.assertTrue(res["ok"])
        self.assertEqual(res["sampleDays"], 61)
        self.assertEqual(len(res["projectedMonths"]), 2)
        self.assertEqual(res["projectedMonths"][0]["monthKey"], "2026-11")
        self.assertEqual(res["projectedMonths"][1]["monthKey"], "2026-12")
        self.assertGreater(res["projectedMonths"][0]["projectedNetSalesIdr"], 0)
        self.assertLessEqual(
            res["projectedMonths"][0]["lowIdr"],
            res["projectedMonths"][0]["projectedNetSalesIdr"],
        )
        self.assertGreaterEqual(
            res["projectedMonths"][0]["highIdr"],
            res["projectedMonths"][0]["projectedNetSalesIdr"],
        )
        self.assertEqual(res["diagnostics"]["peakWeekday"], "Jumat")
        self.assertEqual(res["diagnostics"]["lowWeekday"], "Minggu")

    def test_cli_stdin_stdout_contract(self) -> None:
        script = Path(__file__).resolve().parent / "forecast_worker.py"
        payload = {
            "dailySeries": [
                {"date": "2026-10-01", "netSalesIdr": 1200000, "qtyCarton": 10},
                {"date": "2026-10-15", "netSalesIdr": 1800000, "qtyCarton": 14},
            ],
            "horizonMonths": 1,
        }
        proc = subprocess.run(
            [sys.executable, str(script)],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            check=True,
        )
        out = json.loads(proc.stdout)
        self.assertTrue(out["ok"])
        self.assertEqual(len(out["projectedMonths"]), 1)
        self.assertEqual(out["projectedMonths"][0]["monthKey"], "2026-11")


if __name__ == "__main__":
    unittest.main()
