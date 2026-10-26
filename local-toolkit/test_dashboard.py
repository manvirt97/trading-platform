import sys
from datetime import datetime, timedelta, timezone
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import get_demo, market_data, validate_csv
from analytics import analyze, backtest, risk_plan

class TestDashboard(unittest.TestCase):
    def test_archive_labels_and_missing_ohlcv(self):
        bars,meta=market_data('AAPL','demo')
        self.assertGreaterEqual(len(bars),36)
        self.assertEqual(meta['data_quality'],'close-only')
        self.assertIn('NOT LIVE',meta['freshness'])
        self.assertNotIn('open',bars[-1])
        result=analyze(bars,'AAPL')
        self.assertIsNone(result['indicators']['atr14'])
        with self.assertRaisesRegex(ValueError,'closes-only'):backtest(bars)

    def test_tsla_full_ohlcv_and_backtest(self):
        bars,meta=market_data('TSLA','demo')
        self.assertGreater(len(bars),40)
        self.assertIn('open',bars[-1])
        result=analyze(bars,'TSLA')
        self.assertEqual(result['data_quality'],'complete-ohlcv')
        self.assertTrue(0<=result['score']<=100)
        self.assertTrue(backtest(bars)['avoids_lookahead'])

    def test_backtest_last_bar_does_not_make_its_own_signal(self):
        bars,_=market_data('TSLA','demo')
        before=backtest(bars)
        copy=[dict(b) for b in bars]
        copy[-1]['close']*=0.1
        after=backtest(copy)
        self.assertEqual(before['trades'],after['trades'])
        self.assertEqual([t['time'] for t in before['last_trades']],[t['time'] for t in after['last_trades']])

    def test_risk_is_cash_and_loss_constrained(self):
        p=risk_plan(5000,1,366,359,380)
        self.assertEqual(p['shares'],7)
        self.assertLessEqual(p['estimated_stop_loss'],50)
        self.assertLessEqual(p['notional'],5000)
        with self.assertRaises(ValueError):risk_plan(5000,1,100,105,120)
        with self.assertRaises(ValueError):risk_plan(5000,100,100,90,120)
        with self.assertRaises(ValueError):risk_plan(5000,1,float('nan'),90,120)

    def test_csv_requires_valid_ohlc_and_offset(self):
        rows=['timestamp,open,high,low,close,volume']
        for i in range(36):
            t=(datetime(2026,9,1,20,tzinfo=timezone.utc)+timedelta(days=i)).isoformat()
            rows.append(f'{t},100,104,99,103,100')
        self.assertEqual(len(validate_csv(('\n'.join(rows)).encode(),'AAA','1day')),36)
        bad='timestamp,open,high,low,close,volume\n2026-01-01,100,99,101,100,100\n'
        with self.assertRaises(ValueError):validate_csv(bad.encode(),'AAA','1day')

    def test_provider_key_not_required_for_demo(self):
        bars,meta=get_demo('TSLA','5min')
        self.assertGreater(len(bars),4000)
        self.assertIn('ARCHIVED',meta['freshness'])
        with self.assertRaises(ValueError):market_data('../../etc/passwd','demo')

if __name__=='__main__':unittest.main()
