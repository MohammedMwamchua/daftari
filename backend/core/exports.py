"""Branded PDF (reportlab) and Excel (openpyxl) reports."""
from datetime import date
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Spacer, Table, TableStyle, Paragraph
from reportlab.lib.styles import ParagraphStyle

EMERALD, BRASS, INK, MUTED, PAPER = '#0b5d49', '#c8962e', '#16231f', '#6b7a74', '#f4f7f4'
DAYS = {'sw': ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'],
        'en': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']}
MONTHS = {'sw': ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'],
          'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']}


def n(v):
    return f'{round(v or 0):,}'


def signed(v):
    return '0' if not v else f'{"+" if v > 0 else "-"}{n(abs(v))}'


def T(lang):
    return lambda sw, en: sw if lang == 'sw' else en


def month_title(ym, lang):
    y, m = ym.split('-')
    return f'{MONTHS[lang][int(m) - 1]} {y}'


def short(iso, lang):
    d = date.fromisoformat(iso)
    return f'{d.day} {MONTHS[lang][d.month - 1][:3]}'


# ------------------------------------------------------------------ PDF
def _doc(buf, title):
    return SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=14 * mm,
                             bottomMargin=16 * mm, title=title, author='Daftari')


def _header(title, subtitle):
    h1 = ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=20, textColor=colors.white, leading=24)
    sub = ParagraphStyle('sub', fontName='Helvetica', fontSize=10, textColor=colors.HexColor('#cfe5dc'), leading=14)
    brand = ParagraphStyle('brand', fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor(BRASS), leading=12)
    t = Table([[Paragraph('DAFTARI', brand)], [Paragraph(title, h1)], [Paragraph(subtitle, sub)]], colWidths=[178 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(EMERALD)), ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (0, 0), 12), ('BOTTOMPADDING', (0, -1), (-1, -1), 14),
        ('LINEBELOW', (0, -1), (-1, -1), 3, colors.HexColor(BRASS)),
    ]))
    return t


def _kpis(items):
    lab = ParagraphStyle('kl', fontName='Helvetica', fontSize=8, textColor=colors.HexColor(MUTED), leading=10)
    val = ParagraphStyle('kv', fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor(INK), leading=15)
    cells = [[Paragraph(label.upper(), lab), Paragraph(value, val)] for label, value in items]
    row = [Table([[c[0]], [c[1]]], colWidths=[(178 * mm) / len(items) - 4]) for c in cells]
    t = Table([row], colWidths=[(178 * mm) / len(items)] * len(items))
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(PAPER)),
                           ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 8)]))
    return t


def _table(rows, widths, right_from=1, total_last=False):
    t = Table(rows, colWidths=widths, repeatRows=1)
    style = [
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'), ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(EMERALD)), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('ALIGN', (right_from, 0), (-1, -1), 'RIGHT'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor(PAPER)]),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, colors.HexColor('#dde5e0')),
    ]
    if total_last:
        style += [('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'), ('LINEABOVE', (0, -1), (-1, -1), 1.2, colors.HexColor(BRASS))]
    t.setStyle(TableStyle(style))
    return t


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(colors.HexColor(MUTED))
    canvas.drawString(16 * mm, 9 * mm, 'Daftari')
    canvas.drawRightString(194 * mm, 9 * mm, str(doc.page))
    canvas.restoreState()


def _build(title, story):
    buf = BytesIO()
    _doc(buf, title).build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()


def month_pdf(r, lang):
    t = T(lang)
    title = t('Ripoti ya mauzo ya mwezi', 'Monthly sales report')
    best = r['best']
    story = [_header(title, month_title(r['month'], lang)), Spacer(1, 6 * mm), _kpis([
        (t('Jumla ya mauzo', 'Total sales'), f'TSh {n(r["total"])}'), (t('Pesa taslimu', 'Cash'), f'TSh {n(r["cash"])}'),
        (t('Pesa za simu', 'Mobile money'), f'TSh {n(r["mobile"])}'), (t('Wastani/siku', 'Avg / day'), f'TSh {n(r["average"])}'),
        (t('Siku bora', 'Best day'), f'{short(best["date"], lang)}: {n(best["total"])}' if best else '-')]),
        Spacer(1, 3 * mm), _kpis([
            (t('Banda', 'Stall'), f'TSh {n(r["banda"])}'), (t('Mgahawa', 'Restaurant'), f'TSh {n(r["mgahawa"])}'),
            (t('Matumizi', 'Expenses'), f'TSh {n(r["expenses_total"])}'), (t('Mishahara', 'Salaries'), f'TSh {n(r["salaries_total"])}'),
            (t('Faida', 'Profit'), f'TSh {n(r["profit"])}')]), Spacer(1, 6 * mm)]
    rows = [[t('Tarehe', 'Date'), t('Siku', 'Day'), t('Banda', 'Stall'), t('Mgahawa', 'Restaurant'), t('Jumla', 'Total'), t('Tofauti', 'Diff.')]]
    for d in sorted(r['days'], key=lambda x: x['date']):
        rows.append([short(d['date'], lang), DAYS[lang][d['dow']][:3], n(d['banda']['cash'] + d['banda']['mobile']),
                     n(d['mgahawa']['cash'] + d['mgahawa']['mobile']), n(d['total']), signed(d['diff'])])
    rows.append([t('JUMLA', 'TOTAL'), '', n(r['banda']), n(r['mgahawa']), n(r['total']), signed(r['diff_total'])])
    story.append(_table(rows, [24 * mm, 20 * mm, 32 * mm, 32 * mm, 32 * mm, 26 * mm], 2, True))
    if r['expenses_by_category']:
        story += [Spacer(1, 6 * mm), _table(
            [[t('Matumizi kwa kundi', 'Expenses by category'), 'TSh']] + [
                [c['name_sw' if lang == 'sw' else 'name_en'], n(c['amount'])] for c in r['expenses_by_category']],
            [120 * mm, 58 * mm], 1)]
    return _build(title, story)


def day_pdf(p, lang):
    t = T(lang)
    d = date.fromisoformat(p['date'])
    title = t('Ripoti ya siku', 'Daily report')
    sub = f'{DAYS[lang][p["dow"]]}, {d.day} {MONTHS[lang][d.month - 1]} {d.year}'
    S = p['sections']
    rows = [[t('Sehemu', 'Section'), t('Pesa taslimu', 'Cash'), t('Pesa za simu', 'Mobile money'), t('Jumla', 'Total')]]
    for key, name in (('banda', t('Banda', 'Stall')), ('mgahawa', t('Mgahawa', 'Restaurant'))):
        rows.append([name, n(S[key]['cash']), n(S[key]['mobile']), n(S[key]['cash'] + S[key]['mobile'])])
    rows.append([t('JUMLA', 'TOTAL'), n(p['cash_total']), n(p['mobile_total']), n(p['sales_total'])])
    story = [_header(title, sub), Spacer(1, 6 * mm), _kpis([
        (t('Mauzo', 'Sales'), f'TSh {n(p["sales_total"])}'), (t('Matumizi', 'Expenses'), f'TSh {n(p["expenses_total"])}'),
        (t('Tofauti ya pesa', 'Cash difference'), f'TSh {signed(p["difference_total"])}')]), Spacer(1, 6 * mm),
        _table(rows, [58 * mm, 40 * mm, 40 * mm, 40 * mm], 1, True), Spacer(1, 6 * mm)]
    exp = [[t('Matumizi', 'Expense'), t('Maelezo', 'Reason'), 'TSh']] + [
        [e['category_sw' if lang == 'sw' else 'category_en'], e['reason'], n(e['amount'])] for e in p['expenses']]
    if len(exp) == 1:
        exp.append([t('Hakuna matumizi', 'No expenses'), '', '0'])
    story.append(_table(exp, [45 * mm, 100 * mm, 33 * mm], 2))
    return _build(title, story)


# ------------------------------------------------------------------ Excel
def _sheet(ws, header, rows, widths, total=False):
    ws.append(header)
    for row in rows:
        ws.append(row)
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor=EMERALD.lstrip('#'))
        c.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 24
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row:
            if isinstance(c.value, (int, float)):
                c.number_format = '#,##0;[Red]-#,##0'
    if total:
        for c in ws[ws.max_row]:
            c.font = Font(bold=True)
            c.fill = PatternFill('solid', fgColor='F3E6C4')
    ws.freeze_panes = 'A2'


def _xlsx(wb):
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def month_xlsx(r, lang):
    t = T(lang)
    wb = Workbook()
    ws = wb.active
    ws.title = month_title(r['month'], lang)[:31]
    rows = [[d['date'], DAYS[lang][d['dow']], d['banda']['cash'], d['banda']['mobile'], d['mgahawa']['cash'],
             d['mgahawa']['mobile'], d['total'], d['diff']] for d in sorted(r['days'], key=lambda x: x['date'])]
    rows.append([t('JUMLA', 'TOTAL'), '', *[sum(x[i] for x in rows) for i in range(2, 8)]])
    _sheet(ws, [t('Tarehe', 'Date'), t('Siku', 'Day'), t('Banda: pesa taslimu', 'Stall: cash'),
                t('Banda: pesa za simu', 'Stall: mobile'), t('Mgahawa: pesa taslimu', 'Restaurant: cash'),
                t('Mgahawa: pesa za simu', 'Restaurant: mobile'), t('Jumla ya mauzo', 'Total sales'),
                t('Tofauti ya pesa', 'Cash difference')], rows, [14, 14, 18, 18, 20, 20, 18, 16], total=True)
    return _xlsx(wb)


def day_xlsx(p, lang):
    t = T(lang)
    wb = Workbook()
    ws = wb.active
    ws.title = p['date']
    S = p['sections']
    rows = []
    for key, name in (('banda', t('Banda', 'Stall')), ('mgahawa', t('Mgahawa', 'Restaurant'))):
        rows += [[name, t('Pesa taslimu', 'Cash'), S[key]['cash']], [name, t('Pesa za simu', 'Mobile money'), S[key]['mobile']]]
    rows.append([t('Jumla ya mauzo', 'Total sales'), '', p['sales_total']])
    rows += [[t('Matumizi', 'Expense'), f'{e["category_sw" if lang == "sw" else "category_en"]}: {e["reason"]}', e['amount']]
             for e in p['expenses']]
    rows += [[t('Jumla ya matumizi', 'Total expenses'), '', p['expenses_total']],
             [t('Tofauti ya pesa', 'Cash difference'), '', p['difference_total']]]
    _sheet(ws, [t('Sehemu', 'Section'), t('Maelezo', 'Detail'), 'TSh'], rows, [26, 44, 16], total=True)
    return _xlsx(wb)
