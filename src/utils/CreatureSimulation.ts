// CreatureSimulation.ts
interface Point {
  x: number;
  y: number;
}

export type EntityType = 'food' | 'bonus' | 'enemy' | 'dodge';
export interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: Exclude<EntityType, 'dodge'>;
  active: boolean;
  absorbing: boolean;
  dodged?: boolean;
  targetCreature?: Creature;
}

export class Creature {
  spine: Point[] = [];
  numSegments = 20;
  segmentLength = 15;
  target: Point;
  currentHead: Point;
  lastSpeed = 0;
  tentacles: Point[][] = [];
  baseColor: string;
  glowColor: string;
  isActive: boolean = true;
  opacity: number = 1;
  sizeMultiplier: number = 1.0;

  constructor(x: number, y: number, isSecond: boolean) {
    this.currentHead = { x, y };
    this.target = { x, y };
    
    // First creature is emerald/cyan, second is purple/pink
    this.baseColor = isSecond ? '168, 85, 247' : '16, 185, 129';
    this.glowColor = isSecond ? '#a855f7' : '#06b6d4';

    for (let i = 0; i < this.numSegments; i++) {
      this.spine.push({ x, y });
    }
    
    for(let i=0; i<8; i++) {
      const tentacle: Point[] = [];
      for(let j=0; j<25; j++) {
         tentacle.push({ x, y });
      }
      this.tentacles.push(tentacle);
    }
  }

  grow() {
      this.numSegments += 1;
      this.sizeMultiplier += 0.05;
      const last = this.spine[this.spine.length - 1] || this.currentHead;
      this.spine.push({ x: last.x, y: last.y });
  }

  shrink() {
      if (this.numSegments > 1) {
          this.numSegments -= 1;
          this.sizeMultiplier = Math.max(0.2, this.sizeMultiplier - 0.05);
          this.spine.pop();
      }
  }
}

export class CreatureSimulation {
  private ctx: CanvasRenderingContext2D;
  private creatures: Creature[] = [];
  
  private time = 0;
  private entities: Entity[] = [];
  private nextEntityId = 0;
  private onCollision?: (type: EntityType) => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.creatures.push(new Creature(window.innerWidth / 2, window.innerHeight / 2, false));
  }

  setTargets(targets: Point[]) {
    // Update existing creatures or create new ones up to 2
    for (let i = 0; i < targets.length; i++) {
      if (i < this.creatures.length) {
        this.creatures[i].target.x = targets[i].x;
        this.creatures[i].target.y = targets[i].y;
        this.creatures[i].isActive = true;
      } else if (this.creatures.length < 2) {
        this.creatures.push(new Creature(targets[i].x, targets[i].y, true));
      }
    }
    
    // Mark unused creatures as inactive so they can wander/fade
    for (let i = targets.length; i < this.creatures.length; i++) {
      this.creatures[i].isActive = false;
    }
  }

  setCollisionCallback(cb: (type: EntityType) => void) {
    this.onCollision = cb;
  }

  grow() {
      this.creatures.forEach(c => {
          if (c.opacity > 0.5) c.grow();
      });
  }

  shrink() {
      this.creatures.forEach(c => {
          if (c.opacity > 0.5) c.shrink();
      });
  }

  getSegments(): number {
      const active = this.creatures.filter(c => c.opacity > 0.5);
      if (active.length === 0) return 0;
      return Math.max(...active.map(c => c.numSegments));
  }

  private getSizePressure(): number {
      const segments = this.getSegments();
      return Math.min(1.4, Math.max(0, (segments - 20) / 18));
  }

  update(score: number): number {
    this.time += 0.04;
    const sizePressure = this.getSizePressure();
    
    // Update creatures fading
    this.creatures.forEach((c) => {
       if (!c.isActive) {
           c.opacity = Math.max(0, c.opacity - 0.02);
       } else {
           c.opacity = Math.min(1, c.opacity + 0.02);
       }
    });
    
    // Remove fully faded creatures if they are not the first one
    this.creatures = this.creatures.filter((c, idx) => idx === 0 || c.opacity > 0);
    
    // Spawn entities
    const spawnRate = (0.02 + Math.min(0.03, this.time * 0.001)) * 0.825;
    if (Math.random() < spawnRate) {
      const roll = Math.random();
      const bonusChance = Math.max(0.07, 0.12 - sizePressure * 0.025);
      const enemyChance = Math.min(0.72, 0.4 + sizePressure * 0.16);
      const type: Entity['type'] = roll < bonusChance ? 'bonus' : roll < bonusChance + enemyChance ? 'enemy' : 'food';
      const spawnEdge = Math.floor(Math.random() * 4);
      let x = 0, y = 0, vx = 0, vy = 0;
      
      const enemySpeedMultiplier = Math.pow(1.5, Math.floor(score / 40)) * (1 + sizePressure * 0.32);
      const speed = type === 'enemy'
         ? (Math.random() * 2.4 + 1.8) * enemySpeedMultiplier
         : type === 'bonus'
         ? (Math.random() * 1.2 + 0.4)
         : (Math.random() * 1.4 + 0.35);
         
      const width = this.canvas.width;
      const height = this.canvas.height;

      if (spawnEdge === 0) { x = Math.random() * width; y = -50; vx = (Math.random() - 0.5) * speed; vy = speed; }
      else if (spawnEdge === 1) { x = width + 50; y = Math.random() * height; vx = -speed; vy = (Math.random() - 0.5) * speed; }
      else if (spawnEdge === 2) { x = Math.random() * width; y = height + 50; vx = (Math.random() - 0.5) * speed; vy = -speed; }
      else { x = -50; y = Math.random() * height; vx = speed; vy = (Math.random() - 0.5) * speed; }

      this.entities.push({
         id: this.nextEntityId++, x, y, vx, vy,
         radius: type === 'enemy' ? 28 : type === 'bonus' ? 22 : 16,
         type,
         active: true,
         absorbing: false
      });
    }
    
    // Global ocean current
    const currentVx = Math.cos(this.time * 0.5) * 1.5;
    const currentVy = Math.sin(this.time * 0.3) * 1.0;

    this.entities.forEach(entity => {
      if (!entity.active) return;
      
      if (entity.absorbing) {
          if ((entity.type === 'food' || entity.type === 'bonus') && entity.targetCreature) {
              const dx = entity.targetCreature.currentHead.x - entity.x;
              const dy = entity.targetCreature.currentHead.y - entity.y;
              entity.x += dx * 0.15;
              entity.y += dy * 0.15;
              entity.radius *= 0.85; // shrink rapidly
              
              if (entity.radius < 2) {
                 entity.active = false;
                 if (this.onCollision) this.onCollision(entity.type);
              }
          } else if (entity.type === 'enemy') {
              // Enemy shrinks rapidly in place
              entity.radius *= 0.7;
              if (entity.radius < 2) {
                  entity.active = false;
                  if (this.onCollision) this.onCollision(entity.type);
              }
          }
          return; // Skip normal movement
      }

      entity.x += entity.vx + currentVx;
      entity.y += entity.vy + currentVy;

      let nearestC: Creature | null = null;
      let minDist = Infinity;
      this.creatures.forEach(c => {
         if(c.opacity > 0.5) {
             const dist = Math.hypot(c.currentHead.x - entity.x, c.currentHead.y - entity.y);
             if (dist < minDist) { minDist = dist; nearestC = c; }
         }
      });

      if (entity.type === 'food' || entity.type === 'bonus') {
         const wobble = entity.type === 'bonus' ? 2.4 : 1.2;
         entity.x += Math.cos(this.time + entity.id) * wobble;
         entity.y += Math.sin(this.time + entity.id) * wobble;
         
         // Food drifts away when approached, but remains catchable.
         if (nearestC && minDist < 220 && entity.type === 'food') {
            const dx = entity.x - nearestC.currentHead.x;
            const dy = entity.y - nearestC.currentHead.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
               entity.vx += (dx / len) * 0.045;
               entity.vy += (dy / len) * 0.045;
            }
         }
      } else {
         // Enemy actively homes in on creature
         if (nearestC && minDist < 600 + sizePressure * 180) {
            const dx = nearestC.currentHead.x - entity.x;
            const dy = nearestC.currentHead.y - entity.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
               const enemySpeedMultiplier = Math.pow(1.5, Math.floor(score / 40)) * (1 + sizePressure * 0.32);
              entity.vx += (dx / len) * (0.055 + sizePressure * 0.014) * enemySpeedMultiplier;
              entity.vy += (dy / len) * (0.055 + sizePressure * 0.014) * enemySpeedMultiplier;
            }
         }
      }

      // Cap speed to prevent infinite acceleration
      const enemySpeedMultiplier = Math.pow(1.5, Math.floor(score / 40)) * (1 + sizePressure * 0.32);
      const maxSpeed = entity.type === 'enemy' ? (5.5 + sizePressure * 1.2) * enemySpeedMultiplier : entity.type === 'bonus' ? 3.4 : 2.8;
      const currentSpeed = Math.hypot(entity.vx, entity.vy);
      if (currentSpeed > maxSpeed) {
         entity.vx = (entity.vx / currentSpeed) * maxSpeed;
         entity.vy = (entity.vy / currentSpeed) * maxSpeed;
      }

      // Check collision with any active creature
      const headRadius = 25 + sizePressure * 8;
      this.creatures.forEach(c => {
         if (c.opacity < 0.5 || c.numSegments <= 0 || c.spine.length === 0) return;
         
         if (entity.type === 'food' || entity.type === 'bonus') {
             const dist = Math.hypot(entity.x - c.currentHead.x, entity.y - c.currentHead.y);
             const catchRadius = headRadius * c.sizeMultiplier + entity.radius + (entity.type === 'bonus' ? 28 : 18);
             if (dist < catchRadius && !entity.absorbing) {
                entity.absorbing = true; 
                entity.targetCreature = c;
             }
         } else if (entity.type === 'enemy') {
             let hit = false;
             let closestBodyGap = Infinity;
             
             // Check spine segments
             for (let i = 0; i < c.numSegments; i += 2) {
                 const p = c.spine[i];
                 if (!p) continue;
                 const dist = Math.hypot(entity.x - p.x, entity.y - p.y);
                 
                 const widthMultiplier = Math.sin((i / c.numSegments) * Math.PI);
                 const lateralDistance = 25 + widthMultiplier * 50;
                 const bodyRadius = lateralDistance * c.sizeMultiplier * (0.8 + sizePressure * 0.12);
                 const gap = dist - (bodyRadius + entity.radius);
                 closestBodyGap = Math.min(closestBodyGap, gap);
                 
                 if (gap < 0 && !entity.absorbing) {
                     hit = true;
                     break;
                 }
             }
             
             // Check head
             const distHead = Math.hypot(entity.x - c.currentHead.x, entity.y - c.currentHead.y);
             const headGap = distHead - (headRadius * c.sizeMultiplier + entity.radius);
             closestBodyGap = Math.min(closestBodyGap, headGap);
             if (headGap < 0 && !entity.absorbing) {
                 hit = true;
             }
             
             if (hit && !entity.absorbing) {
                 entity.absorbing = true;
                 entity.targetCreature = c;
             } else if (!entity.dodged && closestBodyGap > 0 && closestBodyGap < 38) {
                 entity.dodged = true;
                 if (this.onCollision) this.onCollision('dodge');
             }
         }
      });

      if (entity.x < -200 || entity.x > this.canvas.width + 200 ||
          entity.y < -200 || entity.y > this.canvas.height + 200) {
         entity.active = false;
      }
    });

    this.entities = this.entities.filter(e => e.active);

    let maxSpeed = 0;

    // Update all creatures
    this.creatures.forEach((c, idx) => {
        // If inactive, wander off slightly
        if (!c.isActive) {
           c.target.x += Math.cos(this.time + idx) * 2;
           c.target.y += Math.sin(this.time + idx) * 2;
        }

        const dx = c.target.x - c.currentHead.x;
        const dy = c.target.y - c.currentHead.y;
        
        c.currentHead.x += dx * 0.08;
        c.currentHead.y += dy * 0.08;
        
        const speed = Math.hypot(dx * 0.08, dy * 0.08);
        c.lastSpeed += (speed - c.lastSpeed) * 0.1;
        if (c.lastSpeed > maxSpeed) maxSpeed = c.lastSpeed;

        c.spine[0].x = c.currentHead.x;
        c.spine[0].y = c.currentHead.y;

        for (let i = 1; i < c.numSegments; i++) {
          const prev = c.spine[i - 1];
          const curr = c.spine[i];
          if (!prev || !curr) continue;
          
          const sdx = curr.x - prev.x;
          const sdy = curr.y - prev.y;
          const dist = Math.hypot(sdx, sdy);
          
          if (dist > 0) {
            const angle = Math.atan2(sdy, sdx);
            const waveOffset = Math.sin(this.time * 2 - i * 0.2 + idx * Math.PI) * (c.lastSpeed * 0.3 + 1);
            curr.x = prev.x + Math.cos(angle) * c.segmentLength + Math.cos(angle + Math.PI/2) * waveOffset;
            curr.y = prev.y + Math.sin(angle) * c.segmentLength + Math.sin(angle + Math.PI/2) * waveOffset;
          }
        }
        
        const headAngle = Math.atan2(c.spine[1].y - c.spine[0].y, c.spine[1].x - c.spine[0].x);
        c.tentacles.forEach((tentacle, tidx) => {
          const spread = (tidx / (c.tentacles.length - 1) - 0.5) * Math.PI * 1.5;
          const baseAngle = headAngle + Math.PI + spread;
          
          tentacle[0].x = c.spine[0].x + Math.cos(baseAngle) * 15;
          tentacle[0].y = c.spine[0].y + Math.sin(baseAngle) * 15;
          
          for(let j=1; j<tentacle.length; j++) {
             const prev = tentacle[j-1];
             const curr = tentacle[j];
             
             const sdx = curr.x - prev.x;
             const sdy = curr.y - prev.y;
             const dist = Math.hypot(sdx, sdy);
             
             if (dist > 0) {
               let angle = Math.atan2(sdy, sdx);
               const wave = Math.sin(this.time * 1.5 - j * 0.15 + tidx) * 1.5;
               angle += wave * 0.1;
               
               curr.x = prev.x + Math.cos(angle) * 8;
               curr.y = prev.y + Math.sin(angle) * 8;
             }
          }
        });
    });

    return maxSpeed;
  }

  draw() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Draw entities
    this.entities.forEach(entity => {
      this.ctx.beginPath();
      if (entity.type === 'enemy') {
         const spikes = 5;
         const outer = entity.radius;
         const inner = entity.radius * 0.4;
         for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outer : inner;
            const a = (i * Math.PI) / spikes + this.time * 2;
            if (i === 0) this.ctx.moveTo(entity.x + Math.cos(a) * r, entity.y + Math.sin(a) * r);
            else this.ctx.lineTo(entity.x + Math.cos(a) * r, entity.y + Math.sin(a) * r);
         }
         this.ctx.closePath();
         this.ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
         this.ctx.shadowColor = '#ef4444';
         this.ctx.shadowBlur = 15;
      } else {
         this.ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
         if (entity.type === 'bonus') {
            this.ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
            this.ctx.shadowColor = '#facc15';
            this.ctx.shadowBlur = 22;
         } else {
            this.ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
            this.ctx.shadowColor = '#10b981';
            this.ctx.shadowBlur = 10;
         }
      }
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    });

    // Draw creatures
    this.creatures.forEach(c => {
       if (c.opacity <= 0 || c.numSegments <= 0 || c.spine.length === 0) return;
       this.ctx.globalAlpha = c.opacity;
       
       // Tentacles
       this.ctx.lineWidth = 1.5 * c.sizeMultiplier;
       c.tentacles.forEach((tentacle) => {
          this.ctx.beginPath();
          this.ctx.moveTo(tentacle[0].x, tentacle[0].y);
          for(let j=1; j<tentacle.length; j++) {
            this.ctx.lineTo(tentacle[j].x, tentacle[j].y);
          }
          this.ctx.strokeStyle = `rgba(${c.baseColor}, 0.5)`;
          this.ctx.stroke();
       });

       // Fins / Spots
       for (let i = 2; i < c.numSegments - 2; i += 2) {
           const p = c.spine[i];
           const prev = c.spine[i - 1];
           if (!p || !prev) continue;
           const angle = Math.atan2(p.y - prev.y, p.x - prev.x);
           
           const widthMultiplier = Math.sin((i / c.numSegments) * Math.PI);
           const lateralDistance = (25 + widthMultiplier * 50) * c.sizeMultiplier;
           
           const lateralX = Math.cos(angle + Math.PI/2) * lateralDistance;
           const lateralY = Math.sin(angle + Math.PI/2) * lateralDistance;
           
           // Connecting webbing
           this.ctx.beginPath();
           this.ctx.moveTo(p.x, p.y);
           this.ctx.lineTo(p.x + lateralX * 0.8, p.y + lateralY * 0.8);
           this.ctx.strokeStyle = `rgba(${c.baseColor}, ${0.2 * widthMultiplier})`;
           this.ctx.lineWidth = 2 * c.sizeMultiplier;
           this.ctx.stroke();

           this.ctx.beginPath();
           this.ctx.moveTo(p.x, p.y);
           this.ctx.lineTo(p.x - lateralX * 0.8, p.y - lateralY * 0.8);
           this.ctx.stroke();

           // Turing dots
           const radius = (3 + widthMultiplier * 10) * c.sizeMultiplier;
           this.ctx.beginPath();
           this.ctx.arc(p.x + lateralX, p.y + lateralY, radius, 0, Math.PI * 2);
           this.ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * widthMultiplier})`;
           this.ctx.fill();
           
           this.ctx.beginPath();
           this.ctx.arc(p.x - lateralX, p.y - lateralY, radius, 0, Math.PI * 2);
           this.ctx.fill();
       }

       // Main spine
       this.ctx.beginPath();
       this.ctx.moveTo(c.spine[0].x, c.spine[0].y);
       for (let i = 1; i < c.numSegments; i++) {
         if (c.spine[i]) this.ctx.lineTo(c.spine[i].x, c.spine[i].y);
       }
       this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
       this.ctx.lineWidth = 4 * c.sizeMultiplier;
       this.ctx.stroke();
       
       // Glowing head
       this.ctx.beginPath();
       this.ctx.arc(c.spine[0].x, c.spine[0].y, 16 * c.sizeMultiplier, 0, Math.PI * 2);
       this.ctx.fillStyle = '#ffffff';
       this.ctx.shadowColor = c.glowColor;
       this.ctx.shadowBlur = 30 * c.sizeMultiplier;
       this.ctx.fill();
       this.ctx.shadowBlur = 0;
       
       this.ctx.globalAlpha = 1; // reset for next drawing
    });
  }
}
