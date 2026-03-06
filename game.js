// Jeu Flappy Bird
class FlappyBird {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // Variables du jeu
        this.bird = {
            x: 50,
            y: this.height / 2,
            radius: 15,
            velocity: 0,
            gravity: 0.5,
            jump: -8
        };
        
        this.pipes = [];
        this.pipeWidth = 60;
        this.pipeGap = 150;
        this.pipeSpeed = 2;
        this.spawnInterval = 90;
        this.spawnTimer = 0;
        
        this.score = 0;
        this.bestScore = localStorage.getItem('flappyBestScore') || 0;
        this.isGameOver = false;
        this.isPlaying = false;
        
        // Chargement des images
        this.background = this.createBackground();
        this.pipeTop = this.createPipeImage(true);
        this.pipeBottom = this.createPipeImage(false);
        this.birdImage = this.createBirdImage();
        
        // Événements
        this.setupEventListeners();
        
        // Boucle de jeu
        this.lastTime = 0;
        this.gameLoop();
    }
    
    createBackground() {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        
        // Dégradé ciel
        const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98D8E8');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Nuages
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 3; i++) {
            const x = Math.random() * this.width;
            const y = Math.random() * (this.height * 0.4);
            const size = 50 + Math.random() * 50;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        return canvas;
    }
    
    createPipeImage(isTop) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const height = this.height;
        
        canvas.width = this.pipeWidth;
        canvas.height = height;
        
        // Dégradé pour les tuyaux
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#8B4513');
        gradient.addColorStop(1, '#228B22');
        ctx.fillStyle = gradient;
        
        // Forme du tuyau
        const width = this.pipeWidth;
        const pipeHeight = height * 0.6;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(width * 0.3, 0);
        ctx.lineTo(width, 10);
        ctx.lineTo(width, pipeHeight - 20);
        ctx.lineTo(width * 0.7, pipeHeight);
        ctx.lineTo(0, pipeHeight);
        ctx.closePath();
        ctx.fill();
        
        // Détails
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#2E7D32';
        ctx.fillRect(0, pipeHeight - 10, width, 10);
        
        return canvas;
    }
    
    createBirdImage() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = this.bird.radius * 2;
        
        canvas.width = size;
        canvas.height = size;
        
        // Corps de l'oiseau
        const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(1, '#FFA500');
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Bec
        ctx.fillStyle = '#FF6347';
        ctx.beginPath();
        ctx.moveTo(size/2 + 5, size/2 - 3);
        ctx.lineTo(size, size/2);
        ctx.lineTo(size/2 + 5, size/2 + 3);
        ctx.closePath();
        ctx.fill();
        
        // Yeux
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(size/2 - 3, size/2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(size/2 - 2, size/2 - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        return canvas;
    }
    
    setupEventListeners() {
        // Clic ou espace pour sauter
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.jump();
            }
        });
        
        document.addEventListener('click', () => {
            this.jump();
        });
        
        // Boutons
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });
    }
    
    jump() {
        if (!this.isPlaying || this.isGameOver) return;
        
        this.bird.velocity = this.bird.jump;
        
        // Petit effet visuel
        this.canvas.style.transform = 'scale(1.02)';
        setTimeout(() => {
            this.canvas.style.transform = 'scale(1)';
        }, 100);
    }
    
    startGame() {
        this.isPlaying = true;
        this.isGameOver = false;
        this.score = 0;
        this.pipes = [];
        this.bird.y = this.height / 2;
        this.bird.velocity = 0;
        
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('score').textContent = this.score;
    }
    
    restartGame() {
        this.startGame();
    }
    
    update(deltaTime) {
        if (!this.isPlaying || this.isGameOver) return;
        
        // Mise à jour de l'oiseau
        this.bird.velocity += this.bird.gravity;
        this.bird.y += this.bird.velocity;
        
        // Limites
        if (this.bird.y - this.bird.radius < 0) {
            this.bird.y = this.bird.radius;
            this.bird.velocity = 0;
        }
        
        // Mise à jour des tuyaux
        this.spawnTimer += 1;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnPipe();
            this.spawnTimer = 0;
        }
        
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            this.pipes[i].x -= this.pipeSpeed;
            
            // Vérification collision
            if (this.checkCollision(this.pipes[i])) {
                this.gameOver();
                break;
            }
            
            // Augmentation du score
            if (this.pipes[i].x + this.pipeWidth < this.bird.x && !this.pipes[i].scored) {
                this.score += 1;
                this.pipes[i].scored = true;
                document.getElementById('score').textContent = this.score;
                
                // Effet sonore (simple)
                this.playSound('point');
            }
            
            // Suppression des tuyaux hors écran
            if (this.pipes[i].x + this.pipeWidth < 0) {
                this.pipes.splice(i, 1);
            }
        }
        
        // Game over si l'oiseau touche le sol
        if (this.bird.y + this.bird.radius > this.height) {
            this.gameOver();
        }
    }
    
    spawnPipe() {
        const minHeight = 50;
        const maxHeight = this.height - this.pipeGap - minHeight;
        const height = Math.random() * (maxHeight - minHeight) + minHeight;
        
        this.pipes.push({
            x: this.width,
            height: height,
            scored: false
        });
    }
    
    checkCollision(pipe) {
        const birdLeft = this.bird.x - this.bird.radius;
        const birdRight = this.bird.x + this.bird.radius;
        const birdTop = this.bird.y - this.bird.radius;
        const birdBottom = this.bird.y + this.bird.radius;
        
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + this.pipeWidth;
        const pipeTop = 0;
        const pipeBottom = pipe.height;
        const pipeGapTop = pipe.height + this.pipeGap;
        const pipeGapBottom = this.height;
        
        // Collision avec le tuyau du haut
        if (birdRight > pipeLeft && birdLeft < pipeRight && 
            birdBottom > pipeTop && birdTop < pipeBottom) {
            return true;
        }
        
        // Collision avec le tuyau du bas
        if (birdRight > pipeLeft && birdLeft < pipeRight && 
            birdBottom > pipeGapTop && birdTop < pipeGapBottom) {
            return true;
        }
        
        return false;
    }
    
    gameOver() {
        this.isGameOver = true;
        this.isPlaying = false;
        
        // Mise à jour du meilleur score
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('flappyBestScore', this.bestScore);
        }
        
        // Affichage de l'écran de game over
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestScore').textContent = this.bestScore;
        document.getElementById('gameOver').style.display = 'block';
        
        // Effet sonore
        this.playSound('hit');
    }
    
    playSound(type) {
        // Simple effet sonore avec Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (type === 'point') {
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } else if (type === 'hit') {
            oscillator.frequency.value = 200;
            gainNode.gain.value = 0.3;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        }
    }
    
    draw() {
        // Nettoyage du canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Dessin du fond
        this.ctx.drawImage(this.background, 0, 0);
        
        // Dessin des tuyaux
        for (const pipe of this.pipes) {
            // Tuyau du haut
            this.ctx.drawImage(this.pipeTop, pipe.x, -this.pipeTop.height + pipe.height);
            
            // Tuyau du bas
            this.ctx.drawImage(this.pipeBottom, pipe.x, pipe.height + this.pipeGap);
        }
        
        // Dessin de l'oiseau
        this.ctx.drawImage(this.birdImage, this.bird.x - this.bird.radius, this.bird.y - this.bird.radius);
        
        // Effet de parallaxe
        const cloudOffset = (Date.now() / 50) % this.width;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let i = 0; i < 2; i++) {
            this.ctx.fillRect(cloudOffset + i * this.width - 50, 50, 100, 40);
        }
    }
    
    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.draw();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// Initialisation du jeu
window.addEventListener('load', () => {
    new FlappyBird();
});