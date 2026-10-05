from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views as v

urlpatterns = [
    path('auth/login/', TokenObtainPairView.as_view()),
    path('auth/refresh/', TokenRefreshView.as_view()),
    path('auth/me/', v.MeView.as_view()),
    path('auth/change-password/', v.ChangePasswordView.as_view()),
    path('meta/', v.MetaView.as_view()),
    path('categories/', v.CategoriesView.as_view()),
    path('categories/<int:pk>/', v.CategoryView.as_view()),

    path('workers/', v.WorkersView.as_view()),
    path('workers/<int:pk>/', v.WorkerView.as_view()),
    path('workers/<int:pk>/remove/', v.WorkerRemoveView.as_view()),
    path('workers/<int:pk>/restore/', v.WorkerRestoreView.as_view()),
    path('workers/<int:pk>/leaves/', v.WorkerLeavesView.as_view()),
    path('workers/<int:pk>/account/', v.WorkerAccountView.as_view()),
    path('workers/<int:pk>/shortages/', v.WorkerShortagesView.as_view()),
    path('leaves/<int:pk>/', v.LeaveView.as_view()),
    path('shortages/<int:pk>/', v.ShortageView.as_view()),
    path('advances/', v.AdvancesView.as_view()),
    path('advances/<int:pk>/', v.AdvanceView.as_view()),

    path('days/<str:d>/', v.DayView.as_view()),
    path('days/<str:d>/sales/', v.DaySalesView.as_view()),
    path('days/<str:d>/cash-count/', v.DayCashCountView.as_view()),
    path('days/<str:d>/attendance/', v.DayAttendanceView.as_view()),
    path('days/<str:d>/payments/', v.DayPaymentsView.as_view()),
    path('days/<str:d>/visit/', v.DayVisitView.as_view()),
    path('days/<str:d>/close/', v.DayCloseView.as_view()),
    path('days/<str:d>/pay/', v.DayPayView.as_view()),

    path('expenses/', v.ExpensesView.as_view()),
    path('expenses/<int:pk>/', v.ExpenseView.as_view()),

    path('salary/<str:ym>/', v.SalaryView.as_view()),
    path('salary/<str:ym>/approve/', v.SalaryApproveView.as_view()),
    path('salary-lines/<int:pk>/paid/', v.SalaryLinePaidView.as_view()),

    path('reports/month/<str:ym>/', v.MonthReportView.as_view()),
    path('reports/day/<str:d>/', v.DayReportView.as_view()),

    path('opinions/submit/', v.OpinionSubmitView.as_view()),
    path('opinions/', v.OpinionsView.as_view()),
    path('opinions/unread/', v.OpinionsUnreadView.as_view()),
    path('opinions/read-all/', v.OpinionsReadAllView.as_view()),
    path('opinions/<int:pk>/', v.OpinionView.as_view()),
]
