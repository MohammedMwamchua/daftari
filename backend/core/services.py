"""Business rules for Daftari. Views stay thin; every number the manager sees is computed here."""
import calendar
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .errors import Conflict
from .models import (
    SECTIONS, Advance, Attendance, AuditLog, Day, DaySection, Delivery, Expense, LeaveRecord, SalaryLine,
    SalaryRun, Settings, Shortage, Worker,
)

SPECIAL = ('permission', 'holiday', 'dayoff')
MANUAL = ('present', 'late', 'absent')


def today():
    return timezone.localdate()


def ym_of(d):
    return f'{d.year}-{d.month:02d}'


def month_bounds(ym):
    y, m = (int(x) for x in ym.split('-'))
    return date(y, m, 1), date(y, m, calendar.monthrange(y, m)[1])


def js_dow(d):
    """Sunday=0 ... Saturday=6 (the same numbering the screens use)."""
    return (d.weekday() + 1) % 7


def audit(user, action, target='', **detail):
    AuditLog.objects.create(user=user if getattr(user, 'pk', None) else None, action=action, target=str(target), detail=detail)


def get_day(d):
    day, _ = Day.objects.get_or_create(date=d)
    for s in SECTIONS:
        DaySection.objects.get_or_create(day=day, section=s)
    return day


def require_open(d):
    if Day.objects.filter(date=d, closed_at__isnull=False).exists():
        raise Conflict('day_closed', 'This day is closed. Add a correction as a new entry instead.')


def salary_locked(ym):
    return SalaryRun.objects.filter(month=ym, approved_at__isnull=False).exists()


def require_salary_open(d):
    if salary_locked(ym_of(d)):
        raise Conflict('salary_locked', 'The salary list for this month is approved and locked.')


# ---------------------------------------------------------------- workers
def active_workers(d=None):
    qs = Worker.objects.filter(active=True)
    return qs.filter(joined_on__lte=d) if d else qs


def owed_by_worker():
    """What each worker owes the company (delivery cash not yet handed in)."""
    rows = (Delivery.objects.filter(method='cash', handed_in=False)
            .values('worker_id').annotate(total=Sum('amount')))
    return {r['worker_id']: r['total'] for r in rows}


def unpaid_salary_by_worker():
    """What the company owes each worker: net pay from approved salary lists not yet marked paid.
    Not limited to one month, so a wage left unpaid keeps showing until it is settled, however
    many months go by."""
    rows = (SalaryLine.objects.filter(run__approved_at__isnull=False, paid=False)
            .values('worker_id').annotate(total=Sum('net')))
    return {r['worker_id']: r['total'] for r in rows}


def _leave_kind(leaves, d):
    for lv in leaves:
        if lv.start <= d <= lv.end:
            return lv.kind
    return None


def status_on(worker, d, leaves=None, manual=None):
    """Returns (status or None, locked). Leave beats day off beats a saved mark."""
    if leaves is None:
        leaves = list(worker.leaves.all())
    kind = _leave_kind(leaves, d)
    if kind:
        return kind, True
    if js_dow(d) == worker.day_off:
        return 'dayoff', True
    if manual is None:
        rec = Attendance.objects.filter(worker=worker, date=d).first()
        return (rec.status if rec else None), False
    return manual.get(d), False


def month_days(worker, ym, upto=None):
    first, last = month_bounds(ym)
    end = min(last, upto or today())
    if worker.removed_on:
        end = min(end, worker.removed_on)
    start = max(first, worker.joined_on)
    return [start + timedelta(days=i) for i in range((end - start).days + 1)] if end >= start else []


def month_calendar(worker, ym):
    first, last = month_bounds(ym)
    leaves = list(worker.leaves.filter(start__lte=last, end__gte=first))
    manual = {a.date: a.status for a in Attendance.objects.filter(worker=worker, date__range=(first, last))}
    out = {}
    d = max(first, worker.joined_on)
    while d <= last:
        if not worker.removed_on or d <= worker.removed_on:
            out[d.isoformat()] = status_on(worker, d, leaves, manual)[0]
        d += timedelta(days=1)
    return out


def month_stats(worker, ym, upto=None):
    first, last = month_bounds(ym)
    leaves = list(worker.leaves.filter(start__lte=last, end__gte=first))
    manual = {a.date: a.status for a in Attendance.objects.filter(worker=worker, date__range=(first, last))}
    stats = {k: 0 for k in (*MANUAL, *SPECIAL)}
    for d in month_days(worker, ym, upto):
        key = status_on(worker, d, leaves, manual)[0]
        if key:
            stats[key] += 1
    return stats


def month_employed_days(worker, first, last):
    """Calendar days of [first, last] the worker was actually on the books, by joined_on/removed_on.
    Unlike month_days(), this never shrinks because the month isn't over yet — it only reflects
    registration and removal, so a monthly salary is prorated from day one, not from today."""
    start = max(first, worker.joined_on)
    end = min(last, worker.removed_on) if worker.removed_on else last
    return max(0, (end - start).days + 1)


def salary_figures(worker, ym, rules, upto=None):
    stats = month_stats(worker, ym, upto)
    first, last = month_bounds(ym)
    if worker.pay_type == 'monthly':
        days_in_month = (last - first).days + 1
        not_employed = days_in_month - month_employed_days(worker, first, last)
        cut = not_employed + stats['absent'] + sum(stats[k] for k in SPECIAL if rules[k]['cut'])
        base = max(0, worker.rate - round(worker.rate / 30 * cut))
    else:
        paid_days = stats['present'] + stats['late'] + sum(stats[k] for k in SPECIAL if rules[k]['pay'])
        base = worker.rate * paid_days
    adv = Advance.objects.filter(worker=worker, date__range=(first, last)).aggregate(s=Sum('amount'))['s'] or 0
    short = (Shortage.objects.filter(worker=worker, date__range=(first, last), status='applied')
             .aggregate(s=Sum('amount'))['s'] or 0)
    return {'stats': stats, 'base': base, 'advances': adv, 'shortages': short, 'net': max(0, base - adv - short)}


def salary_workers(ym):
    first, last = month_bounds(ym)
    return list(Worker.objects.filter(joined_on__lte=last).exclude(removed_on__lt=first).order_by('name'))


def salary_list(ym):
    run = SalaryRun.objects.filter(month=ym, approved_at__isnull=False).first()
    settings_ = Settings.load()
    first, last = month_bounds(ym)
    if run:
        rules = run.rules
        lines = [{
            'line_id': ln.id, 'worker': worker_brief(ln.worker), 'removed': ln.worker.removed_on is not None,
            'base': ln.base, 'advances': ln.advances, 'shortages': ln.shortages, 'net': ln.net,
            'stats': ln.stats, 'paid': ln.paid,
        } for ln in run.lines.select_related('worker').order_by('worker__name')]
    else:
        rules = settings_.rules
        lines = []
        for w in salary_workers(ym):
            f = salary_figures(w, ym, rules)
            lines.append({'line_id': None, 'worker': worker_brief(w), 'removed': w.removed_on is not None,
                          'paid': False, **f})
    shortage_rows = Shortage.objects.filter(date__range=(first, last)).select_related('worker')
    return {
        'month': ym, 'status': 'approved' if run else 'draft', 'rules': rules, 'lines': lines,
        'total_net': sum(r['net'] for r in lines), 'total_base': sum(r['base'] for r in lines),
        'total_advances': sum(r['advances'] for r in lines), 'total_shortages': sum(r['shortages'] for r in lines),
        'shortages': [shortage_json(s) for s in shortage_rows],
    }


@transaction.atomic
def approve_salary(ym, user):
    if salary_locked(ym):
        raise Conflict('salary_locked', 'This list is already approved.')
    rules = Settings.load().rules
    run, _ = SalaryRun.objects.get_or_create(month=ym, defaults={'created_by': user})
    run.rules = rules
    run.approved_at = timezone.now()
    run.save()
    run.lines.all().delete()
    for w in salary_workers(ym):
        f = salary_figures(w, ym, rules)
        SalaryLine.objects.create(run=run, worker=w, base=f['base'], advances=f['advances'],
                                  shortages=f['shortages'], net=f['net'], stats=f['stats'], created_by=user)
    audit(user, 'salary.approve', ym)
    return run


def account(worker, ym):
    f = salary_figures(worker, ym, Settings.load().rules)
    first, last = month_bounds(ym)
    entries, bal = [], f['base']
    entries.append({'kind': 'base', 'date': None, 'amount': f['base'], 'balance': bal})
    items = [('advance', a.date, a.id, a.amount, None, None, None, 'applied') for a in
             Advance.objects.filter(worker=worker, date__range=(first, last))]
    items += [('shortage', s.date, s.id, s.amount, s.source, s.section, s.reason, s.status) for s in
              Shortage.objects.filter(worker=worker, date__range=(first, last))]
    for kind, d, pk, amt, source, section, reason, st in sorted(items, key=lambda x: (x[1], x[2])):
        if st == 'applied':
            bal -= amt
        entries.append({'kind': kind, 'id': pk, 'date': d.isoformat(), 'amount': -amt, 'source': source,
                        'section': section, 'reason': reason, 'status': st, 'balance': bal})
    # Wages from other, already-approved months that are still unpaid: the company's debt to this
    # worker, carried forward until it is marked paid — even if that happens months later.
    unpaid_lines = (SalaryLine.objects.filter(worker=worker, run__approved_at__isnull=False, paid=False)
                     .exclude(run__month=ym).select_related('run').order_by('run__month'))
    return {'month': ym, 'locked': salary_locked(ym), 'worker': worker_brief(worker), 'owed': owed_by_worker().get(worker.id, 0),
            'entries': entries, 'owed_by_company': sum(l.net for l in unpaid_lines),
            'unpaid_months': [{'line_id': l.id, 'month': l.run.month, 'net': l.net} for l in unpaid_lines], **f}


def worker_brief(w):
    return {'id': w.id, 'name': w.name, 'role': w.role, 'active': w.active}


def shortage_json(s):
    return {'id': s.id, 'worker_id': s.worker_id, 'worker_name': s.worker.name, 'date': s.date.isoformat(),
            'amount': s.amount, 'section': s.section, 'source': s.source, 'reason': s.reason, 'status': s.status}


# ---------------------------------------------------------------- cash
def section_cash(day, ds, deliveries, expenses, settings_):
    undelivered = sum(x.amount for x in deliveries if x.section == ds.section and x.method == 'cash' and not x.handed_in)
    payouts = sum(e.amount for e in expenses if e.paid_from == 'droo' and e.section == ds.section)
    expected = ds.cash - undelivered - payouts
    flt = ds.float_amount if day.closed and ds.float_amount is not None else settings_.float_for(ds.section)
    if day.closed:
        diff = ds.difference
    else:
        diff = None if ds.counted is None else ds.counted - flt - expected
    return {'cash': ds.cash, 'mobile': ds.mobile, 'cashier_id': ds.cashier_id, 'counted': ds.counted, 'float': flt,
            'undelivered': undelivered, 'payouts': payouts, 'expected': expected, 'difference': diff}


def delivery_json(x):
    return {'id': x.id, 'worker_id': x.worker_id, 'worker_name': x.worker.name, 'section': x.section,
            'amount': x.amount, 'method': x.method, 'handed_in': x.handed_in, 'date': x.day.date.isoformat()}


def expense_json(e):
    return {'id': e.id, 'date': e.date.isoformat(), 'category': e.category.key, 'category_sw': e.category.name_sw,
            'category_en': e.category.name_en, 'amount': e.amount, 'reason': e.reason, 'paid_from': e.paid_from,
            'section': e.section}


def _sales_of(d):
    rows = DaySection.objects.filter(day__date=d)
    return {s.section: {'cash': s.cash, 'mobile': s.mobile} for s in rows}


def day_payload(d):
    day = get_day(d)
    st = Settings.load()
    sections = list(day.sections.select_related('cashier'))
    deliveries = list(day.deliveries.select_related('worker', 'day'))
    expenses = list(Expense.objects.filter(date=d).select_related('category'))
    sec = {ds.section: section_cash(day, ds, deliveries, expenses, st) for ds in sections}
    sales = {s: sec[s]['cash'] + sec[s]['mobile'] for s in SECTIONS}
    manual = {a.worker_id: a.status for a in Attendance.objects.filter(date=d)}
    people, missing = [], []
    for w in active_workers(d):
        key, locked = status_on(w, d, manual={d: manual.get(w.id)})
        people.append({'worker_id': w.id, 'name': w.name, 'role': w.role, 'status': key, 'locked': locked})
        if not key:
            missing.append(w.id)
    prev = _sales_of(d - timedelta(days=1))
    week = []
    for i in range(6, -1, -1):
        wd = d - timedelta(days=i)
        s = _sales_of(wd)
        week.append({'date': wd.isoformat(), 'dow': js_dow(wd), 'total': sum(v['cash'] + v['mobile'] for v in s.values())})
    prev_week = sum(
        sum(v['cash'] + v['mobile'] for v in _sales_of(d - timedelta(days=i)).values()) for i in range(7, 14))
    owed = {}
    for x in Delivery.objects.filter(method='cash', handed_in=False).select_related('worker').order_by('id'):
        row = owed.setdefault(x.worker_id, {'worker_id': x.worker_id, 'name': x.worker.name, 'amount': 0, 'ids': []})
        row['amount'] += x.amount
        row['ids'].append(x.id)
    diffs = [v['difference'] for v in sec.values() if v['difference'] is not None]
    shortages = Shortage.objects.filter(date=d).select_related('worker')
    unpaid = unpaid_salary_by_worker()
    unpaid_names = {w.id: w.name for w in Worker.objects.filter(id__in=unpaid.keys())}
    return {
        'date': d.isoformat(), 'dow': js_dow(d), 'closed': day.closed, 'closed_at': day.closed_at,
        'visited': day.visited, 'sections': sec, 'sales': sales, 'sales_total': sum(sales.values()),
        'cash_total': sum(v['cash'] for v in sec.values()), 'mobile_total': sum(v['mobile'] for v in sec.values()),
        'expenses': [expense_json(e) for e in expenses], 'expenses_total': sum(e.amount for e in expenses),
        'deliveries': [delivery_json(x) for x in deliveries], 'attendance': people, 'missing': missing,
        'difference_total': sum(diffs), 'has_count': bool(diffs),
        'yesterday': {'total': sum(v['cash'] + v['mobile'] for v in prev.values()), **{
            s: prev.get(s, {'cash': 0, 'mobile': 0}) for s in SECTIONS}},
        'week': week, 'week_prev_total': prev_week,
        'owed': list(owed.values()),
        'shortages': [shortage_json(s) for s in shortages],
        'unpaid_salaries': [{'worker_id': k, 'name': unpaid_names.get(k, ''), 'amount': v} for k, v in unpaid.items()],
    }


@transaction.atomic
def close_day(d, user):
    day = get_day(d)
    if day.closed:
        raise Conflict('day_closed', 'This day is already closed.')
    payload = day_payload(d)
    if payload['missing']:
        raise Conflict('attendance_missing', 'Mark attendance for every worker first.', worker_ids=payload['missing'])
    st = Settings.load()
    created = []
    for ds in day.sections.select_related('cashier'):
        info = payload['sections'][ds.section]
        ds.float_amount = info['float']
        ds.difference = info['difference']
        if info['difference'] is not None and info['difference'] < 0:
            if not ds.cashier_id:
                raise Conflict('cashier_required', 'Choose the cashier of the day before closing a section with a shortage.',
                               section=ds.section)
            sh = Shortage.objects.create(worker=ds.cashier, date=d, amount=-info['difference'], section=ds.section,
                                         source='cash_count', created_by=user)
            created.append(sh)
        ds.save()
    day.closed_at = timezone.now()
    day.visited = [0, 1, 2, 3, 4, 5]
    day.save()
    audit(user, 'day.close', d, shortages=[{'worker': s.worker_id, 'amount': s.amount} for s in created])
    for s in created:
        audit(user, 'shortage.create', s.id, worker=s.worker_id, amount=s.amount, source='cash_count')
    return [shortage_json(s) for s in created]


# ---------------------------------------------------------------- reports
def month_report(ym):
    first, last = month_bounds(ym)
    days = []
    for day in Day.objects.filter(date__range=(first, last)).prefetch_related('sections').order_by('date'):
        secs = {s.section: s for s in day.sections.all()}
        row = {'date': day.date.isoformat(), 'dow': js_dow(day.date), 'closed': day.closed}
        for s in SECTIONS:
            o = secs.get(s)
            row[s] = {'cash': o.cash if o else 0, 'mobile': o.mobile if o else 0}
        row['total'] = sum(row[s]['cash'] + row[s]['mobile'] for s in SECTIONS)
        diffs = [o.difference for o in secs.values() if o.difference is not None]
        row['diff'] = sum(diffs)
        if row['total'] or day.closed:
            days.append(row)
    cash = sum(r[s]['cash'] for r in days for s in SECTIONS)
    mobile = sum(r[s]['mobile'] for r in days for s in SECTIONS)
    total = cash + mobile
    selling = [r for r in days if r['total'] > 0]
    best = max(selling, key=lambda r: r['total'], default=None)
    exp = Expense.objects.filter(date__range=(first, last)).select_related('category')
    by_cat = {}
    for e in exp:
        c = by_cat.setdefault(e.category.key, {'key': e.category.key, 'name_sw': e.category.name_sw,
                                              'name_en': e.category.name_en, 'amount': 0})
        c['amount'] += e.amount
    sal = salary_list(ym)
    salaries_cost = sal['total_net'] + sal['total_advances']
    exp_total = sum(e.amount for e in exp)
    return {
        'month': ym, 'days': list(reversed(days)), 'total': total, 'cash': cash, 'mobile': mobile,
        'banda': sum(r['banda']['cash'] + r['banda']['mobile'] for r in days),
        'mgahawa': sum(r['mgahawa']['cash'] + r['mgahawa']['mobile'] for r in days),
        'average': round(total / len(selling)) if selling else 0, 'best': best,
        'expenses_total': exp_total, 'expenses_by_category': sorted(by_cat.values(), key=lambda c: -c['amount']),
        'salaries_total': salaries_cost, 'profit': total - exp_total - salaries_cost,
        'diff_total': sum(r['diff'] for r in days),
    }


def months_available():
    first = Day.objects.order_by('date').first()
    cur = today()
    start = first.date if first else cur
    out, y, m = [], start.year, start.month
    while (y, m) <= (cur.year, cur.month):
        out.append(f'{y}-{m:02d}')
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return list(reversed(out))
