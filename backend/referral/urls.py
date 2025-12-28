# backend/referral/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('save-wallet/', views.save_wallet, name='save_wallet'),
    path('user-stats/<str:wallet_address>/', views.get_user_stats, name='user_stats'),
    path('staking/process/', views.process_staking, name='process_staking'),
    path('staking/list/<str:wallet_address>/', views.get_user_stakings, name='user_stakings'),
    path('staking/unlock/<int:staking_id>/', views.unlock_staking, name='unlock_staking'),
]