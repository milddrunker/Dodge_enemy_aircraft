import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Plane, Clock } from 'lucide-react';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

interface Player extends GameObject {
  health: number;
}

interface Enemy extends GameObject {
  active: boolean;
  movePattern: 'straight' | 'zigzag' | 'circle';
  patternPhase: number;
  originalX: number;
}

interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SPEED = 5;
const ENEMY_SPEED = 2;
const ENEMY_SPAWN_RATE = 0.02;

// 绘制飞机形状
const drawPlayerPlane = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  
  // 机身
  ctx.fillStyle = '#4A90E2';
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.15, height * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 机翼
  ctx.fillStyle = '#2E5C8A';
  ctx.beginPath();
  ctx.ellipse(0, height * 0.1, width * 0.4, height * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 机头
  ctx.fillStyle = '#1E3A5F';
  ctx.beginPath();
  ctx.ellipse(0, -height * 0.3, width * 0.08, height * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 尾翼
  ctx.fillStyle = '#2E5C8A';
  ctx.beginPath();
  ctx.ellipse(0, height * 0.35, width * 0.2, height * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
};

// 绘制敌机形状
const drawEnemyPlane = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(Math.PI); // 敌机朝下
  
  // 机身
  ctx.fillStyle = '#FF6B6B';
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.15, height * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 机翼
  ctx.fillStyle = '#CC5555';
  ctx.beginPath();
  ctx.ellipse(0, height * 0.1, width * 0.4, height * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 机头
  ctx.fillStyle = '#AA3333';
  ctx.beginPath();
  ctx.ellipse(0, -height * 0.3, width * 0.08, height * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 尾翼
  ctx.fillStyle = '#CC5555';
  ctx.beginPath();
  ctx.ellipse(0, height * 0.35, width * 0.2, height * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const gameStartTimeRef = useRef<number>(0);
  
  const [survivalTime, setSurvivalTime] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [bestTime, setBestTime] = useState(() => {
    const saved = localStorage.getItem('bestSurvivalTime');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const [player, setPlayer] = useState<Player>({
    x: GAME_WIDTH / 2 - 25,
    y: GAME_HEIGHT - 80,
    width: 50,
    height: 50,
    speed: PLAYER_SPEED,
    health: 3
  });
  
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);

  // 初始化云朵
  useEffect(() => {
    const initialClouds: Cloud[] = [];
    for (let i = 0; i < 8; i++) {
      initialClouds.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: Math.random() * 40 + 20,
        speed: Math.random() * 0.5 + 0.5
      });
    }
    setClouds(initialClouds);
  }, []);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);


  // 触摸控制
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameStarted || gameOver) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleX;
    
    // 移动玩家飞机到点击位置
    setPlayer(prev => ({
      ...prev,
      x: Math.max(0, Math.min(GAME_WIDTH - prev.width, clickX - prev.width / 2))
    }));
  }, [gameStarted, gameOver]);

  // 碰撞检测
  const checkCollision = (obj1: GameObject, obj2: GameObject): boolean => {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
  };

  // 游戏循环
  const gameLoop = useCallback(() => {
    if (gameOver) return;
    
    // 更新生存时间
    const currentTime = Date.now();
    const timeElapsed = Math.floor((currentTime - gameStartTimeRef.current) / 1000);
    setSurvivalTime(timeElapsed);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    // 清空画布
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // 绘制背景
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // 更新和绘制云朵
    setClouds(prev => prev.map(cloud => ({
      ...cloud,
      y: cloud.y + cloud.speed,
      x: cloud.x + Math.sin(Date.now() * 0.001 + cloud.x) * 0.1
    })).filter(cloud => cloud.y < GAME_HEIGHT + 50).concat(
      Math.random() < 0.01 ? [{
        x: Math.random() * GAME_WIDTH,
        y: -50,
        size: Math.random() * 40 + 20,
        speed: Math.random() * 0.5 + 0.5
      }] : []
    ));
    
    // 绘制云朵
    clouds.forEach(cloud => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
      ctx.arc(cloud.x + 20, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
      ctx.arc(cloud.x + 40, cloud.y, cloud.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // 更新玩家位置
    if (keysRef.current['ArrowLeft'] || keysRef.current['a']) {
      setPlayer(prev => ({
        ...prev,
        x: Math.max(0, prev.x - prev.speed)
      }));
    }
    if (keysRef.current['ArrowRight'] || keysRef.current['d']) {
      setPlayer(prev => ({
        ...prev,
        x: Math.min(GAME_WIDTH - prev.width, prev.x + prev.speed)
      }));
    }
    
    // 绘制玩家飞机
    drawPlayerPlane(ctx, player.x, player.y, player.width, player.height);
    
    // 生成敌机
    if (Math.random() < ENEMY_SPAWN_RATE) {
      const patterns: ('straight' | 'zigzag' | 'circle')[] = ['straight', 'zigzag', 'circle'];
      const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
      const startX = Math.random() * (GAME_WIDTH - 40);
      
      setEnemies(prev => [...prev, {
        x: startX,
        y: -40,
        width: 40,
        height: 40,
        speed: ENEMY_SPEED,
        active: true,
        movePattern: randomPattern,
        patternPhase: 0,
        originalX: startX
      }]);
    }
    
    // 更新和绘制敌机
    setEnemies(prev => prev.map(enemy => {
      let newX = enemy.x;
      let newY = enemy.y + enemy.speed;
      let newPhase = enemy.patternPhase + 0.1;
      
      // 根据移动模式更新位置
      switch (enemy.movePattern) {
        case 'zigzag':
          newX = enemy.originalX + Math.sin(newPhase) * 60;
          break;
        case 'circle':
          newX = enemy.originalX + Math.cos(newPhase) * 40;
          newY = enemy.y + enemy.speed * 0.8; // 圆形移动时垂直速度稍慢
          break;
        case 'straight':
        default:
          // 保持原来的直线移动
          break;
      }
      
      // 确保敌机不会移出屏幕边界
      newX = Math.max(0, Math.min(GAME_WIDTH - enemy.width, newX));
      
      return {
        ...enemy,
        x: newX,
        y: newY,
        patternPhase: newPhase,
        active: newY < GAME_HEIGHT + enemy.height
      };
    }).filter(enemy => enemy.active));
    
    enemies.forEach(enemy => {
      drawEnemyPlane(ctx, enemy.x, enemy.y, enemy.width, enemy.height);
    });
    
    // 检查玩家是否被敌机撞到
    enemies.forEach(enemy => {
      if (checkCollision(player, enemy)) {
        setGameOver(true);
      }
    });
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [player, enemies, clouds, gameOver]);

  // 开始游戏
  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setSurvivalTime(0);
    gameStartTimeRef.current = Date.now();
    setEnemies([]);
    setPlayer({
      x: GAME_WIDTH / 2 - 25,
      y: GAME_HEIGHT - 80,
      width: 50,
      height: 50,
      speed: PLAYER_SPEED,
      health: 3
    });
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  };

  // 重启游戏
  const restartGame = () => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    
    // 更新最高记录
    if (survivalTime > bestTime) {
      setBestTime(survivalTime);
      localStorage.setItem('bestSurvivalTime', survivalTime.toString());
    }
    
    startGame();
  };

  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, gameLoop]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-blue-200 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* 游戏标题 */}
        <div className="absolute top-4 left-4 z-10 bg-white bg-opacity-90 rounded-lg px-4 py-2 shadow-lg">
          <h1 className="text-xl font-bold text-gray-800">《躲避敌机》</h1>
        </div>
        
        {/* 最高生存时长 */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-white bg-opacity-90 rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-yellow-600">🏆 最高记录: {bestTime}秒</span>
          </div>
        </div>
        
        {/* 生存时间显示 */}
        <div className="absolute top-4 right-4 z-10 bg-white bg-opacity-90 rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <span className="text-xl font-bold text-gray-800">生存: {survivalTime}秒</span>
          </div>
        </div>
        
        {/* 游戏画布 */}
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="block max-w-full max-h-[80vh] cursor-crosshair"
          onClick={handleCanvasClick}
        />
        
        {/* 游戏开始/结束界面 */}
        {!gameStarted && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-8 text-center shadow-xl">
              <Plane className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <h1 className="text-3xl font-bold text-gray-800 mb-4">躲避敌机</h1>
              <p className="text-gray-600 mb-6">
                使用方向键或 A/D 键移动飞机<br />
                躲避从上方飞来的敌机<br />
                在移动设备上可以点击屏幕移动飞机
              </p>
              <button
                onClick={startGame}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                开始游戏
              </button>
            </div>
          </div>
        )}
        
        {gameOver && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-8 text-center shadow-xl">
              <div className="text-6xl mb-4">💥</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">游戏结束</h2>
              <p className="text-xl text-gray-600 mb-6">
                生存时间: <span className="font-bold text-blue-600">{survivalTime}秒</span>
                {survivalTime > bestTime && (
                  <span className="block text-lg text-yellow-600 font-bold mt-2">🎉 新记录！</span>
                )}
              </p>
              <button
                onClick={restartGame}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                重新开始
              </button>
            </div>
          </div>
        )}
        
        {/* 游戏控制说明 */}
        <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded-lg px-4 py-2 shadow-lg">
          <div className="text-sm text-gray-600">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">键盘:</span>
              <span>← → 移动飞机</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">触摸:</span>
              <span>点击屏幕移动飞机</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;