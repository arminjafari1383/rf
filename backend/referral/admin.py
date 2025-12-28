from django.contrib import admin
from django.utils import timezone
from .models import WalletUser, Referral, Staking, TokenReward

@admin.register(WalletUser)
class WalletUserAdmin(admin.ModelAdmin):
    list_display = (
        'wallet_address_short',
        'referral_code',
        'token_balance_display',
        'total_earned_display',
        'total_staked_display',
        'referral_count',
        'created_at'
    )
    list_filter = ('created_at', 'wallet_type')
    search_fields = ('wallet_address', 'referral_code')
    readonly_fields = ('referral_code', 'created_at', 'token_balance', 'total_earned', 'total_staked')
    ordering = ('-created_at',)
    list_per_page = 25
    
    fieldsets = (
        ('اطلاعات اصلی', {
            'fields': ('wallet_address', 'wallet_type', 'referral_code')
        }),
        ('موجودی و درآمد', {
            'fields': ('token_balance', 'total_earned', 'total_staked')
        }),
        ('تاریخ‌ها', {
            'fields': ('created_at',)
        }),
    )
    
    def wallet_address_short(self, obj):
        return f"{obj.wallet_address[:10]}..." if len(obj.wallet_address) > 10 else obj.wallet_address
    wallet_address_short.short_description = 'آدرس کیف‌پول'
    
    def token_balance_display(self, obj):
        return f"{obj.token_balance:.4f}"
    token_balance_display.short_description = 'موجودی توکن'
    
    def total_earned_display(self, obj):
        return f"{obj.total_earned:.4f}"
    total_earned_display.short_description = 'کل درآمد'
    
    def total_staked_display(self, obj):
        return f"{obj.total_staked:.4f} ETH"
    total_staked_display.short_description = 'کل استیک شده'
    
    def referral_count(self, obj):
        count = obj.made_referrals.count()
        return f"{count} نفر"
    referral_count.short_description = 'زیرمجموعه'


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = (
        'referrer_info',
        'referee_info',
        'has_received_signup_bonus_display',
        'created_at'
    )
    list_filter = ('created_at', 'has_received_signup_bonus')
    search_fields = (
        'referrer__wallet_address',
        'referee__wallet_address',
        'referrer__referral_code',
        'referee__referral_code'
    )
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    list_per_page = 25
    
    def referrer_info(self, obj):
        return f"{obj.referrer.wallet_address[:10]}... (کد: {obj.referrer.referral_code})"
    referrer_info.short_description = 'معرف'
    
    def referee_info(self, obj):
        return f"{obj.referee.wallet_address[:10]}... (کد: {obj.referee.referral_code})"
    referee_info.short_description = 'معرفی‌شده'
    
    def has_received_signup_bonus_display(self, obj):
        if obj.has_received_signup_bonus:
            return "✅ پرداخت شده"
        return "❌ پرداخت نشده"
    has_received_signup_bonus_display.short_description = 'پاداش ثبت‌نام'


@admin.register(Staking)
class StakingAdmin(admin.ModelAdmin):
    list_display = (
        'user_info',
        'amount_display',
        'bonus_received_display',
        'referrer_bonus_display',
        'days_remaining_display',
        'status_display',
        'staked_at',
        'unlock_date_formatted'
    )
    list_filter = ('is_unlocked', 'staked_at', 'unlock_date')
    search_fields = (
        'user__wallet_address',
        'tx_hash',
        'user__referral_code'
    )
    readonly_fields = ('staked_at', 'unlock_date', 'unlocked_at', 'days_remaining_info')
    ordering = ('-staked_at',)
    list_per_page = 25
    
    fieldsets = (
        ('اطلاعات استیکینگ', {
            'fields': ('user', 'amount', 'tx_hash')
        }),
        ('پاداش‌ها', {
            'fields': ('bonus_received', 'referrer_bonus')
        }),
        ('وضعیت و تاریخ‌ها', {
            'fields': ('is_unlocked', 'staked_at', 'unlock_date', 'unlocked_at', 'days_remaining_info')
        }),
    )
    
    actions = ['mark_as_unlocked', 'force_unlock']
    
    def user_info(self, obj):
        return f"{obj.user.wallet_address[:10]}... (کد: {obj.user.referral_code})"
    user_info.short_description = 'کاربر'
    
    def amount_display(self, obj):
        return f"{obj.amount:.4f} ETH"
    amount_display.short_description = 'مقدار استیک'
    
    def bonus_received_display(self, obj):
        return f"{obj.bonus_received:.4f}"
    bonus_received_display.short_description = 'پاداش کاربر (5%)'
    
    def referrer_bonus_display(self, obj):
        if obj.referrer_bonus > 0:
            return f"{obj.referrer_bonus:.4f}"
        return "-"
    referrer_bonus_display.short_description = 'پاداش بالاسری (5%)'
    
    def days_remaining_display(self, obj):
        if obj.is_unlocked:
            return "✅ آزاد شده"
        days = obj.days_remaining()
        if days <= 0:
            return "🟢 آماده برداشت"
        return f"⏳ {days} روز"
    days_remaining_display.short_description = 'روزهای باقی‌مانده'
    
    def status_display(self, obj):
        if obj.is_unlocked:
            return "✅ آزاد شده"
        if obj.can_unlock():
            return "🟢 قابل برداشت"
        return "🔒 قفل شده"
    status_display.short_description = 'وضعیت'
    
    def unlock_date_formatted(self, obj):
        return obj.unlock_date.strftime("%Y-%m-%d")
    unlock_date_formatted.short_description = 'تاریخ آزادسازی'
    
    def days_remaining_info(self, obj):
        """فیلد فقط خواندنی برای نمایش روزهای باقی‌مانده"""
        if obj.is_unlocked:
            return "این استیکینگ آزاد شده است"
        days = obj.days_remaining()
        if days <= 0:
            return "آماده برداشت است"
        return f"{days} روز تا آزادسازی باقی مانده"
    days_remaining_info.short_description = 'وضعیت قفل'
    
    def mark_as_unlocked(self, request, queryset):
        """اکشن: علامت زدن به عنوان آزاد شده"""
        updated = 0
        for staking in queryset:
            if not staking.is_unlocked:
                staking.is_unlocked = True
                staking.unlocked_at = timezone.now()
                staking.save()
                updated += 1
        
        self.message_user(request, f"{updated} استیکینگ آزاد شد")
    mark_as_unlocked.short_description = "علامت زدن به عنوان آزاد شده"
    
    def force_unlock(self, request, queryset):
        """اکشن: آزادسازی اجباری (برای تست)"""
        updated = 0
        for staking in queryset:
            if not staking.is_unlocked:
                staking.is_unlocked = True
                staking.unlock_date = timezone.now()
                staking.unlocked_at = timezone.now()
                staking.save()
                updated += 1
        
        self.message_user(request, f"{updated} استیکینگ با موفقیت آزاد شد (اجباری)")
    force_unlock.short_description = "آزادسازی اجباری (تست)"


@admin.register(TokenReward)
class TokenRewardAdmin(admin.ModelAdmin):
    list_display = (
        'user_info',
        'amount_display',
        'reward_type_display',
        'is_paid_display',
        'related_info',
        'created_at'
    )
    list_filter = ('reward_type', 'is_paid', 'created_at')
    search_fields = (
        'user__wallet_address',
        'user__referral_code',
        'related_staking__tx_hash'
    )
    readonly_fields = ('created_at', 'paid_at')
    ordering = ('-created_at',)
    list_per_page = 25
    
    fieldsets = (
        ('اطلاعات پاداش', {
            'fields': ('user', 'amount', 'reward_type')
        }),
        ('مرتبط با', {
            'fields': ('related_staking', 'related_referral')
        }),
        ('وضعیت پرداخت', {
            'fields': ('is_paid', 'paid_at')
        }),
        ('تاریخ‌ها', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['mark_as_paid']
    
    def user_info(self, obj):
        return f"{obj.user.wallet_address[:10]}... (کد: {obj.user.referral_code})"
    user_info.short_description = 'کاربر دریافت‌کننده'
    
    def amount_display(self, obj):
        return f"{obj.amount:.4f}"
    amount_display.short_description = 'مقدار پاداش'
    
    def reward_type_display(self, obj):
        type_mapping = {
            'signup_referral': '🎫 پاداش ثبت‌نام زیرمجموعه',
            'staking_self': '💰 پاداش استیکینگ خود کاربر',
            'staking_referral': '👥 پاداش استیکینگ زیرمجموعه',
            'staking_unlock': '🏦 برداشت از استیکینگ',
        }
        return type_mapping.get(obj.reward_type, obj.reward_type)
    reward_type_display.short_description = 'نوع پاداش'
    
    def is_paid_display(self, obj):
        if obj.is_paid:
            return "✅ پرداخت شده"
        return "⏳ در انتظار"
    is_paid_display.short_description = 'وضعیت پرداخت'
    
    def related_info(self, obj):
        if obj.related_staking:
            return f"استیکینگ: {obj.related_staking.id} ({obj.related_staking.amount} ETH)"
        elif obj.related_referral:
            return f"رفرال: {obj.related_referral.id}"
        return "-"
    related_info.short_description = 'مرتبط با'
    
    def mark_as_paid(self, request, queryset):
        """اکشن: علامت زدن به عنوان پرداخت شده"""
        updated = queryset.update(is_paid=True, paid_at=timezone.now())
        self.message_user(request, f"{updated} پاداش پرداخت شد")
    mark_as_paid.short_description = "علامت زدن به عنوان پرداخت شده"


# 📊 اضافه کردن فیلترهای پیشرفته
class DaysRemainingFilter(admin.SimpleListFilter):
    title = 'روزهای باقی‌مانده'
    parameter_name = 'days_remaining'
    
    def lookups(self, request, model_admin):
        return (
            ('expired', 'آماده برداشت (منقضی شده)'),
            ('less_than_30', 'کمتر از 30 روز'),
            ('30_to_90', '30 تا 90 روز'),
            ('more_than_90', 'بیشتر از 90 روز'),
        )
    
    def queryset(self, request, queryset):
        if self.value() == 'expired':
            return queryset.filter(unlock_date__lte=timezone.now(), is_unlocked=False)
        elif self.value() == 'less_than_30':
            return queryset.filter(
                unlock_date__gt=timezone.now(),
                unlock_date__lte=timezone.now() + timezone.timedelta(days=30),
                is_unlocked=False
            )
        elif self.value() == '30_to_90':
            return queryset.filter(
                unlock_date__gt=timezone.now() + timezone.timedelta(days=30),
                unlock_date__lte=timezone.now() + timezone.timedelta(days=90),
                is_unlocked=False
            )
        elif self.value() == 'more_than_90':
            return queryset.filter(
                unlock_date__gt=timezone.now() + timezone.timedelta(days=90),
                is_unlocked=False
            )

# اضافه کردن فیلتر به StakingAdmin
StakingAdmin.list_filter += (DaysRemainingFilter,)


# 🎯 داشبورد سفارسی
from django.urls import path
from django.shortcuts import render
from django.db.models import Sum, Count, Avg
from django.utils import timezone as tz

class CustomAdminSite(admin.AdminSite):
    site_header = "🏦 مدیریت سیستم استیکینگ و رفرال"
    site_title = "پنل مدیریت حرفه‌ای"
    index_title = "داشبورد جامع"
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('dashboard/', self.admin_view(self.dashboard_view), name='dashboard'),
            path('reports/', self.admin_view(self.reports_view), name='reports'),
        ]
        return custom_urls + urls
    
    def dashboard_view(self, request):
        """داشبورد اصلی"""
        # آمار کلی
        total_users = WalletUser.objects.count()
        total_referrals = Referral.objects.count()
        total_stakings = Staking.objects.count()
        total_rewards = TokenReward.objects.count()
        
        # آمار مالی
        total_token_balance = WalletUser.objects.aggregate(
            total=Sum('token_balance')
        )['total'] or 0
        
        total_staked_amount = WalletUser.objects.aggregate(
            total=Sum('total_staked')
        )['total'] or 0
        
        total_earned_amount = WalletUser.objects.aggregate(
            total=Sum('total_earned')
        )['total'] or 0
        
        # استیکینگ‌های فعال
        active_stakings = Staking.objects.filter(is_unlocked=False).count()
        unlocked_stakings = Staking.objects.filter(is_unlocked=True).count()
        
        # کاربران امروز
        today = tz.now().date()
        new_users_today = WalletUser.objects.filter(created_at__date=today).count()
        new_stakings_today = Staking.objects.filter(staked_at__date=today).count()
        
        # 10 کاربر برتر
        top_referrers = WalletUser.objects.annotate(
            ref_count=Count('made_referrals')
        ).order_by('-ref_count')[:10]
        
        top_stakers = WalletUser.objects.order_by('-total_staked')[:10]
        
        # نمودار آماری (ساده)
        context = {
            **self.each_context(request),
            'total_users': total_users,
            'total_referrals': total_referrals,
            'total_stakings': total_stakings,
            'total_rewards': total_rewards,
            'total_token_balance': total_token_balance,
            'total_staked_amount': total_staked_amount,
            'total_earned_amount': total_earned_amount,
            'active_stakings': active_stakings,
            'unlocked_stakings': unlocked_stakings,
            'new_users_today': new_users_today,
            'new_stakings_today': new_stakings_today,
            'top_referrers': top_referrers,
            'top_stakers': top_stakers,
        }
        return render(request, 'admin/dashboard.html', context)
    
    def reports_view(self, request):
        """صفحه گزارشات"""
        # آمار ماهانه
        from django.db.models.functions import TruncMonth
        monthly_stats = Staking.objects.annotate(
            month=TruncMonth('staked_at')
        ).values('month').annotate(
            count=Count('id'),
            total=Sum('amount')
        ).order_by('-month')[:12]
        
        context = {
            **self.each_context(request),
            'monthly_stats': monthly_stats,
        }
        return render(request, 'admin/reports.html', context)

# اگر می‌خواهید از ادمین سفارشی استفاده کنید:
# admin_site = CustomAdminSite(name='custom_admin')
# admin_site.register(WalletUser, WalletUserAdmin)
# admin_site.register(Referral, ReferralAdmin)
# admin_site.register(Staking, StakingAdmin)
# admin_site.register(TokenReward, TokenRewardAdmin)

# نکته: برای فعال کردن ادمین سفارشی، باید در urls.py اصلی تغییر ایجاد کنید