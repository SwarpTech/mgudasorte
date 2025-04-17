class ConfettiManager {
    constructor(confeteCanvas) {
        this.canvas = confeteCanvas;
        this.ctx = confeteCanvas.getContext("2d");
        this.confetes = [];
        this.intervalId = null;
    }

    start() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.criarConfete(), 100);
        setTimeout(() => {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }, 3000);
    }

    criarConfete() {
        const colors = ['#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff'];
        const confete = {
            x: Math.random() * this.canvas.width,
            y: -10,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 10 + 5,
            speed: Math.random() * 3 + 2,
            angle: Math.random() * Math.PI * 2,
            rotationSpeed: Math.random() * 0.2 - 0.1
        };
        this.confetes.push(confete);
        if (this.confetes.length > 200) this.confetes.shift();
        this.animarConfetes();
    }

    animarConfetes() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 0; i < this.confetes.length; i++) {
            const confete = this.confetes[i];
            confete.y += confete.speed;
            confete.angle += confete.rotationSpeed;
            this.ctx.save();
            this.ctx.translate(confete.x, confete.y);
            this.ctx.rotate(confete.angle);
            this.ctx.fillStyle = confete.color;
            this.ctx.fillRect(-confete.size/2, -confete.size/2, confete.size, confete.size);
            this.ctx.restore();
            if (confete.y > this.canvas.height) {
                this.confetes.splice(i, 1);
                i--;
            }
        }
        if (this.confetes.length > 0) {
            requestAnimationFrame(() => this.animarConfetes());
        }
    }
}

class RankingManager {
    constructor(url, rankingList, debugLog, updateRecordCallback) {
        this.url = url;
        this.rankingList = rankingList;
        this.debugLog = debugLog;
        this.top3Ranking = [];
        this.updateRecordCallback = updateRecordCallback;
    }

    carregarRanking() {
        this.debugLog("Carregando ranking...");
        fetch(`${this.url}?action=getRanking`)
            .then(response => {
                if (!response.ok) throw new Error('Erro na rede');
                return response.json();
            })
            .then(data => {
                this.debugLog("Dados do ranking recebidos:");
                this.debugLog(JSON.stringify(data));
                if (data && data.length > 0) {
                    this.top3Ranking = data.slice(0, 3);
                    this.atualizarRankingUI(data);
                    if (data[0] && data[0].rebate) {
                        this.updateRecordCallback(data[0].rebate, data[0].nome);
                    }
                } else {
                    this.debugLog("Nenhum dado recebido, mostrando exemplo");
                    this.mostrarDadosExemplo();
                }
            })
            .catch(err => {
                this.debugLog("Erro ao carregar ranking: " + err.message);
                this.mostrarDadosExemplo();
            });
    }

    atualizarRankingUI(data) {
        this.debugLog("Atualizando UI do ranking...");
        const sorted = data
            .filter(row => row.nome && !isNaN(row.rebate))
            .sort((a, b) => b.rebate - a.rebate)
            .slice(0, 10);
        
        this.rankingList.innerHTML = sorted.map((row, index) => {
            const emoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
            return `<div>
                ${emoji} ${index + 1}º ${row.nome}: ${row.rebate} rebatidas
            </div>`;
        }).join("");
    }

    mostrarDadosExemplo() {
        this.debugLog("Mostrando dados de exemplo");
        const fakeData = [
            { nome: "Sandro", rebate: 34 },
            { nome: "João", rebate: 28 },
            { nome: "Maria", rebate: 23 },
            { nome: "Luiz", rebate: 20 },
            { nome: "Ana", rebate: 18 }
        ];
        
        this.rankingList.innerHTML = `
            <div style='color: #ff6b6b; padding: 5px;'>
                Ranking offline (dados de exemplo)
            </div>
            ${fakeData.map((row, index) => {
                const emoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";
                return `<div>${emoji} ${index + 1}º ${row.nome}: ${row.rebate}</div>`;
            }).join("")}
            <div style='color: #aaa; padding: 5px; font-size: 14px;'>
                Conecte-se à internet para ver o ranking real
            </div>
        `;
    }

    enviarRecordeParaPlanilha(nome, rebates) {
        this.debugLog(`Enviando para planilha: ${nome} com ${rebates} rebates`);
        const urlGET = `${this.url}?action=saveRecord&nome=${encodeURIComponent(nome)}&rebate=${rebates}`;
        this.debugLog("URL: " + urlGET);
        fetch(urlGET, { method: 'GET', redirect: 'follow' })
          .then(response => {
            if (!response.ok) throw new Error('Erro HTTP: ' + response.status);
            return response.text();
          })
          .then(text => {
            this.debugLog("Resposta do servidor: " + text);
            try {
              JSON.parse(text);
              this.carregarRanking();
            } catch {
              this.debugLog("Resposta não é JSON, mas pode ter funcionado");
              this.carregarRanking();
            }
          })
          .catch(err => {
            this.debugLog("Erro no GET, tentando POST...: " + err.message);
            this.enviarComoPost(nome, rebates);
          });
    }
    
    enviarComoPost(nome, rebates) {
        const formData = new FormData();
        formData.append('action', 'saveRecord');
        formData.append('nome', nome);
        formData.append('rebate', rebates);
        fetch(this.url, {
          method: 'POST',
          body: formData,
          redirect: 'follow'
        })
        .then(response => response.text())
        .then(text => {
          this.debugLog("Resposta POST: " + text);
          this.carregarRanking();
        })
        .catch(err => {
          this.debugLog("Erro no POST: " + err.message);
        });
    }

    verificarTop3(playerName, rebates) {
        this.debugLog("Verificando TOP3 para: " + rebates + " rebates");
        const mereceTop3 = this.top3Ranking.length < 3 || rebates > this.top3Ranking[this.top3Ranking.length-1].rebate;
        if (!mereceTop3) {
            this.debugLog("Pontuação não suficiente para Top 3");
            return;
        }
        let posicao = 3;
        for (let i = 0; i < Math.min(this.top3Ranking.length, 3); i++) {
            if (rebates > this.top3Ranking[i].rebate) {
                posicao = i + 1;
                break;
            }
            posicao = i + 2;
        }
        this.debugLog("Jogador ficou na posição: " + posicao);
        this.mostrarMensagemTop3(posicao, rebates, playerName);
    }

    mostrarMensagemTop3(posicao, rebates, playerName) {
        const emoji = posicao === 1 ? "🥇" : posicao === 2 ? "🥈" : "🥉";
        const mensagemHTML = `
          <div class="mensagem-top3">
            <h2>🎉 PARABÉNS ${playerName.toUpperCase()}! 🎉</h2>
            <p>Você ficou em ${posicao}º lugar no ranking!</p>
            <p style="font-size:24px;font-weight:bold;">${emoji} ${rebates} REBATIDAS</p>
            <p>Deseja registrar seu resultado?</p>
            <div class="botoes-confirmacao">
              <button id="btnConfirmarRegistro" class="btn-confirmar">SIM, REGISTRAR!</button>
              <button id="btnCancelarRegistro" class="btn-cancelar">Agora não</button>
            </div>
          </div>
        `;
        const divMensagem = document.createElement('div');
        divMensagem.innerHTML = mensagemHTML;
        document.body.appendChild(divMensagem);
    
        document.getElementById('btnConfirmarRegistro').addEventListener('click', () => {
          this.debugLog("Registrando no ranking...");
          this.enviarRecordeParaPlanilha(playerName, rebates);
          document.body.removeChild(divMensagem);
        });
    
        document.getElementById('btnCancelarRegistro').addEventListener('click', () => {
          this.debugLog("Registro cancelado pelo usuário");
          document.body.removeChild(divMensagem);
        });
    }
}

class Game {
    constructor() {
        // Configurações Gerais
        this.GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5t4hzA-66vvYPHDzklvbrNO7nOYAbGx9uYrguoVjKll6wclU3DBo3TEZxSm5lpeJp/exec";
        this.fimDeJogoAtivo = false;
        this.gameInterval = null;
        this.emFase2 = false;
        this.velocidadeExtra = 0;
        this.ballSpeedBase = 5;
        this.aumentoVelocidade = 0.05;
        this.goalRebounds = 10;
        this.rebounds = 0;
        this.rebatesFase2 = 0;
        this.recordRebatesValue = parseInt(localStorage.getItem('recordRebatesMGU')) || 0;
        this.recordHolderName = localStorage.getItem('recordHolderNameMGU') || "-";
        this.playerName = "";
        this.playerCollisionActive = false; // flag para evitar colisões duplicadas
        // Elementos do DOM
        this.canvas = document.getElementById("gameCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.confeteCanvas = document.getElementById("confeteCanvas");
        this.mensagemFinal = document.getElementById("mensagemFinal");
        this.mensagemDerrota = document.getElementById("mensagemDerrota");
        this.botaoReiniciar = document.getElementById("botaoReiniciar");
        this.botaoAvancar = document.getElementById("botaoAvancar");
        this.botaoNovoJogo = document.getElementById("botaoNovoJogo");
        this.contadorRebates = document.getElementById("contadorRebates");
        this.contadorRebatesFase2 = document.getElementById("contadorRebatesFase2");
        this.rebatesAtuais = document.getElementById("rebatesAtuais");
        this.recordRebates = document.getElementById("recordRebates");
        this.cupomFinal = document.getElementById("cupomFinal");
        this.cupomCode = document.getElementById("cupomCode");
        this.botaoStart = document.getElementById("botaoStart");
        this.playerNameInput = document.getElementById("playerNameInput");
        this.rankingList = document.getElementById("rankingList");
        this.debugConsole = document.getElementById("debugConsole");

        // Parâmetros do jogo
        this.paddleHeight = 100;
        this.paddleWidth = 40;
        this.ballRadius = 20;
        // Posições iniciais
        this.playerY = 0;
        this.aiY = 0;
        this.ballX = 0;
        this.ballY = 0;
        this.ballSpeedX = 0;
        this.ballSpeedY = 0;

        // Handlers
        this.mouseMoveHandler = null;
        this.touchMoveHandler = null;

        // Instâncias auxiliares
        this.confettiManager = new ConfettiManager(this.confeteCanvas);
        this.rankingManager = new RankingManager(this.GOOGLE_SCRIPT_URL, this.rankingList,
            (msg) => this.debugLog(msg),
            (record, holder) => this.updateRecord(record, holder)
        );
        
        this.bindEvents();
        this.initDebugToggle();
    }

    bindEvents() {
        this.botaoStart.addEventListener('click', () => this.startGame());
        this.botaoAvancar.addEventListener('click', () => this.iniciarFase2());
        this.botaoNovoJogo.addEventListener('click', () => {
            this.emFase2 ? this.reiniciarFase2() : this.reiniciarJogo();
        });
        this.botaoReiniciar.addEventListener('click', () => this.reiniciarJogo());
        document.querySelector('#cupomFinal span').addEventListener('click', () => this.copiarCupom());
    }

    initDebugToggle() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                this.debugConsole.style.display = this.debugConsole.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    debugLog(message) {
        this.debugConsole.innerHTML += message + '<br>';
        this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
        console.log("[DEBUG] " + message);
    }

    updateRecord(record, holder) {
        this.recordRebatesValue = record;
        this.recordHolderName = holder;
        this.recordRebates.textContent = record + " (" + holder + ")";
    }

    initGame() {
        // Inicializa variáveis de jogo
        this.playerY = this.canvas.height / 2 - this.paddleHeight / 2;
        this.aiY = this.canvas.height / 2 - this.paddleHeight / 2;
        this.ballX = this.canvas.width / 2;
        this.ballY = this.canvas.height / 2;
        this.velocidadeExtra = 0;
        this.ballSpeedX = this.ballSpeedBase * (Math.random() > 0.5 ? 1 : -1);
        this.ballSpeedY = 3 * (Math.random() > 0.5 ? 1 : -1);
        this.rebounds = 0;
        this.rebatesFase2 = 0;
        this.rebatesAtuais.textContent = "0";
        this.contadorRebates.textContent = `Rebates: ${this.rebounds} / ${this.goalRebounds}`;
        this.contadorRebatesFase2.style.display = this.emFase2 ? "inline-block" : "none";
        this.recordRebates.style.display = this.emFase2 ? "inline-block" : "none";
        this.contadorRebates.style.display = this.emFase2 ? "none" : "inline-block";
        this.mensagemFinal.style.display = "none";
        this.mensagemDerrota.style.display = "none";
        this.botaoReiniciar.style.display = "none";
        this.botaoAvancar.style.display = "none";
        this.botaoNovoJogo.style.display = "none";
        this.confettiManager.ctx.clearRect(0, 0, this.confeteCanvas.width, this.confeteCanvas.height);
        this.confettiManager.confetes = [];
        if (this.gameInterval) {
            cancelAnimationFrame(this.gameInterval);
            this.gameInterval = null;
        }
        // Remove event listeners antigos se existirem
        if (this.mouseMoveHandler) document.removeEventListener('mousemove', this.mouseMoveHandler);
        if (this.touchMoveHandler) this.canvas.removeEventListener('touchmove', this.touchMoveHandler);
    
        this.mouseMoveHandler = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.playerY = e.clientY - rect.top - this.paddleHeight / 2;
            this.playerY = Math.max(0, Math.min(this.canvas.height - this.paddleHeight, this.playerY));
        };
    
        this.touchMoveHandler = (e) => {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.playerY = touch.clientY - rect.top - this.paddleHeight / 2;
            this.playerY = Math.max(0, Math.min(this.canvas.height - this.paddleHeight, this.playerY));
        };
    
        if (!this.fimDeJogoAtivo) {
            document.addEventListener('mousemove', this.mouseMoveHandler);
            this.canvas.addEventListener('touchmove', this.touchMoveHandler);
        }
    
        this.draw();
    }

    drawRect(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, w, h);
    }

    drawVerticalText(text, x, y, color = "#25262C") {
        this.ctx.save();
        this.ctx.translate(x + 12, y);
        this.ctx.rotate(Math.PI / 2);
        this.ctx.font = "bold 16px Montserrat";
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, 0, 0);
        this.ctx.restore();
    }

    drawBall(x, y, radius, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.closePath();
    }

    draw() {
        this.drawRect(0, 0, this.canvas.width, this.canvas.height, "#25262C");
        this.drawRect(0, this.playerY, this.paddleWidth, this.paddleHeight, "#fdd760");
        this.drawVerticalText("VOCÊ", 0, this.playerY + 10);
        this.drawRect(this.canvas.width - this.paddleWidth, this.aiY, this.paddleWidth, this.paddleHeight, "#fdd760");
        this.drawBall(this.ballX, this.ballY, this.ballRadius, "#fdd760");
    }

    update() {
        // Primeiro, verifique se a bola saiu dos limites horizontais
        if (this.ballX - this.ballRadius < 0) {
            this.fimDeJogo(false);
            return;
        }
        if (this.ballX + this.ballRadius > this.canvas.width) {
            this.fimDeJogo(true);
            return;
        }

        // Atualiza a posição da bola
        this.ballX += this.ballSpeedX;
        this.ballY += this.ballSpeedY;

        // Controle da raquete da IA com interpolação (fase 1)
        const targetY = this.ballY - this.paddleHeight / 2;
        this.aiY += (targetY - this.aiY) * 0.1;
        this.aiY = Math.max(0, Math.min(this.canvas.height - this.paddleHeight, this.aiY));

        // Colisão com as paredes superior e inferior
        if (this.ballY + this.ballRadius > this.canvas.height || this.ballY - this.ballRadius < 0) {
            this.ballSpeedY *= -1;
            this.ballY = Math.max(this.ballRadius + 1, Math.min(this.canvas.height - this.ballRadius - 1, this.ballY));
        }

        // Colisão com a raquete do jogador
        if (
            this.ballX - this.ballRadius <= this.paddleWidth + 2 &&
            this.ballY + this.ballRadius >= this.playerY &&
            this.ballY - this.ballRadius <= this.playerY + this.paddleHeight &&
            // Verifica se a bola não está muito próxima da parede superior ou inferior:
            (this.ballY - this.ballRadius > 5 && this.ballY + this.ballRadius < this.canvas.height - 5)
        ) {
            if (!this.playerCollisionActive) {
                const angle = ((this.ballY - (this.playerY + this.paddleHeight / 2)) / (this.paddleHeight / 2)) * Math.PI / 4;
                // Use a velocidade adequada para cada fase
                const speed = this.emFase2 
                                ? this.ballSpeedBase + (this.velocidadeExtra += 1.0)
                                : this.ballSpeedBase + this.rebounds * 1.0;
                this.ballSpeedX = speed * Math.cos(angle);
                this.ballSpeedY = speed * Math.sin(angle);
                
                // Incrementa a contagem somente se não estiver no caso de colisão com as paredes
                if (this.emFase2) {
                    this.rebatesFase2++;
                    if (this.rebatesFase2 > 9999) this.rebatesFase2 = 9999;
                    this.rebatesAtuais.textContent = this.rebatesFase2;
                    if (this.rebatesFase2 > this.recordRebatesValue) {
                        this.recordRebatesValue = this.rebatesFase2;
                        this.recordHolderName = this.playerName;
                        this.recordRebates.textContent = this.recordRebatesValue + " (" + this.recordHolderName + ")";
                        localStorage.setItem('recordRebatesMGU', this.recordRebatesValue);
                        localStorage.setItem('recordHolderNameMGU', this.recordHolderName);
                    }
                } else {
                    this.rebounds++;
                    this.contadorRebates.textContent = `Rebates: ${this.rebounds} / ${this.goalRebounds}`;
                }
                this.playerCollisionActive = true;
            }
        } else {
            this.playerCollisionActive = false;
        }

        // Colisão com a raquete da IA
        if (this.ballX + this.ballRadius > this.canvas.width - this.paddleWidth &&
            this.ballY + this.ballRadius >= this.aiY &&
            this.ballY - this.ballRadius <= this.aiY + this.paddleHeight) {

            this.ballSpeedX *= -1;
        }

        this.draw();
    }

    fase2Game() {
        if (!this.emFase2) return;

        // Verifica saída dos limites antes de processar colisões
        if (this.ballX - this.ballRadius < 0) {
            this.fimDeJogo(false);
            return;
        }
        if (this.ballX + this.ballRadius > this.canvas.width) {
            this.fimDeJogo(true);
            return;
        }

        this.velocidadeExtra += this.aumentoVelocidade;
        this.ballX += this.ballSpeedX;
        this.ballY += this.ballSpeedY;

        // Atualiza a raquete da IA sem delay (fase 2)
        this.aiY = this.ballY - this.paddleHeight / 2;
        this.aiY = Math.max(0, Math.min(this.canvas.height - this.paddleHeight, this.aiY));

        // Colisão com as paredes superior e inferior
        if (this.ballY + this.ballRadius > this.canvas.height || this.ballY - this.ballRadius < 0) {
            this.ballSpeedY *= -1;
            this.ballY = Math.max(this.ballRadius + 1, Math.min(this.canvas.height - this.ballRadius - 1, this.ballY));
        }

        // Colisão com a raquete do jogador
        if (
            this.ballX - this.ballRadius <= this.paddleWidth + 2 &&
            this.ballY + this.ballRadius >= this.playerY &&
            this.ballY - this.ballRadius <= this.playerY + this.paddleHeight &&
            // Verifica se a bola não está muito próxima da parede superior ou inferior:
            (this.ballY - this.ballRadius > 5 && this.ballY + this.ballRadius < this.canvas.height - 5)
        ) {
            if (!this.playerCollisionActive) {
                const angle = ((this.ballY - (this.playerY + this.paddleHeight / 2)) / (this.paddleHeight / 2)) * Math.PI / 4;
                // Use a velocidade adequada para cada fase
                const speed = this.emFase2 
                                ? this.ballSpeedBase + (this.velocidadeExtra += 1.0)
                                : this.ballSpeedBase + this.rebounds * 1.0;
                this.ballSpeedX = speed * Math.cos(angle);
                this.ballSpeedY = speed * Math.sin(angle);
                
                // Incrementa a contagem somente se não estiver no caso de colisão com as paredes
                if (this.emFase2) {
                    this.rebatesFase2++;
                    if (this.rebatesFase2 > 9999) this.rebatesFase2 = 9999;
                    this.rebatesAtuais.textContent = this.rebatesFase2;
                    if (this.rebatesFase2 > this.recordRebatesValue) {
                        this.recordRebatesValue = this.rebatesFase2;
                        this.recordHolderName = this.playerName;
                        this.recordRebates.textContent = this.recordRebatesValue + " (" + this.recordHolderName + ")";
                        localStorage.setItem('recordRebatesMGU', this.recordRebatesValue);
                        localStorage.setItem('recordHolderNameMGU', this.recordHolderName);
                    }
                } else {
                    this.rebounds++;
                    this.contadorRebates.textContent = `Rebates: ${this.rebounds} / ${this.goalRebounds}`;
                }
                this.playerCollisionActive = true;
            }
        } else {
            this.playerCollisionActive = false;
        }

        // Colisão com a raquete da IA
        if (this.ballX + this.ballRadius > this.canvas.width - this.paddleWidth &&
            this.ballY + this.ballRadius >= this.aiY &&
            this.ballY - this.ballRadius <= this.aiY + this.paddleHeight) {

            this.ballSpeedX *= -1;
        }

        this.draw();
    }

    gameLoopFase1() {
        if (this.fimDeJogoAtivo) return;
        this.update();
        this.draw();
        this.gameInterval = requestAnimationFrame(() => this.gameLoopFase1());
    }

    gameLoopFase2() {
        if (!this.emFase2) return;
        this.fase2Game();
        this.gameInterval = requestAnimationFrame(() => this.gameLoopFase2());
    }

    startGame() {
        this.playerName = this.playerNameInput.value.trim();
        if (!this.playerName) {
            alert("Por favor, digite seu nome antes de começar.");
            return;
        }
        if (this.gameInterval) {
            cancelAnimationFrame(this.gameInterval);
            this.gameInterval = null;
        }
        this.fimDeJogoAtivo = false;
        this.playerNameInput.style.display = "none";
        this.botaoStart.style.display = "none";
        this.canvas.style.cursor = 'none';
        this.emFase2 = false;
        this.initGame();
        this.gameLoopFase1();
    }

    iniciarFase2() {
        if (this.gameInterval) {
            cancelAnimationFrame(this.gameInterval);
            this.gameInterval = null;
        }
        this.fimDeJogoAtivo = false;
        this.botaoAvancar.style.display = 'none';
        this.botaoNovoJogo.style.display = 'none';
        this.botaoReiniciar.style.display = 'none';
        this.canvas.style.cursor = 'none';
        this.emFase2 = true;
        this.velocidadeExtra = 0;
        this.mensagemFinal.style.display = 'none';
        this.mensagemDerrota.style.display = 'none';
        this.contadorRebatesFase2.style.display = "inline-block";
        this.recordRebates.style.display = "inline-block";
        this.contadorRebates.style.display = "none";
        this.rebatesFase2 = 0;
        this.rebatesAtuais.textContent = "0";
        this.initGame();
        this.gameLoopFase2();
    }

    reiniciarFase2() {
        if (this.gameInterval) {
            cancelAnimationFrame(this.gameInterval);
            this.gameInterval = null;
        }
        this.fimDeJogoAtivo = false;
        this.botaoNovoJogo.style.display = 'none';
        this.botaoReiniciar.style.display = 'none';
        this.canvas.style.cursor = 'none';
        this.emFase2 = true;
        this.velocidadeExtra = 0;
        this.initGame();
        this.gameLoopFase2();
    }

    reiniciarJogo() {
        if (this.gameInterval) {
            cancelAnimationFrame(this.gameInterval);
            this.gameInterval = null;
        }
        this.fimDeJogoAtivo = false;
        this.botaoStart.style.display = "none";
        this.botaoReiniciar.style.display = "none";
        this.botaoNovoJogo.style.display = "none";
        this.canvas.style.cursor = 'none';
        this.emFase2 = false;
        this.initGame();
        this.gameLoopFase1();
    }

    fimDeJogo(venceu) {
        this.fimDeJogoAtivo = true;
        if (this.gameInterval) {
            cancelAnimationFrame(this.gameInterval);
            this.gameInterval = null;
        }
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        this.canvas.removeEventListener('touchmove', this.touchMoveHandler);
        this.canvas.style.cursor = 'auto';
        this.draw();
        
        const estavaNaFase2 = this.emFase2;
        this.emFase2 = false;
        
        if (estavaNaFase2) {
            if (venceu) {
                this.mensagemFinal.textContent = `INCRÍVEL! Você venceu com ${this.rebatesFase2} rebatidas! 🏆`;
                this.mensagemFinal.style.display = 'block';
                this.confettiManager.start();
                this.botaoNovoJogo.style.display = 'block';
                this.rankingManager.verificarTop3(this.playerName, this.rebatesFase2);
            } else {
                this.mensagemDerrota.textContent = `Você fez ${this.rebatesFase2} rebatidas! Seu recorde: ${this.recordRebatesValue}`;
                this.mensagemDerrota.style.display = 'block';
                this.botaoNovoJogo.style.display = 'block';
            }
        } else {
            if (venceu) {
                this.mensagemFinal.style.display = "block";
                this.cupomFinal.style.display = "block";
                this.botaoAvancar.style.display = 'block';
                this.confettiManager.start();
            } else {
                this.mensagemDerrota.textContent = "Você perdeu! Tente novamente para garantir seu cupom.";
                this.mensagemDerrota.style.display = "block";
                this.botaoReiniciar.style.display = "block";
            }
        }
    }

    copiarCupom() {
        const textarea = document.createElement('textarea');
        textarea.value = this.cupomCode.textContent;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Cupom copiado para a área de transferência!');
    }
}

// Inicializa o jogo após o carregamento da página
window.onload = () => {
    // Mostra ranking e botão de start após 200ms
    setTimeout(() => {
        document.getElementById("ranking").style.display = "block";
        document.getElementById("botaoStart").style.display = "block";
    }, 200);
    const game = new Game();
    // Carrega o ranking inicialmente
    game.rankingManager.carregarRanking();
};