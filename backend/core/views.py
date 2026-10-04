from datetime import date as date_cls

from django.conf import settings as django_settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from . import exports, services as svc
from .errors import Conflict
from .models import (
    SECTIONS, Advance, Attendance, Day, Expense, ExpenseCategory, LeaveRecord, SalaryLine, Settings,
    Shortage, Worker,
)

# ---------------------------------------------------------------- input helpers
def pdate(value, field='date'):
    try:
        return date_cls.fromisoformat(str(value))
    except ValueError:
        raise ValidationError({field: 'Use yyyy-mm-dd.'})


def pmonth(value):
    try:
        y, m = str(value).split('-')
        assert 1 <= int(m) <= 12 and len(y) == 4
        return f'{int(y)}-{int(m):02d}'
    except (ValueError, AssertionError):
        raise ValidationError({'month': 'Use yyyy-mm.'})


def pint(data, key, required=True, minimum=0, default=None):
    v = data.get(key)
    if v in (None, ''):
        if required:
            raise ValidationError({key: 'Required.'})
        return default
    try:
        n = int(v)
    except (TypeError, ValueError):
        raise ValidationError({key: 'Must be a whole number.'})
    if n < minimum:
        raise ValidationError({key: f'Must be at least {minimum}.'})
    return n


def pchoice(data, key, choices, required=True, default=None):
    v = data.get(key, default)
    if v is None and not required:
        return None
    if v not in choices:
        raise ValidationError({key: f'Must be one of: {", ".join(choices)}.'})
    return v


def worker_json(w, unpaid=None):
    unpaid = svc.unpaid_salary_by_worker() if unpaid is None else unpaid
    return {
        'id': w.id, 'name': w.name, 'role': w.role, 'phone': w.phone, 'pay_type': w.pay_type, 'rate': w.rate,
        'day_off': w.day_off, 'joined_on': w.joined_on.isoformat(), 'active': w.active,
        'removed_on': w.removed_on.isoformat() if w.removed_on else None, 'removed_reason': w.removed_reason,
        'company_owes': unpaid.get(w.id, 0),
    }


def leave_json(lv):
    return {'id': lv.id, 'worker_id': lv.worker_id, 'kind': lv.kind, 'start': lv.start.isoformat(),
            'end': lv.end.isoformat(), 'reason': lv.reason}


def category_json(c):
    return {'id': c.id, 'key': c.key, 'name_sw': c.name_sw, 'name_en': c.name_en, 'active': c.active}


def settings_json():
    st = Settings.load()
    return {'float_banda': st.float_banda, 'float_mgahawa': st.float_mgahawa, 'rules': st.rules}


# ---------------------------------------------------------------- auth / meta
class MeView(APIView):
    def get(self, request):
        u = request.user
        return Response({'id': u.id, 'username': u.username, 'name': u.get_full_name() or u.username})


class ChangePasswordView(APIView):
    def post(self, request):
        if django_settings.DEMO_MODE:
            raise Conflict('demo_mode', 'The password cannot be changed in the public demo.')
        u = request.user
        current = request.data.get('current_password') or ''
        new = request.data.get('new_password') or ''
        if not u.check_password(current):
            raise Conflict('wrong_password', 'Your current password is wrong.')
        try:
            validate_password(new, user=u)
        except DjangoValidationError as e:
            # Stable codes, not Django's English sentences, so the screen can translate them.
            raise ValidationError({'new_password': [err.code or 'password_invalid' for err in e.error_list]})
        u.set_password(new)
        u.save()
        svc.audit(u, 'user.change_password', u.id)
        return Response({'detail': 'Password changed.'})


class MetaView(APIView):
    def get(self, request):
        d = svc.today()
        return Response({
            'today': d.isoformat(), 'dow': svc.js_dow(d), 'settings': settings_json(),
            'rules_locked': svc.salary_locked(svc.ym_of(d)), 'months': svc.months_available(),
            'categories': [category_json(c) for c in ExpenseCategory.objects.all()],
        })

    def patch(self, request):
        st = Settings.load()
        data = request.data
        if 'float_banda' in data:
            st.float_banda = pint(data, 'float_banda')
        if 'float_mgahawa' in data:
            st.float_mgahawa = pint(data, 'float_mgahawa')
        if 'rules' in data:
            if svc.salary_locked(svc.ym_of(svc.today())):
                raise Conflict('salary_locked', 'The salary list is approved, so the rules are locked.')
            rules = {}
            for k in svc.SPECIAL:
                r = (data['rules'] or {}).get(k) or {}
                rules[k] = {'cut': bool(r.get('cut')), 'pay': bool(r.get('pay'))}
            st.rules = rules
        st.save()
        svc.audit(request.user, 'settings.update', '', data={k: v for k, v in data.items()})
        return Response(settings_json())


class CategoriesView(APIView):
    def post(self, request):
        name_sw = (request.data.get('name_sw') or '').strip()
        name_en = (request.data.get('name_en') or name_sw).strip()
        if not name_sw:
            raise ValidationError({'name_sw': 'Required.'})
        from django.utils.text import slugify
        base = slugify(name_en) or 'category'
        key, n = base, 1
        while ExpenseCategory.objects.filter(key=key).exists():
            n += 1
            key = f'{base}-{n}'
        c = ExpenseCategory.objects.create(key=key, name_sw=name_sw, name_en=name_en, created_by=request.user)
        return Response(category_json(c), status=201)


class CategoryView(APIView):
    def patch(self, request, pk):
        c = get_object_or_404(ExpenseCategory, pk=pk)
        for f in ('name_sw', 'name_en'):
            if f in request.data and str(request.data[f]).strip():
                setattr(c, f, str(request.data[f]).strip())
        if 'active' in request.data:
            c.active = bool(request.data['active'])
        c.save()
        return Response(category_json(c))

    def delete(self, request, pk):
        c = get_object_or_404(ExpenseCategory, pk=pk)
        if c.expenses.exists():
            raise Conflict('category_in_use', 'This category is used by expenses already recorded. Hide it instead.')
        name = c.name_en
        c.delete()
        svc.audit(request.user, 'category.delete', pk, name=name)
        return Response(status=204)


# ---------------------------------------------------------------- workers
def apply_worker_fields(w, data, creating):
    if creating or 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            raise ValidationError({'name': 'Required.'})
        w.name = name
    if creating or 'role' in data:
        w.role = pchoice(data, 'role', [r[0] for r in Worker.ROLES])
    if creating or 'pay_type' in data:
        w.pay_type = pchoice(data, 'pay_type', ['daily', 'monthly'])
    if creating or 'rate' in data:
        w.rate = pint(data, 'rate', minimum=1)
    if 'phone' in data:
        w.phone = str(data['phone'] or '').strip()
    if creating or 'day_off' in data:
        raw = data.get('day_off', 1 if creating else None)
        if raw in (None, ''):
            w.day_off = None  # works every day of the week, no weekly rest day
        else:
            try:
                d = int(raw)
            except (TypeError, ValueError):
                raise ValidationError({'day_off': 'Must be a whole number.'})
            if not 0 <= d <= 6:
                raise ValidationError({'day_off': '0 to 6.'})
            w.day_off = d
    if creating or 'joined_on' in data:
        if data.get('joined_on'):
            w.joined_on = pdate(data['joined_on'], 'joined_on')
        elif creating:
            w.joined_on = svc.today()


class WorkersView(APIView):
    def get(self, request):
        flag = request.query_params.get('active')
        qs = Worker.objects.all()
        if flag in ('true', '1'):
            qs = qs.filter(active=True)
        elif flag in ('false', '0'):
            qs = qs.filter(active=False)
        unpaid = svc.unpaid_salary_by_worker()
        return Response([worker_json(w, unpaid) for w in qs])

    def post(self, request):
        w = Worker(created_by=request.user)
        apply_worker_fields(w, request.data, True)
        w.save()
        svc.audit(request.user, 'worker.create', w.id, name=w.name)
        return Response(worker_json(w), status=201)


class WorkerView(APIView):
    def get(self, request, pk):
        w = get_object_or_404(Worker, pk=pk)
        ym = pmonth(request.query_params.get('month') or svc.ym_of(svc.today()))
        return Response({**worker_json(w), 'calendar': svc.month_calendar(w, ym), 'stats': svc.month_stats(w, ym),
                         'leaves': [leave_json(x) for x in w.leaves.all()], 'month': ym})

    def patch(self, request, pk):
        w = get_object_or_404(Worker, pk=pk)
        apply_worker_fields(w, request.data, False)
        w.save()
        return Response(worker_json(w))


class WorkerRemoveView(APIView):
    @transaction.atomic
    def post(self, request, pk):
        w = get_object_or_404(Worker, pk=pk)
        w.active = False
        w.removed_on = svc.today()
        w.removed_reason = pchoice(request.data, 'reason', ['left', 'ended', 'other'], default='other')
        w.save()
        svc.audit(request.user, 'worker.remove', w.id, reason=w.removed_reason)
        return Response(worker_json(w))


class WorkerRestoreView(APIView):
    def post(self, request, pk):
        w = get_object_or_404(Worker, pk=pk)
        w.active, w.removed_on, w.removed_reason = True, None, ''
        w.save()
        svc.audit(request.user, 'worker.restore', w.id)
        return Response(worker_json(w))


class WorkerLeavesView(APIView):
    def post(self, request, pk):
        w = get_object_or_404(Worker, pk=pk)
        start, end = pdate(request.data.get('start'), 'start'), pdate(request.data.get('end'), 'end')
        if end < start:
            raise ValidationError({'end': 'End date is before the start date.'})
        lv = LeaveRecord.objects.create(
            worker=w, kind=pchoice(request.data, 'kind', ['permission', 'holiday']), start=start, end=end,
            reason=str(request.data.get('reason') or '')[:200], created_by=request.user)
        return Response(leave_json(lv), status=201)


class LeaveView(APIView):
    def delete(self, request, pk):
        get_object_or_404(LeaveRecord, pk=pk).delete()
        return Response(status=204)


class WorkerAccountView(APIView):
    def get(self, request, pk):
        w = get_object_or_404(Worker, pk=pk)
        return Response(svc.account(w, pmonth(request.query_params.get('month') or svc.ym_of(svc.today()))))


class WorkerShortagesView(APIView):
    def post(self, request, pk):
        w = get_object_or_404(Worker, pk=pk)
        reason = str(request.data.get('reason') or '').strip()
        if not reason:
            raise ValidationError({'reason': 'A reason is required.'})
        d = pdate(request.data['date']) if request.data.get('date') else svc.today()
        svc.require_salary_open(d)
        s = Shortage.objects.create(worker=w, date=d, amount=pint(request.data, 'amount', minimum=1), source='manual',
                                    reason=reason[:200], created_by=request.user)
        svc.audit(request.user, 'shortage.create', s.id, worker=w.id, amount=s.amount, source='manual', reason=reason)
        return Response(svc.shortage_json(s), status=201)


class ShortageView(APIView):
    def patch(self, request, pk):
        s = get_object_or_404(Shortage.objects.select_related('worker'), pk=pk)
        svc.require_salary_open(s.date)
        s.status = pchoice(request.data, 'status', ['applied', 'waived'])
        s.save()
        svc.audit(request.user, 'shortage.' + ('waive' if s.status == 'waived' else 'reapply'), s.id,
                  worker=s.worker_id, amount=s.amount)
        return Response(svc.shortage_json(s))


class AdvancesView(APIView):
    def post(self, request):
        w = get_object_or_404(Worker, pk=pint(request.data, 'worker_id', minimum=1))
        d = pdate(request.data['date']) if request.data.get('date') else svc.today()
        svc.require_salary_open(d)
        a = Advance.objects.create(worker=w, date=d, amount=pint(request.data, 'amount', minimum=1), created_by=request.user)
        svc.audit(request.user, 'advance.create', a.id, worker=w.id, amount=a.amount)
        return Response({'id': a.id, 'worker_id': w.id, 'date': d.isoformat(), 'amount': a.amount}, status=201)


class AdvanceView(APIView):
    def delete(self, request, pk):
        a = get_object_or_404(Advance, pk=pk)
        svc.require_salary_open(a.date)
        a.delete()
        return Response(status=204)


# ---------------------------------------------------------------- day
class DayView(APIView):
    def get(self, request, d):
        return Response(svc.day_payload(pdate(d)))


class DaySalesView(APIView):
    @transaction.atomic
    def put(self, request, d):
        d = pdate(d)
        svc.require_open(d)
        day = svc.get_day(d)
        for ds in day.sections.all():
            inp = request.data.get(ds.section)
            if inp is None:
                continue
            ds.cash = pint(inp, 'cash', required=False, default=0)
            ds.mobile = pint(inp, 'mobile', required=False, default=0)
            if 'cashier_id' in inp:
                ds.cashier = get_object_or_404(Worker, pk=inp['cashier_id'], active=True) if inp['cashier_id'] else None
            ds.save()
        return Response(svc.day_payload(d))


class DayCashCountView(APIView):
    @transaction.atomic
    def put(self, request, d):
        d = pdate(d)
        svc.require_open(d)
        day = svc.get_day(d)
        for ds in day.sections.all():
            if ds.section in request.data:
                ds.counted = pint(request.data, ds.section, required=False)
                ds.save()
        return Response(svc.day_payload(d))


class DayAttendanceView(APIView):
    @transaction.atomic
    def put(self, request, d):
        d = pdate(d)
        svc.require_open(d)
        for wid, status in request.data.items():
            w = get_object_or_404(Worker, pk=wid, active=True)
            if svc.status_on(w, d)[1]:
                continue  # leave and day off are filled automatically
            if status not in svc.MANUAL:
                raise ValidationError({wid: 'present, late or absent.'})
            Attendance.objects.update_or_create(worker=w, date=d, defaults={'status': status})
        return Response(svc.day_payload(d))


class DayVisitView(APIView):
    def post(self, request, d):
        d = pdate(d)
        day = svc.get_day(d)
        step = pint(request.data, 'step')
        if step > 4:
            raise ValidationError({'step': '0 to 4.'})
        if not day.closed and step not in day.visited:
            day.visited = sorted({*day.visited, step})
            day.save(update_fields=['visited'])
        return Response({'visited': day.visited})


class DayPayView(APIView):
    def get(self, request, d):
        return Response(svc.day_pay(pdate(d)))


class DayCloseView(APIView):
    def post(self, request, d):
        d = pdate(d)
        created = svc.close_day(d, request.user)
        return Response({'day': svc.day_payload(d), 'shortages': created})


# ---------------------------------------------------------------- expenses
class ExpensesView(APIView):
    def get(self, request):
        ym = pmonth(request.query_params.get('month') or svc.ym_of(svc.today()))
        first, last = svc.month_bounds(ym)
        qs = Expense.objects.filter(date__range=(first, last)).select_related('category')
        return Response([svc.expense_json(e) for e in qs])

    def post(self, request):
        d = pdate(request.data['date']) if request.data.get('date') else svc.today()
        svc.require_open(d)
        paid_from = pchoice(request.data, 'paid_from', ['droo', 'simu', 'other'])
        section = request.data.get('section') or ''
        if paid_from == 'droo':
            section = pchoice(request.data, 'section', SECTIONS)
        reason = str(request.data.get('reason') or '').strip()
        if not reason:
            raise ValidationError({'reason': 'Required.'})
        cat = get_object_or_404(ExpenseCategory, key=request.data.get('category'), active=True)
        e = Expense.objects.create(date=d, category=cat, amount=pint(request.data, 'amount', minimum=1), reason=reason[:200],
                                   paid_from=paid_from, section=section if paid_from == 'droo' else '', created_by=request.user)
        return Response(svc.expense_json(e), status=201)


class ExpenseView(APIView):
    def delete(self, request, pk):
        e = get_object_or_404(Expense, pk=pk)
        svc.require_open(e.date)
        e.delete()
        svc.audit(request.user, 'expense.delete', pk, amount=e.amount, reason=e.reason)
        return Response(status=204)


# ---------------------------------------------------------------- salary
class SalaryView(APIView):
    def get(self, request, ym):
        return Response(svc.salary_list(pmonth(ym)))


class SalaryApproveView(APIView):
    def post(self, request, ym):
        ym = pmonth(ym)
        svc.approve_salary(ym, request.user)
        return Response(svc.salary_list(ym))


class SalaryLinePaidView(APIView):
    def post(self, request, pk):
        ln = get_object_or_404(SalaryLine, pk=pk)
        ln.paid = bool(request.data.get('paid', True))
        ln.paid_at = timezone.now() if ln.paid else None
        ln.save()
        svc.audit(request.user, 'salary.paid', ln.id, worker=ln.worker_id, paid=ln.paid, net=ln.net)
        return Response(svc.salary_list(ln.run.month))


# ---------------------------------------------------------------- reports
def _file_response(kind, name, payload):
    mime = {'pdf': 'application/pdf',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[kind]
    r = HttpResponse(payload, content_type=mime)
    r['Content-Disposition'] = f'attachment; filename="{name}.{kind}"'
    r['Access-Control-Expose-Headers'] = 'Content-Disposition'
    return r


class MonthReportView(APIView):
    def get(self, request, ym):
        ym = pmonth(ym)
        data = svc.month_report(ym)
        fmt = request.query_params.get('file', 'json')
        lang = 'en' if request.query_params.get('lang') == 'en' else 'sw'
        if fmt == 'pdf':
            return _file_response('pdf', f'mauzo-{ym}', exports.month_pdf(data, lang))
        if fmt == 'xlsx':
            return _file_response('xlsx', f'mauzo-{ym}', exports.month_xlsx(data, lang))
        return Response(data)


class DayReportView(APIView):
    def get(self, request, d):
        d = pdate(d)
        fmt = request.query_params.get('file', 'json')
        lang = 'en' if request.query_params.get('lang') == 'en' else 'sw'
        if fmt == 'pdf':
            return _file_response('pdf', f'mauzo-{d}', exports.day_pdf(svc.day_payload(d), lang))
        if fmt == 'xlsx':
            return _file_response('xlsx', f'mauzo-{d}', exports.day_xlsx(svc.day_payload(d), lang))
        return Response(svc.day_report(d))
