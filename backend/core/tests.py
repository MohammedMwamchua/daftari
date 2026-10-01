from datetime import timedelta

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from core import services as svc
from core.models import Attendance, ExpenseCategory, Settings, Worker


class RulesTest(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('m', password='x')
        self.client.force_authenticate(self.user)
        Settings.load()
        ExpenseCategory.objects.create(key='gesi', name_sw='Gesi', name_en='Gas')
        self.today = svc.today()
        long_ago = self.today - timedelta(days=60)
        mk = lambda name, role, pay, rate, off: Worker.objects.create(
            name=name, role=role, pay_type=pay, rate=rate, day_off=off, joined_on=long_ago)
        # day off is set to a weekday that is never "today" so marking is required
        off = (svc.js_dow(self.today) + 3) % 7
        self.cashier = mk('Rehema', 'keshia', 'monthly', 300000, off)
        self.cook = mk('Juma', 'mpishi', 'daily', 10000, off)
        self.d = self.today.isoformat()

    def sales(self, banda_cash=100000, cashier=None):
        r = self.client.put(f'/api/days/{self.d}/sales/', {
            'banda': {'cash': banda_cash, 'mobile': 50000, 'cashier_id': (cashier or self.cashier).id},
            'mgahawa': {'cash': 200000, 'mobile': 0, 'cashier_id': self.cashier.id}}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def mark_all(self):
        r = self.client.put(f'/api/days/{self.d}/attendance/', {str(self.cashier.id): 'present', str(self.cook.id): 'late'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_expected_cash_and_difference(self):
        self.sales()
        self.client.post(f'/api/days/{self.d}/deliveries/', {'worker_id': self.cook.id, 'section': 'banda', 'amount': 12000, 'method': 'cash'}, format='json')
        self.client.post('/api/expenses/', {'category': 'gesi', 'amount': 25000, 'reason': 'gas', 'paid_from': 'droo', 'section': 'banda'}, format='json')
        r = self.client.put(f'/api/days/{self.d}/cash-count/', {'banda': 50000 + 63000 - 2000, 'mgahawa': 80000 + 200000}, format='json')
        b = r.data['sections']['banda']
        self.assertEqual(b['expected'], 100000 - 12000 - 25000)
        self.assertEqual(b['difference'], 61000 - 63000)  # counted 111000 - float 50000 - expected 63000 = -2000
        self.assertEqual(r.data['sections']['mgahawa']['difference'], 0)

    def test_close_writes_shortage_and_locks(self):
        self.sales()
        self.client.put(f'/api/days/{self.d}/cash-count/', {'banda': 50000 + 98000, 'mgahawa': 280000}, format='json')
        self.assertEqual(self.client.post(f'/api/days/{self.d}/close/').status_code, 409)  # attendance missing
        self.mark_all()
        r = self.client.post(f'/api/days/{self.d}/close/')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([(s['worker_id'], s['amount']) for s in r.data['shortages']], [(self.cashier.id, 2000)])
        self.assertEqual(self.client.put(f'/api/days/{self.d}/sales/', {'banda': {'cash': 1}}, format='json').status_code, 409)
        acct = self.client.get(f'/api/workers/{self.cashier.id}/account/').data
        self.assertEqual(acct['shortages'], 2000)
        self.assertEqual(acct['net'], acct['base'] - 2000)

    def test_waive_and_salary_lock(self):
        self.sales()
        self.client.put(f'/api/days/{self.d}/cash-count/', {'banda': 50000 + 98000, 'mgahawa': 280000}, format='json')
        self.mark_all()
        sh = self.client.post(f'/api/days/{self.d}/close/').data['shortages'][0]
        ym = svc.ym_of(self.today)
        self.assertEqual(self.client.patch(f'/api/shortages/{sh["id"]}/', {'status': 'waived'}, format='json').status_code, 200)
        self.assertEqual(self.client.get(f'/api/workers/{self.cashier.id}/account/').data['shortages'], 0)
        self.assertEqual(self.client.post(f'/api/salary/{ym}/approve/').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/shortages/{sh["id"]}/', {'status': 'applied'}, format='json').status_code, 409)
        self.assertEqual(self.client.post('/api/advances/', {'worker_id': self.cook.id, 'amount': 1000}, format='json').status_code, 409)

    def test_change_password(self):
        r = self.client.post('/api/auth/change-password/', {'current_password': 'wrong', 'new_password': 'NewPass123!'}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (409, 'wrong_password'))
        r = self.client.post('/api/auth/change-password/', {'current_password': 'x', 'new_password': '123'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/auth/change-password/', {'current_password': 'x', 'new_password': 'NewPass123!'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass123!'))

    def test_category_delete(self):
        r = self.client.post('/api/categories/', {'name_sw': 'Usafi', 'name_en': 'Cleaning'}, format='json')
        cat_id = r.data['id']
        self.assertEqual(self.client.delete(f'/api/categories/{cat_id}/').status_code, 204)
        self.client.post('/api/categories/', {'name_sw': 'Usafi', 'name_en': 'Cleaning'}, format='json')
        cat_id2 = ExpenseCategory.objects.get(name_en='Cleaning').id
        self.client.post('/api/expenses/', {'category': ExpenseCategory.objects.get(id=cat_id2).key, 'amount': 5000, 'reason': 'Soap', 'paid_from': 'simu'}, format='json')
        r = self.client.delete(f'/api/categories/{cat_id2}/')
        self.assertEqual((r.status_code, r.data['code']), (409, 'category_in_use'))
        self.assertTrue(ExpenseCategory.objects.filter(id=cat_id2).exists())

    def test_no_day_off_worker(self):
        w = Worker.objects.create(name='Siku Zote', role='mhudumu', pay_type='daily', rate=5000, day_off=None,
                                   joined_on=self.today - timedelta(days=5))
        for i in range(5):
            key, locked = svc.status_on(w, self.today - timedelta(days=i))
            self.assertFalse(locked)  # never auto-filled as a day off

        r = self.client.post('/api/workers/', {'name': 'Kila Siku', 'role': 'mpishi', 'pay_type': 'daily', 'rate': 7000, 'day_off': None}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIsNone(r.data['day_off'])
        wid = r.data['id']

        r = self.client.patch(f'/api/workers/{wid}/', {'day_off': 2}, format='json')
        self.assertEqual(r.data['day_off'], 2)
        r = self.client.patch(f'/api/workers/{wid}/', {'day_off': None}, format='json')
        self.assertIsNone(r.data['day_off'])

    def test_joined_on_registration(self):
        future = self.today + timedelta(days=3)
        r = self.client.post('/api/workers/', {'name': 'Mpya Baadaye', 'role': 'mhudumu', 'pay_type': 'daily', 'rate': 6000, 'joined_on': future.isoformat()}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['joined_on'], future.isoformat())
        wid = r.data['id']
        today_payload = self.client.get(f'/api/days/{self.today}/').data
        self.assertNotIn(wid, [a['worker_id'] for a in today_payload['attendance']])  # not active yet, hasn't started

        past = self.today - timedelta(days=10)
        r = self.client.patch(f'/api/workers/{wid}/', {'joined_on': past.isoformat()}, format='json')
        self.assertEqual(r.data['joined_on'], past.isoformat())
        today_payload = self.client.get(f'/api/days/{self.today}/').data
        self.assertIn(wid, [a['worker_id'] for a in today_payload['attendance']])  # now active

        r = self.client.post('/api/workers/', {'name': 'Bila Tarehe', 'role': 'mhudumu', 'pay_type': 'daily', 'rate': 6000}, format='json')
        self.assertEqual(r.data['joined_on'], self.today.isoformat())  # defaults to today

    def test_monthly_salary_prorated_for_partial_month(self):
        # Use the previous, already-finished month so "today" truncation can't interfere.
        first_this, _ = svc.month_bounds(svc.ym_of(self.today))
        prev_last = first_this - timedelta(days=1)
        ym = svc.ym_of(prev_last)
        first, last = svc.month_bounds(ym)
        days_in_month = (last - first).days + 1
        join_day = first + timedelta(days=days_in_month - 5)  # registered with 5 days left in the month
        w = Worker.objects.create(name='Mwezi Nusu', role='mhudumu', pay_type='monthly', rate=300000,
                                   day_off=None, joined_on=join_day)
        d = join_day
        while d <= last:
            Attendance.objects.create(worker=w, date=d, status='present')
            d += timedelta(days=1)
        rules = Settings.load().rules
        f = svc.salary_figures(w, ym, rules)
        employed_days = (last - join_day).days + 1
        expected = max(0, 300000 - round(300000 / 30 * (days_in_month - employed_days)))
        self.assertEqual(f['base'], expected)
        self.assertLess(f['base'], 300000)  # the registration date actually prorates the salary

    def test_monthly_salary_prorated_for_mid_month_removal(self):
        first_this, _ = svc.month_bounds(svc.ym_of(self.today))
        prev_last = first_this - timedelta(days=1)
        ym = svc.ym_of(prev_last)
        first, last = svc.month_bounds(ym)
        days_in_month = (last - first).days + 1
        removed = first + timedelta(days=4)  # only worked the first 5 days of the month
        w = Worker.objects.create(name='Aliondoka Mapema', role='mhudumu', pay_type='monthly', rate=300000,
                                   day_off=None, joined_on=first - timedelta(days=200), active=False, removed_on=removed)
        d = first
        while d <= removed:
            Attendance.objects.create(worker=w, date=d, status='present')
            d += timedelta(days=1)
        rules = Settings.load().rules
        f = svc.salary_figures(w, ym, rules)
        employed_days = (removed - first).days + 1
        expected = max(0, 300000 - round(300000 / 30 * (days_in_month - employed_days)))
        self.assertEqual(f['base'], expected)
        self.assertLess(f['base'], 300000)

    def test_monthly_salary_not_prorated_just_because_month_is_not_over(self):
        ym = svc.ym_of(self.today)
        first, last = svc.month_bounds(ym)
        # self.cashier joined long before this month and has not been removed.
        self.assertEqual(svc.month_employed_days(self.cashier, first, last), (last - first).days + 1)

    def test_unpaid_salary_carries_forward(self):
        self.sales()
        self.client.put(f'/api/days/{self.d}/cash-count/', {'banda': 50000 + 98000, 'mgahawa': 280000}, format='json')
        self.mark_all()
        self.client.post(f'/api/days/{self.d}/close/')
        ym = svc.ym_of(self.today)
        r = self.client.post(f'/api/salary/{ym}/approve/')
        self.assertEqual(r.status_code, 200)
        cook_net = next(l['net'] for l in r.data['lines'] if l['worker']['id'] == self.cook.id)
        self.assertGreater(cook_net, 0)

        # approved but not marked paid -> it's money the company owes the cook, visible right away
        w = self.client.get(f'/api/workers/{self.cook.id}/').data
        self.assertEqual(w['company_owes'], cook_net)
        today_payload = self.client.get(f'/api/days/{self.d}/').data
        self.assertIn(self.cook.id, [u['worker_id'] for u in today_payload['unpaid_salaries']])

        # ...and it keeps showing next month, on the worker's own account page
        first, last = svc.month_bounds(ym)
        next_ym = svc.ym_of(last + timedelta(days=1))
        acc = self.client.get(f'/api/workers/{self.cook.id}/account/?month={next_ym}').data
        self.assertEqual(acc['owed_by_company'], cook_net)
        self.assertEqual([m['month'] for m in acc['unpaid_months']], [ym])

        # marking it paid clears it everywhere
        line_id = next(l['line_id'] for l in self.client.get(f'/api/salary/{ym}/').data['lines'] if l['worker']['id'] == self.cook.id)
        self.assertEqual(self.client.post(f'/api/salary-lines/{line_id}/paid/', {'paid': True}, format='json').status_code, 200)
        acc2 = self.client.get(f'/api/workers/{self.cook.id}/account/?month={next_ym}').data
        self.assertEqual(acc2['owed_by_company'], 0)
        w2 = self.client.get(f'/api/workers/{self.cook.id}/').data
        self.assertEqual(w2['company_owes'], 0)

    def test_manual_shortage_needs_reason(self):
        r = self.client.post(f'/api/workers/{self.cook.id}/shortages/', {'amount': 500}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post(f'/api/workers/{self.cook.id}/shortages/', {'amount': 500, 'reason': 'Broken cups'}, format='json')
        self.assertEqual(r.status_code, 201)

    def test_remove_blocked_while_cash_owed(self):
        self.sales()
        r = self.client.post(f'/api/days/{self.d}/deliveries/', {'worker_id': self.cook.id, 'section': 'banda', 'amount': 9000, 'method': 'cash'}, format='json')
        did = r.data['deliveries'][0]['id']
        r = self.client.post(f'/api/workers/{self.cook.id}/remove/', {'reason': 'left'}, format='json')
        self.assertEqual((r.status_code, r.data['code'], r.data['owed']), (409, 'delivery_cash_owed', 9000))
        self.client.patch(f'/api/deliveries/{did}/', {'handed_in': True}, format='json')
        self.assertEqual(self.client.post(f'/api/workers/{self.cook.id}/remove/', {'reason': 'left'}, format='json').status_code, 200)

    def test_salary_formulas(self):
        ym = svc.ym_of(self.today)
        first, _ = svc.month_bounds(ym)
        # fixed history inside the current month: daily 10 days (8 present + 2 late), monthly 2 absent + 1 permission
        for i in range(10):
            d = first + timedelta(days=i)
            if d > self.today:
                break
            Attendance.objects.update_or_create(worker=self.cook, date=d, defaults={'status': 'late' if i < 2 else 'present'})
            Attendance.objects.update_or_create(worker=self.cashier, date=d, defaults={'status': 'absent' if i < 2 else 'present'})
        days = [d for d in svc.month_days(self.cook, ym) if Attendance.objects.filter(worker=self.cook, date=d).exists()]
        f = svc.salary_figures(self.cook, ym, Settings.load().rules)
        self.assertEqual(f['base'], 10000 * len(days))
        g = svc.salary_figures(self.cashier, ym, Settings.load().rules)
        absent = min(2, len(days))
        self.assertEqual(g['base'], 300000 - round(300000 / 30 * absent))
