import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

/* ================= AXIOS CONFIG ================= */
axios.defaults.baseURL = 'https://cryptoocapitalhub.com/api';
axios.defaults.headers.common['Content-Type'] = 'application/json';

/* ================= APP ================= */
function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalStaked, setTotalStaked] = useState(0);
  const [stakingAmount, setStakingAmount] = useState('0.1');
  const [userStakings, setUserStakings] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);

  const [signupRewards, setSignupRewards] = useState(0);
  const [referralStakingRewards, setReferralStakingRewards] = useState(0);

  /* ================= REF FROM URL ================= */
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      localStorage.setItem('referral_code', ref);
      setMessage(`🎯 کد رفرال ${ref} ذخیره شد`);
    }
  }, []);

  /* ================= SAVE WALLET ================= */
  useEffect(() => {
    if (walletAddress) {
      saveWallet();
    }
  }, [walletAddress]);

  const saveWallet = async () => {
    try {
      setLoading(true);
      const refCode = localStorage.getItem('referral_code');

      const res = await axios.post('/save-wallet/', {
        wallet_address: walletAddress,
        referral_code: refCode || null
      });

      setReferralCode(res.data.referral_code);
      setReferralLink(`https://cryptoocapitalhub.com?ref=${res.data.referral_code}`);
      setTokenBalance(res.data.token_balance);
      setTotalEarned(res.data.total_earned);
      setTotalStaked(res.data.total_staked);

      localStorage.removeItem('referral_code');

      await fetchUserStats();
      await fetchUserStakings();

      setMessage(res.data.is_new ? '✅ کیف‌پول ثبت شد' : '👋 خوش آمدید');

    } catch (err) {
      console.error(err);
      setMessage('❌ خطا در ثبت کیف‌پول');
    } finally {
      setLoading(false);
    }
  };

  /* ================= USER STATS ================= */
  const fetchUserStats = async () => {
    const res = await axios.get(`/user-stats/${walletAddress}/`);
    setTotalReferrals(res.data.total_referrals);
    setTokenBalance(res.data.token_balance);
    setTotalEarned(res.data.total_earned);
    setTotalStaked(res.data.total_staked);

    if (res.data.reward_breakdown) {
      setSignupRewards(res.data.reward_breakdown.from_signups || 0);
      setReferralStakingRewards(res.data.reward_breakdown.from_referral_staking || 0);
    }
  };

  /* ================= STAKINGS ================= */
  const fetchUserStakings = async () => {
    const res = await axios.get(`/staking/list/${walletAddress}/`);
    setUserStakings(res.data.stakings || []);
  };

  /* ================= CONNECT ================= */
  const connectTestWallet = () => {
    setWalletAddress(`test_wallet_${Date.now()}`);
    setIsTestMode(true);
  };

  const connectRealWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask نصب نیست');
      return;
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setWalletAddress(accounts[0]);
    setIsTestMode(false);
  };

  /* ================= STAKE ================= */
  const processStaking = async () => {
    try {
      setLoading(true);

      const res = await axios.post('/staking/process/', {
        wallet_address: walletAddress,
        amount: Number(stakingAmount),
        tx_hash: `tx_${Date.now()}`
      });

      setInvoice(res.data.invoice);
      setTokenBalance(res.data.new_token_balance);
      setTotalStaked(res.data.total_staked);

      await fetchUserStats();
      await fetchUserStakings();

      setMessage('✅ استیکینگ موفق');

    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || '❌ خطا در استیکینگ');
    } finally {
      setLoading(false);
    }
  };

  /* ================= UNLOCK ================= */
  const unlockStaking = async (id) => {
    try {
      setLoading(true);
      await axios.post(`/staking/unlock/${id}/`);
      await fetchUserStats();
      await fetchUserStakings();
      setMessage('✅ برداشت انجام شد');
    } catch (err) {
      setMessage(err.response?.data?.error || '❌ خطا');
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="App">
      <h1>🏦 Crypto Capital Hub</h1>

      {!walletAddress ? (
        <>
          <button onClick={connectTestWallet}>🎮 تست</button>
          <button onClick={connectRealWallet}>🦊 MetaMask</button>
        </>
      ) : (
        <>
          <p>آدرس: {walletAddress}</p>
          <p>💰 موجودی: {tokenBalance}</p>

          <input
            value={stakingAmount}
            onChange={e => setStakingAmount(e.target.value)}
            type="number"
          />
          <button onClick={processStaking} disabled={loading}>🚀 استیک</button>

          {userStakings.map(s => (
            <div key={s.id}>
              {s.amount} ETH
              {!s.is_unlocked && s.can_unlock &&
                <button onClick={() => unlockStaking(s.id)}>🔓 برداشت</button>
              }
            </div>
          ))}
        </>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}

export default App;
