"""Creates the manager login, categories, settings and (with --demo) three months of sample data."""
import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from core import services as svc
from core.models import (
    SECTIONS, Advance, Attendance, Day, DaySection, Expense, ExpenseCategory, LeaveRecord, Settings,
    Shortage, Worker,
)

CATEGORIES = [('malighafi', 'Malighafi', 'Ingredients'), ('kodi', 'Kodi', 'Rent'), ('umeme', 'Umeme', 'Electricity'),
              ('maji', 'Maji', 'Water'), ('gesi', 'Gesi', 'Gas'), ('usafiri', 'Usafiri', 'Transport'),
              ('matengenezo', 'Matengenezo', 'Repairs'), ('vifaa', 'Vifaa', 'Supplies')]
WORKERS = [('Amina Juma', 'keshia', 'monthly', 300000, 0, '0712 345 678'),
           ('Rehema Saidi', 'keshia', 'monthly', 280000, 1, '0754 221 903'),
           ('Hassani Mrisho', 'mpishi', 'monthly', 350000, 2, '0687 410 256'),
           ('Juma Bakari', 'mpishi', 'daily', 10000, 4, '0765 118 342'),
           ('Zawadi Ally', 'mhudumu', 'daily', 8000, 3, '0622 507 719'),
           ('Neema Peter', 'mwingine', 'daily', 6000, 0, '0713 660 084')]


class Command(BaseCommand):
    help = 'Create manager user, expense categories and settings. Add --demo for sample data.'

    def add_arguments(self, p):
        p.add_argument('--demo', action='store_true')
        p.add_argument('--username', default='manager')
        p.add_argument('--password', default='daftari123')

    @transaction.atomic
    def handle(self, *a, **o):
        U = get_user_model()
        user, made = U.objects.get_or_create(username=o['username'], defaults={'is_staff': True, 'is_superuser': True})
        if made:
            user.set_password(o['password'])
            user.save()
        for key, sw, en in CATEGORIES:
            ExpenseCategory.objects.get_or_create(key=key, defaults={'name_sw': sw, 'name_en': en})
        Settings.load()
        if o['demo'] and not Worker.objects.exists():
            self.demo(user)
        self.stdout.write(self.style.SUCCESS(f'Ready. Login: {o["username"]} / {o["password"] if made else "(existing password)"}'))

    def demo(self, user):
        rnd = random.Random(7)
        today = svc.today()
        start = today - timedelta(days=100)
        ws = [Worker.objects.create(name=n, role=r, pay_type=pt, rate=rate, day_off=off, phone=ph, joined_on=start)
              for n, r, pt, rate, off, ph in WORKERS]
        cashiers = ws[:2]
        cats = {c.key: c for c in ExpenseCategory.objects.all()}
        for i in range((today - start).days):
            d = start + timedelta(days=i)
            weekend = svc.js_dow(d) in (5, 6, 0)
            total = 300000 + rnd.randint(0, 10) * 18000 + (90000 if weekend else 0)
            b = round(total * rnd.uniform(0.31, 0.36) / 500) * 500
            day = Day.objects.create(date=d, closed_at=svc.timezone.now(), visited=[0, 1, 2, 3, 4])
            diff = rnd.choice([0] * 7 + [-2000, 1000, -3500])
            for s, amount in zip(SECTIONS, (b, total - b)):
                mobile = round(amount * rnd.uniform(0.34, 0.42) / 500) * 500
                cashier = cashiers[(i + SECTIONS.index(s)) % 2]
                ds = DaySection.objects.create(day=day, section=s, cash=amount - mobile, mobile=mobile, cashier=cashier,
                                               float_amount=50000 if s == 'banda' else 80000,
                                               difference=diff if s == 'mgahawa' else 0)
                ds.counted = ds.float_amount + ds.cash + (ds.difference or 0)
                ds.save()
                if s == 'mgahawa' and diff < 0:
                    Shortage.objects.create(worker=cashier, date=d, amount=-diff, section=s, source='cash_count')
            for w in ws:
                if svc.js_dow(d) == w.day_off:
                    continue
                Attendance.objects.create(worker=w, date=d, status=rnd.choice(['present'] * 14 + ['late', 'absent']))
            if d.day in (1, 6, 10, 14, 18, 22, 26):
                Expense.objects.create(date=d, category=cats['malighafi'], amount=rnd.randint(54, 66) * 10000,
                                       reason='Viazi, nyama na mafuta', paid_from='simu')
            if d.day == 1:
                Expense.objects.create(date=d, category=cats['kodi'], amount=450000, reason='Kodi ya jengo', paid_from='simu')
            if d.day == 8:
                Expense.objects.create(date=d, category=cats['umeme'], amount=96000, reason='Bili ya umeme', paid_from='simu')
            if d.day in (9, 21):
                Advance.objects.create(worker=ws[rnd.randint(2, 5)], date=d, amount=rnd.choice([15000, 20000, 50000]))
        # today: open and part-way through the steps
        day = svc.get_day(today)
        sec = {s.section: s for s in day.sections.all()}
        for s, (cash, mobile, cashier) in {'banda': (118000, 64000, ws[1]), 'mgahawa': (236000, 148000, ws[0])}.items():
            sec[s].cash, sec[s].mobile, sec[s].cashier = cash, mobile, cashier
            sec[s].save()
        Expense.objects.create(date=today, category=cats['gesi'], amount=25000, reason='Mtungi wa gesi', paid_from='droo', section='banda')
        Expense.objects.create(date=today, category=cats['malighafi'], amount=84000, reason='Viazi na mafuta ya kupikia', paid_from='simu')
        for w, st in ((ws[0], 'present'), (ws[1], 'late'), (ws[2], 'present')):
            Attendance.objects.get_or_create(worker=w, date=today, defaults={'status': st})
        day.visited = [0, 1]
        day.save()
        LeaveRecord.objects.create(worker=ws[5], kind='permission', start=today, end=today, reason='Shughuli ya familia')
        LeaveRecord.objects.create(worker=ws[3], kind='holiday', start=today + timedelta(days=5), end=today + timedelta(days=8), reason='Kwenda kijijini')
        # lock the two oldest full months so the "approved" state can be seen
        cur = svc.ym_of(today)
        for ym in [m for m in svc.months_available() if m != cur][1:]:
            run = svc.approve_salary(ym, user)
            run.lines.update(paid=True)
