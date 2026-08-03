import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function App() {
  // Navigation & Filtering State
  const [currentTab, setCurrentTab] = useState('markets');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  // Hardcoded Time Anchor: August 3, 2026
  const todayDate = new Date('2026-08-03T00:00:00');

  // Core Markets Repository State
  const [markets, setMarkets] = useState(() => {
    const localData = localStorage.getItem('verdict_markets_save');
    if (localData) {
      return JSON.parse(localData);
    }
    return [
      { id: 1, question: "Will sBTC go live on mainnet before September 2026?", category: "Crypto", deadline: "2026-08-25", yesPool: 45000, noPool: 15000, volume: 60000 },
      { id: 2, question: "Will Apple announce a dedicated decentralized AI ecosystem token project this quarter?", category: "AI", deadline: "2026-09-30", yesPool: 12000, noPool: 38000, volume: 50000 },
      { id: 3, question: "Will US policy target non-custodial decentralized hardware storage architectures in August 2026?", category: "Policy", deadline: "2026-08-20", yesPool: 25000, noPool: 25000, volume: 50000 },
      { id: 4, question: "Did the Stacks network achieve hyper-throughput processing latency speeds below 2 seconds?", category: "Tech", deadline: "2026-07-15", yesPool: 68000, noPool: 12000, volume: 80000 }
    ];
  });

  const [selectedMarket, setSelectedMarket] = useState(markets[0] || null);

  // Authentication State
  const [walletConnected, setWalletConnected] = useState(() => {
    return !!localStorage.getItem('verdict_wallet_address');
  });
  const [walletAddress, setWalletAddress] = useState(() => {
    return localStorage.getItem('verdict_wallet_address') || '';
  });
  const [userStats, setUserStats] = useState({
    activePositions: walletConnected ? 2 : 0,
    totalInvested: walletConnected ? 250 : 0,
    netGains: walletConnected ? 45 : 0
  });

  // Modals States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newMarketForm, setNewMarketForm] = useState({
    question: '',
    category: 'Crypto',
    deadline: '2026-08-10',
    initialYes: 100,
    initialNo: 100
  });

  const [quickBetModalOpen, setQuickBetModalOpen] = useState(false);
  const [quickBetMarket, setQuickBetMarket] = useState(null);
  const [quickBetSide, setQuickBetSide] = useState('');
  const [quickBetAmount, setQuickBetAmount] = useState(50);

  // Three.js References
  const canvasContainerRef = useRef(null);
  const meshesRef = useRef({ yes: null, no: null });

  // Sync markets state to localStorage
  useEffect(() => {
    localStorage.setItem('verdict_markets_save', JSON.stringify(markets));
  }, [markets]);

  // Three.js Canvas Init Engine Loop
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    // Fix context re-instantiation duplicates on re-renders
    container.innerHTML = '';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const geometryYes = new THREE.IcosahedronGeometry(1.2, 1);
    const materialYes = new THREE.MeshPhongMaterial({
      color: 0x4ade80,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const meshYes = new THREE.Mesh(geometryYes, materialYes);
    meshYes.position.x = -1.4;
    scene.add(meshYes);

    const geometryNo = new THREE.OctahedronGeometry(1.1, 1);
    const materialNo = new THREE.MeshPhongMaterial({
      color: 0xf87171,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const meshNo = new THREE.Mesh(geometryNo, materialNo);
    meshNo.position.x = 1.4;
    scene.add(meshNo);

    meshesRef.current = { yes: meshYes, no: meshNo };

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      meshYes.rotation.y += 0.01;
      meshYes.rotation.x += 0.005;
      meshNo.rotation.y -= 0.01;
      meshNo.rotation.z += 0.005;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update 3D nodes based on selected market percentage changes
  useEffect(() => {
    const { yes, no } = meshesRef.current;
    if (!yes || !no) return;

    if (!selectedMarket) {
      yes.visible = false;
      no.visible = false;
      return;
    }

    yes.visible = true;
    no.visible = true;

    const total = selectedMarket.yesPool + selectedMarket.noPool;
    const yesRatio = total > 0 ? selectedMarket.yesPool / total : 0.5;
    const noRatio = total > 0 ? selectedMarket.noPool / total : 0.5;

    const scaleYes = 0.4 + yesRatio * 1.4;
    const scaleNo = 0.4 + noRatio * 1.4;

    yes.scale.set(scaleYes, scaleYes, scaleYes);
    no.scale.set(scaleNo, scaleNo, scaleNo);
  }, [selectedMarket]);

  // Handle Wallet Session Connection Updates
  const toggleWallet = () => {
    if (walletConnected) {
      setWalletConnected(false);
      setWalletAddress('');
      localStorage.removeItem('verdict_wallet_address');
      setUserStats({ activePositions: 0, totalInvested: 0, netGains: 0 });
    } else {
      const generatedAddress = "SP" + Math.random().toString(16).substring(2, 10).toUpperCase() + "7W3G85N8V6WQX52P859F5H0G";
      setWalletConnected(true);
      setWalletAddress(generatedAddress);
      localStorage.setItem('verdict_wallet_address', generatedAddress);
      setUserStats({ activePositions: 2, totalInvested: 250, netGains: 45 });
    }
  };

  const truncateWallet = (addr) => {
    if (!addr) return '';
    return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
  };

  // Utilities for Dynamic Evaluation Timelines
  const isMarketActive = (market) => {
    const deadlineDate = new Date(market.deadline + 'T00:00:00');
    return deadlineDate >= todayDate;
  };

  const getMarketTimelineText = (market) => {
    const deadlineDate = new Date(market.deadline + 'T00:00:00');
    const diffTime = deadlineDate - todayDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Closed and resolved for settlement on: ${market.deadline}`;
    } else if (diffDays === 0) {
      return "Closes and locks today! Awaiting confirmation blocks.";
    } else {
      return `Closes in ${diffDays} days (${market.deadline})`;
    }
  };

  const calculateYesPercentage = (market) => {
    const total = market.yesPool + market.noPool;
    if (total === 0) return 50;
    return Math.round((market.yesPool / total) * 100);
  };

  const filteredMarkets = markets.filter(m => {
    const matchesSearch = m.question.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'All' || m.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Mutation Handlers
  const openCreateModal = () => {
    setNewMarketForm({
      question: '',
      category: 'Crypto',
      deadline: '2026-08-10',
      initialYes: 100,
      initialNo: 100
    });
    setCreateModalOpen(true);
  };

  const submitNewMarket = (e) => {
    e.preventDefault();
    if (!newMarketForm.question.trim()) return;

    const newId = markets.length > 0 ? Math.max(...markets.map(m => m.id)) + 1 : 1;
    const totalVolume = newMarketForm.initialYes + newMarketForm.initialNo;

    const freshMarket = {
      id: newId,
      question: newMarketForm.question.trim(),
      category: newMarketForm.category,
      deadline: newMarketForm.deadline,
      yesPool: newMarketForm.initialYes,
      noPool: newMarketForm.initialNo,
      volume: totalVolume
    };

    const updatedMarkets = [freshMarket, ...markets];
    setMarkets(updatedMarkets);
    setSelectedMarket(freshMarket);
    setCreateModalOpen(false);
  };

  const deleteMarket = (id, e) => {
    e.stopPropagation(); // Stop selection bubble on card click triggers
    if (window.confirm("Are you sure you want to remove this prediction market from your local tracking parameters?")) {
      const updatedMarkets = markets.filter(m => m.id !== id);
      setMarkets(updatedMarkets);

      if (selectedMarket && selectedMarket.id === id) {
        setSelectedMarket(updatedMarkets.length > 0 ? updatedMarkets[0] : null);
      }
    }
  };

  const openQuickBet = (market, side) => {
    if (!walletConnected) {
      alert("Please establish a secure cryptographic wallet connection session link before executing mutations.");
      return;
    }
    setQuickBetMarket(market);
    setQuickBetSide(side);
    setQuickBetAmount(50);
    setQuickBetModalOpen(true);
  };

  const submitQuickBet = () => {
    if (quickBetAmount <= 0 || !quickBetMarket) return;

    const updatedMarkets = markets.map(m => {
      if (m.id === quickBetMarket.id) {
        const isYes = quickBetSide === 'YES';
        const nextMarket = {
          ...m,
          yesPool: isYes ? m.yesPool + quickBetAmount : m.yesPool,
          noPool: !isYes ? m.noPool + quickBetAmount : m.noPool,
          volume: m.volume + quickBetAmount
        };
        if (selectedMarket && selectedMarket.id === m.id) {
          setSelectedMarket(nextMarket);
        }
        return nextMarket;
      }
      return m;
    });

    setMarkets(updatedMarkets);
    setUserStats(prev => ({
      ...prev,
      activePositions: prev.activePositions + 1,
      totalInvested: prev.totalInvested + quickBetAmount
    }));
    setQuickBetModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0 text-[#c5c6c7]" style={{ backgroundColor: '#0b0c10', fontFamily: "'Space Grotesk', sans-serif" }}>
      
      {/* HEADER / NAVIGATION */}
      <header className="bg-[#11141a] border-b-4 border-[#1f2833] sticky top-0 z-50 px-4 py-3 md:px-8 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#45f3ff] flex items-center justify-center font-bold text-[#0b0c10] text-xl transform -rotate-3" style={{ border: '3px solid #1f2833' }}>V</div>
          <span className="text-2xl font-bold tracking-wider text-white">VERDICT</span>
          <span className="hidden md:inline-block bg-[#1f2833] text-[#45f3ff] border border-[#45f3ff] text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">Stacks Testnet</span>
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-semibold tracking-wide">
          <button onClick={() => setCurrentTab('markets')} className={`transition ${currentTab === 'markets' ? 'text-[#45f3ff]' : 'text-gray-400 hover:text-white'}`}>MARKETS</button>
          <button onClick={() => setCurrentTab('dashboard')} className={`transition ${currentTab === 'dashboard' ? 'text-[#45f3ff]' : 'text-gray-400 hover:text-white'}`}>DASHBOARD</button>
          <button onClick={() => setCurrentTab('leaderboard')} className={`transition ${currentTab === 'leaderboard' ? 'text-[#45f3ff]' : 'text-gray-400 hover:text-white'}`}>LEADERBOARD</button>
        </nav>

        {/* Wallet Connect Button */}
        <div className="flex items-center space-x-3">
          <button onClick={toggleWallet} 
                  className={`px-4 py-2 font-bold tracking-tight text-xs md:text-sm flex items-center space-x-2 uppercase transition-all duration-150 transform active:translate-x-0.5 active:translate-y-0.5`}
                  style={{ 
                    border: '3px solid #1f2833', 
                    boxShadow: '4px 4px 0px 0px #1f2833',
                    backgroundColor: walletConnected ? '#1f2833' : '#45f3ff',
                    color: walletConnected ? '#ffffff' : '#0b0c10'
                  }}>
            <i className={`fa-solid ${walletConnected ? 'fa-wallet text-green-400' : 'fa-link'}`}></i>
            <span>{walletConnected ? truncateWallet(walletAddress) : 'Connect Stacks Wallet'}</span>
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT CONTEXT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
        {/* LEFT & CENTER COLUMNS: DYNAMIC TABS */}
        <div className="lg:col-span-2 space-y-6">
            
          {/* TOP BAR: SEARCH & CREATE NEW MARKET */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-[#11141a] p-4 animate-layer" style={{ border: '3px solid #1f2833' }}>
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search decentralized dynamic pools..." className="w-full bg-[#0b0c10] border-2 border-[#1f2833] pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#45f3ff] transition font-medium" />
            </div>
            <div className="flex gap-2">
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-[#0b0c10] border-2 border-[#1f2833] px-3 py-2 text-xs md:text-sm font-semibold focus:outline-none text-white">
                <option value="All">All Categories</option>
                <option value="Crypto">Crypto</option>
                <option value="Tech">Tech</option>
                <option value="AI">AI</option>
                <option value="Policy">Policy</option>
              </select>
              <button onClick={openCreateModal} className="bg-[#c3a6ff] text-[#0b0c10] px-4 py-2 font-bold text-xs md:text-sm flex items-center space-x-2 whitespace-nowrap active:translate-x-0.5 active:translate-y-0.5" style={{ border: '3px solid #1f2833', boxShadow: '4px 4px 0px 0px #1f2833' }}>
                <i className="fa-solid fa-plus"></i>
                <span>Create Market</span>
              </button>
            </div>
          </div>

          {/* MARKETS TAB VIEW */}
          {currentTab === 'markets' && (
            <div className="space-y-4">
              {filteredMarkets.map((market) => {
                const active = isMarketActive(market);
                return (
                  <div key={market.id} onClick={() => setSelectedMarket(market)} className="bg-[#11141a] p-5 relative overflow-hidden transition hover:border-gray-600 group cursor-pointer" style={{ border: '3px solid #1f2833', boxShadow: '4px 4px 0px 0px #1f2833' }}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-[#1f2833] text-[#45f3ff] text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 border border-[#45f3ff]/30 rounded">{market.category}</span>
                      <div className="flex items-center space-x-3">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                          {active ? 'Active' : 'Closed'}
                        </span>
                        <button onClick={(e) => deleteMarket(market.id, e)} className="text-gray-500 hover:text-red-400 transition text-sm p-1" title="Delete Market">
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>

                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 leading-tight group-hover:text-[#45f3ff] transition">{market.question}</h3>
                    
                    <p className="text-xs text-gray-400 mb-4 flex items-center">
                      <i className="fa-regular fa-clock mr-1.5"></i>
                      <span>{getMarketTimelineText(market)}</span>
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0b0c10] p-3 border-2 border-dashed border-[#1f2833] text-center mb-4">
                      <div>
                        <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Volume</span>
                        <span className="text-sm font-bold text-white">{market.volume.toLocaleString()} sBTC</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Yes Pool</span>
                        <span className="text-sm font-bold text-green-400">{market.yesPool.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">No Pool</span>
                        <span className="text-sm font-bold text-red-400">{market.noPool.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Chance</span>
                        <span className="text-sm font-bold text-[#c3a6ff]">{calculateYesPercentage(market)}%</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button onClick={(e) => { e.stopPropagation(); openQuickBet(market, 'YES'); }} disabled={!active} className={`flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border-2 border-green-500/30 font-bold py-2 px-4 text-xs uppercase tracking-wider transition flex justify-between items-center ${!active ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <span>Bet YES</span>
                        <span className="font-black">{calculateYesPercentage(market)}%</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openQuickBet(market, 'NO'); }} disabled={!active} className={`flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-2 border-red-500/30 font-bold py-2 px-4 text-xs uppercase tracking-wider transition flex justify-between items-center ${!active ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <span>Bet NO</span>
                        <span className="font-black">{100 - calculateYesPercentage(market)}%</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredMarkets.length === 0 && (
                <div className="text-center p-12 bg-[#11141a] border-2 border-dashed border-[#1f2833]">
                  <i className="fa-solid fa-folder-open text-gray-600 text-4xl mb-3"></i>
                  <p className="text-gray-400 font-medium">No open tracking positions matched your custom metrics parameters.</p>
                </div>
              )}
            </div>
          )}

          {/* DASHBOARD TAB VIEW */}
          {currentTab === 'dashboard' && (
            <div className="bg-[#11141a] p-6 space-y-6" style={{ border: '3px solid #1f2833', boxShadow: '4px 4px 0px 0px #1f2833' }}>
              <h2 className="text-2xl font-black text-white tracking-tight border-b-2 border-[#1f2833] pb-3 flex items-center justify-between">
                <span>YOUR PROTOCOL OVERVIEW</span>
                <i className="fa-solid fa-chart-line text-[#45f3ff]"></i>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-[#0b0c10] p-4" style={{ border: '3px solid #1f2833' }}>
                  <span className="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Active Positions</span>
                  <span className="text-2xl font-black text-[#45f3ff]">{userStats.activePositions}</span>
                </div>
                <div className="bg-[#0b0c10] p-4" style={{ border: '3px solid #1f2833' }}>
                  <span className="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total Allocated Volume</span>
                  <span className="text-2xl font-black text-white">{userStats.totalInvested} sBTC</span>
                </div>
                <div className="bg-[#0b0c10] p-4" style={{ border: '3px solid #1f2833' }}>
                  <span className="block text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Realized Net Gains</span>
                  <span className="text-2xl font-black text-green-400">+{userStats.netGains} STX</span>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-white text-sm tracking-wider uppercase">Open Settlement Contracts</h3>
                <div className="text-xs text-gray-500 p-4 border-2 border-dashed border-[#1f2833] text-center">
                  No actively tracked smart contract settlements are processing confirmations.
                </div>
              </div>
            </div>
          )}

          {/* LEADERBOARD TAB VIEW */}
          {currentTab === 'leaderboard' && (
            <div className="bg-[#11141a] p-6" style={{ border: '3px solid #1f2833', boxShadow: '4px 4px 0px 0px #1f2833' }}>
              <h2 className="text-2xl font-black text-white tracking-tight border-b-2 border-[#1f2833] pb-3 mb-4">GLOBAL PREDICTION RANKS</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr class="border-b border-[#1f2833] text-gray-500 uppercase text-[10px] tracking-wider font-bold">
                      <th className="pb-3">Rank</th>
                      <th className="pb-3">Address Descriptor</th>
                      <th className="pb-3 text-right">Correct Resolves</th>
                      <th className="pb-3 text-right">Volume (sBTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1f2833]/50 text-white font-medium">
                      <td className="py-3 font-bold text-[#45f3ff]">#1</td>
                      <td className="py-3 font-mono text-xs">SP3K...859F</td>
                      <td className="py-3 text-right text-green-400">142</td>
                      <td className="py-3 text-right font-bold">12.450</td>
                    </tr>
                    <tr className="border-b border-[#1f2833]/50 text-white font-medium">
                      <td className="py-3 font-bold text-gray-400">#2</td>
                      <td className="py-3 font-mono text-xs">SP1P...M402</td>
                      <td className="py-3 text-right text-green-400">98</td>
                      <td className="py-3 text-right font-bold">8.120</td>
                    </tr>
                    <tr className="text-white font-medium">
                      <td className="py-3 font-bold text-amber-700">#3</td>
                      <td className="py-3 font-mono text-xs">SP28...W110</td>
                      <td className="py-3 text-right text-green-400">85</td>
                      <td className="py-3 text-right font-bold">5.340</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: INTERACTIVE INSPECTOR PANEL */}
        <div className="space-y-6">
          <div className="bg-[#11141a] p-5 sticky top-24" style={{ border: '3px solid #1f2833', boxShadow: '4px 4px 0px 0px #1f2833' }}>
            <h2 className="text-xl font-black text-white tracking-tight border-b-2 border-[#1f2833] pb-3 mb-4 flex justify-between items-center">
              <span>POOL METRIC INSPECTOR</span>
              <i class="fa-solid fa-cubes text-[#c3a6ff]"></i>
            </h2>
            
            <div id="canvas-container" ref={canvasContainerRef} className="w-full h-48 bg-[#0b0c10] border-2 border-[#1f2833] mb-4 relative overflow-hidden flex items-center justify-center">
              {!selectedMarket && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-10 bg-[#0b0c10]/80">
                  <i className="fa-solid fa-circle-nodes text-gray-700 text-3xl mb-2 animate-spin"></i>
                  <p className="text-xs text-gray-500 font-medium">Select any available pool target matrix card to review active structural 3D distribution metrics.</p>
                </div>
              )}
            </div>

            {selectedMarket && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-1">Inspected Target Question</h4>
                  <p className="text-sm font-bold text-white leading-snug">{selectedMarket.question}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0b0c10] p-3 border border-[#1f2833]">
                    <span className="block text-[10px] text-green-400 font-bold uppercase tracking-wider mb-0.5">Yes Pool Distribution</span>
                    <span className="text-base font-black text-white">{selectedMarket.yesPool.toLocaleString()} Vol</span>
                  </div>
                  <div className="bg-[#0b0c10] p-3 border border-[#1f2833]">
                    <span className="block text-[10px] text-red-400 font-bold uppercase tracking-wider mb-0.5">No Pool Distribution</span>
                    <span className="text-base font-black text-white">{selectedMarket.noPool.toLocaleString()} Vol</span>
                  </div>
                </div>
                <div className="bg-blue-500/5 text-blue-400 border border-blue-500/20 text-[11px] p-2.5 rounded font-medium">
                  <i className="fa-solid fa-circle-info mr-1"></i> Predictions require active block validation confirmations from the underlying Stacks consensus layer before settlement computation takes place.
                </div>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* CREATE NEW POOL MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#11141a] w-full max-w-md p-6 space-y-4" style={{ border: '3px solid #1f2833', boxShadow: '4px 4px 0px 0px #1f2833' }}>
            <div className="flex justify-between items-center border-b-2 border-[#1f2833] pb-3">
              <h3 className="text-xl font-black text-white tracking-tight">DEPLOY NEW PREDICTION CONTRACT</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-500 hover:text-white transition"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <form onSubmit={submitNewMarket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Target Assessment Question</label>
                <input type="text" required value={newMarketForm.question} onChange={(e) => setNewMarketForm({...newMarketForm, question: e.target.value})} placeholder="e.g., Will Stacks layer-1 consensus activation conclude before block 840,000?" className="w-full bg-[#0b0c10] border-2 border-[#1f2833] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#45f3ff]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Category Classification</label>
                  <select value={newMarketForm.category} onChange={(e) => setNewMarketForm({...newMarketForm, category: e.target.value})} className="w-full bg-[#0b0c10] border-2 border-[#1f2833] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#45f3ff]">
                    <option value="Crypto">Crypto</option>
                    <option value="Tech">Tech</option>
                    <option value="AI">AI</option>
                    <option value="Policy">Policy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Settlement Deadline</label>
                  <input type="date" required value={newMarketForm.deadline} onChange={(e) => setNewMarketForm({...newMarketForm, deadline: e.target.value})} className="w-full bg-[#0b0c10] border-2 border-[#1f2833] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#45f3ff]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Initial Yes Liquidity</label>
                  <input type="number" min="10" required value={newMarketForm.initialYes} onChange={(e) => setNewMarketForm({...newMarketForm, initialYes: parseInt(e.target.value) || 0})} className="w-full bg-[#0b0c10] border-2 border-[#1f2833] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#45f3ff]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Initial No Liquidity</label>
                  <input type="number" min="10" required value={newMarketForm.initialNo} onChange={(e) => setNewMarketForm({...newMarketForm, initialNo: parseInt(e.target.value) || 0})} className="w-full bg-[#0b0c10] border-2 border-[#1f2833] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#45f3ff]" />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#45f3ff] text-[#0b0c10] font-bold py-2.5 uppercase tracking-wider text-sm transition active:translate-x-0.5 active:translate-y-0.5" style={{ border: '3px solid #1f2833', boxShadow: '4px 4px 0px 0px #1f2833' }}>
                Broadcast Contract Allocation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QUICK POSITION ENTRY TRANSACTION MODAL */}
      {quickBetModalOpen && quickBetMarket && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#11141a] w-full max-w-sm p-6 space-y-4" style={{ border: '3px solid #1f2833', boxShadow: '4px 4px 0px 0px #1f2833' }}>
            <div className="flex justify-between items-center border-b-2 border-[#1f2833] pb-3">
              <h3 className="text-lg font-black text-white tracking-tight">COMMIT POSITION DISPATCH</h3>
              <button onClick={() => setQuickBetModalOpen(false)} className="text-gray-500 hover:text-white transition"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-bold text-white">{quickBetMarket.question}</p>
              <div className="flex justify-between text-xs font-semibold">
                <span>Selected Allocation Option:</span>
                <span className={`font-bold tracking-widest text-sm ${quickBetSide === 'YES' ? 'text-green-400' : 'text-red-400'}`}>{quickBetSide}</span>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Staking Commitment Amount (sBTC)</label>
                <input type="number" min="1" step="any" value={quickBetAmount} onChange={(e) => setQuickBetAmount(parseFloat(e.target.value) || 0)} className="w-full bg-[#0b0c10] border-2 border-[#1f2833] px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#45f3ff]" />
              </div>
              <button onClick={submitQuickBet} className="w-full bg-[#c3a6ff] text-[#0b0c10] font-bold py-2.5 uppercase tracking-wider text-xs transition active:translate-x-0.5 active:translate-y-0.5" style={{ border: '3px solid #1f2833', boxShadow: '4px 4px 0px 0px #1f2833' }}>
                Execute Cryptographic Authorization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE HUD BUTTON SYSTEM BAR */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-[#11141a] border-t-4 border-[#1f2833] z-40 grid grid-cols-3 text-center text-xs font-bold py-2">
        <button onClick={() => setCurrentTab('markets')} className={`flex flex-col items-center justify-center space-y-0.5 py-1 ${currentTab === 'markets' ? 'text-[#45f3ff]' : 'text-gray-400'}`}>
          <i className="fa-solid fa-gavel text-base"></i>
          <span className="tracking-widest text-[9px] uppercase">Pools</span>
        </button>
        <button onClick={() => setCurrentTab('dashboard')} className={`flex flex-col items-center justify-center space-y-0.5 py-1 ${currentTab === 'dashboard' ? 'text-[#45f3ff]' : 'text-gray-400'}`}>
          <i className="fa-solid fa-chart-simple text-base"></i>
          <span className="tracking-widest text-[9px] uppercase">Metrics</span>
        </button>
        <button onClick={() => setCurrentTab('leaderboard')} className={`flex flex-col items-center justify-center space-y-0.5 py-1 ${currentTab === 'leaderboard' ? 'text-[#45f3ff]' : 'text-gray-400'}`}>
          <i className="fa-solid fa-trophy text-base"></i>
          <span className="tracking-widest text-[9px] uppercase">Ranks</span>
        </button>
      </footer>

    </div>
  );
}
