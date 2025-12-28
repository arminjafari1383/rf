# backend/referral/views.py
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from decimal import Decimal
from django.db import models
from django.utils import timezone
from .models import WalletUser, Referral, Staking, TokenReward

@api_view(['POST'])
def save_wallet(request):
    """ذخیره آدرس کیف پول و ثبت رفرال"""
    wallet_address = request.data.get('wallet_address')
    referral_code = request.data.get('referral_code')
    
    if not wallet_address:
        return Response({'error': 'Wallet address required'}, status=400)
    
    user, created = WalletUser.objects.get_or_create(
        wallet_address=wallet_address
    )
    
    response_data = {
        'wallet_address': user.wallet_address,
        'referral_code': user.referral_code,
        'is_new': created,
        'token_balance': float(user.token_balance),
        'total_earned': float(user.total_earned),
        'total_staked': float(user.total_staked)
    }
    
    if created and referral_code:
        try:
            referrer = WalletUser.objects.get(referral_code=referral_code)
            referral = Referral.objects.create(referrer=referrer, referee=user)
            
            referrer.token_balance += Decimal('3')
            referrer.total_earned += Decimal('3')
            referrer.save()
            
            referral.has_received_signup_bonus = True
            referral.save()
            
            TokenReward.objects.create(
                user=referrer,
                amount=Decimal('3'),
                reward_type='signup_referral',
                related_referral=referral
            )
            
            response_data['referrer_bonus_given'] = True
            response_data['referrer_received'] = 3
            
        except WalletUser.DoesNotExist:
            response_data['referrer_bonus_given'] = False
    
    return Response(response_data)

@api_view(['POST'])
def process_staking(request):
    """پردازش استیکینگ جدید"""
    wallet_address = request.data.get('wallet_address')
    amount = request.data.get('amount')
    tx_hash = request.data.get('tx_hash', '')
    
    try:
        user = WalletUser.objects.get(wallet_address=wallet_address)
        amount_decimal = Decimal(str(amount))
        
        # محاسبه پاداش‌ها
        user_bonus = amount_decimal * Decimal('0.05')  # 5% به کاربر
        referrer_bonus = Decimal('0')
        
        # بررسی بالاسری
        try:
            referral = Referral.objects.get(referee=user)
            referrer = referral.referrer
            referrer_bonus = amount_decimal * Decimal('0.05')  # 5% به بالاسری
            
            # افزایش موجودی بالاسری
            referrer.token_balance += referrer_bonus
            referrer.total_earned += referrer_bonus
            referrer.save()
            
            TokenReward.objects.create(
                user=referrer,
                amount=referrer_bonus,
                reward_type='staking_referral',
                related_referral=referral
            )
            
        except Referral.DoesNotExist:
            pass
        
        # افزایش موجودی کاربر
        user.token_balance += user_bonus
        user.total_earned += user_bonus
        user.total_staked += amount_decimal
        user.save()
        
        # ایجاد رکورد استیکینگ
        staking = Staking.objects.create(
            user=user,
            amount=amount_decimal,
            bonus_received=user_bonus,
            referrer_bonus=referrer_bonus,
            tx_hash=tx_hash
        )
        
        # ثبت پاداش کاربر
        TokenReward.objects.create(
            user=user,
            amount=user_bonus,
            reward_type='staking_self',
            related_staking=staking
        )
        
        return Response({
            'success': True,
            'staking_id': staking.id,
            'amount': float(amount_decimal),
            'user_bonus': float(user_bonus),
            'referrer_bonus': float(referrer_bonus),
            'new_token_balance': float(user.token_balance),
            'total_staked': float(user.total_staked),
            'unlock_date': staking.unlock_date.isoformat(),
            'invoice': {
                'user_address': user.wallet_address,
                'amount': float(amount_decimal),
                'bonus_5_percent': float(user_bonus),
                'referrer_bonus': float(referrer_bonus),
                'staked_amount': float(amount_decimal * Decimal('0.95')),  # 95% قفل شده
                'staked_until': staking.unlock_date.isoformat(),
                'days_remaining': 365,
                'tx_hash': tx_hash
            }
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['POST'])
def unlock_staking(request, staking_id):
    """آزادسازی استیکینگ بعد از 365 روز"""
    try:
        staking = Staking.objects.get(id=staking_id)
        
        if staking.is_unlocked:
            return Response({'error': 'این استیکینگ قبلاً آزاد شده است'}, status=400)
        
        if not staking.can_unlock():
            days_left = staking.days_remaining()
            return Response({
                'error': f'هنوز {days_left} روز تا آزادسازی باقی مانده است',
                'days_remaining': days_left
            }, status=400)
        
        # آزادسازی
        staking.is_unlocked = True
        staking.unlocked_at = timezone.now()
        staking.save()
        
        # کاهش موجودی استیک شده کاربر
        user = staking.user
        user.total_staked -= staking.amount
        user.save()
        
        # ثبت پاداش برداشت
        TokenReward.objects.create(
            user=user,
            amount=staking.amount,
            reward_type='staking_unlock',
            related_staking=staking
        )
        
        return Response({
            'success': True,
            'message': f'{staking.amount} ETH با موفقیت آزاد شد',
            'amount': float(staking.amount),
            'unlocked_at': staking.unlocked_at.isoformat()
        })
        
    except Staking.DoesNotExist:
        return Response({'error': 'استیکینگ پیدا نشد'}, status=404)

@api_view(['GET'])
def get_user_stakings(request, wallet_address):
    """دریافت لیست استیکینگ‌های کاربر"""
    try:
        user = WalletUser.objects.get(wallet_address=wallet_address)
    except WalletUser.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    
    stakings = Staking.objects.filter(user=user).order_by('-staked_at')
    
    staking_list = []
    for staking in stakings:
        staking_list.append({
            'id': staking.id,
            'amount': float(staking.amount),
            'bonus_received': float(staking.bonus_received),
            'referrer_bonus': float(staking.referrer_bonus),
            'staked_at': staking.staked_at.isoformat(),
            'unlock_date': staking.unlock_date.isoformat(),
            'days_remaining': staking.days_remaining(),
            'is_unlocked': staking.is_unlocked,
            'can_unlock': staking.can_unlock(),
            'tx_hash': staking.tx_hash
        })
    
    return Response({
        'total_staked': float(user.total_staked),
        'active_stakings': stakings.filter(is_unlocked=False).count(),
        'completed_stakings': stakings.filter(is_unlocked=True).count(),
        'stakings': staking_list
    })

@api_view(['GET'])
def get_user_stats(request, wallet_address):
    """دریافت آمار کامل کاربر"""
    try:
        user = WalletUser.objects.get(wallet_address=wallet_address)
    except WalletUser.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    
    referrals_count = Referral.objects.filter(referrer=user).count()
    
    # محاسبه پاداش‌ها
    signup_rewards = TokenReward.objects.filter(
        user=user, 
        reward_type='signup_referral'
    ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
    
    staking_self_rewards = TokenReward.objects.filter(
        user=user, 
        reward_type='staking_self'
    ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
    
    staking_referral_rewards = TokenReward.objects.filter(
        user=user, 
        reward_type='staking_referral'
    ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
    
    total_earned_from_staking = staking_self_rewards + staking_referral_rewards
    
    return Response({
        'referral_code': user.referral_code,
        'referral_link': f"http://localhost:3000?ref={user.referral_code}",
        'total_referrals': referrals_count,
        'token_balance': float(user.token_balance),
        'total_earned': float(user.total_earned),
        'total_staked': float(user.total_staked),
        'earned_from_staking': float(total_earned_from_staking),
        'reward_breakdown': {
            'from_signups': float(signup_rewards),
            'from_own_staking': float(staking_self_rewards),
            'from_referral_staking': float(staking_referral_rewards)
        }
    })


