import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

axios.defaults.baseURL = 'https://cryptoocapitalhub.com/api';

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalStaked, setTotalStaked] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stakingAmount, setStakingAmount] = useState('0.1');
  const [invoice, setInvoice] = useState(null);
  const [userStakings, setUserStakings] = useState([]);
  const [stats, setStats] = useState(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [signupRewards, setSignupRewards] = useState(0);
  const [referralStakingRewards, setReferralStakingRewards] = useState(0);

  // -------------------------------
  // 1️⃣ گرفتن کد رفرال از URL
  // -------------------------------
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refFromUrl = urlParams.get('ref');
    console.log("🔍 URL Referral Code:", refFromUrl);
    if (refFromUrl) {
      localStorage.setItem('referral_code', refFromUrl);
      setMessage(`🎯 کد رفرال ${refFromUrl} ذخیره شد!`);
    }
  }, []);

  // -------------------------------
  // 2️⃣ وقتی کیف‌پول تغییر کرد
  // -------------------------------
  useEffect(() => {
    if (walletAddress) {
      console.log("🔑 Wallet Address Changed:", walletAddress);
      saveWalletToBackend();
      fetchUserStakings();
    }
  }, [walletAddress]);

  // -------------------------------
  // اتصال تستی
  // -------------------------------
  const connectTestWallet = () => {
    setLoading(true);
    const testAddress = `test_wallet_${Date.now()}`;
    setWalletAddress(testAddress);
    setIsTestMode(true);
    setMessage('🎮 حالت تست فعال شد! کیف‌پول تست ایجاد گردید.');
    setLoading(false);
  };

  // -------------------------------
  // اتصال واقعی MetaMask
  // -------------------------------
  const connectRealWallet = async () => {
    if (!window.ethereum) {
      setMessage('⚠️ لطفا MetaMask را نصب کنید!');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      setIsTestMode(false);
      setMessage('✅ کیف‌پول واقعی با موفقیت وصل شد!');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setMessage('❌ خطا در اتصال به کیف‌پول');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // ذخیره کیف‌پول و رفرال به Backend
  // -------------------------------
  const saveWalletToBackend = async () => {
    setLoading(true);
    try {
      const storedRefCode = localStorage.getItem('referral_code');
      console.log("💾 Sending Referral Code to Backend:", storedRefCode);

      const response = await axios.post('/save-wallet/', {
        wallet_address: walletAddress,
        referral_code: storedRefCode,
        wallet_type: isTestMode ? 'test' : 'ethereum'
      });

      console.log("📦 Backend Response:", response.data);

      setReferralCode(response.data.referral_code);
      setReferralLink(`https://cryptoocapitalhub.com?ref=${response.data.referral_code}`);
      setTokenBalance(response.data.token_balance || 0);
      setTotalEarned(response.data.total_earned || 0);
      setTotalStaked(response.data.total_staked || 0);

      if (response.data.is_new) {
        console.log("🎉 New Wallet Registered");
        if (response.data.referrer_bonus_given) {
          setMessage(`✅ کیف‌پول ثبت شد! بالاسری شما ${response.data.referrer_received} توکن دریافت کرد`);
        } else {
          setMessage('✅ کیف‌پول شما با موفقیت ثبت شد!');
        }
        localStorage.removeItem('referral_code');
      } else {
        setMessage('👋 خوش آمدید باز!');
      }

      await fetchUserStats();

    } catch (error) {
      console.error('❌ Error saving wallet:', error);
      setMessage('❌ خطا در ثبت کیف‌پول');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // دریافت آمار کاربر
  // -------------------------------
  const fetchUserStats = async () => {
    try {
      const response = await axios.get(`/user-stats/${walletAddress}/`);
      console.log("📊 User Stats:", response.data);

      setReferralLink(response.data.referral_link);
      setTotalReferrals(response.data.total_referrals || 0);
      setTokenBalance(response.data.token_balance || 0);
      setTotalEarned(response.data.total_earned || 0);
      setTotalStaked(response.data.total_staked || 0);
      setStats(response.data);

      if (response.data.reward_breakdown) {
        setSignupRewards(response.data.reward_breakdown.from_signups || 0);
        setReferralStakingRewards(response.data.reward_breakdown.from_referral_staking || 0);
      }

    } catch (error) {
      console.error('❌ Error fetching user stats:', error);
    }
  };

  // -------------------------------
  // دریافت لیست استیکینگ‌ها
  // -------------------------------
  const fetchUserStakings = async () => {
    try {
      const response = await axios.get(`/staking/list/${walletAddress}/`);
      console.log("📦 User Stakings:", response.data.stakings);
      setUserStakings(response.data.stakings || []);
    } catch (error) {
      console.error('❌ Error fetching stakings:', error);
    }
  };

  // -------------------------------
  // تست استیکینگ
  // -------------------------------
  const processTestStaking = async () => {
    if (!walletAddress) {
      setMessage('⚠️ لطفا ابتدا کیف‌پول را وصل کنید');
      return;
    }

    const amount = parseFloat(stakingAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage('⚠️ لطفا مبلغ معتبر وارد کنید');
      return;
    }

    try {
      setLoading(true);
      setMessage('⏳ در حال پردازش استیکینگ...');

      const mockTxHash = `test_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const response = await axios.post('/staking/process/', {
        wallet_address: walletAddress,
        amount: stakingAmount,
        tx_hash: mockTxHash
      });

      console.log("📦 Staking Response:", response.data);

      setInvoice(response.data.invoice);

      setMessage(
        `✅ استیکینگ موفق! شما ${response.data.user_bonus.toFixed(4)} توکن پاداش گرفتید` +
        (response.data.referrer_bonus > 0 ? 
          ` و بالاسری شما ${response.data.referrer_bonus.toFixed(4)} توکن دریافت کرد` : '')
      );

      setTokenBalance(response.data.new_token_balance);
      setTotalStaked(response.data.total_staked);
      await fetchUserStats();
      await fetchUserStakings();

      setTimeout(() => setInvoice(null), 10000);

    } catch (error) {
      console.error('❌ Error processing staking:', error);
      setMessage(`❌ خطا در استیکینگ: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // آزادسازی استیکینگ
  // -------------------------------
  const unlockStaking = async (stakingId) => {
    try {
      setLoading(true);
      setMessage('⏳ در حال آزادسازی استیکینگ...');

      const response = await axios.post(`/staking/unlock/${stakingId}/`);
      console.log("📦 Unlock Response:", response.data);

      setMessage(`✅ ${response.data.message}`);
      await fetchUserStats();
      await fetchUserStakings();

    } catch (error) {
      console.error('❌ Error unlocking staking:', error);
      setMessage(`❌ ${error.response?.data?.error || 'خطا در آزادسازی'}`);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // کپی به کلیپ‌بورد
  // -------------------------------
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMessage('📋 کپی شد!');
  };

  // -------------------------------
  // قطع اتصال کیف‌پول
  // -------------------------------
  const disconnectWallet = () => {
    setWalletAddress('');
    setReferralCode('');
    setReferralLink('');
    setTotalReferrals(0);
    setTokenBalance(0);
    setTotalEarned(0);
    setTotalStaked(0);
    setInvoice(null);
    setUserStakings([]);
    setStats(null);
    setIsTestMode(false);
    setSignupRewards(0);
    setReferralStakingRewards(0);
    setMessage('🔌 اتصال قطع شد');
  };

  // -------------------------------
  // کامپوننت تایمر
  // -------------------------------
  const CountdownTimer = ({ unlockDate }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
      const calculateTimeLeft = () => {
        const now = new Date();
        const unlock = new Date(unlockDate);
        const diff = unlock - now;

        if (diff <= 0) return 'آماده برداشت!';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `${days} روز ${hours} ساعت ${minutes} دقیقه`;
      };

      setTimeLeft(calculateTimeLeft());
      const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 60000);
      return () => clearInterval(timer);
    }, [unlockDate]);

    return <span className="countdown">{timeLeft}</span>;
  };

  const totalReferralRewards = signupRewards + referralStakingRewards;

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏦 سیستم استیکینگ هوشمند</h1>
        {/* اینجا می‌تونید بخش UI خودتون رو اضافه کنید */}
        <p>💡 همه لاگ‌ها در کنسول نمایش داده می‌شوند 🔍</p>
      </header>
    </div>
  );
}

export default App;
