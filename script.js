/**
 * Memory Matrix: Mind Odyssey
 * 完整的记忆矩阵游戏 - 生产级代码
 * 架构：模块化单文件，事件驱动，LocalStorage 持久化
 */

'use strict';

/* ============================================================
   第一部分：常量与配置
   ============================================================ */

// 九大世界配置
const WORLDS = [
    { id: 'memory-village',   name: 'Memory Village',   levels: '1-10',   accent: '#d4a24e', bg1: '#1a1714', bg2: '#2e2820', particle: '#d4a24e' },
    { id: 'mystic-forest',    name: 'Mystic Forest',    levels: '11-20',  accent: '#5cb87a', bg1: '#121e14', bg2: '#1a2e1e', particle: '#5cb87a' },
    { id: 'crystal-mountain', name: 'Crystal Mountain', levels: '21-30',  accent: '#7aaed4', bg1: '#141820', bg2: '#1c2430', particle: '#7aaed4' },
    { id: 'golden-desert',    name: 'Golden Desert',    levels: '31-40',  accent: '#e8a838', bg1: '#1e1a10', bg2: '#2e2818', particle: '#e8a838' },
    { id: 'deep-ocean',       name: 'Deep Ocean',       levels: '41-50',  accent: '#38a8b0', bg1: '#0e1a1e', bg2: '#142830', particle: '#38a8b0' },
    { id: 'sky-kingdom',      name: 'Sky Kingdom',      levels: '51-60',  accent: '#a8c4e0', bg1: '#161a20', bg2: '#202838', particle: '#a8c4e0' },
    { id: 'space-station',    name: 'Space Station',    levels: '61-70',  accent: '#b0a0c8', bg1: '#161420', bg2: '#201c30', particle: '#b0a0c8' },
    { id: 'galaxy-core',      name: 'Galaxy Core',      levels: '71-80',  accent: '#d480a0', bg1: '#1e1218', bg2: '#301a24', particle: '#d480a0' },
    { id: 'infinity-realm',   name: 'Infinity Realm',   levels: '81+',    accent: '#e0c878', bg1: '#1a1810', bg2: '#2e2a18', particle: '#e0c878' }
];

// 记忆阶层
const TIERS = [
    { name: 'Forgotten',      min: 0,   color: '#6b6054' },
    { name: 'Spark',          min: 50,  color: '#8a7e6e' },
    { name: 'Flame',          min: 150, color: '#d4a24e' },
    { name: 'Beacon',         min: 350, color: '#e8a838' },
    { name: 'Lighthouse',     min: 600, color: '#5cb87a' },
    { name: 'Constellation',  min: 1000,color: '#7aaed4' },
    { name: 'Nexus',          min: 1600,color: '#b0a0c8' },
    { name: 'Transcendent',   min: 2500,color: '#d480a0' },
    { name: 'Eternal Mind',   min: 4000,color: '#e0c878' }
];

// 段位系统
const RANKS = [
    { name: 'Novice',      min: 0,    icon: '●' },
    { name: 'Apprentice',  min: 100,  icon: '●●' },
    { name: 'Scholar',     min: 300,  icon: '◆' },
    { name: 'Sage',        min: 600,  icon: '◆◆' },
    { name: 'Master',      min: 1000, icon: '★' },
    { name: 'Grandmaster', min: 1800, icon: '★★' },
    { name: 'Legend',      min: 3000, icon: '✦' },
    { name: 'Mythic',      min: 5000, icon: '✦✦' }
];

// 成就定义
const ACHIEVEMENTS = [
    { id: 'first_step',    name: 'First Step',        desc: 'Complete level 1',              icon: '🌱', check: s => s.highestLevel >= 1 },
    { id: 'tenacious',     name: 'Tenacious',         desc: 'Reach level 10',               icon: '🔥', check: s => s.highestLevel >= 10 },
    { id: 'explorer',      name: 'Explorer',          desc: 'Reach level 20',               icon: '🗺️', check: s => s.highestLevel >= 20 },
    { id: 'deep_dive',     name: 'Deep Dive',         desc: 'Reach level 40',               icon: '🌊', check: s => s.highestLevel >= 40 },
    { id: 'cosmic',        name: 'Cosmic Traveler',   desc: 'Reach level 60',               icon: '🚀', check: s => s.highestLevel >= 60 },
    { id: 'infinite',      name: 'Infinite Mind',     desc: 'Reach level 80',               icon: '∞',  check: s => s.highestLevel >= 80 },
    { id: 'perfect_5',     name: 'Perfectionist',     desc: '5 perfect levels in a row',    icon: '💎', check: s => s.perfectStreak >= 5 },
    { id: 'combo_10',      name: 'Combo Master',      desc: '10x combo',                    icon: '⚡', check: s => s.maxCombo >= 10 },
    { id: 'score_1k',      name: 'Scorer',            desc: 'Score 1,000 points',           icon: '🎯', check: s => s.bestScore >= 1000 },
    { id: 'score_5k',      name: 'High Scorer',       desc: 'Score 5,000 points',           icon: '🏆', check: s => s.bestScore >= 5000 },
    { id: 'tiles_100',     name: 'Tile Reader',       desc: 'Remember 100 tiles total',     icon: '🧩', check: s => s.totalTilesRemembered >= 100 },
    { id: 'tiles_500',     name: 'Pattern Seer',      desc: 'Remember 500 tiles total',     icon: '👁️', check: s => s.totalTilesRemembered >= 500 },
    { id: 'streak_7',      name: 'Dedicated',         desc: '7-day login streak',           icon: '📅', check: s => s.loginStreak >= 7 },
    { id: 'streak_30',     name: 'Devoted',           desc: '30-day login streak',          icon: '💪', check: s => s.loginStreak >= 30 },
    { id: 'boss_slayer',   name: 'Boss Slayer',       desc: 'Defeat a boss level',          icon: '⚔️', check: s => s.bossesDefeated >= 1 },
    { id: 'boss_master',   name: 'Boss Master',       desc: 'Defeat 5 boss levels',         icon: '👑', check: s => s.bossesDefeated >= 5 },
    { id: 'anomaly',       name: 'Anomaly Witness',   desc: 'Experience a world anomaly',   icon: '🌀', check: s => s.anomaliesEncountered >= 1 },
    { id: 'lucky',         name: 'Lucky Star',        desc: 'Hit a lucky round',            icon: '🍀', check: s => s.luckyRoundsHit >= 1 },
    { id: 'tower_20',      name: 'Tower Climber',     desc: 'Reach floor 20 in Endless Tower', icon: '🗼', check: s => s.towerBest >= 20 },
    { id: 'daily_5',       name: 'Daily Devotee',     desc: 'Complete 5 daily challenges',  icon: '📝', check: s => s.dailiesCompleted >= 5 },
    { id: 'secret_1',      name: 'Hidden Potential',  desc: 'Get 100% accuracy on level 15+', icon: '🔮', check: s => s.secretAccuracy15 },
    { id: 'prestige_1',    name: 'Rebirth',           desc: 'Prestige once',                icon: '🌈', check: s => s.prestigeCount >= 1 },
    { id: 'collection_20', name: 'Collector',         desc: 'Collect 20 museum artifacts',  icon: '🏛️', check: s => s.museumItems.length >= 20 },
    { id: 'speed_demon',   name: 'Speed Demon',       desc: 'Complete level 10+ in under 3s', icon: '💨', check: s => s.speedDemon }
];

// 可解锁称号
const TITLES = [
    { id: 'default',    name: 'Mind Explorer',    unlock: null },
    { id: 'tenacious',  name: 'The Tenacious',    unlock: s => s.highestLevel >= 10 },
    { id: 'sage',       name: 'Memory Sage',      unlock: s => s.highestLevel >= 30 },
    { id: 'combo_king', name: 'Combo Sovereign',  unlock: s => s.maxCombo >= 10 },
    { id: 'perfect',    name: 'The Flawless',     unlock: s => s.perfectStreak >= 5 },
    { id: 'boss_slayer',name: 'Boss Slayer',      unlock: s => s.bossesDefeated >= 3 },
    { id: 'cosmic',     name: 'Cosmic Mind',      unlock: s => s.highestLevel >= 60 },
    { id: 'eternal',    name: 'Eternal',          unlock: s => s.prestigeCount >= 1 }
];

// DNA 维度
const DNA_DIMS = [
    { id: 'spatial',    name: 'Spatial',     color: '#7aaed4' },
    { id: 'sequence',   name: 'Sequence',    color: '#5cb87a' },
    { id: 'speed',      name: 'Speed',       color: '#e8a838' },
    { id: 'endurance',  name: 'Endurance',   color: '#d480a0' },
    { id: 'precision',  name: 'Precision',   color: '#b0a0c8' }
];

// 异常事件池
const ANOMALIES = [
    { id: 'time_warp',    name: 'Time Warp',       desc: 'Memorization time halved!',     effect: 'halve_time' },
    { id: 'lucky_round',  name: 'Lucky Round',     desc: 'Double score this level!',      effect: 'double_score' },
    { id: 'extra_life',   name: 'Life Spark',      desc: 'Gained an extra life!',         effect: 'extra_life' },
    { id: 'tile_ghost',   name: 'Phantom Tiles',   desc: 'Fake tiles appear briefly!',    effect: 'ghost_tiles' },
    { id: 'memory_boost', name: 'Memory Surge',    desc: 'Focus bar starts full!',        effect: 'focus_full' }
];

// 季节事件（基于月份）
function getSeasonalEvent() {
    const m = new Date().getMonth();
    if (m >= 2 && m <= 4) return { name: 'Spring Bloom', desc: 'Bonus tiles remembered count doubled!', icon: '🌸' };
    if (m >= 5 && m <= 7) return { name: 'Summer Blaze', desc: 'Score multiplier x1.5!', icon: '☀️' };
    if (m >= 8 && m <= 10) return { name: 'Autumn Harvest', desc: 'Extra reward tokens!', icon: '🍂' };
    return { name: 'Winter Frost', desc: 'Slower memorization fade-out!', icon: '❄️' };
}

/* ============================================================
   第二部分：工具函数
   ============================================================ */

// 基于种子的伪随机数生成器（用于每日/周挑战一致性）
function seededRandom(seed) {
    let s = seed;
    return function() {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

// 获取今日种子
function getDaySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// 获取本周种子
function getWeekSeed() {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
    return d.getFullYear() * 100 + week;
}

// 格式化时间
function formatTime(ms) {
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
}

// 格式化数字
function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

// 日期字符串
function dateStr() {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// 洗牌
function shuffle(arr, rng) {
    const r = rng || Math.random;
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// 计算等级参数
function getLevelParams(level, isBoss) {
    // 网格大小递增
    let gridSize;
    if (level <= 3) gridSize = 3;
    else if (level <= 7) gridSize = 4;
    else if (level <= 12) gridSize = 5;
    else if (level <= 20) gridSize = 6;
    else if (level <= 30) gridSize = 7;
    else gridSize = 8;

    // 激活瓦片数量（Boss 关卡更多）
    const totalTiles = gridSize * gridSize;
    const baseCount = Math.min(Math.floor(2 + level * 0.8), Math.floor(totalTiles * 0.55));
    const tileCount = isBoss ? Math.min(baseCount + 3, Math.floor(totalTiles * 0.65)) : baseCount;

    // 记忆时间（毫秒）
    let memTime;
    if (level <= 3) memTime = 2000;
    else if (level <= 10) memTime = 1800 - (level - 3) * 50;
    else if (level <= 20) memTime = 1400 - (level - 10) * 30;
    else if (level <= 40) memTime = 1000 - (level - 20) * 10;
    else memTime = Math.max(500, 800 - (level - 40) * 5);

    // 是否有特殊机制
    let mechanic = null;
    if (level >= 11 && level < 20 && level % 3 === 0) mechanic = 'rotate';
    if (level >= 20 && level % 4 === 0) mechanic = 'mirror';
    if (level >= 30 && level % 5 === 0) mechanic = 'rotate';
    if (level >= 40 && level % 3 === 0) mechanic = 'mirror';
    if (level >= 50) mechanic = (level % 2 === 0) ? 'rotate' : 'mirror';

    return { gridSize, tileCount: Math.max(1, tileCount), memTime: Math.max(400, memTime), mechanic, totalTiles };
}

// 获取所在世界
function getWorld(level) {
    const idx = Math.min(Math.floor((level - 1) / 10), WORLDS.length - 1);
    return WORLDS[idx];
}

// 获取段位
function getRank(totalScore) {
    let r = RANKS[0];
    for (const rank of RANKS) {
        if (totalScore >= rank.min) r = rank;
    }
    return r;
}

// 获取记忆阶层
function getTier(totalScore) {
    let t = TIERS[0];
    for (const tier of TIERS) {
        if (totalScore >= tier.min) t = tier;
    }
    return t;
}

// 获取下一阶层
function getNextTier(totalScore) {
    for (const tier of TIERS) {
        if (totalScore < tier.min) return tier;
    }
    return null;
}

// 旋转坐标（90度顺时针）
function rotateCoord(r, c, size) {
    return { r: c, c: size - 1 - r };
}

// 镜像坐标（水平镜像）
function mirrorCoord(r, c, size) {
    return { r: r, c: size - 1 - c };
}

/* ============================================================
   第三部分：存档系统
   ============================================================ */

const SAVE_KEY = 'memory_matrix_odyssey_save';

// 默认存档数据
function defaultSave() {
    return {
        version: 1,
        // 核心统计
        highestLevel: 0,
        bestScore: 0,
        totalGamesPlayed: 0,
        totalTilesRemembered: 0,
        totalPlaytime: 0,
        maxCombo: 0,
        perfectStreak: 0,
        currentPerfectStreak: 0,
        bossesDefeated: 0,
        anomaliesEncountered: 0,
        luckyRoundsHit: 0,
        dailiesCompleted: 0,
        towerBest: 0,
        prestigeCount: 0,
        museumItems: [],
        secretAccuracy15: false,
        speedDemon: false,

        // DNA 配置
        dna: { spatial: 30, sequence: 30, speed: 30, endurance: 30, precision: 30 },

        // 成就
        achievements: [],

        // 解锁称号
        unlockedTitles: ['default'],
        activeTitle: 'default',

        // 登录
        lastLoginDate: null,
        loginStreak: 0,
        lastRewardClaimed: null,

        // 每日挑战
        dailyCompleted: {},   // { "2024-01-15": true }
        dailyBest: {},        // { "2024-01-15": 850 }

        // 周挑战
        weeklyCompleted: {},
        weeklyBest: {},

        // 无尽塔
        towerHighScore: 0,

        // 遗留时间线
        legacy: [],

        // 设置
        settings: { sfx: true, music: true, animations: true, focusTracker: true },

        // 当前游戏会话（不保存）
        _session: null
    };
}

// 加载存档
function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return defaultSave();
        const data = JSON.parse(raw);
        // 合并默认值以处理版本升级
        const def = defaultSave();
        for (const key in def) {
            if (!(key in data)) data[key] = def[key];
        }
        if (!data.dna) data.dna = def.dna;
        if (!data.achievements) data.achievements = [];
        if (!data.museumItems) data.museumItems = [];
        if (!data.dailyCompleted) data.dailyCompleted = {};
        if (!data.dailyBest) data.dailyBest = {};
        if (!data.weeklyCompleted) data.weeklyCompleted = {};
        if (!data.weeklyBest) data.weeklyBest = {};
        if (!data.legacy) data.legacy = [];
        if (!data.settings) data.settings = def.settings;
        return data;
    } catch (e) {
        console.warn('存档加载失败，使用默认数据', e);
        return defaultSave();
    }
}

// 保存存档
function saveSave() {
    try {
        const data = { ...save };
        delete data._session; // 不保存会话数据
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('存档保存失败', e);
    }
}

// 全局存档对象
let save = loadSave();

/* ============================================================
   第四部分：音频系统（Web Audio API 合成）
   ============================================================ */

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return audioCtx;
}

function playTone(freq, duration, type, vol) {
    if (!save.settings.sfx) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch(e) {}
}

const SFX = {
    tileLit:    () => playTone(660, 0.12, 'sine', 0.1),
    tileCorrect:() => playTone(880, 0.15, 'sine', 0.1),
    tileWrong:  () => playTone(220, 0.3, 'square', 0.08),
    levelUp:    () => { playTone(523, 0.12, 'sine', 0.1); setTimeout(() => playTone(659, 0.12, 'sine', 0.1), 100); setTimeout(() => playTone(784, 0.2, 'sine', 0.12), 200); },
    gameOver:   () => { playTone(392, 0.2, 'sine', 0.1); setTimeout(() => playTone(330, 0.2, 'sine', 0.1), 150); setTimeout(() => playTone(262, 0.4, 'sine', 0.1), 300); },
    achievement:() => { playTone(784, 0.1, 'sine', 0.1); setTimeout(() => playTone(988, 0.1, 'sine', 0.1), 80); setTimeout(() => playTone(1175, 0.25, 'sine', 0.12), 160); },
    click:      () => playTone(500, 0.06, 'sine', 0.06),
    reward:     () => { playTone(700, 0.1, 'triangle', 0.1); setTimeout(() => playTone(900, 0.15, 'triangle', 0.1), 100); }
};

/* ============================================================
   第五部分：背景粒子系统
   ============================================================ */

const particleCanvas = document.getElementById('bg-particles');
const pCtx = particleCanvas.getContext('2d');
let particles = [];
let particleColor = '#d4a24e';
let animFrameId = null;

function resizeParticleCanvas() {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
}

function initParticles() {
    resizeParticleCanvas();
    particles = [];
    const count = Math.min(35, Math.floor(window.innerWidth * window.innerHeight / 25000));
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * particleCanvas.width,
            y: Math.random() * particleCanvas.height,
            r: Math.max(1, Math.random() * 2.5 + 0.5),
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3 - 0.15,
            alpha: Math.random() * 0.4 + 0.1,
            pulse: Math.random() * Math.PI * 2
        });
    }
}

function animateParticles() {
    if (!save.settings.animations) {
        pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        animFrameId = requestAnimationFrame(animateParticles);
        return;
    }
    pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    const w = particleCanvas.width;
    const h = particleCanvas.height;

    for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.015;
        const a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));

        // 边界循环
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        pCtx.beginPath();
        pCtx.arc(p.x, p.y, Math.max(0.5, p.r), 0, Math.PI * 2);
        pCtx.fillStyle = particleColor;
        pCtx.globalAlpha = Math.max(0, Math.min(1, a));
        pCtx.fill();
    }
    pCtx.globalAlpha = 1;
    animFrameId = requestAnimationFrame(animateParticles);
}

function setWorldTheme(worldId) {
    const world = WORLDS.find(w => w.id === worldId) || WORLDS[0];
    document.documentElement.setAttribute('data-world', worldId);
    particleColor = world.particle;
}

window.addEventListener('resize', resizeParticleCanvas);

/* ============================================================
   第六部分：UI 管理器
   ============================================================ */

const screens = {};
let currentScreen = 'menu';
let screenHistory = [];

function registerScreens() {
    document.querySelectorAll('.screen').forEach(el => {
        screens[el.id.replace('screen-', '')] = el;
    });
}

function showScreen(name, pushHistory) {
    if (pushHistory !== false && currentScreen && currentScreen !== name) {
        screenHistory.push(currentScreen);
    }
    // 隐藏所有
    Object.values(screens).forEach(s => {
        s.classList.remove('active', 'slide-in');
    });
    // 显示目标
    const target = screens[name];
    if (target) {
        target.classList.add('active', 'slide-in');
        // 强制重排以触发动画
        void target.offsetWidth;
    }
    currentScreen = name;

    // 更新标题
    const titles = {
        menu: 'Memory Matrix',
        game: 'Playing',
        result: 'Results',
        profiles: 'Brain Report',
        trophies: 'Trophy Room',
        museum: 'Memory Museum',
        daily: 'Daily Challenge',
        weekly: 'Weekly Challenge',
        tower: 'Endless Tower',
        settings: 'Settings'
    };
    document.getElementById('page-title').textContent = titles[name] || 'Memory Matrix';

    // 返回按钮显示逻辑
    document.getElementById('btn-back').style.visibility = name === 'menu' ? 'hidden' : 'visible';
}

function goBack() {
    if (screenHistory.length > 0) {
        const prev = screenHistory.pop();
        showScreen(prev, false);
        // 刷新对应页面内容
        if (prev === 'menu') renderMenu();
        if (prev === 'profiles') renderProfiles();
        if (prev === 'trophies') renderTrophies();
        if (prev === 'museum') renderMuseum();
        if (prev === 'daily') renderDaily();
        if (prev === 'weekly') renderWeekly();
        if (prev === 'tower') renderTower();
    } else {
        showScreen('menu', false);
        renderMenu();
    }
}

// 模态框
function showModal(title, body, actions) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    let html = `<div class="modal-title">${title}</div><div class="modal-body">${body}</div>`;
    if (actions && actions.length) {
        html += '<div class="modal-actions">';
        for (const act of actions) {
            html += `<button class="menu-btn ${act.primary ? 'primary' : ''} ${act.danger ? 'danger' : ''} small" data-modal-action="${act.id}">${act.label}</button>`;
        }
        html += '</div>';
    }
    content.innerHTML = html;
    overlay.style.display = 'flex';

    // 绑定模态框按钮
    content.querySelectorAll('[data-modal-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const actionId = btn.getAttribute('data-modal-action');
            overlay.style.display = 'none';
            if (actions) {
                const act = actions.find(a => a.id === actionId);
                if (act && act.callback) act.callback();
            }
        });
    });
}

function hideModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

// Toast 通知
function showToast(text, type) {
    const cls = type === 'lucky' ? 'lucky-banner' : 'anomaly-toast';
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
}

/* ============================================================
   第七部分：游戏核心引擎
   ============================================================ */

const GameState = {
    IDLE: 'idle',
    MEMORIZE: 'memorize',
    RECALL: 'recall',
    ANIMATING: 'animating',
    COMPLETE: 'complete',
    FAILED: 'failed'
};

let game = {
    state: GameState.IDLE,
    mode: 'normal',       // 'normal', 'daily', 'weekly', 'tower'
    level: 1,
    score: 0,
    lives: 3,
    combo: 0,
    gridSize: 3,
    pattern: [],          // 正确的瓦片坐标 [{r, c}]
    displayPattern: [],   // 可能经过变换后的显示模式
    playerSelections: [],
    correctCount: 0,
    wrongCount: 0,
    missedTiles: [],
    falsePositives: [],
    isBoss: false,
    mechanic: null,
    memTime: 2000,
    focusLevel: 100,
    focusDecay: 0,
    timerStart: 0,
    timerInterval: null,
    levelStartTime: 0,
    levelTime: 0,
    scoreMultiplier: 1,
    ghostTiles: [],
    anomalyActive: null,
    towerFloor: 0
};

// 开始新游戏
function startGame(mode, startLevel) {
    const lvl = startLevel || 1;
    game.mode = mode || 'normal';
    game.level = lvl;
    game.score = 0;
    game.lives = mode === 'tower' ? 1 : 3;
    game.combo = 0;
    game.focusLevel = 100;
    game.towerFloor = mode === 'tower' ? 0 : 0;
    game.anomalyActive = null;

    // 设置世界主题
    setWorldTheme(getWorld(lvl).id);
    showScreen('game');
    startLevel();
}

// 开始单个关卡
function startLevel() {
    const isBoss = game.level % 10 === 0;
    game.isBoss = isBoss;
    const params = getLevelParams(game.level, isBoss);
    game.gridSize = params.gridSize;
    game.memTime = params.memTime;
    game.mechanic = params.mechanic;
    game.playerSelections = [];
    game.correctCount = 0;
    game.wrongCount = 0;
    game.missedTiles = [];
    game.falsePositives = [];
    game.ghostTiles = [];
    game.scoreMultiplier = 1;

    // 更新世界主题
    setWorldTheme(getWorld(game.level).id);

    // 检查异常事件（5% 概率，非 Boss 关卡）
    if (!isBoss && Math.random() < 0.05) {
        const anomaly = ANOMALIES[Math.floor(Math.random() * ANOMALIES.length)];
        game.anomalyActive = anomaly;
        save.anomaliesEncountered++;
        showToast(`${anomaly.name}: ${anomaly.desc}`, 'anomaly');

        // 应用异常效果
        if (anomaly.effect === 'halve_time') game.memTime = Math.max(300, Math.floor(game.memTime * 0.5));
        if (anomaly.effect === 'double_score') game.scoreMultiplier = 2;
        if (anomaly.effect === 'extra_life' && game.mode !== 'tower') game.lives = Math.min(game.lives + 1, 5);
        if (anomaly.effect === 'focus_full') game.focusLevel = 100;
        if (anomaly.effect === 'lucky_round') { game.scoreMultiplier = 2; save.luckyRoundsHit++; showToast('Lucky Round! Double Score!', 'lucky'); }
    }

    // 幽灵瓦片效果
    if (game.anomalyActive && game.anomalyActive.effect === 'ghost_tiles') {
        const ghostCount = Math.max(1, Math.floor(params.tileCount * 0.3));
        const allPositions = [];
        for (let r = 0; r < params.gridSize; r++) {
            for (let c = 0; c < params.gridSize; c++) {
                allPositions.push({ r, c });
            }
        }
        game.ghostTiles = shuffle(allPositions).slice(0, ghostCount);
    }

    // 生成随机模式
    const allPositions = [];
    for (let r = 0; r < params.gridSize; r++) {
        for (let c = 0; c < params.gridSize; c++) {
            allPositions.push({ r, c });
        }
    }
    game.pattern = shuffle(allPositions).slice(0, params.tileCount);

    // 应用机制变换
    if (game.mechanic === 'rotate') {
        game.displayPattern = game.pattern.map(p => rotateCoord(p.r, p.c, params.gridSize));
    } else if (game.mechanic === 'mirror') {
        game.displayPattern = game.pattern.map(p => mirrorCoord(p.r, p.c, params.gridSize));
    } else {
        game.displayPattern = [...game.pattern];
    }

    // 渲染网格
    renderGrid();
    updateHUD();

    // 显示机制标签
    const mechLabel = document.getElementById('game-mechanic-label');
    if (game.mechanic === 'rotate') {
        mechLabel.textContent = 'Pattern is ROTATED 90 degrees';
        mechLabel.style.display = 'block';
    } else if (game.mechanic === 'mirror') {
        mechLabel.textContent = 'Pattern is MIRRORED horizontally';
        mechLabel.style.display = 'block';
    } else {
        mechLabel.style.display = 'none';
    }

    // 显示 Boss 标签
    const msgEl = document.getElementById('game-message');
    if (isBoss) {
        msgEl.textContent = `BOSS LEVEL ${game.level}`;
        msgEl.style.display = 'block';
        msgEl.style.color = 'var(--danger)';
    } else if (game.level === 1 && game.mode === 'normal') {
        msgEl.textContent = 'Memorize the pattern';
        msgEl.style.display = 'block';
        msgEl.style.color = 'var(--world-accent, var(--accent))';
    } else {
        msgEl.style.display = 'none';
    }

    // 焦点条显示
    const focusInd = document.getElementById('focus-indicator');
    focusInd.style.display = save.settings.focusTracker ? 'flex' : 'none';
    updateFocusBar();

    // 开始记忆阶段
    game.state = GameState.MEMORIZE;
    game.levelStartTime = performance.now();

    // 逐个点亮瓦片
    lightUpPattern();
}

// 渲染网格
function renderGrid() {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${game.gridSize}, 1fr)`;

    for (let r = 0; r < game.gridSize; r++) {
        for (let c = 0; c < game.gridSize; c++) {
            const tile = document.createElement('div');
            tile.className = 'tile disabled';
            tile.dataset.r = r;
            tile.dataset.c = c;
            tile.setAttribute('role', 'gridcell');
            tile.setAttribute('aria-label', `Tile row ${r + 1} column ${c + 1}`);
            tile.addEventListener('click', () => onTileClick(r, c, tile));
            grid.appendChild(tile);
        }
    }
}

// 逐个点亮模式
function lightUpPattern() {
    const tiles = document.querySelectorAll('.tile');
    const displaySet = new Set(game.displayPattern.map(p => `${p.r},${p.c}`));
    const ghostSet = new Set(game.ghostTiles.map(p => `${p.r},${p.c}`));
    let idx = 0;

    function lightNext() {
        if (idx >= game.displayPattern.length) {
            // 所有真实瓦片已点亮，等待后开始淡出
            setTimeout(() => fadeOutPattern(), 300);
            return;
        }
        const p = game.displayPattern[idx];
        const tileEl = getTileElement(p.r, p.c);
        if (tileEl) {
            tileEl.classList.add(game.isBoss ? 'boss-lit' : 'lit');
            SFX.tileLit();
        }
        idx++;
        setTimeout(lightNext, 80);
    }

    // 同时短暂显示幽灵瓦片
    if (ghostSet.size > 0) {
        setTimeout(() => {
            ghostSet.forEach(key => {
                const [gr, gc] = key.split(',').map(Number);
                const tileEl = getTileElement(gr, gc);
                if (tileEl && !displaySet.has(key)) {
                    tileEl.classList.add('lit');
                    setTimeout(() => {
                        tileEl.classList.remove('lit');
                        tileEl.classList.add('fade-out');
                    }, 400);
                }
            });
        }, 200);
    }

    setTimeout(lightNext, 400);
}

// 淡出模式
function fadeOutPattern() {
    const displaySet = new Set(game.displayPattern.map(p => `${p.r},${p.c}`));
    const tiles = document.querySelectorAll('.tile');

    tiles.forEach(t => {
        if (t.classList.contains('lit') || t.classList.contains('boss-lit')) {
            t.classList.add('fade-out');
            t.classList.remove('lit', 'boss-lit');
        }
    });

    // 等待记忆时间后进入回忆阶段
    const msgEl = document.getElementById('game-message');
    setTimeout(() => {
        tiles.forEach(t => {
            t.classList.remove('fade-out', 'disabled');
        });
        game.state = GameState.RECALL;
        msgEl.textContent = 'Recreate the pattern';
        msgEl.style.display = 'block';
        msgEl.style.color = 'var(--world-accent, var(--accent))';

        // 开始计时
        game.timerStart = performance.now();
        if (game.timerInterval) clearInterval(game.timerInterval);
        game.timerInterval = setInterval(updateTimer, 100);

        // 焦点衰减开始
        game.focusDecay = setInterval(() => {
            if (game.state === GameState.RECALL) {
                game.focusLevel = Math.max(0, game.focusLevel - 2);
                updateFocusBar();
            }
        }, 500);
    }, game.memTime);
}

// 获取瓦片 DOM 元素
function getTileElement(r, c) {
    return document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
}

// 瓦片点击处理
function onTileClick(r, c, tileEl) {
    if (game.state !== GameState.RECALL) return;
    if (tileEl.classList.contains('correct') || tileEl.classList.contains('wrong')) return;

    const key = `${r},${c}`;
    const patternSet = new Set(game.pattern.map(p => `${p.r},${p.c}`));
    const alreadySelected = game.playerSelections.includes(key);

    if (alreadySelected) {
        // 取消选择
        game.playerSelections = game.playerSelections.filter(k => k !== key);
        tileEl.classList.remove('correct');
        tileEl.style.background = '';
        tileEl.style.borderColor = '';
        tileEl.style.boxShadow = '';
        return;
    }

    game.playerSelections.push(key);

    if (patternSet.has(key)) {
        // 正确
        tileEl.classList.add('correct');
        SFX.tileCorrect();
        game.correctCount++;
        game.combo++;
        if (game.combo > save.maxCombo) save.maxCombo = game.combo;

        // 更新连击显示
        if (game.combo >= 2) {
            const comboEl = document.getElementById('hud-combo');
            comboEl.style.display = 'block';
            document.getElementById('combo-count').textContent = game.combo;
            // 重新触发动画
            comboEl.style.animation = 'none';
            void comboEl.offsetWidth;
            comboEl.style.animation = '';
        }
    } else {
        // 错误
        tileEl.classList.add('wrong');
        SFX.tileWrong();
        game.wrongCount++;
        game.falsePositives.push({ r, c });
        game.combo = 0;
        document.getElementById('hud-combo').style.display = 'none';

        // 减少生命
        game.lives--;
        updateHUD();

        if (game.lives <= 0) {
            // 游戏结束
            endGame(false);
            return;
        }
    }

    // 检查是否选择了足够多的瓦片
    const totalNeeded = game.pattern.length;
    if (game.playerSelections.length >= totalNeeded || game.correctCount === totalNeeded) {
        // 关卡结束
        endLevel();
    }
}

// 关卡结束
function endLevel() {
    game.state = GameState.ANIMATING;
    clearInterval(game.timerInterval);
    clearInterval(game.focusDecay);
    game.levelTime = performance.now() - game.levelStartTime;

    // 计算遗漏的瓦片
    const patternSet = new Set(game.pattern.map(p => `${p.r},${p.c}`));
    const selectedSet = new Set(game.playerSelections);
    game.missedTiles = [];
    patternSet.forEach(key => {
        if (!selectedSet.has(key)) {
            const [r, c] = key.split(',').map(Number);
            game.missedTiles.push({ r, c });
            const tileEl = getTileElement(r, c);
            if (tileEl) tileEl.classList.add('missed');
        }
    });

    const totalTiles = game.pattern.length;
    const accuracy = totalTiles > 0 ? game.correctCount / totalTiles : 0;
    const isPerfect = accuracy === 1 && game.wrongCount === 0;

    if (isPerfect) {
        save.currentPerfectStreak++;
        if (save.currentPerfectStreak > save.perfectStreak) {
            save.perfectStreak = save.currentPerfectStreak;
        }
    } else {
        save.currentPerfectStreak = 0;
    }

    // 计算分数
    let levelScore = 0;
    levelScore += game.correctCount * 10;                           // 基础分
    levelScore += game.combo * 5;                                    // 连击分
    if (isPerfect) levelScore += 50;                                 // 完美奖励
    if (game.isBoss) levelScore = Math.floor(levelScore * 1.5);     // Boss 加成
    levelScore = Math.floor(levelScore * game.scoreMultiplier);      // 异常/幸运加成
    levelScore = Math.floor(levelScore * (game.focusLevel / 100 + 0.5)); // 焦点加成

    game.score += levelScore;

    // 更新存档统计
    save.totalTilesRemembered += game.correctCount;
    if (game.score > save.bestScore) save.bestScore = game.score;
    if (game.level > save.highestLevel) save.highestLevel = game.level;
    if (game.level >= 10 && game.levelTime < 3000) save.speedDemon = true;
    if (game.level >= 15 && accuracy >= 1) save.secretAccuracy15 = true;
    if (game.isBoss && isPerfect) save.bossesDefeated++;

    // 更新 DNA
    updateDNA(accuracy, game.levelTime, game.combo, game.gridSize, isPerfect);

    // 添加博物馆物品
    addMuseumItem(game.level, getWorld(game.level));

    // 添加遗留时间线条目
    if (game.level % 5 === 0 || game.isBoss) {
        save.legacy.push({
            level: game.level,
            score: game.score,
            world: getWorld(game.level).name,
            date: dateStr(),
            perfect: isPerfect
        });
        if (save.legacy.length > 50) save.legacy = save.legacy.slice(-50);
    }

    // 保存
    saveSave();

    // 检查新成就
    const newAchievements = checkAchievements();

    // 短暂展示后进入下一关
    const msgEl = document.getElementById('game-message');
    if (isPerfect) {
        msgEl.textContent = 'Perfect!';
        msgEl.style.color = 'var(--success)';
    } else if (accuracy >= 0.7) {
        msgEl.textContent = 'Level Complete';
        msgEl.style.color = 'var(--world-accent, var(--accent))';
    } else {
        msgEl.textContent = 'Level Passed';
        msgEl.style.color = 'var(--warning)';
    }
    msgEl.style.display = 'block';

    SFX.levelUp();

    setTimeout(() => {
        game.level++;
        if (game.mode === 'tower') game.towerFloor++;
        startLevel();
    }, isPerfect ? 1200 : 900);
}

// 游戏结束
function endGame(isWin) {
    game.state = GameState.FAILED;
    clearInterval(game.timerInterval);
    clearInterval(game.focusDecay);
    game.levelTime = performance.now() - game.levelStartTime;

    // 计算遗漏
    const patternSet = new Set(game.pattern.map(p => `${p.r},${p.c}`));
    const selectedSet = new Set(game.playerSelections);
    game.missedTiles = [];
    patternSet.forEach(key => {
        if (!selectedSet.has(key)) {
            const [r, c] = key.split(',').map(Number);
            game.missedTiles.push({ r, c });
            const tileEl = getTileElement(r, c);
            if (tileEl) tileEl.classList.add('missed');
        }
    });

    // 更新统计
    save.totalGamesPlayed++;
    save.totalPlaytime += game.levelTime;
    save.currentPerfectStreak = 0;
    if (game.mode === 'tower' && game.towerFloor > save.towerBest) {
        save.towerBest = game.towerFloor;
        save.towerHighScore = game.score;
    }
    if (game.mode === 'daily') {
        const todayKey = new Date().toISOString().split('T')[0];
        save.dailyCompleted[todayKey] = true;
        if (!save.dailyBest[todayKey] || game.score > save.dailyBest[todayKey]) {
            save.dailyBest[todayKey] = game.score;
        }
        save.dailiesCompleted++;
    }
    if (game.mode === 'weekly') {
        const weekKey = getWeekSeed().toString();
        save.weeklyCompleted[weekKey] = true;
        if (!save.weeklyBest[weekKey] || game.score > save.weeklyBest[weekKey]) {
            save.weeklyBest[weekKey] = game.score;
        }
    }

    // 更新 DNA
    const totalTiles = game.pattern.length;
    const accuracy = totalTiles > 0 ? game.correctCount / totalTiles : 0;
    updateDNA(accuracy, game.levelTime, game.combo, game.gridSize, false);

    saveSave();

    SFX.gameOver();

    // 延迟显示结果
    setTimeout(() => showResult(false), 800);
}

// 更新 HUD
function updateHUD() {
    document.getElementById('hud-level').textContent = game.mode === 'tower' ? `F${game.towerFloor + 1}` : game.level;
    document.getElementById('hud-score').textContent = formatNum(game.score);

    // 生命值
    let hearts = '';
    for (let i = 0; i < game.lives; i++) hearts += '\u2665';
    for (let i = game.lives; i < (game.mode === 'tower' ? 1 : 3); i++) hearts += '\u2661';
    document.getElementById('hud-lives').textContent = hearts;

    document.getElementById('hud-world-name').textContent = getWorld(game.level).name;
}

// 更新计时器
function updateTimer() {
    if (game.state !== GameState.RECALL) return;
    const elapsed = performance.now() - game.timerStart;
    document.getElementById('hud-timer').textContent = formatTime(elapsed);
}

// 更新焦点条
function updateFocusBar() {
    document.getElementById('focus-fill').style.width = game.focusLevel + '%';
}

// 更新 DNA
function updateDNA(accuracy, time, combo, gridSize, perfect) {
    const d = save.dna;
    // 空间记忆：大网格+高准确率
    d.spatial = Math.min(100, d.spatial + (accuracy * gridSize * 0.3));
    // 序列记忆：连击
    d.sequence = Math.min(100, d.sequence + (combo * 1.5));
    // 速度：快速完成
    const speedBonus = Math.max(0, (5000 - time) / 50);
    d.speed = Math.min(100, d.speed + speedBonus * 0.3);
    // 耐力：基于关卡数
    d.endurance = Math.min(100, d.endurance + (game.level * 0.5));
    // 精确度：准确率
    d.precision = Math.min(100, d.precision + (accuracy * 3));
}

// 检查成就
function checkAchievements() {
    const newOnes = [];
    for (const ach of ACHIEVEMENTS) {
        if (!save.achievements.includes(ach.id) && ach.check(save)) {
            save.achievements.push(ach.id);
            newOnes.push(ach);
        }
    }
    // 检查称号解锁
    for (const title of TITLES) {
        if (!save.unlockedTitles.includes(title.id) && title.unlock && title.unlock(save)) {
            save.unlockedTitles.push(title.id);
        }
    }
    if (newOnes.length > 0) {
        saveSave();
        // 延迟显示成就通知
        setTimeout(() => {
            for (const ach of newOnes) {
                SFX.achievement();
                showToast(`${ach.icon} Achievement: ${ach.name}`, 'anomaly');
            }
        }, 500);
    }
    return newOnes;
}

// 添加博物馆物品
function addMuseumItem(level, world) {
    const itemId = `lvl-${level}-${world.id}`;
    if (save.museumItems.includes(itemId)) return;

    const artifacts = [
        { icon: '◇', name: 'Memory Shard' },
        { icon: '◆', name: 'Pattern Fragment' },
        { icon: '⬡', name: 'Recall Crystal' },
        { icon: '◎', name: 'Focus Orb' },
        { icon: '✧', name: 'Mind Gem' },
        { icon: '❋', name: 'Thought Pearl' },
        { icon: '✦', name: 'Cognition Star' },
        { icon: '⟡', name: 'Wisdom Rune' },
        { icon: '◈', name: 'Insight Diamond' },
        { icon: '◉', name: 'Clarity Sphere' }
    ];

    const artifact = artifacts[Math.floor(Math.random() * artifacts.length)];
    save.museumItems.push(itemId);

    // 存储物品详情（用另一个 key）
    if (!save._museumDetails) save._museumDetails = {};
    save._museumDetails[itemId] = {
        icon: artifact.icon,
        name: `${artifact.name} ${level}`,
        world: world.name,
        worldId: world.id,
        level: level
    };

    saveSave();
}

/* ============================================================
   第八部分：结果界面
   ============================================================ */

function showResult(isWin) {
    showScreen('result');
    const iconEl = document.getElementById('result-icon');
    const titleEl = document.getElementById('result-title');
    const subEl = document.getElementById('result-subtitle');
    const statsEl = document.getElementById('result-stats');
    const mistakesEl = document.getElementById('result-mistakes');
    const mistakeList = document.getElementById('mistake-list');
    const dnaEl = document.getElementById('result-dna-update');
    const dnaBars = document.getElementById('dna-bars');
    const rewardsEl = document.getElementById('result-rewards');
    const rewardItems = document.getElementById('reward-items');

    if (isWin) {
        iconEl.textContent = '🏆';
        titleEl.textContent = 'Victory';
        titleEl.style.color = 'var(--accent)';
        subEl.textContent = 'Incredible performance!';
    } else {
        iconEl.textContent = '💫';
        titleEl.textContent = 'Journey Ends';
        titleEl.style.color = 'var(--text-primary)';
        const finalLevel = game.mode === 'tower' ? `Floor ${game.towerFloor + 1}` : `Level ${game.level}`;
        subEl.textContent = `Reached ${finalLevel} in ${getWorld(game.level).name}`;
    }

    // 统计卡片
    const totalTiles = game.pattern.length;
    const accuracy = totalTiles > 0 ? Math.round((game.correctCount / totalTiles) * 100) : 0;
    statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-val">${formatNum(game.score)}</div><div class="stat-lbl">Score</div></div>
        <div class="stat-card"><div class="stat-val">${game.mode === 'tower' ? game.towerFloor + 1 : game.level}</div><div class="stat-lbl">${game.mode === 'tower' ? 'Floor' : 'Level'}</div></div>
        <div class="stat-card"><div class="stat-val">${accuracy}%</div><div class="stat-lbl">Accuracy</div></div>
        <div class="stat-card"><div class="stat-val">${game.combo}x</div><div class="stat-lbl">Best Combo</div></div>
        <div class="stat-card"><div class="stat-val">${game.correctCount}/${totalTiles}</div><div class="stat-lbl">Tiles</div></div>
        <div class="stat-card"><div class="stat-val">${formatTime(game.levelTime)}</div><div class="stat-lbl">Time</div></div>
    `;

    // 错误分析
    if (game.falsePositives.length > 0 || game.missedTiles.length > 0) {
        mistakesEl.style.display = 'block';
        let html = '';
        for (const fp of game.falsePositives) {
            html += `<div class="mistake-item"><span class="m-type false-positive">False Positive</span> Row ${fp.r + 1}, Col ${fp.c + 1}</div>`;
        }
        for (const m of game.missedTiles) {
            html += `<div class="mistake-item"><span class="m-type missed">Missed</span> Row ${m.r + 1}, Col ${m.c + 1}</div>`;
        }
        mistakeList.innerHTML = html;
    } else {
        mistakesEl.style.display = 'none';
    }

    // DNA 更新
    dnaEl.style.display = 'block';
    let dnaHtml = '';
    for (const dim of DNA_DIMS) {
        const val = Math.round(save.dna[dim.id]);
        dnaHtml += `<div class="dna-bar-item">
            <span class="dna-bar-label">${dim.name}</span>
            <div class="dna-bar-track"><div class="dna-bar-fill" style="width:${val}%;background:${dim.color};"></div></div>
            <span class="dna-bar-val">${val}</span>
        </div>`;
    }
    dnaBars.innerHTML = dnaHtml;

    // 奖励
    const rewards = [];
    rewards.push(`${formatNum(game.score)} points`);
    if (game.correctCount > 0) rewards.push(`${game.correctCount} tiles remembered`);
    if (game.combo >= 3) rewards.push(`${game.combo}x combo record`);

    const seasonal = getSeasonalEvent();
    rewards.push(`${seasonal.icon} ${seasonal.name} bonus`);

    rewardsEl.style.display = 'block';
    rewardItems.innerHTML = rewards.map(r => `<div class="reward-item">${r}</div>`).join('');

    // 检查成就
    checkAchievements();
}

/* ============================================================
   第九部分：各页面渲染
   ============================================================ */

// 主菜单
function renderMenu() {
    setWorldTheme('memory-village');

    // 段位徽章
    const rank = getRank(save.bestScore);
    document.getElementById('menu-rank-badge').innerHTML = `${rank.icon} ${rank.name}`;

    // 登录连续天数
    const streakEl = document.getElementById('login-streak');
    if (save.loginStreak > 0) {
        streakEl.innerHTML = `<strong>${save.loginStreak}</strong> day login streak`;
    } else {
        streakEl.textContent = 'Start your journey today';
    }

    // 每日奖励按钮
    const rewardBtn = document.getElementById('daily-reward-btn');
    const today = new Date().toISOString().split('T')[0];
    if (save.lastRewardClaimed !== today && save.loginStreak > 0) {
        rewardBtn.style.display = 'block';
    } else {
        rewardBtn.style.display = 'none';
    }
}

// 脑报告 / Memory DNA
function renderProfiles() {
    // DNA 柱状图
    let dnaHtml = `<div class="dna-profile-title">Memory DNA Profile</div>`;
    for (const dim of DNA_DIMS) {
        const val = Math.round(save.dna[dim.id]);
        dnaHtml += `<div class="dna-bar-item">
            <span class="dna-bar-label">${dim.name}</span>
            <div class="dna-bar-track"><div class="dna-bar-fill" style="width:${val}%;background:${dim.color};"></div></div>
            <span class="dna-bar-val">${val}</span>
        </div>`;
    }
    document.getElementById('dna-profile').innerHTML = dnaHtml;

    // 记忆阶层
    const tier = getTier(save.bestScore);
    const nextTier = getNextTier(save.bestScore);
    let tierProgress = 0;
    if (nextTier) {
        const prevMin = tier.min;
        tierProgress = Math.round(((save.bestScore - prevMin) / (nextTier.min - prevMin)) * 100);
    } else {
        tierProgress = 100;
    }
    document.getElementById('memory-tier-card').innerHTML = `
        <div class="tier-name" style="color:${tier.color}">${tier.name}</div>
        <div class="tier-desc">Total Score: ${formatNum(save.bestScore)}</div>
        ${nextTier ? `<div class="tier-progress">
            <div class="tier-progress-bar"><div class="tier-progress-fill" style="width:${tierProgress}%;background:${nextTier.color}"></div></div>
            <div class="tier-progress-label">${tierProgress}% to ${nextTier.name}</div>
        </div>` : '<div class="tier-progress-label" style="margin-top:12px;">Maximum tier reached!</div>'}
    `;

    // 统计网格
    const stats = [
        { val: save.highestLevel, lbl: 'Highest Level' },
        { val: formatNum(save.bestScore), lbl: 'Best Score' },
        { val: save.totalGamesPlayed, lbl: 'Games Played' },
        { val: save.totalTilesRemembered, lbl: 'Tiles Remembered' },
        { val: save.maxCombo + 'x', lbl: 'Best Combo' },
        { val: formatTime(save.totalPlaytime), lbl: 'Total Playtime' },
        { val: save.bossesDefeated, lbl: 'Bosses Defeated' },
        { val: save.anomaliesEncountered, lbl: 'Anomalies Seen' }
    ];
    document.getElementById('stats-grid').innerHTML = stats.map(s =>
        `<div class="stat-card"><div class="stat-val">${s.val}</div><div class="stat-lbl">${s.lbl}</div></div>`
    ).join('');

    // 遗留时间线
    const timeline = document.getElementById('legacy-timeline');
    if (save.legacy.length === 0) {
        timeline.innerHTML = '<div class="empty-state" style="padding:1rem;">No milestones yet. Keep playing!</div>';
    } else {
        const recent = [...save.legacy].reverse().slice(0, 15);
        timeline.innerHTML = recent.map(l =>
            `<div class="legacy-item">
                <span class="legacy-lvl">${l.perfect ? '★ ' : ''}Level ${l.level} — ${l.world}</span>
                <br><span class="legacy-date">${l.date} · Score: ${formatNum(l.score)}</span>
            </div>`
        ).join('');
    }
}

// 奖杯室
function renderTrophies(filter) {
    filter = filter || 'all';
    const grid = document.getElementById('trophy-grid');
    let html = '';

    for (const ach of ACHIEVEMENTS) {
        const earned = save.achievements.includes(ach.id);
        if (filter === 'earned' && !earned) continue;
        if (filter === 'locked' && earned) continue;

        html += `<div class="trophy-card ${earned ? 'earned' : 'locked'}">
            <span class="trophy-icon">${ach.icon}</span>
            <div class="trophy-name">${earned ? ach.name : '???'}</div>
            <div class="trophy-desc">${earned ? ach.desc : 'Keep playing to discover'}</div>
        </div>`;
    }

    grid.innerHTML = html || '<div class="empty-state">No trophies match this filter.</div>';
}

// 记忆博物馆
function renderMuseum() {
    const grid = document.getElementById('museum-collection');
    const empty = document.getElementById('museum-empty');
    const details = save._museumDetails || {};

    if (save.museumItems.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';

    let html = '';
    for (const itemId of save.museumItems) {
        const d = details[itemId];
        if (d) {
            html += `<div class="museum-item">
                <span class="museum-icon">${d.icon}</span>
                <span class="museum-name">${d.name}</span>
                <span class="museum-world">${d.world}</span>
            </div>`;
        }
    }
    grid.innerHTML = html;
}

// 每日挑战
function renderDaily() {
    const card = document.getElementById('daily-card');
    const todayKey = new Date().toISOString().split('T')[0];
    const seed = getDaySeed();
    const rng = seededRandom(seed);
    const dailyLevel = 5 + Math.floor(rng() * 10);
    const params = getLevelParams(dailyLevel, false);
    const completed = save.dailyCompleted[todayKey];
    const best = save.dailyBest[todayKey];
    const seasonal = getSeasonalEvent();

    card.innerHTML = `
        <div class="challenge-header">
            <span class="challenge-name">${seasonal.icon} ${seasonal.name}</span>
            <span class="challenge-status ${completed ? 'completed' : 'available'}">${completed ? 'Completed' : 'Available'}</span>
        </div>
        <div class="challenge-desc">
            Memorize a ${params.gridSize}x${params.gridSize} grid with ${params.tileCount} tiles in ${formatTime(params.memTime)}.
            ${params.mechanic ? '<br>Special mechanic: ' + params.mechanic + '!' : ''}
        </div>
        <div class="challenge-rewards">
            <span class="challenge-reward">${seasonal.icon} Seasonal Bonus</span>
            <span class="challenge-reward">Memory DNA Boost</span>
        </div>
        ${best ? `<div class="challenge-best">Best Score: ${formatNum(best)}</div>` : ''}
        <button class="menu-btn ${completed ? '' : 'primary'}" style="width:100%;margin-top:8px;" ${completed ? '' : 'data-action="start-daily"'}>
            ${completed ? 'Play Again' : 'Start Challenge'}
        </button>
    `;

    const startBtn = card.querySelector('[data-action="start-daily"]');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            SFX.click();
            startGame('daily', dailyLevel);
        });
    }
    // 如果已完成，也允许重玩
    if (completed) {
        const btn = card.querySelector('.menu-btn');
        btn.addEventListener('click', () => {
            SFX.click();
            startGame('daily', dailyLevel);
        });
    }
}

// 周挑战
function renderWeekly() {
    const card = document.getElementById('weekly-card');
    const weekKey = getWeekSeed().toString();
    const seed = getWeekSeed();
    const rng = seededRandom(seed);
    const weeklyLevels = 5;
    const startLevel = 8 + Math.floor(rng() * 7);
    const completed = save.weeklyCompleted[weekKey];
    const best = save.weeklyBest[weekKey];

    card.innerHTML = `
        <div class="challenge-header">
            <span class="challenge-name">Weekly Gauntlet</span>
            <span class="challenge-status ${completed ? 'completed' : 'available'}">${completed ? 'Completed' : 'Available'}</span>
        </div>
        <div class="challenge-desc">
            Complete ${weeklyLevels} consecutive levels starting from level ${startLevel}. 
            One life for the entire run. How far can you go?
        </div>
        <div class="challenge-rewards">
            <span class="challenge-reward">Exclusive Trophy</span>
            <span class="challenge-reward">Rank Points x2</span>
        </div>
        ${best ? `<div class="challenge-best">Best Score: ${formatNum(best)}</div>` : ''}
        <button class="menu-btn ${completed ? '' : 'primary'}" style="width:100%;margin-top:8px;" data-action="start-weekly">
            ${completed ? 'Play Again' : 'Begin Gauntlet'}
        </button>
    `;

    card.querySelector('[data-action="start-weekly"]').addEventListener('click', () => {
        SFX.click();
        startGame('weekly', startLevel);
    });
}

// 无尽塔
function renderTower() {
    const info = document.getElementById('tower-info');
    info.innerHTML = `
        <div class="tower-floor-label">Highest Floor</div>
        <div class="tower-floor">${save.towerBest || 0}</div>
        <div class="tower-stats">
            <div class="tower-stat">
                <div class="ts-val">${formatNum(save.towerHighScore)}</div>
                <div class="ts-lbl">Best Score</div>
            </div>
            <div class="tower-stat">
                <div class="ts-val">${save.towerBest || 0}</div>
                <div class="ts-lbl">Floors Climbed</div>
            </div>
        </div>
    `;
}

// 设置页面
function renderSettings() {
    document.getElementById('set-sfx').checked = save.settings.sfx;
    document.getElementById('set-music').checked = save.settings.music;
    document.getElementById('set-anim').checked = save.settings.animations;
    document.getElementById('set-focus').checked = save.settings.focusTracker;

    // 称号选择器
    const selector = document.getElementById('title-selector');
    selector.innerHTML = save.unlockedTitles.map(tid => {
        const title = TITLES.find(t => t.id === tid);
        if (!title) return '';
        return `<button class="title-option ${tid === save.activeTitle ? 'active' : ''}" data-title-id="${tid}">${title.name}</button>`;
    }).join('');

    selector.querySelectorAll('.title-option').forEach(btn => {
        btn.addEventListener('click', () => {
            SFX.click();
            save.activeTitle = btn.dataset.titleId;
            saveSave();
            renderSettings();
        });
    });
}

/* ============================================================
   第十部分：每日奖励 & 登录系统
   ============================================================ */

function handleLogin() {
    const today = new Date().toISOString().split('T')[0];

    if (save.lastLoginDate === today) return; // 今天已登录

    // 检查是否连续登录
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (save.lastLoginDate === yesterday) {
        save.loginStreak++;
    } else if (save.lastLoginDate !== today) {
        save.loginStreak = 1;
    }

    save.lastLoginDate = today;
    saveSave();
    checkAchievements();
}

function claimDailyReward() {
    const today = new Date().toISOString().split('T')[0];
    if (save.lastRewardClaimed === today) return;

    // 奖励：基于连续天数的分数加成
    const bonus = Math.min(save.loginStreak * 50, 500);
    save.bestScore += bonus;

    // 额外奖励：7天连续送额外生命概念（用分数体现）
    if (save.loginStreak % 7 === 0) {
        save.bestScore += 200;
        showModal('Streak Bonus!', `You've logged in for ${save.loginStreak} days in a row! Bonus: ${bonus + 200} points`, [
            { id: 'ok', label: 'Wonderful', primary: true }
        ]);
    }

    save.lastRewardClaimed = today;
    saveSave();
    SFX.reward();
    renderMenu();
    checkAchievements();
}

/* ============================================================
   第十一部分：声望系统
   ============================================================ */

function doPrestige() {
    showModal('Prestige Reset', 
        'This will reset your score, level progress, and DNA profile. You keep achievements, trophies, museum items, and titles. Your rank icon will gain a prestige marker. Are you sure?',
        [
            { id: 'cancel', label: 'Cancel' },
            { id: 'prestige', label: 'Prestige', primary: true, danger: true, callback: () => {
                const keptAchievements = [...save.achievements];
                const keptMuseum = [...save.museumItems];
                const keptMuseumDetails = save._museumDetails ? {...save._museumDetails} : {};
                const keptTitles = [...save.unlockedTitles];
                const keptPrestige = save.prestigeCount + 1;
                const keptGamesPlayed = save.totalGamesPlayed;
                const keptPlaytime = save.totalPlaytime;

                save = defaultSave();
                save.achievements = keptAchievements;
                save.museumItems = keptMuseum;
                save._museumDetails = keptMuseumDetails;
                save.unlockedTitles = keptTitles;
                save.prestigeCount = keptPrestige;
                save.totalGamesPlayed = keptGamesPlayed;
                save.totalPlaytime = keptPlaytime;
                saveSave();

                checkAchievements();
                showScreen('menu', false);
                renderMenu();
                showToast(`Prestige ${keptPrestige} achieved!`, 'lucky');
            }}
        ]
    );
}

/* ============================================================
   第十二部分：事件绑定 & 初始化
   ============================================================ */

function init() {
    // 注册屏幕
    registerScreens();

    // 初始化粒子
    initParticles();
    animateParticles();

    // 设置初始世界主题
    setWorldTheme('memory-village');

    // 处理登录
    handleLogin();

    // 渲染主菜单
    renderMenu();
    showScreen('menu', false);

    // ---- 事件绑定 ----

    // 返回按钮
    document.getElementById('btn-back').addEventListener('click', () => { SFX.click(); goBack(); });

    // 设置按钮
    document.getElementById('btn-settings').addEventListener('click', () => { SFX.click(); renderSettings(); showScreen('settings'); });

    // 菜单按钮（事件委托）
    document.querySelector('.menu-nav').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        SFX.click();
        const action = btn.dataset.action;

        switch (action) {
            case 'play':     startGame('normal', 1); break;
            case 'tower':    renderTower(); showScreen('tower'); break;
            case 'daily':    renderDaily(); showScreen('daily'); break;
            case 'weekly':   renderWeekly(); showScreen('weekly'); break;
            case 'profiles': renderProfiles(); showScreen('profiles'); break;
            case 'trophies': renderTrophies('all'); showScreen('trophies'); break;
            case 'museum':   renderMuseum(); showScreen('museum'); break;
        }
    });

    // 每日奖励按钮
    document.querySelector('.menu-footer').addEventListener('click', (e) => {
        if (e.target.closest('[data-action="claim-reward"]')) {
            claimDailyReward();
        }
    });

    // 结果页按钮
    document.getElementById('btn-retry').addEventListener('click', () => {
        SFX.click();
        startGame(game.mode, game.mode === 'normal' ? 1 : (game.mode === 'tower' ? 1 : game.level));
    });
    document.getElementById('btn-result-menu').addEventListener('click', () => {
        SFX.click();
        setWorldTheme('memory-village');
        showScreen('menu', false);
        renderMenu();
    });

    // 奖杯过滤
    document.getElementById('trophy-filter').addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        SFX.click();
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTrophies(btn.dataset.filter);
    });

    // 无尽塔开始
    document.getElementById('btn-tower-start').addEventListener('click', () => {
        SFX.click();
        startGame('tower', 1);
    });

    // 设置变更
    document.getElementById('set-sfx').addEventListener('change', (e) => { save.settings.sfx = e.target.checked; saveSave(); });
    document.getElementById('set-music').addEventListener('change', (e) => { save.settings.music = e.target.checked; saveSave(); });
    document.getElementById('set-anim').addEventListener('change', (e) => { save.settings.animations = e.target.checked; saveSave(); });
    document.getElementById('set-focus').addEventListener('change', (e) => { save.settings.focusTracker = e.target.checked; saveSave(); });

    // 重置数据
    document.getElementById('btn-reset-data').addEventListener('click', () => {
        showModal('Reset All Data', 'This will permanently delete ALL progress, achievements, and collection items. This cannot be undone.', [
            { id: 'cancel', label: 'Cancel' },
            { id: 'reset', label: 'Reset Everything', primary: true, danger: true, callback: () => {
                localStorage.removeItem(SAVE_KEY);
                save = loadSave();
                handleLogin();
                setWorldTheme('memory-village');
                showScreen('menu', false);
                renderMenu();
                hideModal();
                showToast('All data has been reset', 'anomaly');
            }}
        ]);
    });

    // 模态框背景点击关闭
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) hideModal();
    });

    // 键盘支持：Escape 返回
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.getElementById('modal-overlay').style.display === 'flex') {
                hideModal();
            } else if (currentScreen !== 'menu' && currentScreen !== 'game') {
                SFX.click();
                goBack();
            }
        }
    });

    // 防止双击缩放（移动端）
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    // 首次交互解锁 AudioContext
    const unlockAudio = () => {
        getAudioCtx();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
}

// 启动
document.addEventListener('DOMContentLoaded', init);
