from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db import models
from decimal import Decimal, InvalidOperation

from .models import WalletUser, Referral, Staking, TokenReward


# =========================
# Save Wallet & Referral
# =========================
@csrf_exempt
@api_view(['POST'])
def save_wallet(request):
    wallet_address = request.data.get('wallet_address')
    referral_code = request.data.get('referral_code')

    if not wallet_address:
        return Response(
            {'error': 'wallet_address is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user, created = WalletUser.objects.get_or_create(
        wallet_address=wallet_address
    )

    response_data = {
        'wallet_address': user.wallet_address,
        'referral_code': user.referral_code,
        'is_new': created,
        'token_balance': float(user.token_balance),
        'total_earned': float(user.total_earned),
        'total_staked': float(user.total_staked),
    }

    # Referral signup bonus
    if created and referral_code:
        try:
            referrer = WalletUser.objects.get(referral_code=referral_code)

            referral = Referral.objects.create(
                referrer=referrer,
                referee=user,
                has_received_signup_bonus=True
            )

            bonus = Decimal('3')
            referrer.token_balance += bonus
            referrer.total_earned += bonus
            referrer.save()

            TokenReward.objects.create(
                user=referrer,
                amount=bonus,
                reward_type='signup_referral',
                related_referral=referral
            )

            response_data.update({
                'referrer_bonus_given': True,
                'referrer_received': float(bonus)
            })

        except WalletUser.DoesNotExist:
            response_data['referrer_bonus_given'] = False

    return Response(response_data, status=status.HTTP_200_OK)


# =========================
# Process Staking
# =========================
@csrf_exempt
@api_view(['POST'])
def process_staking(request):
    wallet_address = request.data.get('wallet_address')
    amount = request.data.get('amount')
    tx_hash = request.data.get('tx_hash', '')

    if not wallet_address or not amount:
        return Response(
            {'error': 'wallet_address and amount are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        amount_decimal = Decimal(str(amount))
        if amount_decimal <= 0:
            raise InvalidOperation
    except (InvalidOperation, TypeError):
        return Response(
            {'error': 'invalid staking amount'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = WalletUser.objects.get(wallet_address=wallet_address)
    except WalletUser.DoesNotExist:
        return Response(
            {'error': 'user not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    user_bonus = amount_decimal * Decimal('0.05')
    referrer_bonus = Decimal('0')

    # Referrer staking bonus
    try:
        referral = Referral.objects.get(referee=user)
        referrer = referral.referrer

        referrer_bonus = amount_decimal * Decimal('0.05')
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

    # Update user balances
    user.token_balance += user_bonus
    user.total_earned += user_bonus
    user.total_staked += amount_decimal
    user.save()

    staking = Staking.objects.create(
        user=user,
        amount=amount_decimal,
        bonus_received=user_bonus,
        referrer_bonus=referrer_bonus,
        tx_hash=tx_hash
    )

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
            'staked_amount': float(amount_decimal * Decimal('0.95')),
            'staked_until': staking.unlock_date.isoformat(),
            'days_remaining': 365,
            'tx_hash': tx_hash
        }
    }, status=status.HTTP_200_OK)


# =========================
# Unlock Staking
# =========================
@csrf_exempt
@api_view(['POST'])
def unlock_staking(request, staking_id):
    try:
        staking = Staking.objects.get(id=staking_id)
    except Staking.DoesNotExist:
        return Response(
            {'error': 'staking not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if staking.is_unlocked:
        return Response(
            {'error': 'staking already unlocked'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not staking.can_unlock():
        return Response(
            {
                'error': 'staking still locked',
                'days_remaining': staking.days_remaining()
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    staking.is_unlocked = True
    staking.unlocked_at = timezone.now()
    staking.save()

    user = staking.user
    user.total_staked -= staking.amount
    user.save()

    TokenReward.objects.create(
        user=user,
        amount=staking.amount,
        reward_type='staking_unlock',
        related_staking=staking
    )

    return Response({
        'success': True,
        'message': f'{staking.amount} ETH unlocked successfully',
        'amount': float(staking.amount),
        'unlocked_at': staking.unlocked_at.isoformat()
    }, status=status.HTTP_200_OK)


# =========================
# User Stakings
# =========================
@api_view(['GET'])
def get_user_stakings(request, wallet_address):
    try:
        user = WalletUser.objects.get(wallet_address=wallet_address)
    except WalletUser.DoesNotExist:
        return Response(
            {'error': 'user not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    stakings = Staking.objects.filter(user=user).order_by('-staked_at')

    return Response({
        'total_staked': float(user.total_staked),
        'active_stakings': stakings.filter(is_unlocked=False).count(),
        'completed_stakings': stakings.filter(is_unlocked=True).count(),
        'stakings': [
            {
                'id': s.id,
                'amount': float(s.amount),
                'bonus_received': float(s.bonus_received),
                'referrer_bonus': float(s.referrer_bonus),
                'staked_at': s.staked_at.isoformat(),
                'unlock_date': s.unlock_date.isoformat(),
                'days_remaining': s.days_remaining(),
                'is_unlocked': s.is_unlocked,
                'can_unlock': s.can_unlock(),
                'tx_hash': s.tx_hash
            }
            for s in stakings
        ]
    }, status=status.HTTP_200_OK)


# =========================
# User Stats
# =========================
@api_view(['GET'])
def get_user_stats(request, wallet_address):
    try:
        user = WalletUser.objects.get(wallet_address=wallet_address)
    except WalletUser.DoesNotExist:
        return Response(
            {'error': 'user not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    referrals_count = Referral.objects.filter(referrer=user).count()

    signup_rewards = TokenReward.objects.filter(
        user=user, reward_type='signup_referral'
    ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')

    staking_self_rewards = TokenReward.objects.filter(
        user=user, reward_type='staking_self'
    ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')

    staking_referral_rewards = TokenReward.objects.filter(
        user=user, reward_type='staking_referral'
    ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')

    return Response({
        'referral_code': user.referral_code,
        'referral_link': f'https://cryptoocapitalhub.com?ref={user.referral_code}',
        'total_referrals': referrals_count,
        'token_balance': float(user.token_balance),
        'total_earned': float(user.total_earned),
        'total_staked': float(user.total_staked),
        'reward_breakdown': {
            'from_signups': float(signup_rewards),
            'from_own_staking': float(staking_self_rewards),
            'from_referral_staking': float(staking_referral_rewards)
        }
    }, status=status.HTTP_200_OK)
