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
    goldPerSecond: 15,
    startTime: performance.now(),
    units: [],
    projectiles: [],
    particles: [],
    gameOver: false,
    winner: null,
    lastTime: 0,
    groundY: 0,          // Будет вычислено
    playerBaseX: 0,
    enemyBaseX: 0
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
    // База игрока (слева)
    drawBase(gameState.playerBaseX, gameState.groundY, false, 
             gameState.playerBaseHealth, gameState.maxBaseHealth);
    
    // База врага (справа)
    drawBase(gameState.enemyBaseX, gameState.groundY, true,
             gameState.enemyBaseHealth, gameState.maxBaseHealth);
}

function drawBase(x, y, isEnemy, health, maxHealth) {
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
    // Золото
    document.getElementById('player-gold').textContent = Math.floor(gameState.playerGold);
    document.getElementById('enemy-gold').textContent = Math.floor(gameState.enemyGold);
    
    // Здоровье баз
    const playerHealthPercent = (gameState.playerBaseHealth / gameState.maxBaseHealth) * 100;
    const enemyHealthPercent = (gameState.enemyBaseHealth / gameState.maxBaseHealth) * 100;
    
    document.getElementById('player-health-fill').style.width = `${playerHealthPercent}%`;
    document.getElementById('enemy-health-fill').style.width = `${enemyHealthPercent}%`;
    document.getElementById('player-health-text').textContent = Math.max(0, Math.floor(gameState.playerBaseHealth));
    document.getElementById('enemy-health-text').textContent = Math.max(0, Math.floor(gameState.enemyBaseHealth));
    
    // Доступность кнопок
    document.querySelectorAll('.unit-btn').forEach(btn => {
        const cost = parseInt(btn.dataset.cost);
        btn.disabled = gameState.playerGold < cost || gameState.gameOver;
    });
}

// ==========================================
// СПАВН ЮНИТОВ ИГРОКА
// ==========================================
function spawnPlayerUnit(type) {
    if (gameState.gameOver) return;
    
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
    
    if (!gameState.gameOver) {
        // Накопление золота
        gameState.playerGold += gameState.goldPerSecond * deltaTime;
        gameState.enemyGold += gameState.goldPerSecond * deltaTime;
        
        // AI противника
        enemyAI.update(deltaTime);
        
        // Обновляем юнитов
        gameState.units = gameState.units.filter(unit => unit.update(deltaTime, gameState.units));
        
        // Обновляем снаряды
        gameState.projectiles = gameState.projectiles.filter(p => p.update(deltaTime));
        
        // Обновляем частицы
        gameState.particles = gameState.particles.filter(p => p.update(deltaTime));
        
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
    
    // Частицы
    gameState.particles.forEach(p => p.draw());
    
    // UI
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

// ==========================================
// КОНЕЦ ИГРЫ
// ==========================================
function showGameOver(isVictory) {
    const gameOverEl = document.getElementById('game-over');
    const textEl = document.getElementById('game-over-text');
    
    // Логируем конец игры
    const gameDuration = ((performance.now() - gameState.startTime) / 1000).toFixed(1);
    AI_LOG.log('GAME_OVER', isVictory ? 'AI ПРОИГРАЛ' : 'AI ПОБЕДИЛ', {
        winner: isVictory ? 'player' : 'enemy',
        duration: gameDuration + 's',
        finalPlayerHP: gameState.playerBaseHealth,
        finalEnemyHP: gameState.enemyBaseHealth,
        summary: AI_LOG.getSummary()
    });
    
    // Автоматически скачиваем лог если AI проиграл
    if (isVictory) {
        console.log('=== AI ПРОИГРАЛ! Лог доступен через AI_LOG.download() ===');
        console.log('Сводка:', AI_LOG.getSummary());
    }
    
    gameOverEl.classList.remove('hidden');
    
    if (isVictory) {
        textEl.textContent = 'ПОБЕДА!';
        textEl.classList.remove('defeat');
    } else {
        textEl.textContent = 'ПОРАЖЕНИЕ';
        textEl.classList.add('defeat');
    }
}

function restartGame() {
    // Логируем итоги прошлой игры
    if (AI_LOG.entries.length > 0) {
        AI_LOG.log('GAME_END', 'Игра перезапущена', AI_LOG.getSummary());
    }
    
    gameState.playerGold = 100;
    gameState.enemyGold = 100;
    gameState.playerBaseHealth = 1000;
    gameState.enemyBaseHealth = 1000;
    gameState.units = [];
    gameState.projectiles = [];
    gameState.particles = [];
    gameState.gameOver = false;
    gameState.winner = null;
    gameState.startTime = performance.now();
    
    // Сбрасываем AI
    enemyAI.reset();
    
    // Очищаем лог для новой игры
    AI_LOG.clear();
    AI_LOG.log('GAME_START', 'Новая игра началась', {});
    
    document.getElementById('game-over').classList.add('hidden');
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
    
    switch (e.key) {
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
    }
});

// Кнопка рестарта
document.getElementById('restart-btn').addEventListener('click', restartGame);

// Предотвращаем зум на мобильных
document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// Запуск игры
gameState.lastTime = performance.now();
gameState.startTime = performance.now();
AI_LOG.clear();
AI_LOG.log('GAME_START', 'Игра запущена', {});
requestAnimationFrame(gameLoop);
