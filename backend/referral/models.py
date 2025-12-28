# backend/referral/models.py
from django.db import models
import secrets
from decimal import Decimal
from django.utils import timezone

class WalletUser(models.Model):
    wallet_address = models.CharField(max_length=255, unique=True)
    wallet_type = models.CharField(max_length=20, default='ethereum')
    referral_code = models.CharField(max_length=20, unique=True)
    token_balance = models.DecimalField(max_digits=20, decimal_places=8, default=0)
    total_earned = models.DecimalField(max_digits=20, decimal_places=8, default=0)
    total_staked = models.DecimalField(max_digits=20, decimal_places=8, default=0)  # کل مقدار استیک شده
    created_at = models.DateTimeField(auto_now_add=True)
    
    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = self.generate_referral_code()
        super().save(*args, **kwargs)
    
    def generate_referral_code(self):
        while True:
            code = secrets.token_urlsafe(10)[:10]
            if not WalletUser.objects.filter(referral_code=code).exists():
                return code
    
    def __str__(self):
        return f"{self.wallet_address[:10]}..."

class Referral(models.Model):
    referrer = models.ForeignKey(WalletUser, on_delete=models.CASCADE, related_name='made_referrals')
    referee = models.OneToOneField(WalletUser, on_delete=models.CASCADE, related_name='referred_by')
    has_received_signup_bonus = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.referrer.wallet_address[:5]} -> {self.referee.wallet_address[:5]}"

class Staking(models.Model):
    """مدل استیکینگ با قفل 365 روزه"""
    user = models.ForeignKey(WalletUser, on_delete=models.CASCADE, related_name='stakings')
    amount = models.DecimalField(max_digits=20, decimal_places=8)  # مقدار استیک شده
    bonus_received = models.DecimalField(max_digits=20, decimal_places=8, default=0)  # 5% دریافتی
    referrer_bonus = models.DecimalField(max_digits=20, decimal_places=8, default=0)  # 5% به بالاسری
    staked_at = models.DateTimeField(auto_now_add=True)
    unlock_date = models.DateTimeField()  # تاریخ آزادسازی
    is_unlocked = models.BooleanField(default=False)
    unlocked_at = models.DateTimeField(null=True, blank=True)
    tx_hash = models.CharField(max_length=100, blank=True)
    
    class Meta:
        ordering = ['-staked_at']
    
    def save(self, *args, **kwargs):
        if not self.unlock_date:
            # تاریخ آزادسازی: 365 روز بعد
            self.unlock_date = timezone.now() + timezone.timedelta(days=365)
        super().save(*args, **kwargs)
    
    def days_remaining(self):
        """روزهای باقیمانده تا آزادسازی"""
        if self.is_unlocked:
            return 0
        remaining = self.unlock_date - timezone.now()
        return max(remaining.days, 0)
    
    def can_unlock(self):
        """آیا می‌تواند آزاد شود؟"""
        return not self.is_unlocked and timezone.now() >= self.unlock_date
    
    def __str__(self):
        return f"{self.user.wallet_address[:10]} - {self.amount} ETH ({self.days_remaining()} روز)"

class TokenReward(models.Model):
    user = models.ForeignKey(WalletUser, on_delete=models.CASCADE, related_name='token_rewards')
    amount = models.DecimalField(max_digits=20, decimal_places=8)
    reward_type = models.CharField(max_length=50 , choices=[
        ('signup_referral', 'پاداش ثبت‌نام زیرمجموعه'),
        ('staking_self', 'پاداش استیکینگ خود کاربر'),
        ('staking_referral', 'پاداش استیکینگ زیرمجموعه'),
        ('staking_unlock', 'برداشت از استیکینگ'),
    ])
    related_staking = models.ForeignKey(Staking, on_delete=models.SET_NULL, null=True, blank=True)
    related_referral = models.ForeignKey(Referral, on_delete=models.SET_NULL, null=True, blank=True)
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.wallet_address[:10]} - {self.amount} ({self.reward_type})"