// ==========================================
// БИТВА КРЕПОСТЕЙ - 2.5D Стратегия
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Размеры canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ==========================================
// СИСТЕМА УРОВНЕЙ - ЭПОХИ
// ==========================================
const LEVELS = {
    1: {
        name: 'Средневековье',
        era: 'medieval',
        description: 'Мечи и луки',
        playerGold: 100,
        enemyGold: 80,
        playerBaseHealth: 1000,
        enemyBaseHealth: 800,
        goldPerSecond: 15,
        enemyGoldPerSecond: 12,
        aiSpeed: 0.4,
        // Доступные юниты
        unlockedUnits: ['spearman', 'archer'],
        // База
        baseTurret: false,
        baseTurretDamage: 0,
        baseTurretSpeed: 0,
        baseTurretRange: 0,
        // Авиаудар
        airstrike: false,
        airstrikeCost: 0,
        airstrikeDamage: 0,
        airstrikeRadius: 0,
        // Визуал
        baseStyle: 'castle',
        skyColor: '#1a1a2e'
    },
    2: {
        name: 'Эпоха пороха',
        era: 'gunpowder',
        description: 'Мушкеты и пушки',
        playerGold: 120,
        enemyGold: 120,
        playerBaseHealth: 1200,
        enemyBaseHealth: 1200,
        goldPerSecond: 18,
        enemyGoldPerSecond: 18,
        aiSpeed: 0.25,
        // Доступные юниты
        unlockedUnits: ['spearman', 'archer', 'musketeer', 'shieldbearer'],
        // База стреляет из пушки!
        baseTurret: true,
        baseTurretDamage: 30,
        baseTurretSpeed: 0.3,      // выстрелов в секунду
        baseTurretRange: 350,
        // Авиаудар - голуби с бомбами!
        airstrike: true,
        airstrikeCost: 200,
        airstrikeDamage: 50,
        airstrikeRadius: 100,
        // Визуал
        baseStyle: 'fortress',
        skyColor: '#2c1810'
    },
    3: {
        name: 'Современность',
        era: 'modern',
        description: 'Танки и авиация',
        playerGold: 150,
        enemyGold: 180,
        playerBaseHealth: 1500,
        enemyBaseHealth: 2000,
        goldPerSecond: 22,
        enemyGoldPerSecond: 25,
        aiSpeed: 0.15,
        // Все юниты + танк!
        unlockedUnits: ['spearman', 'archer', 'musketeer', 'shieldbearer', 'tank'],
        // База с пулемётом!
        baseTurret: true,
        baseTurretDamage: 15,
        baseTurretSpeed: 2.0,      // быстрый пулемёт
        baseTurretRange: 400,
        // Авиаудар - бомбардировка!
        airstrike: true,
        airstrikeCost: 300,
        airstrikeDamage: 120,
        airstrikeRadius: 150,
        // Визуал
        baseStyle: 'bunker',
        skyColor: '#1a2a1a'
    }
};

// Прогресс игрока (сохраняется в localStorage)
const playerProgress = {
    unlockedLevels: [1],
    stars: { 1: 0, 2: 0, 3: 0 },
    
    load() {
        try {
            const saved = localStorage.getItem('fortressBattle_progress');
            if (saved) {
                const data = JSON.parse(saved);
                this.unlockedLevels = data.unlockedLevels || [1];
                this.stars = data.stars || { 1: 0, 2: 0, 3: 0 };
            }
        } catch (e) {
            console.log('Не удалось загрузить прогресс');
        }
    },
    
    save() {
        try {
            localStorage.setItem('fortressBattle_progress', JSON.stringify({
                unlockedLevels: this.unlockedLevels,
                stars: this.stars
            }));
        } catch (e) {
            console.log('Не удалось сохранить прогресс');
        }
    },
    
    unlockLevel(level) {
        if (!this.unlockedLevels.includes(level)) {
            this.unlockedLevels.push(level);
            this.save();
        }
    },
    
    setStars(level, stars) {
        if (stars > this.stars[level]) {
            this.stars[level] = stars;
            this.save();
        }
    },
    
    isUnlocked(level) {
        return this.unlockedLevels.includes(level);
    }
};

// Загружаем прогресс
playerProgress.load();

// Текущий уровень
let currentLevel = 1;

// ==========================================
// КОНФИГУРАЦИЯ ЮНИТОВ
// ==========================================
const UNIT_TYPES = {
    spearman: {
        name: 'Копейщик',
        cost: 50,
        health: 80,
        damage: 15,
        attackSpeed: 1.0,      // атак в секунду
        moveSpeed: 60,         // пикселей в секунду
        attackRange: 40,       // дистанция атаки
        detectRange: 150,      // дистанция обнаружения врага
        isRanged: false,
        color: '#4a90d9',
        width: 30,
        height: 50
    },
    archer: {
        name: 'Лучник',
        cost: 75,
        health: 50,
        damage: 20,
        attackSpeed: 0.8,
        moveSpeed: 50,
        attackRange: 200,
        detectRange: 250,
        isRanged: true,
        projectileSpeed: 400,
        color: '#2ecc71',
        width: 25,
        height: 45
    },
    musketeer: {
        name: 'Мушкетёр',
        cost: 120,
        health: 40,
        damage: 45,
        attackSpeed: 0.5,
        moveSpeed: 40,
        attackRange: 300,
        detectRange: 350,
        isRanged: true,
        projectileSpeed: 600,
        color: '#9b59b6',
        width: 25,
        height: 48
    },
    shieldbearer: {
        name: 'Щитоносец',
        cost: 100,
        health: 400,
        damage: 10,
        attackSpeed: 0.7,
        moveSpeed: 35,
        attackRange: 35,
        detectRange: 120,
        isRanged: false,
        color: '#e67e22',
        width: 35,
        height: 55
    },
    tank: {
        name: 'Танк',
        cost: 250,
        health: 800,
        damage: 60,
        attackSpeed: 0.4,
        moveSpeed: 25,
        attackRange: 250,
        detectRange: 300,
        isRanged: true,
        projectileSpeed: 500,
        color: '#556b2f',
        width: 50,
        height: 35
    }
};

// ==========================================
// ИГРОВОЕ СОСТОЯНИЕ
// ==========================================
const gameState = {
    playerGold: 100,
    enemyGold: 100,
    playerBaseHealth: 1000,
    enemyBaseHealth: 1000,
    maxBaseHealth: 1000,
    maxEnemyBaseHealth: 1000,
    goldPerSecond: 15,
    enemyGoldPerSecond: 15,
    startTime: performance.now(),
    units: [],
    projectiles: [],
    particles: [],
    airstrikes: [],          // Активные авиаудары
    gameOver: false,
    winner: null,
    lastTime: 0,
    groundY: 0,
    playerBaseX: 0,
    enemyBaseX: 0,
    isPlaying: false,
    // Турели баз
    playerTurretCooldown: 0,
    enemyTurretCooldown: 0,
    // Авиаудар
    playerAirstrikeCooldown: 0,
    enemyAirstrikeCooldown: 0,
    airstrikeCooldownTime: 30,  // секунд между ударами
    // Настройки уровня
    levelConfig: null
};

// ==========================================
// КЛАСС ЮНИТА
// ==========================================
class Unit {
    constructor(type, isEnemy) {
        const config = UNIT_TYPES[type];
        this.type = type;
        this.isEnemy = isEnemy;
        this.health = config.health;
        this.maxHealth = config.health;
        this.damage = config.damage;
        this.attackSpeed = config.attackSpeed;
        this.moveSpeed = config.moveSpeed;
        this.attackRange = config.attackRange;
        this.detectRange = config.detectRange;
        this.isRanged = config.isRanged;
        this.projectileSpeed = config.projectileSpeed || 0;
        this.color = isEnemy ? this.getEnemyColor(config.color) : config.color;
        this.width = config.width;
        this.height = config.height;
        
        // Позиция
        this.x = isEnemy ? gameState.enemyBaseX - 80 : gameState.playerBaseX + 80;
        this.y = gameState.groundY;
        
        // Состояние
        this.state = 'moving'; // moving, attacking, idle
        this.target = null;
        this.attackCooldown = 0;
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.direction = isEnemy ? -1 : 1;
        
        // Визуальные эффекты
        this.hitFlash = 0;
        this.deathTimer = 0;
        this.isDead = false;
    }
    
    getEnemyColor(color) {
        // Делаем цвет более красным для врагов
        return '#d94a4a';
    }
    
    update(deltaTime, allUnits) {
        if (this.isDead) {
            this.deathTimer += deltaTime;
            return this.deathTimer < 0.5; // Удалить после анимации смерти
        }
        
        // Уменьшаем кулдаун атаки
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        // Уменьшаем вспышку при попадании
        if (this.hitFlash > 0) {
            this.hitFlash -= deltaTime * 5;
        }
        
        // Анимация
        this.animationTimer += deltaTime;
        if (this.animationTimer > 0.1) {
            this.animationFrame = (this.animationFrame + 1) % 4;
            this.animationTimer = 0;
        }
        
        // Ищем цель
        this.findTarget(allUnits);
        
        if (this.target && !this.target.isDead) {
            const dist = Math.abs(this.target.x - this.x);
            
            if (dist <= this.attackRange) {
                // Атакуем
                this.state = 'attacking';
                this.attack();
            } else if (dist <= this.detectRange) {
                // Сближаемся с целью
                this.state = 'moving';
                this.moveTowards(this.target.x, deltaTime);
            } else {
                // Цель слишком далеко, идём к базе
                this.target = null;
                this.state = 'moving';
                this.moveTowardsBase(deltaTime);
            }
        } else {
            // Нет цели - идём к базе или атакуем её
            const targetBaseX = this.isEnemy ? gameState.playerBaseX : gameState.enemyBaseX;
            const distToBase = Math.abs(targetBaseX - this.x);
            
            // Стрелки атакуют с дистанции!
            if (this.isRanged && distToBase <= this.attackRange) {
                this.state = 'attacking';
                this.attackBase();
            } else if (distToBase <= 60) {
                // Мили атакуют вплотную
                this.state = 'attacking';
                this.attackBase();
            } else {
                // Идём к базе
                this.state = 'moving';
                this.moveTowardsBase(deltaTime);
            }
        }
        
        return true;
    }
    
    findTarget(allUnits) {
        let closestDist = Infinity;
        let closestUnit = null;
        
        for (const unit of allUnits) {
            if (unit.isEnemy !== this.isEnemy && !unit.isDead) {
                const dist = Math.abs(unit.x - this.x);
                if (dist < closestDist && dist <= this.detectRange) {
                    closestDist = dist;
                    closestUnit = unit;
                }
            }
        }
        
        this.target = closestUnit;
    }
    
    moveTowards(targetX, deltaTime) {
        const dir = targetX > this.x ? 1 : -1;
        this.direction = dir;
        this.x += dir * this.moveSpeed * deltaTime;
    }
    
    moveTowardsBase(deltaTime) {
        const targetX = this.isEnemy ? gameState.playerBaseX : gameState.enemyBaseX;
        this.direction = this.isEnemy ? -1 : 1;
        this.x += this.direction * this.moveSpeed * deltaTime;
    }
    
    attackBase() {
        if (this.attackCooldown <= 0) {
            this.attackCooldown = 1 / this.attackSpeed;
            
            const targetBaseX = this.isEnemy ? gameState.playerBaseX : gameState.enemyBaseX;
            const baseY = gameState.groundY - 60; // Центр базы
            
            if (this.isRanged) {
                // Стрелки создают снаряд в базу
                gameState.projectiles.push(new BaseProjectile(
                    this.x,
                    this.y - this.height / 2,
                    targetBaseX,
                    baseY,
                    this.damage,
                    this.projectileSpeed,
                    this.isEnemy
                ));
            } else {
                // Мили бьют напрямую
                if (this.isEnemy) {
                    gameState.playerBaseHealth -= this.damage;
                    createParticles(gameState.playerBaseX + 40, this.y, '#4a90d9', 5);
                } else {
                    gameState.enemyBaseHealth -= this.damage;
                    createParticles(gameState.enemyBaseX - 40, this.y, '#d94a4a', 5);
                }
            }
        }
    }
    
    attack() {
        if (this.attackCooldown <= 0 && this.target && !this.target.isDead) {
            this.attackCooldown = 1 / this.attackSpeed;
            
            if (this.isRanged) {
                // Создаём снаряд
                gameState.projectiles.push(new Projectile(
                    this.x,
                    this.y - this.height / 2,
                    this.target,
                    this.damage,
                    this.projectileSpeed,
                    this.isEnemy
                ));
            } else {
                // Мгновенный урон
                this.target.takeDamage(this.damage);
                createParticles(this.target.x, this.target.y - this.target.height / 2, '#fff', 3);
            }
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        this.hitFlash = 1;
        
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            createParticles(this.x, this.y - this.height / 2, this.color, 10);
        }
    }
    
    draw() {
        ctx.save();
        
        const drawX = this.x;
        const drawY = this.y;
        
        // Тень
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(drawX, drawY + 5, this.width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Анимация смерти
        if (this.isDead) {
            ctx.globalAlpha = 1 - this.deathTimer * 2;
        }
        
        // Вспышка при попадании
        if (this.hitFlash > 0) {
            ctx.fillStyle = '#fff';
        } else {
            ctx.fillStyle = this.color;
        }
        
        // Танк рисуется отдельно
        if (this.type === 'tank') {
            this.drawTank(drawX, drawY);
            ctx.restore();
            return;
        }
        
        // Тело юнита (2.5D стиль)
        this.drawUnit(drawX, drawY);
        
        // Полоска здоровья
        if (!this.isDead) {
            const healthPercent = this.health / this.maxHealth;
            const barWidth = this.width + 10;
            const barHeight = 6;
            const barX = drawX - barWidth / 2;
            const barY = drawY - this.height - 15;
            
            // Фон
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // Здоровье
            ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f39c12' : '#e74c3c';
            ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
            
            // Рамка
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
        
        ctx.restore();
    }
    
    drawUnit(x, y) {
        const bobOffset = this.state === 'moving' ? Math.sin(this.animationTimer * 15) * 3 : 0;
        
        // Ноги
        ctx.fillStyle = '#333';
        const legSpread = this.state === 'moving' ? Math.sin(this.animationTimer * 15) * 5 : 0;
        ctx.fillRect(x - 8 - legSpread, y - 15, 6, 15);
        ctx.fillRect(x + 2 + legSpread, y - 15, 6, 15);
        
        // Тело
        ctx.fillStyle = this.hitFlash > 0 ? '#fff' : this.color;
        ctx.beginPath();
        ctx.roundRect(x - this.width / 2, y - this.height + bobOffset, this.width, this.height - 15, 5);
        ctx.fill();
        
        // Детали в зависимости от типа
        this.drawUnitDetails(x, y, bobOffset);
        
        // Голова
        ctx.fillStyle = '#f5d0a9';
        ctx.beginPath();
        ctx.arc(x, y - this.height - 5 + bobOffset, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Глаза
        ctx.fillStyle = '#333';
        const eyeX = this.direction > 0 ? 3 : -3;
        ctx.beginPath();
        ctx.arc(x + eyeX, y - this.height - 6 + bobOffset, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawUnitDetails(x, y, bobOffset) {
        switch (this.type) {
            case 'spearman':
                // Копьё
                ctx.strokeStyle = '#8B4513';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x + this.direction * 10, y - 30 + bobOffset);
                ctx.lineTo(x + this.direction * 40, y - 60 + bobOffset);
                ctx.stroke();
                // Наконечник
                ctx.fillStyle = '#C0C0C0';
                ctx.beginPath();
                ctx.moveTo(x + this.direction * 40, y - 70 + bobOffset);
                ctx.lineTo(x + this.direction * 35, y - 55 + bobOffset);
                ctx.lineTo(x + this.direction * 45, y - 55 + bobOffset);
                ctx.closePath();
                ctx.fill();
                break;
                
            case 'archer':
                // Лук
                ctx.strokeStyle = '#8B4513';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x + this.direction * 15, y - 35 + bobOffset, 20, 
                    this.direction > 0 ? -0.8 : Math.PI - 0.8, 
                    this.direction > 0 ? 0.8 : Math.PI + 0.8);
                ctx.stroke();
                // Тетива
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + this.direction * 15, y - 55 + bobOffset);
                ctx.lineTo(x + this.direction * 15, y - 15 + bobOffset);
                ctx.stroke();
                break;
                
            case 'musketeer':
                // Мушкет
                ctx.fillStyle = '#4a4a4a';
                ctx.fillRect(x + this.direction * 5, y - 40 + bobOffset, this.direction * 35, 6);
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(x - 5, y - 42 + bobOffset, 15, 10);
                break;
                
            case 'shieldbearer':
                // Щит
                ctx.fillStyle = '#C0C0C0';
                ctx.beginPath();
                ctx.ellipse(x + this.direction * 20, y - 35 + bobOffset, 12, 20, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.stroke();
                // Меч
                ctx.fillStyle = '#C0C0C0';
                ctx.fillRect(x - this.direction * 10, y - 50 + bobOffset, 4, 25);
                break;
                
            case 'tank':
                // Танк рисуется по-другому - не человек!
                break;
        }
    }
    
    // Специальная отрисовка для танка
    drawTank(x, y) {
        const bobOffset = this.state === 'moving' ? Math.sin(this.animationTimer * 10) * 2 : 0;
        
        // Тень
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y + 5, 30, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Гусеницы
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x - 25, y - 12 + bobOffset, 50, 12);
        ctx.fillRect(x - 25, y - 12 + bobOffset, 50, 12);
        
        // Колёса гусениц
        ctx.fillStyle = '#1a1a1a';
        for (let i = -20; i <= 20; i += 10) {
            ctx.beginPath();
            ctx.arc(x + i, y - 6 + bobOffset, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Корпус
        ctx.fillStyle = this.hitFlash > 0 ? '#fff' : (this.isEnemy ? '#4a3a2a' : '#556b2f');
        ctx.beginPath();
        ctx.moveTo(x - 22, y - 12 + bobOffset);
        ctx.lineTo(x - 18, y - 25 + bobOffset);
        ctx.lineTo(x + 18, y - 25 + bobOffset);
        ctx.lineTo(x + 22, y - 12 + bobOffset);
        ctx.closePath();
        ctx.fill();
        
        // Башня
        ctx.fillStyle = this.hitFlash > 0 ? '#fff' : (this.isEnemy ? '#3a2a1a' : '#4a5a2f');
        ctx.beginPath();
        ctx.arc(x, y - 25 + bobOffset, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Пушка
        ctx.fillStyle = '#333';
        ctx.save();
        ctx.translate(x, y - 25 + bobOffset);
        ctx.rotate(this.direction > 0 ? 0 : Math.PI);
        ctx.fillRect(0, -3, 30, 6);
        ctx.restore();
        
        // Полоска здоровья
        if (!this.isDead) {
            const healthPercent = this.health / this.maxHealth;
            const barWidth = 40;
            const barHeight = 6;
            const barX = x - barWidth / 2;
            const barY = y - 40;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f39c12' : '#e74c3c';
            ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        }
    }
}

// ==========================================
// КЛАСС СНАРЯДА (по юнитам)
// ==========================================
class Projectile {
    constructor(x, y, target, damage, speed, isEnemy) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = speed;
        this.isEnemy = isEnemy;
        this.active = true;
    }
    
    update(deltaTime) {
        if (!this.active) return false;
        
        if (!this.target || this.target.isDead) {
            this.active = false;
            return false;
        }
        
        const targetX = this.target.x;
        const targetY = this.target.y - this.target.height / 2;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 15) {
            // Попадание
            this.target.takeDamage(this.damage);
            this.active = false;
            return false;
        }
        
        // Движение к цели
        this.x += (dx / dist) * this.speed * deltaTime;
        this.y += (dy / dist) * this.speed * deltaTime;
        
        return true;
    }
    
    draw() {
        if (!this.active) return;
        
        ctx.fillStyle = this.isEnemy ? '#ff6b6b' : '#ffd700';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // След
        ctx.fillStyle = this.isEnemy ? 'rgba(255, 107, 107, 0.3)' : 'rgba(255, 215, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x - 5, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ==========================================
// КЛАСС СНАРЯДА ПО БАЗЕ
// ==========================================
class BaseProjectile {
    constructor(x, y, targetX, targetY, damage, speed, isEnemy) {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.speed = speed;
        this.isEnemy = isEnemy;
        this.active = true;
    }
    
    update(deltaTime) {
        if (!this.active) return false;
        
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 20) {
            // Попадание в базу
            if (this.isEnemy) {
                gameState.playerBaseHealth -= this.damage;
                createParticles(this.targetX, this.targetY, '#4a90d9', 5);
            } else {
                gameState.enemyBaseHealth -= this.damage;
                createParticles(this.targetX, this.targetY, '#d94a4a', 5);
            }
            this.active = false;
            return false;
        }
        
        // Движение к базе
        this.x += (dx / dist) * this.speed * deltaTime;
        this.y += (dy / dist) * this.speed * deltaTime;
        
        return true;
    }
    
    draw() {
        if (!this.active) return;
        
        ctx.fillStyle = this.isEnemy ? '#ff6b6b' : '#ffd700';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // След
        ctx.fillStyle = this.isEnemy ? 'rgba(255, 107, 107, 0.3)' : 'rgba(255, 215, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x - 5, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ==========================================
// ЧАСТИЦЫ
// ==========================================
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 100;
        this.vy = (Math.random() - 0.5) * 100 - 50;
        this.life = 1;
        this.size = Math.random() * 4 + 2;
    }
    
    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.vy += 200 * deltaTime; // Гравитация
        this.life -= deltaTime * 2;
        return this.life > 0;
    }
    
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        gameState.particles.push(new Particle(x, y, color));
    }
}

// ==========================================
// ТУРЕЛИ БАЗ
// ==========================================
function updateBaseTurrets(deltaTime) {
    const config = gameState.levelConfig;
    if (!config || !config.baseTurret) return;
    
    // Турель игрока
    gameState.playerTurretCooldown -= deltaTime;
    if (gameState.playerTurretCooldown <= 0) {
        const target = findTurretTarget(gameState.playerBaseX, true, config.baseTurretRange);
        if (target) {
            fireTurret(gameState.playerBaseX + 40, gameState.groundY - 80, target, false, config);
            gameState.playerTurretCooldown = 1 / config.baseTurretSpeed;
        }
    }
    
    // Турель врага
    gameState.enemyTurretCooldown -= deltaTime;
    if (gameState.enemyTurretCooldown <= 0) {
        const target = findTurretTarget(gameState.enemyBaseX, false, config.baseTurretRange);
        if (target) {
            fireTurret(gameState.enemyBaseX - 40, gameState.groundY - 80, target, true, config);
            gameState.enemyTurretCooldown = 1 / config.baseTurretSpeed;
        }
    }
}

function findTurretTarget(baseX, lookRight, range) {
    let closest = null;
    let closestDist = Infinity;
    
    for (const unit of gameState.units) {
        if (unit.isDead) continue;
        
        // Турель игрока стреляет по врагам (справа), турель врага - по игроку (слева)
        if (lookRight && !unit.isEnemy) continue;
        if (!lookRight && unit.isEnemy) continue;
        
        const dist = Math.abs(unit.x - baseX);
        if (dist < range && dist < closestDist) {
            closestDist = dist;
            closest = unit;
        }
    }
    
    return closest;
}

function fireTurret(x, y, target, isEnemy, config) {
    gameState.projectiles.push(new Projectile(
        x, y, target, config.baseTurretDamage, 500, isEnemy
    ));
    createParticles(x, y, isEnemy ? '#ff6b6b' : '#ffd700', 3);
}

// ==========================================
// АВИАУДАР
// ==========================================
class Airstrike {
    constructor(targetX, isEnemy, damage, radius) {
        this.targetX = targetX;
        this.isEnemy = isEnemy;
        this.damage = damage;
        this.radius = radius;
        this.phase = 'incoming'; // incoming, exploding, done
        this.timer = 0;
        this.planeX = isEnemy ? canvas.width + 100 : -100;
        this.planeY = 100;
        this.warningAlpha = 0;
    }
    
    update(deltaTime) {
        this.timer += deltaTime;
        
        if (this.phase === 'incoming') {
            // Самолёт летит
            const speed = 400;
            if (this.isEnemy) {
                this.planeX -= speed * deltaTime;
                if (this.planeX <= this.targetX) {
                    this.phase = 'exploding';
                    this.timer = 0;
                    this.explode();
                }
            } else {
                this.planeX += speed * deltaTime;
                if (this.planeX >= this.targetX) {
                    this.phase = 'exploding';
                    this.timer = 0;
                    this.explode();
                }
            }
            this.warningAlpha = Math.sin(this.timer * 10) * 0.5 + 0.5;
        } else if (this.phase === 'exploding') {
            if (this.timer > 0.5) {
                this.phase = 'done';
            }
        }
        
        return this.phase !== 'done';
    }
    
    explode() {
        // Урон всем врагам в радиусе
        for (const unit of gameState.units) {
            if (unit.isDead) continue;
            if (unit.isEnemy === this.isEnemy) continue; // Не бьём своих
            
            const dist = Math.abs(unit.x - this.targetX);
            if (dist <= this.radius) {
                const damageMultiplier = 1 - (dist / this.radius) * 0.5; // Больше урона в центре
                unit.takeDamage(this.damage * damageMultiplier);
            }
        }
        
        // Много частиц!
        for (let i = 0; i < 30; i++) {
            const offsetX = (Math.random() - 0.5) * this.radius;
            createParticles(this.targetX + offsetX, gameState.groundY - 20, '#ff6600', 3);
        }
    }
    
    draw() {
        if (this.phase === 'incoming') {
            // Предупреждение на земле
            ctx.fillStyle = `rgba(255, 0, 0, ${this.warningAlpha * 0.3})`;
            ctx.beginPath();
            ctx.ellipse(this.targetX, gameState.groundY, this.radius, 20, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = `rgba(255, 0, 0, ${this.warningAlpha})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.beginPath();
            ctx.ellipse(this.targetX, gameState.groundY, this.radius, 20, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Самолёт
            this.drawPlane();
        } else if (this.phase === 'exploding') {
            // Взрыв
            const explosionRadius = this.radius * (1 + this.timer * 2);
            const alpha = 1 - this.timer * 2;
            
            ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(this.targetX, gameState.groundY - 30, explosionRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(this.targetX, gameState.groundY - 30, explosionRadius * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    drawPlane() {
        ctx.save();
        ctx.translate(this.planeX, this.planeY);
        if (!this.isEnemy) ctx.scale(-1, 1);
        
        // Корпус
        ctx.fillStyle = this.isEnemy ? '#4a4a4a' : '#3498db';
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Крылья
        ctx.fillRect(-15, -5, 30, 40);
        
        // Хвост
        ctx.fillRect(20, -15, 10, 15);
        
        ctx.restore();
    }
}

function callAirstrike(targetX, isEnemy) {
    const config = gameState.levelConfig;
    if (!config || !config.airstrike) return false;
    
    // Проверяем кулдаун и золото
    if (isEnemy) {
        if (gameState.enemyAirstrikeCooldown > 0) return false;
        if (gameState.enemyGold < config.airstrikeCost) return false;
        gameState.enemyGold -= config.airstrikeCost;
        gameState.enemyAirstrikeCooldown = gameState.airstrikeCooldownTime;
    } else {
        if (gameState.playerAirstrikeCooldown > 0) return false;
        if (gameState.playerGold < config.airstrikeCost) return false;
        gameState.playerGold -= config.airstrikeCost;
        gameState.playerAirstrikeCooldown = gameState.airstrikeCooldownTime;
    }
    
    gameState.airstrikes.push(new Airstrike(
        targetX, isEnemy, config.airstrikeDamage, config.airstrikeRadius
    ));
    
    return true;
}

// ==========================================
// AI ПРОТИВНИКА - подключается из ai.js
// ==========================================
const enemyAI = new EnemyAI();

// ==========================================
// ОТРИСОВКА ФОН И БАЗ
// ==========================================
function drawBackground() {
    // Небо с градиентом
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.7);
    skyGradient.addColorStop(0, '#1a1a2e');
    skyGradient.addColorStop(0.5, '#16213e');
    skyGradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.7);
    
    // Звёзды
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 50; i++) {
        const x = (i * 137) % canvas.width;
        const y = (i * 97) % (canvas.height * 0.5);
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Горы на заднем плане
    ctx.fillStyle = '#1a2a4a';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.5);
    for (let x = 0; x <= canvas.width; x += 100) {
        ctx.lineTo(x, canvas.height * 0.5 - Math.sin(x * 0.01) * 50 - 30);
    }
    ctx.lineTo(canvas.width, canvas.height * 0.7);
    ctx.lineTo(0, canvas.height * 0.7);
    ctx.closePath();
    ctx.fill();
    
    // Земля
    const groundGradient = ctx.createLinearGradient(0, gameState.groundY - 50, 0, canvas.height);
    groundGradient.addColorStop(0, '#2d4a3e');
    groundGradient.addColorStop(0.3, '#1e3a2f');
    groundGradient.addColorStop(1, '#0f1f18');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, gameState.groundY, canvas.width, canvas.height - gameState.groundY);
    
    // Линия горизонта
    ctx.strokeStyle = '#3d5a4e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, gameState.groundY);
    ctx.lineTo(canvas.width, gameState.groundY);
    ctx.stroke();
}

function drawBases() {
    const config = gameState.levelConfig;
    const style = config ? config.baseStyle : 'castle';
    
    // База игрока (слева)
    drawBase(gameState.playerBaseX, gameState.groundY, false, 
             gameState.playerBaseHealth, gameState.maxBaseHealth, style);
    
    // База врага (справа)
    drawBase(gameState.enemyBaseX, gameState.groundY, true,
             gameState.enemyBaseHealth, gameState.maxEnemyBaseHealth, style);
}

function drawBase(x, y, isEnemy, health, maxHealth, style) {
    switch (style) {
        case 'fortress':
            drawFortress(x, y, isEnemy, health, maxHealth);
            break;
        case 'bunker':
            drawBunker(x, y, isEnemy, health, maxHealth);
            break;
        default:
            drawCastle(x, y, isEnemy, health, maxHealth);
    }
}

// Средневековый замок (уровень 1)
function drawCastle(x, y, isEnemy, health, maxHealth) {
    const baseWidth = 80;
    const baseHeight = 120;
    const color = isEnemy ? '#8B0000' : '#00008B';
    const accentColor = isEnemy ? '#d94a4a' : '#4a90d9';
    
    // Тень
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, baseWidth / 2 + 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Основание башни
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - baseWidth / 2, y);
    ctx.lineTo(x - baseWidth / 2 + 10, y - baseHeight);
    ctx.lineTo(x + baseWidth / 2 - 10, y - baseHeight);
    ctx.lineTo(x + baseWidth / 2, y);
    ctx.closePath();
    ctx.fill();
    
    // Зубцы
    const creneHeight = 15;
    const creneWidth = 12;
    ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
        const cx = x - baseWidth / 2 + 15 + i * (baseWidth - 20) / 3;
        ctx.fillRect(cx - creneWidth / 2, y - baseHeight - creneHeight, creneWidth, creneHeight);
    }
    
    // Окна
    ctx.fillStyle = accentColor;
    ctx.fillRect(x - 8, y - baseHeight + 30, 16, 25);
    ctx.fillRect(x - 8, y - baseHeight + 65, 16, 25);
    
    // Флаг
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 2, y - baseHeight - creneHeight, 4, -40);
    
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - baseHeight - creneHeight - 40);
    ctx.lineTo(x + 30, y - baseHeight - creneHeight - 30);
    ctx.lineTo(x + 2, y - baseHeight - creneHeight - 20);
    ctx.closePath();
    ctx.fill();
    
    drawBaseWarning(x, y, baseWidth, baseHeight, health, maxHealth);
}

// Крепость с пушкой (уровень 2)
function drawFortress(x, y, isEnemy, health, maxHealth) {
    const baseWidth = 100;
    const baseHeight = 100;
    const color = isEnemy ? '#5c3a21' : '#2c4a21';
    const accentColor = isEnemy ? '#8b4513' : '#4a8b13';
    
    // Тень
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, baseWidth / 2 + 15, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Стены крепости (толстые)
    ctx.fillStyle = color;
    ctx.fillRect(x - baseWidth / 2, y - baseHeight, baseWidth, baseHeight);
    
    // Каменная текстура
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    for (let row = 0; row < 5; row++) {
        const rowY = y - baseHeight + row * 20;
        ctx.beginPath();
        ctx.moveTo(x - baseWidth / 2, rowY);
        ctx.lineTo(x + baseWidth / 2, rowY);
        ctx.stroke();
    }
    
    // Зубцы
    for (let i = 0; i < 5; i++) {
        const cx = x - baseWidth / 2 + 10 + i * 20;
        ctx.fillStyle = color;
        ctx.fillRect(cx, y - baseHeight - 15, 15, 15);
    }
    
    // Пушка на крыше!
    const cannonX = isEnemy ? x - 35 : x + 35;
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(cannonX, y - baseHeight - 5, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Ствол пушки
    ctx.save();
    ctx.translate(cannonX, y - baseHeight - 5);
    ctx.rotate(isEnemy ? Math.PI * 0.8 : Math.PI * 0.2);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, -5, 30, 10);
    ctx.restore();
    
    // Ворота
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(x - 15, y - 50, 30, 50);
    ctx.fillStyle = '#2a1a0f';
    ctx.fillRect(x - 12, y - 45, 10, 42);
    ctx.fillRect(x + 2, y - 45, 10, 42);
    
    // Флаг
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(x - 2, y - baseHeight - 15, 4, -35);
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - baseHeight - 50);
    ctx.lineTo(x + 25, y - baseHeight - 40);
    ctx.lineTo(x + 2, y - baseHeight - 30);
    ctx.closePath();
    ctx.fill();
    
    drawBaseWarning(x, y, baseWidth, baseHeight, health, maxHealth);
}

// Современный бункер (уровень 3)
function drawBunker(x, y, isEnemy, health, maxHealth) {
    const baseWidth = 120;
    const baseHeight = 80;
    const color = isEnemy ? '#3a3a3a' : '#2a4a2a';
    const accentColor = isEnemy ? '#ff4444' : '#44ff44';
    
    // Тень
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, baseWidth / 2 + 20, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Основание бункера (низкое и широкое)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - baseWidth / 2, y);
    ctx.lineTo(x - baseWidth / 2 + 15, y - baseHeight);
    ctx.lineTo(x + baseWidth / 2 - 15, y - baseHeight);
    ctx.lineTo(x + baseWidth / 2, y);
    ctx.closePath();
    ctx.fill();
    
    // Бетонные полосы
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x - baseWidth / 2 + i * 5, y - i * 20);
        ctx.lineTo(x + baseWidth / 2 - i * 5, y - i * 20);
        ctx.stroke();
    }
    
    // Пулемётная турель!
    const turretX = isEnemy ? x - 25 : x + 25;
    
    // Основание турели
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(turretX, y - baseHeight, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Пулемёт (два ствола)
    ctx.save();
    ctx.translate(turretX, y - baseHeight);
    ctx.rotate(isEnemy ? Math.PI * 0.85 : Math.PI * 0.15);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, -8, 35, 6);
    ctx.fillRect(0, 2, 35, 6);
    ctx.restore();
    
    // Смотровые щели
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
    ctx.fillRect(x - 30, y - 50, 20, 8);
    ctx.fillRect(x + 10, y - 50, 20, 8);
    ctx.globalAlpha = 1;
    
    // Антенна
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - baseHeight);
    ctx.lineTo(x, y - baseHeight - 40);
    ctx.stroke();
    
    // Мигающий огонёк
    ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(Date.now() * 0.01) * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y - baseHeight - 40, 4, 0, Math.PI * 2);
    ctx.fill();
    
    drawBaseWarning(x, y, baseWidth, baseHeight, health, maxHealth);
}

function drawBaseWarning(x, y, baseWidth, baseHeight, health, maxHealth) {
    // Свечение при низком здоровье
    if (health < maxHealth * 0.3) {
        ctx.strokeStyle = `rgba(255, 0, 0, ${0.3 + Math.sin(Date.now() * 0.01) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - baseWidth / 2 - 5, y);
        ctx.lineTo(x - baseWidth / 2 + 5, y - baseHeight - 5);
        ctx.lineTo(x + baseWidth / 2 - 5, y - baseHeight - 5);
        ctx.lineTo(x + baseWidth / 2 + 5, y);
        ctx.closePath();
        ctx.stroke();
    }
}

// ==========================================
// UI ОБНОВЛЕНИЕ
// ==========================================
function updateUI() {
    if (!gameState.isPlaying) return;
    
    // Золото
    document.getElementById('player-gold').textContent = Math.floor(gameState.playerGold);
    document.getElementById('enemy-gold').textContent = Math.floor(gameState.enemyGold);
    
    // Здоровье баз (с учётом разных максимумов)
    const playerHealthPercent = (gameState.playerBaseHealth / gameState.maxBaseHealth) * 100;
    const enemyHealthPercent = (gameState.enemyBaseHealth / gameState.maxEnemyBaseHealth) * 100;
    
    document.getElementById('player-health-fill').style.width = `${playerHealthPercent}%`;
    document.getElementById('enemy-health-fill').style.width = `${enemyHealthPercent}%`;
    document.getElementById('player-health-text').textContent = Math.max(0, Math.floor(gameState.playerBaseHealth));
    document.getElementById('enemy-health-text').textContent = Math.max(0, Math.floor(gameState.enemyBaseHealth));
    
    // Доступность кнопок юнитов
    document.querySelectorAll('.unit-btn:not(#airstrike-btn)').forEach(btn => {
        const cost = parseInt(btn.dataset.cost);
        const unitType = btn.dataset.unit;
        const config = gameState.levelConfig;
        const isUnlocked = config && config.unlockedUnits.includes(unitType);
        btn.disabled = gameState.playerGold < cost || gameState.gameOver || !isUnlocked;
    });
    
    // Кнопка авиаудара
    updateAirstrikeButton();
}

// ==========================================
// СПАВН ЮНИТОВ ИГРОКА
// ==========================================
function spawnPlayerUnit(type) {
    if (gameState.gameOver || !gameState.isPlaying) return;
    
    const cost = UNIT_TYPES[type].cost;
    if (gameState.playerGold >= cost) {
        gameState.playerGold -= cost;
        gameState.units.push(new Unit(type, false));
    }
}

// ==========================================
// ГЛАВНЫЙ ИГРОВОЙ ЦИКЛ
// ==========================================
function gameLoop(timestamp) {
    const deltaTime = Math.min((timestamp - gameState.lastTime) / 1000, 0.1);
    gameState.lastTime = timestamp;
    
    // Обновляем размеры
    gameState.groundY = canvas.height * 0.75;
    gameState.playerBaseX = 80;
    gameState.enemyBaseX = canvas.width - 80;
    
    if (!gameState.gameOver && gameState.isPlaying) {
        // Накопление золота (разная скорость для игрока и AI)
        gameState.playerGold += gameState.goldPerSecond * deltaTime;
        gameState.enemyGold += gameState.enemyGoldPerSecond * deltaTime;
        
        // AI противника
        enemyAI.update(deltaTime);
        
        // Турели баз
        updateBaseTurrets(deltaTime);
        
        // Обновляем юнитов
        gameState.units = gameState.units.filter(unit => unit.update(deltaTime, gameState.units));
        
        // Обновляем снаряды
        gameState.projectiles = gameState.projectiles.filter(p => p.update(deltaTime));
        
        // Обновляем авиаудары
        gameState.airstrikes = gameState.airstrikes.filter(a => a.update(deltaTime));
        
        // Обновляем частицы
        gameState.particles = gameState.particles.filter(p => p.update(deltaTime));
        
        // Кулдаун авиаудара
        if (gameState.playerAirstrikeCooldown > 0) {
            gameState.playerAirstrikeCooldown -= deltaTime;
        }
        if (gameState.enemyAirstrikeCooldown > 0) {
            gameState.enemyAirstrikeCooldown -= deltaTime;
        }
        
        // Проверка победы/поражения
        if (gameState.playerBaseHealth <= 0) {
            gameState.gameOver = true;
            gameState.winner = 'enemy';
            showGameOver(false);
        } else if (gameState.enemyBaseHealth <= 0) {
            gameState.gameOver = true;
            gameState.winner = 'player';
            showGameOver(true);
        }
    }
    
    // Отрисовка
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawBases();
    
    // Сортировка юнитов по Y для правильного перекрытия
    gameState.units.sort((a, b) => a.y - b.y);
    gameState.units.forEach(unit => unit.draw());
    
    // Снаряды
    gameState.projectiles.forEach(p => p.draw());
    
    // Авиаудары
    gameState.airstrikes.forEach(a => a.draw());
    
    // Частицы
    gameState.particles.forEach(p => p.draw());
    
    // UI
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

// ==========================================
// КОНЕЦ ИГРЫ
// ==========================================
function calculateStars() {
    // Звёзды за HP базы игрока
    const hpPercent = gameState.playerBaseHealth / gameState.maxBaseHealth;
    if (hpPercent >= 0.8) return 3;      // 80%+ HP = 3 звезды
    if (hpPercent >= 0.5) return 2;      // 50%+ HP = 2 звезды
    return 1;                             // Победа = минимум 1 звезда
}

function showGameOver(isVictory) {
    const gameOverEl = document.getElementById('game-over');
    const textEl = document.getElementById('game-over-text');
    const starsEl = document.getElementById('stars-earned');
    const statsEl = document.getElementById('game-over-stats');
    const nextBtn = document.getElementById('next-level-btn');
    
    // Логируем конец игры
    const gameDuration = ((performance.now() - gameState.startTime) / 1000).toFixed(1);
    AI_LOG.log('GAME_OVER', isVictory ? 'AI ПРОИГРАЛ' : 'AI ПОБЕДИЛ', {
        winner: isVictory ? 'player' : 'enemy',
        duration: gameDuration + 's',
        finalPlayerHP: gameState.playerBaseHealth,
        finalEnemyHP: gameState.enemyBaseHealth,
        summary: AI_LOG.getSummary()
    });
    
    gameOverEl.classList.remove('hidden');
    
    if (isVictory) {
        textEl.textContent = 'ПОБЕДА!';
        textEl.classList.remove('defeat');
        
        // Считаем звёзды
        const stars = calculateStars();
        starsEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        starsEl.style.display = 'block';
        
        // Сохраняем прогресс
        playerProgress.setStars(currentLevel, stars);
        
        // Разблокируем следующий уровень
        if (currentLevel < 3) {
            playerProgress.unlockLevel(currentLevel + 1);
            nextBtn.classList.remove('hidden');
        } else {
            nextBtn.classList.add('hidden');
        }
        
        // Статистика
        const hpPercent = Math.floor((gameState.playerBaseHealth / gameState.maxBaseHealth) * 100);
        statsEl.textContent = `База: ${hpPercent}% HP | Время: ${gameDuration}с`;
        
        console.log('=== AI ПРОИГРАЛ! Лог доступен через AI_LOG.download() ===');
    } else {
        textEl.textContent = 'ПОРАЖЕНИЕ';
        textEl.classList.add('defeat');
        starsEl.style.display = 'none';
        nextBtn.classList.add('hidden');
        statsEl.textContent = `Время: ${gameDuration}с`;
    }
    
    // Обновляем меню уровней
    updateLevelSelect();
}

function startLevel(level) {
    const config = LEVELS[level];
    if (!config) return;
    
    currentLevel = level;
    gameState.levelConfig = config;
    
    // Применяем настройки уровня
    gameState.playerGold = config.playerGold;
    gameState.enemyGold = config.enemyGold;
    gameState.playerBaseHealth = config.playerBaseHealth;
    gameState.maxBaseHealth = config.playerBaseHealth;
    gameState.enemyBaseHealth = config.enemyBaseHealth;
    gameState.maxEnemyBaseHealth = config.enemyBaseHealth;
    gameState.goldPerSecond = config.goldPerSecond;
    gameState.enemyGoldPerSecond = config.enemyGoldPerSecond;
    gameState.units = [];
    gameState.projectiles = [];
    gameState.particles = [];
    gameState.airstrikes = [];
    gameState.gameOver = false;
    gameState.winner = null;
    gameState.isPlaying = true;
    gameState.startTime = performance.now();
    
    // Сброс турелей и авиаударов
    gameState.playerTurretCooldown = 0;
    gameState.enemyTurretCooldown = 0;
    gameState.playerAirstrikeCooldown = 0;
    gameState.enemyAirstrikeCooldown = 0;
    
    // Настраиваем AI под уровень
    enemyAI.reset();
    enemyAI.baseDecisionInterval = config.aiSpeed;
    
    // Очищаем лог
    AI_LOG.clear();
    AI_LOG.log('GAME_START', `Уровень ${level}: ${config.name}`, { level, config });
    
    // Показываем UI
    document.getElementById('level-select').classList.add('hidden');
    document.getElementById('top-panel').classList.remove('hidden');
    document.getElementById('unit-panel').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');
    
    // Обновляем панель юнитов под эпоху
    updateUnitPanel(config);
    
    // Обновляем название уровня
    document.getElementById('current-level-name').textContent = `Ур. ${level}: ${config.name}`;
}

function restartGame() {
    startLevel(currentLevel);
}

function goToMenu() {
    gameState.isPlaying = false;
    gameState.gameOver = true;
    
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('top-panel').classList.add('hidden');
    document.getElementById('unit-panel').classList.add('hidden');
    document.getElementById('level-select').classList.remove('hidden');
    
    updateLevelSelect();
}

function nextLevel() {
    if (currentLevel < 3) {
        startLevel(currentLevel + 1);
    }
}

function updateLevelSelect() {
    // Обновляем карточки уровней
    for (let i = 1; i <= 3; i++) {
        const card = document.querySelector(`.level-card[data-level="${i}"]`);
        const starsEl = document.getElementById(`stars-${i}`);
        const lockEl = document.getElementById(`lock-${i}`);
        
        if (playerProgress.isUnlocked(i)) {
            card.classList.remove('locked');
            if (lockEl) lockEl.textContent = '🔓';
            
            // Показываем звёзды
            const stars = playerProgress.stars[i] || 0;
            starsEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        } else {
            card.classList.add('locked');
            if (lockEl) lockEl.textContent = '🔒';
            starsEl.textContent = '☆☆☆';
        }
    }
}

function updateUnitPanel(config) {
    // Показываем/скрываем кнопки юнитов в зависимости от эпохи
    document.querySelectorAll('.unit-btn').forEach(btn => {
        const unitType = btn.dataset.unit;
        if (config.unlockedUnits.includes(unitType)) {
            btn.classList.remove('locked-unit');
            btn.style.display = 'flex';
        } else {
            btn.classList.add('locked-unit');
            btn.style.display = 'none';
        }
    });
    
    // Показываем/скрываем кнопку авиаудара
    const airstrikeBtn = document.getElementById('airstrike-btn');
    if (airstrikeBtn) {
        if (config.airstrike) {
            airstrikeBtn.style.display = 'flex';
            airstrikeBtn.querySelector('.unit-cost').textContent = config.airstrikeCost + '💰';
        } else {
            airstrikeBtn.style.display = 'none';
        }
    }
}

function updateAirstrikeButton() {
    const btn = document.getElementById('airstrike-btn');
    const panel = document.getElementById('airstrike-panel');
    
    const config = gameState.levelConfig;
    if (!config || !config.airstrike) {
        if (btn) btn.style.display = 'none';
        if (panel) panel.classList.add('hidden');
        return;
    }
    
    // Показываем кнопку и панель
    if (btn) btn.style.display = 'flex';
    if (panel) panel.classList.remove('hidden');
    
    const cooldown = gameState.playerAirstrikeCooldown;
    const maxCooldown = gameState.airstrikeCooldownTime;
    const hasGold = gameState.playerGold >= config.airstrikeCost;
    const isReady = cooldown <= 0 && hasGold;
    
    // Обновляем кнопку
    if (btn) {
        btn.disabled = !isReady || gameState.gameOver;
        
        const nameEl = btn.querySelector('.unit-name');
        const costEl = btn.querySelector('.unit-cost');
        
        if (cooldown > 0) {
            nameEl.textContent = `⏱️ ${Math.ceil(cooldown)}с`;
            btn.classList.remove('airstrike-ready');
            btn.classList.add('airstrike-cooldown');
        } else if (!hasGold) {
            nameEl.textContent = 'Авиаудар';
            btn.classList.remove('airstrike-ready', 'airstrike-cooldown');
        } else {
            nameEl.textContent = '✈️ ГОТОВ!';
            btn.classList.add('airstrike-ready');
            btn.classList.remove('airstrike-cooldown');
        }
        
        costEl.textContent = config.airstrikeCost + '💰';
    }
    
    // Обновляем панель на экране
    if (panel) {
        const barFill = document.getElementById('airstrike-bar-fill');
        const timerEl = document.getElementById('airstrike-timer');
        const costDisplay = document.getElementById('airstrike-cost-display');
        
        // Стоимость
        if (costDisplay) {
            costDisplay.textContent = config.airstrikeCost + '💰';
        }
        
        // Прогресс бар и таймер
        if (cooldown > 0) {
            const progress = ((maxCooldown - cooldown) / maxCooldown) * 100;
            if (barFill) barFill.style.width = progress + '%';
            if (timerEl) timerEl.textContent = Math.ceil(cooldown) + 'с';
            panel.classList.remove('ready', 'no-gold');
        } else if (!hasGold) {
            if (barFill) barFill.style.width = '100%';
            if (timerEl) timerEl.textContent = 'Нет 💰';
            panel.classList.remove('ready');
            panel.classList.add('no-gold');
        } else {
            if (barFill) barFill.style.width = '100%';
            if (timerEl) timerEl.textContent = '✅ ГОТОВ!';
            panel.classList.add('ready');
            panel.classList.remove('no-gold');
        }
    }
}

// ==========================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ==========================================

// Кнопки юнитов
document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        spawnPlayerUnit(btn.dataset.unit);
    });
    
    // Тач-события для мобильных
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        spawnPlayerUnit(btn.dataset.unit);
    });
});

// Горячие клавиши
document.addEventListener('keydown', (e) => {
    if (gameState.gameOver) return;
    
    switch (e.key.toLowerCase()) {
        case '1':
            spawnPlayerUnit('spearman');
            break;
        case '2':
            spawnPlayerUnit('archer');
            break;
        case '3':
            spawnPlayerUnit('musketeer');
            break;
        case '4':
            spawnPlayerUnit('shieldbearer');
            break;
        case '5':
            spawnPlayerUnit('tank');
            break;
        case 'q':
        case 'й':  // Русская раскладка
            activatePlayerAirstrike();
            break;
    }
});

// Режим авиаудара
let airstrikeMode = false;

function activatePlayerAirstrike() {
    const config = gameState.levelConfig;
    if (!config || !config.airstrike) return;
    if (gameState.playerAirstrikeCooldown > 0) return;
    if (gameState.playerGold < config.airstrikeCost) return;
    
    airstrikeMode = true;
    canvas.style.cursor = 'crosshair';
    showAirstrikeHint(true);
}

function showAirstrikeHint(show) {
    let hint = document.getElementById('airstrike-hint');
    
    if (show) {
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'airstrike-hint';
            hint.innerHTML = '✈️ Выбери цель для авиаудара!<br><small>ПКМ - отмена</small>';
            document.getElementById('game-container').appendChild(hint);
        }
        hint.classList.add('visible');
    } else if (hint) {
        hint.classList.remove('visible');
    }
}

// Клик на canvas для авиаудара
canvas.addEventListener('click', (e) => {
    if (!airstrikeMode) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Авиаудар только по правой половине (враги)
    if (x > canvas.width * 0.3) {
        callAirstrike(x, false);
    }
    
    airstrikeMode = false;
    canvas.style.cursor = 'default';
    showAirstrikeHint(false);
});

// Отмена авиаудара правой кнопкой
canvas.addEventListener('contextmenu', (e) => {
    if (airstrikeMode) {
        e.preventDefault();
        airstrikeMode = false;
        canvas.style.cursor = 'default';
        showAirstrikeHint(false);
    }
});

// Кнопка авиаудара
document.getElementById('airstrike-btn')?.addEventListener('click', activatePlayerAirstrike);

// Кнопки конца игры
document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('menu-btn').addEventListener('click', goToMenu);
document.getElementById('next-level-btn').addEventListener('click', nextLevel);

// Карточки уровней
document.querySelectorAll('.level-card').forEach(card => {
    card.addEventListener('click', () => {
        const level = parseInt(card.dataset.level);
        if (playerProgress.isUnlocked(level)) {
            startLevel(level);
        }
    });
});

// Предотвращаем зум на мобильных
document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// Инициализация
gameState.lastTime = performance.now();
updateLevelSelect();
requestAnimationFrame(gameLoop);
