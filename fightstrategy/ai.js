// ==========================================
// AI ПРОТИВНИКА - ПРОДУМАННАЯ СТРАТЕГИЯ v3
// ==========================================

// Логирование AI
const AI_LOG = {
  enabled: true,
  entries: [],
  maxEntries: 5000,

  log(type, message, data = {}) {
    if (!this.enabled) return;

    const entry = {
      time: (performance.now() / 1000).toFixed(1),
      gameTime: ((performance.now() - gameState.startTime) / 1000).toFixed(1),
      type,
      message,
      data,
      gold: Math.floor(gameState.enemyGold),
      playerGold: Math.floor(gameState.playerGold),
      enemyHP: gameState.enemyBaseHealth,
      playerHP: gameState.playerBaseHealth
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    console.log(`[AI ${entry.gameTime}s] ${type}: ${message}`, data);
  },

  clear() {
    this.entries = [];
  },

  export() {
    return JSON.stringify(this.entries, null, 2);
  },

  download() {
    const blob = new Blob([this.export()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_log_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  getSummary() {
    const spawns = this.entries.filter(e => e.type === 'SPAWN');
    const strategies = this.entries.filter(e => e.type === 'STRATEGY');

    const spawnCounts = {};
    spawns.forEach(s => {
      spawnCounts[s.data.unit] = (spawnCounts[s.data.unit] || 0) + 1;
    });

    return {
      totalDecisions: this.entries.filter(e => e.type === 'DECISION').length,
      totalSpawns: spawns.length,
      spawnCounts,
      strategies: strategies.map(s => s.data.strategy)
    };
  }
};

window.AI_LOG = AI_LOG;

// ==========================================
// ГЛАВНЫЙ КЛАСС AI
// ==========================================
// 
// ПРАВИЛА:
// 1. Копим на мушкетёров (дорогие, но мощные) - лучше сразу 2-3
// 2. После мушкетёров - копейщики (они быстрее, обгонят и прикроют)
// 3. Мушкетёры ВСЕГДА должны быть прикрыты копейщиками
// 4. Если ситуация не позволяет копить - всё равно иногда делаем мушкетёров
// 5. Для вариативности - иногда лучники и щитоносцы
// 6. Защита - много копейщиков быстро
// 7. Вариативность через случайность
//

class EnemyAI {
  constructor() {
    this.decisionCooldown = 0;
    this.baseDecisionInterval = 0.2;
    this.spawnQueue = [];
    this.lastSpawnedType = null;
    this.spawnCounter = 0;
    
    // Состояние планирования
    this.currentPlan = null; // 'save_musketeers', 'save_spearmen', 'react', null
    this.planTarget = 0; // Сколько копим
    this.planProgress = 0; // Сколько уже сделали в плане
  }

  update(deltaTime) {
    this.decisionCooldown -= deltaTime;

    // Спавним из очереди (только доступные юниты!)
    if (this.spawnQueue.length > 0) {
      const nextUnit = this.spawnQueue[0];
      const config = gameState.levelConfig;
      const isUnlocked = config && config.unlockedUnits.includes(nextUnit);
      
      if (isUnlocked && gameState.enemyGold >= UNIT_TYPES[nextUnit].cost) {
        this.spawnUnit(this.spawnQueue.shift());
      } else if (!isUnlocked) {
        // Юнит недоступен на этом уровне - убираем из очереди
        this.spawnQueue.shift();
      }
    }

    // Если очередь пуста и есть золото - думаем
    if (this.spawnQueue.length === 0 && gameState.enemyGold >= 50) {
      this.decisionCooldown = 0;
    }

    if (this.decisionCooldown <= 0) {
      this.think();
      this.decisionCooldown = this.baseDecisionInterval + Math.random() * 0.1;
    }
    
    // Проверяем возможность авиаудара
    this.considerAirstrike();
  }
  
  considerAirstrike() {
    const config = gameState.levelConfig;
    if (!config || !config.airstrike) return;
    if (gameState.enemyAirstrikeCooldown > 0) return;
    if (gameState.enemyGold < config.airstrikeCost) return;
    
    // Считаем врагов в разных зонах
    const playerUnits = gameState.units.filter(u => !u.isEnemy && !u.isDead);
    if (playerUnits.length < 3) return; // Не тратим на малое количество
    
    // Находим скопление врагов
    let bestX = 0;
    let bestCount = 0;
    
    for (let x = 200; x < canvas.width * 0.7; x += 50) {
      let count = 0;
      for (const unit of playerUnits) {
        if (Math.abs(unit.x - x) < config.airstrikeRadius) {
          count++;
        }
      }
      if (count > bestCount) {
        bestCount = count;
        bestX = x;
      }
    }
    
    // Бьём если 3+ врагов в зоне
    if (bestCount >= 3) {
      AI_LOG.log('AIRSTRIKE', 'AI вызывает авиаудар!', { targetX: bestX, enemiesInZone: bestCount });
      callAirstrike(bestX, true);
    }
  }

  think() {
    const analysis = this.analyzeBattlefield();
    const gold = gameState.enemyGold;
    const luck = Math.random();

    AI_LOG.log('THINK', 'Анализ ситуации', {
      gold: Math.floor(gold),
      myArmy: analysis.my,
      enemyArmy: analysis.player,
      threat: Math.floor(analysis.nearestThreat),
      powerRatio: analysis.powerRatio.toFixed(2),
      plan: this.currentPlan,
      planTarget: this.planTarget,
      planProgress: this.planProgress
    });

    // =====================
    // ЭКСТРЕННАЯ ЗАЩИТА - отменяет все планы
    // =====================
    if (analysis.nearestThreat < 200) {
      this.currentPlan = null;
      this.planProgress = 0;
      
      // Срочно спавним что можем!
      if (gold >= UNIT_TYPES.spearman.cost) {
        this.spawn('spearman', 'ЭКСТРЕННО: Враг у базы! Копейщик!');
        return;
      }
      AI_LOG.log('WAIT', 'Ждём золото для защиты', { gold: Math.floor(gold) });
      return;
    }

    // =====================
    // РЕЖИМ ЗАЩИТЫ - много копейщиков быстро
    // =====================
    if (analysis.needDefense) {
      // Отменяем план накопления на мушкетёров
      if (this.currentPlan === 'save_musketeers') {
        AI_LOG.log('PLAN_CANCEL', 'Отмена плана - нужна защита', {});
        this.currentPlan = null;
      }

      // Спавним копейщиков для защиты
      if (gold >= UNIT_TYPES.spearman.cost) {
        // Иногда щитоносец для вариативности (20% шанс)
        if (luck < 0.2 && gold >= UNIT_TYPES.shieldbearer.cost && analysis.my.shieldbearer < 2) {
          this.spawn('shieldbearer', 'ЗАЩИТА: Щитоносец для крепкой обороны');
          return;
        }
        this.spawn('spearman', 'ЗАЩИТА: Копейщик для обороны');
        return;
      }
      return;
    }

    // =====================
    // ПЛАН: КОПИМ НА МУШКЕТЁРОВ
    // =====================
    if (this.currentPlan === 'save_musketeers') {
      const musketeerCost = UNIT_TYPES.musketeer.cost;
      const targetGold = musketeerCost * this.planTarget;

      // Проверяем, можем ли продолжать копить
      if (analysis.canSave) {
        if (gold >= targetGold) {
          // Накопили! Спавним мушкетёров
          for (let i = 0; i < this.planTarget; i++) {
            this.queueUnit('musketeer');
          }
          AI_LOG.log('PLAN_EXECUTE', `Накопили! Спавним ${this.planTarget} мушкетёров`, {
            gold: Math.floor(gold),
            count: this.planTarget
          });
          
          // Теперь нужны копейщики для прикрытия (они быстрее, обгонят)
          const spearsNeeded = Math.max(2, this.planTarget + 1);
          for (let i = 0; i < spearsNeeded; i++) {
            this.queueUnit('spearman');
          }
          AI_LOG.log('PLAN_COVER', `Добавляем ${spearsNeeded} копейщиков для прикрытия`, {});
          
          this.currentPlan = null;
          this.planProgress = 0;
          return;
        }
        
        // Продолжаем копить
        AI_LOG.log('SAVING', `Копим на ${this.planTarget} мушкетёров`, {
          gold: Math.floor(gold),
          need: targetGold,
          progress: ((gold / targetGold) * 100).toFixed(0) + '%'
        });
        return;
      } else {
        // Не можем копить - отменяем план, но делаем хоть что-то
        AI_LOG.log('PLAN_ABORT', 'Не можем копить - угроза', {});
        this.currentPlan = null;
        
        // Если хватает хотя бы на одного мушкетёра - делаем
        if (gold >= musketeerCost) {
          this.spawn('musketeer', 'ПЛАН СОРВАН: Хотя бы один мушкетёр');
          // И копейщиков для прикрытия
          if (gold >= UNIT_TYPES.spearman.cost * 2) {
            this.queueUnit('spearman');
            this.queueUnit('spearman');
          }
          return;
        }
      }
    }

    // =====================
    // РЕШАЕМ ЧТО ДЕЛАТЬ
    // =====================
    const myMuskets = analysis.my.musketeer;
    const mySpears = analysis.my.spearman;
    const myArchers = analysis.my.archer;
    const myShields = analysis.my.shieldbearer;
    const myTotal = analysis.my.total;
    const myRanged = myMuskets + myArchers;
    const myMelee = mySpears + myShields;

    // =====================
    // ПРАВИЛО: Мушкетёры должны быть прикрыты
    // =====================
    if (myMuskets > 0 && myMelee < myMuskets * 2) {
      // Мало мили для прикрытия мушкетёров!
      if (gold >= UNIT_TYPES.spearman.cost) {
        this.spawn('spearman', 'ПРИКРЫТИЕ: Копейщик для мушкетёров');
        return;
      }
    }

    // =====================
    // НАЧАЛО ИГРЫ - разные стартовые стратегии
    // =====================
    if (myTotal === 0) {
      // Вариативность в начале!
      if (luck < 0.4) {
        // 40% - сразу копим на 2 мушкетёра
        this.currentPlan = 'save_musketeers';
        this.planTarget = 2;
        AI_LOG.log('PLAN_START', 'Стартовый план: копим на 2 мушкетёра', {});
        return;
      } else if (luck < 0.7) {
        // 30% - начинаем с копейщика
        this.spawn('spearman', 'СТАРТ: Быстрый копейщик');
        return;
      } else {
        // 30% - копим на 3 мушкетёра (жадный старт)
        this.currentPlan = 'save_musketeers';
        this.planTarget = 3;
        AI_LOG.log('PLAN_START', 'Жадный старт: копим на 3 мушкетёра', {});
        return;
      }
    }

    // =====================
    // МАЛО СТРЕЛКОВ - нужны мушкетёры
    // =====================
    if (myRanged < 2) {
      // Если можем безопасно копить - копим на 2 мушкетёра
      if (analysis.canSave && gold < UNIT_TYPES.musketeer.cost * 2) {
        this.currentPlan = 'save_musketeers';
        this.planTarget = 2;
        AI_LOG.log('PLAN_START', 'Нужны стрелки: копим на 2 мушкетёра', {});
        return;
      }
      
      // Проверяем доступные юниты на этом уровне
      const config = gameState.levelConfig;
      const canTank = config && config.unlockedUnits.includes('tank');
      const canMusketeer = config && config.unlockedUnits.includes('musketeer');
      
      // Танк - мощный выбор на 3 уровне (20% шанс если хватает денег)
      if (canTank && luck < 0.2 && gold >= UNIT_TYPES.tank.cost) {
        this.spawn('tank', 'АТАКА: Танк - мощная огневая поддержка');
        this.queueUnit('spearman');
        return;
      }
      
      // Хватает на мушкетёра - делаем
      if (canMusketeer && gold >= UNIT_TYPES.musketeer.cost) {
        this.spawn('musketeer', 'АТАКА: Мушкетёр для огневой мощи');
        // Добавляем копейщиков для прикрытия
        this.queueUnit('spearman');
        this.queueUnit('spearman');
        return;
      }
      
      // Не хватает - иногда лучник (30% шанс), иначе копейщик
      if (luck < 0.3 && gold >= UNIT_TYPES.archer.cost) {
        this.spawn('archer', 'ВАРИАТИВНОСТЬ: Лучник вместо ожидания');
        return;
      }
      
      if (gold >= UNIT_TYPES.spearman.cost) {
        this.spawn('spearman', 'РАЗВИТИЕ: Копейщик пока копим');
        return;
      }
    }

    // =====================
    // ЕСТЬ СТРЕЛКИ - ПОДДЕРЖИВАЕМ БАЛАНС
    // =====================
    
    // Нужно больше мили для прикрытия?
    if (myMelee < myRanged * 2) {
      // Иногда щитоносец (25% шанс)
      if (luck < 0.25 && gold >= UNIT_TYPES.shieldbearer.cost && myShields < 2) {
        this.spawn('shieldbearer', 'БАЛАНС: Щитоносец для крепкого фронта');
        return;
      }
      if (gold >= UNIT_TYPES.spearman.cost) {
        this.spawn('spearman', 'БАЛАНС: Копейщик для прикрытия');
        return;
      }
    }

    // =====================
    // АРМИЯ СБАЛАНСИРОВАНА - УСИЛИВАЕМ
    // =====================
    
    // Иногда копим на волну мушкетёров (20% шанс)
    if (luck < 0.2 && analysis.canSave && myRanged < 4) {
      this.currentPlan = 'save_musketeers';
      this.planTarget = 2;
      AI_LOG.log('PLAN_START', 'Усиление: копим на волну мушкетёров', {});
      return;
    }
    
    // Хватает на мушкетёра - делаем (40% шанс)
    if (luck < 0.4 && gold >= UNIT_TYPES.musketeer.cost && myRanged < 4) {
      this.spawn('musketeer', 'УСИЛЕНИЕ: Ещё мушкетёр');
      this.queueUnit('spearman'); // И копейщик для прикрытия
      return;
    }
    
    // Лучник для вариативности (15% шанс)
    if (luck < 0.15 && gold >= UNIT_TYPES.archer.cost && myArchers < 2) {
      this.spawn('archer', 'ВАРИАТИВНОСТЬ: Лучник');
      return;
    }
    
    // Щитоносец для вариативности (15% шанс)
    if (luck < 0.15 && gold >= UNIT_TYPES.shieldbearer.cost && myShields < 2) {
      this.spawn('shieldbearer', 'ВАРИАТИВНОСТЬ: Щитоносец');
      return;
    }
    
    // По умолчанию - копейщик
    if (gold >= UNIT_TYPES.spearman.cost) {
      this.spawn('spearman', 'СТАНДАРТ: Копейщик');
      return;
    }

    AI_LOG.log('WAIT', 'Ждём золото', { gold: Math.floor(gold) });
  }

  analyzeBattlefield() {
    const enemyUnits = gameState.units.filter(u => u.isEnemy && !u.isDead);
    const playerUnits = gameState.units.filter(u => !u.isEnemy && !u.isDead);

    const my = {
      spearman: enemyUnits.filter(u => u.type === 'spearman').length,
      archer: enemyUnits.filter(u => u.type === 'archer').length,
      musketeer: enemyUnits.filter(u => u.type === 'musketeer').length,
      shieldbearer: enemyUnits.filter(u => u.type === 'shieldbearer').length,
      total: enemyUnits.length,
      totalHP: enemyUnits.reduce((sum, u) => sum + u.health, 0),
      totalDPS: enemyUnits.reduce((sum, u) => sum + u.damage * u.attackSpeed, 0)
    };

    const player = {
      spearman: playerUnits.filter(u => u.type === 'spearman').length,
      archer: playerUnits.filter(u => u.type === 'archer').length,
      musketeer: playerUnits.filter(u => u.type === 'musketeer').length,
      shieldbearer: playerUnits.filter(u => u.type === 'shieldbearer').length,
      total: playerUnits.length,
      totalHP: playerUnits.reduce((sum, u) => sum + u.health, 0),
      totalDPS: playerUnits.reduce((sum, u) => sum + u.damage * u.attackSpeed, 0)
    };

    // Ближайшая угроза
    let nearestThreat = Infinity;
    for (const unit of playerUnits) {
      const dist = gameState.enemyBaseX - unit.x;
      if (dist < nearestThreat) nearestThreat = dist;
    }

    // Сила армий
    const myPower = my.totalHP + my.totalDPS * 10;
    const playerPower = player.totalHP + player.totalDPS * 10;
    const powerRatio = myPower / Math.max(1, playerPower);

    // Можем ли безопасно копить?
    const canSave = nearestThreat > 400 && powerRatio >= 0.6;
    
    // Нужна защита?
    const needDefense = nearestThreat < 350 || powerRatio < 0.5;

    return {
      my,
      player,
      nearestThreat,
      powerRatio,
      canSave,
      needDefense
    };
  }

  spawn(type, reason) {
    if (gameState.enemyGold >= UNIT_TYPES[type].cost) {
      this.queueUnit(type);
      AI_LOG.log('DECISION', reason, {
        unit: type,
        cost: UNIT_TYPES[type].cost,
        gold: Math.floor(gameState.enemyGold)
      });
    }
  }

  queueUnit(type) {
    if (this.spawnQueue.length < 15) {
      this.spawnQueue.push(type);
      AI_LOG.log('QUEUE', `В очередь: ${type}`, {
        unit: type,
        queueLength: this.spawnQueue.length
      });
    }
  }

  spawnUnit(type) {
    const cost = UNIT_TYPES[type].cost;
    if (gameState.enemyGold >= cost) {
      gameState.enemyGold -= cost;
      gameState.units.push(new Unit(type, true));
      this.lastSpawnedType = type;
      this.spawnCounter++;

      const enemyUnits = gameState.units.filter(u => u.isEnemy && !u.isDead);
      AI_LOG.log('SPAWN', `Заспавнен: ${type}`, {
        unit: type,
        cost: cost,
        goldAfter: Math.floor(gameState.enemyGold),
        totalUnits: enemyUnits.length,
        composition: {
          spearman: enemyUnits.filter(u => u.type === 'spearman').length,
          archer: enemyUnits.filter(u => u.type === 'archer').length,
          musketeer: enemyUnits.filter(u => u.type === 'musketeer').length,
          shieldbearer: enemyUnits.filter(u => u.type === 'shieldbearer').length
        }
      });
    }
  }

  reset() {
    this.decisionCooldown = 0;
    this.spawnQueue = [];
    this.lastSpawnedType = null;
    this.spawnCounter = 0;
    this.currentPlan = null;
    this.planTarget = 0;
    this.planProgress = 0;
  }
}
