import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

axios.defaults.baseURL = 'https://cryptoocapitalhub.com/api';

function App() {
  // حالت‌های اصلی
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

  // 1. بررسی کد رفرال از URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refFromUrl = urlParams.get('ref');
    if (refFromUrl) {
      localStorage.setItem('referral_code', refFromUrl);
      setMessage(`🎯 کد رفرال ${refFromUrl} ذخیره شد!`);
    }
  }, []);

  // 2. وقتی آدرس کیف‌پول تغییر کرد
  useEffect(() => {
    if (walletAddress) {
      saveWalletToBackend();
      fetchUserStakings();
    }
  }, [walletAddress]);

  // 🔧 دکمه تست - بدون نیاز به MetaMask
  const connectTestWallet = () => {
    setLoading(true);
    const testAddress = `test_wallet_${Date.now()}`;
    setWalletAddress(testAddress);
    setIsTestMode(true);
    setMessage('🎮 حالت تست فعال شد! کیف‌پول تست ایجاد گردید.');
    setLoading(false);
  };

  // 🔗 اتصال واقعی MetaMask
  const connectRealWallet = async () => {
    if (!window.ethereum) {
      setMessage('⚠️ لطفا MetaMask را نصب کنید!');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
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

  // 💾 ذخیره کیف‌پول در بک‌اند
  const saveWalletToBackend = async () => {
    setLoading(true);
    try {
      const storedRefCode = localStorage.getItem('referral_code');
      
      const response = await axios.post('/save-wallet/', {
        wallet_address: walletAddress,
        referral_code: storedRefCode,
        wallet_type: isTestMode ? 'test' : 'ethereum'
      });
      
      setReferralCode(response.data.referral_code);
      setReferralLink(`https://cryptoocapitalhub.com?ref=${response.data.referral_code}`);
      setTokenBalance(response.data.token_balance || 0);
      setTotalEarned(response.data.total_earned || 0);
      setTotalStaked(response.data.total_staked || 0);
      
      if (response.data.is_new) {
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
      console.error('Error saving wallet:', error);
      setMessage('❌ خطا در ثبت کیف‌پول');
    } finally {
      setLoading(false);
    }
  };

  // 📊 دریافت آمار کاربر
  const fetchUserStats = async () => {
    try {
      const response = await axios.get(`/user-stats/${walletAddress}/`);
      setReferralLink(response.data.referral_link);
      setTotalReferrals(response.data.total_referrals || 0);
      setTokenBalance(response.data.token_balance || 0);
      setTotalEarned(response.data.total_earned || 0);
      setTotalStaked(response.data.total_staked || 0);
      setStats(response.data);
      
      // دریافت پاداش‌های رفرال
      if (response.data.reward_breakdown) {
        setSignupRewards(response.data.reward_breakdown.from_signups || 0);
        setReferralStakingRewards(response.data.reward_breakdown.from_referral_staking || 0);
      }
      
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // 📦 دریافت لیست استیکینگ‌ها
  const fetchUserStakings = async () => {
    try {
      const response = await axios.get(`/staking/list/${walletAddress}/`);
      setUserStakings(response.data.stakings || []);
    } catch (error) {
      console.error('Error fetching stakings:', error);
    }
  };

  // 💰 دکمه تست استیکینگ
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
      
      setTimeout(() => {
        setInvoice(null);
      }, 10000);
      
    } catch (error) {
      console.error('Error processing staking:', error);
      setMessage(`❌ خطا در استیکینگ: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 🔓 آزادسازی استیکینگ
  const unlockStaking = async (stakingId) => {
    try {
      setLoading(true);
      setMessage('⏳ در حال آزادسازی استیکینگ...');
      
      const response = await axios.post(`/staking/unlock/${stakingId}/`);
      
      setMessage(`✅ ${response.data.message}`);
      await fetchUserStats();
      await fetchUserStakings();
      
    } catch (error) {
      console.error('Error unlocking staking:', error);
      setMessage(`❌ ${error.response?.data?.error || 'خطا در آزادسازی'}`);
    } finally {
      setLoading(false);
    }
  };

  // ⚡ دکمه تست سریع
  const runQuickTest = async () => {
    setLoading(true);
    setMessage('🧪 شروع تست سریع سیستم...');
    
    try {
      const testAddress = `quick_test_${Date.now()}`;
      setWalletAddress(testAddress);
      setIsTestMode(true);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await processTestStaking();
      
      setMessage('🎉 تست سریع کامل شد! سیستم به درستی کار می‌کند.');
      
    } catch (error) {
      setMessage('❌ خطا در تست سریع');
    } finally {
      setLoading(false);
    }
  };

  // 📋 کپی به کلیپ‌بورد
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMessage('📋 کپی شد!');
  };

  // 🔌 قطع اتصال
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

  // 🔄 کامپوننت تایمر معکوس
  const CountdownTimer = ({ unlockDate }) => {
    const [timeLeft, setTimeLeft] = useState('');
    
    useEffect(() => {
      const calculateTimeLeft = () => {
        const now = new Date();
        const unlock = new Date(unlockDate);
        const diff = unlock - now;
        
        if (diff <= 0) {
          return 'آماده برداشت!';
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${days} روز ${hours} ساعت ${minutes} دقیقه`;
      };
      
      setTimeLeft(calculateTimeLeft());
      const timer = setInterval(() => {
        setTimeLeft(calculateTimeLeft());
      }, 60000);
      
      return () => clearInterval(timer);
    }, [unlockDate]);
    
    return <span className="countdown">{timeLeft}</span>;
  };

  // محاسبه پاداش کل رفرال
  const totalReferralRewards = signupRewards + referralStakingRewards;

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏦 سیستم استیکینگ هوشمند</h1>
        
        {!walletAddress ? (
          <div className="connect-section">
            <p>برای شروع، کیف‌پول خود را وصل کنید:</p>
            
            <div className="connect-buttons">
              <button 
                className="connect-button test-button"
                onClick={connectTestWallet}
                disabled={loading}
              >
                {loading ? '⏳ در حال اتصال...' : '🎮 اتصال تستی'}
              </button>
              
              <button 
                className="connect-button real-button"
                onClick={connectRealWallet}
                disabled={loading}
              >
                {loading ? '⏳ در حال اتصال...' : '🦊 اتصال MetaMask'}
              </button>
            </div>
            
            <button 
              className="quick-test-button"
              onClick={runQuickTest}
              disabled={loading}
            >
              ⚡ تست سریع سیستم
            </button>
            
            <p className="test-note">
              💡 <strong>تست سیستم:</strong> می‌توانید بدون نصب MetaMask از دکمه تست استفاده کنید
            </p>
            
            {!window.ethereum && (
              <div className="install-metamask">
                <p>MetaMask نصب نیست! برای اتصال واقعی:</p>
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="install-link">
                  🔗 نصب MetaMask
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="wallet-connected">
            {/* هدر اطلاعات کیف‌پول */}
            <div className="wallet-info">
              <div className="wallet-status">
                <span className={`status-badge ${isTestMode ? 'test' : 'real'}`}>
                  {isTestMode ? '🎮 تست' : '✅ واقعی'}
                </span>
                <p>آدرس: <strong>{walletAddress.slice(0, 15)}...</strong></p>
              </div>
              
              <div className="balance-info">
                <div className="balance-item">
                  <span className="balance-label">💰 موجودی توکن:</span>
                  <span className="balance-value">{tokenBalance.toFixed(4)}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">📈 کل درآمد:</span>
                  <span className="balance-value">{totalEarned.toFixed(4)}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">🏦 کل استیک شده:</span>
                  <span className="balance-value">{totalStaked.toFixed(4)} ETH</span>
                </div>
              </div>
            </div>
            
            {/* بخش استیکینگ */}
            <div className="staking-section">
              <h3>💰 استیکینگ 365 روزه</h3>
              <div className="staking-form">
                <input
                  type="number"
                  value={stakingAmount}
                  onChange={(e) => setStakingAmount(e.target.value)}
                  placeholder="مقدار ETH برای استیک"
                  step="0.01"
                  min="0.01"
                  className="staking-input"
                />
                <button 
                  onClick={processTestStaking}
                  disabled={loading}
                  className="staking-button"
                >
                  {loading ? '⏳ در حال پردازش...' : '🚀 استیک کن'}
                </button>
              </div>
              
              <div className="staking-info">
                <div className="info-card">
                  <h4>🎁 پاداش فوری شما</h4>
                  <p className="info-value">5% از مبلغ استیک</p>
                </div>
                <div className="info-card">
                  <h4>👥 پاداش بالاسری</h4>
                  <p className="info-value">5% از مبلغ استیک</p>
                </div>
                <div className="info-card">
                  <h4>⏳ مدت قفل</h4>
                  <p className="info-value">365 روز</p>
                </div>
              </div>
            </div>
            
            {/* نمایش فاکتور */}
            {invoice && (
              <div className="invoice-section">
                <h3>🧾 فاکتور استیکینگ</h3>
                <div className="invoice-details">
                  <div className="invoice-row">
                    <span>مبلغ استیک:</span>
                    <strong>{invoice.amount} ETH</strong>
                  </div>
                  <div className="invoice-row">
                    <span>پاداش شما (5%):</span>
                    <strong className="bonus">+{invoice.bonus_5_percent.toFixed(4)} توکن</strong>
                  </div>
                  <div className="invoice-row">
                    <span>پاداش بالاسری (5%):</span>
                    <strong>{invoice.referrer_bonus > 0 ? `+${invoice.referrer_bonus.toFixed(4)} توکن` : 'ندارد'}</strong>
                  </div>
                  <div className="invoice-row">
                    <span>مقدار قفل شده (95%):</span>
                    <strong>{invoice.staked_amount.toFixed(4)} ETH</strong>
                  </div>
                  <div className="invoice-row">
                    <span>آزادسازی:</span>
                    <strong className="date">{new Date(invoice.staked_until).toLocaleDateString('fa-IR')}</strong>
                  </div>
                  <div className="invoice-row">
                    <span>شناسه تراکنش:</span>
                    <code className="tx-hash">{invoice.tx_hash.slice(0, 15)}...</code>
                  </div>
                </div>
                <button 
                  onClick={() => setInvoice(null)}
                  className="close-invoice"
                >
                  ✕ بستن فاکتور
                </button>
              </div>
            )}
            
            {/* لیست استیکینگ‌های فعال */}
            {userStakings.length > 0 && (
              <div className="stakings-list">
                <h3>📋 استیکینگ‌های شما</h3>
                <div className="stakings-grid">
                  {userStakings.map((staking) => (
                    <div key={staking.id} className="staking-card">
                      <div className="staking-header">
                        <span className="staking-amount">{staking.amount.toFixed(4)} ETH</span>
                        <span className={`staking-status ${staking.is_unlocked ? 'unlocked' : 'locked'}`}>
                          {staking.is_unlocked ? '✅ آزاد شده' : '🔒 قفل شده'}
                        </span>
                      </div>
                      
                      <div className="staking-details">
                        <div className="detail-row">
                          <span>پاداش دریافتی:</span>
                          <span className="bonus-badge">+{staking.bonus_received.toFixed(4)}</span>
                        </div>
                        <div className="detail-row">
                          <span>پاداش بالاسری:</span>
                          <span>{staking.referrer_bonus > 0 ? `+${staking.referrer_bonus.toFixed(4)}` : 'ندارد'}</span>
                        </div>
                        
                        {!staking.is_unlocked && (
                          <>
                            <div className="detail-row">
                              <span>زمان باقی‌مانده:</span>
                              <CountdownTimer unlockDate={staking.unlock_date} />
                            </div>
                            
                            {staking.can_unlock && (
                              <button 
                                onClick={() => unlockStaking(staking.id)}
                                className="unlock-button"
                              >
                                🏦 برداشت کن
                              </button>
                            )}
                          </>
                        )}
                        
                        {staking.is_unlocked && (
                          <div className="detail-row">
                            <span>آزاد شده در:</span>
                            <span className="date">{new Date(staking.unlock_date).toLocaleDateString('fa-IR')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* بخش رفرال */}
            {referralCode && (
              <div className="referral-section">
                <h3>🎫 سیستم رفرال شما</h3>
                
                {/* آمار رفرال */}
                <div className="referral-stats">
                  <div className="stat-card">
                    <span className="stat-label">👥 زیرمجموعه‌ها</span>
                    <span className="stat-number">{totalReferrals}</span>
                    <div className="stat-note">
                      هر نفر = <strong>3 توکن</strong>
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <span className="stat-label">💰 پاداش ثبت‌نام</span>
                    <span className="stat-number">{signupRewards.toFixed(2)}</span>
                    <div className="stat-note">
                      از ثبت‌نام زیرمجموعه
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <span className="stat-label">💎 پاداش استیکینگ</span>
                    <span className="stat-number">{referralStakingRewards.toFixed(2)}</span>
                    <div className="stat-note">
                      5% از استیک زیرمجموعه
                    </div>
                  </div>
                  
                  <div className="stat-card">
                    <span className="stat-label">📊 کل پاداش رفرال</span>
                    <span className="stat-number total-rewards">{totalReferralRewards.toFixed(2)}</span>
                    <div className="stat-note">
                      جمع کل دریافتی
                    </div>
                  </div>
                </div>
                
                {/* جزئیات پاداش‌ها */}
                <div className="rewards-breakdown">
                  <h4>📊 جزئیات درآمد رفرال</h4>
                  <div className="rewards-list">
                    <div className="reward-item">
                      <span className="reward-label">🎫 از ثبت‌نام زیرمجموعه:</span>
                      <span className="reward-amount">{signupRewards.toFixed(2)} توکن</span>
                      <span className="reward-desc">(هر ثبت‌نام = 3 توکن)</span>
                    </div>
                    <div className="reward-item">
                      <span className="reward-label">💰 از استیکینگ زیرمجموعه:</span>
                      <span className="reward-amount">{referralStakingRewards.toFixed(2)} توکن</span>
                      <span className="reward-desc">(5% از هر استیک)</span>
                    </div>
                    <div className="reward-item">
                      <span className="reward-label">📈 کل درآمد از رفرال:</span>
                      <span className="reward-amount total-earned">{totalReferralRewards.toFixed(2)} توکن</span>
                    </div>
                  </div>
                </div>
                
                {/* کد رفرال */}
                <div className="referral-code-display">
                  <h4>🎯 کد رفرال شما:</h4>
                  <div className="code-container">
                    <code className="referral-code">{referralCode}</code>
                    <button 
                      onClick={() => copyToClipboard(referralCode)}
                      className="copy-button"
                    >
                      📋 کپی کد
                    </button>
                  </div>
                </div>
                
                {/* لینک دعوت */}
                <div className="referral-link">
                  <h4>🔗 لینک دعوت شما:</h4>
                  <div className="link-container">
                    <input 
                      type="text" 
                      value={referralLink} 
                      readOnly 
                      className="link-input"
                    />
                    <button 
                      onClick={() => copyToClipboard(referralLink)}
                      className="copy-button"
                    >
                      🔗 کپی لینک
                    </button>
                  </div>
                </div>
                
                {/* راهنمای پاداش‌ها */}
                <div className="referral-guide">
                  <h4>💡 چگونه درآمدزایی کنید:</h4>
                  <ul className="guide-list">
                    <li>
                      <strong>هر ثبت‌نام زیرمجموعه:</strong>
                      <span className="guide-badge">+3 توکن</span>
                      <span className="guide-desc">(فوری به کیف‌پول شما واریز می‌شود)</span>
                    </li>
                    <li>
                      <strong>هر استیکینگ زیرمجموعه:</strong>
                      <span className="guide-badge">+5% پاداش</span>
                      <span className="guide-desc">(از مبلغ استیک به شما می‌رسد)</span>
                    </li>
                    <li>
                      <strong>استیکینگ خودتان:</strong>
                      <span className="guide-badge">+5% پاداش</span>
                      <span className="guide-desc">(به علاوه 95% بعد از 365 روز)</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
            
            {/* دکمه‌های پایین */}
            <div className="action-buttons">
              <button onClick={disconnectWallet} className="disconnect-button">
                🔌 قطع اتصال
              </button>
              
              {isTestMode && (
                <button 
                  onClick={runQuickTest}
                  className="test-again-button"
                >
                  🔄 تست مجدد
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* پیام‌ها */}
        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : message.includes('❌') ? 'error' : 'info'}`}>
            {message}
          </div>
        )}
        
        {/* اطلاعات تست */}
        {isTestMode && walletAddress && (
          <div className="test-mode-banner">
            🎮 <strong>حالت تست فعال</strong> - همه تراکنش‌ها تستی هستند
          </div>
        )}
      </header>
    </div>
  );
}

export default App;